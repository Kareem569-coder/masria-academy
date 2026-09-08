import { type ProgrammingLanguageId } from '@/lib/coding/languages';
export type SubmissionStatus = 'queued' | 'running' | 'completed' | 'failed';
export declare const SUBMISSION_STATUSES: readonly SubmissionStatus[];
export declare function isSubmissionStatus(value: unknown): value is SubmissionStatus;
export type EvaluationVerdict = 'AC' | 'WA' | 'CE' | 'RE' | 'TLE' | 'MLE' | 'SYSTEM_ERROR';
export declare const EVALUATION_VERDICTS: readonly EvaluationVerdict[];
export declare function isEvaluationVerdict(value: unknown): value is EvaluationVerdict;
export type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED';
export declare const PROGRESS_STATUSES: readonly ProgressStatus[];
export declare function isProgressStatus(value: unknown): value is ProgressStatus;
export type AttemptPolicyMode = 'unlimited' | 'limited';
export interface AttemptPolicy {
    mode: AttemptPolicyMode;
    maxAttempts?: number;
}
export declare function isAttemptPolicyMode(value: unknown): value is AttemptPolicyMode;
export interface PublicTestResult {
    testId: string;
    passed: boolean;
    actualOutput?: string;
    expectedOutput?: string;
    executionTimeMs?: number;
}
export interface CodingSubmission {
    id: string;
    studentId: string;
    lessonId: string;
    activityId: string;
    challengeVersion: number;
    language: ProgrammingLanguageId;
    sourceCode: string;
    status: SubmissionStatus;
    submittedAt: string;
    idempotencyKey?: string;
}
export interface CodingEvaluation {
    submissionId: string;
    studentId: string;
    lessonId: string;
    activityId: string;
    verdict: EvaluationVerdict;
    scorePercent: number;
    passedTestCount: number;
    totalTestCount: number;
    publicTestResults: PublicTestResult[];
    executionTimeMs?: number;
    memoryUsedKb?: number;
    feedback_en?: string;
    feedback_ar?: string;
    evaluatedAt: string;
    evaluatorVersion: string;
}
export interface CodingActivityProgress {
    studentId: string;
    lessonId: string;
    activityId: string;
    challengeVersion: number;
    status: ProgressStatus;
    bestScorePercent: number;
    attempts: number;
    passed: boolean;
    lastSubmissionId?: string;
    updatedAt: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare const MAX_SOURCE_CODE_LENGTH = 100000;
export declare const MAX_IDEMPOTENCY_KEY_LENGTH = 256;
export declare function validateIdempotencyKey(value: unknown): ValidationResult;
export declare function validateCodingSubmission(value: unknown): ValidationResult;
export declare function validateAttemptPolicy(value: unknown): ValidationResult;
export declare function canSubmitAnotherAttempt(currentAttempts: number, policy: AttemptPolicy): boolean;
export declare function validatePublicTestResult(value: unknown): ValidationResult;
export declare function validateCodingEvaluation(value: unknown): ValidationResult;
export declare function validateCodingActivityProgress(value: unknown): ValidationResult;
//# sourceMappingURL=submission.d.ts.map