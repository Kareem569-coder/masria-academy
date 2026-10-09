'use client';

interface PackageLessonEntryButtonProps {
  isOwned: boolean;
  packageId: string;
  packageName: string;
  isArabic: boolean;
  onOpen: (packageId: string, packageName: string) => void;
}

export default function PackageLessonEntryButton({
  isOwned,
  packageId,
  packageName,
  isArabic,
  onOpen,
}: PackageLessonEntryButtonProps) {
  if (!isOwned) return null;

  return (
    <button
      type="button"
      onClick={() => onOpen(packageId, packageName)}
      className="mt-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
    >
      {isArabic ? 'دخول إلى الدروس' : 'Open lessons'}
    </button>
  );
}
