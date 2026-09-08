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
import { isProgrammingLanguageId } from '@/lib/coding/languages';
import { MAX_SOURCE_CODE_LENGTH, validateCodingSubmission, validateIdempotencyKey, } from '@/lib/coding/submission';
export const EXECUTION_CONTRACT_VERSION = 'masria-exec-1';
export const MAX_EXECUTION_OUTPUT_LENGTH = 65_536;
export const MAX_EXECUTION_REQUEST_ID_LENGTH = 256;
export const EXECUTION_STATUSES = [
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
];
export const EXECUTION_FAILURE_REASONS = [
    'COMPILE_ERROR',
    'RUNTIME_ERROR',
    'TIME_LIMIT',
    'MEMORY_LIMIT',
    'OUTPUT_LIMIT',
    'SYSTEM_ERROR',
    'NOT_IMPLEMENTED',
];
const valid = () => ({ valid: true, errors: [] });
const invalid = (...errors) => ({ valid: false, errors });
const isRecord = (value) => (typeof value === 'object' && value !== null && !Array.isArray(value));
const isNonEmptyString = (value) => (typeof value === 'string' && value.trim().length > 0);
const isPositiveInteger = (value) => (Number.isInteger(value) && value > 0);
const isNonNegativeInteger = (value) => (Number.isInteger(value) && value >= 0);
const isInteger = (value) => Number.isInteger(value);
export function isExecutionStatus(value) {
    return typeof value === 'string' && EXECUTION_STATUSES.includes(value);
}
export function isExecutionFailureReason(value) {
    return typeof value === 'string'
        && EXECUTION_FAILURE_REASONS.includes(value);
}
export function validateExecutionRequestId(value) {
    if (!isNonEmptyString(value)) {
        return invalid('Request ID is required.');
    }
    if (value.length > MAX_EXECUTION_REQUEST_ID_LENGTH) {
        return invalid('Request ID exceeds maximum length.');
    }
    return valid();
}
const STUDENT_FORBIDDEN_EXECUTION_KEYS = [
    'verdict',
    'score',
    'scorePercent',
    'passed',
    'mastery',
    'passedTestCount',
    'totalTestCount',
    'publicTestResults',
    'evaluatorVersion',
    'evaluatedAt',
    'privateTestCases',
    'referenceSolutionsByLanguage',
    'referenceSolution',
    'env',
    'environment',
    'environmentVariables',
    'network',
    'networkAccess',
    'allowNetwork',
    'filesystem',
    'cwd',
    'workingDirectory',
    'filePath',
    'timeLimitMs',
    'memoryLimitMb',
    'timeout',
    'memoryLimit',
    'runnerVersion',
    'command',
    'argv',
    'docker',
];
function collectForbiddenKeyErrors(value, keys) {
    const errors = [];
    for (const key of keys) {
        if (key in value) {
            errors.push(`Trusted execution input must not contain ${key}.`);
        }
    }
    return errors;
}
export function validateExecutionRequest(value) {
    if (!isRecord(value)) {
        return invalid('Execution request must be an object.');
    }
    const errors = [];
    const requestId = validateExecutionRequestId(value.requestId);
    if (!requestId.valid)
        errors.push(...requestId.errors);
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
    if (!isNonEmptyString(value.requestedAt)) {
        errors.push('Requested timestamp is required.');
    }
    if (value.contractVersion !== EXECUTION_CONTRACT_VERSION) {
        errors.push('Contract version is invalid.');
    }
    if (!isExecutionStatus(value.status)) {
        errors.push('Status must be a valid execution status.');
    }
    if (value.idempotencyKey !== undefined) {
        const idempotency = validateIdempotencyKey(value.idempotencyKey);
        if (!idempotency.valid)
            errors.push(...idempotency.errors);
    }
    if (value.timeLimitMs !== undefined && !isPositiveInteger(value.timeLimitMs)) {
        errors.push('Trusted time limit must be a positive integer if provided.');
    }
    if (value.memoryLimitMb !== undefined && !isPositiveInteger(value.memoryLimitMb)) {
        errors.push('Trusted memory limit must be a positive integer if provided.');
    }
    if (value.deadlineAt !== undefined && !isNonEmptyString(value.deadlineAt)) {
        errors.push('Deadline must be a non-empty string if provided.');
    }
    errors.push(...collectForbiddenKeyErrors(value, [
        'verdict',
        'score',
        'scorePercent',
        'passed',
        'mastery',
        'passedTestCount',
        'totalTestCount',
        'publicTestResults',
        'evaluatorVersion',
        'evaluatedAt',
        'privateTestCases',
        'referenceSolutionsByLanguage',
        'referenceSolution',
        'env',
        'environment',
        'environmentVariables',
        'network',
        'networkAccess',
        'allowNetwork',
        'filesystem',
        'cwd',
        'workingDirectory',
        'filePath',
        'timeout',
        'memoryLimit',
        'runnerVersion',
        'command',
        'argv',
        'docker',
    ]));
    return errors.length === 0 ? valid() : invalid(...errors);
}
export function validateExecutionResult(value) {
    if (!isRecord(value)) {
        return invalid('Execution result must be an object.');
    }
    const errors = [];
    const requestId = validateExecutionRequestId(value.requestId);
    if (!requestId.valid)
        errors.push(...requestId.errors);
    if (!isNonEmptyString(value.submissionId)) {
        errors.push('Submission ID is required.');
    }
    if (!isExecutionStatus(value.status)) {
        errors.push('Status must be a valid execution status.');
    }
    if (!isProgrammingLanguageId(value.language)) {
        errors.push('Language must be a supported programming language.');
    }
    if (!isNonEmptyString(value.runnerVersion)) {
        errors.push('Runner version is required.');
    }
    if (!isNonEmptyString(value.completedAt)) {
        errors.push('Completed timestamp is required.');
    }
    if (value.stdout !== undefined) {
        if (typeof value.stdout !== 'string') {
            errors.push('stdout must be a string if provided.');
        }
        else if (value.stdout.length > MAX_EXECUTION_OUTPUT_LENGTH) {
            errors.push('stdout exceeds maximum length.');
        }
    }
    if (value.stderr !== undefined) {
        if (typeof value.stderr !== 'string') {
            errors.push('stderr must be a string if provided.');
        }
        else if (value.stderr.length > MAX_EXECUTION_OUTPUT_LENGTH) {
            errors.push('stderr exceeds maximum length.');
        }
    }
    if (value.exitCode !== undefined && !isInteger(value.exitCode)) {
        errors.push('Exit code must be an integer if provided.');
    }
    if (value.executionTimeMs !== undefined && !isNonNegativeInteger(value.executionTimeMs)) {
        errors.push('Execution time must be a non-negative integer if provided.');
    }
    if (value.memoryUsedKb !== undefined && !isNonNegativeInteger(value.memoryUsedKb)) {
        errors.push('Memory used must be a non-negative integer if provided.');
    }
    if (value.status === 'FAILED') {
        if (!isExecutionFailureReason(value.failureReason)) {
            errors.push('Failed execution requires a valid failure reason.');
        }
    }
    else if (value.failureReason !== undefined) {
        errors.push('failureReason is only allowed when status is FAILED.');
    }
    errors.push(...collectForbiddenKeyErrors(value, [
        'verdict',
        'score',
        'scorePercent',
        'passed',
        'mastery',
        'passedTestCount',
        'evaluatorVersion',
        'privateTestCases',
        'referenceSolutionsByLanguage',
    ]));
    return errors.length === 0 ? valid() : invalid(...errors);
}
export function deriveExecutionRequestId(submissionId, contractVersion = EXECUTION_CONTRACT_VERSION) {
    return `exec:${contractVersion}:${submissionId}`;
}
export function deriveExecutionIdempotencyKey(submission) {
    return submission.idempotencyKey ?? `submission:${submission.id}`;
}
export function validateTrustedExecutionLimits(value) {
    if (!isRecord(value)) {
        return invalid('Trusted execution limits must be an object.');
    }
    const errors = [];
    if (!isPositiveInteger(value.timeLimitMs)) {
        errors.push('Trusted time limit must be a positive integer.');
    }
    if (!isPositiveInteger(value.memoryLimitMb)) {
        errors.push('Trusted memory limit must be a positive integer.');
    }
    return errors.length === 0 ? valid() : invalid(...errors);
}
/**
 * Maps a queued CodingSubmission to an ExecutionRequest.
 * Student-supplied runner configuration is rejected, not copied.
 * Optional trustedLimits come from challenge configuration, never the client.
 */
