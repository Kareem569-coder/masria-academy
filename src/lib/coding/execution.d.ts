/**
 * MASRIA trusted execution gateway contract (Phase D3A).
 *
 * This module is Firebase-independent. It does not run student code.
 *
 * Pipeline (later phases implement the isolated runner and evaluator):
 *
 *   Client
 *     → CodingSubmission          (student-controlled source only)
 *     → Trusted Gateway           (authn/authz, never the browser)
 *     → ExecutionRequest          (this contract)
 *     → Isolated Runner           (D3B+)
 *     → ExecutionResult           (this contract; NOT a grade)
 *     → Evaluator                 (D3B+)
 *     → CodingEvaluation          (authoritative verdict/score)
 *     → CodingActivityProgress    (authoritative mastery)
 *
 * ExecutionResult != CodingEvaluation.
 * The runner executes code. The evaluator determines correctness.
 * The evaluator, not the student, determines the authoritative result.
 *
 * Client / browser MUST NEVER:
 * - create or modify coding_evaluations
 * - create or modify coding_activity_progress
 * - supply verdict, scorePercent, passedTestCount, or evaluatorVersion
 * - bypass the submission gateway
 * - choose runner limits, hidden tests, env, network, or filesystem config
 *
 * Idempotency (enforced later by the trusted gateway/database, not D3A):
 * - requestId is derived from submissionId + contractVersion (not a client UUID)
 * - one submissionId maps to at most one execution job per contract version
 * - optional idempotencyKey is a uniqueness hint, not a lock
 * Distributed locking is deferred.
 */
import { type ProgrammingLanguageId } from '@/lib/coding/languages';
import { type CodingSubmission, type ValidationResult } from '@/lib/coding/submission';
export declare const EXECUTION_CONTRACT_VERSION = "masria-exec-1";
export declare const MAX_EXECUTION_OUTPUT_LENGTH = 65536;
export declare const MAX_EXECUTION_REQUEST_ID_LENGTH = 256;
export type ExecutionStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export declare const EXECUTION_STATUSES: readonly ExecutionStatus[];
export type ExecutionFailureReason = 'COMPILE_ERROR' | 'RUNTIME_ERROR' | 'TIME_LIMIT' | 'MEMORY_LIMIT' | 'OUTPUT_LIMIT' | 'SYSTEM_ERROR' | 'NOT_IMPLEMENTED';
export declare const EXECUTION_FAILURE_REASONS: readonly ExecutionFailureReason[];
/**
 * Limits applied only by trusted challenge configuration / gateway.
 * Never accepted from the student submission payload.
 */
export interface TrustedExecutionLimits {
    timeLimitMs: number;
    memoryLimitMb: number;
}
export interface ExecutionRequest {
    requestId: string;
    submissionId: string;
    studentId: string;
    lessonId: string;
    activityId: string;
    challengeVersion: number;
    language: ProgrammingLanguageId;
    sourceCode: string;
    requestedAt: string;
    contractVersion: string;
    status: ExecutionStatus;
    idempotencyKey?: string;
    timeLimitMs?: number;
    memoryLimitMb?: number;
    deadlineAt?: string;
}
export interface ExecutionResult {
    requestId: string;
    submissionId: string;
    status: ExecutionStatus;
    language: ProgrammingLanguageId;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    executionTimeMs?: number;
    memoryUsedKb?: number;
    failureReason?: ExecutionFailureReason;
    runnerVersion: string;
    completedAt: string;
}
export interface ExecutionService {
    execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
export declare function isExecutionStatus(value: unknown): value is ExecutionStatus;
export declare function isExecutionFailureReason(value: unknown): value is ExecutionFailureReason;
export declare function validateExecutionRequestId(value: unknown): ValidationResult;
export declare function validateExecutionRequest(value: unknown): ValidationResult;
export declare function validateExecutionResult(value: unknown): ValidationResult;
export declare function deriveExecutionRequestId(submissionId: string, contractVersion?: string): string;
export declare function deriveExecutionIdempotencyKey(submission: Pick<CodingSubmission, 'id' | 'idempotencyKey'>): string;
export declare function validateTrustedExecutionLimits(value: unknown): ValidationResult;
export type MapSubmissionToExecutionRequestResult = {
    valid: true;
    request: ExecutionRequest;
} | {
    valid: false;
    errors: string[];
};
/**
 * Maps a queued CodingSubmission to an ExecutionRequest.
 * Student-supplied runner configuration is rejected, not copied.
 * Optional trustedLimits come from challenge configuration, never the client.
 */
export declare function mapQueuedSubmissionToExecutionRequest(submission: unknown, options?: {
    requestedAt?: string;
    trustedLimits?: TrustedExecutionLimits;
}): MapSubmissionToExecutionRequestResult;
/**
 * Placeholder only. Does not compile, interpret, or sandbox code.
 * The browser must not call this; D3B+ attaches a trusted backend implementation.
 */
export declare class NotImplementedExecutionService implements ExecutionService {
    execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
//# sourceMappingURL=execution.d.ts.map