import type { CoursePackage, Lesson } from '@/types/models';

export function normalizeLessonPackageIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];
}

export function getLessonPackageIds(lesson: Pick<Lesson, 'packageId' | 'packageIds'>): string[] {
  if (Array.isArray(lesson.packageIds)) {
    return normalizeLessonPackageIds(lesson.packageIds);
  }
  return typeof lesson.packageId === 'string' ? [lesson.packageId] : [];
}

export function isLessonInPackage(lesson: Pick<Lesson, 'packageId' | 'packageIds'>, packageId: string): boolean {
  return getLessonPackageIds(lesson).includes(packageId);
}

export function isLessonAccessibleToStudent(
  lesson: Pick<Lesson, 'id' | 'gradeLevel' | 'isPublished' | 'packageId' | 'packageIds'>,
  gradeLevel: string,
  ownedPackages: Array<Pick<CoursePackage, 'id' | 'gradeLevel' | 'lessonIds'>>
): boolean {
  if (lesson.isPublished !== true || lesson.gradeLevel !== gradeLevel) return false;

  const packageIds = getLessonPackageIds(lesson);
  const hasPackageReference = Array.isArray(lesson.packageIds)
    || typeof lesson.packageId === 'string';
  if (!hasPackageReference) return true;

  return ownedPackages.some((coursePackage) =>
    packageIds.includes(coursePackage.id)
    && coursePackage.gradeLevel === lesson.gradeLevel
    && Array.isArray(coursePackage.lessonIds)
    && coursePackage.lessonIds.includes(lesson.id)
  );
}
