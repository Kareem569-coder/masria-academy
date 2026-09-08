'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Activity, QuizActivity } from '@/types/models';

export type QuizActivityRendererProps = {
  activity: QuizActivity;
  language: 'en' | 'ar';
  lessonId?: string;
  isCompleted?: boolean;
  onComplete?: (activityId: string, passed: boolean, score: number, total: number) => void;
  onNext?: (activityId: string) => void;
  onSkip?: (activityId: string) => void;
  initialAnswers?: (number | null)[];
};

const PASSING_SCORE_PERCENT = 60;

export default function QuizActivityRenderer({
  activity,
  language,
  lessonId,
  isCompleted = false,
  onComplete,
  onNext,
  onSkip,
  initialAnswers,
}: QuizActivityRendererProps) {
  const [answers, setAnswers] = useState<(number | null)[]>(initialAnswers ?? activity.quiz.questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean } | null>(null);

  useEffect(() => {
    setAnswers(initialAnswers ?? activity.quiz.questions.map(() => null));
    setSubmitted(false);
    setResult(null);
  }, [activity.id, initialAnswers]);

  const allAnswered = answers.length > 0 && answers.every((answer) => answer !== null);

  const scoreSummary = useMemo(() => {
    if (!submitted || !result) return null;
    return `${result.score} / ${result.total}`;
  }, [submitted, result]);

  const submitQuiz = () => {
    if (!allAnswered) return;
    const total = activity.quiz.questions.length;
    const score = answers.reduce<number>((acc, answer, idx) => {
      return answer === activity.quiz.questions[idx].correct ? acc + 1 : acc;
    }, 0);
    const percent = Math.round((score / total) * 100);
    const passed = percent >= PASSING_SCORE_PERCENT;
    const nextResult = { score, total, passed };
    setResult(nextResult);
    setSubmitted(true);
    onComplete?.(activity.id, passed, score, total);
  };

  const title = language === 'ar'
    ? activity.quiz.quizTitle_ar || activity.title_ar || activity.title_en
    : activity.quiz.quizTitle_en || activity.title_en || activity.title_ar;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-400/25 bg-amber-500/5 p-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
          {language === 'ar' ? 'اختبار' : 'Quiz'}
        </div>
        <h3 className="text-2xl font-bold text-white">{title}</h3>
      </div>

      <div className="space-y-5">
        {activity.quiz.questions.map((question, questionIndex) => (
          <div key={`${activity.id}-${questionIndex}`} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <div className="mb-4 font-semibold text-white">
              {questionIndex + 1}. {language === 'ar' ? question.ar : question.en}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => {
                const selected = answers[questionIndex] === optionIndex;
                const isCorrect = optionIndex === question.correct;
                let stateClasses = 'border-white/10 bg-slate-900/80 text-slate-200 hover:border-cyan-400/35';

                if (submitted) {
                  if (isCorrect) {
                    stateClasses = 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200';
                  } else if (selected && !isCorrect) {
                    stateClasses = 'border-rose-400/60 bg-rose-500/10 text-rose-200';
                  } else {
                    stateClasses = 'border-white/10 bg-slate-950/50 text-slate-500';
                  }
                } else if (selected) {
                  stateClasses = 'border-cyan-400/60 bg-cyan-500/10 text-white';
                }

                return (
                  <button
                    key={`${questionIndex}-${optionIndex}`}
                    type="button"
                    onClick={() => {
                      if (submitted) return;
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[questionIndex] = optionIndex;
                        return next;
                      });
                    }}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-300 ${stateClasses}`}
                  >
                    {language === 'ar' ? option.ar : option.en}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!submitted ? (
        <button
          type="button"
          onClick={submitQuiz}
          disabled={!allAnswered}
          className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-semibold text-white shadow-lg shadow-amber-500/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {language === 'ar' ? 'إرسال الاختبار' : 'Submit Quiz'}
        </button>
      ) : (
        result && (
          <div className="space-y-4">
            <div className={`rounded-2xl border px-5 py-4 ${result.passed ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'}`}>
              <div className="text-xl font-bold text-white">{scoreSummary}</div>
              <div className="text-sm text-slate-200">
                {result.passed
                  ? (language === 'ar' ? 'تم اجتياز الاختبار.' : 'You passed the quiz.')
                  : (language === 'ar' ? 'لم يتم اجتياز الاختبار.' : 'You did not pass the quiz.')}
              </div>
            </div>

            {onNext && (
              <button
                type="button"
                onClick={() => onNext(activity.id)}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-110"
              >
                {language === 'ar' ? 'التالي' : 'Next'}
              </button>
            )}
          </div>
        )
      )}

      {isCompleted && !submitted && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {language === 'ar' ? 'تم إكمال هذا الاختبار.' : 'This quiz is complete.'}
        </div>
      )}

      {onSkip && !submitted && (
        <button
          type="button"
          onClick={() => onSkip(activity.id)}
          className="text-sm text-slate-400 transition hover:text-white"
        >
          {language === 'ar' ? 'تخطي' : 'Skip'}
        </button>
      )}
    </div>
  );
}
