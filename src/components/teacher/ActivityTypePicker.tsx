'use client';

import type { ActivityType } from '@/types/models';

const ACTIVITY_OPTIONS: { value: ActivityType; label: string; labelAr: string }[] = [
  { value: 'THEORY', label: 'Theory', labelAr: 'نظرية' },
  { value: 'CODE_EXAMPLE', label: 'Code Example', labelAr: 'مثال برمجي' },
  { value: 'QUIZ', label: 'Quiz', labelAr: 'اختبار' },
  { value: 'CODING_CHALLENGE', label: 'Coding Challenge', labelAr: 'تحدي برمجي' },
];

type ActivityTypePickerProps = {
  open: boolean;
  isDark?: boolean;
  onSelect: (type: ActivityType) => void;
  onClose: () => void;
};

export default function ActivityTypePicker({ open, isDark = false, onSelect, onClose }: ActivityTypePickerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 w-full max-w-lg rounded-[1.75rem] border p-5 shadow-[0_24px_80px_rgba(2,6,23,0.5)] ${
          isDark ? 'border-white/10 bg-[#0b1220] text-white' : 'border-[#C9A876]/25 bg-[#F8F1E7] text-[#1F2937]'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Add activity</h3>
          <button type="button" onClick={onClose} className="rounded-lg border px-2 py-1 text-xs opacity-80 hover:opacity-100">
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {ACTIVITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`rounded-2xl border px-4 py-3 text-left transition hover:border-[#8C3B3F]/50 hover:bg-[#8C3B3F]/10 ${
                isDark ? 'border-white/10 bg-slate-900/80' : 'border-[#C9A876]/25 bg-white/70'
              }`}
            >
              <div className="text-sm font-semibold">{option.label}</div>
              <div className="text-xs opacity-70">{option.labelAr}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
