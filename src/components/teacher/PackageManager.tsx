'use client';

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import {
  getActivePackagesByGradeLevel,
  getAllCoursePackages,
  generatePackageAccessCodes,
  getAccessCodesByPackage,
  getPackageOwnership,
  disablePackageAccessCode,
  deactivateCoursePackage,
} from '@/lib/firestore/packageService';
import { addLessonsToPackage, getAllLessons, removeLessonFromPackage } from '@/lib/firestore/lessonService';
import { createCoursePackageWithOptionalCover } from '@/lib/firestore/packageCreation';
import type { CoursePackage, Lesson, PackageAccessCode } from '@/types/models';
import { isLessonInPackage } from '@/lib/firestore/lessonMembership';
import { getPackageCoverFileError } from '@/lib/packageCoverUpload';

const gradeLevels = [
  { en: 'Grade 4', ar: 'الرابع الابتدائي' },
  { en: 'Grade 5', ar: 'الخامس الابتدائي' },
  { en: 'Grade 6', ar: 'السادس الابتدائي' },
  { en: 'Prep 1', ar: 'الأول الإعدادي' },
  { en: 'Prep 2', ar: 'الثاني الإعدادي' },
  { en: 'Prep 3', ar: 'الثالث الإعدادي' },
  { en: 'Sec 1', ar: 'الأول الثانوي' },
  { en: 'Sec 2', ar: 'الثاني الثانوي' },
  { en: 'Sec 3', ar: 'الثالث الثانوي' },
];

interface ToastItem {
  id: string;
  type: 'success' | 'error';
  message: string;
}

function CoverImagePreview({ file, isAr }: { file: File; isAr: boolean }) {
  const [previewUrl] = useState(() => URL.createObjectURL(file));

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <img
      src={previewUrl}
      alt={isAr ? 'معاينة صورة الغلاف' : 'Cover image preview'}
      className="mt-3 max-h-48 rounded-xl border border-white/10 object-contain"
    />
  );
}

