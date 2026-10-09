import { NextResponse } from 'next/server';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { isTeacherEmail } from '@/lib/authorization';

export const runtime = 'nodejs';

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD_BYTES = 32 * 1024;
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';
const AUTH_APP_NAME = 'masria-package-cover-auth';

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function getHostedImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const rawUrl = (data as { url?: unknown }).url;
  if (typeof rawUrl !== 'string') return null;

  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && url.hostname === 'i.ibb.co' ? url.href : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return errorResponse('UNAUTHORIZED', 401);
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return errorResponse('UPLOAD_NOT_CONFIGURED', 503);
  }

  let adminAuth;
  try {
    const authApp = getApps().find((app) => app.name === AUTH_APP_NAME)
      ?? initializeApp({ projectId }, AUTH_APP_NAME);
    adminAuth = getAuth(authApp);
  } catch {
    return errorResponse('UPLOAD_NOT_CONFIGURED', 503);
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authorization.slice('Bearer '.length));
  } catch {
    return errorResponse('UNAUTHORIZED', 401);
  }

  if (!isTeacherEmail(decodedToken.email)) {
    return errorResponse('FORBIDDEN', 403);
  }

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    return errorResponse('UPLOAD_NOT_CONFIGURED', 503);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES) {
    return errorResponse('IMAGE_TOO_LARGE', 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('INVALID_IMAGE', 400);
  }

  const image = formData.get('image');
  if (!(image instanceof File) || !image.type.startsWith('image/') || image.size === 0) {
    return errorResponse('INVALID_IMAGE', 400);
  }
  if (image.size > MAX_IMAGE_SIZE_BYTES) {
    return errorResponse('IMAGE_TOO_LARGE', 413);
  }

  const imgbbForm = new FormData();
  imgbbForm.set('key', apiKey);
  imgbbForm.set('image', image, image.name || 'package-cover');

  try {
    const imgbbResponse = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: imgbbForm,
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });
    if (!imgbbResponse.ok) {
      return errorResponse('UPLOAD_FAILED', 502);
    }

    const hostedImageUrl = getHostedImageUrl(await imgbbResponse.json());
    if (!hostedImageUrl) {
      return errorResponse('UPLOAD_FAILED', 502);
    }

    return NextResponse.json({ url: hostedImageUrl });
  } catch {
    return errorResponse('UPLOAD_FAILED', 502);
  }
}
