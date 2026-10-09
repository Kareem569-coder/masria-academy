import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, writeBatch, runTransaction, query, where, orderBy } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const projectId = 'masria-rules-tests';
let testEnv: RulesTestEnvironment;
const shouldRunRulesTests = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_PORT);
const rulesDescribe = shouldRunRulesTests ? describe : describe.skip;

const studentProfile = (uid: string, gradeLevel = 'Grade 4') => ({
  name: uid,
  email: `${uid}@example.com`,
  role: 'student',
  status: 'active',
  gradeLevel,
});

const seed = async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, 'users/student-a'), studentProfile('student-a'));
    await setDoc(doc(firestore, 'users/student-b'), studentProfile('student-b'));
    await setDoc(doc(firestore, 'users/student-sec-1'), studentProfile('student-sec-1', 'Sec 1'));
    await setDoc(doc(firestore, 'users/student-sec-2'), studentProfile('student-sec-2', 'Sec 2'));
    await setDoc(doc(firestore, 'users/student-pending'), {
      name: 'Pending Student',
      email: 'pending@example.com',
      role: 'student',
      status: 'pending',
      gradeLevel: 'Grade 4',
    });
    await setDoc(doc(firestore, 'users/student-suspended'), {
      name: 'Suspended Student',
      email: 'suspended@example.com',
      role: 'student',
      status: 'suspended',
      gradeLevel: 'Grade 4',
    });
    await setDoc(doc(firestore, 'users/parent-a'), {
      name: 'Parent A',
      email: 'parent@example.com',
      role: 'parent',
      status: 'active',
      linkedStudentIds: ['student-a'],
      linkedStudents: [],
    });
    await setDoc(doc(firestore, 'users/parent-b'), {
      name: 'Parent B',
      email: 'parent-b@example.com',
      role: 'parent',
      status: 'active',
      linkedStudentIds: [],
      linkedStudents: [],
    });
    await setDoc(doc(firestore, 'performance/performance-a'), {
      studentId: 'student-a',
      score: 8,
      total: 10,
      passed: true,
      date: '2026-08-27T00:00:00.000Z',
    });
    await setDoc(doc(firestore, 'performance/performance-b'), {
      studentId: 'student-b',
      score: 7,
      total: 10,
      passed: true,
      date: '2026-08-27T00:00:00.000Z',
    });
    await setDoc(doc(firestore, 'exam_results/exam-student-a'), {
      examId: 'exam-a',
      examTitle: 'Exam A',
      studentId: 'student-a',
      score: 8,
      totalMarks: 10,
      updatedAt: '2026-08-27T00:00:00.000Z',
    });
    await setDoc(doc(firestore, 'lessons/lesson-a'), {
      title: 'Lesson A',
      gradeLevel: 'Grade 4',
      isPublished: true,
      packageId: null,
    });
    await setDoc(doc(firestore, 'lessons/lesson-unpublished'), {
      title: 'Unpublished Lesson',
      gradeLevel: 'Grade 4',
      isPublished: false,
      packageId: null,
    });
    await setDoc(doc(firestore, 'lessons/lesson-grade-5'), {
      title: 'Grade 5 Lesson',
      gradeLevel: 'Grade 5',
      isPublished: true,
      packageId: null,
    });
    await setDoc(doc(firestore, 'coursePackages/package-grade-4'), {
      name: 'October',
      gradeLevel: 'Grade 4',
      month: 'October',
      lessonIds: ['package-lesson'],
      isActive: true,
    });
    await setDoc(doc(firestore, 'coursePackages/package-grade-4-november'), {
      name: 'November',
      gradeLevel: 'Grade 4',
      month: 'November',
      isActive: true,
    });
    await setDoc(doc(firestore, 'coursePackages/package-sec-1'), {
      name: 'October',
      gradeLevel: 'Sec 1',
      month: 'October',
      isActive: true,
    });
    await setDoc(doc(firestore, 'coursePackages/package-sec-2'), {
      name: 'October',
      gradeLevel: 'Sec 2',
      month: 'October',
      isActive: true,
    });
    await setDoc(doc(firestore, 'lessons/package-lesson'), {
      title: 'Package Lesson',
      gradeLevel: 'Grade 4',
      isPublished: true,
      packageId: 'package-grade-4',
    });
    await setDoc(doc(firestore, 'packageAccessCodes/MASRIA-TEST-1234'), {
      code: 'MASRIA-TEST-1234',
      packageId: 'package-grade-4',
      active: true,
      createdAt: '2026-08-27T00:00:00.000Z',
      usedBy: null,
      usedAt: null,
    });
    await setDoc(doc(firestore, 'packageAccessCodes/MASRIA-TEST-5678'), {
      code: 'MASRIA-TEST-5678',
      packageId: 'package-grade-4-november',
      active: true,
      createdAt: '2026-08-28T00:00:00.000Z',
      usedBy: null,
      usedAt: null,
    });
    await setDoc(doc(firestore, 'exams/exam-a'), {
      title: 'Exam A',
      gradeLevel: 'Grade 4',
      totalMarks: 10,
      date: '2026-08-27',
    });
    await setDoc(doc(firestore, 'linkCodes/code-active'), {
      studentId: 'student-a',
      active: true,
      createdAt: '2026-08-27T00:00:00.000Z',
    });
    await setDoc(doc(firestore, 'linkCodes/code-claimed'), {
      studentId: 'student-a',
      active: false,
      linkedBy: 'parent-a',
      createdAt: '2026-08-27T00:00:00.000Z',
    });
  });
};

afterAll(async () => {
});

