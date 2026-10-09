import type { CoursePackage } from '@/types/models';
import { uploadPackageCoverImage } from '@/lib/packageCoverUpload';
import { createCoursePackage } from '@/lib/firestore/packageService';

type NewCoursePackage = Omit<CoursePackage, 'id' | 'createdAt' | 'updatedAt'>;

export async function createCoursePackageWithOptionalCover(
  packageData: NewCoursePackage,
  coverFile: File | null,
  idToken: string | undefined,
  isArabic: boolean
): Promise<string> {
  let coverImageUrl: string | undefined;

  if (coverFile) {
    if (!idToken) {
      throw new Error(isArabic ? 'يجب تسجيل الدخول لرفع صورة الغلاف.' : 'Sign in as a teacher to upload a cover image.');
    }
    coverImageUrl = await uploadPackageCoverImage(coverFile, idToken, isArabic);
  }

  return createCoursePackage({
    ...packageData,
    ...(coverImageUrl ? { coverImageUrl } : {}),
  });
}
