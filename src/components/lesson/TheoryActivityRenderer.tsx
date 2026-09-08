'use client';

import type { TheoryActivity } from '@/types/models';
import { getLocalizedText } from '@/lib/lessonHelpers';

export type TheoryActivityRendererProps = {
  activity: TheoryActivity;
  language: 'en' | 'ar';
  isCompleted?: boolean;
  onContinue?: (activityId: string) => void;
};

export default function TheoryActivityRenderer({
  activity,
  language,
  isCompleted = false,
  onContinue,
}: TheoryActivityRendererProps) {
  const title = getLocalizedText(activity, language) || (language === 'ar' ? 'محتوى تعليمي' : 'Theory content');
  const description = language === 'ar'
    ? activity.description_ar || activity.description_en || 'محتوى تعليمي.'
    : activity.description_en || activity.description_ar || 'Theory content.';
  const content = language === 'ar'
    ? activity.content_ar || activity.content_en || ''
    : activity.content_en || activity.content_ar || '';

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
          {language === 'ar' ? 'نظرية' : 'Theory'}
        </div>
        <h3 className="text-2xl font-bold text-white">{title}</h3>
        {description && <p className="mt-2 text-sm text-slate-300">{description}</p>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {language === 'ar' ? 'المحتوى' : 'Content'}
        </div>
        <div className="whitespace-pre-wrap text-base leading-8 text-slate-200">{content}</div>
      </div>

      {isCompleted && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {language === 'ar' ? 'تم إكمال هذا النشاط.' : 'This activity is complete.'}
        </div>
      )}

      {onContinue && (
        <button
          type="button"
          onClick={() => onContinue(activity.id)}
          className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-110"
        >
          {language === 'ar' ? 'التالي' : 'Next'}
        </button>
      )}
    </div>
  );
}
