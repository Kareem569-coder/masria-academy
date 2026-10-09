import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoursePackage } from '@/types/models';

const { createCoursePackage, uploadPackageCoverImage } = vi.hoisted(() => ({
  createCoursePackage: vi.fn(),
  uploadPackageCoverImage: vi.fn(),
}));

vi.mock('@/lib/firestore/packageService', () => ({ createCoursePackage }));
vi.mock('@/lib/packageCoverUpload', () => ({ uploadPackageCoverImage }));

import { createCoursePackageWithOptionalCover } from '@/lib/firestore/packageCreation';

const packageData: Omit<CoursePackage, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'October package',
  gradeLevel: 'Sec 1',
  isActive: true,
  createdBy: 'teacher-uid',
};

describe('package creation with an optional ImgBB cover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCoursePackage.mockResolvedValue('package-id');
  });

  it('creates without a cover and omits coverImageUrl', async () => {
    await createCoursePackageWithOptionalCover(packageData, null, undefined, false);

    expect(uploadPackageCoverImage).not.toHaveBeenCalled();
    expect(createCoursePackage).toHaveBeenCalledWith(packageData);
    expect(createCoursePackage.mock.calls[0][0]).not.toHaveProperty('coverImageUrl');
  });

  it('saves the returned ImgBB URL on the package', async () => {
    const image = new File(['cover'], 'cover.png', { type: 'image/png' });
    uploadPackageCoverImage.mockResolvedValue('https://i.ibb.co/example/cover.png');

    await createCoursePackageWithOptionalCover(packageData, image, 'firebase-id-token', false);

    expect(uploadPackageCoverImage).toHaveBeenCalledWith(image, 'firebase-id-token', false);
    expect(createCoursePackage).toHaveBeenCalledWith({
      ...packageData,
      coverImageUrl: 'https://i.ibb.co/example/cover.png',
    });
  });

  it('does not create a package if the image upload fails', async () => {
    uploadPackageCoverImage.mockRejectedValue(new Error('Image upload failed'));

    await expect(createCoursePackageWithOptionalCover(
      packageData,
      new File(['cover'], 'cover.png', { type: 'image/png' }),
      'firebase-id-token',
      false
    )).rejects.toThrow('Image upload failed');

    expect(createCoursePackage).not.toHaveBeenCalled();
  });
});
