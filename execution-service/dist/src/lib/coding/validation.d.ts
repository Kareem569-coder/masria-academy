import { type ProgrammingLanguageId } from '@/lib/coding/languages';
import type { CodeCompletionActivity, CodeExampleActivity, CodeOrderingActivity, CodeOutputActivity, CodingChallengeActivity, DebuggingActivity, LanguageTemplate, PublicTestCase } from '@/types/models';
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare function validateProgrammingLanguageId(value: unknown): value is ProgrammingLanguageId;
export declare function validateLanguageTemplate(value: unknown): ValidationResult;
export declare function validatePublicTestCase(value: unknown): ValidationResult;
export declare function validateCodingChallenge(value: unknown): ValidationResult;
export declare function validateCodingActivity(value: unknown): ValidationResult;
export type { CodeCompletionActivity, CodeExampleActivity, CodeOrderingActivity, CodeOutputActivity, CodingChallengeActivity, DebuggingActivity, LanguageTemplate, PublicTestCase, };
//# sourceMappingURL=validation.d.ts.map