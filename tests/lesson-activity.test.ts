import { describe, it, expect } from 'vitest';
import type {
  Lesson,
  LessonCategory,
  LessonDeliveryType,
  Activity,
  ActivityType,
  TheoryActivity,
  QuizActivity,
  CodingActivity,
  CodingChallengeActivity,
  WrittenActivity,
} from '@/types/models';
import {
  deriveLessonCategoryFromLegacyType,
  isActivityBasedLesson,
  getActivitiesByType,
  isActivityType,
  isCodingActivity,
  isExecutableCodingActivity,
  isLegacyCodingActivity,
  getOrderedActivities,
  getActivityRendererKind,
  isActivityCompletionRequired,
  isLessonCompleteForActivities,
  getLocalizedText,
  stripPrivateChallengeSecretsFromLesson,
} from '@/lib/lessonHelpers';
import { PROGRAMMING_LANGUAGES } from '@/lib/coding/languages';
import {
  validateCodingActivity,
  validateCodingChallenge,
  validateLanguageTemplate,
  validateProgrammingLanguageId,
  validatePublicTestCase,
} from '@/lib/coding/validation';
import { validateActivityList } from '@/components/teacher/ActivityBuilder';

const createCodingChallenge = (): CodingChallengeActivity => ({
  id: 'coding-challenge-1',
  type: 'CODING_CHALLENGE',
  title_en: 'Age classifier',
  title_ar: 'Age classifier',
  order: 1,
  isPublished: true,
  challengeVersion: 1,
  allowedLanguages: ['cpp17', 'python3'],
  defaultLanguage: 'cpp17',
  starterCodeByLanguage: [
    { language: 'cpp17', starterCode: PROGRAMMING_LANGUAGES.cpp17.defaultStarterCode },
    { language: 'python3', starterCode: PROGRAMMING_LANGUAGES.python3.defaultStarterCode },
  ],
  problem_en: 'Read an age and print Adult or Minor.',
  problem_ar: 'Read an age and print Adult or Minor.',
  publicTestCases: [
    { id: 'public-1', input: '20', expectedOutput: 'Adult' },
  ],
  difficulty: 'beginner',
});

