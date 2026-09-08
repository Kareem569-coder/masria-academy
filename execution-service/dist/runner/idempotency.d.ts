import type { ExecutionResult } from '../../../src/lib/coding/execution';
export declare class LocalIdempotencyGate {
    private readonly jobs;
    keyFor(requestId: string, idempotencyKey?: string): string;
    run(key: string, work: () => Promise<ExecutionResult>): Promise<ExecutionResult>;
}
/**
 * D3C must replace this process-local map with a distributed lock/store keyed by
 * requestId + submissionId so multiple execution-service replicas cannot run the
 * same job twice.
 */
export declare const idempotencyNotes: {
    readonly scope: "single-process";
    readonly distributedLock: false;
};
//# sourceMappingURL=idempotency.d.ts.map