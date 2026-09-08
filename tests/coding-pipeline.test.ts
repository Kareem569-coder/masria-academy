import { describe, expect, it, beforeEach } from 'vitest';
import {
  evaluateCodingSubmissionPipeline,
  validateChallengeCompatibility,
  validatePrivateConfigCompatibility,
  deriveTrustedExecutionLimits,
} from '@/lib/coding/pipeline';
import type { ExecutionService, ExecutionResult } from '@/lib/coding/execution';
import type { CodingSubmission } from '@/lib/coding/submission';
import type { CodingChallengeActivity, PrivateChallengeConfiguration } from '@/types/models';

const createValidSubmission = (): CodingSubmission => ({
  id: 'sub-1',
  studentId: 'student-1',
  lessonId: 'lesson-1',
  activityId: 'activity-1',
  challengeVersion: 1,
  language: 'cpp17',
  sourceCode: '#include <iostream>\nint main() { std::cout << "5\\n"; return 0; }',
  status: 'queued',
  submittedAt: new Date().toISOString(),
});

const createValidChallenge = (): CodingChallengeActivity => ({
  id: 'activity-1',
  type: 'CODING_CHALLENGE',
  title_en: 'Test Challenge',
  title_ar: 'تحدي الاختبار',
  order: 1,
  isPublished: true,
  challengeVersion: 1,
  allowedLanguages: ['cpp17'],
  defaultLanguage: 'cpp17',
  starterCodeByLanguage: [{ language: 'cpp17', starterCode: '#include <iostream>\nint main() {\n  return 0;\n}\n' }],
  problem_en: 'Output 5',
  problem_ar: 'اطبع 5',
  publicTestCases: [
    { id: 'public-1', input: '', expectedOutput: '5\n' },
    { id: 'public-2', input: '', expectedOutput: '5\n' },
  ],
  difficulty: 'beginner',
  timeLimitMs: 5000,
  memoryLimitMb: 64,
});

const createValidPrivateConfig = (): PrivateChallengeConfiguration => ({
  challengeVersion: 1,
  privateTestCases: [
    { id: 'private-1', input: '', expectedOutput: '5\n' },
    { id: 'private-2', input: '', expectedOutput: '5\n' },
  ],
});

class MockExecutionService implements ExecutionService {
  constructor(private resultOverride?: Partial<ExecutionResult>) {}

  async execute(request: any): Promise<ExecutionResult> {
    const defaultResult: ExecutionResult = {
      requestId: request.requestId,
      submissionId: request.submissionId,
      status: 'COMPLETED',
      language: request.language,
      stdout: '5\n',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 15,
      memoryUsedKb: 1024,
      runnerVersion: 'test-runner',
      completedAt: new Date().toISOString(),
    };
    return { ...defaultResult, ...this.resultOverride };
  }
}