export function mapQueuedSubmissionToExecutionRequest(submission, options) {
    if (!isRecord(submission)) {
        return { valid: false, errors: ['Coding submission must be an object.'] };
    }
    const submissionValidation = validateCodingSubmission(submission);
    const errors = [...submissionValidation.errors];
    if (submission.status !== 'queued') {
        errors.push('Only queued submissions can be mapped to execution requests.');
    }
    errors.push(...collectForbiddenKeyErrors(submission, STUDENT_FORBIDDEN_EXECUTION_KEYS));
    let trustedLimits;
    if (options?.trustedLimits !== undefined) {
        const limitsValidation = validateTrustedExecutionLimits(options.trustedLimits);
        if (!limitsValidation.valid) {
            errors.push(...limitsValidation.errors);
        }
        else {
            trustedLimits = options.trustedLimits;
        }
    }
    if (errors.length > 0) {
        return { valid: false, errors };
    }
    const queued = submission;
    const requestedAt = options?.requestedAt ?? new Date().toISOString();
    const requestId = deriveExecutionRequestId(queued.id);
    const request = {
        requestId,
        submissionId: queued.id,
        studentId: queued.studentId,
        lessonId: queued.lessonId,
        activityId: queued.activityId,
        challengeVersion: queued.challengeVersion,
        language: queued.language,
        sourceCode: queued.sourceCode,
        requestedAt,
        contractVersion: EXECUTION_CONTRACT_VERSION,
        status: 'QUEUED',
        idempotencyKey: deriveExecutionIdempotencyKey(queued),
        ...(trustedLimits
            ? {
                timeLimitMs: trustedLimits.timeLimitMs,
                memoryLimitMb: trustedLimits.memoryLimitMb,
                deadlineAt: new Date(Date.parse(requestedAt) + trustedLimits.timeLimitMs).toISOString(),
            }
            : {}),
    };
    const requestValidation = validateExecutionRequest(request);
    if (!requestValidation.valid) {
        return { valid: false, errors: requestValidation.errors };
    }
    return { valid: true, request };
}
const PLACEHOLDER_RUNNER_VERSION = 'masria-d3a-not-implemented';
/**
 * Placeholder only. Does not compile, interpret, or sandbox code.
 * The browser must not call this; D3B+ attaches a trusted backend implementation.
 */
export class NotImplementedExecutionService {
    async execute(request) {
        const requestValidation = validateExecutionRequest(request);
        if (!requestValidation.valid) {
            throw new Error(`Invalid execution request: ${requestValidation.errors.join(', ')}`);
        }
        const result = {
            requestId: request.requestId,
            submissionId: request.submissionId,
            status: 'FAILED',
            language: request.language,
            failureReason: 'NOT_IMPLEMENTED',
            runnerVersion: PLACEHOLDER_RUNNER_VERSION,
            completedAt: new Date().toISOString(),
        };
        const resultValidation = validateExecutionResult(result);
        if (!resultValidation.valid) {
            throw new Error(`Invalid execution result: ${resultValidation.errors.join(', ')}`);
        }
        return result;
    }
}
//# sourceMappingURL=execution.js.map