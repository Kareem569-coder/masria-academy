import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  type CodingSubmission,
  type CodingEvaluation,
  type CodingActivityProgress,
  type AttemptPolicy,
  validateCodingSubmission,
  validateCodingEvaluation,
  validateCodingActivityProgress,
  canSubmitAnotherAttempt,
} from '@/lib/coding/submission';
import type { PrivateChallengeConfiguration, PrivateChallengeTestCase } from '@/types/models';

export const CODING_SUBMISSIONS_COLLECTION = 'coding_submissions';
export const CODING_EVALUATIONS_COLLECTION = 'coding_evaluations';
export const CODING_ACTIVITY_PROGRESS_COLLECTION = 'coding_activity_progress';
export const PRIVATE_CHALLENGE_CONFIG_COLLECTION = 'private_challenge_config';

export type StudentCodingSubmissionInput = Omit<CodingSubmission, 'id' | 'submittedAt' | 'status'> & {
  status?: CodingSubmission['status'];
  submittedAt?: string;
};

function toSubmissionRecord(docId: string, data: Record<string, unknown>): CodingSubmission {
  return {
    ...(data as Omit<CodingSubmission, 'id'>),
    id: typeof data.id === 'string' && data.id.length > 0 ? data.id : docId,
  };
}

/**
 * Persist a student-owned source submission. Status is always queued.
 * Evaluations, scores, and progress must not be written here.
 */
export async function createCodingSubmission(
  submission: StudentCodingSubmissionInput
): Promise<string> {
  const docRef = doc(collection(db, CODING_SUBMISSIONS_COLLECTION));
  const submissionData: CodingSubmission = {
    studentId: submission.studentId,
    lessonId: submission.lessonId,
    activityId: submission.activityId,
    challengeVersion: submission.challengeVersion,
    language: submission.language,
    sourceCode: submission.sourceCode,
    status: 'queued',
    submittedAt: submission.submittedAt ?? new Date().toISOString(),
    id: docRef.id,
    ...(submission.idempotencyKey ? { idempotencyKey: submission.idempotencyKey } : {}),
  };

  const validation = validateCodingSubmission(submissionData);
  if (!validation.valid) {
    throw new Error(`Invalid submission: ${validation.errors.join(', ')}`);
  }

  await setDoc(docRef, submissionData);
  return docRef.id;
}

export async function getCodingSubmissionById(
  submissionId: string
): Promise<CodingSubmission | null> {
  const submissionDoc = await getDoc(doc(db, CODING_SUBMISSIONS_COLLECTION, submissionId));
  if (!submissionDoc.exists()) {
    return null;
  }
  return toSubmissionRecord(submissionDoc.id, submissionDoc.data() as Record<string, unknown>);
}

export async function getSubmissionsByStudentId(
  studentId: string
): Promise<CodingSubmission[]> {
  const snapshot = await getDocs(
    query(collection(db, CODING_SUBMISSIONS_COLLECTION), where('studentId', '==', studentId))
  );
  return snapshot.docs.map((item) => toSubmissionRecord(item.id, item.data() as Record<string, unknown>));
}

export async function getSubmissionsByActivityId(
  activityId: string
): Promise<CodingSubmission[]> {
  const snapshot = await getDocs(
    query(collection(db, CODING_SUBMISSIONS_COLLECTION), where('activityId', '==', activityId))
  );
  return snapshot.docs.map((item) => toSubmissionRecord(item.id, item.data() as Record<string, unknown>));
}

export async function getSubmissionsByLessonId(
  lessonId: string
): Promise<CodingSubmission[]> {
  const snapshot = await getDocs(
    query(collection(db, CODING_SUBMISSIONS_COLLECTION), where('lessonId', '==', lessonId))
  );
  return snapshot.docs.map((item) => toSubmissionRecord(item.id, item.data() as Record<string, unknown>));
}

export async function getCodingEvaluationById(
  evaluationId: string
): Promise<CodingEvaluation | null> {
  const evaluationDoc = await getDoc(doc(db, CODING_EVALUATIONS_COLLECTION, evaluationId));
  if (!evaluationDoc.exists()) {
    return null;
  }
  return evaluationDoc.data() as CodingEvaluation;
}

export async function getEvaluationBySubmissionId(
  submissionId: string
): Promise<CodingEvaluation | null> {
  const snapshot = await getDocs(
    query(collection(db, CODING_EVALUATIONS_COLLECTION), where('submissionId', '==', submissionId))
  );
  if (snapshot.empty) {
    return null;
  }
  return snapshot.docs[0].data() as CodingEvaluation;
}

