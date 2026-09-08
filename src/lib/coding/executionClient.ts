/**
 * D3F: Trusted Execution Service HTTP Client
 * 
 * Server-only module for communicating with the isolated execution-service.
 * Never import this into client components.
 * 
 * Responsibilities:
 * - Read execution-service URL from trusted environment configuration
 * - Authenticate requests with service-to-service token
 * - Send validated ExecutionRequest data
 * - Validate ExecutionResult before returning
 * - Handle timeouts and infrastructure failures
 * - Never expose secrets, private tests, or reference solutions
 */

import {
  type ExecutionRequest,
  type ExecutionResult,
  EXECUTION_CONTRACT_VERSION,
  type ExecutionStatus,
  isExecutionStatus,
  isExecutionFailureReason,
  type ExecutionFailureReason,
  type ExecutionService,
} from '@/lib/coding/execution';

export const EXECUTION_CLIENT_DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds
export const EXECUTION_CLIENT_MAX_RESPONSE_SIZE = 1_000_000; // 1 MB

interface ExecutionClientConfig {
  executionServiceUrl: string;
  serviceToken: string;
  timeoutMs?: number;
  maxResponseSize?: number;
}

/**
 * Validates that an ExecutionResult is safe to use by the evaluator.
 * Rejects any unexpected or potentially dangerous fields.
 */
function validateExecutionResult(result: unknown): { valid: true; result: ExecutionResult } | { valid: false; error: string } {
  if (typeof result !== 'object' || result === null) {
    return { valid: false, error: 'Execution result must be an object' };
  }

  const r = result as Record<string, unknown>;

  // Required fields
  if (typeof r.requestId !== 'string' || !r.requestId.trim()) {
    return { valid: false, error: 'Invalid or missing requestId' };
  }
  if (typeof r.submissionId !== 'string' || !r.submissionId.trim()) {
    return { valid: false, error: 'Invalid or missing submissionId' };
  }
  if (!isExecutionStatus(r.status)) {
    return { valid: false, error: `Invalid execution status: ${r.status}` };
  }
  if (typeof r.language !== 'string' || !r.language.trim()) {
    return { valid: false, error: 'Invalid or missing language' };
  }
  if (typeof r.runnerVersion !== 'string' || !r.runnerVersion.trim()) {
    return { valid: false, error: 'Invalid or missing runnerVersion' };
  }
  if (typeof r.completedAt !== 'string' || !r.completedAt.trim()) {
    return { valid: false, error: 'Invalid or missing completedAt' };
  }

  // Validate timestamp is ISO 8601
  if (isNaN(new Date(r.completedAt).getTime())) {
    return { valid: false, error: 'Invalid completedAt timestamp' };
  }

  // Optional fields must be valid if present
  if (r.stdout !== undefined) {
    if (typeof r.stdout !== 'string') {
      return { valid: false, error: 'stdout must be a string' };
    }
    if (Buffer.byteLength(r.stdout, 'utf-8') > EXECUTION_CLIENT_MAX_RESPONSE_SIZE) {
      return { valid: false, error: 'stdout exceeds maximum size' };
    }
  }

  if (r.stderr !== undefined) {
    if (typeof r.stderr !== 'string') {
      return { valid: false, error: 'stderr must be a string' };
    }
    if (Buffer.byteLength(r.stderr, 'utf-8') > EXECUTION_CLIENT_MAX_RESPONSE_SIZE) {
      return { valid: false, error: 'stderr exceeds maximum size' };
    }
  }

  if (r.exitCode !== undefined) {
    if (!Number.isInteger(r.exitCode) || typeof r.exitCode !== 'number') {
      return { valid: false, error: 'exitCode must be an integer' };
    }
    if ((r.exitCode as number) < -128 || (r.exitCode as number) > 255) {
      return { valid: false, error: 'exitCode out of valid range' };
    }
  }

  if (r.executionTimeMs !== undefined) {
    if (!Number.isInteger(r.executionTimeMs) || (r.executionTimeMs as number) < 0) {
      return { valid: false, error: 'executionTimeMs must be a non-negative integer' };
    }
  }

  if (r.memoryUsedKb !== undefined) {
    if (!Number.isInteger(r.memoryUsedKb) || (r.memoryUsedKb as number) < 0) {
      return { valid: false, error: 'memoryUsedKb must be a non-negative integer' };
    }
  }

  if (r.failureReason !== undefined) {
    if (!isExecutionFailureReason(r.failureReason)) {
      return { valid: false, error: `Invalid failureReason: ${r.failureReason}` };
    }
  }

  // Reject any unexpected fields that might contain secrets or private data
  const allowedKeys = new Set([
    'requestId',
    'submissionId',
    'status',
    'language',
    'stdout',
    'stderr',
    'exitCode',
    'executionTimeMs',
    'memoryUsedKb',
    'failureReason',
    'runnerVersion',
    'completedAt',
  ]);

  const unexpectedKeys = Object.keys(r).filter((key) => !allowedKeys.has(key));
  if (unexpectedKeys.length > 0) {
    return { valid: false, error: `Unexpected fields in execution result: ${unexpectedKeys.join(', ')}` };
  }

  return {
    valid: true,
    result: {
      requestId: r.requestId as string,
      submissionId: r.submissionId as string,
      status: r.status as ExecutionStatus,
      language: r.language as any,
      stdout: r.stdout as string | undefined,
      stderr: r.stderr as string | undefined,
      exitCode: r.exitCode as number | undefined,
      executionTimeMs: r.executionTimeMs as number | undefined,
      memoryUsedKb: r.memoryUsedKb as number | undefined,
      failureReason: r.failureReason as ExecutionFailureReason | undefined,
      runnerVersion: r.runnerVersion as string,
      completedAt: r.completedAt as string,
    },
  };
}