export default function PackageManager() {
  const { language, dir } = useLanguage();
  const { user } = useAuth();
  const isAr = language === 'ar';

  const [packages, setPackages] = useState<CoursePackage[]>([]);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPackageName, setNewPackageName] = useState('');
  const [newPackageMonth, setNewPackageMonth] = useState('');
  const [newPackagePrice, setNewPackagePrice] = useState('');
  const [newPackageDisplayOrder, setNewPackageDisplayOrder] = useState('1');
  const [newPackageDescription, setNewPackageDescription] = useState('');
  const [newPackageCoverFile, setNewPackageCoverFile] = useState<File | null>(null);
  const [coverImageError, setCoverImageError] = useState('');
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const [newPackageIsActive, setNewPackageIsActive] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<CoursePackage | null>(null);
  const [lessonPackage, setLessonPackage] = useState<CoursePackage | null>(null);
  const [repositoryLessons, setRepositoryLessons] = useState<Lesson[]>([]);
  const [lessonSearch, setLessonSearch] = useState('');
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [loadingRepositoryLessons, setLoadingRepositoryLessons] = useState(false);
  const [savingLessonAssignments, setSavingLessonAssignments] = useState(false);
  const [accessCodes, setAccessCodes] = useState<PackageAccessCode[]>([]);
  const [packageOwners, setPackageOwners] = useState<Array<{ id: string; studentId: string; packageId: string; activatedAt: string; status: 'active' | 'revoked'; studentName?: string; email?: string; gradeLevel?: string }>>([]);
  const [codeQuantity, setCodeQuantity] = useState('1');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCoverImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const fileError = getPackageCoverFileError(file, isAr);
    if (fileError) {
      event.currentTarget.value = '';
      setCoverImageError(fileError);
      return;
    }
    setCoverImageError('');
    setNewPackageCoverFile(file);
  };

  const removeCoverImage = () => {
    setNewPackageCoverFile(null);
    setCoverImageError('');
    if (coverImageInputRef.current) coverImageInputRef.current.value = '';
  };

  const pushToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadPackages = async (gradeLevel?: string) => {
    setLoading(true);
    try {
      const data = gradeLevel
        ? await getActivePackagesByGradeLevel(gradeLevel)
        : await getAllCoursePackages();
      setPackages(data);
    } catch (error) {
      pushToast('error', isAr ? 'فشل تحميل الباقات' : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const loadAccessCodes = async (packageId: string) => {
    setLoading(true);
    try {
      const codes = await getAccessCodesByPackage(packageId);
      setAccessCodes(codes);
    } catch (error) {
      pushToast('error', isAr ? 'فشل تحميل الأكواد' : 'Failed to load access codes');
    } finally {
      setLoading(false);
    }
  };

  const loadPackageOwners = async (packageId: string) => {
    try {
      const owners = await getPackageOwnership(packageId);
      setPackageOwners(owners);
    } catch (error) {
      pushToast('error', isAr ? 'فشل تحميل مالكي الباقة' : 'Failed to load package owners');
    }
  };

  const openLessonManager = async (coursePackage: CoursePackage) => {
    setLessonPackage(coursePackage);
    setLessonSearch('');
    setSelectedLessonIds([]);
    setLoadingRepositoryLessons(true);
    try {
      setRepositoryLessons(await getAllLessons());
    } catch (error) {
      console.error('Failed to load lessons for package assignment:', error);
      setRepositoryLessons([]);
      pushToast('error', isAr ? 'تعذر تحميل الدروس من المستودع' : 'Could not load repository lessons');
    } finally {
      setLoadingRepositoryLessons(false);
    }
  };

  const addSelectedLessons = async () => {
    if (!lessonPackage || selectedLessonIds.length === 0) return;
    setSavingLessonAssignments(true);
    try {
      await addLessonsToPackage(lessonPackage.id, selectedLessonIds);
      const lessonIds = [...new Set([...(lessonPackage.lessonIds ?? []), ...selectedLessonIds])];
      const updatedPackage = { ...lessonPackage, lessonIds };
      setLessonPackage(updatedPackage);
      setPackages((previous) => previous.map((item) => item.id === updatedPackage.id ? updatedPackage : item));
      setSelectedLessonIds([]);
      pushToast('success', isAr ? 'تمت إضافة الدروس الموجودة إلى الباقة' : 'Existing lessons added to the package');
    } catch (error) {
      console.error('Failed to add lessons to package:', error);
      pushToast('error', error instanceof Error ? error.message : isAr ? 'تعذرت إضافة الدروس' : 'Could not add lessons');
    } finally {
      setSavingLessonAssignments(false);
    }
  };

  const removeLesson = async (lesson: Lesson) => {
    if (!lessonPackage) return;
    const title = lesson.title_en || lesson.title_ar;
    if (!confirm(isAr ? `إزالة "${title}" من هذه الباقة؟ سيبقى الدرس في المستودع.` : `Remove "${title}" from this package? The lesson will stay in the repository.`)) return;
    setSavingLessonAssignments(true);
    try {
      await removeLessonFromPackage(lessonPackage.id, lesson.id);
      const updatedPackage = {
        ...lessonPackage,
        lessonIds: (lessonPackage.lessonIds ?? []).filter((id) => id !== lesson.id),
      };
      setLessonPackage(updatedPackage);
      setPackages((previous) => previous.map((item) => item.id === updatedPackage.id ? updatedPackage : item));
      pushToast('success', isAr ? 'تمت إزالة الدرس من هذه الباقة' : 'Lesson removed from this package');
    } catch (error) {
      console.error('Failed to remove lesson from package:', error);
      pushToast('error', error instanceof Error ? error.message : isAr ? 'تعذرت إزالة الدرس' : 'Could not remove lesson');
    } finally {
      setSavingLessonAssignments(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  useEffect(() => {
    if (selectedGradeLevel) {
      loadPackages(selectedGradeLevel);
    }
  }, [selectedGradeLevel]);

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackageName.trim() || !selectedGradeLevel) {
      pushToast('error', isAr ? 'أدخل اسم الباقة واختر الصف الدراسي.' : 'Enter a package name and select a grade.');
      return;
    }

    setLoading(true);
    try {
      if (newPackageCoverFile) {
        if (!user?.uid) throw new Error(isAr ? 'يجب تسجيل الدخول لرفع صورة الغلاف.' : 'Sign in as a teacher to upload a cover image.');
      }
      const idToken = newPackageCoverFile && user ? await user.getIdToken() : undefined;
      await createCoursePackageWithOptionalCover({
        name: newPackageName.trim(),
        gradeLevel: selectedGradeLevel,
        ...(newPackageMonth.trim() ? { month: newPackageMonth.trim() } : {}),
        ...(newPackagePrice.trim() ? { price: newPackagePrice.trim() } : {}),
        ...(newPackageDescription.trim() ? { description: newPackageDescription.trim() } : {}),
        displayOrder: Number(newPackageDisplayOrder) || 1,
        isActive: newPackageIsActive,
        createdBy: user?.uid || 'teacher',
      }, newPackageCoverFile, idToken, isAr);
      pushToast('success', isAr ? 'تم إنشاء الباقة بنجاح' : 'Package created successfully');
      setNewPackageName('');
      setNewPackageMonth('');
      setNewPackagePrice('');
      setNewPackageDisplayOrder('1');
      setNewPackageDescription('');
      setNewPackageCoverFile(null);
      setCoverImageError('');
      setNewPackageIsActive(true);
      setShowCreateForm(false);
      loadPackages(selectedGradeLevel);
    } catch (error) {
      console.error('Failed to create package:', error);
      pushToast('error', error instanceof Error ? error.message : isAr ? 'فشل إنشاء الباقة' : 'Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!selectedPackage) return;

    const quantity = Math.max(1, Number(codeQuantity) || 1);
    setLoading(true);
    try {
      const codes = await generatePackageAccessCodes(selectedPackage.id, quantity);
      pushToast(
        'success',
        quantity > 1
          ? `${codes.length} ${isAr ? 'أكواد تم توليدها' : 'codes generated'}`
          : isAr ? 'تم توليد الكود بنجاح' : 'Access code generated successfully'
      );
      loadAccessCodes(selectedPackage.id);
      loadPackageOwners(selectedPackage.id);
    } catch (error) {
      pushToast('error', isAr ? 'فشل توليد الكود' : 'Failed to generate access code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableCode = async (codeId: string) => {
    if (!confirm(isAr ? 'هل تريد تعطيل هذا الكود؟' : 'Disable this code?')) return;

    try {
      await disablePackageAccessCode(codeId);
      pushToast('success', isAr ? 'تم تعطيل الكود' : 'Code disabled');
      if (selectedPackage) {
        loadAccessCodes(selectedPackage.id);
      }
    } catch (error) {
      pushToast('error', isAr ? 'فشل تعطيل الكود' : 'Failed to disable code');
    }
  };

  const handleDeactivatePackage = async (packageId: string) => {
    if (!confirm(isAr ? 'هل أنت متأكد من تعطيل هذه الباقة؟' : 'Are you sure you want to deactivate this package?')) {
      return;
    }

    setLoading(true);
    try {
      await deactivateCoursePackage(packageId);
      pushToast('success', isAr ? 'تم تعطيل الباقة' : 'Package deactivated');
      loadPackages(selectedGradeLevel);
      if (selectedPackage?.id === packageId) {
        setSelectedPackage(null);
        setAccessCodes([]);
      }
    } catch (error) {
      pushToast('error', isAr ? 'فشل تعطيل الباقة' : 'Failed to deactivate package');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    pushToast('success', isAr ? 'تم النسخ' : 'Copied to clipboard');
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              toast.type === 'success'
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-400/30 bg-rose-500/10 text-rose-200'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-6">
        <h2 className="text-2xl font-bold text-white">
          {isAr ? 'إدارة الباقات' : 'Package Management'}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {isAr
            ? 'إنشاء وإدارة الباقات الدراسية وأكواد الوصول'
            : 'Create and manage course packages and access codes'}
        </p>
      </div>

      {/* Filter by Grade Level */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {isAr ? 'تصفية حسب الصف الدراسي' : 'Filter by Grade Level'}
        </div>
        <select
          value={selectedGradeLevel}
          onChange={(e) => setSelectedGradeLevel(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none"
        >
          <option value="">{isAr ? 'جميع الصفوف' : 'All Grades'}</option>
          {gradeLevels.map((grade) => (
            <option key={grade.en} value={grade.en}>
              {isAr ? grade.ar : grade.en}
            </option>
          ))}
        </select>
      </div>

      {/* Create Package Form */}
      {showCreateForm && (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            {isAr ? 'إنشاء باقة جديدة' : 'Create New Package'}
          </h3>
          <form onSubmit={handleCreatePackage} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                {isAr ? 'الصف الدراسي' : 'Grade Level'}
              </label>
              <select
                value={selectedGradeLevel}
                onChange={(e) => setSelectedGradeLevel(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none"
              >
                <option value="">{isAr ? 'اختر الصف الدراسي' : 'Select Grade Level'}</option>
                {gradeLevels.map((grade) => (
                  <option key={grade.en} value={grade.en}>
                    {isAr ? grade.ar : grade.en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                {isAr ? 'اسم الباقة' : 'Package Name'}
              </label>
              <input
                type="text"
                value={newPackageName}
                onChange={(e) => setNewPackageName(e.target.value)}
                required
                placeholder={isAr ? 'مثال: أكتوبر' : 'e.g., October'}
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {isAr ? 'الشهر/الفترة' : 'Month / Period'}
                </label>
                <input
                  type="text"
                  value={newPackageMonth}
                  onChange={(e) => setNewPackageMonth(e.target.value)}
                  placeholder={isAr ? 'أكتوبر' : 'October'}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {isAr ? 'السعر' : 'Price'}
                </label>
                <input
                  type="text"
                  value={newPackagePrice}
                  onChange={(e) => setNewPackagePrice(e.target.value)}
                  placeholder="300 EGP"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {isAr ? 'ترتيب العرض' : 'Display Order'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={newPackageDisplayOrder}
                  onChange={(e) => setNewPackageDisplayOrder(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                {isAr ? 'الوصف (اختياري)' : 'Description (Optional)'}
              </label>
              <textarea
                value={newPackageDescription}
                onChange={(e) => setNewPackageDescription(e.target.value)}
                placeholder={isAr ? 'وصف الباقة...' : 'Package description...'}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                {isAr ? 'صورة الغلاف' : 'Cover image'}
              </label>
              <input ref={coverImageInputRef} type="file" accept="image/*" onChange={handleCoverImageChange} className="sr-only" tabIndex={-1} />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => coverImageInputRef.current?.click()} className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
                  {isAr ? 'اختيار صورة' : 'Choose image'}
                </button>
                {newPackageCoverFile && <span className="text-sm text-slate-300">{newPackageCoverFile.name}</span>}
                {newPackageCoverFile && <button type="button" onClick={removeCoverImage} className="text-sm text-rose-200 underline underline-offset-2">{isAr ? 'إزالة الصورة' : 'Remove image'}</button>}
              </div>
              {newPackageCoverFile && <CoverImagePreview key={newPackageCoverFile.name + newPackageCoverFile.lastModified} file={newPackageCoverFile} isAr={isAr} />}
              {coverImageError && <p role="alert" className="mt-2 text-sm text-rose-200">{coverImageError}</p>}
              <p className="mt-1 text-xs text-slate-400">{isAr ? 'اختياري. اختر صورة من جهازك لمعاينتها ورفعها مع الباقة.' : 'Optional. Choose an image from your device to preview and upload with the package.'}</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-200">{isAr ? 'الحالة النشطة' : 'Active status'}</p>
                <p className="text-xs text-slate-400">{isAr ? 'إيقاف هذه الباقة سيجعلها غير متاحة للطلاب' : 'Turning this off hides the package from students'}</p>
              </div>
              <button
                type="button"
                onClick={() => setNewPackageIsActive((value) => !value)}
                className={`relative h-7 w-12 rounded-full transition-colors ${newPackageIsActive ? 'bg-emerald-500' : 'bg-slate-700'}`}
                aria-label={isAr ? 'تبديل حالة الباقة' : 'Toggle package status'}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${newPackageIsActive ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="cyber-button rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-6 py-3 font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? (isAr ? 'جارٍ الإنشاء...' : 'Creating...')
                  : (isAr ? 'إنشاء الباقة' : 'Create Package')
                }
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-xl border border-white/10 bg-slate-900/80 px-6 py-3 font-semibold text-slate-200 transition hover:border-white/20"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Packages List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {isAr ? 'الباقات' : 'Packages'}
          </h3>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="cyber-button rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15"
            >
              {isAr ? '+ إنشاء باقة جديدة' : '+ Create New Package'}
            </button>
          )}
        </div>

        {loading && !packages.length ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-8 text-center text-slate-400">
            {isAr ? 'جارٍ التحميل...' : 'Loading...'}
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-8 text-center text-slate-400">
            {isAr ? 'لا توجد باقات' : 'No packages found'}
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`rounded-2xl border bg-slate-950/70 p-4 transition ${
                  selectedPackage?.id === pkg.id
                    ? 'border-cyan-400/50 bg-cyan-500/5'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-lg font-semibold text-white">{pkg.name}</h4>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        pkg.isActive
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-rose-500/10 text-rose-300'
                      }`}>
                        {pkg.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <span>{isAr ? gradeLevels.find((g) => g.en === pkg.gradeLevel)?.ar || pkg.gradeLevel : pkg.gradeLevel}</span>
                      {pkg.month && <span>• {pkg.month}</span>}
                      {pkg.price && <span>• {pkg.price}</span>}
                    </div>
                    {pkg.description && (
                      <p className="mt-2 text-sm text-slate-300">{pkg.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void openLessonManager(pkg)}
                      className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50"
                    >
                      {isAr ? 'إدارة الدروس' : 'Manage Lessons'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setCodeQuantity('1');
                        loadAccessCodes(pkg.id);
                        loadPackageOwners(pkg.id);
                      }}
                      className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400/35 hover:text-white"
                    >
                      {isAr ? 'إدارة الأكواد' : 'Manage Codes'}
                    </button>
                    {pkg.isActive && (
                      <button
                        onClick={() => handleDeactivatePackage(pkg.id)}
                        className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200 transition hover:border-rose-300/50 hover:bg-rose-500/15"
                      >
                        {isAr ? 'تعطيل' : 'Deactivate'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lessonPackage && (
        <section className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-5 sm:p-6" aria-label={isAr ? 'إدارة دروس الباقة' : 'Package lesson management'}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">{isAr ? 'دروس الباقة' : 'Package Lessons'} · {lessonPackage.name}</h3>
              <p className="mt-1 text-xs text-slate-400">{isAr ? 'اختر دروسًا موجودة. تظل المسودة مسودة حتى تنشرها من المستودع.' : 'Select existing lessons. Drafts stay drafts until you publish them from the repository.'}</p>
            </div>
            <button type="button" onClick={() => setLessonPackage(null)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">{isAr ? 'إغلاق' : 'Close'}</button>
          </div>

          <label className="mb-4 block">
            <span className="sr-only">{isAr ? 'ابحث عن درس' : 'Search lessons'}</span>
            <input
              type="search"
              value={lessonSearch}
              onChange={(event) => setLessonSearch(event.target.value)}
              placeholder={isAr ? 'ابحث بالعنوان أو النوع...' : 'Search by title or lesson type...'}
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
            />
          </label>

          {loadingRepositoryLessons ? (
            <p className="rounded-xl bg-slate-950/50 p-5 text-center text-sm text-slate-400">{isAr ? 'جارٍ تحميل الدروس...' : 'Loading repository lessons...'}</p>
          ) : repositoryLessons.filter((lesson) => lesson.gradeLevel === lessonPackage.gradeLevel).length === 0 ? (
            <p className="rounded-xl bg-slate-950/50 p-5 text-center text-sm text-slate-400">{isAr ? 'لا توجد دروس لهذا الصف في المستودع.' : 'No lessons exist for this package grade yet.'}</p>
          ) : repositoryLessons.filter((lesson) => {
            if (lesson.gradeLevel !== lessonPackage.gradeLevel) return false;
            const search = lessonSearch.trim().toLocaleLowerCase();
            return !search || [lesson.title_en, lesson.title_ar, lesson.type, lesson.duration]
              .some((value) => value?.toLocaleLowerCase().includes(search));
          }).length === 0 ? (
            <p className="rounded-xl bg-slate-950/50 p-5 text-center text-sm text-slate-400">{isAr ? 'لا توجد دروس تطابق البحث.' : 'No lessons match your search.'}</p>
          ) : (
            <div className="max-h-[28rem] space-y-2 overflow-y-auto">
              {repositoryLessons.filter((lesson) => {
                if (lesson.gradeLevel !== lessonPackage.gradeLevel) return false;
                const search = lessonSearch.trim().toLocaleLowerCase();
                return !search || [lesson.title_en, lesson.title_ar, lesson.type, lesson.duration]
                  .some((value) => value?.toLocaleLowerCase().includes(search));
              }).map((lesson) => {
                const included = (lessonPackage.lessonIds ?? []).includes(lesson.id)
                  || isLessonInPackage(lesson, lessonPackage.id);
                return (
                  <div key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <label className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={included || selectedLessonIds.includes(lesson.id)}
                        disabled={included || savingLessonAssignments}
                        onChange={(event) => setSelectedLessonIds((previous) => event.target.checked
                          ? [...new Set([...previous, lesson.id])]
                          : previous.filter((id) => id !== lesson.id))}
                        className="mt-1 accent-cyan-400"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{isAr ? lesson.title_ar || lesson.title_en : lesson.title_en || lesson.title_ar}</span>
                        <span className="mt-1 block text-xs text-slate-400">{lesson.type} · {lesson.duration || '—'} · {lesson.gradeLevel}</span>
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${lesson.isPublished ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200'}`}>
                        {lesson.isPublished ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}
                      </span>
                      {included && <button type="button" onClick={() => void removeLesson(lesson)} disabled={savingLessonAssignments} className="rounded-lg border border-rose-400/20 px-2.5 py-1.5 text-xs text-rose-200 disabled:opacity-50">{isAr ? 'إزالة من الباقة' : 'Remove from package'}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => void addSelectedLessons()} disabled={selectedLessonIds.length === 0 || savingLessonAssignments} className="cyber-button rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
              {savingLessonAssignments ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : isAr ? `إضافة الدروس المحددة (${selectedLessonIds.length})` : `Add selected lessons (${selectedLessonIds.length})`}
            </button>
          </div>
        </section>
      )}

      {/* Access Codes Management */}
      {selectedPackage && (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              {isAr ? 'أكواد الوصول' : 'Access Codes'}
            </h3>
            <span className="text-sm text-slate-300">{selectedPackage.name}</span>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <span>{isAr ? 'عدد الأكواد' : 'Number of codes'}</span>
              <input
                type="number"
                min="1"
                max="50"
                value={codeQuantity}
                onChange={(e) => setCodeQuantity(e.target.value)}
                className="w-20 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none"
              />
            </label>
            <button
              onClick={handleGenerateCode}
              disabled={loading}
              className="cyber-button rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? (isAr ? 'جارٍ التوليد...' : 'Generating...')
                : (isAr ? 'توليد أكواد' : 'Generate Codes')
              }
            </button>
          </div>

          <div className="mb-4 rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
            <span className="font-semibold text-white">{isAr ? 'المالكون الحاليون' : 'Current owners'}:</span>{' '}
            {packageOwners.length === 0 ? (isAr ? 'لا يوجد مالكون حتى الآن' : 'No owners yet') : `${packageOwners.length} ${isAr ? 'طالبًا' : 'students'}`}
          </div>

          <div className="mb-4 rounded-xl border border-white/10 bg-slate-950/50 p-3">
            <div className="mb-2 text-sm font-semibold text-white">
              {isAr ? 'طلاب يمتلكون هذه الباقة' : 'Students owning this package'}
            </div>
            {packageOwners.length === 0 ? (
              <p className="text-xs text-slate-400">{isAr ? 'لا يوجد مالكون مسجّلون بعد' : 'No owners recorded yet'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs text-slate-300">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="px-2 py-2 font-medium">{isAr ? 'اسم الطالب' : 'Student'}</th>
                      <th className="px-2 py-2 font-medium">{isAr ? 'الإيميل' : 'Email'}</th>
                      <th className="px-2 py-2 font-medium">{isAr ? 'الباقة' : 'Package'}</th>
                      <th className="px-2 py-2 font-medium">{isAr ? 'الصف' : 'Grade'}</th>
                      <th className="px-2 py-2 font-medium">{isAr ? 'الشهر' : 'Month'}</th>
                      <th className="px-2 py-2 font-medium">{isAr ? 'تاريخ الاسترداد' : 'Redemption date'}</th>
                      <th className="px-2 py-2 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packageOwners.map((owner) => (
                      <tr key={owner.id} className="border-t border-white/10 align-top">
                        <td className="px-2 py-2 text-white">{owner.studentName || owner.studentId}</td>
                        <td className="px-2 py-2">{owner.email || '—'}</td>
                        <td className="px-2 py-2">{selectedPackage?.name || '—'}</td>
                        <td className="px-2 py-2">{owner.gradeLevel || selectedPackage?.gradeLevel || '—'}</td>
                        <td className="px-2 py-2">{selectedPackage?.month || '—'}</td>
                        <td className="px-2 py-2">{owner.activatedAt ? new Date(owner.activatedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : '—'}</td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${owner.status === 'active' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'}`}>
                            {owner.status === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'مُسحوب' : 'Revoked')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {loading && !accessCodes.length ? (
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center text-slate-400">
              {isAr ? 'جارٍ التحميل...' : 'Loading...'}
            </div>
          ) : accessCodes.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center text-slate-400">
              {isAr ? 'لا توجد أكواد' : 'No access codes yet'}
            </div>
          ) : (
            <div className="space-y-2">
              {accessCodes.map((code) => (
                <div
                  key={code.id}
                  className="rounded-xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <code className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-sm font-mono text-cyan-300">
                          {code.code}
                        </code>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          code.status === 'disabled'
                            ? 'bg-amber-500/10 text-amber-200'
                            : code.active
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-rose-500/10 text-rose-300'
                        }`}>
                          {code.status === 'disabled'
                            ? (isAr ? 'معطل' : 'Disabled')
                            : code.active
                              ? (isAr ? 'غير مستخدم' : 'Unused')
                              : (isAr ? 'مستخدم' : 'Used')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {isAr ? 'تم الإنشاء:' : 'Created:'} {new Date(code.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                      </p>
                      {code.usedBy && (
                        <p className="mt-1 text-xs text-slate-400">
                          {isAr ? 'المستخدم:' : 'Redeemed by:'} {code.usedBy}
                        </p>
                      )}
                      {code.usedAt && (
                        <p className="mt-1 text-xs text-slate-400">
                          {isAr ? 'تاريخ الاستعمال:' : 'Redeemed on:'} {new Date(code.usedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                        </p>
                      )}
                      {code.disabledAt && (
                        <p className="mt-1 text-xs text-slate-400">
                          {isAr ? 'تم التعطيل:' : 'Disabled on:'} {new Date(code.disabledAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/35 hover:text-white"
                      >
                        {isAr ? 'نسخ' : 'Copy'}
                      </button>
                      {code.status !== 'disabled' && (
                        <button
                          onClick={() => handleDisableCode(code.code)}
                          className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:border-amber-300/60 hover:bg-amber-500/15"
                        >
                          {isAr ? 'تعطيل' : 'Disable'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setSelectedPackage(null);
              setAccessCodes([]);
              setPackageOwners([]);
            }}
            className="mt-4 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      )}
    </div>
  );
}
