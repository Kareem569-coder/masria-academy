import { getAdminDb } from '@/lib/firebase-admin';
import { validateCodingEvaluation, validateCodingActivityProgress, type CodingEvaluation, type CodingActivityProgress } from '@/lib/coding/submission';

export const CODING_EVALUATIONS_COLLECTION = 'coding_evaluations';
export const CODING_ACTIVITY_PROGRESS_COLLECTION = 'coding_activity_progress';

/**
 * Persist a coding evaluation using server-side trusted access.
 * This must only be called from trusted server-side code.
 * Never from the browser.
 */
export async function createCodingEvaluation(evaluation: CodingEvaluation): Promise<string> {
  const validation = validateCodingEvaluation(evaluation);
  if (!validation.valid) {
    throw new Error(`Invalid evaluation: ${validation.errors.join(', ')}`);
  }

  const docRef = getAdminDb().collection(CODING_EVALUATIONS_COLLECTION).doc();
  await docRef.set(evaluation);
  return docRef.id;
}

/**
 * Retrieve a coding evaluation by ID using server-side access.
 */
export async function getCodingEvaluation(evaluationId: string): Promise<CodingEvaluation | null> {
  const doc = await getAdminDb().collection(CODING_EVALUATIONS_COLLECTION).doc(evaluationId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as CodingEvaluation;
}

/**
 * Retrieve evaluation by submission ID using server-side access.
 */
export async function getEvaluationBySubmissionId(submissionId: string): Promise<CodingEvaluation | null> {
  const snapshot = await getAdminDb()
    .collection(CODING_EVALUATIONS_COLLECTION)
    .where('submissionId', '==', submissionId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as CodingEvaluation;
}

/**
 * Upsert coding activity progress using server-side trusted access.
 * This must only be called from trusted server-side code.
 * Never from the browser.
 */
export async function upsertCodingActivityProgress(
  progress: Omit<CodingActivityProgress, 'updatedAt'>
): Promise<void> {
  const progressWithTimestamp: CodingActivityProgress = {
    ...progress,
    updatedAt: new Date().toISOString(),
  };

  const validation = validateCodingActivityProgress(progressWithTimestamp);
  if (!validation.valid) {
    throw new Error(`Invalid progress: ${validation.errors.join(', ')}`);
  }

  const progressId = `${progress.studentId}_${progress.lessonId}_${progress.activityId}`;
  await getAdminDb().collection(CODING_ACTIVITY_PROGRESS_COLLECTION).doc(progressId).set(progressWithTimestamp);
}

/**
 * Retrieve current progress using server-side access.
 */
export async function getCodingActivityProgress(
  studentId: string,
  lessonId: string,
  activityId: string
): Promise<CodingActivityProgress | null> {
  const progressId = `${studentId}_${lessonId}_${activityId}`;
  const doc = await getAdminDb().collection(CODING_ACTIVITY_PROGRESS_COLLECTION).doc(progressId).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as CodingActivityProgress;
}