/**
 * Creates a system error response when infrastructure fails.
 * Never fabricates AC/WA results.
 */
function systemErrorResult(request: ExecutionRequest, reason: string): ExecutionResult {
  return {
    requestId: request.requestId,
    submissionId: request.submissionId,
    status: 'FAILED',
    language: request.language,
    failureReason: 'SYSTEM_ERROR',
    runnerVersion: 'unknown',
    completedAt: new Date().toISOString(),
    stdout: '',
    stderr: reason,
    exitCode: -1,
    executionTimeMs: 0,
    memoryUsedKb: 0,
  };
}

/**
 * HTTP client for the isolated execution-service.
 * Implements the ExecutionService interface.
 */
export class RemoteExecutionService implements ExecutionService {
  private config: ExecutionClientConfig;

  constructor(config: ExecutionClientConfig) {
    if (!config.executionServiceUrl) {
      throw new Error('executionServiceUrl is required');
    }
    if (!config.serviceToken || config.serviceToken.length < 16) {
      throw new Error('serviceToken must be at least 16 characters');
    }
    this.config = {
      timeoutMs: EXECUTION_CLIENT_DEFAULT_TIMEOUT_MS,
      maxResponseSize: EXECUTION_CLIENT_MAX_RESPONSE_SIZE,
      ...config,
    };
  }

  /**
   * Execute a coding submission via HTTP POST to the execution-service.
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await fetch(`${this.config.executionServiceUrl}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.serviceToken}`,
            'User-Agent': 'MASRIA-D3E/1.0',
            'X-Request-Id': request.requestId,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // Handle auth failures
        if (response.status === 401 || response.status === 403) {
          console.error('Execution service authentication failed', {
            requestId: request.requestId,
            status: response.status,
          });
          return systemErrorResult(request, 'Execution service authentication failed');
        }

        // Handle invalid requests
        if (response.status === 400) {
          let errorBody: unknown;
          try {
            errorBody = await response.json();
          } catch {
            // Continue with generic error
          }
          console.error('Execution service rejected request', {
            requestId: request.requestId,
            status: 400,
            body: errorBody,
          });
          return systemErrorResult(request, 'Invalid execution request');
        }

        // Handle service unavailable
        if (response.status >= 500) {
          console.error('Execution service error', {
            requestId: request.requestId,
            status: response.status,
          });
          return systemErrorResult(request, `Execution service error (${response.status})`);
        }

        // Handle unexpected status codes
        if (response.status !== 200) {
          console.error('Unexpected execution service response', {
            requestId: request.requestId,
            status: response.status,
          });
          return systemErrorResult(request, `Unexpected response status: ${response.status}`);
        }

        // Parse response
        let result: unknown;
        try {
          result = await response.json();
        } catch (error) {
          console.error('Failed to parse execution service response', {
            requestId: request.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          return systemErrorResult(request, 'Failed to parse execution service response');
        }

        // Validate result
        const validation = validateExecutionResult(result);
        if (!validation.valid) {
          console.error('Execution service result validation failed', {
            requestId: request.requestId,
            error: validation.error,
          });
          return systemErrorResult(request, `Invalid execution result: ${validation.error}`);
        }

        return validation.result;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      // Handle network errors, timeouts, etc.
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const message = isTimeout ? 'Execution request timeout' : `Execution service error: ${error instanceof Error ? error.message : String(error)}`;

      console.error(isTimeout ? 'Execution service timeout' : 'Execution service request failed', {
        requestId: request.requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      return systemErrorResult(request, message);
    }
  }
}

/**
 * Factory function to create a RemoteExecutionService from environment variables.
 * Only available on the server.
 */
export function createRemoteExecutionService(): RemoteExecutionService {
  const executionServiceUrl = process.env.EXECUTION_SERVICE_URL;
  const serviceToken = process.env.MASRIA_EXECUTION_SERVICE_TOKEN;

  if (!executionServiceUrl) {
    throw new Error('EXECUTION_SERVICE_URL environment variable is not set');
  }
  if (!serviceToken) {
    throw new Error('MASRIA_EXECUTION_SERVICE_TOKEN environment variable is not set');
  }

  return new RemoteExecutionService({
    executionServiceUrl,
    serviceToken,
  });
}
