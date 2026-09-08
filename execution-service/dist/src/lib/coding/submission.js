import { isProgrammingLanguageId } from '@/lib/coding/languages';
export const SUBMISSION_STATUSES = [
    'queued',
    'running',
    'completed',
    'failed',
];
export function isSubmissionStatus(value) {
    return typeof value === 'string' && SUBMISSION_STATUSES.includes(value);
}
export const EVALUATION_VERDICTS = [
    'AC',
    'WA',
    'CE',
    'RE',
    'TLE',
    'MLE',
    'SYSTEM_ERROR',
];
export function isEvaluationVerdict(value) {
    return typeof value === 'string' && EVALUATION_VERDICTS.includes(value);
}
export const PROGRESS_STATUSES = [
    'NOT_STARTED',
    'IN_PROGRESS',
    'PASSED',
];
export function isProgressStatus(value) {
    return typeof value === 'string' && PROGRESS_STATUSES.includes(value);
}
export function isAttemptPolicyMode(value) {
    return value === 'unlimited' || value === 'limited';
}
const valid = () => ({ valid: true, errors: [] });
const invalid = (...errors) => ({ valid: false, errors });
// ============================================================================
// VALIDATION HELPERS
// ============================================================================
const isRecord = (value) => (typeof value === 'object' && value !== null && !Array.isArray(value));
const isNonEmptyString = (value) => (typeof value === 'string' && value.trim().length > 0);
const isPositiveInteger = (value) => (Number.isInteger(value) && value > 0);
const isNonNegativeInteger = (value) => (Number.isInteger(value) && value >= 0);
export const MAX_SOURCE_CODE_LENGTH = 100_000;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 256;
const MAX_FEEDBACK_LENGTH = 10_000;
export function validateIdempotencyKey(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return invalid('Idempotency key must be a non-empty string if provided.');
    }
    if (value.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
        return invalid('Idempotency key exceeds maximum length.');
    }
    return valid();
}
// ============================================================================
// SOURCE CODE VALIDATION
// ============================================================================
export function validateCodingSubmission(value) {
    if (!isRecord(value)) {
        return invalid('Coding submission must be an object.');
    }
    const errors = [];
    // Required fields
    if (!isNonEmptyString(value.studentId)) {
        errors.push('Student ID is required.');
    }
    if (!isNonEmptyString(value.lessonId)) {
        errors.push('Lesson ID is required.');
    }
    if (!isNonEmptyString(value.activityId)) {
        errors.push('Activity ID is required.');
    }
    if (!isPositiveInteger(value.challengeVersion)) {
        errors.push('Challenge version must be a positive integer.');
    }
    if (!isProgrammingLanguageId(value.language)) {
        errors.push('Language must be a supported programming language.');
    }
    if (typeof value.sourceCode !== 'string' || value.sourceCode.trim().length === 0) {
        errors.push('Source code is required.');
    }
    else if (value.sourceCode.length > MAX_SOURCE_CODE_LENGTH) {
        errors.push('Source code exceeds maximum length.');
    }
    if (!isSubmissionStatus(value.status)) {
        errors.push('Status must be a valid submission status.');
    }
    if (!isNonEmptyString(value.submittedAt)) {
        errors.push('Submitted timestamp is required.');
    }
    if (value.idempotencyKey !== undefined) {
        const idempotency = validateIdempotencyKey(value.idempotencyKey);
        if (!idempotency.valid) {
            errors.push(...idempotency.errors);
        }
    }
    // Ensure submission does NOT contain evaluation/progress fields
    const forbiddenFields = [
        'verdict',
        'scorePercent',
        'passedTestCount',
        'totalTestCount',
        'passed',
        'mastery',
        'publicTestResults',
        'evaluatorVersion',
        'evaluatedAt',
        'executionTimeMs',
        'memoryUsedKb',
        'feedback_en',
        'feedback_ar',
    ];
    for (const field of forbiddenFields) {
        if (field in value) {
            errors.push(`Submission must not contain evaluation field: ${field}`);
        }
    }
    return errors.length === 0 ? valid() : invalid(...errors);
}
// ============================================================================
// ATTEMPT POLICY VALIDATION
// ============================================================================
export function validateAttemptPolicy(value) {
    if (!isRecord(value)) {
        return invalid('Attempt policy must be an object.');
    }
    const errors = [];
    if (!isAttemptPolicyMode(value.mode)) {
        errors.push('Attempt policy mode must be "unlimited" or "limited".');
    }
    if (value.mode === 'limited') {
        if (!isPositiveInteger(value.maxAttempts)) {
            errors.push('Limited attempt policy requires a positive maxAttempts.');
        }
    }
    if (value.mode === 'unlimited' && value.maxAttempts !== undefined) {
        errors.push('Unlimited attempt policy should not specify maxAttempts.');
    }
    return errors.length === 0 ? valid() : invalid(...errors);
}
export function canSubmitAnotherAttempt(currentAttempts, policy) {
    if (policy.mode === 'unlimited') {
        return true;
    }
    if (policy.mode === 'limited' && policy.maxAttempts !== undefined) {
        return currentAttempts < policy.maxAttempts;
    }
    return false;
}
// ============================================================================
// EVALUATION VALIDATION
// ============================================================================
export function validatePublicTestResult(value) {
    if (!isRecord(value)) {
        return invalid('Public test result must be an object.');
    }
    const errors = [];
    if (!isNonEmptyString(value.testId)) {
        errors.push('Test ID is required.');
    }
    if (typeof value.passed !== 'boolean') {
        errors.push('Passed flag must be a boolean.');
    }
    if (value.actualOutput !== undefined && typeof value.actualOutput !== 'string') {
        errors.push('Actual output must be a string if provided.');
    }
    if (value.expectedOutput !== undefined && typeof value.expectedOutput !== 'string') {
        errors.push('Expected output must be a string if provided.');
    }
    if (value.executionTimeMs !== undefined && !isNonNegativeInteger(value.executionTimeMs)) {
        errors.push('Execution time must be a non-negative integer if provided.');
    }
    return errors.length === 0 ? valid() : invalid(...errors);
}
export function validateCodingEvaluation(value) {
    if (!isRecord(value)) {
        return invalid('Coding evaluation must be an object.');
    }
    const errors = [];
    // Required fields
    if (!isNonEmptyString(value.submissionId)) {
        errors.push('Submission ID is required.');
    }
    if (!isNonEmptyString(value.studentId)) {
        errors.push('Student ID is required.');
    }
    if (!isNonEmptyString(value.lessonId)) {
        errors.push('Lesson ID is required.');
    }
    if (!isNonEmptyString(value.activityId)) {
        errors.push('Activity ID is required.');
    }
    if (!isEvaluationVerdict(value.verdict)) {
        errors.push('Verdict must be a valid evaluation verdict.');
    }
    // Score validation
    if (typeof value.scorePercent !== 'number' || value.scorePercent < 0 || value.scorePercent > 100) {
        errors.push('Score percent must be between 0 and 100.');
    }
    // Test count validation
    if (!isNonNegativeInteger(value.passedTestCount)) {
        errors.push('Passed test count must be a non-negative integer.');
    }
    if (!isNonNegativeInteger(value.totalTestCount)) {
        errors.push('Total test count must be a non-negative integer.');
    }
    if (isNonNegativeInteger(value.passedTestCount) && isNonNegativeInteger(value.totalTestCount) && value.passedTestCount > value.totalTestCount) {
        errors.push('Passed test count cannot exceed total test count.');
    }
    // Public test results validation
    if (!Array.isArray(value.publicTestResults) || value.publicTestResults.length === 0) {
        errors.push('Public test results must be a non-empty array.');
    }
    else {
        for (const result of value.publicTestResults) {
            const resultValidation = validatePublicTestResult(result);
            if (!resultValidation.valid) {
                errors.push(...resultValidation.errors);
            }
        }
    }
    // Optional fields
    if (value.executionTimeMs !== undefined && !isNonNegativeInteger(value.executionTimeMs)) {
        errors.push('Execution time must be a non-negative integer if provided.');
    }
    if (value.memoryUsedKb !== undefined && !isNonNegativeInteger(value.memoryUsedKb)) {
        errors.push('Memory used must be a non-negative integer if provided.');
    }
    if (value.feedback_en !== undefined) {
        if (typeof value.feedback_en !== 'string') {
            errors.push('Feedback (EN) must be a string if provided.');
        }
        else if (value.feedback_en.length > MAX_FEEDBACK_LENGTH) {
            errors.push('Feedback (EN) exceeds maximum length.');
        }
    }
    if (value.feedback_ar !== undefined) {
        if (typeof value.feedback_ar !== 'string') {
            errors.push('Feedback (AR) must be a string if provided.');
        }
        else if (value.feedback_ar.length > MAX_FEEDBACK_LENGTH) {
            errors.push('Feedback (AR) exceeds maximum length.');
        }
    }
    if (!isNonEmptyString(value.evaluatedAt)) {
        errors.push('Evaluated timestamp is required.');
    }
    if (!isNonEmptyString(value.evaluatorVersion)) {
        errors.push('Evaluator version is required.');
    }
    return errors.length === 0 ? valid() : invalid(...errors);
}
// ============================================================================
// PROGRESS VALIDATION
// ============================================================================
export function validateCodingActivityProgress(value) {
    if (!isRecord(value)) {
        return invalid('Coding activity progress must be an object.');
    }
    const errors = [];
    // Required fields
    if (!isNonEmptyString(value.studentId)) {
        errors.push('Student ID is required.');
    }
    if (!isNonEmptyString(value.lessonId)) {
        errors.push('Lesson ID is required.');
    }
    if (!isNonEmptyString(value.activityId)) {
        errors.push('Activity ID is required.');
    }
    if (!isPositiveInteger(value.challengeVersion)) {
        errors.push('Challenge version must be a positive integer.');
    }
    if (!isProgressStatus(value.status)) {
        errors.push('Status must be a valid progress status.');
    }
    // Score validation
    if (typeof value.bestScorePercent !== 'number' || value.bestScorePercent < 0 || value.bestScorePercent > 100) {
        errors.push('Best score percent must be between 0 and 100.');
    }
    // Attempts validation
    if (!isNonNegativeInteger(value.attempts)) {
        errors.push('Attempts must be a non-negative integer.');
    }
    // Passed validation
    if (typeof value.passed !== 'boolean') {
        errors.push('Passed flag must be a boolean.');
    }
    // PASSED state consistency
    if (value.status === 'PASSED' && value.passed !== true) {
        errors.push('PASSED status requires passed flag to be true.');
    }
    if (value.passed === true && value.status !== 'PASSED') {
        errors.push('Passed flag true requires PASSED status.');
    }
    // Optional lastSubmissionId
    if (value.lastSubmissionId !== undefined && !isNonEmptyString(value.lastSubmissionId)) {
        errors.push('Last submission ID must be a non-empty string if provided.');
    }
    if (!isNonEmptyString(value.updatedAt)) {
        errors.push('Updated timestamp is required.');
    }
    return errors.length === 0 ? valid() : invalid(...errors);
}
//# sourceMappingURL=submission.js.map