describe('Lesson + Activity Architecture', () => {
  describe('Student lesson player compatibility', () => {
    it('orders activities by their defined order and ignores legacy lessons', () => {
      const lesson: Lesson = {
        id: 'lesson-player-1',
        title_en: 'Activity Sequence',
        title_ar: 'تسلسل الأنشطة',
        type: 'video',
        duration: '15 min',
        gradeLevel: 'Grade 5',
        order: 1,
        isPublished: true,
        activities: [
          { id: 'a-3', type: 'QUIZ', title_en: 'Quiz', title_ar: 'اختبار', order: 3, isPublished: true, quiz: { questions: [] } },
          { id: 'a-1', type: 'THEORY', title_en: 'Theory', title_ar: 'نظرية', order: 1, isPublished: true, content_en: 'Hello', content_ar: 'مرحبا' },
          { id: 'a-2', type: 'CODE_EXAMPLE', title_en: 'Example', title_ar: 'مثال', order: 2, isPublished: true, language: 'python3', sourceCode: 'print(1)' },
        ],
      };

      expect(getOrderedActivities(lesson.activities || [])).toHaveLength(3);
      expect(getOrderedActivities(lesson.activities || [])[0].id).toBe('a-1');
      expect(getOrderedActivities(lesson.activities || [])[2].id).toBe('a-3');
      expect(isActivityBasedLesson(lesson)).toBe(true);
      expect(isActivityBasedLesson({ ...lesson, activities: undefined })).toBe(false);
    });

    it('recognizes supported renderers and unknown future activity types', () => {
      expect(getActivityRendererKind({
        id: 't', type: 'THEORY', title_en: 'T', title_ar: 'ت', order: 1, isPublished: true, content_en: 'x', content_ar: 'ي'
      })).toBe('THEORY');
      expect(getActivityRendererKind({
        id: 'e', type: 'CODE_EXAMPLE', title_en: 'E', title_ar: 'م', order: 1, isPublished: true, language: 'python3', sourceCode: 'print(1)'
      })).toBe('CODE_EXAMPLE');
      expect(getActivityRendererKind({
        id: 'qa', type: 'QUIZ', title_en: 'Q', title_ar: 'س', order: 1, isPublished: true, quiz: { questions: [] }
      })).toBe('QUIZ');
      expect(getActivityRendererKind({
        id: 'cc', type: 'CODING_CHALLENGE', title_en: 'C', title_ar: 'ت', order: 1, isPublished: true, challengeVersion: 1, allowedLanguages: ['python3'], defaultLanguage: 'python3', starterCodeByLanguage: [{ language: 'python3', starterCode: 'print(1)' }], problem_en: 'x', problem_ar: 'ي', publicTestCases: [], difficulty: 'beginner'
      })).toBe('CODING_CHALLENGE');
      expect(getActivityRendererKind({
        id: 'future', type: 'DEBUGGING', title_en: 'Future', title_ar: 'مستقبلي', order: 1, isPublished: true, language: 'python3', brokenCode: 'x', defects: []
      })).toBe('UNKNOWN');
    });

    it('preserves legacy lesson compatibility while allowing activity sequences', () => {
      const legacyLesson: Lesson = {
        id: 'legacy-1',
        title_en: 'Legacy Lesson',
        title_ar: 'درس قديم',
        type: 'hybrid',
        duration: '20 min',
        gradeLevel: 'Grade 4',
        order: 1,
        videoUrl: 'https://example.com/video',
        pdfUrl: 'https://example.com/guide',
        quiz: {
          quizTitle_en: 'Legacy Quiz',
          quizTitle_ar: 'اختبار قديم',
          questions: [],
        },
      };

      expect(isActivityBasedLesson(legacyLesson)).toBe(false);
      expect(deriveLessonCategoryFromLegacyType('hybrid')).toBe('HYBRID');
      expect(getOrderedActivities(legacyLesson.activities || [])).toEqual([]);
    });

    it('treats theory and code example as explicit completion activities, and challenge as view-only', () => {
      const theory: Activity = { id: 't', type: 'THEORY', title_en: 'Theory', title_ar: 'نظرية', order: 1, isPublished: true, content_en: 'A', content_ar: 'أ', };
      const example: Activity = { id: 'ce', type: 'CODE_EXAMPLE', title_en: 'Example', title_ar: 'مثال', order: 2, isPublished: true, language: 'python3', sourceCode: 'print(1)' };
      const challenge: Activity = { id: 'cc', type: 'CODING_CHALLENGE', title_en: 'Challenge', title_ar: 'تمرين', order: 3, isPublished: true, challengeVersion: 1, allowedLanguages: ['python3'], defaultLanguage: 'python3', starterCodeByLanguage: [{ language: 'python3', starterCode: 'print(1)' }], problem_en: 'Solve this', problem_ar: 'حل هذا', publicTestCases: [], difficulty: 'beginner' };

      expect(isActivityCompletionRequired(theory)).toBe(true);
      expect(isActivityCompletionRequired(example)).toBe(true);
      expect(isActivityCompletionRequired(challenge)).toBe(false);
      expect(isLessonCompleteForActivities([theory, example, challenge], new Set(['t', 'ce']))).toBe(true);
      expect(isLessonCompleteForActivities([theory, example, challenge], new Set(['t']))).toBe(false);
    });

    it('supports future unknown activity handling without crashing and keeps locale-aware text', () => {
      const future: Activity = {
        id: 'future',
        type: 'DEBUGGING',
        title_en: 'Debugging',
        title_ar: 'تصحيح',
        order: 1,
        isPublished: true,
        language: 'python3',
        brokenCode: 'print(1)',
        defects: [{ id: 'd1', description_en: 'Broken', description_ar: 'مكسور' }],
      } as Activity;

      expect(getActivityRendererKind(future)).toBe('UNKNOWN');
      expect(getLocalizedText(future, 'ar')).toBe('تصحيح');
      expect(getLocalizedText(future, 'en')).toBe('Debugging');
    });
  });
  describe('Lesson Model', () => {
    it('should accept legacy lesson structure without new fields', () => {
      const legacyLesson: Lesson = {
        id: 'lesson-1',
        title_en: 'Introduction to Algorithms',
        title_ar: 'مقدمة في الخوارزميات',
        type: 'video' as LessonDeliveryType,
        duration: '45 min',
        gradeLevel: 'Grade 4',
        order: 1,
        videoUrl: 'https://youtube.com/...',
        isPublished: true,
        quiz: null,
      };

      expect(legacyLesson.id).toBe('lesson-1');
      expect(legacyLesson.category).toBeUndefined();
      expect(legacyLesson.activities).toBeUndefined();
    });

    it('should accept new architecture with category and activities', () => {
      const modernLesson: Lesson = {
        id: 'lesson-2',
        title_en: 'Data Structures',
        title_ar: 'هياكل البيانات',
        type: 'hybrid' as LessonDeliveryType,
        duration: '60 min',
        gradeLevel: 'Grade 5',
        order: 2,
        videoUrl: null,
        pdfUrl: null,
        isPublished: true,
        quiz: null,
        category: 'PRACTICAL' as LessonCategory,
        activities: [],
      };

      expect(modernLesson.category).toBe('PRACTICAL');
      expect(modernLesson.activities).toBeDefined();
      expect(modernLesson.activities).toEqual([]);
    });

    it('should support all lesson categories', () => {
      const categories: LessonCategory[] = ['THEORY', 'PRACTICAL', 'HYBRID', 'ASSESSMENT'];
      
      categories.forEach((category) => {
        const lesson: Lesson = {
          id: `lesson-${category}`,
          title_en: 'Test Lesson',
          title_ar: 'درس اختبار',
          type: 'video' as LessonDeliveryType,
          duration: '30 min',
          gradeLevel: 'Grade 4',
          isPublished: true,
          category,
        };
        expect(lesson.category).toBe(category);
      });
    });
  });

  describe('Activity Model', () => {
    it('should create a valid TheoryActivity', () => {
      const theoryActivity: TheoryActivity = {
        id: 'activity-1',
        type: 'THEORY',
        title_en: 'Introduction',
        title_ar: 'مقدمة',
        description_en: 'Basic concepts',
        description_ar: 'مفاهيم أساسية',
        order: 1,
        isPublished: true,
        content_en: 'This is the theory content in English.',
        content_ar: 'هذا هو المحتوى النظري بالعربية.',
      };

      expect(theoryActivity.type).toBe('THEORY');
      expect(theoryActivity.content_en).toBeDefined();
      expect(theoryActivity.content_ar).toBeDefined();
    });

    it('should create a valid QuizActivity', () => {
      const quizActivity: QuizActivity = {
        id: 'activity-2',
        type: 'QUIZ',
        title_en: 'Knowledge Check',
        title_ar: 'اختبار المعرفة',
        order: 2,
        isPublished: true,
        quiz: {
          quizTitle_en: 'Quiz 1',
          quizTitle_ar: 'اختبار 1',
          questions: [
            {
              en: 'What is 2+2?',
              ar: 'ما هو 2+2؟',
              options: [
                { en: '3', ar: '3' },
                { en: '4', ar: '4' },
                { en: '5', ar: '5' },
                { en: '6', ar: '6' },
              ],
              correct: 1,
            },
          ],
        },
        passingScore: 70,
      };

      expect(quizActivity.type).toBe('QUIZ');
      expect(quizActivity.quiz).toBeDefined();
      expect(quizActivity.passingScore).toBe(70);
    });

    it('should create a valid CodingActivity', () => {
      const codingActivity: CodingActivity = {
        id: 'activity-3',
        type: 'CODING',
        title_en: 'Hello World',
        title_ar: 'مرحبا بالعالم',
        order: 3,
        isPublished: true,
        starterCode: 'print("Hello World")',
        expectedOutput: 'Hello World',
        language: 'python',
        difficulty: 'beginner',
      };

      expect(codingActivity.type).toBe('CODING');
      expect(codingActivity.starterCode).toBeDefined();
      expect(codingActivity.difficulty).toBe('beginner');
    });

    it('should create a valid WrittenActivity', () => {
      const writtenActivity: WrittenActivity = {
        id: 'activity-4',
        type: 'WRITTEN',
        title_en: 'Essay',
        title_ar: 'مقال',
        order: 4,
        isPublished: true,
        prompt_en: 'Write about algorithms.',
        prompt_ar: 'اكتب عن الخوارزميات.',
        maxWords: 500,
        allowFileUpload: false,
      };

      expect(writtenActivity.type).toBe('WRITTEN');
      expect(writtenActivity.prompt_en).toBeDefined();
      expect(writtenActivity.maxWords).toBe(500);
    });

    it('should support discriminated union type checking', () => {
      const activities: Activity[] = [
        {
          id: 'a1',
          type: 'THEORY',
          title_en: 'Theory',
          title_ar: 'نظري',
          order: 1,
          isPublished: true,
          content_en: 'Content',
          content_ar: 'محتوى',
        },
        {
          id: 'a2',
          type: 'QUIZ',
          title_en: 'Quiz',
          title_ar: 'اختبار',
          order: 2,
          isPublished: true,
          quiz: {
            quizTitle_en: 'Q',
            quizTitle_ar: 'اختبار',
            questions: [],
          },
        },
      ];

      activities.forEach((activity) => {
        if (activity.type === 'THEORY') {
          expect(activity.content_en).toBeDefined();
        } else if (activity.type === 'QUIZ') {
          expect(activity.quiz).toBeDefined();
        }
      });
    });
  });

  describe('Teacher Lesson Builder Validation', () => {
    it('should accept a valid coding challenge activity authored with the C++17-only default flow', () => {
      const activity: CodingChallengeActivity = {
        id: 'activity-builder-1',
        type: 'CODING_CHALLENGE',
        title_en: 'Age classifier',
        title_ar: 'تصنيف العمر',
        description_en: 'Decide if someone is an adult.',
        description_ar: 'تحديد ما إذا كان الشخص بالغًا أم لا.',
        order: 1,
        isPublished: true,
        challengeVersion: 1,
        allowedLanguages: ['cpp17'],
        defaultLanguage: 'cpp17',
        starterCodeByLanguage: [
          { language: 'cpp17', starterCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n  int age;\n  cin >> age;\n  cout << (age >= 18 ? "Adult" : "Minor");\n  return 0;\n}\n' },
        ],
        problem_en: 'Read an age and print Adult or Minor.',
        problem_ar: 'اقرأ العمر ثم اطبع Adult أو Minor.',
        inputDescription_en: 'The age as an integer.',
        inputDescription_ar: 'العمر كعدد صحيح.',
        outputDescription_en: 'Print Adult or Minor.',
        outputDescription_ar: 'اطبع Adult أو Minor.',
        constraints_en: 'Age is between 0 and 120.',
        constraints_ar: 'العمر بين 0 و120.',
        publicTestCases: [
          { id: 'public-1', input: '20', expectedOutput: 'Adult' },
          { id: 'public-2', input: '15', expectedOutput: 'Minor' },
        ],
        difficulty: 'beginner',
        maxAttempts: 3,
        timeLimitMs: 1000,
        memoryLimitMb: 256,
      };

      expect(validateActivityList([activity])).toEqual([]);
    });

    it('should reject an invalid coding challenge activity before saving', () => {
      const activity: CodingChallengeActivity = {
        id: 'activity-builder-2',
        type: 'CODING_CHALLENGE',
        title_en: 'Broken Challenge',
        title_ar: 'تحدي غير صحيح',
        order: 1,
        isPublished: true,
        challengeVersion: 1,
        allowedLanguages: ['cpp17'],
        defaultLanguage: 'cpp17',
        starterCodeByLanguage: [],
        problem_en: '',
        problem_ar: 'تحدي',
        publicTestCases: [],
        difficulty: 'invalid' as never,
      };

      const invalidActivity = { ...activity, difficulty: 'invalid' as never };
      expect(validateActivityList([invalidActivity])).not.toEqual([]);
    });
  });

  describe('Backward Compatibility Helpers', () => {
    it('should derive THEORY category from video type', () => {
      expect(deriveLessonCategoryFromLegacyType('video')).toBe('THEORY');
    });

    it('should derive THEORY category from pdf type', () => {
      expect(deriveLessonCategoryFromLegacyType('pdf')).toBe('THEORY');
    });

    it('should derive ASSESSMENT category from quiz_only type', () => {
      expect(deriveLessonCategoryFromLegacyType('quiz_only')).toBe('ASSESSMENT');
    });

    it('should derive HYBRID category from hybrid type', () => {
      expect(deriveLessonCategoryFromLegacyType('hybrid')).toBe('HYBRID');
    });

    it('should default to THEORY for unknown types', () => {
      expect(deriveLessonCategoryFromLegacyType('unknown' as LessonDeliveryType)).toBe('THEORY');
    });

    it('should identify activity-based lessons', () => {
      const lessonWithActivities: Lesson = {
        id: 'lesson-1',
        title_en: 'Test',
        title_ar: 'اختبار',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Grade 4',
        isPublished: true,
        activities: [
          {
            id: 'a1',
            type: 'THEORY',
            title_en: 'Theory',
            title_ar: 'نظري',
            order: 1,
            isPublished: true,
            content_en: 'Content',
            content_ar: 'محتوى',
          },
        ],
      };

      expect(isActivityBasedLesson(lessonWithActivities)).toBe(true);
    });

    it('should identify non-activity-based lessons', () => {
      const lessonWithoutActivities: Lesson = {
        id: 'lesson-2',
        title_en: 'Test',
        title_ar: 'اختبار',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Grade 4',
        isPublished: true,
      };

      expect(isActivityBasedLesson(lessonWithoutActivities)).toBe(false);
    });

    it('should filter activities by type', () => {
      const lesson: Lesson = {
        id: 'lesson-1',
        title_en: 'Test',
        title_ar: 'اختبار',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Grade 4',
        isPublished: true,
        activities: [
          {
            id: 'a1',
            type: 'THEORY',
            title_en: 'Theory 1',
            title_ar: 'نظري 1',
            order: 1,
            isPublished: true,
            content_en: 'Content',
            content_ar: 'محتوى',
          },
          {
            id: 'a2',
            type: 'THEORY',
            title_en: 'Theory 2',
            title_ar: 'نظري 2',
            order: 2,
            isPublished: true,
            content_en: 'Content',
            content_ar: 'محتوى',
          },
          {
            id: 'a3',
            type: 'QUIZ',
            title_en: 'Quiz',
            title_ar: 'اختبار',
            order: 3,
            isPublished: true,
            quiz: {
              quizTitle_en: 'Q',
              quizTitle_ar: 'اختبار',
              questions: [],
            },
          },
        ],
      };

      const theoryActivities = getActivitiesByType(lesson, 'THEORY');
      const quizActivities = getActivitiesByType(lesson, 'QUIZ');
      const codingActivities = getActivitiesByType(lesson, 'CODING');

      expect(theoryActivities.length).toBe(2);
      expect(quizActivities.length).toBe(1);
      expect(codingActivities.length).toBe(0);
    });
  });

  describe('Activity Ordering', () => {
    it('should maintain deterministic ordering', () => {
      const activities: Activity[] = [
        {
          id: 'a3',
          type: 'THEORY',
          title_en: 'Third',
          title_ar: 'الثالث',
          order: 3,
          isPublished: true,
          content_en: 'Content',
          content_ar: 'محتوى',
        },
        {
          id: 'a1',
          type: 'THEORY',
          title_en: 'First',
          title_ar: 'الأول',
          order: 1,
          isPublished: true,
          content_en: 'Content',
          content_ar: 'محتوى',
        },
        {
          id: 'a2',
          type: 'THEORY',
          title_en: 'Second',
          title_ar: 'الثاني',
          order: 2,
          isPublished: true,
          content_en: 'Content',
          content_ar: 'محتوى',
        },
      ];

      const sorted = [...activities].sort((a, b) => a.order - b.order);

      expect(sorted[0].order).toBe(1);
      expect(sorted[1].order).toBe(2);
      expect(sorted[2].order).toBe(3);
    });
  });

  describe('Coding Activity Foundation', () => {
    it('recognizes explicit coding activity types while preserving legacy CODING', () => {
      const codingTypes: ActivityType[] = [
        'CODING',
        'CODE_EXAMPLE',
        'CODE_OUTPUT',
        'CODE_COMPLETION',
        'DEBUGGING',
        'CODE_ORDERING',
        'CODING_CHALLENGE',
      ];
      const legacyCoding: CodingActivity = {
        id: 'legacy-coding',
        type: 'CODING',
        title_en: 'Legacy coding',
        title_ar: 'Legacy coding',
        order: 1,
        isPublished: true,
        language: 'python',
      };

      codingTypes.forEach((type) => expect(isActivityType(type)).toBe(true));
      expect(isActivityType('UNKNOWN')).toBe(false);
      expect(isCodingActivity(legacyCoding)).toBe(true);
      expect(isLegacyCodingActivity(legacyCoding)).toBe(true);
      expect(isExecutableCodingActivity(legacyCoding)).toBe(false);
      expect(isExecutableCodingActivity(createCodingChallenge())).toBe(true);
    });

    it('accepts the stable language catalog and rejects unknown language IDs', () => {
      Object.keys(PROGRAMMING_LANGUAGES).forEach((language) => {
        expect(validateProgrammingLanguageId(language)).toBe(true);
      });
      expect(validateProgrammingLanguageId('python')).toBe(false);
      expect(validateProgrammingLanguageId('ruby3')).toBe(false);
    });

    it('validates language templates', () => {
      expect(validateLanguageTemplate({ language: 'cpp17', starterCode: 'int main() {}' }).valid).toBe(true);
      expect(validateLanguageTemplate({ language: 'ruby3', starterCode: 'puts 1' }).valid).toBe(false);
      expect(validateLanguageTemplate({ language: 'cpp17', starterCode: '' }).valid).toBe(false);
    });

    it('accepts a valid public coding challenge without private configuration', () => {
      const challenge = createCodingChallenge();

      expect(validateCodingChallenge(challenge).valid).toBe(true);
      expect(validateCodingActivity(challenge).valid).toBe(true);
      expect(challenge).not.toHaveProperty('privateTestCases');
      expect(challenge).not.toHaveProperty('referenceSolutionsByLanguage');
    });

    it('strips hidden tests and reference solutions before lesson persistence', () => {
      const challenge = {
        ...createCodingChallenge(),
        privateTestCases: [{ id: 'hidden-1', input: '1', expectedOutput: '1' }],
        referenceSolutionsByLanguage: [{ language: 'cpp17' as const, starterCode: 'int main() {}' }],
      };
      const lesson: Lesson = {
        id: 'lesson-secret',
        title_en: 'Lesson',
        title_ar: 'Lesson',
        type: 'hybrid',
        duration: '10m',
        gradeLevel: 'Grade 4',
        activities: [challenge],
      };

      const sanitized = stripPrivateChallengeSecretsFromLesson(lesson);
      expect(sanitized.activities?.[0]).not.toHaveProperty('privateTestCases');
      expect(sanitized.activities?.[0]).not.toHaveProperty('referenceSolutionsByLanguage');
      expect(sanitized.activities?.[0]).toHaveProperty('publicTestCases');
    });

    it('rejects a coding challenge with an empty problem statement', () => {
      expect(validateCodingChallenge({ ...createCodingChallenge(), problem_en: '' }).valid).toBe(false);
    });

    it('rejects invalid coding challenge difficulty and limits', () => {
      expect(validateCodingChallenge({ ...createCodingChallenge(), difficulty: 'expert' }).valid).toBe(false);
      expect(validateCodingChallenge({ ...createCodingChallenge(), timeLimitMs: -1 }).valid).toBe(false);
      expect(validateCodingChallenge({ ...createCodingChallenge(), maxAttempts: 1.5 }).valid).toBe(false);
    });

    it('rejects malformed public test cases', () => {
      expect(validatePublicTestCase({ id: 'bad', input: 7, expectedOutput: '7' }).valid).toBe(false);
      expect(validateCodingChallenge({
        ...createCodingChallenge(),
        publicTestCases: [{ id: 'bad', input: 7, expectedOutput: '7' }],
      }).valid).toBe(false);
    });

    it('rejects duplicate language templates and a missing default starter template', () => {
      const challenge = createCodingChallenge();
      expect(validateCodingChallenge({
        ...challenge,
        starterCodeByLanguage: [
          { language: 'cpp17', starterCode: 'int main() {}' },
          { language: 'cpp17', starterCode: 'int main() { return 0; }' },
        ],
      }).valid).toBe(false);
      expect(validateCodingChallenge({
        ...challenge,
        starterCodeByLanguage: [{ language: 'python3', starterCode: 'print(1)' }],
      }).valid).toBe(false);
    });

    it('validates non-executable coding activities without changing legacy behavior', () => {
      expect(validateCodingActivity({
        id: 'example-1',
        type: 'CODE_EXAMPLE',
        title_en: 'Example',
        title_ar: 'Example',
        order: 1,
        isPublished: true,
        language: 'python3',
        sourceCode: 'print("MASRIA")',
      }).valid).toBe(true);
      expect(validateCodingActivity({
        id: 'example-2',
        type: 'CODE_EXAMPLE',
        title_en: 'Example',
        title_ar: 'Example',
        order: 1,
        isPublished: true,
        language: 'python3',
        sourceCode: '',
      }).valid).toBe(false);
      expect(validateCodingActivity({ type: 'CODING', language: 'python' }).valid).toBe(true);
    });
  });
});
