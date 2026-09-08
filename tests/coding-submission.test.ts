import { describe, it, expect } from 'vitest';
import {
  CodingSubmission,
  CodingEvaluation,
  CodingActivityProgress,
  PublicTestResult,
  AttemptPolicy,
  SubmissionStatus,
  EvaluationVerdict,
  ProgressStatus,
  validateCodingSubmission,
  validateCodingEvaluation,
  validateCodingActivityProgress,
  validateAttemptPolicy,
  validatePublicTestResult,
  canSubmitAnotherAttempt,
  isSubmissionStatus,
  isEvaluationVerdict,
  isProgressStatus,
  isAttemptPolicyMode,
} from '@/lib/coding/submission';
import { PROGRAMMING_LANGUAGES } from '@/lib/coding/languages';

describe('Coding Submission Domain Contracts', () => {
  describe('Submission Status', () => {
    it('accepts all valid submission statuses', () => {
      const statuses: SubmissionStatus[] = ['queued', 'running', 'completed', 'failed'];
      statuses.forEach((status) => {
        expect(isSubmissionStatus(status)).toBe(true);
      });
    });

    it('rejects invalid submission statuses', () => {
      expect(isSubmissionStatus('pending')).toBe(false);
      expect(isSubmissionStatus('success')).toBe(false);
      expect(isSubmissionStatus('')).toBe(false);
      expect(isSubmissionStatus(null)).toBe(false);
      expect(isSubmissionStatus(undefined)).toBe(false);
    });
  });

  describe('Evaluation Verdict', () => {
    it('accepts all valid evaluation verdicts', () => {
      const verdicts: EvaluationVerdict[] = ['AC', 'WA', 'CE', 'RE', 'TLE', 'MLE', 'SYSTEM_ERROR'];
      verdicts.forEach((verdict) => {
        expect(isEvaluationVerdict(verdict)).toBe(true);
      });
    });

    it('rejects invalid evaluation verdicts', () => {
      expect(isEvaluationVerdict('OK')).toBe(false);
      expect(isEvaluationVerdict('FAIL')).toBe(false);
      expect(isEvaluationVerdict('')).toBe(false);
      expect(isEvaluationVerdict(null)).toBe(false);
      expect(isEvaluationVerdict(undefined)).toBe(false);
    });
  });

  describe('Progress Status', () => {
    it('accepts all valid progress statuses', () => {
      const statuses: ProgressStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'PASSED'];
      statuses.forEach((status) => {
        expect(isProgressStatus(status)).toBe(true);
      });
    });

    it('rejects invalid progress statuses', () => {
      expect(isProgressStatus('COMPLETED')).toBe(false);
      expect(isProgressStatus('DONE')).toBe(false);
      expect(isProgressStatus('')).toBe(false);
      expect(isProgressStatus(null)).toBe(false);
      expect(isProgressStatus(undefined)).toBe(false);
    });
  });

  describe('Attempt Policy', () => {
    it('accepts unlimited policy', () => {
      const policy: AttemptPolicy = { mode: 'unlimited' };
      expect(validateAttemptPolicy(policy).valid).toBe(true);
    });

    it('accepts limited policy with maxAttempts', () => {
      const policy: AttemptPolicy = { mode: 'limited', maxAttempts: 3 };
      expect(validateAttemptPolicy(policy).valid).toBe(true);
    });

    it('rejects invalid maxAttempts in limited mode', () => {
      expect(validateAttemptPolicy({ mode: 'limited', maxAttempts: 0 }).valid).toBe(false);
      expect(validateAttemptPolicy({ mode: 'limited', maxAttempts: -1 }).valid).toBe(false);
      expect(validateAttemptPolicy({ mode: 'limited', maxAttempts: 1.5 }).valid).toBe(false);
    });

    it('rejects maxAttempts in unlimited mode', () => {
      expect(validateAttemptPolicy({ mode: 'unlimited', maxAttempts: 5 }).valid).toBe(false);
    });

    it('rejects invalid mode', () => {
      expect(validateAttemptPolicy({ mode: 'practice' }).valid).toBe(false);
    });

    it('allows submission when under limit', () => {
      const policy: AttemptPolicy = { mode: 'limited', maxAttempts: 3 };
      expect(canSubmitAnotherAttempt(2, policy)).toBe(true);
    });

    it('blocks submission when at limit', () => {
      const policy: AttemptPolicy = { mode: 'limited', maxAttempts: 3 };
      expect(canSubmitAnotherAttempt(3, policy)).toBe(false);
    });

    it('allows unlimited submissions in unlimited mode', () => {
      const policy: AttemptPolicy = { mode: 'unlimited' };
      expect(canSubmitAnotherAttempt(1000, policy)).toBe(true);
    });
  });

  describe('Public Test Result', () => {
    it('accepts valid public test result', () => {
      const result: PublicTestResult = {
        testId: 'test-1',
        passed: true,
        actualOutput: '42',
        expectedOutput: '42',
        executionTimeMs: 100,
      };
      expect(validatePublicTestResult(result).valid).toBe(true);
    });

    it('accepts minimal valid public test result', () => {
      const result: PublicTestResult = {
        testId: 'test-1',
        passed: false,
      };
      expect(validatePublicTestResult(result).valid).toBe(true);
    });

    it('rejects missing testId', () => {
      expect(validatePublicTestResult({ passed: true }).valid).toBe(false);
    });

    it('rejects invalid passed flag', () => {
      expect(validatePublicTestResult({ testId: 'test-1', passed: 'true' }).valid).toBe(false);
    });

    it('rejects invalid execution time', () => {
      expect(validatePublicTestResult({ testId: 'test-1', passed: true, executionTimeMs: -1 }).valid).toBe(false);
    });
  });

  describe('Coding Submission Validation', () => {
    const createValidSubmission = (): CodingSubmission => ({
      id: 'sub-1',
      studentId: 'student-1',
      lessonId: 'lesson-1',
      activityId: 'activity-1',
      challengeVersion: 1,
      language: 'cpp17',
      sourceCode: '#include <iostream>\nint main() { return 0; }',
      status: 'queued',
      submittedAt: new Date().toISOString(),
    });

    it('accepts valid submission', () => {
      const submission = createValidSubmission();
      expect(validateCodingSubmission(submission).valid).toBe(true);
    });

    it('rejects empty studentId', () => {
      const submission = createValidSubmission();
      (submission as any).studentId = '';
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects empty lessonId', () => {
      const submission = createValidSubmission();
      (submission as any).lessonId = '';
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects empty activityId', () => {
      const submission = createValidSubmission();
      (submission as any).activityId = '';
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects invalid challengeVersion', () => {
      const submission = createValidSubmission();
      (submission as any).challengeVersion = 0;
      expect(validateCodingSubmission(submission).valid).toBe(false);
      (submission as any).challengeVersion = -1;
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects unsupported language', () => {
      const submission = createValidSubmission();
      (submission as any).language = 'ruby';
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects empty sourceCode', () => {
      const submission = createValidSubmission();
      (submission as any).sourceCode = '';
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects oversized sourceCode', () => {
      const submission = createValidSubmission();
      (submission as any).sourceCode = 'x'.repeat(100_001);
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects invalid idempotency key', () => {
      const submission = createValidSubmission();
      (submission as any).idempotencyKey = '';
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects oversized idempotency key', () => {
      const submission = createValidSubmission();
      (submission as any).idempotencyKey = 'x'.repeat(257);
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('accepts valid idempotency key', () => {
      const submission = createValidSubmission();
      (submission as any).idempotencyKey = 'key-123';
      expect(validateCodingSubmission(submission).valid).toBe(true);
    });

    it('rejects submission with evaluation fields', () => {
      const submission = createValidSubmission();
      (submission as any).verdict = 'AC';
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects submission with scorePercent', () => {
      const submission = createValidSubmission();
      (submission as any).scorePercent = 100;
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects submission with passed flag', () => {
      const submission = createValidSubmission();
      (submission as any).passed = true;
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects submission with mastery field', () => {
      const submission = createValidSubmission();
      (submission as any).mastery = 'expert';
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });

    it('rejects submission with evaluator metadata', () => {
      const submission = createValidSubmission();
      (submission as any).evaluatorVersion = '1.0.0';
      expect(validateCodingSubmission(submission).valid).toBe(false);
      (submission as any).evaluatorVersion = undefined;
      delete (submission as any).evaluatorVersion;
      (submission as any).evaluatedAt = '2026-08-27T00:00:00.000Z';
      expect(validateCodingSubmission(submission).valid).toBe(false);
    });
  });

  describe('Coding Evaluation Validation', () => {
    const createValidEvaluation = (): CodingEvaluation => ({
      submissionId: 'sub-1',
      studentId: 'student-1',
      lessonId: 'lesson-1',
      activityId: 'activity-1',
      verdict: 'AC',
      scorePercent: 100,
      passedTestCount: 5,
      totalTestCount: 5,
      publicTestResults: [
        { testId: 'test-1', passed: true },
      ],
      evaluatedAt: new Date().toISOString(),
      evaluatorVersion: '1.0.0',
    });

    it('accepts valid AC evaluation', () => {
      const evaluation = createValidEvaluation();
      expect(validateCodingEvaluation(evaluation).valid).toBe(true);
    });

    it('accepts valid WA evaluation', () => {
      const evaluation = createValidEvaluation();
      evaluation.verdict = 'WA';
      evaluation.scorePercent = 80;
      evaluation.passedTestCount = 4;
      expect(validateCodingEvaluation(evaluation).valid).toBe(true);
    });

    it('rejects invalid verdict', () => {
      const evaluation = createValidEvaluation();
      (evaluation as any).verdict = 'OK';
      expect(validateCodingEvaluation(evaluation).valid).toBe(false);
    });

    it('rejects score below 0', () => {
      const evaluation = createValidEvaluation();
      (evaluation as any).scorePercent = -1;
      expect(validateCodingEvaluation(evaluation).valid).toBe(false);
    });

    it('rejects score above 100', () => {
      const evaluation = createValidEvaluation();
      (evaluation as any).scorePercent = 101;
      expect(validateCodingEvaluation(evaluation).valid).toBe(false);
    });

    it('rejects passed tests > total tests', () => {
      const evaluation = createValidEvaluation();
      (evaluation as any).passedTestCount = 6;
      (evaluation as any).totalTestCount = 5;
      expect(validateCodingEvaluation(evaluation).valid).toBe(false);
    });

    it('rejects invalid public test result', () => {
      const evaluation = createValidEvaluation();
      (evaluation as any).publicTestResults = [{ passed: true }];
      expect(validateCodingEvaluation(evaluation).valid).toBe(false);
    });

    it('rejects negative execution time', () => {
      const evaluation = createValidEvaluation();
      (evaluation as any).executionTimeMs = -1;
      expect(validateCodingEvaluation(evaluation).valid).toBe(false);
    });

    it('rejects negative memory usage', () => {
      const evaluation = createValidEvaluation();
      (evaluation as any).memoryUsedKb = -1;
      expect(validateCodingEvaluation(evaluation).valid).toBe(false);
    });

    it('accepts evaluation with optional fields', () => {
      const evaluation = createValidEvaluation();
      evaluation.executionTimeMs = 100;
      evaluation.memoryUsedKb = 512;
      evaluation.feedback_en = 'Good job!';
      evaluation.feedback_ar = 'عمل جيد!';
      expect(validateCodingEvaluation(evaluation).valid).toBe(true);
    });

    it('rejects oversized feedback', () => {
      const evaluation = createValidEvaluation();
      (evaluation as any).feedback_en = 'x'.repeat(10_001);
      expect(validateCodingEvaluation(evaluation).valid).toBe(false);
    });
  });

  describe('Coding Activity Progress Validation', () => {
    const createValidProgress = (): CodingActivityProgress => ({
      studentId: 'student-1',
      lessonId: 'lesson-1',
      activityId: 'activity-1',
      challengeVersion: 1,
      status: 'IN_PROGRESS',
      bestScorePercent: 0,
      attempts: 1,
      passed: false,
      updatedAt: new Date().toISOString(),
    });

    it('accepts valid progress', () => {
      const progress = createValidProgress();
      expect(validateCodingActivityProgress(progress).valid).toBe(true);
    });

    it('accepts valid PASSED progress', () => {
      const progress = createValidProgress();
      progress.status = 'PASSED';
      progress.bestScorePercent = 100;
      progress.passed = true;
      expect(validateCodingActivityProgress(progress).valid).toBe(true);
    });

    it('rejects negative attempts', () => {
      const progress = createValidProgress();
      (progress as any).attempts = -1;
      expect(validateCodingActivityProgress(progress).valid).toBe(false);
    });

    it('rejects invalid score', () => {
      const progress = createValidProgress();
      (progress as any).bestScorePercent = -1;
      expect(validateCodingActivityProgress(progress).valid).toBe(false);
      (progress as any).bestScorePercent = 101;
      expect(validateCodingActivityProgress(progress).valid).toBe(false);
    });

    it('rejects PASSED status without passed flag', () => {
      const progress = createValidProgress();
      progress.status = 'PASSED';
      progress.passed = false;
      expect(validateCodingActivityProgress(progress).valid).toBe(false);
    });

    it('rejects passed flag true without PASSED status', () => {
      const progress = createValidProgress();
      progress.passed = true;
      progress.status = 'IN_PROGRESS';
      expect(validateCodingActivityProgress(progress).valid).toBe(false);
    });

    it('rejects invalid lastSubmissionId', () => {
      const progress = createValidProgress();
      (progress as any).lastSubmissionId = '';
      expect(validateCodingActivityProgress(progress).valid).toBe(false);
    });

    it('accepts valid lastSubmissionId', () => {
      const progress = createValidProgress();
      progress.lastSubmissionId = 'sub-1';
      expect(validateCodingActivityProgress(progress).valid).toBe(true);
    });

    it('rejects invalid challengeVersion', () => {
      const progress = createValidProgress();
      (progress as any).challengeVersion = 0;
      expect(validateCodingActivityProgress(progress).valid).toBe(false);
    });
  });

  describe('Domain Contract Invariants', () => {
    it('submission does not contain authoritative evaluation fields', () => {
      const submission: CodingSubmission = {
        id: 'sub-1',
        studentId: 'student-1',
        lessonId: 'lesson-1',
        activityId: 'activity-1',
        challengeVersion: 1,
        language: 'cpp17',
        sourceCode: 'int main() {}',
        status: 'queued',
        submittedAt: new Date().toISOString(),
      };

      // Ensure these fields are NOT in the submission type
      expect('verdict' in submission).toBe(false);
      expect('scorePercent' in submission).toBe(false);
      expect('passedTestCount' in submission).toBe(false);
      expect('totalTestCount' in submission).toBe(false);
      expect('passed' in submission).toBe(false);
      expect('mastery' in submission).toBe(false);
    });

    it('evaluation contains authoritative results', () => {
      const evaluation: CodingEvaluation = {
        submissionId: 'sub-1',
        studentId: 'student-1',
        lessonId: 'lesson-1',
        activityId: 'activity-1',
        verdict: 'AC',
        scorePercent: 100,
        passedTestCount: 5,
        totalTestCount: 5,
        publicTestResults: [{ testId: 'test-1', passed: true }],
        evaluatedAt: new Date().toISOString(),
        evaluatorVersion: '1.0.0',
      };

      expect(evaluation.verdict).toBeDefined();
      expect(evaluation.scorePercent).toBeDefined();
      expect(evaluation.passedTestCount).toBeDefined();
      expect(evaluation.totalTestCount).toBeDefined();
    });

    it('progress tracks completion but not authoritative evaluation', () => {
      const progress: CodingActivityProgress = {
        studentId: 'student-1',
        lessonId: 'lesson-1',
        activityId: 'activity-1',
        challengeVersion: 1,
        status: 'PASSED',
        bestScorePercent: 100,
        attempts: 3,
        passed: true,
        updatedAt: new Date().toISOString(),
      };

      expect(progress.status).toBe('PASSED');
      expect(progress.passed).toBe(true);
      expect(progress.bestScorePercent).toBe(100);
      // Progress does NOT contain verdict or detailed test results
      expect('verdict' in progress).toBe(false);
      expect('publicTestResults' in progress).toBe(false);
    });
  });
});
