import type { Lesson, LessonCategory, Activity, ActivityType } from '@/types/models';

const ACTIVITY_TYPES: readonly ActivityType[] = [
  'THEORY',
  'QUIZ',
  'CODING',
  'WRITTEN',
  'CODE_EXAMPLE',
  'CODE_OUTPUT',
  'CODE_COMPLETION',
  'DEBUGGING',
  'CODE_ORDERING',
  'CODING_CHALLENGE',
];

const CODING_ACTIVITY_TYPES: readonly ActivityType[] = [
  'CODING',
  'CODE_EXAMPLE',
  'CODE_OUTPUT',
  'CODE_COMPLETION',
  'DEBUGGING',
  'CODE_ORDERING',
  'CODING_CHALLENGE',
];

export type ActivityRendererKind =
  | 'THEORY'
  | 'CODE_EXAMPLE'
  | 'QUIZ'
  | 'CODING_CHALLENGE'
  | 'UNKNOWN';

export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === 'string' && ACTIVITY_TYPES.includes(value as ActivityType);
}

export function isCodingActivity(activity: unknown): activity is Extract<Activity, { type: typeof CODING_ACTIVITY_TYPES[number] }> {
  return typeof activity === 'object'
    && activity !== null
    && 'type' in activity
    && CODING_ACTIVITY_TYPES.includes((activity as { type: ActivityType }).type);
}

export function isExecutableCodingActivity(activity: unknown): activity is Extract<Activity, { type: 'CODING_CHALLENGE' }> {
  return typeof activity === 'object'
    && activity !== null
    && 'type' in activity
    && (activity as { type: unknown }).type === 'CODING_CHALLENGE';
}

export function isLegacyCodingActivity(activity: unknown): activity is Extract<Activity, { type: 'CODING' }> {
  return typeof activity === 'object'
    && activity !== null
    && 'type' in activity
    && (activity as { type: unknown }).type === 'CODING';
}

export function getOrderedActivities(activities: Activity[] | null | undefined): Activity[] {
  return [...(activities ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Filters already-authorized lessons to the selected package without fetching additional lesson data. */
export function getLessonsForPackage(lessons: Lesson[], packageId: string): Lesson[] {
  return lessons.filter((lesson) => Array.isArray(lesson.packageIds)
    ? lesson.packageIds.includes(packageId)
    : lesson.packageId === packageId);
}

export function getActivityRendererKind(activity: unknown): ActivityRendererKind {
  if (typeof activity !== 'object' || activity === null || !('type' in activity)) {
    return 'UNKNOWN';
  }

  switch ((activity as { type?: unknown }).type) {
    case 'THEORY':
      return 'THEORY';
    case 'CODE_EXAMPLE':
      return 'CODE_EXAMPLE';
    case 'QUIZ':
      return 'QUIZ';
    case 'CODING_CHALLENGE':
      return 'CODING_CHALLENGE';
    default:
      return 'UNKNOWN';
  }
}

export function isActivityCompletionRequired(activity: unknown): boolean {
  if (typeof activity !== 'object' || activity === null || !('type' in activity)) {
    return false;
  }

  const type = (activity as { type?: unknown }).type;

  if (type === 'CODING_CHALLENGE') {
    return false;
  }

  return type === 'THEORY' || type === 'CODE_EXAMPLE' || type === 'QUIZ';
}

export function isLessonCompleteForActivities(
  activities: Activity[] | null | undefined,
  completedActivityIds: Set<string>
): boolean {
  const requiredActivities = getOrderedActivities(activities).filter((activity) => isActivityCompletionRequired(activity));

  if (requiredActivities.length === 0) {
    return true;
  }

  return requiredActivities.every((activity) => completedActivityIds.has(activity.id));
}

export function getLocalizedText(
  activity: { title_en?: string; title_ar?: string; content_en?: string; content_ar?: string; description_en?: string; description_ar?: string } | null | undefined,
  language: 'en' | 'ar'
): string {
  if (!activity) {
    return '';
  }

  if (language === 'ar') {
    return activity.title_ar || activity.description_ar || activity.content_ar || activity.title_en || activity.description_en || activity.content_en || '';
  }

  return activity.title_en || activity.description_en || activity.content_en || activity.title_ar || activity.description_ar || activity.content_ar || '';
}

/**
 * Derive lesson category from legacy type for backward compatibility
 */
export function deriveLessonCategoryFromLegacyType(
  legacyType: string
): LessonCategory {
  switch (legacyType) {
    case 'video':
    case 'pdf':
      return 'THEORY';
    case 'quiz_only':
      return 'ASSESSMENT';
    case 'hybrid':
      return 'HYBRID';
    default:
      return 'THEORY';
  }
}

/**
 * Check if a lesson uses the new Activity architecture
 */
export function isActivityBasedLesson(lesson: Lesson): boolean {
  return !!lesson.activities && lesson.activities.length > 0;
}

/**
 * Get activities of a specific type from a lesson
 */
export function getActivitiesByType(
  lesson: Lesson,
  activityType: ActivityType
): Activity[] {
  if (!lesson.activities) {
    return [];
  }

  return lesson.activities.filter(
    (activity) => activity.type === activityType
  );
}

const PRIVATE_CHALLENGE_DOCUMENT_KEYS = [
  'privateTestCases',
  'referenceSolutionsByLanguage',
] as const;

function omitPrivateChallengeKeys<T extends object>(value: T): T {
  const next = { ...value } as T & Record<string, unknown>;
  for (const key of PRIVATE_CHALLENGE_DOCUMENT_KEYS) {
    delete next[key];
  }
  return next;
}

export function stripPrivateChallengeSecretsFromActivities(activities: Activity[]): Activity[] {
  return activities.map((activity) => omitPrivateChallengeKeys(activity));
}

export function stripPrivateChallengeSecretsFromLesson<T extends Partial<Lesson>>(lesson: T): T {
  if (!lesson.activities) {
    return lesson;
  }

  return {
    ...lesson,
    activities: stripPrivateChallengeSecretsFromActivities(lesson.activities),
  };
}
