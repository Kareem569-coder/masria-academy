import { isProgrammingLanguageId } from '@/lib/coding/languages';
import { validateCodingEvaluation, } from '@/lib/coding/submission';
export function normalizeOutputForComparison(value, policy = 'trim-trailing-whitespace') {
    const text = (value ?? '').replace(/\r\n/g, '\n');
    switch (policy) {
        case 'exact':
            return value ?? '';
        case 'trim-trailing-whitespace':
            return text.replace(/[\t ]+$/gm, '').replace(/\n+$/, '');
        case 'whitespace-normalized': {
            return text
                .replace(/[\t ]+$/gm, '')
                .replace(/\n+$/, '')
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0 || text.includes('\n'))
                .join('\n');
        }
        default:
            return text;
    }
}
export function compareOutputs(actual, expected, policy = 'trim-trailing-whitespace') {
    const normalizedActual = normalizeOutputForComparison(actual ?? '', policy);
    const normalizedExpected = normalizeOutputForComparison(expected ?? '', policy);
    return normalizedActual === normalizedExpected;
}
export function determineVerdictFromExecution(execution) {
    if (execution.status === 'FAILED') {
        switch (execution.failureReason) {
            case 'COMPILE_ERROR':
                return 'CE';
            case 'RUNTIME_ERROR':
                return 'RE';
            case 'TIME_LIMIT':
                return 'TLE';
            case 'MEMORY_LIMIT':
                return 'MLE';
            case 'OUTPUT_LIMIT':
                return 'WA';
            case 'SYSTEM_ERROR':
            case 'NOT_IMPLEMENTED':
                return 'SYSTEM_ERROR';
            default:
                return 'SYSTEM_ERROR';
        }
    }
    return 'WA';
}
function toPublicTestResult(testCase, actualOutput, policy, executionTimeMs) {
    return {
        testId: testCase.id,
        passed: compareOutputs(actualOutput, testCase.expectedOutput, policy),
        actualOutput,
        expectedOutput: testCase.expectedOutput,
        executionTimeMs,
    };
}
export function evaluateCodingChallengeAttempt(input) {
    const policy = input.comparisonPolicy ?? 'trim-trailing-whitespace';
    const execution = input.executionResult;
    if (!isProgrammingLanguageId(input.language)) {
        throw new Error('Unsupported language for evaluator.');
    }
    const invalidExecutionStatus = execution.status === 'FAILED' && execution.failureReason === undefined;
    if (invalidExecutionStatus) {
        throw new Error('Execution result reports a failed status without a failure reason.');
    }
    // Evaluate public test results (always returned to student)
    const publicResults = input.publicTestCases.map((testCase) => {
        const actualOutput = execution.stdout ?? '';
        return toPublicTestResult(testCase, actualOutput, policy, execution.executionTimeMs);
    });
    // Evaluate private test results (never returned to student, but affect verdict/score)
    const privateResults = (input.privateTestCases ?? []).map((testCase) => {
        const actualOutput = execution.stdout ?? '';
        return {
            testId: testCase.id,
            passed: compareOutputs(actualOutput, testCase.expectedOutput, policy),
        };
    });
    // Calculate totals from ALL tests (public + private)
    const passedPublicCount = publicResults.filter((result) => result.passed).length;
    const passedPrivateCount = privateResults.filter((result) => result.passed).length;
    const totalPublicCount = publicResults.length;
    const totalPrivateCount = privateResults.length;
    const passedTestCount = passedPublicCount + passedPrivateCount;
    const totalTestCount = totalPublicCount + totalPrivateCount;
    // Calculate score based on all tests
    const scorePercent = totalTestCount === 0 ? 0 : Math.round((passedTestCount / totalTestCount) * 100);
    // Determine verdict based on execution status and test results
    let verdict;
    if (execution.status === 'FAILED') {
        verdict = determineVerdictFromExecution(execution);
    }
    else if (totalTestCount === 0) {
        verdict = 'WA';
    }
    else if (passedTestCount === totalTestCount) {
        verdict = 'AC';
    }
    else {
        verdict = 'WA';
    }
    const evaluation = {
        submissionId: input.submissionId,
        studentId: input.studentId,
        lessonId: input.lessonId,
        activityId: input.activityId,
        verdict,
        scorePercent,
        passedTestCount,
        totalTestCount,
        publicTestResults: publicResults,
        executionTimeMs: execution.executionTimeMs,
        memoryUsedKb: execution.memoryUsedKb,
        evaluatedAt: input.evaluatedAt,
        evaluatorVersion: input.evaluatorVersion,
    };
    const validation = validateCodingEvaluation(evaluation);
    if (!validation.valid) {
        throw new Error(`Invalid evaluation: ${validation.errors.join(', ')}`);
    }
    return evaluation;
}
//# sourceMappingURL=evaluator.js.map