rulesDescribe('MASRIA Firestore Rules', () => {
  beforeAll(async () => {
    if (!shouldRunRulesTests) {
      console.warn('Firestore emulator not running; skipping Firestore rules tests.');
      return;
    }

    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed();
  });

  it('allows a student to create an active profile and blocks parent-role creation', async () => {
    const studentDb = testEnv.authenticatedContext('new-student').firestore();

    await assertSucceeds(setDoc(doc(studentDb, 'users/new-student'), {
      name: 'New Student',
      email: 'new@example.com',
      role: 'student',
      status: 'active',
      gradeLevel: 'Grade 4',
    }));
    await assertFails(setDoc(doc(studentDb, 'users/new-student'), {
      name: 'New Student',
      email: 'new@example.com',
      role: 'parent',
      status: 'active',
    }));
  });

  it('allows the student signup profile and link-code writes in sequence', async () => {
    const studentDb = testEnv.authenticatedContext('signup-student').firestore();
    const profile = {
      name: 'Signup Student',
      email: 'signup-student@example.test',
      role: 'student',
      status: 'active',
      gradeLevel: 'Sec 1',
      linkCode: 'NUC-TST1',
      createdAt: '2026-10-07T00:00:00.000Z',
    };

    await assertSucceeds(setDoc(doc(studentDb, 'users/signup-student'), profile));
    await assertSucceeds(runTransaction(studentDb, async (transaction) => {
      const profileRef = doc(studentDb, 'users/signup-student');
      const profileSnapshot = await transaction.get(profileRef);
      if (!profileSnapshot.exists()) throw new Error('New student profile is missing');
      transaction.set(doc(studentDb, 'linkCodes/NUC-TST1'), {
        studentId: 'signup-student',
        active: true,
        createdAt: profile.createdAt,
      });
    }));

    const savedProfile = await getDoc(doc(studentDb, 'users/signup-student'));
    expect(savedProfile.data()?.gradeLevel).toBe('Sec 1');
    expect(savedProfile.data()?.role).toBe('student');
    expect(savedProfile.data()?.status).toBe('active');
  });

  it('allows students to create attempts but prevents result tampering', async () => {
    const studentDb = testEnv.authenticatedContext('student-a').firestore();
    const otherStudentDb = testEnv.authenticatedContext('student-b').firestore();
    const parentDb = testEnv.authenticatedContext('parent-a').firestore();

    await assertSucceeds(setDoc(doc(studentDb, 'performance/new-attempt'), {
      studentId: 'student-a',
      score: 9,
      total: 10,
      passed: true,
      date: '2026-08-27T00:00:00.000Z',
    }));
    await assertFails(updateDoc(doc(studentDb, 'performance/performance-a'), { score: 10 }));
    await assertFails(updateDoc(doc(otherStudentDb, 'performance/performance-a'), { score: 10 }));
    await assertFails(updateDoc(doc(parentDb, 'performance/performance-a'), { score: 10 }));
  });

  it('limits parents to explicitly linked student data', async () => {
    const parentDb = testEnv.authenticatedContext('parent-a').firestore();

    await assertSucceeds(getDoc(doc(parentDb, 'users/student-a')));
    await assertFails(getDoc(doc(parentDb, 'users/student-b')));
    await assertSucceeds(getDoc(doc(parentDb, 'performance/performance-a')));
    await assertFails(getDoc(doc(parentDb, 'performance/performance-b')));
    await assertFails(updateDoc(doc(parentDb, 'users/parent-a'), {
      linkedStudentIds: ['student-a', 'student-b'],
      lastLinkedCode: 'unknown-code',
    }));
  });

  it('allows teachers to manage students and official results', async () => {
    const teacherDb = testEnv.authenticatedContext('teacher', {
      email: 'aymankareem548@gmail.com',
    }).firestore();

    await assertSucceeds(updateDoc(doc(teacherDb, 'users/student-a'), { status: 'suspended' }));
    await assertSucceeds(updateDoc(doc(teacherDb, 'exam_results/exam-student-a'), { score: 10 }));
    await assertSucceeds(setDoc(doc(teacherDb, 'exams/exam-a'), {
      title: 'Exam A',
      gradeLevel: 'Grade 4',
      totalMarks: 10,
      date: '2026-08-27',
    }));
  });

  // Authentication tests
  describe('Authentication', () => {
    it('unauthenticated user cannot access protected user data', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'users/student-a')));
    });

    it('unauthenticated user cannot access protected lessons', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'lessons/lesson-a')));
    });

    it('unauthenticated user cannot access protected performance', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'performance/performance-a')));
    });

    it('unauthenticated user cannot access exam results', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'exam_results/exam-student-a')));
    });
  });

  // Student approval tests
  describe('Student approval', () => {
    it('student can create active student profile', async () => {
      const studentDb = testEnv.authenticatedContext('new-student').firestore();
      await assertSucceeds(setDoc(doc(studentDb, 'users/new-student'), {
        name: 'New Student',
        email: 'new@example.com',
        role: 'student',
        status: 'active',
        gradeLevel: 'Grade 4',
      }));
    });

    it('student cannot create teacher profile', async () => {
      const studentDb = testEnv.authenticatedContext('new-student').firestore();
      await assertFails(setDoc(doc(studentDb, 'users/new-student'), {
        name: 'New Student',
        email: 'new@example.com',
        role: 'teacher',
        status: 'active',
      }));
    });

    it('student cannot change role', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'users/student-a'), { role: 'teacher' }));
    });

    it('student cannot change status', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'users/student-a'), { status: 'suspended' }));
    });

    it('pending student cannot read protected learning content', async () => {
      const pendingDb = testEnv.authenticatedContext('student-pending').firestore();
      await assertFails(getDoc(doc(pendingDb, 'lessons/lesson-a')));
    });

    it('suspended student cannot read protected learning content', async () => {
      const suspendedDb = testEnv.authenticatedContext('student-suspended').firestore();
      await assertFails(getDoc(doc(suspendedDb, 'lessons/lesson-a')));
    });

    it('active student can read allowed published lessons', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertSucceeds(getDoc(doc(studentDb, 'lessons/lesson-a')));
    });

    it('active student cannot read a published lesson for another grade', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDoc(doc(studentDb, 'lessons/lesson-grade-5')));
    });

    it('active student cannot read unpublished lessons', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDoc(doc(studentDb, 'lessons/lesson-unpublished')));
    });

    it('authorized teacher can read unpublished lessons', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(getDoc(doc(teacherDb, 'lessons/lesson-unpublished')));
    });
  });

  describe('Course package access', () => {
    it('allows active packages for the student grade', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      const firstSecondaryQuery = query(
        collection(studentDb, 'coursePackages'),
        where('gradeLevel', '==', 'Grade 4'),
        where('isActive', '==', true)
      );
      const firstSecondarySnapshot = await assertSucceeds(getDocs(firstSecondaryQuery));
      expect(firstSecondarySnapshot.docs.map((packageDoc) => packageDoc.id).sort()).toEqual([
        'package-grade-4',
        'package-grade-4-november',
      ]);
    });

    it('does not allow a student to query packages for another grade', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      const secondSecondaryQuery = query(
        collection(studentDb, 'coursePackages'),
        where('gradeLevel', '==', 'Sec 2'),
        where('isActive', '==', true)
      );
      await assertFails(getDocs(secondSecondaryQuery));
    });

    it('only returns the matching grade when querying multiple grades', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      const matchingGradeQuery = query(
        collection(studentDb, 'coursePackages'),
        where('gradeLevel', '==', 'Grade 4'),
        where('isActive', '==', true)
      );
      const snapshot = await assertSucceeds(getDocs(matchingGradeQuery));
      expect(snapshot.docs.map((packageDoc) => packageDoc.id).sort()).toEqual([
        'package-grade-4',
        'package-grade-4-november',
      ]);
    });

    it('isolates first and second secondary package catalogs by student grade', async () => {
      const firstSecondaryDb = testEnv.authenticatedContext('student-sec-1').firestore();
      const secondSecondaryDb = testEnv.authenticatedContext('student-sec-2').firestore();
      const firstSecondaryQuery = query(
        collection(firstSecondaryDb, 'coursePackages'),
        where('gradeLevel', '==', 'Sec 1'),
        where('isActive', '==', true)
      );
      const secondSecondaryQuery = query(
        collection(secondSecondaryDb, 'coursePackages'),
        where('gradeLevel', '==', 'Sec 2'),
        where('isActive', '==', true)
      );

      const [firstSecondary, secondSecondary] = await Promise.all([
        assertSucceeds(getDocs(firstSecondaryQuery)),
        assertSucceeds(getDocs(secondSecondaryQuery)),
      ]);
      expect(firstSecondary.docs.map((packageDoc) => packageDoc.id)).toEqual(['package-sec-1']);
      expect(secondSecondary.docs.map((packageDoc) => packageDoc.id)).toEqual(['package-sec-2']);
    });

    it('denies unfiltered package listing to students', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDocs(collection(studentDb, 'coursePackages')));
    });

    it('allows unbundled lessons and rejects package lessons without ownership', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      const unbundledLessons = query(
        collection(studentDb, 'lessons'),
        where('gradeLevel', '==', 'Grade 4'),
        where('isPublished', '==', true),
        where('packageId', '==', null)
      );
      const unbundledSnapshot = await assertSucceeds(getDocs(unbundledLessons));
      expect(unbundledSnapshot.docs.map((lessonDoc) => lessonDoc.id)).toEqual(['lesson-a']);

      const unownedPackageLessons = query(
        collection(studentDb, 'lessons'),
        where('gradeLevel', '==', 'Grade 4'),
        where('isPublished', '==', true),
        where('packageId', 'in', ['package-grade-4'])
      );
      const ownershipBeforeRead = await getDocs(query(
        collection(studentDb, 'studentPackageAccess'),
        where('studentId', '==', 'student-a')
      ));
      expect(ownershipBeforeRead.empty).toBe(true);
      await assertFails(getDoc(doc(studentDb, 'lessons/package-lesson')));
      await assertFails(getDocs(unownedPackageLessons));

      const unrestrictedLessonList = query(
        collection(studentDb, 'lessons'),
        where('gradeLevel', '==', 'Grade 4'),
        where('isPublished', '==', true)
      );
      await assertFails(getDocs(unrestrictedLessonList));
    });

    it('allows an owner to get a published same-grade lesson listed by the owned package', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'studentPackageAccess/student-a_package-grade-4'), {
          studentId: 'student-a',
          packageId: 'package-grade-4',
          status: 'active',
        });
      });

      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertSucceeds(getDoc(doc(studentDb, 'lessons/package-lesson')));
    });

    it('denies package lessons without ownership, with a wrong grade, or unpublished', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, 'studentPackageAccess/student-a_package-grade-4'), {
          studentId: 'student-a',
          packageId: 'package-grade-4',
          status: 'active',
        });
        await setDoc(doc(firestore, 'coursePackages/package-grade-4'), {
          name: 'October',
          gradeLevel: 'Grade 4',
          lessonIds: ['package-lesson', 'package-lesson-wrong-grade', 'package-lesson-unpublished'],
          isActive: true,
        });
        await setDoc(doc(firestore, 'lessons/package-lesson-wrong-grade'), {
          title: 'Wrong grade package lesson',
          gradeLevel: 'Grade 5',
          isPublished: true,
          packageId: 'package-grade-4',
        });
        await setDoc(doc(firestore, 'lessons/package-lesson-unpublished'), {
          title: 'Unpublished package lesson',
          gradeLevel: 'Grade 4',
          isPublished: false,
          packageId: 'package-grade-4',
        });
      });

      const ownerDb = testEnv.authenticatedContext('student-a').firestore();
      const otherStudentDb = testEnv.authenticatedContext('student-b').firestore();
      await assertFails(getDoc(doc(otherStudentDb, 'lessons/package-lesson')));
      await assertFails(getDoc(doc(ownerDb, 'lessons/package-lesson-wrong-grade')));
      await assertFails(getDoc(doc(ownerDb, 'lessons/package-lesson-unpublished')));
    });

    it('denies an owned lesson when its package does not list the lesson ID', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, 'studentPackageAccess/student-a_package-grade-4'), {
          studentId: 'student-a',
          packageId: 'package-grade-4',
          status: 'active',
        });
        await setDoc(doc(firestore, 'coursePackages/package-grade-4'), {
          name: 'October',
          gradeLevel: 'Grade 4',
          lessonIds: [],
          isActive: true,
        });
      });

      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDoc(doc(studentDb, 'lessons/package-lesson')));
    });

    it('allows the reported Sec 1 lesson only when the owned package and lesson point to each other', async () => {
      const lessonId = 'zl0J8ASCB58FKItnDFD';
      const packageId = 'Fl8jh0TeNPTwrbuAVMIM';
      const studentId = 'student-sec-1';

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, `coursePackages/${packageId}`), {
          name: 'Sec 1 package',
          gradeLevel: 'Sec 1',
          lessonIds: [lessonId],
          isActive: true,
        });
        await setDoc(doc(firestore, `lessons/${lessonId}`), {
          title_en: 'Owned Sec 1 lesson',
          gradeLevel: 'Sec 1',
          isPublished: true,
          packageId,
        });
        await setDoc(doc(firestore, `studentPackageAccess/${studentId}_${packageId}`), {
          studentId,
          packageId,
          status: 'active',
        });
      });

      const studentDb = testEnv.authenticatedContext(studentId).firestore();
      await assertSucceeds(getDoc(doc(studentDb, `lessons/${lessonId}`)));
    });

    it('denies the reported lesson when it points to a different package, even if both packages are owned', async () => {
      const lessonId = 'zl0J8ASCB58FKItnDFD';
      const expectedPackageId = 'Fl8jh0TeNPTwrbuAVMIM';
      const referencedPackageId = 'sec-1-other-package';
      const studentId = 'student-sec-1';

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, `coursePackages/${expectedPackageId}`), {
          gradeLevel: 'Sec 1',
          lessonIds: [lessonId],
          isActive: true,
        });
        await setDoc(doc(firestore, `coursePackages/${referencedPackageId}`), {
          gradeLevel: 'Sec 1',
          lessonIds: [],
          isActive: true,
        });
        await setDoc(doc(firestore, `lessons/${lessonId}`), {
          gradeLevel: 'Sec 1',
          isPublished: true,
          packageId: referencedPackageId,
        });
        for (const packageId of [expectedPackageId, referencedPackageId]) {
          await setDoc(doc(firestore, `studentPackageAccess/${studentId}_${packageId}`), {
            studentId,
            packageId,
            status: 'active',
          });
        }
      });

      const studentDb = testEnv.authenticatedContext(studentId).firestore();
      await assertFails(getDoc(doc(studentDb, `lessons/${lessonId}`)));
    });

    it('allows a student to read only their own package ownership records', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, 'studentPackageAccess/student-a_package-grade-4'), {
          studentId: 'student-a',
          packageId: 'package-grade-4',
          activatedAt: '2026-09-29T00:00:00.000Z',
          status: 'active',
        });
        await setDoc(doc(firestore, 'studentPackageAccess/student-b_package-grade-4'), {
          studentId: 'student-b',
          packageId: 'package-grade-4',
          activatedAt: '2026-09-30T00:00:00.000Z',
          status: 'active',
        });
      });

      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      const ownershipQuery = query(
        collection(studentDb, 'studentPackageAccess'),
        where('studentId', '==', 'student-a'),
        orderBy('activatedAt', 'desc')
      );
      const ownRecords = await assertSucceeds(getDocs(ownershipQuery));
      expect(ownRecords.docs.map((record) => record.data().studentId)).toEqual(['student-a']);

      const otherStudentQuery = query(
        collection(studentDb, 'studentPackageAccess'),
        where('studentId', '==', 'student-b'),
        orderBy('activatedAt', 'desc')
      );
      await assertFails(getDocs(otherStudentQuery));
      await assertFails(getDoc(doc(studentDb, 'studentPackageAccess/student-b_package-grade-4')));
    });

    it('denies ownership queries when the authenticated profile is missing or is not a student', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, 'users/parent-profile'), {
          name: 'Parent profile',
          role: 'parent',
          status: 'active',
        });
        for (const studentId of ['missing-profile', 'parent-profile']) {
          await setDoc(doc(firestore, `studentPackageAccess/${studentId}_package-grade-4`), {
            studentId,
            packageId: 'package-grade-4',
            activatedAt: '2026-09-30T00:00:00.000Z',
            status: 'active',
          });
        }
      });

      for (const uid of ['missing-profile', 'parent-profile']) {
        const studentDb = testEnv.authenticatedContext(uid).firestore();
        const ownershipQuery = query(
          collection(studentDb, 'studentPackageAccess'),
          where('studentId', '==', uid),
          orderBy('activatedAt', 'desc')
        );
        await assertFails(getDocs(ownershipQuery));
      }
    });

    it('denies reading a missing ownership document while allowing atomic redemption without that pre-read', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      const codeRef = doc(studentDb, 'packageAccessCodes/MASRIA-TEST-1234');
      const packageRef = doc(studentDb, 'coursePackages/package-grade-4');
      const studentRef = doc(studentDb, 'users/student-a');
      const accessRef = doc(studentDb, 'studentPackageAccess/student-a_package-grade-4');

      // resource.data is unavailable for a missing document, so the current
      // ownership read rule rejects this duplicate-check pre-read.
      await assertFails(getDoc(accessRef));

      await assertSucceeds(runTransaction(studentDb, async (transaction) => {
        const codeSnapshot = await transaction.get(codeRef);
        const packageSnapshot = await transaction.get(packageRef);
        const studentSnapshot = await transaction.get(studentRef);
        if (!codeSnapshot.exists() || !packageSnapshot.exists() || !studentSnapshot.exists()) {
          throw new Error('Expected package redemption records');
        }

        transaction.update(codeRef, {
          active: false,
          status: 'used',
          usedBy: 'student-a',
          usedAt: '2026-09-30T00:00:00.000Z',
        });
        transaction.set(accessRef, {
          id: 'student-a_package-grade-4',
          studentId: 'student-a',
          packageId: 'package-grade-4',
          codeId: 'MASRIA-TEST-1234',
          activatedAt: '2026-09-30T00:00:00.000Z',
          status: 'active',
          createdAt: '2026-09-30T00:00:00.000Z',
          updatedAt: '2026-09-30T00:00:00.000Z',
        });
        transaction.update(studentRef, {
          accessiblePackageIds: ['package-grade-4'],
          lastRedeemedAccessCode: 'MASRIA-TEST-1234',
        });
      }));

      await assertSucceeds(getDoc(doc(studentDb, 'lessons/package-lesson')));
      const ownedPackageSnapshot = await assertSucceeds(getDoc(packageRef));
      expect(ownedPackageSnapshot.data()?.lessonIds).toContain('package-lesson');
      await assertFails(updateDoc(codeRef, {
        active: false,
        status: 'used',
        usedBy: 'student-a',
        usedAt: '2026-10-01T00:00:00.000Z',
      }));

      // An existing ownership record cannot be overwritten by a student;
      // removing the denied absence pre-read does not permit duplicate ownership.
      await assertFails(setDoc(accessRef, {
        id: accessRef.id,
        studentId: 'student-a',
        packageId: 'package-grade-4',
        codeId: 'MASRIA-TEST-5678',
        activatedAt: '2026-10-01T00:00:00.000Z',
        status: 'active',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      }));
    });

    it('denies wrong-grade package access and attempts to redeem for another student', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDoc(doc(studentDb, 'coursePackages/package-sec-1')));

      await assertFails(setDoc(doc(studentDb, 'studentPackageAccess/student-b_package-grade-4'), {
        id: 'student-b_package-grade-4',
        studentId: 'student-b',
        packageId: 'package-grade-4',
        codeId: 'MASRIA-TEST-1234',
        activatedAt: '2026-09-30T00:00:00.000Z',
        status: 'active',
        createdAt: '2026-09-30T00:00:00.000Z',
        updatedAt: '2026-09-30T00:00:00.000Z',
      }));
    });

    it('denies invalid and inactive access-code consumption', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDoc(doc(studentDb, 'packageAccessCodes/DOES-NOT-EXIST')));

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'packageAccessCodes/MASRIA-INACTIVE-0000'), {
          code: 'MASRIA-INACTIVE-0000',
          packageId: 'package-grade-4',
          active: false,
          status: 'disabled',
          usedBy: null,
          usedAt: null,
        });
      });

      const inactiveCodeRef = doc(studentDb, 'packageAccessCodes/MASRIA-INACTIVE-0000');
      await assertFails(updateDoc(inactiveCodeRef, {
        active: false,
        status: 'used',
        usedBy: 'student-a',
        usedAt: '2026-09-30T00:00:00.000Z',
      }));
    });

    it('keeps October and November ownership permanently after separate redemptions', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      const purchases = [
        { code: 'MASRIA-TEST-1234', packageId: 'package-grade-4', date: '2026-10-01T00:00:00.000Z' },
        { code: 'MASRIA-TEST-5678', packageId: 'package-grade-4-november', date: '2026-11-01T00:00:00.000Z' },
      ];

      for (const purchase of purchases) {
        await assertSucceeds(runTransaction(studentDb, async (transaction) => {
          const codeRef = doc(studentDb, 'packageAccessCodes', purchase.code);
          const packageRef = doc(studentDb, 'coursePackages', purchase.packageId);
          const studentRef = doc(studentDb, 'users/student-a');
          const accessRef = doc(studentDb, 'studentPackageAccess', `student-a_${purchase.packageId}`);
          const [codeSnapshot, packageSnapshot, studentSnapshot] = await Promise.all([
            transaction.get(codeRef),
            transaction.get(packageRef),
            transaction.get(studentRef),
          ]);
          if (!codeSnapshot.exists() || !packageSnapshot.exists() || !studentSnapshot.exists()) {
            throw new Error('Expected package redemption records');
          }

          const oldPackageIds = studentSnapshot.data().accessiblePackageIds || [];
          transaction.update(codeRef, {
            active: false,
            status: 'used',
            usedBy: 'student-a',
            usedAt: purchase.date,
          });
          transaction.set(accessRef, {
            id: accessRef.id,
            studentId: 'student-a',
            packageId: purchase.packageId,
            codeId: purchase.code,
            activatedAt: purchase.date,
            status: 'active',
            createdAt: purchase.date,
            updatedAt: purchase.date,
          });
          transaction.update(studentRef, {
            accessiblePackageIds: [...oldPackageIds, purchase.packageId],
            lastRedeemedAccessCode: purchase.code,
          });
        }));
      }

      const ownership = await getDocs(query(
        collection(studentDb, 'studentPackageAccess'),
        where('studentId', '==', 'student-a')
      ));
      expect(ownership.docs.map((record) => record.data().packageId).sort()).toEqual([
        'package-grade-4',
        'package-grade-4-november',
      ]);
      expect(ownership.docs.every((record) => !('expiresAt' in record.data()))).toBe(true);
    });

    it('denies package entitlement changes without consuming a code', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'users/student-a'), {
        accessiblePackageIds: ['package-grade-4'],
        lastRedeemedAccessCode: 'MASRIA-TEST-1234',
      }));
      await assertFails(updateDoc(doc(studentDb, 'packageAccessCodes/MASRIA-TEST-1234'), {
        active: false,
        usedBy: 'student-a',
        usedAt: '2026-09-30T00:00:00.000Z',
      }));
      await assertFails(getDoc(doc(studentDb, 'lessons/package-lesson')));
    });

    it('prevents students from listing package access codes', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDocs(collection(studentDb, 'packageAccessCodes')));
    });
  });

  // Parent access tests
  describe('Parent access', () => {
    it('parent cannot create a profile with forged linked student IDs', async () => {
      const parentDb = testEnv.authenticatedContext('new-parent').firestore();
      await assertFails(setDoc(doc(parentDb, 'users/new-parent'), {
        name: 'Forged Parent',
        email: 'forged-parent@example.com',
        role: 'parent',
        status: 'active',
        linkedStudentIds: ['student-a'],
        linkedStudents: [],
      }));
    });

    it('parent can link a student only by atomically claiming an active link code', async () => {
      const parentDb = testEnv.authenticatedContext('parent-b').firestore();
      const batch = writeBatch(parentDb);

      batch.update(doc(parentDb, 'users/parent-b'), {
        linkedStudentIds: ['student-a'],
        lastLinkedCode: 'code-active',
      });
      batch.update(doc(parentDb, 'linkCodes/code-active'), {
        active: false,
        linkedBy: 'parent-b',
        studentId: 'student-a',
        createdAt: '2026-08-27T00:00:00.000Z',
      });

      await assertSucceeds(batch.commit());
      await assertSucceeds(getDoc(doc(parentDb, 'users/student-a')));
    });

    it('parent can access explicitly linked student', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertSucceeds(getDoc(doc(parentDb, 'users/student-a')));
    });

    it('parent cannot access arbitrary student', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(getDoc(doc(parentDb, 'users/student-b')));
    });

    it('parent cannot enumerate users', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(getDocs(collection(parentDb, 'users')));
    });

    it('parent cannot modify student profile', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(updateDoc(doc(parentDb, 'users/student-a'), { name: 'Changed' }));
    });

    it('parent cannot modify performance', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(updateDoc(doc(parentDb, 'performance/performance-a'), { score: 10 }));
    });

    it('parent cannot modify exam results', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(updateDoc(doc(parentDb, 'exam_results/exam-student-a'), { score: 10 }));
    });

    it('parent cannot escalate their own relationships', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(updateDoc(doc(parentDb, 'users/parent-a'), {
        linkedStudentIds: ['student-a', 'student-b'],
      }));
    });
  });

  // Teacher authorization tests
  describe('Teacher authorization', () => {
    it('authorized teacher can manage students', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(updateDoc(doc(teacherDb, 'users/student-a'), { status: 'suspended' }));
    });

    it('authorized teacher can manage lessons', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(setDoc(doc(teacherDb, 'lessons/new-lesson'), {
        title: 'New Lesson',
        gradeLevel: 'Grade 4',
        isPublished: true,
      }));
    });

    it('authorized teacher can manage exams', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(setDoc(doc(teacherDb, 'exams/new-exam'), {
        title: 'New Exam',
        gradeLevel: 'Grade 4',
        totalMarks: 10,
        date: '2026-08-27',
      }));
    });

    it('authorized teacher can manage exam results', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(updateDoc(doc(teacherDb, 'exam_results/exam-student-a'), { score: 10 }));
    });

    it('unauthorized authenticated user cannot perform teacher operations', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'users/student-b'), { status: 'suspended' }));
      await assertFails(setDoc(doc(studentDb, 'lessons/new-lesson'), {
        title: 'New Lesson',
        gradeLevel: 'Grade 4',
        isPublished: true,
      }));
    });
  });

  // Performance tests
  describe('Performance', () => {
    it('student can create their own allowed performance record', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertSucceeds(setDoc(doc(studentDb, 'performance/new-attempt'), {
        studentId: 'student-a',
        score: 9,
        total: 10,
        passed: true,
        date: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('student cannot create another student performance', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(setDoc(doc(studentDb, 'performance/other-attempt'), {
        studentId: 'student-b',
        score: 9,
        total: 10,
        passed: true,
        date: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('student cannot modify an existing performance record', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'performance/performance-a'), { score: 10 }));
    });

    it('student cannot modify score', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'performance/performance-a'), { score: 10 }));
    });

    it('student cannot modify passed', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'performance/performance-a'), { passed: false }));
    });

    it('student cannot modify total', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'performance/performance-a'), { total: 20 }));
    });

    it('parent has read-only access to linked student performance', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertSucceeds(getDoc(doc(parentDb, 'performance/performance-a')));
      await assertFails(updateDoc(doc(parentDb, 'performance/performance-a'), { score: 10 }));
    });

    it('teacher can manage authorized performance', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(updateDoc(doc(teacherDb, 'performance/performance-a'), { score: 10 }));
    });
  });

  // Exam results tests
  describe('Exam results', () => {
    it('student cannot modify official result', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'exam_results/exam-student-a'), { score: 10 }));
    });

    it('parent cannot modify official result', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(updateDoc(doc(parentDb, 'exam_results/exam-student-a'), { score: 10 }));
    });

    it('parent can read only linked student result', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertSucceeds(getDoc(doc(parentDb, 'exam_results/exam-student-a')));
    });

    it('teacher can create result', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(setDoc(doc(teacherDb, 'exam_results/new-result'), {
        examId: 'exam-a',
        examTitle: 'Exam A',
        studentId: 'student-a',
        score: 9,
        totalMarks: 10,
        updatedAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('teacher can update result', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(updateDoc(doc(teacherDb, 'exam_results/exam-student-a'), { score: 10 }));
    });

    it('teacher can delete result', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(deleteDoc(doc(teacherDb, 'exam_results/exam-student-a')));
    });

    it('student cannot write another student result', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(setDoc(doc(studentDb, 'exam_results/other-result'), {
        examId: 'exam-a',
        examTitle: 'Exam A',
        studentId: 'student-b',
        score: 9,
        totalMarks: 10,
        updatedAt: '2026-08-27T00:00:00.000Z',
      }));
    });
  });

  // Link codes tests
  describe('Link codes', () => {
    it('unauthorized user cannot create link code', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(setDoc(doc(parentDb, 'linkCodes/new-code'), {
        studentId: 'student-a',
        active: true,
        createdAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('student can create their own link code', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertSucceeds(setDoc(doc(studentDb, 'linkCodes/new-code'), {
        studentId: 'student-a',
        active: true,
        createdAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('student cannot create link code for another student', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(setDoc(doc(studentDb, 'linkCodes/new-code'), {
        studentId: 'student-b',
        active: true,
        createdAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('parent can read active link code', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertSucceeds(getDoc(doc(parentDb, 'linkCodes/code-active')));
    });

    it('parent can read their own claimed link code', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertSucceeds(getDoc(doc(parentDb, 'linkCodes/code-claimed')));
    });

    it('parent cannot read another parent claimed code', async () => {
      const parentDb = testEnv.authenticatedContext('parent-b').firestore();
      await assertFails(getDoc(doc(parentDb, 'linkCodes/code-claimed')));
    });

    it('parent can claim active link code', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertSucceeds(updateDoc(doc(parentDb, 'linkCodes/code-active'), {
        active: false,
        linkedBy: 'parent-a',
        studentId: 'student-a',
        createdAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('parent cannot claim already claimed code', async () => {
      const parentDb = testEnv.authenticatedContext('parent-b').firestore();
      await assertFails(updateDoc(doc(parentDb, 'linkCodes/code-claimed'), {
        active: false,
        linkedBy: 'parent-b',
        studentId: 'student-a',
        createdAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('teacher can delete link code', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(deleteDoc(doc(teacherDb, 'linkCodes/code-active')));
    });
  });

  // Coding submissions tests
  describe('Coding submissions', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, 'coding_submissions/submission-a'), {
          id: 'submission-a',
          studentId: 'student-a',
          lessonId: 'lesson-a',
          activityId: 'activity-1',
          challengeVersion: 1,
          language: 'cpp17',
          sourceCode: '#include <iostream>\nint main() { return 0; }',
          status: 'queued',
          submittedAt: '2026-08-27T00:00:00.000Z',
        });
        await setDoc(doc(firestore, 'coding_submissions/submission-b'), {
          id: 'submission-b',
          studentId: 'student-b',
          lessonId: 'lesson-a',
          activityId: 'activity-1',
          challengeVersion: 1,
          language: 'cpp17',
          sourceCode: '#include <iostream>\nint main() { return 0; }',
          status: 'queued',
          submittedAt: '2026-08-27T00:00:00.000Z',
        });
      });
    });

    it('student can read their own submission', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertSucceeds(getDoc(doc(studentDb, 'coding_submissions/submission-a')));
    });

    it('student cannot read another student submission', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDoc(doc(studentDb, 'coding_submissions/submission-b')));
    });

    it('student can create their own submission', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertSucceeds(setDoc(doc(studentDb, 'coding_submissions/submission-new'), {
        id: 'submission-new',
        studentId: 'student-a',
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        challengeVersion: 1,
        language: 'cpp17',
        sourceCode: '#include <iostream>\nint main() { return 0; }',
        status: 'queued',
        submittedAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('student cannot create submission for another student', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(setDoc(doc(studentDb, 'coding_submissions/submission-forged'), {
        id: 'submission-forged',
        studentId: 'student-b',
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        challengeVersion: 1,
        language: 'cpp17',
        sourceCode: '#include <iostream>\nint main() { return 0; }',
        status: 'queued',
        submittedAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('student cannot update submission (immutable)', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'coding_submissions/submission-a'), {
        status: 'completed',
      }));
    });

    it('student cannot delete submission', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(deleteDoc(doc(studentDb, 'coding_submissions/submission-a')));
    });

    it('teacher can read any submission', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(getDoc(doc(teacherDb, 'coding_submissions/submission-a')));
      await assertSucceeds(getDoc(doc(teacherDb, 'coding_submissions/submission-b')));
    });

    it('parent can read linked student submission', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertSucceeds(getDoc(doc(parentDb, 'coding_submissions/submission-a')));
    });

    it('parent cannot read unlinked student submission', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(getDoc(doc(parentDb, 'coding_submissions/submission-b')));
    });

    it('student cannot forge evaluation fields on a submission', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(setDoc(doc(studentDb, 'coding_submissions/submission-forged-eval'), {
        id: 'submission-forged-eval',
        studentId: 'student-a',
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        challengeVersion: 1,
        language: 'cpp17',
        sourceCode: '#include <iostream>\nint main() { return 0; }',
        status: 'queued',
        submittedAt: '2026-08-27T00:00:00.000Z',
        verdict: 'AC',
        scorePercent: 100,
        passed: true,
        mastery: true,
        evaluatorVersion: 'forged',
      }));
    });

    it('student cannot create a completed or scored submission', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(setDoc(doc(studentDb, 'coding_submissions/submission-completed'), {
        id: 'submission-completed',
        studentId: 'student-a',
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        challengeVersion: 1,
        language: 'cpp17',
        sourceCode: '#include <iostream>\nint main() { return 0; }',
        status: 'completed',
        submittedAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('pending student cannot create a submission', async () => {
      const pendingDb = testEnv.authenticatedContext('student-pending').firestore();
      await assertFails(setDoc(doc(pendingDb, 'coding_submissions/submission-pending'), {
        id: 'submission-pending',
        studentId: 'student-pending',
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        challengeVersion: 1,
        language: 'cpp17',
        sourceCode: '#include <iostream>\nint main() { return 0; }',
        status: 'queued',
        submittedAt: '2026-08-27T00:00:00.000Z',
      }));
    });
  });

  // Coding evaluations tests
  describe('Coding evaluations', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, 'coding_evaluations/evaluation-a'), {
          submissionId: 'submission-a',
          studentId: 'student-a',
          lessonId: 'lesson-a',
          activityId: 'activity-1',
          verdict: 'AC',
          scorePercent: 100,
          passedTestCount: 5,
          totalTestCount: 5,
          publicTestResults: [],
          evaluatedAt: '2026-08-27T00:00:00.000Z',
          evaluatorVersion: '1.0.0',
        });
        await setDoc(doc(firestore, 'coding_evaluations/evaluation-b'), {
          submissionId: 'submission-b',
          studentId: 'student-b',
          lessonId: 'lesson-a',
          activityId: 'activity-1',
          verdict: 'WA',
          scorePercent: 80,
          passedTestCount: 4,
          totalTestCount: 5,
          publicTestResults: [],
          evaluatedAt: '2026-08-27T00:00:00.000Z',
          evaluatorVersion: '1.0.0',
        });
      });
    });

    it('student can read their own evaluation', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertSucceeds(getDoc(doc(studentDb, 'coding_evaluations/evaluation-a')));
    });

    it('student cannot read another student evaluation', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDoc(doc(studentDb, 'coding_evaluations/evaluation-b')));
    });

    it('student cannot create evaluation (prevent forgery)', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(setDoc(doc(studentDb, 'coding_evaluations/evaluation-forged'), {
        submissionId: 'submission-a',
        studentId: 'student-a',
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        verdict: 'AC',
        scorePercent: 100,
        passedTestCount: 5,
        totalTestCount: 5,
        publicTestResults: [],
        evaluatedAt: '2026-08-27T00:00:00.000Z',
        evaluatorVersion: '1.0.0',
      }));
    });

    it('student cannot update evaluation (immutable)', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'coding_evaluations/evaluation-a'), {
        verdict: 'WA',
      }));
    });

    it('student cannot delete evaluation', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(deleteDoc(doc(studentDb, 'coding_evaluations/evaluation-a')));
    });

    it('teacher can read any evaluation', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(getDoc(doc(teacherDb, 'coding_evaluations/evaluation-a')));
      await assertSucceeds(getDoc(doc(teacherDb, 'coding_evaluations/evaluation-b')));
    });

    it('parent can read linked student evaluation', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertSucceeds(getDoc(doc(parentDb, 'coding_evaluations/evaluation-a')));
    });

    it('parent cannot read unlinked student evaluation', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(getDoc(doc(parentDb, 'coding_evaluations/evaluation-b')));
    });

    it('teacher cannot create an evaluation from the client', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertFails(setDoc(doc(teacherDb, 'coding_evaluations/evaluation-teacher'), {
        submissionId: 'submission-a',
        studentId: 'student-a',
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        verdict: 'AC',
        scorePercent: 100,
        passedTestCount: 5,
        totalTestCount: 5,
        publicTestResults: [],
        evaluatedAt: '2026-08-27T00:00:00.000Z',
        evaluatorVersion: '1.0.0',
      }));
    });
  });

  // Coding activity progress tests
  describe('Coding activity progress', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, 'coding_activity_progress/progress-a'), {
          studentId: 'student-a',
          lessonId: 'lesson-a',
          activityId: 'activity-1',
          challengeVersion: 1,
          status: 'IN_PROGRESS',
          bestScorePercent: 80,
          attempts: 2,
          passed: false,
          updatedAt: '2026-08-27T00:00:00.000Z',
        });
        await setDoc(doc(firestore, 'coding_activity_progress/progress-b'), {
          studentId: 'student-b',
          lessonId: 'lesson-a',
          activityId: 'activity-1',
          challengeVersion: 1,
          status: 'PASSED',
          bestScorePercent: 100,
          attempts: 3,
          passed: true,
          updatedAt: '2026-08-27T00:00:00.000Z',
        });
      });
    });

    it('student can read their own progress', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertSucceeds(getDoc(doc(studentDb, 'coding_activity_progress/progress-a')));
    });

    it('student cannot read another student progress', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDoc(doc(studentDb, 'coding_activity_progress/progress-b')));
    });

    it('student cannot create progress (prevent authoritative update)', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(setDoc(doc(studentDb, 'coding_activity_progress/progress-forged'), {
        studentId: 'student-a',
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        challengeVersion: 1,
        status: 'PASSED',
        bestScorePercent: 100,
        attempts: 1,
        passed: true,
        updatedAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('student cannot update progress (prevent authoritative update)', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'coding_activity_progress/progress-a'), {
        status: 'PASSED',
        passed: true,
      }));
    });

    it('student cannot delete progress', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(deleteDoc(doc(studentDb, 'coding_activity_progress/progress-a')));
    });

    it('teacher can read any progress', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(getDoc(doc(teacherDb, 'coding_activity_progress/progress-a')));
      await assertSucceeds(getDoc(doc(teacherDb, 'coding_activity_progress/progress-b')));
    });

    it('parent can read linked student progress', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertSucceeds(getDoc(doc(parentDb, 'coding_activity_progress/progress-a')));
    });

    it('parent cannot read unlinked student progress', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(getDoc(doc(parentDb, 'coding_activity_progress/progress-b')));
    });

    it('teacher cannot create authoritative progress from the client', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertFails(setDoc(doc(teacherDb, 'coding_activity_progress/progress-teacher'), {
        studentId: 'student-a',
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        challengeVersion: 1,
        status: 'PASSED',
        bestScorePercent: 100,
        attempts: 1,
        passed: true,
        updatedAt: '2026-08-27T00:00:00.000Z',
      }));
    });
  });

  // Private challenge configuration tests
  describe('Private challenge configuration', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, 'private_challenge_config/config-a'), {
          lessonId: 'lesson-a',
          activityId: 'activity-1',
          challengeVersion: 1,
          privateTestCases: [
            { id: 'private-1', input: 'test', expectedOutput: 'test', weight: 1 },
          ],
          referenceSolutionsByLanguage: [
            { language: 'cpp17', solutionCode: '#include <iostream>\nint main() {}' },
          ],
          updatedAt: '2026-08-27T00:00:00.000Z',
        });
      });
    });

    it('teacher can read private challenge config', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(getDoc(doc(teacherDb, 'private_challenge_config/config-a')));
    });

    it('teacher can create private challenge config', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(setDoc(doc(teacherDb, 'private_challenge_config/config-new'), {
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        challengeVersion: 1,
        privateTestCases: [],
        referenceSolutionsByLanguage: [],
        updatedAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('teacher can update private challenge config', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(updateDoc(doc(teacherDb, 'private_challenge_config/config-a'), {
        updatedAt: '2026-08-27T01:00:00.000Z',
      }));
    });

    it('teacher can delete private challenge config', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher', {
        email: 'aymankareem548@gmail.com',
      }).firestore();
      await assertSucceeds(deleteDoc(doc(teacherDb, 'private_challenge_config/config-a')));
    });

    it('student cannot read private challenge config', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(getDoc(doc(studentDb, 'private_challenge_config/config-a')));
    });

    it('student cannot create private challenge config', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(setDoc(doc(studentDb, 'private_challenge_config/config-forged'), {
        lessonId: 'lesson-a',
        activityId: 'activity-1',
        challengeVersion: 1,
        privateTestCases: [],
        referenceSolutionsByLanguage: [],
        updatedAt: '2026-08-27T00:00:00.000Z',
      }));
    });

    it('parent cannot read private challenge config', async () => {
      const parentDb = testEnv.authenticatedContext('parent-a').firestore();
      await assertFails(getDoc(doc(parentDb, 'private_challenge_config/config-a')));
    });

    it('student cannot update or delete private challenge config', async () => {
      const studentDb = testEnv.authenticatedContext('student-a').firestore();
      await assertFails(updateDoc(doc(studentDb, 'private_challenge_config/config-a'), {
        updatedAt: '2026-08-27T01:00:00.000Z',
      }));
      await assertFails(deleteDoc(doc(studentDb, 'private_challenge_config/config-a')));
    });
  });
});
