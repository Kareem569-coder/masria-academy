import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CoursePackage, PackageAccessCode, StudentPackageAccess, Lesson } from '@/types/models';
import { getLessonPackageIds, isLessonAccessibleToStudent } from '@/lib/firestore/lessonMembership';

const normalizePackageIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

const sortPackages = (packages: CoursePackage[]) =>
  [...packages].sort((a, b) => {
    const aOrder = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

/**
 * Package Service
 *
 * Provides a clean service boundary for course package and access code operations.
 * Monthly packages are permanent purchases and do not expire.
 */

export async function createCoursePackage(
  packageData: Omit<CoursePackage, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const definedPackageData = Object.fromEntries(
      Object.entries(packageData).filter(([, value]) => value !== undefined)
    );
    const docRef = await addDoc(collection(db, 'coursePackages'), {
      ...definedPackageData,
      lessonIds: normalizePackageIds(packageData.lessonIds),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating course package:', error);
    throw error;
  }
}

export async function getCoursePackageById(packageId: string): Promise<CoursePackage | null> {
  try {
    const packageDoc = await getDoc(doc(db, 'coursePackages', packageId));
    if (!packageDoc.exists()) {
      return null;
    }
    return {
      id: packageDoc.id,
      ...packageDoc.data(),
    } as CoursePackage;
  } catch (error) {
    console.error('Error fetching course package:', error);
    throw error;
  }
}

export async function getActivePackagesByGradeLevel(gradeLevel: string): Promise<CoursePackage[]> {
  try {
    const q = query(collection(db, 'coursePackages'),
      where('gradeLevel', '==', gradeLevel),
      where('isActive', '==', true),
    );
    const snapshot = await getDocs(q);
    return sortPackages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CoursePackage[]);
  } catch (error) {
    console.error('Error fetching packages by grade level:', error);
    throw error;
  }
}

export async function getAllCoursePackages(): Promise<CoursePackage[]> {
  try {
    const snapshot = await getDocs(collection(db, 'coursePackages'));
    return sortPackages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CoursePackage[]);
  } catch (error) {
    console.error('Error fetching all course packages:', error);
    throw error;
  }
}

export async function updateCoursePackage(
  packageId: string,
  updates: Omit<Partial<CoursePackage>, 'lessonIds'>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'coursePackages', packageId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating course package:', error);
    throw error;
  }
}

export async function deactivateCoursePackage(packageId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'coursePackages', packageId), {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error deactivating course package:', error);
    throw error;
  }
}

export async function deleteCoursePackage(packageId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'coursePackages', packageId));
  } catch (error) {
    console.error('Error deleting course package:', error);
    throw error;
  }
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `MASRIA-${segment()}-${segment()}`;
}

export async function generatePackageAccessCodes(
  packageId: string,
  quantity = 1
): Promise<PackageAccessCode[]> {
  try {
    const count = Math.min(Math.max(1, quantity), 50);
    const createdAtBase = new Date().toISOString();
    const generated: PackageAccessCode[] = [];

    for (let index = 0; index < count; index += 1) {
      const code = generateAccessCode();
      const createdAt = index === 0 ? createdAtBase : new Date().toISOString();
      const docRef = doc(db, 'packageAccessCodes', code);
      await setDoc(docRef, {
        code,
        packageId,
        active: true,
        status: 'unused',
        createdAt,
        updatedAt: createdAt,
        usedBy: null,
        usedAt: null,
      });

      generated.push({
        id: code,
        code,
        packageId,
        active: true,
        status: 'unused',
        createdAt,
        updatedAt: createdAt,
        usedBy: undefined,
        usedAt: undefined,
      });
    }

    return generated;
  } catch (error) {
    console.error('Error generating package access codes:', error);
    throw error;
  }
}

export async function generatePackageAccessCode(packageId: string): Promise<PackageAccessCode> {
  const [code] = await generatePackageAccessCodes(packageId, 1);
  return code;
}