export async function getEvaluationsByStudentId(
  studentId: string
): Promise<CodingEvaluation[]> {
  const snapshot = await getDocs(
    query(collection(db, CODING_EVALUATIONS_COLLECTION), where('studentId', '==', studentId))
  );
  return snapshot.docs.map((item) => item.data() as CodingEvaluation);
}

export async function getCodingActivityProgress(
  studentId: string,
  lessonId: string,
  activityId: string
): Promise<CodingActivityProgress | null> {
  const progressId = `${studentId}_${lessonId}_${activityId}`;
  const progressDoc = await getDoc(doc(db, CODING_ACTIVITY_PROGRESS_COLLECTION, progressId));
  if (!progressDoc.exists()) {
    return null;
  }
  return progressDoc.data() as CodingActivityProgress;
}

export async function getProgressByStudentId(
  studentId: string
): Promise<CodingActivityProgress[]> {
  const snapshot = await getDocs(
    query(collection(db, CODING_ACTIVITY_PROGRESS_COLLECTION), where('studentId', '==', studentId))
  );
  return snapshot.docs.map((item) => item.data() as CodingActivityProgress);
}

export async function getProgressByLessonId(
  lessonId: string
): Promise<CodingActivityProgress[]> {
  const snapshot = await getDocs(
    query(collection(db, CODING_ACTIVITY_PROGRESS_COLLECTION), where('lessonId', '==', lessonId))
  );
  return snapshot.docs.map((item) => item.data() as CodingActivityProgress);
}

export function privateChallengeConfigId(
  lessonId: string,
  activityId: string,
  challengeVersion: number
): string {
  return `${lessonId}_${activityId}_${challengeVersion}`;
}

export async function setPrivateChallengeConfig(
  lessonId: string,
  activityId: string,
  challengeVersion: number,
  config: {
    privateTestCases: PrivateChallengeTestCase[];
    referenceSolutionsByLanguage?: PrivateChallengeConfiguration['referenceSolutionsByLanguage'];
  }
): Promise<void> {
  const configId = privateChallengeConfigId(lessonId, activityId, challengeVersion);
  await setDoc(doc(db, PRIVATE_CHALLENGE_CONFIG_COLLECTION, configId), {
    lessonId,
    activityId,
    challengeVersion,
    ...config,
    updatedAt: new Date().toISOString(),
  });
}

export async function getPrivateChallengeConfig(
  lessonId: string,
  activityId: string,
  challengeVersion: number
): Promise<(PrivateChallengeConfiguration & {
  lessonId: string;
  activityId: string;
  updatedAt?: string;
}) | null> {
  const configId = privateChallengeConfigId(lessonId, activityId, challengeVersion);
  const configDoc = await getDoc(doc(db, PRIVATE_CHALLENGE_CONFIG_COLLECTION, configId));
  if (!configDoc.exists()) {
    return null;
  }
  return configDoc.data() as PrivateChallengeConfiguration & {
    lessonId: string;
    activityId: string;
    updatedAt?: string;
  };
}

export async function canStudentSubmitAttempt(
  studentId: string,
  lessonId: string,
  activityId: string,
  policy: AttemptPolicy
): Promise<boolean> {
  const progress = await getCodingActivityProgress(studentId, lessonId, activityId);
  const currentAttempts = progress?.attempts || 0;
  return canSubmitAnotherAttempt(currentAttempts, policy);
}

export async function getAttemptCount(
  studentId: string,
  lessonId: string,
  activityId: string
): Promise<number> {
  const progress = await getCodingActivityProgress(studentId, lessonId, activityId);
  return progress?.attempts || 0;
}

/**
 * Authoritative evaluation/progress writes are reserved for a future trusted
 * execution service using the Admin SDK. These helpers exist so D3 can attach
 * to the same collections without changing client-callable APIs.
 */
export async function createCodingEvaluation(
  evaluation: CodingEvaluation
): Promise<string> {
  const validation = validateCodingEvaluation(evaluation);
  if (!validation.valid) {
    throw new Error(`Invalid evaluation: ${validation.errors.join(', ')}`);
  }

  const docRef = await addDoc(collection(db, CODING_EVALUATIONS_COLLECTION), evaluation);
  return docRef.id;
}

export async function upsertCodingActivityProgress(
  progress: Omit<CodingActivityProgress, 'updatedAt'>
): Promise<void> {
  const validation = validateCodingActivityProgress({
    ...progress,
    updatedAt: new Date().toISOString(),
  });
  if (!validation.valid) {
    throw new Error(`Invalid progress: ${validation.errors.join(', ')}`);
  }

  const progressId = `${progress.studentId}_${progress.lessonId}_${progress.activityId}`;
  await setDoc(doc(db, CODING_ACTIVITY_PROGRESS_COLLECTION, progressId), {
    ...progress,
    updatedAt: new Date().toISOString(),
  });
}
