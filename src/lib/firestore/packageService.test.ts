/**
 * Package Service Tests
 *
 * Tests for course package and access code functionality.
 * These tests verify:
 * - Package creation and retrieval
 * - Access code generation
 * - Access code redemption (atomic transaction)
 * - Security scenarios (wrong grade, already used, invalid codes)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createLesson, deleteLesson, updateLesson } from '@/lib/firestore/lessonService';
import {
  createCoursePackage,
  getCoursePackageById,
  getActivePackagesByGradeLevel,
  getAllCoursePackages,
  updateCoursePackage,
  deactivateCoursePackage,
  deleteCoursePackage,
  generatePackageAccessCode,
  generatePackageAccessCodes,
  getAccessCodesByPackage,
  disablePackageAccessCode,
  redeemPackageAccessCode,
  getStudentPackages,
  getStudentPackageAccesses,
  hasLessonAccess,
  getAccessibleLessonsForStudent,
} from './packageService';
import type { Lesson } from '@/types/models';

const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (firestoreEmulatorHost) {
  const [host, port] = firestoreEmulatorHost.split(':');
  connectFirestoreEmulator(db, host, Number(port), { mockUserToken: 'owner' });
}

const packageServiceDescribe = firestoreEmulatorHost ? describe : describe.skip;

const seedStudent = (studentId: string, gradeLevel: string) => setDoc(doc(db, 'users', studentId), {
  name: studentId,
  email: `${studentId}@example.test`,
  role: 'student',
  status: 'active',
  gradeLevel,
});

packageServiceDescribe('Package Service', () => {
  beforeEach(async () => {
    await Promise.all([
      seedStudent('test-student-uid', 'Grade 4'),
      seedStudent('student-1', 'Grade 4'),
      seedStudent('student-2', 'Grade 4'),
      seedStudent('first-secondary-new', 'Sec 1'),
      seedStudent('second-secondary-student', 'Sec 2'),
    ]);
  });

  describe('Package Operations', () => {
    it('should create a course package', async () => {
      const packageData = {
        name: 'Test Package',
        gradeLevel: 'Grade 4',
        description: 'Test description',
        isActive: true,
        createdBy: 'test-teacher-uid',
      };

      const packageId = await createCoursePackage(packageData);
      expect(packageId).toBeTruthy();
      expect(typeof packageId).toBe('string');
    });

    it('creates a package when the optional cover image is omitted', async () => {
      const packageId = await createCoursePackage({
        name: 'Package without cover',
        gradeLevel: 'Grade 4',
        isActive: true,
        createdBy: 'test-teacher-uid',
      });

      const createdPackage = await getCoursePackageById(packageId);
      expect(createdPackage).not.toBeNull();
      expect(createdPackage).not.toHaveProperty('coverImageUrl');
    });

    it('should fetch a package by ID', async () => {
      // First create a package
      const packageData = {
        name: 'Test Package',
        gradeLevel: 'Grade 5',
        description: 'Test description',
        isActive: true,
        createdBy: 'test-teacher-uid',
      };
      const packageId = await createCoursePackage(packageData);

      // Then fetch it
      const pkg = await getCoursePackageById(packageId);
      expect(pkg).not.toBeNull();
      expect(pkg?.name).toBe('Test Package');
      expect(pkg?.gradeLevel).toBe('Grade 5');
    });

    it('should return null for non-existent package', async () => {
      const pkg = await getCoursePackageById('non-existent-id');
      expect(pkg).toBeNull();
    });

    it('should fetch active packages by grade level', async () => {
      // Create packages for different grades
      await createCoursePackage({
        name: 'Grade 4 Package',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      await createCoursePackage({
        name: 'Grade 5 Package',
        gradeLevel: 'Grade 5',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const grade4Packages = await getActivePackagesByGradeLevel('Grade 4');
      expect(grade4Packages.length).toBeGreaterThan(0);
      expect(grade4Packages.every((p) => p.gradeLevel === 'Grade 4')).toBe(true);
      expect(grade4Packages.every((p) => p.isActive === true)).toBe(true);
    });

    it('should fetch all packages', async () => {
      await createCoursePackage({
        name: 'All Packages Test',
        gradeLevel: 'Grade 6',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const allPackages = await getAllCoursePackages();
      expect(allPackages.length).toBeGreaterThan(0);
    });

    it('should update a package', async () => {
      const packageId = await createCoursePackage({
        name: 'Original Name',
        gradeLevel: 'Grade 4',
        description: 'Original',
        isActive: true,
        createdBy: 'test-teacher',
      });

      await updateCoursePackage(packageId, {
        name: 'Updated Name',
        description: 'Updated description',
      });

      const updated = await getCoursePackageById(packageId);
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Updated description');
    });

    it('should deactivate a package', async () => {
      const packageId = await createCoursePackage({
        name: 'To Deactivate',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      await deactivateCoursePackage(packageId);

      const pkg = await getCoursePackageById(packageId);
      expect(pkg?.isActive).toBe(false);
    });

    it('should delete a package', async () => {
      const packageId = await createCoursePackage({
        name: 'To Delete',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      await deleteCoursePackage(packageId);

      const pkg = await getCoursePackageById(packageId);
      expect(pkg).toBeNull();
    });
  });

  describe('Package lesson relationship', () => {
    it('strips private challenge data before creating or updating a package lesson', async () => {
      const packageId = await createCoursePackage({
        name: 'Private challenge sanitization',
        gradeLevel: 'Grade 4',
        isActive: true,
        createdBy: 'test-teacher',
      });
      const privateActivities = [{
        id: 'private-challenge',
        type: 'CODING_CHALLENGE',
        title_en: 'Hidden tests challenge',
        title_ar: 'تحدي الاختبارات المخفية',
        order: 1,
        challengeVersion: 1,
        privateTestCases: [{ id: 'hidden', input: 'secret input', expectedOutput: 'secret output' }],
        referenceSolutionsByLanguage: [{ language: 'cpp17', starterCode: 'secret solution' }],
      }] as unknown as Lesson['activities'];

      const lessonId = await createLesson({
        title_en: 'Private challenge lesson',
        title_ar: 'درس تحدي خاص',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Grade 4',
        packageId,
        activities: privateActivities,
      });
      const createdLesson = await getDoc(doc(db, 'lessons', lessonId));
      let savedActivity = createdLesson.data()?.activities?.[0] as Record<string, unknown>;
      expect(savedActivity).not.toHaveProperty('privateTestCases');
      expect(savedActivity).not.toHaveProperty('referenceSolutionsByLanguage');

      await updateLesson(lessonId, { activities: privateActivities });
      const updatedLesson = await getDoc(doc(db, 'lessons', lessonId));
      savedActivity = updatedLesson.data()?.activities?.[0] as Record<string, unknown>;
      expect(savedActivity).not.toHaveProperty('privateTestCases');
      expect(savedActivity).not.toHaveProperty('referenceSolutionsByLanguage');
      expect((await getCoursePackageById(packageId))?.lessonIds).toContain(lessonId);
    });

    it('creates, moves, and deletes package lessons atomically with package.lessonIds', async () => {
      const firstPackageId = await createCoursePackage({
        name: 'Sec 1 October',
        gradeLevel: 'Sec 1',
        isActive: true,
        createdBy: 'test-teacher',
      });
      const secondPackageId = await createCoursePackage({
        name: 'Sec 1 November',
        gradeLevel: 'Sec 1',
        isActive: true,
        createdBy: 'test-teacher',
      });

      await expect(createLesson({
        title_en: 'Wrong-grade package relationship',
        title_ar: 'علاقة باقة بصف مختلف',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Sec 2',
        packageId: firstPackageId,
      })).rejects.toThrow('Lesson grade must match its course package grade.');

      const lessonId = await createLesson({
        title_en: 'Package relationship test',
        title_ar: 'اختبار علاقة الدرس بالباقة',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Sec 1',
        isPublished: true,
        packageId: firstPackageId,
      });

      let lesson = await getDoc(doc(db, 'lessons', lessonId));
      let firstPackage = await getCoursePackageById(firstPackageId);
      expect(lesson.data()?.packageId).toBe(firstPackageId);
      expect(firstPackage?.lessonIds).toContain(lessonId);

      await expect(updateLesson(lessonId, { gradeLevel: 'Sec 2' }))
        .rejects.toThrow('Lesson grade must match its course package grade.');
      lesson = await getDoc(doc(db, 'lessons', lessonId));
      expect(lesson.data()?.gradeLevel).toBe('Sec 1');

      await updateLesson(lessonId, { packageId: secondPackageId });
      lesson = await getDoc(doc(db, 'lessons', lessonId));
      firstPackage = await getCoursePackageById(firstPackageId);
      const secondPackage = await getCoursePackageById(secondPackageId);
      expect(lesson.data()?.packageId).toBe(secondPackageId);
      expect(firstPackage?.lessonIds).not.toContain(lessonId);
      expect(secondPackage?.lessonIds).toContain(lessonId);

      await deleteLesson(lessonId);
      lesson = await getDoc(doc(db, 'lessons', lessonId));
      const packageAfterDelete = await getCoursePackageById(secondPackageId);
      expect(lesson.exists()).toBe(false);
      expect(packageAfterDelete?.lessonIds).not.toContain(lessonId);
    });
  });

  describe('Access Code Operations', () => {
    it('should generate an access code', async () => {
      const packageId = await createCoursePackage({
        name: 'Code Test Package',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const code = await generatePackageAccessCode(packageId);
      expect(code).toBeTruthy();
      expect(code.code).toMatch(/^MASRIA-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(code.packageId).toBe(packageId);
      expect(code.active).toBe(true);
      expect(code.usedBy).toBeUndefined();
      expect(code.usedAt).toBeUndefined();
    });

    it('should fetch access codes for a package', async () => {
      const packageId = await createCoursePackage({
        name: 'Fetch Codes Package',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      await generatePackageAccessCode(packageId);
      await generatePackageAccessCode(packageId);

      const codes = await getAccessCodesByPackage(packageId);
      expect(codes.length).toBeGreaterThanOrEqual(2);
      expect(codes.every((c) => c.packageId === packageId)).toBe(true);
    });

    it('should generate several access codes at once for a package', async () => {
      const packageId = await createCoursePackage({
        name: 'Bulk Codes Package',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const codes = await generatePackageAccessCodes(packageId, 3);

      expect(codes).toHaveLength(3);
      expect(codes.every((code) => code.packageId === packageId)).toBe(true);
      expect(codes.every((code) => code.active)).toBe(true);
    });

    it('should disable an individual access code without deleting it', async () => {
      const packageId = await createCoursePackage({
        name: 'Disabled Code Package',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const code = await generatePackageAccessCode(packageId);
      await disablePackageAccessCode(code.code);

      const codes = await getAccessCodesByPackage(packageId);
      const disabledCode = codes.find((entry) => entry.code === code.code);

      expect(disabledCode).toBeTruthy();
      expect(disabledCode?.active).toBe(false);
      expect(disabledCode?.status).toBe('disabled');
    });
  });

  describe('Access Code Redemption', () => {
    it('should successfully redeem a valid access code', async () => {
      const packageId = await createCoursePackage({
        name: 'Redeem Test Package',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const code = await generatePackageAccessCode(packageId);

      const result = await redeemPackageAccessCode(
        code.code,
        'test-student-uid',
        'Grade 4'
      );

      expect(result.success).toBe(true);
      expect(result.packageId).toBe(packageId);
      expect((await getStudentPackages('test-student-uid')).map((pkg) => pkg.id)).toContain(packageId);
      const [ownership] = await getStudentPackageAccesses('test-student-uid');
      expect(ownership.packageId).toBe(packageId);
      expect(ownership.status).toBe('active');
      expect(ownership).not.toHaveProperty('expiresAt');
    });

    it('should fail to redeem an invalid code', async () => {
      const result = await redeemPackageAccessCode(
        'INVALID-CODE',
        'test-student-uid',
        'Grade 4'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid access code');
    });

    it('should fail to redeem a code for wrong grade level', async () => {
      const packageId = await createCoursePackage({
        name: 'Grade 5 Package',
        gradeLevel: 'Grade 5',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const code = await generatePackageAccessCode(packageId);

      const result = await redeemPackageAccessCode(
        code.code,
        'test-student-uid',
        'Grade 4' // Wrong grade
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('different grade level');
    });

    it('rejects a First Secondary student redeeming a Second Secondary code', async () => {
      const packageId = await createCoursePackage({
        name: 'Second Secondary monthly package',
        gradeLevel: 'Sec 2',
        month: 'October',
        isActive: true,
        createdBy: 'test-teacher',
      });
      const code = await generatePackageAccessCode(packageId);

      const result = await redeemPackageAccessCode(code.code, 'first-secondary-new', 'Sec 1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('different grade level');
      expect(await getStudentPackages('first-secondary-new')).toEqual([]);
    });

    it('should fail to redeem an already used code', async () => {
      const packageId = await createCoursePackage({
        name: 'Single Use Package',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const code = await generatePackageAccessCode(packageId);

      // First redemption
      await redeemPackageAccessCode(code.code, 'student-1', 'Grade 4');

      // Second redemption should fail
      const result = await redeemPackageAccessCode(code.code, 'student-2', 'Grade 4');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already been used');
    });

    it('should fail to redeem code for inactive package', async () => {
      const packageId = await createCoursePackage({
        name: 'Inactive Package',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const code = await generatePackageAccessCode(packageId);

      // Deactivate the package
      await deactivateCoursePackage(packageId);

      const result = await redeemPackageAccessCode(code.code, 'test-student-uid', 'Grade 4');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });

    it('should fail if student already has access to package', async () => {
      const packageId = await createCoursePackage({
        name: 'Already Owned Package',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const code = await generatePackageAccessCode(packageId);

      // First redemption
      await redeemPackageAccessCode(code.code, 'test-student-uid', 'Grade 4');

      // Try to redeem again (student already has access)
      const code2 = await generatePackageAccessCode(packageId);
      const result = await redeemPackageAccessCode(code2.code, 'test-student-uid', 'Grade 4');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already have access');
    });
  });

  describe('Student Package Operations', () => {
    it('should fetch packages accessible to a student', async () => {
      const packageId = await createCoursePackage({
        name: 'Student Access Package',
        gradeLevel: 'Grade 4',
        description: 'Test',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const code = await generatePackageAccessCode(packageId);
      await redeemPackageAccessCode(code.code, 'test-student-uid', 'Grade 4');

      const packages = await getStudentPackages('test-student-uid');
      expect(packages.length).toBeGreaterThan(0);
      expect(packages.some((p) => p.id === packageId)).toBe(true);
    });

    it('shows active packages for the selected grade separately from an empty owned list', async () => {
      const octoberId = await createCoursePackage({
        name: 'October',
        gradeLevel: 'Sec 1',
        month: 'October',
        isActive: true,
        createdBy: 'test-teacher',
      });
      const novemberId = await createCoursePackage({
        name: 'November',
        gradeLevel: 'Sec 1',
        month: 'November',
        isActive: true,
        createdBy: 'test-teacher',
      });
      await createCoursePackage({
        name: 'Other grade package',
        gradeLevel: 'Sec 2',
        month: 'October',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const available = await getActivePackagesByGradeLevel('Sec 1');
      const owned = await getStudentPackages('first-secondary-new');

      expect(available.map((pkg) => pkg.id)).toEqual(expect.arrayContaining([octoberId, novemberId]));
      expect(available.every((pkg) => pkg.gradeLevel === 'Sec 1' && pkg.isActive)).toBe(true);
      expect(owned).toEqual([]);
    });

    it('does not include active packages for another grade level', async () => {
      const firstSecondaryId = await createCoursePackage({
        name: 'October First Secondary',
        gradeLevel: 'Sec 1',
        isActive: true,
        createdBy: 'test-teacher',
      });
      const secondSecondaryId = await createCoursePackage({
        name: 'October Second Secondary',
        gradeLevel: 'Sec 2',
        isActive: true,
        createdBy: 'test-teacher',
      });

      const firstSecondaryPackages = await getActivePackagesByGradeLevel('Sec 1');
      const secondSecondaryPackages = await getActivePackagesByGradeLevel('Sec 2');

      expect(firstSecondaryPackages.map((pkg) => pkg.id)).toContain(firstSecondaryId);
      expect(firstSecondaryPackages.map((pkg) => pkg.id)).not.toContain(secondSecondaryId);
      expect(secondSecondaryPackages.map((pkg) => pkg.id)).toContain(secondSecondaryId);
      expect(secondSecondaryPackages.map((pkg) => pkg.id)).not.toContain(firstSecondaryId);
    });

    it('shows package lessons immediately after successful redemption on the next fetch', async () => {
      const packageId = await createCoursePackage({
        name: 'Sec 1 October',
        gradeLevel: 'Sec 1',
        month: 'October',
        isActive: true,
        createdBy: 'test-teacher',
      });
      const lessonId = 'sec-1-october-package-lesson';
      await setDoc(doc(db, 'lessons', lessonId), {
        title_en: 'October lesson',
        title_ar: 'درس أكتوبر',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Sec 1',
        isPublished: true,
        packageId,
      });
      await updateDoc(doc(db, 'coursePackages', packageId), { lessonIds: [lessonId] });

      expect(await getAccessibleLessonsForStudent('first-secondary-new', 'Sec 1')).toEqual([]);

      const code = await generatePackageAccessCode(packageId);
      const redemption = await redeemPackageAccessCode(code.code, 'first-secondary-new', 'Sec 1');
      expect(redemption.success).toBe(true);

      const [ownedPackages, accessibleLessons] = await Promise.all([
        getStudentPackages('first-secondary-new'),
        getAccessibleLessonsForStudent('first-secondary-new', 'Sec 1'),
      ]);
      expect(ownedPackages.map((pkg) => pkg.id)).toContain(packageId);
      expect(accessibleLessons.map((lesson) => lesson.id)).toContain(lessonId);
    });

    it('loads the reported Sec 1 lesson from its owned package', async () => {
      const studentId = 'first-secondary-new';
      const packageId = 'Fl8jh0TeNPTwrbuAVMIM';
      const lessonId = 'zl0J8ASCB58FKItnDFD';
      await setDoc(doc(db, 'coursePackages', packageId), {
        id: packageId,
        name: 'Sec 1 owned package',
        gradeLevel: 'Sec 1',
        lessonIds: [lessonId],
        isActive: true,
      });
      await setDoc(doc(db, 'studentPackageAccess', `${studentId}_${packageId}`), {
        id: `${studentId}_${packageId}`,
        studentId,
        packageId,
        status: 'active',
        activatedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'lessons', lessonId), {
        title_en: 'Reported Sec 1 lesson',
        title_ar: 'درس الصف الأول الثانوي',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Sec 1',
        isPublished: true,
        packageId,
      });

      const lessons = await getAccessibleLessonsForStudent(studentId, 'Sec 1');
      expect(lessons.map((lesson) => lesson.id)).toContain(lessonId);
    });

    it('keeps valid package lessons when another lesson reference points to a missing document', async () => {
      const studentId = 'first-secondary-new';
      const packageId = 'package-with-broken-lesson-reference';
      const lessonId = 'valid-lesson-next-to-broken-reference';
      const missingLessonId = 'missing-lesson-01';
      await setDoc(doc(db, 'coursePackages', packageId), {
        id: packageId,
        name: 'Package with one broken lesson reference',
        gradeLevel: 'Sec 1',
        lessonIds: [missingLessonId, lessonId],
        isActive: true,
      });
      await setDoc(doc(db, 'studentPackageAccess', `${studentId}_${packageId}`), {
        id: `${studentId}_${packageId}`,
        studentId,
        packageId,
        status: 'active',
        activatedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'lessons', lessonId), {
        title_en: 'Valid lesson',
        title_ar: 'درس صالح',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Sec 1',
        isPublished: true,
        packageId,
      });

      const lessons = await getAccessibleLessonsForStudent(studentId, 'Sec 1');
      expect(lessons.map((lesson) => lesson.id)).toEqual([lessonId]);
    });

    it('should keep each monthly package permanently unlocked and preserve earlier access', async () => {
      await seedStudent('test-student-uid', 'Sec 2');
      const octoberId = await createCoursePackage({
        name: 'October',
        gradeLevel: 'Sec 2',
        month: 'October',
        price: '300 EGP',
        description: 'Second Secondary Programming - October content',
        displayOrder: 10,
        isActive: true,
        createdBy: 'test-teacher',
      });

      const novemberId = await createCoursePackage({
        name: 'November',
        gradeLevel: 'Sec 2',
        month: 'November',
        price: '300 EGP',
        description: 'Second Secondary Programming - November content',
        displayOrder: 11,
        isActive: true,
        createdBy: 'test-teacher',
      });

      const octoberCode = await generatePackageAccessCode(octoberId);
      const novemberCode = await generatePackageAccessCode(novemberId);

      const octoberResult = await redeemPackageAccessCode(octoberCode.code, 'test-student-uid', 'Sec 2');
      const novemberResult = await redeemPackageAccessCode(novemberCode.code, 'test-student-uid', 'Sec 2');

      expect(octoberResult.success).toBe(true);
      expect(novemberResult.success).toBe(true);

      const packages = await getStudentPackages('test-student-uid');
      expect(packages.some((pkg) => pkg.id === octoberId)).toBe(true);
      expect(packages.some((pkg) => pkg.id === novemberId)).toBe(true);
      expect(packages.length).toBeGreaterThanOrEqual(2);
      const ownership = await getStudentPackageAccesses('test-student-uid');
      expect(ownership.filter((record) => [octoberId, novemberId].includes(record.packageId))).toHaveLength(2);
      expect(ownership.every((record) => !('expiresAt' in record))).toBe(true);
    });

    it('should return empty array for student with no packages', async () => {
      const packages = await getStudentPackages('no-packages-student');
      expect(packages).toEqual([]);
    });
  });

  describe('Lesson Access Control', () => {
    it('should allow access to legacy lessons (no package)', async () => {
      const hasAccess = await hasLessonAccess('test-student-uid', {
        id: 'legacy-lesson',
        title_en: 'Legacy Lesson',
        title_ar: 'درس قديم',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Grade 4',
        isPublished: true,
        packageId: null, // Legacy lesson
      });

      expect(hasAccess).toBe(true);
    });

    it('should deny access to package lesson without package ownership', async () => {
      const hasAccess = await hasLessonAccess('no-packages-student', {
        id: 'package-lesson',
        title_en: 'Package Lesson',
        title_ar: 'درس باقة',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Grade 4',
        isPublished: true,
        packageId: 'some-package-id', // Package lesson
      });

      expect(hasAccess).toBe(false);
    });

    it('allows package lesson access after the student redeems its package code', async () => {
      const packageId = await createCoursePackage({
        name: 'Owned lesson package',
        gradeLevel: 'Grade 4',
        isActive: true,
        createdBy: 'test-teacher',
      });
      const code = await generatePackageAccessCode(packageId);
      const result = await redeemPackageAccessCode(code.code, 'test-student-uid', 'Grade 4');

      expect(result.success).toBe(true);
      const hasAccess = await hasLessonAccess('test-student-uid', {
        id: 'owned-package-lesson',
        title_en: 'Owned Package Lesson',
        title_ar: 'درس الباقة المملوكة',
        type: 'video',
        duration: '30 min',
        gradeLevel: 'Grade 4',
        isPublished: true,
        packageId,
      });

      expect(hasAccess).toBe(true);
    });
  });
});
