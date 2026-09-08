'use client';

import type { ReactNode } from 'react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isDark?: boolean;
};

export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isDark = false,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className={`relative w-full max-w-sm rounded-[1.75rem] border p-6 ${isDark ? 'bg-[#1A0609] border-[#C9A876]/20' : 'bg-[#F8F1E7] border-[#C9A876]/25'} shadow-[0_24px_80px_rgba(2,6,23,0.5)]`}>
        <h3 className={`font-display text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-[#5C1A24]'}`}>{title}</h3>
        <p className={`text-sm mb-6 ${isDark ? 'text-slate-300' : 'text-[#5C1A24]'}`}>{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-semibold ${isDark ? 'border-[#C9A876]/25 text-[#E7C3B6]' : 'border-[#5C1A24]/20 text-[#5C1A24]'}`}>{cancelLabel}</button>
          <button onClick={() => void onConfirm()} className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
