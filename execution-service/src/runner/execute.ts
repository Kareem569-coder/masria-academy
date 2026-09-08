import {
  validateExecutionRequest,
  type ExecutionRequest,
  type ExecutionResult,
} from '../contract/execution';
import { authorizeBearerToken, getExpectedServiceToken } from '../config/auth';
import { RUNNER_LANGUAGE, RUNNER_VERSION, clampJobLimits } from '../config/limits';
import { buildDockerRunArgs } from '../sandbox/dockerArgs';
import {
  collectSandboxForbiddenKeys,
  encodeJobPayload,
  isValidUtf8,
} from '../sandbox/protocol';
import { LocalIdempotencyGate } from './idempotency';
import { mapSupervisorReportToExecutionResult } from './mapResult';
import { dockerAvailable, jobWallClockMs, runIsolatedDockerJob } from './dockerJob';

export interface ExecuteContext {
  token?: string;
  authorizationHeader?: string;
  dockerRunner?: typeof runIsolatedDockerJob;
  dockerProbe?: typeof dockerAvailable;
}

const gate = new LocalIdempotencyGate();

function systemError(request: ExecutionRequest, stderr: string): ExecutionResult {
  return {
    requestId: request.requestId,
    submissionId: request.submissionId,
    status: 'FAILED',
    language: request.language,
    failureReason: 'SYSTEM_ERROR',
    runnerVersion: RUNNER_VERSION,
    completedAt: new Date().toISOString(),
    stderr,
    stdout: '',
    exitCode: 1,
    executionTimeMs: 0,
    memoryUsedKb: 0,
  };
}

export function previewTrustedRequest(body: unknown): { ok: true; request: ExecutionRequest } | { ok: false; errors: string[] } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: ['Execution request must be an object.'] };
  }
  const record = body as Record<string, unknown>;
  const forbidden = collectSandboxForbiddenKeys(record);
  if (forbidden.length > 0) {
    return { ok: false, errors: forbidden.map((key) => `Trusted execution input must not contain ${key}.`) };
  }

  const validation = validateExecutionRequest(record);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const request = record as unknown as ExecutionRequest;
  if (request.language !== RUNNER_LANGUAGE) {
    return { ok: false, errors: ['Only cpp17 is supported by this runner.'] };
  }
  if (!isValidUtf8(request.sourceCode)) {
    return { ok: false, errors: ['Source code must be valid UTF-8.'] };
  }
  if (Buffer.byteLength(request.sourceCode, 'utf8') > 100_000) {
    return { ok: false, errors: ['Source code exceeds maximum length.'] };
  }

  return { ok: true, request };
}

export async function executeTrustedRequest(
  body: unknown,
  context: ExecuteContext = {}
): Promise<{ statusCode: number; result?: ExecutionResult; errors?: string[] }> {
  const expectedToken = context.token ?? getExpectedServiceToken();
  if (!authorizeBearerToken(context.authorizationHeader, expectedToken)) {
    return { statusCode: 401, errors: ['unauthenticated'] };
  }

  const preview = previewTrustedRequest(body);
  if (!preview.ok) {
    return { statusCode: 400, errors: preview.errors };
  }

  const request = preview.request;
  const key = gate.keyFor(request.requestId, request.idempotencyKey);
  const result = await gate.run(key, async () => {
    const limits = clampJobLimits({
      timeLimitMs: request.timeLimitMs,
      memoryLimitMb: request.memoryLimitMb,
    });
    const probe = context.dockerProbe ?? dockerAvailable;
    if (!(await probe())) {
      return systemError(request, 'isolated docker runner is unavailable');
    }

    const spec = buildDockerRunArgs({ requestId: request.requestId, limits });
    const payload = encodeJobPayload({
      timeLimitMs: limits.timeLimitMs,
      memoryLimitMb: limits.memoryLimitMb,
      maxOutputBytes: limits.maxOutputBytes,
      sourceCode: request.sourceCode,
    });
    const runner = context.dockerRunner ?? runIsolatedDockerJob;
    const outcome = await runner({
      spec,
      payload,
      wallClockMs: jobWallClockMs(limits.timeLimitMs),
    });
    return mapSupervisorReportToExecutionResult(request, outcome.report, {
      oomKilled: outcome.oomKilled,
    });
  });

  return { statusCode: 200, result };
}

export function safeLogFields(result: ExecutionResult): Record<string, unknown> {
  return {
    requestId: result.requestId,
    submissionId: result.submissionId,
    language: result.language,
    runnerVersion: result.runnerVersion,
    status: result.status,
    duration: result.executionTimeMs,
    failureReason: result.failureReason ?? null,
  };
}
