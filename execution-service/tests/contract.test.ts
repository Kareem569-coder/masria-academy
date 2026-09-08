import { describe, it, expect } from 'vitest';
import {
  validateExecutionRequest,
  validateExecutionResult,
  isExecutionStatus,
  isExecutionFailureReason,
  EXECUTION_CONTRACT_VERSION,
  RUNNER_VERSION,
  type ExecutionRequest,
  type ExecutionResult,
} from '../src/contract/execution';

describe('Execution Contract Validation', () => {
  describe('ExecutionRequest validation', () => {
    const createValidRequest = (): ExecutionRequest => ({
      requestId: 'exec:masria-exec-1:sub-123',
      submissionId: 'sub-123',
      studentId: 'student-1',
      lessonId: 'lesson-1',
      activityId: 'activity-1',
      challengeVersion: 1,
      language: 'cpp17',
      sourceCode: '#include <iostream>\nint main() { std::cout << "Hello"; return 0; }',
      requestedAt: new Date().toISOString(),
      contractVersion: EXECUTION_CONTRACT_VERSION,
      status: 'QUEUED',
    });

    it('accepts valid execution request', () => {
      const request = createValidRequest();
      const result = validateExecutionRequest(request);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts cpp17 language (only supported language in D3B)', () => {
      const request = createValidRequest();
      request.language = 'cpp17';
      const result = validateExecutionRequest(request);
      expect(result.valid).toBe(true);
    });

    it('accepts other languages in contract (but execution-service only implements cpp17)', () => {
      const request = createValidRequest();
      request.language = 'python3';
      const result = validateExecutionRequest(request);
      // D3A contract accepts all languages, but execution-service only implements cpp17
      // This is validated at the execution-service level, not contract level
      expect(result.valid).toBe(true);
    });

    it('rejects request with source code exceeding max length', () => {
      const request = createValidRequest();
      request.sourceCode = 'x'.repeat(100_001);
      const result = validateExecutionRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Source code exceeds maximum length.');
    });

    it('rejects request with empty source code', () => {
      const request = createValidRequest();
      request.sourceCode = '';
      const result = validateExecutionRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Source code is required.');
    });

    it('rejects request with invalid contract version', () => {
      const request = createValidRequest();
      request.contractVersion = 'invalid-version';
      const result = validateExecutionRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Contract version is invalid.');
    });

    it('rejects request with invalid status', () => {
      const request = createValidRequest();
      (request as any).status = 'INVALID';
      const result = validateExecutionRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Status must be a valid execution status.');
    });

    it('rejects request with forbidden evaluation fields', () => {
      const request = createValidRequest();
      (request as any).verdict = 'AC';
      const result = validateExecutionRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('verdict'))).toBe(true);
    });

    it('accepts request with trusted time limit from gateway', () => {
      const request = createValidRequest();
      request.timeLimitMs = 2000;
      const result = validateExecutionRequest(request);
      expect(result.valid).toBe(true);
    });

    it('rejects request with invalid idempotency key', () => {
      const request = createValidRequest();
      request.idempotencyKey = '';
      const result = validateExecutionRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Idempotency key must be a non-empty string if provided.');
    });

    it('rejects request with oversized idempotency key', () => {
      const request = createValidRequest();
      request.idempotencyKey = 'x'.repeat(257);
      const result = validateExecutionRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Idempotency key exceeds maximum length.');
    });
  });

  describe('ExecutionResult validation', () => {
    const createValidResult = (): ExecutionResult => ({
      requestId: 'exec:masria-exec-1:sub-123',
      submissionId: 'sub-123',
      status: 'COMPLETED',
      language: 'cpp17',
      stdout: 'Hello World',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 100,
      memoryUsedKb: 1024,
      runnerVersion: RUNNER_VERSION,
      completedAt: new Date().toISOString(),
    });

    it('accepts valid completed result', () => {
      const result = createValidResult();
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(true);
    });

    it('accepts valid failed result with failure reason', () => {
      const result = createValidResult();
      result.status = 'FAILED';
      result.failureReason = 'COMPILE_ERROR';
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(true);
    });

    it('rejects failed result without failure reason', () => {
      const result = createValidResult();
      result.status = 'FAILED';
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Failed execution requires a valid failure reason.');
    });

    it('rejects result with failure reason on completed status', () => {
      const result = createValidResult();
      result.failureReason = 'COMPILE_ERROR';
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('failureReason is only allowed when status is FAILED.');
    });

    it('rejects result with verdict field (evaluator responsibility)', () => {
      const result = createValidResult();
      (result as any).verdict = 'AC';
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('verdict'))).toBe(true);
    });

    it('rejects result with scorePercent field (evaluator responsibility)', () => {
      const result = createValidResult();
      (result as any).scorePercent = 100;
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('scorePercent'))).toBe(true);
    });

    it('rejects result with oversized stdout', () => {
      const result = createValidResult();
      result.stdout = 'x'.repeat(65_537);
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('stdout exceeds maximum length.');
    });

    it('rejects result with oversized stderr', () => {
      const result = createValidResult();
      result.stderr = 'x'.repeat(65_537);
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('stderr exceeds maximum length.');
    });

    it('rejects result with negative execution time', () => {
      const result = createValidResult();
      result.executionTimeMs = -1;
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Execution time must be a non-negative integer if provided.');
    });

    it('rejects result with negative memory used', () => {
      const result = createValidResult();
      result.memoryUsedKb = -1;
      const validation = validateExecutionResult(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Memory used must be a non-negative integer if provided.');
    });
  });

  describe('Type guards', () => {
    it('recognizes valid execution statuses', () => {
      expect(isExecutionStatus('QUEUED')).toBe(true);
      expect(isExecutionStatus('RUNNING')).toBe(true);
      expect(isExecutionStatus('COMPLETED')).toBe(true);
      expect(isExecutionStatus('FAILED')).toBe(true);
    });

    it('rejects invalid execution statuses', () => {
      expect(isExecutionStatus('SUCCESS')).toBe(false);
      expect(isExecutionStatus('PENDING')).toBe(false);
      expect(isExecutionStatus('')).toBe(false);
    });

    it('recognizes valid failure reasons', () => {
      expect(isExecutionFailureReason('COMPILE_ERROR')).toBe(true);
      expect(isExecutionFailureReason('RUNTIME_ERROR')).toBe(true);
      expect(isExecutionFailureReason('TIME_LIMIT')).toBe(true);
      expect(isExecutionFailureReason('MEMORY_LIMIT')).toBe(true);
      expect(isExecutionFailureReason('OUTPUT_LIMIT')).toBe(true);
      expect(isExecutionFailureReason('SYSTEM_ERROR')).toBe(true);
      expect(isExecutionFailureReason('NOT_IMPLEMENTED')).toBe(true);
    });

    it('rejects invalid failure reasons', () => {
      expect(isExecutionFailureReason('UNSUPPORTED_LANGUAGE')).toBe(false);
      expect(isExecutionFailureReason('SOURCE_TOO_LONG')).toBe(false);
      expect(isExecutionFailureReason('')).toBe(false);
    });
  });

  describe('Contract version compatibility', () => {
    it('uses correct contract version', () => {
      expect(EXECUTION_CONTRACT_VERSION).toBe('masria-exec-1');
    });

    it('uses pinned runner version', () => {
      expect(RUNNER_VERSION).toBe('masria-cpp17-gcc13.4.0-v1');
    });
  });
});
