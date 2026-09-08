import { isProgrammingLanguageId, type ProgrammingLanguageId } from '@/lib/coding/languages';
import type {
  CodeCompletionActivity,
  CodeExampleActivity,
  CodeOrderingActivity,
  CodeOutputActivity,
  CodingChallengeActivity,
  DebuggingActivity,
  LanguageTemplate,
  PublicTestCase,
} from '@/types/models';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const MAX_SOURCE_CODE_LENGTH = 100_000;
const MAX_TEST_CASE_TEXT_LENGTH = 10_000;

const valid = (): ValidationResult => ({ valid: true, errors: [] });
const invalid = (...errors: string[]): ValidationResult => ({ valid: false, errors });
const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);
const hasReasonableLength = (value: string, maximum: number) => value.length <= maximum;

export function validateProgrammingLanguageId(value: unknown): value is ProgrammingLanguageId {
  return isProgrammingLanguageId(value);
}

export function validateLanguageTemplate(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid('Language template must be an object.');
  if (!validateProgrammingLanguageId(value.language)) return invalid('Language template has an unsupported language.');
  if (!isNonEmptyString(value.starterCode)) return invalid('Language template requires starter code.');
  if (!hasReasonableLength(value.starterCode, MAX_SOURCE_CODE_LENGTH)) {
    return invalid('Language template starter code is too large.');
  }
  return valid();
}

export function validatePublicTestCase(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid('Public test case must be an object.');
  if (!isNonEmptyString(value.id)) return invalid('Public test case requires an id.');
  if (typeof value.input !== 'string' || typeof value.expectedOutput !== 'string') {
    return invalid('Public test case input and expected output must be strings.');
  }
  if (!hasReasonableLength(value.input, MAX_TEST_CASE_TEXT_LENGTH)
    || !hasReasonableLength(value.expectedOutput, MAX_TEST_CASE_TEXT_LENGTH)) {
    return invalid('Public test case input or expected output is too large.');
  }
  return valid();
}

export function validateCodingChallenge(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid('Coding challenge must be an object.');

  const errors: string[] = [];
  if (!Number.isInteger(value.challengeVersion) || (value.challengeVersion as number) < 1) {
    errors.push('Challenge version must be a positive integer.');
  }
  if (!isNonEmptyString(value.problem_en) || !isNonEmptyString(value.problem_ar)) {
    errors.push('Coding challenge requires English and Arabic problem statements.');
  }
  if (!['beginner', 'intermediate', 'advanced'].includes(value.difficulty as string)) {
    errors.push('Coding challenge has an invalid difficulty.');
  }

  const allowedLanguages = value.allowedLanguages;
  if (!Array.isArray(allowedLanguages) || allowedLanguages.length === 0
    || allowedLanguages.some((language) => !validateProgrammingLanguageId(language))
    || new Set(allowedLanguages).size !== allowedLanguages.length) {
    errors.push('Coding challenge must have unique supported allowed languages.');
  }
  if (!validateProgrammingLanguageId(value.defaultLanguage)
    || !Array.isArray(allowedLanguages)
    || !allowedLanguages.includes(value.defaultLanguage)) {
    errors.push('Default language must be one of the allowed languages.');
  }

  const templates = value.starterCodeByLanguage;
  if (!Array.isArray(templates) || templates.length === 0) {
    errors.push('Coding challenge requires language starter code.');
  } else {
    const templateLanguages = new Set<string>();
    for (const template of templates) {
      const result = validateLanguageTemplate(template);
      if (!result.valid) errors.push(...result.errors);
      if (isRecord(template) && typeof template.language === 'string') {
        if (templateLanguages.has(template.language)) errors.push('Language templates must not be duplicated.');
        templateLanguages.add(template.language);
        if (Array.isArray(allowedLanguages) && !allowedLanguages.includes(template.language)) {
          errors.push('Starter code language must be allowed by the challenge.');
        }
      }
    }
    if (validateProgrammingLanguageId(value.defaultLanguage) && !templateLanguages.has(value.defaultLanguage)) {
      errors.push('Default language requires starter code.');
    }
  }

  const publicTestCases = value.publicTestCases;
  if (!Array.isArray(publicTestCases) || publicTestCases.length === 0) {
    errors.push('Coding challenge requires at least one public test case.');
  } else {
    const testCaseIds = new Set<string>();
    for (const testCase of publicTestCases) {
      const result = validatePublicTestCase(testCase);
      if (!result.valid) errors.push(...result.errors);
      if (isRecord(testCase) && typeof testCase.id === 'string') {
        if (testCaseIds.has(testCase.id)) errors.push('Public test case ids must not be duplicated.');
        testCaseIds.add(testCase.id);
      }
    }
  }

  for (const field of ['maxAttempts', 'timeLimitMs', 'memoryLimitMb']) {
    const limit = value[field];
    if (limit !== undefined && (!Number.isInteger(limit) || (limit as number) < 0)) {
      errors.push(`${field} must be a non-negative integer when provided.`);
    }
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateCodingActivity(value: unknown): ValidationResult {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return invalid('Coding activity must be an activity object.');
  }

  const hasSourceCode = (field: string) => (
    isNonEmptyString(value[field]) && hasReasonableLength(value[field] as string, MAX_SOURCE_CODE_LENGTH)
  );

  switch (value.type) {
    case 'CODING':
      // Legacy lessons may use an older language string and sparse coding data.
      return valid();
    case 'CODE_EXAMPLE':
      return validateProgrammingLanguageId(value.language) && hasSourceCode('sourceCode')
        ? valid() : invalid('Code example requires a supported language and source code.');
    case 'CODE_OUTPUT': {
      const hasExpectedOutput = typeof value.expectedOutput === 'string';
      const hasAnswerChoices = Array.isArray(value.answerChoices) && value.answerChoices.length > 0;
      return validateProgrammingLanguageId(value.language) && hasSourceCode('sourceCode')
        && (hasExpectedOutput || hasAnswerChoices)
        ? valid() : invalid('Code output activity requires source code and an expected output or answer choices.');
    }
    case 'CODE_COMPLETION':
      return validateProgrammingLanguageId(value.language) && hasSourceCode('starterCode')
        && Array.isArray(value.editableRegions) && value.editableRegions.length > 0
        ? valid() : invalid('Code completion activity requires starter code and editable regions.');
    case 'DEBUGGING':
      return validateProgrammingLanguageId(value.language) && hasSourceCode('brokenCode')
        && Array.isArray(value.defects) && value.defects.length > 0
        ? valid() : invalid('Debugging activity requires broken code and defect metadata.');
    case 'CODE_ORDERING':
      return validateProgrammingLanguageId(value.language)
        && Array.isArray(value.fragments) && value.fragments.length > 1
        && Array.isArray(value.correctOrder) && value.correctOrder.length === value.fragments.length
        ? valid() : invalid('Code ordering activity requires fragments and a matching correct order.');
    case 'CODING_CHALLENGE':
      return validateCodingChallenge(value);
    default:
      return invalid('Unsupported coding activity type.');
  }
}

export type {
  CodeCompletionActivity,
  CodeExampleActivity,
  CodeOrderingActivity,
  CodeOutputActivity,
  CodingChallengeActivity,
  DebuggingActivity,
  LanguageTemplate,
  PublicTestCase,
};
