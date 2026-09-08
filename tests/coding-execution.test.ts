import { describe, expect, it } from 'vitest';
import {
  EXECUTION_CONTRACT_VERSION,
  MAX_EXECUTION_OUTPUT_LENGTH,
  MAX_EXECUTION_REQUEST_ID_LENGTH,
  NotImplementedExecutionService,
  deriveExecutionIdempotencyKey,
  deriveExecutionRequestId,
  mapQueuedSubmissionToExecutionRequest,
  validateExecutionRequest,
  validateExecutionRequestId,
  validateExecutionResult,
  type ExecutionRequest,
  type ExecutionResult,
} from '@/lib/coding/execution';
import {
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_SOURCE_CODE_LENGTH,
  validateIdempotencyKey,
  type CodingSubmission,
} from '@/lib/coding/submission';

const queuedSubmission = (): CodingSubmission => ({
  id: 'sub-1',
  studentId: 'student-1',
  lessonId: 'lesson-1',
  activityId: 'activity-1',
  challengeVersion: 1,
  language: 'cpp17',
  sourceCode: '#include <iostream>\nint main() { return 0; }',
  status: 'queued',
  submittedAt: '2026-08-30T00:00:00.000Z',
});

const validRequest = (): ExecutionRequest => ({
  requestId: deriveExecutionRequestId('sub-1'),
  submissionId: 'sub-1',
  studentId: 'student-1',
  lessonId: 'lesson-1',
  activityId: 'activity-1',
  challengeVersion: 1,
  language: 'cpp17',
  sourceCode: 'int main() { return 0; }',
  requestedAt: '2026-08-30T00:00:00.000Z',
  contractVersion: EXECUTION_CONTRACT_VERSION,
  status: 'QUEUED',
});

const validCompletedResult = (): ExecutionResult => ({
  requestId: deriveExecutionRequestId('sub-1'),
  submissionId: 'sub-1',
  status: 'COMPLETED',
  language: 'cpp17',
  stdout: '42\n',
  stderr: '',
  exitCode: 0,
  executionTimeMs: 12,
  memoryUsedKb: 1024,
  runnerVersion: 'runner-test',
  completedAt: '2026-08-30T00:00:01.000Z',
});

