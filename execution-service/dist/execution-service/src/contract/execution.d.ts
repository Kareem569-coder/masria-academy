/**
 * Execution Contract for MASRIA Execution Service
 *
 * This module mirrors the D3A execution contract from MASRIA to maintain
 * compatibility while keeping the execution-service physically separate.
 *
 * Contract version: masria-exec-1
 *
 * The execution-service is a separate deployable service that:
 * - Accepts ExecutionRequest from the trusted gateway
 * - Executes code in isolated Docker containers
 * - Returns ExecutionResult (NOT a grade/verdict)
 *
 * ExecutionResult != CodingEvaluation.
 * The runner executes code. The evaluator determines correctness.
 */
import { type ProgrammingLanguageId } from '../../../src/lib/coding/languages';
export declare const EXECUTION_CONTRACT_VERSION = "masria-exec-1";
export declare const MAX_EXECUTION_OUTPUT_LENGTH = 65536;
export declare const MAX_EXECUTION_REQUEST_ID_LENGTH = 256;
export type ExecutionStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export declare const EXECUTION_STATUSES: readonly ExecutionStatus[];
export type ExecutionFailureReason = 'COMPILE_ERROR' | 'RUNTIME_ERROR' | 'TIME_LIMIT' | 'MEMORY_LIMIT' | 'OUTPUT_LIMIT' | 'SYSTEM_ERROR' | 'NOT_IMPLEMENTED';
export declare const EXECUTION_FAILURE_REASONS: readonly ExecutionFailureReason[];
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
export declare const RUNNER_VERSION = "masria-cpp17-gcc13.4.0-v1";
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare function isExecutionStatus(value: unknown): value is ExecutionStatus;
export declare function isExecutionFailureReason(value: unknown): value is ExecutionFailureReason;
export declare function validateExecutionRequestId(value: unknown): ValidationResult;
export declare function validateExecutionRequest(value: unknown): ValidationResult;
export declare function validateExecutionResult(value: unknown): ValidationResult;
//# sourceMappingURL=execution.d.ts.map