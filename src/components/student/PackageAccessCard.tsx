'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { getActivePackagesByGradeLevel, getStudentPackages } from '@/lib/firestore/packageService';
import type { CoursePackage } from '@/types/models';
import PackageLessonEntryButton from '@/components/student/PackageLessonEntryButton';

interface PackageAccessCardProps {
  studentId: string;
  gradeLevel: string;
  refreshToken?: number;
  onOpenPackageLessons?: (packageId: string, packageName: string) => void;
}
const WHATSAPP_NUMBER = '01154514470';

function safeImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch { return undefined; }
}

export default function PackageAccessCard({ studentId, gradeLevel, refreshToken = 0, onOpenPackageLessons }: PackageAccessCardProps) {
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';
  const [availablePackages, setAvailablePackages] = useState<CoursePackage[]>([]);
  const [ownedPackages, setOwnedPackages] = useState<CoursePackage[]>([]);
  const [ownershipLoadFailed, setOwnershipLoadFailed] = useState(false);
  const [availableLoadFailed, setAvailableLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPackages = async () => {
      if (!gradeLevel) {
        setAvailablePackages([]);
        setOwnedPackages([]);
        setOwnershipLoadFailed(false);
        setAvailableLoadFailed(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const [availableResult, ownedResult] = await Promise.allSettled([
        getActivePackagesByGradeLevel(gradeLevel),
        getStudentPackages(studentId),
      ]);
      if (availableResult.status === 'fulfilled') {
        setAvailablePackages(availableResult.value);
        setAvailableLoadFailed(false);
      } else {
        console.error('Error loading available packages:', availableResult.reason);
        setAvailablePackages([]);
        setAvailableLoadFailed(true);
      }
      if (ownedResult.status === 'fulfilled') {
        setOwnedPackages(ownedResult.value);
        setOwnershipLoadFailed(false);
      } else {
        console.error('Error loading owned packages:', ownedResult.reason);
        setOwnedPackages([]);
        setOwnershipLoadFailed(true);
      }
      setLoading(false);
    };
    void loadPackages();
  }, [studentId, gradeLevel, refreshToken]);

  const ownedPackageIds = new Set(ownedPackages.map((pkg) => pkg.id));
  const renderPackage = (pkg: CoursePackage, isOwned: boolean, ownershipKnown: boolean) => {
    const imageUrl = safeImageUrl(pkg.coverImageUrl);
    const packageLabel = pkg.month || pkg.name;
    const whatsappMessage = isAr
      ? `مرحبًا، أريد شراء ${packageLabel} للصف ${pkg.gradeLevel} في منصة MASRIA. أحتاج كود التفعيل بعد الدفع.`
      : `Hello, I want to buy ${packageLabel} for ${pkg.gradeLevel} on MASRIA. Please send the access code after payment.`;
    return <article key={pkg.id} className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/70 shadow-lg shadow-slate-950/20">
      {imageUrl && <div className="flex aspect-[4/3] max-h-72 w-full items-center justify-center overflow-hidden bg-slate-950 p-3 sm:p-4">
        <img src={imageUrl} alt={isAr ? `غلاف ${pkg.name}` : `${pkg.name} cover`} loading="lazy" className="h-full w-full object-contain" />
      </div>}
      <div className="p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="break-words text-lg font-semibold text-white">{pkg.name}</h4>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
              <span>{pkg.gradeLevel}</span>{pkg.month && <span>• {pkg.month}</span>}{pkg.price && <span>• {pkg.price}</span>}
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${isOwned ? 'bg-emerald-500/15 text-emerald-200' : ownershipKnown ? 'bg-amber-500/15 text-amber-100' : 'bg-slate-500/15 text-slate-200'}`}>
            {isOwned ? (isAr ? 'مُفتوح دائمًا' : 'Permanent Access') : ownershipKnown ? (isAr ? 'متاحة' : 'Available') : (isAr ? 'تعذر التحقق من الحالة' : 'Status unavailable')}
          </span>
        </div>
        {pkg.description && <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-slate-300">{pkg.description}</p>}
        {!isOwned && ownershipKnown && <div className="mt-4 flex flex-col items-start gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-amber-100">{isAr ? 'الدفع يتم خارج الموقع، ثم يتم إدخال الكود لاحقًا. هذا الوصول يبقى دائمًا عند التفعيل.' : 'Payment is handled outside the app, then the code is redeemed here. Access stays permanent once unlocked.'}</p>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-400">{isAr ? 'اشترك عبر واتساب' : 'Subscribe on WhatsApp'}</a>
        </div>}
        {onOpenPackageLessons && <PackageLessonEntryButton isOwned={isOwned} packageId={pkg.id} packageName={pkg.name} isArabic={isAr} onOpen={onOpenPackageLessons} />}
      </div>
    </article>;
  };

  if (loading) return <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6"><div className="animate-pulse space-y-3"><div className="h-6 w-1/3 rounded-lg bg-white/10" /><div className="h-16 rounded-lg bg-white/5" /></div></div>;

  return <div className="space-y-3" dir={dir}>
    <section className="space-y-3">
      <div><h3 className="text-lg font-semibold text-white">{isAr ? 'الباقات المتاحة لصفك' : 'Available for your grade'}</h3><p className="mt-1 text-xs text-slate-400">{isAr ? 'اختر الباقة وتواصل مع المدرس للدفع واستلام كود الوصول.' : 'Choose a package and contact your teacher for payment and an access code.'}</p></div>
      {availableLoadFailed
        ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4 text-sm text-rose-200">{isAr ? 'تعذر تحميل الباقات المتاحة' : 'Available packages could not be loaded'}</p>
        : availablePackages.filter((pkg) => !ownedPackageIds.has(pkg.id)).length === 0
        ? <p className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-400">{isAr ? 'لا توجد باقات متاحة لهذا الصف حاليًا' : 'No available packages for this grade right now'}</p>
        : availablePackages.filter((pkg) => ownershipLoadFailed || !ownedPackageIds.has(pkg.id)).map((pkg) => renderPackage(pkg, false, !ownershipLoadFailed))}
    </section>
    <section className="space-y-3">
      <div><h3 className="text-lg font-semibold text-white">{isAr ? 'باقاتي المملوكة' : 'My owned packages'}</h3></div>
      {ownershipLoadFailed
        ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4 text-sm text-rose-200">{isAr ? 'تعذر التحقق من الباقات المملوكة' : 'Owned package status could not be verified'}</p>
        : ownedPackages.length === 0
        ? <p className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-400">{isAr ? 'لم تشترك في أي باقة بعد' : 'You do not own any packages yet'}</p>
        : ownedPackages.map((pkg) => renderPackage(pkg, true, true))}
    </section>
  </div>;
}
