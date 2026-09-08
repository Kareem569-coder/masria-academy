import type { ExecutionResult } from '../../../src/lib/coding/execution';

interface CacheEntry {
  inFlight?: Promise<ExecutionResult>;
  result?: ExecutionResult;
}

export class LocalIdempotencyGate {
  private readonly jobs = new Map<string, CacheEntry>();

  keyFor(requestId: string, idempotencyKey?: string): string {
    return `${requestId}::${idempotencyKey ?? requestId}`;
  }

  async run(key: string, work: () => Promise<ExecutionResult>): Promise<ExecutionResult> {
    const existing = this.jobs.get(key);
    if (existing?.result) {
      return existing.result;
    }
    if (existing?.inFlight) {
      return existing.inFlight;
    }

    const inFlight = work()
      .then((result) => {
        this.jobs.set(key, { result });
        return result;
      })
      .catch((error: unknown) => {
        this.jobs.delete(key);
        throw error;
      });

    this.jobs.set(key, { inFlight });
    return inFlight;
  }
}

/**
 * D3C must replace this process-local map with a distributed lock/store keyed by
 * requestId + submissionId so multiple execution-service replicas cannot run the
 * same job twice.
 */
export const idempotencyNotes = {
  scope: 'single-process',
  distributedLock: false,
} as const;
