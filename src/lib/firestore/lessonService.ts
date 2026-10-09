import {
  collection,
  doc,
  runTransaction,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { stripPrivateChallengeSecretsFromLesson } from '@/lib/lessonHelpers';
import type { Lesson, LessonCategory, Activity, ActivityType } from '@/types/models';
import { getLessonPackageIds, normalizeLessonPackageIds } from '@/lib/firestore/lessonMembership';

const normalizeLessonIds = normalizeLessonPackageIds;

/**
 * Lesson Service
 * 
 * Provides a clean service boundary for lesson-related Firestore operations.
 * Supports both legacy lesson structure and new Activity-based architecture.
 */

// ============================================================================
// LESSON QUERIES
// ============================================================================

/**
 * Fetch a single lesson by ID
 */
export async function getLessonById(lessonId: string): Promise<Lesson | null> {
  try {
    const lessonDoc = await getDoc(doc(db, 'lessons', lessonId));
    if (!lessonDoc.exists()) {
      return null;
    }
    return {
      id: lessonDoc.id,
      ...lessonDoc.data(),
    } as Lesson;
  } catch (error) {
    console.error('Error fetching lesson:', error);
    throw error;
  }
}

/**
 * Fetch all published lessons for a specific grade level
 */
export async function getPublishedLessonsByGradeLevel(
  gradeLevel: string
): Promise<Lesson[]> {
  try {
    const q = query(
      collection(db, 'lessons'),
      where('gradeLevel', '==', gradeLevel),
      where('isPublished', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Lesson[];
  } catch (error) {
    console.error('Error fetching lessons by grade level:', error);
    throw error;
  }
}

/**
 * Fetch all lessons (for teacher dashboard)
 */
export async function getAllLessons(): Promise<Lesson[]> {
  try {
    const snapshot = await getDocs(collection(db, 'lessons'));
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Lesson[];
  } catch (error) {
    console.error('Error fetching all lessons:', error);
    throw error;
  }
}

/**
 * Fetch lessons by category (new architecture)
 */
export async function getLessonsByCategory(
  category: LessonCategory,
  gradeLevel?: string
): Promise<Lesson[]> {
  try {
    const constraints = [
      where('category', '==', category),
      where('isPublished', '==', true),
    ];
    
    if (gradeLevel) {
      constraints.push(where('gradeLevel', '==', gradeLevel));
    }
    
    const q = query(collection(db, 'lessons'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Lesson[];
  } catch (error) {
    console.error('Error fetching lessons by category:', error);
    throw error;
  }
}

// ============================================================================
// LESSON MUTATIONS
// ============================================================================

/**
 * Create a new lesson
 */
export async function createLesson(lessonData: Omit<Lesson, 'id'>): Promise<string> {
  try {
    const docRef = doc(collection(db, 'lessons'));
    const now = new Date().toISOString();
    const safeLessonData = stripPrivateChallengeSecretsFromLesson(lessonData);
    const packageId = safeLessonData.packageId ?? null;
    const lesson = {
      ...safeLessonData,
      ...(packageId ? { packageIds: [packageId] } : {}),
      packageId,
      createdAt: now,
      updatedAt: now,
    };

    if (packageId) {
      await runTransaction(db, async (transaction) => {
        const packageRef = doc(db, 'coursePackages', packageId);
        const packageSnapshot = await transaction.get(packageRef);
        if (!packageSnapshot.exists()) throw new Error('Cannot assign a lesson to a missing package.');

        const packageData = packageSnapshot.data();
        if (packageData.gradeLevel !== lessonData.gradeLevel) {
          throw new Error('Lesson grade must match its course package grade.');
        }

        const lessonIds = normalizeLessonIds(packageData.lessonIds);
        transaction.set(docRef, lesson);
        transaction.update(packageRef, {
          lessonIds: lessonIds.includes(docRef.id) ? lessonIds : [...lessonIds, docRef.id],
          updatedAt: now,
        });
      });
    } else {
      await setDoc(docRef, lesson);
    }

    return docRef.id;
  } catch (error) {
    console.error('Error creating lesson:', error);
    throw error;
  }
}

/**
 * Update an existing lesson
 */
export async function updateLesson(
  lessonId: string,
  updates: Partial<Lesson>
): Promise<void> {
  try {
    const lessonRef = doc(db, 'lessons', lessonId);
    const now = new Date().toISOString();
    const safeUpdates = stripPrivateChallengeSecretsFromLesson(updates);
    const updatesPackage = Object.prototype.hasOwnProperty.call(safeUpdates, 'packageId');
    const updatesPackageIds = Object.prototype.hasOwnProperty.call(safeUpdates, 'packageIds');
    const updatesGrade = Object.prototype.hasOwnProperty.call(safeUpdates, 'gradeLevel');

    if (!updatesPackage && !updatesPackageIds && !updatesGrade) {
      await updateDoc(lessonRef, { ...safeUpdates, updatedAt: now });
      return;
    }

    await runTransaction(db, async (transaction) => {
      const lessonSnapshot = await transaction.get(lessonRef);
      if (!lessonSnapshot.exists()) throw new Error('Lesson not found.');

      const currentLesson = lessonSnapshot.data();
      const oldPackageId = typeof currentLesson.packageId === 'string' ? currentLesson.packageId : null;
      let nextPackageId = updatesPackage
        ? (typeof safeUpdates.packageId === 'string' ? safeUpdates.packageId : null)
        : oldPackageId;
      let nextPackageIds = updatesPackageIds
        ? normalizeLessonIds(safeUpdates.packageIds)
        : getLessonPackageIds(currentLesson as Pick<Lesson, 'packageId' | 'packageIds'>);
      if (updatesPackage && !updatesPackageIds) {
        if (oldPackageId && oldPackageId !== nextPackageId) {
          nextPackageIds = nextPackageIds.filter((packageId) => packageId !== oldPackageId);
        }
        if (nextPackageId) nextPackageIds = [...new Set([...nextPackageIds, nextPackageId])];
      }
      if (nextPackageIds.length > 0 && (!nextPackageId || !nextPackageIds.includes(nextPackageId))) {
        nextPackageId = nextPackageIds[0];
      }
      const nextGrade = safeUpdates.gradeLevel ?? currentLesson.gradeLevel;
      const oldPackageIds = getLessonPackageIds(currentLesson as Pick<Lesson, 'packageId' | 'packageIds'>);
      const affectedPackageIds = [...new Set([...oldPackageIds, ...nextPackageIds])];
      const packageDataById = new Map<string, Record<string, unknown>>();

      for (const packageId of affectedPackageIds) {
        const packageRef = doc(db, 'coursePackages', packageId);
        const packageSnapshot = await transaction.get(packageRef);
        if (!packageSnapshot.exists()) throw new Error('Cannot update a lesson with a missing package.');
        packageDataById.set(packageId, packageSnapshot.data());
      }

      for (const packageId of nextPackageIds) {
        if (packageDataById.get(packageId)?.gradeLevel !== nextGrade) {
          throw new Error('Lesson grade must match its course package grade.');
        }
      }

      for (const packageId of affectedPackageIds) {
        const packageRef = doc(db, 'coursePackages', packageId);
        const currentIds = normalizeLessonIds(packageDataById.get(packageId)?.lessonIds);
        const nextIds = nextPackageIds.includes(packageId)
          ? [...new Set([...currentIds, lessonId])]
          : currentIds.filter((id) => id !== lessonId);
        transaction.update(packageRef, { lessonIds: nextIds, updatedAt: now });
      }

      const shouldWritePackageIds = updatesPackageIds
        || Object.prototype.hasOwnProperty.call(currentLesson, 'packageIds')
        || Boolean(nextPackageId)
        || nextPackageIds.length > 0;
      const shouldRemovePackageIds = updatesPackage && !nextPackageId && nextPackageIds.length === 0;
      transaction.update(lessonRef, {
        ...safeUpdates,
        packageId: nextPackageId,
        ...(shouldRemovePackageIds ? { packageIds: deleteField() } : shouldWritePackageIds ? { packageIds: nextPackageIds } : {}),
        updatedAt: now,
      });
    });
  } catch (error) {
    console.error('Error updating lesson:', error);
    throw error;
  }
}

/** Add existing lesson documents to a package without changing publication state. */
export async function addLessonsToPackage(packageId: string, lessonIds: string[]): Promise<void> {
  const uniqueLessonIds = [...new Set(lessonIds.filter((lessonId) => typeof lessonId === 'string' && lessonId.length > 0))];
  if (uniqueLessonIds.length === 0) return;

  const packageRef = doc(db, 'coursePackages', packageId);
  const lessonRefs = uniqueLessonIds.map((lessonId) => doc(db, 'lessons', lessonId));
  const now = new Date().toISOString();
  await runTransaction(db, async (transaction) => {
    const packageSnapshot = await transaction.get(packageRef);
    if (!packageSnapshot.exists()) throw new Error('Course package not found.');

    const lessonSnapshots = await Promise.all(lessonRefs.map((lessonRef) => transaction.get(lessonRef)));
    const packageData = packageSnapshot.data();
    const packageLessonIds = normalizeLessonIds(packageData.lessonIds);
    const nextLessonIds = [...new Set([...packageLessonIds, ...uniqueLessonIds])];
    const lessonUpdates = lessonSnapshots.map((lessonSnapshot, index) => {
      if (!lessonSnapshot.exists()) throw new Error('Cannot assign a missing lesson to a package.');
      const lessonData = lessonSnapshot.data();
      if (lessonData.gradeLevel !== packageData.gradeLevel) {
        throw new Error('Lesson grade must match its course package grade.');
      }
      const packageIds = [...new Set([
        ...getLessonPackageIds(lessonData as Pick<Lesson, 'packageId' | 'packageIds'>),
        packageId,
      ])];
      const primaryPackageId = typeof lessonData.packageId === 'string' ? lessonData.packageId : packageId;
      return { ref: lessonRefs[index], packageIds, primaryPackageId };
    });

    for (const update of lessonUpdates) {
      transaction.update(update.ref, {
        packageId: update.primaryPackageId,
        packageIds: update.packageIds,
        updatedAt: now,
      });
    }
    transaction.update(packageRef, { lessonIds: nextLessonIds, updatedAt: now });
  });
}

/** Remove a single package reference without deleting its source lesson. */
export async function removeLessonFromPackage(packageId: string, lessonId: string): Promise<void> {
  const packageRef = doc(db, 'coursePackages', packageId);
  const lessonRef = doc(db, 'lessons', lessonId);
  const now = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    const [packageSnapshot, lessonSnapshot] = await Promise.all([
      transaction.get(packageRef),
      transaction.get(lessonRef),
    ]);
    if (!packageSnapshot.exists()) throw new Error('Course package not found.');

    const currentPackageIds = lessonSnapshot.exists()
      ? getLessonPackageIds(lessonSnapshot.data() as Pick<Lesson, 'packageId' | 'packageIds'>)
      : [];
    const nextPackageIds = currentPackageIds.filter((id) => id !== packageId);
    const lessonData = lessonSnapshot.exists() ? lessonSnapshot.data() : null;
    const currentPrimaryPackageId = lessonData && typeof lessonData.packageId === 'string'
      ? lessonData.packageId
      : packageId;
    const nextPrimaryPackageId = nextPackageIds.includes(currentPrimaryPackageId)
      ? currentPrimaryPackageId
      : nextPackageIds[0] ?? currentPrimaryPackageId;

    transaction.update(packageRef, {
      lessonIds: normalizeLessonIds(packageSnapshot.data().lessonIds).filter((id) => id !== lessonId),
      updatedAt: now,
    });
    if (lessonSnapshot.exists()) {
      transaction.update(lessonRef, {
        packageId: nextPrimaryPackageId,
        packageIds: nextPackageIds,
        updatedAt: now,
      });
    }
  });
}

/**
 * Delete a lesson
 */
export async function deleteLesson(lessonId: string): Promise<void> {
  try {
    const lessonRef = doc(db, 'lessons', lessonId);
    await runTransaction(db, async (transaction) => {
      const lessonSnapshot = await transaction.get(lessonRef);
      if (!lessonSnapshot.exists()) return;

      const packageIds = getLessonPackageIds(lessonSnapshot.data() as Pick<Lesson, 'packageId' | 'packageIds'>);
      const packageRefs = packageIds.map((packageId) => doc(db, 'coursePackages', packageId));
      const packageSnapshots = await Promise.all(packageRefs.map((packageRef) => transaction.get(packageRef)));
      const now = new Date().toISOString();
      for (let index = 0; index < packageSnapshots.length; index += 1) {
        const packageSnapshot = packageSnapshots[index];
        if (!packageSnapshot.exists()) continue;
        transaction.update(packageRefs[index], {
          lessonIds: normalizeLessonIds(packageSnapshot.data().lessonIds).filter((id) => id !== lessonId),
          updatedAt: now,
        });
      }
      transaction.delete(lessonRef);
    });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    throw error;
  }
}

/**
 * Toggle lesson publish status
 */
export async function toggleLessonPublishStatus(
  lessonId: string,
  isPublished: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'lessons', lessonId), {
      isPublished,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error toggling lesson publish status:', error);
    throw error;
  }
}

// ============================================================================
// ACTIVITY HELPERS
// ============================================================================

/**
 * Add an activity to a lesson
 * Note: The activity parameter must be a complete activity type (TheoryActivity, QuizActivity, etc.)
 * not just the base interface, due to TypeScript discriminated union requirements.
 */
export async function addActivityToLesson(
  lessonId: string,
  activity: Activity
): Promise<void> {
  try {
    const lesson = await getLessonById(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const activities = lesson.activities || [];
    const newActivity: Activity = {
      ...activity,
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: activity.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Sort activities by order
    activities.push(newActivity);
    activities.sort((a, b) => a.order - b.order);

    await updateLesson(lessonId, { activities });
  } catch (error) {
    console.error('Error adding activity to lesson:', error);
    throw error;
  }
}

/**
 * Update an activity within a lesson
 * Note: Updates must preserve the activity's type-specific fields
 */
export async function updateActivityInLesson(
  lessonId: string,
  activityId: string,
  updates: Partial<Activity>
): Promise<void> {
  try {
    const lesson = await getLessonById(lessonId);
    if (!lesson || !lesson.activities) {
      throw new Error('Lesson or activities not found');
    }

    const updatedActivities = lesson.activities.map((activity) =>
      activity.id === activityId
        ? ({ ...activity, ...updates, updatedAt: new Date().toISOString() } as Activity)
        : activity
    );

    await updateLesson(lessonId, { activities: updatedActivities });
  } catch (error) {
    console.error('Error updating activity in lesson:', error);
    throw error;
  }
}

/**
 * Remove an activity from a lesson
 */
export async function removeActivityFromLesson(
  lessonId: string,
  activityId: string
): Promise<void> {
  try {
    const lesson = await getLessonById(lessonId);
    if (!lesson || !lesson.activities) {
      throw new Error('Lesson or activities not found');
    }

    const updatedActivities = lesson.activities.filter(
      (activity) => activity.id !== activityId
    );

    await updateLesson(lessonId, { activities: updatedActivities });
  } catch (error) {
    console.error('Error removing activity from lesson:', error);
    throw error;
  }
}

/**
 * Reorder activities within a lesson
 */
export async function reorderActivitiesInLesson(
  lessonId: string,
  activityOrders: { id: string; order: number }[]
): Promise<void> {
  try {
    const lesson = await getLessonById(lessonId);
    if (!lesson || !lesson.activities) {
      throw new Error('Lesson or activities not found');
    }

    const orderMap = new Map(activityOrders.map((item) => [item.id, item.order]));
    
    const updatedActivities = lesson.activities
      .map((activity) => ({
        ...activity,
        order: orderMap.get(activity.id) ?? activity.order,
      }))
      .sort((a, b) => a.order - b.order);

    await updateLesson(lessonId, { activities: updatedActivities });
  } catch (error) {
    console.error('Error reordering activities in lesson:', error);
    throw error;
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY HELPERS
// ============================================================================

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
  return lesson.activities.filter((activity) => activity.type === activityType);
}
