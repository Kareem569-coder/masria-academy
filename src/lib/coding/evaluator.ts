import { isProgrammingLanguageId, type ProgrammingLanguageId } from '@/lib/coding/languages';
import {
  type CodingEvaluation,
  type PublicTestResult,
  validateCodingEvaluation,
} from '@/lib/coding/submission';
import type { PublicTestCase } from '@/types/models';

export type OutputComparisonPolicy = 'exact' | 'trim-trailing-whitespace' | 'whitespace-normalized';

export type ExecutionFailureReason =
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT'
  | 'MEMORY_LIMIT'
  | 'OUTPUT_LIMIT'
  | 'SYSTEM_ERROR'
  | 'NOT_IMPLEMENTED';

export interface ExecutionLikeResult {
  requestId: string;
  submissionId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
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

export interface EvaluateCodingChallengeAttemptInput {
  submissionId: string;
  studentId: string;
  lessonId: string;
  activityId: string;
  challengeVersion: number;
  language: ProgrammingLanguageId;
  sourceCode: string;
  publicTestCases: PublicTestCase[];
  executionResult: ExecutionLikeResult;
  privateTestCases?: Array<{ id: string; input: string; expectedOutput: string; weight?: number }>;
  comparisonPolicy?: OutputComparisonPolicy;
  evaluatorVersion: string;
  evaluatedAt: string;
  expectedFeedback_en?: string;
  expectedFeedback_ar?: string;
}

export function normalizeOutputForComparison(
  value: string,
  policy: OutputComparisonPolicy = 'trim-trailing-whitespace'
): string {
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

export function compareOutputs(
  actual: string | undefined,
  expected: string | undefined,
  policy: OutputComparisonPolicy = 'trim-trailing-whitespace'
): boolean {
  const normalizedActual = normalizeOutputForComparison(actual ?? '', policy);
  const normalizedExpected = normalizeOutputForComparison(expected ?? '', policy);
  return normalizedActual === normalizedExpected;
}

export function determineVerdictFromExecution(
  execution: Pick<ExecutionLikeResult, 'status' | 'failureReason'>
): CodingEvaluation['verdict'] {
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

function toPublicTestResult(
  testCase: PublicTestCase,
  actualOutput: string,
  policy: OutputComparisonPolicy,
  executionTimeMs?: number
): PublicTestResult {
  return {
    testId: testCase.id,
    passed: compareOutputs(actualOutput, testCase.expectedOutput, policy),
    actualOutput,
    expectedOutput: testCase.expectedOutput,
    executionTimeMs,
  };
}

export function evaluateCodingChallengeAttempt(
  input: EvaluateCodingChallengeAttemptInput
): CodingEvaluation {
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
  const publicResults: PublicTestResult[] = input.publicTestCases.map((testCase) => {
    const actualOutput = execution.stdout ?? '';
    return toPublicTestResult(testCase, actualOutput, policy, execution.executionTimeMs);
  });

  // Evaluate private test results (never returned to student, but affect verdict/score)
  const privateResults: Array<{ testId: string; passed: boolean }> = (input.privateTestCases ?? []).map(
    (testCase) => {
      const actualOutput = execution.stdout ?? '';
      return {
        testId: testCase.id,
        passed: compareOutputs(actualOutput, testCase.expectedOutput, policy),
      };
    }
  );

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
  let verdict: CodingEvaluation['verdict'];
  if (execution.status === 'FAILED') {
    verdict = determineVerdictFromExecution(execution);
  } else if (totalTestCount === 0) {
    verdict = 'WA';
  } else if (passedTestCount === totalTestCount) {
    verdict = 'AC';
  } else {
    verdict = 'WA';
  }

  const evaluation: CodingEvaluation = {
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
