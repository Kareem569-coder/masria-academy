import { describe, expect, it } from 'vitest';
import {
  compareOutputs,
  determineVerdictFromExecution,
  evaluateCodingChallengeAttempt,
  normalizeOutputForComparison,
  type OutputComparisonPolicy,
} from '@/lib/coding/evaluator';
import { validateCodingEvaluation } from '@/lib/coding/submission';

describe('Coding evaluator', () => {
  it('normalizes outputs according to the configured comparison policy', () => {
    const actual = '42\r\n\n';
    const expected = '42\n';

    expect(normalizeOutputForComparison(actual, 'exact')).toBe('42\r\n\n');
    expect(normalizeOutputForComparison(actual, 'trim-trailing-whitespace')).toBe('42');
    expect(normalizeOutputForComparison(actual, 'whitespace-normalized')).toBe('42');
    expect(compareOutputs(actual, expected, 'exact')).toBe(false);
    expect(compareOutputs(actual, expected, 'trim-trailing-whitespace')).toBe(true);
    expect(compareOutputs(actual, expected, 'whitespace-normalized')).toBe(true);
  });

  it('maps execution failures to the correct verdicts', () => {
    expect(determineVerdictFromExecution({ status: 'FAILED', failureReason: 'COMPILE_ERROR' })).toBe('CE');
    expect(determineVerdictFromExecution({ status: 'FAILED', failureReason: 'RUNTIME_ERROR' })).toBe('RE');
    expect(determineVerdictFromExecution({ status: 'FAILED', failureReason: 'TIME_LIMIT' })).toBe('TLE');
    expect(determineVerdictFromExecution({ status: 'FAILED', failureReason: 'MEMORY_LIMIT' })).toBe('MLE');
    expect(determineVerdictFromExecution({ status: 'FAILED', failureReason: 'SYSTEM_ERROR' })).toBe('SYSTEM_ERROR');
    expect(determineVerdictFromExecution({ status: 'COMPLETED' })).toBe('WA');
  });

  it('evaluates public test cases without leaking private tests', () => {
    const evaluation = evaluateCodingChallengeAttempt({
      submissionId: 'sub-1',
      studentId: 'student-1',
      lessonId: 'lesson-1',
      activityId: 'activity-1',
      challengeVersion: 3,
      language: 'cpp17',
      sourceCode: 'int main() { return 0; }',
      publicTestCases: [
        { id: 'public-1', input: '', expectedOutput: '5\n' },
        { id: 'public-2', input: '', expectedOutput: '5\n' },
      ],
      executionResult: {
        requestId: 'exec:masria-exec-1:sub-1',
        submissionId: 'sub-1',
        status: 'COMPLETED',
        language: 'cpp17',
        stdout: '5\n',
        stderr: '',
        exitCode: 0,
        executionTimeMs: 15,
        memoryUsedKb: 1024,
        runnerVersion: 'runner-test',
        completedAt: '2026-01-01T00:00:01.000Z',
      },
      privateTestCases: [
        { id: 'private-1', input: '', expectedOutput: '5\n' },
      ],
      comparisonPolicy: 'trim-trailing-whitespace',
      evaluatorVersion: 'masria-d3c-v1',
      evaluatedAt: '2026-01-01T00:00:02.000Z',
    });

    expect(validationResultValid(evaluation)).toBe(true);
    expect(evaluation.verdict).toBe('AC');
    expect(evaluation.scorePercent).toBe(100);
    expect(evaluation.passedTestCount).toBe(3); // 2 public + 1 private
    expect(evaluation.totalTestCount).toBe(3);
    expect(evaluation.publicTestResults).toHaveLength(2);
    expect(evaluation.publicTestResults.every((result) => result.testId.startsWith('public-'))).toBe(true);
  });

  it('marks wrong answers on mismatched public outputs', () => {
    const evaluation = evaluateCodingChallengeAttempt({
      submissionId: 'sub-2',
      studentId: 'student-2',
      lessonId: 'lesson-2',
      activityId: 'activity-2',
      challengeVersion: 1,
      language: 'cpp17',
      sourceCode: 'int main() { return 0; }',
      publicTestCases: [{ id: 'public-1', input: '', expectedOutput: '42\n' }],
      executionResult: {
        requestId: 'exec:masria-exec-1:sub-2',
        submissionId: 'sub-2',
        status: 'COMPLETED',
        language: 'cpp17',
        stdout: '99\n',
        stderr: '',
        exitCode: 0,
        executionTimeMs: 11,
        memoryUsedKb: 1024,
        runnerVersion: 'runner-test',
        completedAt: '2026-01-01T00:00:03.000Z',
      },
      comparisonPolicy: 'exact',
      evaluatorVersion: 'masria-d3c-v1',
      evaluatedAt: '2026-01-01T00:00:04.000Z',
    });

    expect(evaluation.verdict).toBe('WA');
    expect(evaluation.scorePercent).toBe(0);
    expect(evaluation.passedTestCount).toBe(0);
    expect(evaluation.publicTestResults[0].passed).toBe(false);
  });
});

function validationResultValid(value: unknown): boolean {
  return validateCodingEvaluation(value).valid;
}

export type { OutputComparisonPolicy };
