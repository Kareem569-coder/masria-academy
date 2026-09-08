import type { ProgrammingLanguageId } from '@/lib/coding/languages';

export type UserRole = 'student' | 'parent';
export type StudentStatus = 'pending' | 'active' | 'suspended';

// Legacy delivery format type (preserved for backward compatibility)
export type LessonDeliveryType = 'video' | 'pdf' | 'quiz_only' | 'hybrid';

// Educational classification type (new architecture)
export type LessonCategory = 'THEORY' | 'PRACTICAL' | 'HYBRID' | 'ASSESSMENT';

// Activity type (new architecture)
export type ActivityType =
  | 'THEORY'
  | 'QUIZ'
  | 'CODING'
  | 'WRITTEN'
  | 'CODE_EXAMPLE'
  | 'CODE_OUTPUT'
  | 'CODE_COMPLETION'
  | 'DEBUGGING'
  | 'CODE_ORDERING'
  | 'CODING_CHALLENGE';

export interface LinkedStudent {
  uid: string;
  name: string;
  email: string;
  linkedAt: string | Date;
  gradeLevel?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  role: UserRole;
  status: StudentStatus;
  gradeLevel?: string;
  linkCode?: string;
  completedLessons?: string[];
  linkedStudents?: LinkedStudent[];
  linkedStudentIds?: string[];
  lastLinkedCode?: string;
  createdAt?: string;
}

export interface QuizOption {
  en: string;
  ar: string;
}

export interface QuizQuestion {
  uid?: string;
  en: string;
  ar: string;
  options: QuizOption[];
  correct: number;
}

export interface LessonQuiz {
  quizTitle_en?: string;
  quizTitle_ar?: string;
  questions: QuizQuestion[];
}

// Activity base interface
export interface BaseActivity {
  id: string;
  type: ActivityType;
  title_en: string;
  title_ar: string;
  description_en?: string;
  description_ar?: string;
  order: number;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Theory Activity
export interface TheoryActivity extends BaseActivity {
  type: 'THEORY';
  content_en: string;
  content_ar: string;
}

// Quiz Activity (can reference existing quiz structure)
export interface QuizActivity extends BaseActivity {
  type: 'QUIZ';
  quiz: LessonQuiz;
  passingScore?: number; // percentage required to pass
}

// Coding Activity (placeholder for future Code Runner integration)
export interface CodingActivity extends BaseActivity {
  type: 'CODING';
  starterCode?: string;
  expectedOutput?: string;
  // Keep this broad for backward compatibility with already stored activities.
  language?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface CodeAnnotation {
  line?: number;
  text_en: string;
  text_ar?: string;
}

export interface ReferenceSolutionMetadata {
  referenceId: string;
  revision?: number;
}

export interface LanguageTemplate {
  language: ProgrammingLanguageId;
  starterCode: string;
}

export interface PublicTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  explanation_en?: string;
  explanation_ar?: string;
}

export interface CodeExampleActivity extends BaseActivity {
  type: 'CODE_EXAMPLE';
  language: ProgrammingLanguageId;
  sourceCode: string;
  annotations?: CodeAnnotation[];
}

export interface CodeOutputAnswerChoice {
  id: string;
  text_en: string;
  text_ar?: string;
}

export interface CodeOutputActivity extends BaseActivity {
  type: 'CODE_OUTPUT';
  language: ProgrammingLanguageId;
  sourceCode: string;
  input?: string;
  expectedOutput?: string;
  answerChoices?: CodeOutputAnswerChoice[];
  correctAnswerId?: string;
  explanation_en?: string;
  explanation_ar?: string;
}

export interface EditableRegion {
  id: string;
  startMarker: string;
  endMarker: string;
  placeholder?: string;
}

export interface CodeCompletionActivity extends BaseActivity {
  type: 'CODE_COMPLETION';
  language: ProgrammingLanguageId;
  starterCode: string;
  editableRegions: EditableRegion[];
  referenceSolution?: ReferenceSolutionMetadata;
  hintIds?: string[];
}

export interface CodeDefect {
  id: string;
  description_en: string;
  description_ar?: string;
}

export interface DebuggingActivity extends BaseActivity {
  type: 'DEBUGGING';
  language: ProgrammingLanguageId;
  brokenCode: string;
  defects: CodeDefect[];
  referenceSolution?: ReferenceSolutionMetadata;
}

export interface CodeFragment {
  id: string;
  sourceCode: string;
}

export interface CodeOrderingActivity extends BaseActivity {
  type: 'CODE_ORDERING';
  language: ProgrammingLanguageId;
  fragments: CodeFragment[];
  correctOrder: string[];
}

export interface PublicChallengeDefinition {
  challengeVersion: number;
  allowedLanguages: ProgrammingLanguageId[];
  defaultLanguage: ProgrammingLanguageId;
  starterCodeByLanguage: LanguageTemplate[];
  problem_en: string;
  problem_ar: string;
  inputDescription_en?: string;
  inputDescription_ar?: string;
  outputDescription_en?: string;
  outputDescription_ar?: string;
  constraints_en?: string;
  constraints_ar?: string;
  publicTestCases: PublicTestCase[];
  difficulty: Difficulty;
  maxAttempts?: number;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  hintIds?: string[];
}

export interface CodingChallengeActivity extends BaseActivity, PublicChallengeDefinition {
  type: 'CODING_CHALLENGE';
}

// This configuration must live outside student-readable lesson data when it is
// persisted. It intentionally does not belong on CodingChallengeActivity.
export interface PrivateChallengeTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  weight?: number;
}

