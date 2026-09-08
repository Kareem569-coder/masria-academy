/**
 * Execution Contract for MASRIA Execution Service
 * 
 * This module mirrors the D3A execution contract from MASRIA to maintain
 * compatibility while keeping the execution-service physically separate.
 * 
 * Contract version: masria-exec-1
 * 
 * The execution-service is a separate deployable service that:
 * - Accepts ExecutionRequest from the trusted gateway
 * - Executes code in isolated Docker containers
 * - Returns ExecutionResult (NOT a grade/verdict)
 * 
 * ExecutionResult != CodingEvaluation.
 * The runner executes code. The evaluator determines correctness.
 */

import { isProgrammingLanguageId, type ProgrammingLanguageId } from '../../../src/lib/coding/languages';

export const EXECUTION_CONTRACT_VERSION = 'masria-exec-1';

export const MAX_EXECUTION_OUTPUT_LENGTH = 65_536;
export const MAX_EXECUTION_REQUEST_ID_LENGTH = 256;

export type ExecutionStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export const EXECUTION_STATUSES: readonly ExecutionStatus[] = [
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
] as const;

export type ExecutionFailureReason =
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT'
  | 'MEMORY_LIMIT'
  | 'OUTPUT_LIMIT'
  | 'SYSTEM_ERROR'
  | 'NOT_IMPLEMENTED';

export const EXECUTION_FAILURE_REASONS: readonly ExecutionFailureReason[] = [
  'COMPILE_ERROR',
  'RUNTIME_ERROR',
  'TIME_LIMIT',
  'MEMORY_LIMIT',
  'OUTPUT_LIMIT',
  'SYSTEM_ERROR',
  'NOT_IMPLEMENTED',
] as const;

export interface TrustedExecutionLimits {
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface ExecutionRequest {
  requestId: string;
  submissionId: string;
  studentId: string;
  lessonId: string;
  activityId: string;
  challengeVersion: number;
  language: ProgrammingLanguageId;
  sourceCode: string;
  requestedAt: string;
  contractVersion: string;
  status: ExecutionStatus;
  idempotencyKey?: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  deadlineAt?: string;
}

export interface ExecutionResult {
  requestId: string;
  submissionId: string;
  status: ExecutionStatus;
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

export const RUNNER_VERSION = 'masria-cpp17-gcc13.4.0-v1';

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const valid = (): ValidationResult => ({ valid: true, errors: [] });
const invalid = (...errors: string[]): ValidationResult => ({ valid: false, errors });

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const isPositiveInteger = (value: unknown): value is number => (
  Number.isInteger(value) && (value as number) > 0
);

const isNonNegativeInteger = (value: unknown): value is number => (
  Number.isInteger(value) && (value as number) >= 0
);

const isInteger = (value: unknown): value is number => Number.isInteger(value);

export function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return typeof value === 'string' && EXECUTION_STATUSES.includes(value as ExecutionStatus);
}

export function isExecutionFailureReason(value: unknown): value is ExecutionFailureReason {
  return typeof value === 'string'
    && EXECUTION_FAILURE_REASONS.includes(value as ExecutionFailureReason);
}

export function validateExecutionRequestId(value: unknown): ValidationResult {
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
] as const;

function collectForbiddenKeyErrors(value: Record<string, unknown>, keys: readonly string[]): string[] {
  const errors: string[] = [];
  for (const key of keys) {
    if (key in value) {
      errors.push(`Trusted execution input must not contain ${key}.`);
    }
  }
  return errors;
}

export function validateExecutionRequest(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return invalid('Execution request must be an object.');
  }

  const errors: string[] = [];
  const requestId = validateExecutionRequestId(value.requestId);
  if (!requestId.valid) errors.push(...requestId.errors);

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
  } else if (value.sourceCode.length > 100_000) {
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
    if (typeof value.idempotencyKey !== 'string' || value.idempotencyKey.trim().length === 0) {
      errors.push('Idempotency key must be a non-empty string if provided.');
    } else if (value.idempotencyKey.length > 256) {
      errors.push('Idempotency key exceeds maximum length.');
    }
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

export function validateExecutionResult(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return invalid('Execution result must be an object.');
  }

  const errors: string[] = [];
  const requestId = validateExecutionRequestId(value.requestId);
  if (!requestId.valid) errors.push(...requestId.errors);

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
    } else if (value.stdout.length > MAX_EXECUTION_OUTPUT_LENGTH) {
      errors.push('stdout exceeds maximum length.');
    }
  }
  if (value.stderr !== undefined) {
    if (typeof value.stderr !== 'string') {
      errors.push('stderr must be a string if provided.');
    } else if (value.stderr.length > MAX_EXECUTION_OUTPUT_LENGTH) {
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
  } else if (value.failureReason !== undefined) {
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
