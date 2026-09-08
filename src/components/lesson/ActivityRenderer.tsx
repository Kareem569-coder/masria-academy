'use client';

import type { Activity } from '@/types/models';
import { getActivityRendererKind, getLocalizedText } from '@/lib/lessonHelpers';
import TheoryActivityRenderer from './TheoryActivityRenderer';
import CodeExampleActivityRenderer from './CodeExampleActivityRenderer';
import QuizActivityRenderer from './QuizActivityRenderer';
import CodingChallengeRenderer from './CodingChallengeRenderer';

export type ActivityRendererProps = {
  activity: Activity;
  language: 'en' | 'ar';
  isCompleted?: boolean;
  onComplete?: (activityId: string, passed: boolean, score: number, total: number) => void;
  onContinue?: (activityId: string) => void;
  onSkip?: (activityId: string) => void;
  initialQuizAnswers?: (number | null)[];
};

export default function ActivityRenderer({
  activity,
  language,
  isCompleted = false,
  onComplete,
  onContinue,
  onSkip,
  initialQuizAnswers,
}: ActivityRendererProps) {
  const kind = getActivityRendererKind(activity);

  switch (kind) {
    case 'THEORY':
      return (
        <TheoryActivityRenderer
          activity={activity as any}
          language={language}
          isCompleted={isCompleted}
          onContinue={onContinue}
        />
      );
    case 'CODE_EXAMPLE':
      return (
        <CodeExampleActivityRenderer
          activity={activity as any}
          language={language}
          isCompleted={isCompleted}
          onContinue={onContinue}
        />
      );
    case 'QUIZ':
      return (
        <QuizActivityRenderer
          activity={activity as any}
          language={language}
          isCompleted={isCompleted}
          onComplete={onComplete}
          onNext={onContinue}
          onSkip={onSkip}
          initialAnswers={initialQuizAnswers}
        />
      );
    case 'CODING_CHALLENGE':
      return (
        <CodingChallengeRenderer
          activity={activity as any}
          language={language}
          isCompleted={isCompleted}
          onContinue={onContinue}
        />
      );
    default:
      return (
        <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/70 p-5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {language === 'ar' ? 'نشاط غير مدعوم' : 'Unsupported activity'}
          </div>
          <h3 className="text-xl font-bold text-white">
            {getLocalizedText(activity as any, language) || (language === 'ar' ? 'نشاط جديد' : 'New activity')}
          </h3>
          <p className="mt-3 text-sm text-slate-300">
            {language === 'ar'
              ? 'هذا النوع من الأنشطة لا يدعم عرضه حاليًا، لكنه محجوز للتطورات المستقبلية.'
              : 'This activity type is not rendered yet, but it is reserved for future enhancements.'}
          </p>
        </div>
      );
  }
}
