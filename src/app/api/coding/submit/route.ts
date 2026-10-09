import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import {
  validateCodingSubmission,
  canSubmitAnotherAttempt,
  type AttemptPolicy,
  MAX_SOURCE_CODE_LENGTH,
  type CodingSubmission,
} from '@/lib/coding/submission';
import { evaluateCodingSubmissionPipeline } from '@/lib/coding/pipeline';
import { createCodingEvaluation, upsertCodingActivityProgress, getCodingActivityProgress } from '@/lib/firestore/codingEvaluationService';
import { validateChallengeCompatibility, validatePrivateConfigCompatibility, deriveTrustedExecutionLimits } from '@/lib/coding/pipeline';
import { createRemoteExecutionService, RemoteExecutionService } from '@/lib/coding/executionClient';
import type { CodingChallengeActivity, PrivateChallengeConfiguration, Lesson } from '@/types/models';
import { isLessonAccessibleToStudent } from '@/lib/firestore/lessonMembership';

interface SubmitCodingRequest {
  lessonId: string;
  activityId: string;
  challengeVersion: number;
  language: string;
  sourceCode: string;
  idempotencyKey?: string;
}

/**
 * POST /api/coding/submit
 *
 * Trusted server-side endpoint for submitting coding solutions.
 * 
 * Request body:
 * {
 *   lessonId: string
 *   activityId: string
 *   challengeVersion: number
 *   language: string
 *   sourceCode: string
 *   idempotencyKey?: string (for idempotency)
 * }
 *
 * Response:
 * {
 *   submissionId: string
 *   evaluation: CodingEvaluation
 *   progress: CodingActivityProgress
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Extract and verify the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);

    // Verify the ID token
    let decodedToken;
    try {
      decodedToken = await getAdminAuth().verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired authentication token' },
        { status: 401 }
      );
    }

    const studentUid = decodedToken.uid;
    const studentEmail = decodedToken.email;

    // Verify the student is authenticated
    if (!studentUid || !studentEmail) {
      return NextResponse.json(
        { error: 'Missing student identification in token' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: SubmitCodingRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { lessonId, activityId, challengeVersion, language, sourceCode, idempotencyKey } = body;

    // Validate required fields
    if (!lessonId || !activityId || typeof challengeVersion !== 'number' || !language || !sourceCode) {
      return NextResponse.json(
        { error: 'Missing required fields: lessonId, activityId, challengeVersion, language, sourceCode' },
        { status: 400 }
      );
    }

    // Validate source code length
    if (sourceCode.length > MAX_SOURCE_CODE_LENGTH) {
      return NextResponse.json(
        { error: `Source code exceeds maximum length of ${MAX_SOURCE_CODE_LENGTH}` },
        { status: 400 }
      );
    }

    // Load lesson from Firestore
    const lessonDoc = await getAdminDb().collection('lessons').doc(lessonId).get();
    if (!lessonDoc.exists) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      );
    }

    const lesson = lessonDoc.data() as Lesson;

    const studentDoc = await getAdminDb().collection('users').doc(studentUid).get();
    const student = studentDoc.data() as { role?: string; status?: string; gradeLevel?: string } | undefined;
    if (!studentDoc.exists || student?.role !== 'student' || student.status !== 'active') {
      return NextResponse.json({ error: 'Active student account required' }, { status: 403 });
    }

    if (!student.gradeLevel || lesson.isPublished !== true || lesson.gradeLevel !== student.gradeLevel) {
      return NextResponse.json({ error: 'Lesson is not available to this student' }, { status: 403 });
    }

    const packageIds = Array.isArray(lesson.packageIds)
      ? [...new Set(lesson.packageIds.filter((packageId): packageId is string => typeof packageId === 'string'))]
      : typeof lesson.packageId === 'string' ? [lesson.packageId] : [];
    const ownedPackages: Array<{ id: string; gradeLevel: string; lessonIds: string[] }> = [];
    for (const packageId of packageIds) {
      const [accessSnapshot, packageSnapshot] = await Promise.all([
        getAdminDb().collection('studentPackageAccess').doc(`${studentUid}_${packageId}`).get(),
        getAdminDb().collection('coursePackages').doc(packageId).get(),
      ]);
      const access = accessSnapshot.data();
      const coursePackage = packageSnapshot.data();
      if (
        accessSnapshot.exists
        && access?.studentId === studentUid
        && access.packageId === packageId
        && access.status === 'active'
        && packageSnapshot.exists
        && coursePackage?.gradeLevel === lesson.gradeLevel
      ) {
        ownedPackages.push({
          id: packageId,
          gradeLevel: String(coursePackage.gradeLevel),
          lessonIds: Array.isArray(coursePackage.lessonIds) ? coursePackage.lessonIds.filter((id: unknown): id is string => typeof id === 'string') : [],
        });
      }
    }
    if (!isLessonAccessibleToStudent(lesson, student.gradeLevel, ownedPackages)) {
      return NextResponse.json({ error: 'Lesson is not available to this student' }, { status: 403 });
    }

    // Verify lesson contains the activity
    const activity = lesson.activities?.find((a: any) => a.id === activityId);
    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found in lesson' },
        { status: 404 }
      );
    }

    // Verify activity is a coding challenge
    if (activity.type !== 'CODING_CHALLENGE') {
      return NextResponse.json(
        { error: 'Activity is not a coding challenge' },
        { status: 400 }
      );
    }

    const challenge = activity as CodingChallengeActivity;

    // Verify challenge version matches
    if (challenge.challengeVersion !== challengeVersion) {
      return NextResponse.json(
        { error: `Challenge version mismatch: expected ${challenge.challengeVersion}, got ${challengeVersion}` },
        { status: 409 }
      );
    }

    // Verify language is allowed
    if (!challenge.allowedLanguages.includes(language as any)) {
      return NextResponse.json(
        { error: `Language ${language} is not allowed for this challenge` },
        { status: 400 }
      );
    }

    // Get or create progress to check attempt limit
    let currentProgress = await getCodingActivityProgress(studentUid, lessonId, activityId);
    
    // Check attempt policy
    const attemptPolicy: AttemptPolicy = challenge.maxAttempts 
      ? { mode: 'limited', maxAttempts: challenge.maxAttempts }
      : { mode: 'unlimited' };

    const currentAttempts = currentProgress?.attempts ?? 0;
    if (!canSubmitAnotherAttempt(currentAttempts, attemptPolicy)) {
      return NextResponse.json(
        { error: 'Attempt limit exceeded' },
        { status: 409 }
      );
    }

    // Check for idempotent duplicate submission
    if (idempotencyKey) {
      const existingSubmissions = await getAdminDb()
        .collection('coding_submissions')
        .where('idempotencyKey', '==', idempotencyKey)
        .where('studentId', '==', studentUid)
        .limit(1)
        .get();

      if (!existingSubmissions.empty) {
        // Return existing evaluation if available
        const existingSubmission = existingSubmissions.docs[0].data() as CodingSubmission;
        const existingEvaluation = await getAdminDb()
          .collection('coding_evaluations')
          .where('submissionId', '==', existingSubmission.id)
          .limit(1)
          .get();

        if (!existingEvaluation.empty) {
          const evaluation = existingEvaluation.docs[0].data();
          const progress = await getCodingActivityProgress(studentUid, lessonId, activityId);
          return NextResponse.json(
            { submissionId: existingSubmission.id, evaluation, progress },
            { status: 200 }
          );
        }
      }
    }

    // Create the coding submission
    const submissionRef = getAdminDb().collection('coding_submissions').doc();
    const submissionData: CodingSubmission = {
      id: submissionRef.id,
      studentId: studentUid,
      lessonId,
      activityId,
      challengeVersion,
      language: language as any,
      sourceCode,
      status: 'queued',
      submittedAt: new Date().toISOString(),
      ...(idempotencyKey && { idempotencyKey }),
    };

    // Validate submission data
    const submissionValidation = validateCodingSubmission(submissionData);
    if (!submissionValidation.valid) {
      return NextResponse.json(
        { error: `Invalid submission: ${submissionValidation.errors.join(', ')}` },
        { status: 400 }
      );
    }

    await submissionRef.set(submissionData);

    // Load private challenge configuration
    const configId = `${lessonId}_${activityId}_${challengeVersion}`;
    const configDoc = await getAdminDb().collection('private_challenge_config').doc(configId).get();
    let privateConfig: PrivateChallengeConfiguration | null = null;

    if (configDoc.exists) {
      privateConfig = configDoc.data() as PrivateChallengeConfiguration;
    } else {
      // If no private config, create a minimal one with just public tests
      privateConfig = {
        challengeVersion,
        privateTestCases: [],
      };
    }

    // Create execution service client
    let executionService: RemoteExecutionService;
    try {
      executionService = createRemoteExecutionService();
    } catch (error) {
      console.error('Failed to initialize execution service:', error);
      return NextResponse.json(
        { error: 'Execution service is unavailable' },
        { status: 503 }
      );
    }

    // Run the D3D pipeline
    const pipelineResult = await evaluateCodingSubmissionPipeline(
      submissionData,
      challenge,
      privateConfig,
      executionService,
      {
        outputComparisonPolicy: 'trim-trailing-whitespace',
        attemptPolicy,
        currentAttemptCount: currentAttempts,
        currentProgress: currentProgress ?? undefined,
        trustedExecutionLimits: deriveTrustedExecutionLimits(challenge),
      }
    );

    // Persist the evaluation
    await createCodingEvaluation(pipelineResult.evaluation);

    // Persist the progress
    await upsertCodingActivityProgress({
      studentId: pipelineResult.progress.studentId,
      lessonId: pipelineResult.progress.lessonId,
      activityId: pipelineResult.progress.activityId,
      challengeVersion: pipelineResult.progress.challengeVersion,
      status: pipelineResult.progress.status,
      bestScorePercent: pipelineResult.progress.bestScorePercent,
      attempts: pipelineResult.progress.attempts,
      passed: pipelineResult.progress.passed,
      lastSubmissionId: pipelineResult.progress.lastSubmissionId,
    });

    return NextResponse.json(
      {
        submissionId: submissionData.id,
        evaluation: pipelineResult.evaluation,
        progress: pipelineResult.progress,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error processing coding submission:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    // Check if error is due to execution service being unavailable
    if (message.includes('Execution service') || message.includes('SYSTEM_ERROR')) {
      return NextResponse.json(
        { error: 'Execution service is unavailable' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
