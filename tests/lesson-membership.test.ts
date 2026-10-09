import { describe, expect, it } from 'vitest';
import { getLessonPackageIds, isLessonAccessibleToStudent, isLessonInPackage } from '@/lib/firestore/lessonMembership';
import type { CoursePackage, Lesson } from '@/types/models';

const publishedLesson: Pick<Lesson, 'id' | 'gradeLevel' | 'isPublished' | 'packageId' | 'packageIds'> = {
  id: 'lesson-a',
  gradeLevel: 'Grade 4',
  isPublished: true,
  packageId: 'package-one',
  packageIds: ['package-one', 'package-two'],
};

const ownedPackages: Array<Pick<CoursePackage, 'id' | 'gradeLevel' | 'lessonIds'>> = [
  { id: 'package-one', gradeLevel: 'Grade 4', lessonIds: ['lesson-a'] },
  { id: 'package-two', gradeLevel: 'Grade 4', lessonIds: ['lesson-a'] },
];

describe('lesson package membership', () => {
  it('reads multi-package memberships and keeps legacy packageId fallback', () => {
    expect(getLessonPackageIds(publishedLesson)).toEqual(['package-one', 'package-two']);
    expect(getLessonPackageIds({ packageId: 'legacy-package' })).toEqual(['legacy-package']);
    expect(isLessonInPackage(publishedLesson, 'package-two')).toBe(true);
  });

  it('allows entitled students to access published lessons shared by packages', () => {
    expect(isLessonAccessibleToStudent(publishedLesson, 'Grade 4', [ownedPackages[1]])).toBe(true);
  });

  it('rejects drafts even when a package lists the lesson and the student owns it', () => {
    expect(isLessonAccessibleToStudent({ ...publishedLesson, isPublished: false }, 'Grade 4', ownedPackages)).toBe(false);
  });

  it('rejects mismatched grade, missing reciprocal package reference, and explicit empty memberships', () => {
    expect(isLessonAccessibleToStudent(publishedLesson, 'Grade 5', ownedPackages)).toBe(false);
    expect(isLessonAccessibleToStudent(publishedLesson, 'Grade 4', [{ ...ownedPackages[0], lessonIds: [] }])).toBe(false);
    expect(isLessonAccessibleToStudent({ ...publishedLesson, packageIds: [] }, 'Grade 4', ownedPackages)).toBe(false);
  });

  it('keeps legacy unbundled published lessons accessible by grade', () => {
    expect(isLessonAccessibleToStudent({
      id: 'legacy-unbundled', gradeLevel: 'Grade 4', isPublished: true, packageId: null,
    }, 'Grade 4', [])).toBe(true);
  });
});
