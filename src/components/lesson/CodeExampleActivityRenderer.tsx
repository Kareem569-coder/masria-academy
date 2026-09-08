'use client';

import { useState } from 'react';
import { PROGRAMMING_LANGUAGES } from '@/lib/coding/languages';
import type { CodeExampleActivity } from '@/types/models';

export type CodeExampleActivityRendererProps = {
  activity: CodeExampleActivity;
  language: 'en' | 'ar';
  isCompleted?: boolean;
  onContinue?: (activityId: string) => void;
};

export default function CodeExampleActivityRenderer({
  activity,
  language,
  isCompleted = false,
  onContinue,
}: CodeExampleActivityRendererProps) {
  const [copied, setCopied] = useState(false);

  const langMeta = PROGRAMMING_LANGUAGES[activity.language] ?? { displayName: activity.language };
  const description = language === 'ar'
    ? activity.description_ar || activity.description_en || 'مثال برمجي.'
    : activity.description_en || activity.description_ar || 'Code example.';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activity.sourceCode || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-400/25 bg-violet-500/5 p-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300">
          {language === 'ar' ? 'مثال' : 'Example'}
        </div>
        <h3 className="text-2xl font-bold text-white">
          {language === 'ar' ? (activity.title_ar || activity.title_en) : (activity.title_en || activity.title_ar)}
        </h3>
        {description && <p className="mt-2 text-sm text-slate-300">{description}</p>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {langMeta.displayName}
          </div>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-violet-400/50 hover:text-white"
          >
            {copied ? (language === 'ar' ? 'تم النسخ!' : 'Copied!') : (language === 'ar' ? 'نسخ الكود' : 'Copy code')}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#0b1120] p-4 text-sm leading-7 text-cyan-100">
          <code>{activity.sourceCode || ''}</code>
        </pre>
      </div>

      {isCompleted && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {language === 'ar' ? 'تم إكمال هذا المثال.' : 'This example is complete.'}
        </div>
      )}

      {onContinue && (
        <button
          type="button"
          onClick={() => onContinue(activity.id)}
          className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/15 transition hover:brightness-110"
        >
          {language === 'ar' ? 'التالي' : 'Next'}
        </button>
      )}
    </div>
  );
}