describe('Coding Pipeline (D3D)', () => {
  describe('Challenge Compatibility', () => {
    it('accepts a valid CODING_CHALLENGE activity', () => {
      const challenge = createValidChallenge();
      const submission = createValidSubmission();
      const result = validateChallengeCompatibility(challenge, submission);
      expect(result.valid).toBe(true);
    });

    it('rejects non-CODING_CHALLENGE activity', () => {
      const submission = createValidSubmission();
      const result = validateChallengeCompatibility({ type: 'THEORY' }, submission);
      expect(result.valid).toBe(false);
    });

    it('rejects mismatched challenge version', () => {
      const challenge = createValidChallenge();
      challenge.challengeVersion = 2;
      const submission = createValidSubmission();
      const result = validateChallengeCompatibility(challenge, submission);
      expect(result.valid).toBe(false);
    });

    it('rejects unsupported language', () => {
      const challenge = createValidChallenge();
      const submission = createValidSubmission();
      (submission as any).language = 'ruby';
      const result = validateChallengeCompatibility(challenge, submission);
      expect(result.valid).toBe(false);
    });

    it('rejects challenge with zero public test cases', () => {
      const challenge = createValidChallenge();
      challenge.publicTestCases = [];
      const submission = createValidSubmission();
      const result = validateChallengeCompatibility(challenge, submission);
      expect(result.valid).toBe(false);
    });
  });

  describe('Private Config Compatibility', () => {
    it('accepts a valid private configuration', () => {
      const config = createValidPrivateConfig();
      const submission = createValidSubmission();
      const result = validatePrivateConfigCompatibility(config, submission);
      expect(result.valid).toBe(true);
    });

    it('rejects mismatched version', () => {
      const config = createValidPrivateConfig();
      config.challengeVersion = 2;
      const submission = createValidSubmission();
      const result = validatePrivateConfigCompatibility(config, submission);
      expect(result.valid).toBe(false);
    });

    it('rejects empty private test cases', () => {
      const config = createValidPrivateConfig();
      config.privateTestCases = [];
      const submission = createValidSubmission();
      const result = validatePrivateConfigCompatibility(config, submission);
      expect(result.valid).toBe(false);
    });
  });

  describe('Execution Limits', () => {
    it('derives limits from challenge', () => {
      const challenge = createValidChallenge();
      const limits = deriveTrustedExecutionLimits(challenge);
      expect(limits.timeLimitMs).toBe(5000);
      expect(limits.memoryLimitMb).toBe(64);
    });

    it('uses defaults if not specified', () => {
      const challenge = createValidChallenge();
      delete (challenge as any).timeLimitMs;
      delete (challenge as any).memoryLimitMb;
      const limits = deriveTrustedExecutionLimits(challenge);
      expect(limits.timeLimitMs).toBe(5000);
      expect(limits.memoryLimitMb).toBe(64);
    });
  });

  describe('Complete Evaluation Pipeline', () => {
    it('evaluates a valid submission to AC with all tests passing', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService();

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service,
        { outputComparisonPolicy: 'trim-trailing-whitespace' }
      );

      expect(result.evaluation.verdict).toBe('AC');
      expect(result.evaluation.scorePercent).toBe(100);
      expect(result.evaluation.passedTestCount).toBe(4); // 2 public + 2 private
      expect(result.evaluation.totalTestCount).toBe(4);
      expect(result.evaluation.publicTestResults).toHaveLength(2);
      expect(result.evaluation.publicTestResults.every((r) => r.passed)).toBe(true);
    });

    it('evaluates to WA if one public test fails', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ stdout: '99\n' });

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service,
        { outputComparisonPolicy: 'exact' }
      );

      expect(result.evaluation.verdict).toBe('WA');
      expect(result.evaluation.scorePercent).toBe(0);
      expect(result.evaluation.passedTestCount).toBe(0);
      expect(result.evaluation.publicTestResults.every((r) => !r.passed)).toBe(true);
    });

    it('includes private test results in scoring without exposing private test IDs', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      // Only 1 private test passes this time
      privateConfig.privateTestCases[1].expectedOutput = '9\n';
      const service = new MockExecutionService({ stdout: '5\n' });

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      // Public: 2/2 pass, Private: 1/2 pass → Total: 3/4 = 75%
      expect(result.evaluation.verdict).toBe('WA');
      expect(result.evaluation.scorePercent).toBe(75);
      expect(result.evaluation.passedTestCount).toBe(3);
      expect(result.evaluation.totalTestCount).toBe(4);
      // Private test IDs must NOT appear in publicTestResults
      expect(result.evaluation.publicTestResults.every((r) => r.testId.startsWith('public-'))).toBe(true);
    });

    it('maps compilation error to CE verdict', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ status: 'FAILED', failureReason: 'COMPILE_ERROR', stdout: '', stderr: 'error: expected ;' });

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      expect(result.evaluation.verdict).toBe('CE');
      expect(result.evaluation.scorePercent).toBe(0);
    });

    it('maps runtime error to RE verdict', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ status: 'FAILED', failureReason: 'RUNTIME_ERROR' });

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      expect(result.evaluation.verdict).toBe('RE');
    });

    it('maps timeout to TLE verdict', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ status: 'FAILED', failureReason: 'TIME_LIMIT' });

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      expect(result.evaluation.verdict).toBe('TLE');
    });

    it('maps memory limit to MLE verdict', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ status: 'FAILED', failureReason: 'MEMORY_LIMIT' });

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      expect(result.evaluation.verdict).toBe('MLE');
    });

    it('maps system error to SYSTEM_ERROR verdict', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ status: 'FAILED', failureReason: 'SYSTEM_ERROR' });

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      expect(result.evaluation.verdict).toBe('SYSTEM_ERROR');
    });
  });

  describe('Progress Tracking', () => {
    it('creates new progress on first submission', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService();

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      expect(result.progress.attempts).toBe(1);
      expect(result.progress.bestScorePercent).toBe(100);
      expect(result.progress.status).toBe('PASSED');
      expect(result.progress.passed).toBe(true);
      expect(result.progress.lastSubmissionId).toBe('sub-1');
    });

    it('increments attempts on second submission', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ stdout: '99\n' });

      const currentProgress = {
        studentId: 'student-1',
        lessonId: 'lesson-1',
        activityId: 'activity-1',
        challengeVersion: 1,
        status: 'IN_PROGRESS' as const,
        bestScorePercent: 50,
        attempts: 1,
        passed: false,
        updatedAt: new Date().toISOString(),
      };

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service,
        { currentProgress }
      );

      expect(result.progress.attempts).toBe(2);
      expect(result.progress.bestScorePercent).toBe(50); // Score didn't improve
      expect(result.progress.status).toBe('IN_PROGRESS');
    });

    it('never decreases best score', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ stdout: '99\n' });

      const currentProgress = {
        studentId: 'student-1',
        lessonId: 'lesson-1',
        activityId: 'activity-1',
        challengeVersion: 1,
        status: 'IN_PROGRESS' as const,
        bestScorePercent: 75,
        attempts: 2,
        passed: false,
        updatedAt: new Date().toISOString(),
      };

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service,
        { currentProgress }
      );

      expect(result.progress.bestScorePercent).toBe(75); // Preserved from before
    });

    it('transitions to PASSED only on AC', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ stdout: '5\n' });

      const currentProgress = {
        studentId: 'student-1',
        lessonId: 'lesson-1',
        activityId: 'activity-1',
        challengeVersion: 1,
        status: 'IN_PROGRESS' as const,
        bestScorePercent: 50,
        attempts: 1,
        passed: false,
        updatedAt: new Date().toISOString(),
      };

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      expect(result.progress.status).toBe('PASSED');
      expect(result.progress.passed).toBe(true);
    });

    it('initializes status as NOT_STARTED then IN_PROGRESS on first non-AC', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ stdout: '99\n' });

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      expect(result.progress.status).toBe('IN_PROGRESS');
      expect(result.progress.passed).toBe(false);
    });
  });

  describe('Attempt Limits', () => {
    it('rejects submission if attempt limit reached', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService();

      const attemptPolicy = { mode: 'limited' as const, maxAttempts: 2 };

      await expect(
        evaluateCodingSubmissionPipeline(submission, challenge, privateConfig, service, {
          attemptPolicy,
          currentAttemptCount: 2,
        })
      ).rejects.toThrow('Attempt limit exceeded');
    });

    it('allows submission if under attempt limit', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService();

      const attemptPolicy = { mode: 'limited' as const, maxAttempts: 3 };

      const result = await evaluateCodingSubmissionPipeline(submission, challenge, privateConfig, service, {
        attemptPolicy,
        currentAttemptCount: 2,
      });

      expect(result.progress.attempts).toBe(1); // First submission in this run
    });

    it('allows unlimited attempts', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService();

      const attemptPolicy = { mode: 'unlimited' as const };

      const result = await evaluateCodingSubmissionPipeline(submission, challenge, privateConfig, service, {
        attemptPolicy,
        currentAttemptCount: 1000,
      });

      expect(result.progress).toBeDefined();
    });
  });

  describe('Determinism & Idempotency', () => {
    it('produces the same evaluation for the same submission and execution result', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService({ stdout: '5\n' });

      const result1 = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      const result2 = await evaluateCodingSubmissionPipeline(
        { ...submission, submittedAt: new Date().toISOString() }, // Different timestamp
        challenge,
        privateConfig,
        service
      );

      expect(result1.evaluation.verdict).toBe(result2.evaluation.verdict);
      expect(result1.evaluation.scorePercent).toBe(result2.evaluation.scorePercent);
      expect(result1.evaluation.passedTestCount).toBe(result2.evaluation.passedTestCount);
    });

    it('produces idempotent request IDs', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();

      let capturedRequestIds: string[] = [];
      class TrackerService implements ExecutionService {
        async execute(request: any): Promise<ExecutionResult> {
          capturedRequestIds.push(request.requestId);
          return {
            requestId: request.requestId,
            submissionId: request.submissionId,
            status: 'COMPLETED',
            language: request.language,
            stdout: '5\n',
            stderr: '',
            exitCode: 0,
            executionTimeMs: 15,
            memoryUsedKb: 1024,
            runnerVersion: 'test',
            completedAt: new Date().toISOString(),
          };
        }
      }

      const service = new TrackerService();

      await evaluateCodingSubmissionPipeline(submission, challenge, privateConfig, service);
      await evaluateCodingSubmissionPipeline(submission, challenge, privateConfig, service);

      expect(capturedRequestIds[0]).toBe(capturedRequestIds[1]);
    });
  });

  describe('Security', () => {
    it('rejects student-injected execution limits', async () => {
      const submission = createValidSubmission();
      (submission as any).timeLimitMs = 60000;
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService();

      await expect(
        evaluateCodingSubmissionPipeline(submission, challenge, privateConfig, service)
      ).rejects.toThrow();
    });

    it('rejects student-injected verdicts or scores', async () => {
      const submission = createValidSubmission();
      (submission as any).verdict = 'AC';
      (submission as any).scorePercent = 100;
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      const service = new MockExecutionService();

      await expect(
        evaluateCodingSubmissionPipeline(submission, challenge, privateConfig, service)
      ).rejects.toThrow();
    });

    it('never exposes private test case details in evaluation', async () => {
      const submission = createValidSubmission();
      const challenge = createValidChallenge();
      const privateConfig = createValidPrivateConfig();
      // Make private tests have different expected output to verify separation
      privateConfig.privateTestCases = [
        { id: 'private-1', input: '', expectedOutput: '5\n' },
        { id: 'private-2', input: '', expectedOutput: '99\n' }, // Different!
      ];
      const service = new MockExecutionService({ stdout: '5\n' });

      const result = await evaluateCodingSubmissionPipeline(
        submission,
        challenge,
        privateConfig,
        service
      );

      const evaluation = result.evaluation;

      // Private test IDs must not appear
      for (const publicResult of evaluation.publicTestResults) {
        expect(publicResult.testId).toMatch(/^public-/);
        expect(publicResult.testId).not.toMatch(/^private-/);
      }

      // Public results show only public test IDs
      expect(evaluation.publicTestResults.map((r) => r.testId)).toEqual(['public-1', 'public-2']);
    });
  });
});