export interface PrivateChallengeConfiguration {
  challengeVersion: number;
  privateTestCases: PrivateChallengeTestCase[];
  referenceSolutionsByLanguage?: LanguageTemplate[];
}

// Written Activity (placeholder for future written assignments)
export interface WrittenActivity extends BaseActivity {
  type: 'WRITTEN';
  prompt_en: string;
  prompt_ar: string;
  maxWords?: number;
  allowFileUpload?: boolean;
}

// Discriminated union for all activity types
export type Activity =
  | TheoryActivity
  | QuizActivity
  | CodingActivity
  | WrittenActivity
  | CodeExampleActivity
  | CodeOutputActivity
  | CodeCompletionActivity
  | DebuggingActivity
  | CodeOrderingActivity
  | CodingChallengeActivity;

export interface Lesson {
  id: string;
  title_en: string;
  title_ar: string;
  type: LessonDeliveryType; // Legacy delivery format
  duration: string;
  gradeLevel: string;
  order?: number | null;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  isPublished?: boolean;
  quiz?: LessonQuiz | null;
  createdAt?: string;
  // New architecture fields (optional for backward compatibility)
  category?: LessonCategory;
  activities?: Activity[];
}

export interface GradeEntry {
  id: string;
  subject: string;
  quiz: string;
  score: number;
  date: string;
  source: 'legacy' | 'quiz';
}

export interface PerformanceRecord {
  id: string;
  studentId?: string;
  studentName?: string;
  gradeLevel?: string | null;
  lessonId?: string;
  subject?: string;
  quizTitle?: string;
  score: number;
  total: number;
  passed?: boolean;
  date?: string;
}

export interface Exam {
  id: string;
  title: string;
  gradeLevel: string;
  totalMarks: number;
  date: string;
  createdAt?: string;
}

export interface ExamResult {
  id: string;
  examId?: string;
  examTitle: string;
  studentId: string;
  studentName?: string;
  gradeLevel?: string;
  score: number;
  totalMarks: number;
  feedback?: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  gradeLevel: string;
  author: string;
  pinned: boolean;
  createdAt: string;
}

export interface ExamGradeInput {
  score: string;
  feedback: string;
}

export interface FirestoreErrorShape {
  code?: string;
  message?: string;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

export function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
