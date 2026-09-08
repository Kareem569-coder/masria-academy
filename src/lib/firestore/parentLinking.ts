import {
  arrayUnion,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import type { LinkedStudent, UserProfile } from '@/types/models';
import { db } from '@/lib/firebase';

interface LinkCodeRecord {
  studentId: string;
  active: boolean;
  createdAt: string;
  linkedBy?: string;
  linkedAt?: string;
}

export async function createStudentLinkCode(
  linkCode: string,
  studentId: string,
  createdAt: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', studentId);
    const linkCodeRef = doc(db, 'linkCodes', linkCode);
    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists() || userSnapshot.data().role !== 'student') {
      throw new Error('Student profile is unavailable.');
    }

    transaction.set(linkCodeRef, {
      studentId,
      active: true,
      createdAt,
    });
  });
}

export async function linkStudentToParent(parentUid: string, linkCode: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const parentRef = doc(db, 'users', parentUid);
    const linkCodeRef = doc(db, 'linkCodes', linkCode);
    const parentSnapshot = await transaction.get(parentRef);
    const linkCodeSnapshot = await transaction.get(linkCodeRef);

    if (!parentSnapshot.exists()) {
      throw new Error('Parent account not found.');
    }
    if (!linkCodeSnapshot.exists()) {
      throw new Error('Invalid link code.');
    }

    const linkCodeData = linkCodeSnapshot.data() as LinkCodeRecord;
    if (!linkCodeData.active || !linkCodeData.studentId) {
      throw new Error('This link code is no longer active.');
    }

    const parentData = parentSnapshot.data() as UserProfile;
    const linkedStudentIds = parentData.linkedStudentIds || parentData.linkedStudents?.map((student) => student.uid) || [];
    if (linkedStudentIds.includes(linkCodeData.studentId)) {
      throw new Error('This student is already linked to your account.');
    }

    const linkedAt = new Date().toISOString();
    transaction.update(parentRef, {
      linkedStudentIds: arrayUnion(linkCodeData.studentId),
      lastLinkedCode: linkCode,
    });
    transaction.update(linkCodeRef, {
      active: false,
      linkedBy: parentUid,
      linkedAt,
    });
  });

  const studentSnapshot = await getDoc(doc(db, 'users', await resolveLinkedStudentId(parentUid, linkCode)));
  if (!studentSnapshot.exists()) return;

  const studentData = studentSnapshot.data() as UserProfile;
  const linkedStudent: LinkedStudent = {
    uid: studentSnapshot.id,
    name: studentData.name,
    email: studentData.email,
    gradeLevel: studentData.gradeLevel,
    linkedAt: new Date().toISOString(),
  };

  await updateDoc(doc(db, 'users', parentUid), {
    linkedStudents: arrayUnion(linkedStudent),
  });
}

async function resolveLinkedStudentId(parentUid: string, linkCode: string): Promise<string> {
  const linkCodeSnapshot = await getDoc(doc(db, 'linkCodes', linkCode));
  if (!linkCodeSnapshot.exists()) {
    throw new Error('Link code record is unavailable.');
  }

  const linkCodeData = linkCodeSnapshot.data() as LinkCodeRecord;
  if (linkCodeData.linkedBy !== parentUid) {
    throw new Error('Link code ownership could not be verified.');
  }

  return linkCodeData.studentId;
}