export async function disablePackageAccessCode(codeId: string): Promise<void> {
  try {
    const codeRef = doc(db, 'packageAccessCodes', codeId);
    const codeDoc = await getDoc(codeRef);
    if (!codeDoc.exists()) {
      return;
    }

    const now = new Date().toISOString();
    await updateDoc(codeRef, {
      active: false,
      status: 'disabled',
      disabledAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error disabling access code:', error);
    throw error;
  }
}

export async function getAccessCodesByPackage(packageId: string): Promise<PackageAccessCode[]> {
  try {
    const q = query(
      collection(db, 'packageAccessCodes'),
      where('packageId', '==', packageId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })) as PackageAccessCode[];
  } catch (error) {
    console.error('Error fetching access codes:', error);
    throw error;
  }
}

export async function getStudentPackageAccesses(studentId: string): Promise<StudentPackageAccess[]> {
  try {
    const q = query(
      collection(db, 'studentPackageAccess'),
      where('studentId', '==', studentId),
      orderBy('activatedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })) as StudentPackageAccess[];
  } catch (error) {
    console.error('Error fetching student package access:', error);
    throw error;
  }
}

export async function getPackageOwnership(
  packageId: string
): Promise<Array<StudentPackageAccess & { studentName?: string; email?: string; gradeLevel?: string }>> {
  try {
    const q = query(
      collection(db, 'studentPackageAccess'),
      where('packageId', '==', packageId),
      orderBy('activatedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const records = await Promise.all(
      snapshot.docs.map(async (document) => {
        const data = document.data() as StudentPackageAccess;
        let studentDoc;
        try {
          studentDoc = await getDoc(doc(db, 'users', data.studentId));
        } catch (error) {
          throw error;
        }
        const studentData = studentDoc.exists() ? (studentDoc.data() as { name?: string; email?: string; gradeLevel?: string }) : undefined;

        const { id: _unusedId, ...rest } = data;
        return {
          ...rest,
          id: document.id,
          studentName: studentData?.name,
          email: studentData?.email,
          gradeLevel: studentData?.gradeLevel,
        };
      })
    );

    return records;
  } catch (error) {
    console.error('Error fetching package ownership:', error);
    throw error;
  }
}

export async function studentHasPackageAccess(studentId: string, packageId: string): Promise<boolean> {
  try {
    const accessRecords = await getStudentPackageAccesses(studentId);
    return accessRecords.some((access) => access.packageId === packageId && access.status === 'active');
  } catch (error) {
    console.error('Error checking package access:', error);
    return false;
  }
}

export async function redeemPackageAccessCode(
  code: string,
  studentId: string,
  studentGradeLevel: string
): Promise<{ success: boolean; packageId?: string; error?: string }> {
  try {
    const normalizedCode = code.trim().toUpperCase();
    return await runTransaction(db, async (transaction) => {
      const codeRef = doc(db, 'packageAccessCodes', normalizedCode);
      const codeDoc = await transaction.get(codeRef);

      if (!codeDoc.exists()) {
        return { success: false, error: 'Invalid access code' };
      }

      const codeData = codeDoc.data() as PackageAccessCode;
      if (codeData.status === 'used' || codeData.usedBy) {
        return { success: false, error: 'Access code has already been used' };
      }
      if (!codeData.active || codeData.status === 'disabled') {
        return { success: false, error: 'Access code is unavailable' };
      }

      const packageRef = doc(db, 'coursePackages', codeData.packageId);
      const studentRef = doc(db, 'users', studentId);
      const packageDoc = await transaction.get(packageRef);
      const studentDoc = await transaction.get(studentRef);

      if (!packageDoc.exists()) {
        return { success: false, error: 'Package not found' };
      }
      if (!studentDoc.exists()) {
        return { success: false, error: 'Student not found' };
      }

      const packageData = packageDoc.data() as CoursePackage;
      const studentData = studentDoc.data() as { role?: string; status?: string; gradeLevel?: string; accessiblePackageIds?: string[] };
      if (studentData.role !== 'student' || studentData.status !== 'active') {
        return { success: false, error: 'Active student account required' };
      }
      if (packageData.gradeLevel !== studentGradeLevel || studentData.gradeLevel !== studentGradeLevel) {
        return { success: false, error: 'Access code is for a different grade level' };
      }
      if (!packageData.isActive) {
        return { success: false, error: 'Package is not active' };
      }

      const accessiblePackageIds = normalizePackageIds(studentData.accessiblePackageIds);
      const accessDocRef = doc(db, 'studentPackageAccess', `${studentId}_${codeData.packageId}`);
      if (accessiblePackageIds.includes(codeData.packageId)) {
        return { success: false, error: 'You already have access to this package' };
      }

      const now = new Date().toISOString();
      transaction.update(codeRef, {
        active: false,
        status: 'used',
        usedBy: studentId,
        usedAt: now,
        updatedAt: now,
      });
      transaction.set(accessDocRef, {
        id: accessDocRef.id,
        studentId,
        packageId: codeData.packageId,
        codeId: normalizedCode,
        activatedAt: now,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      transaction.update(studentRef, {
        accessiblePackageIds: [...accessiblePackageIds, codeData.packageId],
        lastRedeemedAccessCode: normalizedCode,
        updatedAt: now,
      });

      return { success: true, packageId: codeData.packageId };
    });
  } catch (error) {
    console.error('Error redeeming access code:', error);
    return { success: false, error: 'Failed to redeem access code' };
  }
}

export async function getStudentPackages(studentId: string): Promise<CoursePackage[]> {
  try {
    const accessRecords = await getStudentPackageAccesses(studentId);
    const packageIds = [...new Set(accessRecords
      .filter((access) => access.status === 'active')
      .map((access) => access.packageId))];
    if (packageIds.length === 0) return [];

    const batches = packageIds.reduce<string[][]>((all, packageId) => {
      const last = all[all.length - 1];
      if (!last || last.length >= 10) {
        all.push([packageId]);
      } else {
        last.push(packageId);
      }
      return all;
    }, [] as string[][]);

    const results = await Promise.all(
      batches.map(async (batch) => {
        const q = query(collection(db, 'coursePackages'), where('__name__', 'in', batch));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((document) => ({ id: document.id, ...document.data() })) as CoursePackage[];
      })
    );

    return sortPackages(results.flat());
  } catch (error) {
    console.error('Error fetching student packages:', error);
    throw error;
  }
}

export async function getLessonsByPackage(packageId: string): Promise<Lesson[]> {
  try {
    const coursePackage = await getCoursePackageById(packageId);
    if (!coursePackage) return [];
    const lessonIds = normalizePackageIds(coursePackage.lessonIds);
    const snapshots = await Promise.all(lessonIds.map(async (lessonId) => {
      try {
        return await getDoc(doc(db, 'lessons', lessonId));
      } catch {
        return null;
      }
    }));
    return snapshots
      .flatMap((snapshot) => snapshot?.exists() ? [{ id: snapshot.id, ...snapshot.data() } as Lesson] : [])
      .filter((lesson) => lesson.isPublished === true && getLessonPackageIds(lesson).includes(packageId))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (error) {
    console.error('Error fetching lessons by package:', error);
    throw error;
  }
}

export async function hasLessonAccess(studentId: string, lesson: Lesson): Promise<boolean> {
  try {
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    if (!studentDoc.exists()) return false;
    const studentData = studentDoc.data() as { gradeLevel?: string; role?: string; status?: string };
    if (studentData.role !== 'student' || studentData.status !== 'active') return false;
    const ownedPackages = await getStudentPackages(studentId);
    return isLessonAccessibleToStudent(lesson, studentData.gradeLevel ?? '', ownedPackages);
  } catch (error) {
    console.error('Error checking lesson access:', error);
    return false;
  }
}

export async function getAccessibleLessonsForStudent(
  studentId: string,
  gradeLevel: string
): Promise<Lesson[]> {
  try {
    const unbundledSnapshot = await getDocs(query(
      collection(db, 'lessons'),
      where('gradeLevel', '==', gradeLevel),
      where('isPublished', '==', true),
      where('packageId', '==', null)
    ));
    let ownedPackages: CoursePackage[] = [];
    try {
      ownedPackages = await getStudentPackages(studentId);
    } catch (error) {
      console.error('Error loading owned packages for lesson access:', error);
    }
    const lessonIds = [...new Set(ownedPackages.flatMap((coursePackage) => {
      const packageWithLessons = coursePackage as CoursePackage & { lessonIds?: unknown };
      return normalizePackageIds(packageWithLessons.lessonIds);
    }))];
    const ownedLessonSnapshots = await Promise.all(lessonIds.map(async (lessonId) => {
      try {
        return await getDoc(doc(db, 'lessons', lessonId));
      } catch {
        return null;
      }
    }));
    const unbundledLessons = unbundledSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })) as Lesson[];
    const visibleUnbundledLessons = unbundledLessons.filter((lesson) =>
      isLessonAccessibleToStudent(lesson, gradeLevel, [])
    );
    const ownedLessons: Lesson[] = [];
    for (const lessonSnapshot of ownedLessonSnapshots) {
      if (!lessonSnapshot?.exists()) continue;
      const lesson = { id: lessonSnapshot.id, ...lessonSnapshot.data() } as Lesson;
      if (isLessonAccessibleToStudent(lesson, gradeLevel, ownedPackages)) {
        ownedLessons.push(lesson);
      }
    }
    return [...visibleUnbundledLessons, ...ownedLessons];
  } catch (error) {
    console.error('Error fetching accessible lessons:', error);
    throw error;
  }
}
