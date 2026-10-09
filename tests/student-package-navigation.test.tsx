import { describe, expect, it, vi } from 'vitest';
import type { Lesson } from '@/types/models';
import PackageLessonEntryButton from '@/components/student/PackageLessonEntryButton';
import { getLessonsForPackage } from '@/lib/lessonHelpers';

const lesson = (id: string, packageId: string, order: number): Lesson => ({
  id,
  packageId,
  order,
  title_en: id,
  title_ar: id,
  type: 'video',
  duration: '10 min',
  gradeLevel: 'Sec 1',
});

describe('student owned package lesson entry', () => {
  it('shows an accessible entry button only for an owned package', () => {
    const onOpen = vi.fn();
    const button = PackageLessonEntryButton({
      isOwned: true,
      packageId: 'owned-package',
      packageName: 'October',
      isArabic: true,
      onOpen,
    });

    expect(button?.type).toBe('button');
    expect(button?.props.type).toBe('button');
    expect(button?.props.children).toBe('دخول إلى الدروس');
    button?.props.onClick();
    expect(onOpen).toHaveBeenCalledWith('owned-package', 'October');

    expect(PackageLessonEntryButton({
      isOwned: false,
      packageId: 'available-package',
      packageName: 'November',
      isArabic: true,
      onOpen,
    })).toBeNull();
  });

  it('limits the selected package view to its accessible lessons and preserves their order', () => {
    const orderedAccessibleLessons = [
      lesson('first', 'owned-package', 1),
      lesson('other-package', 'different-package', 2),
      lesson('second', 'owned-package', 3),
    ];

    expect(getLessonsForPackage(orderedAccessibleLessons, 'owned-package').map(({ id }) => id))
      .toEqual(['first', 'second']);
    expect(getLessonsForPackage(orderedAccessibleLessons, 'package-without-access'))
      .toEqual([]);
  });
});
