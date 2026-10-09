export const MAX_PACKAGE_COVER_SIZE_BYTES = 4 * 1024 * 1024;

export function getPackageCoverFileError(file: Pick<File, 'type' | 'size'>, isArabic = false): string | null {
  if (!file.type.startsWith('image/')) {
    return isArabic ? 'اختر ملف صورة صالحًا.' : 'Choose a valid image file.';
  }

  if (file.size <= 0) {
    return isArabic ? 'ملف الصورة فارغ.' : 'The image file is empty.';
  }

  if (file.size > MAX_PACKAGE_COVER_SIZE_BYTES) {
    return isArabic
      ? 'يجب ألا يتجاوز حجم صورة الغلاف 4 ميجابايت.'
      : 'The cover image must be 4 MB or smaller.';
  }

  return null;
}

const uploadErrors: Record<string, { en: string; ar: string }> = {
  INVALID_IMAGE: { en: 'Choose a valid image file.', ar: 'اختر ملف صورة صالحًا.' },
  IMAGE_TOO_LARGE: { en: 'The cover image must be 4 MB or smaller.', ar: 'يجب ألا يتجاوز حجم صورة الغلاف 4 ميجابايت.' },
  UPLOAD_NOT_CONFIGURED: { en: 'Image upload is not configured. Contact support.', ar: 'رفع الصور غير مهيأ حاليًا. تواصل مع الدعم.' },
  UNAUTHORIZED: { en: 'Sign in again before uploading a cover image.', ar: 'سجّل الدخول مجددًا قبل رفع صورة الغلاف.' },
  FORBIDDEN: { en: 'Only authorized teachers can upload package covers.', ar: 'يمكن للمدرسين المصرح لهم فقط رفع صور الباقات.' },
  UPLOAD_FAILED: { en: 'The image could not be uploaded. Try again.', ar: 'تعذر رفع الصورة. حاول مرة أخرى.' },
};

function getUploadErrorMessage(code: unknown, isArabic: boolean): string {
  const messages = typeof code === 'string' ? uploadErrors[code] : undefined;
  return messages ? (isArabic ? messages.ar : messages.en) : uploadErrors.UPLOAD_FAILED[isArabic ? 'ar' : 'en'];
}

export async function uploadPackageCoverImage(file: File, idToken: string, isArabic = false): Promise<string> {
  const validationError = getPackageCoverFileError(file, isArabic);
  if (validationError) throw new Error(validationError);

  const formData = new FormData();
  formData.set('image', file, file.name);

  let response: Response;
  try {
    response = await fetch('/api/package-covers/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });
  } catch {
    throw new Error(getUploadErrorMessage('UPLOAD_FAILED', isArabic));
  }

  let payload: { url?: unknown; error?: unknown };
  try {
    payload = await response.json() as { url?: unknown; error?: unknown };
  } catch {
    throw new Error(getUploadErrorMessage('UPLOAD_FAILED', isArabic));
  }

  if (!response.ok || typeof payload.url !== 'string') {
    throw new Error(getUploadErrorMessage(payload.error, isArabic));
  }

  return payload.url;
}
