import { type AttemptPolicy, type CodingActivityProgress, type CodingEvaluation } from '@/lib/coding/submission';
import { type ExecutionResult, type ExecutionService, type TrustedExecutionLimits } from '@/lib/coding/execution';
import { type OutputComparisonPolicy } from '@/lib/coding/evaluator';
import type { CodingChallengeActivity, PrivateChallengeConfiguration } from '@/types/models';
import type { CodingSubmission } from '@/lib/coding/submission';
/**
 * Pipeline Configuration: authoritative settings that influence orchestration.
 * These are derived from challenge configuration, attempt policy, and user state.
 * Never from student submission input.
 */
export interface PipelineConfig {
    outputComparisonPolicy?: OutputComparisonPolicy;
    attemptPolicy?: AttemptPolicy;
    trustedExecutionLimits?: TrustedExecutionLimits;
    currentAttemptCount?: number;
    currentProgress?: CodingActivityProgress | null;
}
/**
 * Pipeline Result: the authoritative evaluation and progress.
 */
export interface PipelineResult {
    evaluation: CodingEvaluation;
    progress: CodingActivityProgress;
    executionResult: ExecutionResult;
}
/**
 * Validation context for pipeline operations.
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
/**
 * Validates that the challenge activity is executable and matches the submission.
 */
export declare function validateChallengeCompatibility(challenge: unknown, submission: CodingSubmission): ValidationResult;
/**
 * Validates the private challenge configuration for compatibility.
 */
export declare function validatePrivateConfigCompatibility(config: PrivateChallengeConfiguration, submission: CodingSubmission): ValidationResult;
/**
 * Derives trusted execution limits from the challenge activity.
 */
export declare function deriveTrustedExecutionLimits(challenge: CodingChallengeActivity): TrustedExecutionLimits;
/**
 * Orchestrates the complete evaluation pipeline.
 *
 * Flow:
 * 1. Validate submission and challenge compatibility
 * 2. Validate attempt limits (if provided)
 * 3. Map submission to execution request
 * 4. Execute through the provided service
 * 5. Evaluate results using public + private tests
 * 6. Generate/update progress
 *
 * @param submission - valid CodingSubmission (must be 'queued' status)
 * @param challenge - CodingChallengeActivity
 * @param privateConfig - PrivateChallengeConfiguration (must not be exposed to student)
 * @param executionService - ExecutionService implementation (D3B runner)
 * @param config - pipeline configuration (limits, policies, attempt state)
 * @returns CodingEvaluation and CodingActivityProgress
 */
export declare function evaluateCodingSubmissionPipeline(submission: unknown, challenge: unknown, privateConfig: PrivateChallengeConfiguration, executionService: ExecutionService, config?: PipelineConfig): Promise<PipelineResult>;
//# sourceMappingURL=pipeline.d.ts.map