describe('Trusted execution gateway contract', () => {
  describe('ExecutionRequest', () => {
    it('accepts a valid request', () => {
      expect(validateExecutionRequest(validRequest()).valid).toBe(true);
    });

    it('rejects empty IDs', () => {
      expect(validateExecutionRequest({ ...validRequest(), requestId: '' }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), submissionId: ' ' }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), studentId: '' }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), lessonId: '' }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), activityId: '' }).valid).toBe(false);
    });

    it('rejects an unsupported language', () => {
      expect(validateExecutionRequest({ ...validRequest(), language: 'ruby' }).valid).toBe(false);
    });

    it('rejects an invalid status', () => {
      expect(validateExecutionRequest({ ...validRequest(), status: 'queued' }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), status: 'SUCCESS' }).valid).toBe(false);
    });

    it('rejects empty source', () => {
      expect(validateExecutionRequest({ ...validRequest(), sourceCode: '   ' }).valid).toBe(false);
    });

    it('rejects oversized source', () => {
      expect(validateExecutionRequest({
        ...validRequest(),
        sourceCode: 'x'.repeat(MAX_SOURCE_CODE_LENGTH + 1),
      }).valid).toBe(false);
    });

    it('rejects an invalid challengeVersion', () => {
      expect(validateExecutionRequest({ ...validRequest(), challengeVersion: 0 }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), challengeVersion: 1.5 }).valid).toBe(false);
    });

    it('rejects an invalid contractVersion', () => {
      expect(validateExecutionRequest({ ...validRequest(), contractVersion: 'v0' }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), contractVersion: 1 }).valid).toBe(false);
    });
  });

  describe('ExecutionResult', () => {
    it('accepts a valid completed result', () => {
      expect(validateExecutionResult(validCompletedResult()).valid).toBe(true);
    });

    it('accepts a valid compile failure', () => {
      expect(validateExecutionResult({
        requestId: deriveExecutionRequestId('sub-1'),
        submissionId: 'sub-1',
        status: 'FAILED',
        language: 'cpp17',
        stderr: 'error: expected ;',
        exitCode: 1,
        failureReason: 'COMPILE_ERROR',
        runnerVersion: 'runner-test',
        completedAt: '2026-08-30T00:00:01.000Z',
      }).valid).toBe(true);
    });

    it('rejects an invalid status', () => {
      expect(validateExecutionResult({ ...validCompletedResult(), status: 'AC' }).valid).toBe(false);
    });

    it('rejects an invalid failure reason', () => {
      expect(validateExecutionResult({
        ...validCompletedResult(),
        status: 'FAILED',
        failureReason: 'CE',
      }).valid).toBe(false);
    });

    it('rejects negative execution time', () => {
      expect(validateExecutionResult({ ...validCompletedResult(), executionTimeMs: -1 }).valid).toBe(false);
    });

    it('rejects negative memory', () => {
      expect(validateExecutionResult({ ...validCompletedResult(), memoryUsedKb: -8 }).valid).toBe(false);
    });

    it('rejects oversized stdout', () => {
      expect(validateExecutionResult({
        ...validCompletedResult(),
        stdout: 'o'.repeat(MAX_EXECUTION_OUTPUT_LENGTH + 1),
      }).valid).toBe(false);
    });

    it('rejects oversized stderr', () => {
      expect(validateExecutionResult({
        ...validCompletedResult(),
        stderr: 'e'.repeat(MAX_EXECUTION_OUTPUT_LENGTH + 1),
      }).valid).toBe(false);
    });

    it('rejects an invalid exit code', () => {
      expect(validateExecutionResult({ ...validCompletedResult(), exitCode: 1.2 }).valid).toBe(false);
    });
  });

  describe('Submission → execution mapping', () => {
    it('maps a valid queued submission correctly', () => {
      const mapped = mapQueuedSubmissionToExecutionRequest(queuedSubmission(), {
        requestedAt: '2026-08-30T00:00:00.000Z',
      });
      expect(mapped.valid).toBe(true);
      if (!mapped.valid) return;
      expect(mapped.request.status).toBe('QUEUED');
      expect(mapped.request.contractVersion).toBe(EXECUTION_CONTRACT_VERSION);
      expect(mapped.request.requestId).toBe(deriveExecutionRequestId('sub-1'));
    });

    it('rejects a non-queued submission', () => {
      const mapped = mapQueuedSubmissionToExecutionRequest({
        ...queuedSubmission(),
        status: 'completed',
      });
      expect(mapped.valid).toBe(false);
    });

    it('preserves identity fields, challengeVersion, language, and source', () => {
      const submission = queuedSubmission();
      const mapped = mapQueuedSubmissionToExecutionRequest(submission);
      expect(mapped.valid).toBe(true);
      if (!mapped.valid) return;
      expect(mapped.request.submissionId).toBe(submission.id);
      expect(mapped.request.studentId).toBe(submission.studentId);
      expect(mapped.request.lessonId).toBe(submission.lessonId);
      expect(mapped.request.activityId).toBe(submission.activityId);
      expect(mapped.request.challengeVersion).toBe(submission.challengeVersion);
      expect(mapped.request.language).toBe(submission.language);
      expect(mapped.request.sourceCode).toBe(submission.sourceCode);
    });

    it('rejects student-controlled execution limits', () => {
      const withTimeout = mapQueuedSubmissionToExecutionRequest({
        ...queuedSubmission(),
        timeLimitMs: 60_000,
      });
      const withMemory = mapQueuedSubmissionToExecutionRequest({
        ...queuedSubmission(),
        memoryLimitMb: 512,
      });
      expect(withTimeout.valid).toBe(false);
      expect(withMemory.valid).toBe(false);
    });

    it('applies trusted limits without copying student configuration', () => {
      const mapped = mapQueuedSubmissionToExecutionRequest(queuedSubmission(), {
        requestedAt: '2026-08-30T00:00:00.000Z',
        trustedLimits: { timeLimitMs: 2000, memoryLimitMb: 64 },
      });
      expect(mapped.valid).toBe(true);
      if (!mapped.valid) return;
      expect(mapped.request.timeLimitMs).toBe(2000);
      expect(mapped.request.memoryLimitMb).toBe(64);
      expect(mapped.request.deadlineAt).toBeDefined();
    });
  });

  describe('Security invariants', () => {
    it('does not accept a verdict, score, or evaluator metadata on the request', () => {
      expect(validateExecutionRequest({ ...validRequest(), verdict: 'AC' }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), scorePercent: 100 }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), evaluatorVersion: '1' }).valid).toBe(false);
    });

    it('does not accept private tests or a reference solution', () => {
      expect(validateExecutionRequest({
        ...validRequest(),
        privateTestCases: [{ id: 'h1', input: '1', expectedOutput: '1' }],
      }).valid).toBe(false);
      expect(validateExecutionRequest({
        ...validRequest(),
        referenceSolution: 'int main() {}',
      }).valid).toBe(false);

      expect(mapQueuedSubmissionToExecutionRequest({
        ...queuedSubmission(),
        privateTestCases: [],
      }).valid).toBe(false);
      expect(mapQueuedSubmissionToExecutionRequest({
        ...queuedSubmission(),
        referenceSolutionsByLanguage: [{ language: 'cpp17', starterCode: 'int main() {}' }],
      }).valid).toBe(false);
    });

    it('does not accept arbitrary environment, network, or filesystem configuration', () => {
      expect(validateExecutionRequest({ ...validRequest(), env: { PATH: '/bin' } }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), networkAccess: true }).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), filesystem: { cwd: '/' } }).valid).toBe(false);

      expect(mapQueuedSubmissionToExecutionRequest({
        ...queuedSubmission(),
        environmentVariables: { FLAG: '1' },
      }).valid).toBe(false);
      expect(mapQueuedSubmissionToExecutionRequest({
        ...queuedSubmission(),
        allowNetwork: true,
      }).valid).toBe(false);
      expect(mapQueuedSubmissionToExecutionRequest({
        ...queuedSubmission(),
        workingDirectory: '/tmp',
      }).valid).toBe(false);
    });
  });

  describe('Idempotency', () => {
    it('accepts valid request IDs', () => {
      expect(validateExecutionRequestId(deriveExecutionRequestId('sub-1')).valid).toBe(true);
      expect(validateExecutionRequestId('job-abc').valid).toBe(true);
    });

    it('rejects empty request IDs', () => {
      expect(validateExecutionRequestId('').valid).toBe(false);
      expect(validateExecutionRequestId('   ').valid).toBe(false);
    });

    it('rejects oversized request IDs', () => {
      expect(validateExecutionRequestId('r'.repeat(MAX_EXECUTION_REQUEST_ID_LENGTH + 1)).valid).toBe(false);
    });

    it('rejects invalid idempotency keys', () => {
      expect(validateIdempotencyKey('').valid).toBe(false);
      expect(validateIdempotencyKey('k'.repeat(MAX_IDEMPOTENCY_KEY_LENGTH + 1)).valid).toBe(false);
      expect(validateExecutionRequest({ ...validRequest(), idempotencyKey: '' }).valid).toBe(false);
    });

    it('derives a stable request id from the submission, not a client UUID', () => {
      expect(deriveExecutionRequestId('sub-1')).toBe(deriveExecutionRequestId('sub-1'));
      expect(deriveExecutionRequestId('sub-1')).not.toBe(deriveExecutionRequestId('sub-2'));
      expect(deriveExecutionIdempotencyKey(queuedSubmission())).toBe('submission:sub-1');
      expect(deriveExecutionIdempotencyKey({
        ...queuedSubmission(),
        idempotencyKey: 'client-retry-1',
      })).toBe('client-retry-1');
    });
  });

  describe('Placeholder execution service', () => {
    it('returns NOT_IMPLEMENTED without running code', async () => {
      const service = new NotImplementedExecutionService();
      const result = await service.execute(validRequest());
      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toBe('NOT_IMPLEMENTED');
      expect(validateExecutionResult(result).valid).toBe(true);
    });
  });
});
