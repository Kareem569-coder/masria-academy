import { canSubmitAnotherAttempt, } from '@/lib/coding/submission';
import { mapQueuedSubmissionToExecutionRequest, } from '@/lib/coding/execution';
import { evaluateCodingChallengeAttempt, } from '@/lib/coding/evaluator';
const valid = () => ({ valid: true, errors: [] });
const invalid = (...errors) => ({ valid: false, errors });
/**
 * Validates that the challenge activity is executable and matches the submission.
 */
export function validateChallengeCompatibility(challenge, submission) {
    if (typeof challenge !== 'object' || challenge === null) {
        return invalid('Challenge must be an object.');
    }
    const c = challenge;
    // Must be a CODING_CHALLENGE
    if (c.type !== 'CODING_CHALLENGE') {
        return invalid('Activity must be a coding challenge.');
    }
    // Challenge version must match submission
    if (c.challengeVersion !== submission.challengeVersion) {
        return invalid(`Challenge version mismatch: expected ${submission.challengeVersion}, got ${c.challengeVersion}.`);
    }
    // Language must be allowed
    if (!Array.isArray(c.allowedLanguages) || !c.allowedLanguages.includes(submission.language)) {
        return invalid(`Language ${submission.language} is not allowed by this challenge.`);
    }
    // Must have at least one public test case
    if (!Array.isArray(c.publicTestCases) || c.publicTestCases.length === 0) {
        return invalid('Challenge must have at least one public test case.');
    }
    return valid();
}
/**
 * Validates the private challenge configuration for compatibility.
 */
export function validatePrivateConfigCompatibility(config, submission) {
    if (config.challengeVersion !== submission.challengeVersion) {
        return invalid(`Private config version mismatch: expected ${submission.challengeVersion}, got ${config.challengeVersion}.`);
    }
    if (!Array.isArray(config.privateTestCases) || config.privateTestCases.length === 0) {
        return invalid('Private configuration must include at least one private test case.');
    }
    return valid();
}
/**
 * Derives trusted execution limits from the challenge activity.
 */
export function deriveTrustedExecutionLimits(challenge) {
    return {
        timeLimitMs: challenge.timeLimitMs ?? 5000,
        memoryLimitMb: challenge.memoryLimitMb ?? 64,
    };
}
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
export async function evaluateCodingSubmissionPipeline(submission, challenge, privateConfig, executionService, config = {}) {
    // Validate submission structure
    if (!submission || typeof submission !== 'object') {
        throw new Error('Submission must be an object.');
    }
    const typedSubmission = submission;
    // Validate challenge compatibility
    const challengeCompat = validateChallengeCompatibility(challenge, typedSubmission);
    if (!challengeCompat.valid) {
        throw new Error(`Challenge incompatible with submission: ${challengeCompat.errors.join('; ')}`);
    }
    // Validate private config compatibility
    const privateCompat = validatePrivateConfigCompatibility(privateConfig, typedSubmission);
    if (!privateCompat.valid) {
        throw new Error(`Private configuration incompatible: ${privateCompat.errors.join('; ')}`);
    }
    const typedChallenge = challenge;
    // Validate attempt limit if policy is provided
    if (config.attemptPolicy !== undefined && config.currentAttemptCount !== undefined) {
        const canSubmit = canSubmitAnotherAttempt(config.currentAttemptCount, config.attemptPolicy);
        if (!canSubmit) {
            throw new Error('Attempt limit exceeded.');
        }
    }
    // Map submission to execution request using D3A mapper
    const requestMapping = mapQueuedSubmissionToExecutionRequest(typedSubmission, {
        requestedAt: new Date().toISOString(),
        trustedLimits: config.trustedExecutionLimits ?? deriveTrustedExecutionLimits(typedChallenge),
    });
    if (!requestMapping.valid) {
        throw new Error(`Failed to map submission to execution request: ${requestMapping.errors.join('; ')}`);
    }
    const executionRequest = requestMapping.request;
    // Execute through D3B service
    const executionResult = await executionService.execute(executionRequest);
    // Evaluate using D3C evaluator with public + private tests
    const allTestCases = [
        ...typedChallenge.publicTestCases,
        ...privateConfig.privateTestCases,
    ];
    const evaluatedAt = new Date().toISOString();
    const evaluatorVersion = 'masria-d3c-v1';
    const evaluation = evaluateCodingChallengeAttempt({
        submissionId: typedSubmission.id,
        studentId: typedSubmission.studentId,
        lessonId: typedSubmission.lessonId,
        activityId: typedSubmission.activityId,
        challengeVersion: typedSubmission.challengeVersion,
        language: typedSubmission.language,
        sourceCode: typedSubmission.sourceCode,
        publicTestCases: typedChallenge.publicTestCases,
        executionResult,
        privateTestCases: privateConfig.privateTestCases,
        comparisonPolicy: config.outputComparisonPolicy ?? 'trim-trailing-whitespace',
        evaluatorVersion,
        evaluatedAt,
    });
    // Generate progress
    const currentProgress = config.currentProgress ?? {
        studentId: typedSubmission.studentId,
        lessonId: typedSubmission.lessonId,
        activityId: typedSubmission.activityId,
        challengeVersion: typedSubmission.challengeVersion,
        status: 'NOT_STARTED',
        bestScorePercent: 0,
        attempts: 0,
        passed: false,
        updatedAt: new Date().toISOString(),
    };
    // Increment attempts exactly once
    const nextAttemptCount = currentProgress.attempts + 1;
    // Track best score
    const nextBestScorePercent = Math.max(currentProgress.bestScorePercent, evaluation.scorePercent);
    // Determine next status
    let nextStatus = currentProgress.status;
    let nextPassed = currentProgress.passed;
    if (evaluation.verdict === 'AC') {
        nextStatus = 'PASSED';
        nextPassed = true;
    }
    else if (nextStatus === 'NOT_STARTED') {
        nextStatus = 'IN_PROGRESS';
    }
    const progress = {
        studentId: typedSubmission.studentId,
        lessonId: typedSubmission.lessonId,
        activityId: typedSubmission.activityId,
        challengeVersion: typedSubmission.challengeVersion,
        status: nextStatus,
        bestScorePercent: nextBestScorePercent,
        attempts: nextAttemptCount,
        passed: nextPassed,
        lastSubmissionId: typedSubmission.id,
        updatedAt: evaluatedAt,
    };
    return {
        evaluation,
        progress,
        executionResult,
    };
}
//# sourceMappingURL=pipeline.js.map