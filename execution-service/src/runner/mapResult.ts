import type { ExecutionFailureReason, ExecutionRequest, ExecutionResult } from '../contract/execution';
import { MAX_EXECUTION_OUTPUT_LENGTH, validateExecutionResult } from '../contract/execution';
import { RUNNER_LANGUAGE, RUNNER_VERSION } from '../config/limits';
import type { SupervisorReport } from '../sandbox/protocol';

function truncateOutput(value: string): string {
  return value.length > MAX_EXECUTION_OUTPUT_LENGTH
    ? value.slice(0, MAX_EXECUTION_OUTPUT_LENGTH)
    : value;
}

export function mapSupervisorReportToExecutionResult(
  request: ExecutionRequest,
  report: SupervisorReport,
  extras?: { oomKilled?: boolean }
): ExecutionResult {
  let failureReason: ExecutionFailureReason | undefined;
  let status: ExecutionResult['status'] = 'COMPLETED';

  if (extras?.oomKilled) {
    status = 'FAILED';
    failureReason = 'MEMORY_LIMIT';
  } else if (report.status === 'COMPLETED' && !report.failureReason) {
    status = 'COMPLETED';
  } else {
    status = 'FAILED';
    const mapped = report.failureReason as ExecutionFailureReason;
    failureReason = [
      'COMPILE_ERROR',
      'RUNTIME_ERROR',
      'TIME_LIMIT',
      'MEMORY_LIMIT',
      'OUTPUT_LIMIT',
      'SYSTEM_ERROR',
    ].includes(mapped)
      ? mapped
      : 'SYSTEM_ERROR';
  }

  const result: ExecutionResult = {
    requestId: request.requestId,
    submissionId: request.submissionId,
    status,
    language: request.language,
    stdout: truncateOutput(report.stdout),
    stderr: truncateOutput(report.stderr),
    exitCode: report.exitCode,
    executionTimeMs: Math.max(0, report.executionTimeMs),
    failureReason,
    runnerVersion: RUNNER_VERSION,
    completedAt: new Date().toISOString(),
  };

  if (status === 'COMPLETED') {
    delete result.failureReason;
  }

  const validation = validateExecutionResult(result);
  if (!validation.valid) {
    return {
      requestId: request.requestId,
      submissionId: request.submissionId,
      status: 'FAILED',
      language: request.language,
      failureReason: 'SYSTEM_ERROR',
      runnerVersion: RUNNER_VERSION,
      completedAt: new Date().toISOString(),
      stderr: 'invalid execution result mapping',
      stdout: '',
      exitCode: 1,
      executionTimeMs: 0,
      memoryUsedKb: 0,
    };
  }

  return result;
}
