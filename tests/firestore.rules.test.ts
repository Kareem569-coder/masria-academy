import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const projectId = 'masria-rules-tests';
let testEnv: RulesTestEnvironment;

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
    });
    await setDoc(doc(firestore, 'lessons/lesson-unpublished'), {
      title: 'Unpublished Lesson',
      gradeLevel: 'Grade 4',
      isPublished: false,
    });
    await setDoc(doc(firestore, 'lessons/lesson-grade-5'), {
      title: 'Grade 5 Lesson',
      gradeLevel: 'Grade 5',
      isPublished: true,
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

describe('MASRIA Firestore Rules', () => {
  beforeAll(async () => {
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

  it('prevents a student from self-activating or becoming a parent', async () => {
    const studentDb = testEnv.authenticatedContext('new-student').firestore();

    await assertFails(setDoc(doc(studentDb, 'users/new-student'), {
      name: 'New Student',
      email: 'new@example.com',
      role: 'student',
      status: 'active',
    }));
    await assertFails(setDoc(doc(studentDb, 'users/new-student'), {
      name: 'New Student',
      email: 'new@example.com',
      role: 'parent',
      status: 'active',
    }));
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
    it('student cannot create active profile', async () => {
      const studentDb = testEnv.authenticatedContext('new-student').firestore();
      await assertFails(setDoc(doc(studentDb, 'users/new-student'), {
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
