'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import CodeEditor, { buildCodingDraftStorageKey, getChallengeStarterCode, resetChallengeCode } from '@/components/coding/CodeEditor';
import { PROGRAMMING_LANGUAGES } from '@/lib/coding/languages';
import type { CodingChallengeActivity } from '@/types/models';

export type CodingChallengeRendererProps = {
  activity: CodingChallengeActivity;
  language: 'en' | 'ar';
  isCompleted?: boolean;
  onContinue?: (activityId: string) => void;
  lessonId?: string;
  studentId?: string;
};

export default function CodingChallengeRenderer({
  activity,
  language,
  isCompleted = false,
  onContinue,
  lessonId = 'lesson',
  studentId = 'student',
}: CodingChallengeRendererProps) {
  const challengeTitle = language === 'ar' ? (activity.title_ar || activity.title_en) : (activity.title_en || activity.title_ar);
  const defaultLanguage = activity.defaultLanguage && PROGRAMMING_LANGUAGES[activity.defaultLanguage]
    ? PROGRAMMING_LANGUAGES[activity.defaultLanguage]
    : { displayName: activity.defaultLanguage || 'cpp17' };

  const starterCode = useMemo(
    () => getChallengeStarterCode(activity, activity.defaultLanguage || 'cpp17'),
    [activity]
  );

  const draftKey = buildCodingDraftStorageKey(
    studentId,
    lessonId,
    activity.id,
    activity.challengeVersion,
    activity.defaultLanguage || 'cpp17'
  );

  const [code, setCode] = useState(starterCode);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [isMounted, setIsMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [submissionError, setSubmissionError] = useState('');

  const { user } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { value?: string };
        if (typeof parsed.value === 'string') {
          setCode(parsed.value);
        }
      } catch {
        // Ignore malformed local drafts and fall back to starter code.
      }
    }
  }, [draftKey, isMounted]);

  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return;

    setSaveState('saving');
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify({ value: code, savedAt: new Date().toISOString() }));
      setSaveState('saved');
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [code, draftKey, isMounted]);

  const hasChanged = code !== starterCode;

  const handleReset = () => {
    if (!hasChanged) {
      setCode(starterCode);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey);
      }
      return;
    }

    const confirmed = typeof window !== 'undefined'
      ? window.confirm(language === 'ar' ? 'إعادة تعيين الكود إلى النسخة الأساسية؟ هذا سيؤدي إلى فقدان تغييراتك الحالية.' : 'Reset the code back to the starter version? This will discard your current edits.')
      : true;

    if (!confirmed) return;

    const nextCode = resetChallengeCode(starterCode, code);
    setCode(nextCode);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(draftKey);
    }
  };

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopyFeedback(language === 'ar' ? 'تم النسخ' : 'Copied');
      } else {
        setCopyFeedback(language === 'ar' ? 'تم النسخ' : 'Copied');
      }
    } catch {
      setCopyFeedback(language === 'ar' ? 'فشل النسخ' : 'Copy failed');
    }

    window.setTimeout(() => setCopyFeedback(''), 1500);
  };

  const handleSubmit = async () => {
    if (!user) {
      setSubmissionError(language === 'ar' ? 'يجب تسجيل الدخول لتقديم الحل' : 'You must be logged in to submit');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError('');
    setSubmissionResult(null);

    try {
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/coding/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          lessonId,
          activityId: activity.id,
          challengeVersion: activity.challengeVersion,
          language: activity.defaultLanguage || 'cpp17',
          sourceCode: code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      setSubmissionResult(data);

      // Clear draft on successful submission
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey);
      }

      // If passed, trigger continue
      if (data.evaluation.verdict === 'AC' && onContinue) {
        setTimeout(() => onContinue(activity.id), 1000);
      }
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : (language === 'ar' ? 'فشل التقديم' : 'Submission failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
          {language === 'ar' ? 'تمرين برمجي' : 'Coding Challenge'}
        </div>
        <h3 className="text-2xl font-bold text-white">{challengeTitle}</h3>
        <p className="mt-2 text-sm text-slate-300">
          {language === 'ar'
            ? (activity.description_ar || activity.description_en || 'حل هذه المشكلة في بيئة برمجة محلية.')
            : (activity.description_en || activity.description_ar || 'Solve this challenge in a local coding environment.')}
        </p>
      </div>

      {/* Code editor container - always LTR isolation */}
      <div dir="ltr">
      {submissionResult && (
        <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            {language === 'ar' ? 'نتيجة التقديم' : 'Submission Result'}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{language === 'ar' ? 'الحكم:' : 'Verdict:'}</span>
              <span className={`font-bold ${submissionResult.evaluation.verdict === 'AC' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {submissionResult.evaluation.verdict}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{language === 'ar' ? 'النتيجة:' : 'Score:'}</span>
              <span className="text-slate-200">{submissionResult.evaluation.scorePercent}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{language === 'ar' ? 'المحاولات:' : 'Attempts:'}</span>
              <span className="text-slate-200">{submissionResult.progress.attempts}</span>
            </div>
            {submissionResult.evaluation.publicTestResults && submissionResult.evaluation.publicTestResults.length > 0 && (
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {language === 'ar' ? 'الاختبارات العامة' : 'Public Tests'}
                </div>
                <div className="space-y-1">
                  {submissionResult.evaluation.publicTestResults.map((test: any, idx: number) => (
                    <div key={test.testId || idx} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${test.passed ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span className="text-slate-300">
                        Test {idx + 1}: {test.passed ? (language === 'ar' ? 'نجح' : 'Passed') : (language === 'ar' ? 'فشل' : 'Failed')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {submissionError && (
        <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">
          {submissionError}
        </div>
      )}

      <div className="rounded-2xl border border-cyan-400/15 bg-slate-950/70 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          {language === 'ar' ? 'حالة النشاط' : 'Status'}
        </div>
        {!submissionResult && (
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-200">
            {language === 'ar'
              ? 'اكتب الكود واضغط على "تقديم الحل" لتنفيذه.'
              : 'Write your code and click "Submit Solution" to execute it.'}
          </div>
        )}
        {submissionResult && submissionResult.evaluation.verdict === 'AC' && (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
            {language === 'ar' ? 'تم حل التحدي بنجاح!' : 'Challenge solved successfully!'}
          </div>
        )}
        {submissionResult && submissionResult.evaluation.verdict !== 'AC' && (
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200">
            {language === 'ar' ? 'لم يتم حل التحدي بعد. حاول مرة أخرى.' : 'Challenge not solved yet. Try again.'}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {language === 'ar' ? 'وصف المشكلة' : 'Problem'}
          </div>
          <p className="text-sm leading-7 text-slate-200">
            {language === 'ar' ? (activity.problem_ar || activity.problem_en) : (activity.problem_en || activity.problem_ar)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {language === 'ar' ? 'المتطلبات' : 'Requirements'}
          </div>
          <div className="space-y-2 text-sm text-slate-200">
            <p><span className="font-semibold text-white">{language === 'ar' ? 'الصعوبة:' : 'Difficulty:'}</span> {activity.difficulty}</p>
            <p><span className="font-semibold text-white">{language === 'ar' ? 'اللغة:' : 'Language:'}</span> {defaultLanguage.displayName}</p>
            <p><span className="font-semibold text-white">{language === 'ar' ? 'اللغات المسموح بها:' : 'Allowed languages:'}</span> {activity.allowedLanguages.join(', ')}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {language === 'ar' ? 'وصف المدخلات' : 'Input'}
          </div>
          <p className="text-sm text-slate-200">{language === 'ar' ? (activity.inputDescription_ar || activity.inputDescription_en || '—') : (activity.inputDescription_en || activity.inputDescription_ar || '—')}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {language === 'ar' ? 'وصف المخرجات' : 'Output'}
          </div>
          <p className="text-sm text-slate-200">{language === 'ar' ? (activity.outputDescription_ar || activity.outputDescription_en || '—') : (activity.outputDescription_en || activity.outputDescription_ar || '—')}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {language === 'ar' ? 'القيود' : 'Constraints'}
        </div>
        <p className="text-sm text-slate-200">{language === 'ar' ? (activity.constraints_ar || activity.constraints_en || '—') : (activity.constraints_en || activity.constraints_ar || '—')}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {language === 'ar' ? 'المحرر' : 'Code Editor'}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span className="rounded-full border border-white/10 bg-slate-900/80 px-2.5 py-1 uppercase tracking-[0.18em] text-slate-300">
              {defaultLanguage.displayName}
            </span>
            <span className="rounded-full border border-white/10 bg-slate-900/80 px-2.5 py-1 text-slate-300">
              {saveState === 'saving'
                ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
                : saveState === 'saved'
                  ? (language === 'ar' ? 'تم الحفظ محليًا' : 'Saved locally')
                  : (language === 'ar' ? 'تغييرات غير محفوظة' : 'Unsaved changes')}
            </span>
          </div>
        </div>

        <CodeEditor
          value={code}
          onChange={setCode}
          language={activity.defaultLanguage || 'cpp17'}
          starterCode={starterCode}
          className="overflow-hidden"
          aria-label={language === 'ar' ? 'محرر الكود' : 'Code editor'}
        />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              aria-label={language === 'ar' ? 'نسخ الكود' : 'Copy code'}
              className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400/35 hover:text-white"
            >
              {language === 'ar' ? 'نسخ الكود' : 'Copy Code'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              aria-label={language === 'ar' ? 'إعادة ضبط الكود' : 'Reset code'}
              className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 transition hover:border-amber-300/50 hover:bg-amber-500/15"
            >
              {language === 'ar' ? 'إعادة تعيين' : 'Reset Code'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !user}
            className="cyber-button rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? (language === 'ar' ? 'جارٍ التقديم...' : 'Submitting...')
              : (language === 'ar' ? 'تقديم الحل' : 'Submit Solution')
            }
          </button>

          {(copyFeedback || hasChanged) && (
            <div className="text-xs text-slate-300">
              {copyFeedback || (hasChanged ? (language === 'ar' ? 'تم تعديل الكود' : 'Code modified') : '')}
            </div>
          )}
        </div>
      </div>
      </div>

      {isCompleted && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {language === 'ar' ? 'تم إكمال هذا التحدي.' : 'This challenge is complete.'}
        </div>
      )}

      {onContinue && (
        <button
          type="button"
          onClick={() => onContinue(activity.id)}
          className="w-full rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-6 py-3 font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15"
        >
          {language === 'ar' ? 'إكمال الدرس' : 'Finish lesson'}
        </button>
      )}
    </div>
  );
}
