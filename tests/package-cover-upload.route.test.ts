import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyIdToken, getApps, initializeApp, getAuth } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
}));

vi.mock('firebase-admin/app', () => ({ getApps, initializeApp }));
vi.mock('firebase-admin/auth', () => ({ getAuth }));

import { POST } from '@/app/api/package-covers/upload/route';

const allowedTeacher = { uid: 'teacher-1', email: 'aymankareem548@gmail.com' };

function uploadRequest(file: File, token = 'valid-id-token') {
  const formData = new FormData();
  formData.set('image', file);
  return new Request('http://localhost/api/package-covers/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
}

describe('package cover ImgBB upload route', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'masria-16b8f';
    process.env.IMGBB_API_KEY = 'server-test-key';
    getApps.mockReturnValue([{ name: 'masria-package-cover-auth' }]);
    getAuth.mockReturnValue({ verifyIdToken });
    verifyIdToken.mockResolvedValue(allowedTeacher);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uploads as an authorized teacher and returns only the hosted image URL', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        url: 'https://i.ibb.co/example/cover.png',
        delete_url: 'https://ibb.co/delete-secret',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', upstreamFetch);

    const response = await POST(uploadRequest(new File(['image-bytes'], 'cover.png', { type: 'image/png' })));
    const responseBody = await response.json();
    const upstreamForm = upstreamFetch.mock.calls[0][1].body as FormData;

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ url: 'https://i.ibb.co/example/cover.png' });
    expect(upstreamForm.get('key')).toBe('server-test-key');
    expect(upstreamForm.get('image')).toBeInstanceOf(File);
    expect(JSON.stringify(responseBody)).not.toContain('server-test-key');
    expect(JSON.stringify(responseBody)).not.toContain('delete_url');
  });

  it('rejects invalid files before contacting ImgBB', async () => {
    const upstreamFetch = vi.fn();
    vi.stubGlobal('fetch', upstreamFetch);

    const response = await POST(uploadRequest(new File(['text'], 'note.txt', { type: 'text/plain' })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_IMAGE' });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('rejects files larger than 4 MB before contacting ImgBB', async () => {
    const upstreamFetch = vi.fn();
    vi.stubGlobal('fetch', upstreamFetch);

    const response = await POST(uploadRequest(new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'IMAGE_TOO_LARGE' });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('reports missing ImgBB configuration without exposing server values', async () => {
    delete process.env.IMGBB_API_KEY;

    const response = await POST(uploadRequest(new File(['image-bytes'], 'cover.png', { type: 'image/png' })));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'UPLOAD_NOT_CONFIGURED' });
  });

  it('rejects non-teachers and missing authentication', async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: 'student-1', email: 'student@example.com' });

    const forbidden = await POST(uploadRequest(new File(['image'], 'cover.png', { type: 'image/png' })));
    const unauthorized = await POST(uploadRequest(new File(['image'], 'cover.png', { type: 'image/png' }), ''));

    expect(forbidden.status).toBe(403);
    expect(unauthorized.status).toBe(401);
  });

  it('returns a generic error when ImgBB fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream secret response', { status: 500 })));

    const response = await POST(uploadRequest(new File(['image'], 'cover.png', { type: 'image/png' })));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'UPLOAD_FAILED' });
  });
});
