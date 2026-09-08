import { type ProgrammingLanguageId } from '@/lib/coding/languages';
import { type CodingEvaluation } from '@/lib/coding/submission';
import type { PublicTestCase } from '@/types/models';
export type OutputComparisonPolicy = 'exact' | 'trim-trailing-whitespace' | 'whitespace-normalized';
export type ExecutionFailureReason = 'COMPILE_ERROR' | 'RUNTIME_ERROR' | 'TIME_LIMIT' | 'MEMORY_LIMIT' | 'OUTPUT_LIMIT' | 'SYSTEM_ERROR' | 'NOT_IMPLEMENTED';
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
    privateTestCases?: Array<{
        id: string;
        input: string;
        expectedOutput: string;
        weight?: number;
    }>;
    comparisonPolicy?: OutputComparisonPolicy;
    evaluatorVersion: string;
    evaluatedAt: string;
    expectedFeedback_en?: string;
    expectedFeedback_ar?: string;
}
export declare function normalizeOutputForComparison(value: string, policy?: OutputComparisonPolicy): string;
export declare function compareOutputs(actual: string | undefined, expected: string | undefined, policy?: OutputComparisonPolicy): boolean;
export declare function determineVerdictFromExecution(execution: Pick<ExecutionLikeResult, 'status' | 'failureReason'>): CodingEvaluation['verdict'];
export declare function evaluateCodingChallengeAttempt(input: EvaluateCodingChallengeAttemptInput): CodingEvaluation;
//# sourceMappingURL=evaluator.d.ts.map