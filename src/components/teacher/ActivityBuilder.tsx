'use client';

import { useMemo, useState } from 'react';
import { PROGRAMMING_LANGUAGES } from '@/lib/coding/languages';
import { validateCodingActivity, validateCodingChallenge } from '@/lib/coding/validation';
import type {
  Activity,
  ActivityType,
  BaseActivity,
  CodeExampleActivity,
  CodingChallengeActivity,
  Difficulty,
  QuizActivity,
  TheoryActivity,
} from '@/types/models';
import ActivityTypePicker from './ActivityTypePicker';
import CodingChallengeEditor from './CodingChallengeEditor';

const SUPPORTED_ACTIVITY_TYPES = ['THEORY', 'CODE_EXAMPLE', 'QUIZ', 'CODING_CHALLENGE'] as const;

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function baseActivity(type: ActivityType, order: number): BaseActivity {
  return {
    id: createId(type.toLowerCase()),
    type,
    title_en: '',
    title_ar: '',
    order,
    isPublished: true,
  };
}

export function buildDefaultActivity(type: ActivityType, order: number): Activity {
  switch (type) {
    case 'THEORY': {
      const activity: TheoryActivity = {
        ...baseActivity(type, order),
        type: 'THEORY',
        content_en: '',
        content_ar: '',
      };
      return activity;
    }
    case 'CODE_EXAMPLE': {
      const activity: CodeExampleActivity = {
        ...baseActivity(type, order),
        type: 'CODE_EXAMPLE',
        description_en: '',
        description_ar: '',
        language: 'cpp17',
        sourceCode: PROGRAMMING_LANGUAGES.cpp17.defaultStarterCode,
      };
      return activity;
    }
    case 'QUIZ': {
      const activity: QuizActivity = {
        ...baseActivity(type, order),
        type: 'QUIZ',
        description_en: '',
        description_ar: '',
        quiz: {
          quizTitle_en: '',
          quizTitle_ar: '',
          questions: [],
        },
        passingScore: 70,
      };
      return activity;
    }
    case 'CODING_CHALLENGE': {
      const challenge: CodingChallengeActivity = {
        ...baseActivity(type, order),
        type: 'CODING_CHALLENGE',
        description_en: '',
        description_ar: '',
        challengeVersion: 1,
        allowedLanguages: ['cpp17'],
        defaultLanguage: 'cpp17',
        starterCodeByLanguage: [
          { language: 'cpp17', starterCode: PROGRAMMING_LANGUAGES.cpp17.defaultStarterCode },
        ],
        problem_en: '',
        problem_ar: '',
        inputDescription_en: '',
        inputDescription_ar: '',
        outputDescription_en: '',
        outputDescription_ar: '',
        constraints_en: '',
        constraints_ar: '',
        publicTestCases: [],
        difficulty: 'beginner',
      };
      return challenge;
    }
    default:
      return {
        ...baseActivity('THEORY', order),
        type: 'THEORY',
        content_en: '',
        content_ar: '',
      };
  }
}

export function validateActivityList(activities: Activity[]): string[] {
  const issues: string[] = [];

  activities.forEach((activity, index) => {
    const label = activity.title_en || activity.title_ar || `Activity ${index + 1}`;

    if (activity.type === 'THEORY') {
      if (!activity.title_en.trim() || !activity.title_ar.trim()) {
        issues.push(`${label}: theory activity requires bilingual title.`);
      }
      if (!activity.content_en?.trim() || !activity.content_ar?.trim()) {
        issues.push(`${label}: theory activity requires bilingual content.`);
      }
      return;
    }

    if (activity.type === 'CODE_EXAMPLE') {
      const result = validateCodingActivity(activity);
      if (!result.valid) {
        issues.push(...result.errors.map((error) => `${label}: ${error}`));
      }
      return;
    }

    if (activity.type === 'QUIZ') {
      if (!activity.quiz || activity.quiz.questions.length === 0) {
        issues.push(`${label}: quiz activity requires at least one question.`);
      }
      return;
    }

    if (activity.type === 'CODING_CHALLENGE') {
      const result = validateCodingChallenge(activity);
      if (!result.valid) {
        issues.push(...result.errors.map((error) => `${label}: ${error}`));
      }
      return;
    }

    issues.push(`${label}: unsupported activity type for authoring.`);
  });

  return issues;
}

function updateActivityInArray(activities: Activity[], activityId: string, updater: (activity: Activity) => Activity): Activity[] {
  return activities.map((activity) => (activity.id === activityId ? updater(activity) : activity));
}

type ActivityBuilderProps = {
  activities: Activity[];
  onChange: (nextActivities: Activity[]) => void;
  isDark?: boolean;
  isAr?: boolean;
};

function renderActivitySummary(activity: Activity, isAr = false) {
  const title = isAr ? (activity.title_ar || activity.title_en) : (activity.title_en || activity.title_ar) || 'Untitled activity';

  switch (activity.type) {
    case 'THEORY':
      return `${title} · Theory`;
    case 'CODE_EXAMPLE':
      return `${title} · Code Example`;
    case 'QUIZ':
      return `${title} · Quiz`;
    case 'CODING_CHALLENGE':
      return `${title} · Coding Challenge`;
    default:
      return `${title} · ${activity.type}`;
  }
}

export default function ActivityBuilder({ activities, onChange, isDark = false, isAr = false }: ActivityBuilderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => a.order - b.order),
    [activities]
  );

  const addActivity = (type: ActivityType) => {
    const nextActivity = buildDefaultActivity(type, sortedActivities.length + 1);
    onChange([...sortedActivities, nextActivity]);
    setEditingId(nextActivity.id);
    setPickerOpen(false);
  };

  const updateActivity = (activityId: string, updater: (activity: Activity) => Activity) => {
    onChange(updateActivityInArray(activities, activityId, updater));
  };

  const removeActivity = (activityId: string) => {
    const remaining = activities.filter((activity) => activity.id !== activityId).map((activity, index) => ({
      ...activity,
      order: index + 1,
    }));
    onChange(remaining);
    if (editingId === activityId) setEditingId(null);
  };

  const moveActivity = (activityId: string, direction: 'up' | 'down') => {
    const index = activities.findIndex((activity) => activity.id === activityId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activities.length) return;

    const reordered = [...activities];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const normalized = reordered.map((activity, idx) => ({ ...activity, order: idx + 1 }));
    onChange(normalized);
  };

  const renderEditor = (activity: Activity) => {
    if (activity.type === 'THEORY') {
      return (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={activity.title_en}
              onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, title_en: event.target.value } as Activity))}
              placeholder="Theory title (EN)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <input
              value={activity.title_ar}
              onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, title_ar: event.target.value } as Activity))}
              placeholder="عنوان النظرية (AR)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <textarea
            value={activity.content_en}
            onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, content_en: event.target.value } as Activity))}
            placeholder="Theory content (EN)"
            rows={5}
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <textarea
            value={activity.content_ar}
            onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, content_ar: event.target.value } as Activity))}
            placeholder="محتوى النظرية (AR)"
            rows={5}
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </div>
      );
    }

    if (activity.type === 'CODE_EXAMPLE') {
      return (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={activity.title_en}
              onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, title_en: event.target.value } as Activity))}
              placeholder="Example title (EN)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <input
              value={activity.title_ar}
              onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, title_ar: event.target.value } as Activity))}
              placeholder="عنوان المثال (AR)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <textarea
            value={activity.description_en || ''}
            onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, description_en: event.target.value } as Activity))}
            rows={3}
            placeholder="Description (EN)"
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <textarea
            value={activity.description_ar || ''}
            onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, description_ar: event.target.value } as Activity))}
            rows={3}
            placeholder="الوصف (AR)"
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <select
            value={activity.language}
            onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, language: event.target.value as typeof activity.language } as Activity))}
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="cpp17">C++17</option>
          </select>
          <textarea
            value={activity.sourceCode}
            onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, sourceCode: event.target.value } as Activity))}
            rows={10}
            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 font-mono text-sm text-slate-100"
          />
        </div>
      );
    }

    if (activity.type === 'QUIZ') {
      return (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={activity.title_en}
              onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, title_en: event.target.value } as Activity))}
              placeholder="Quiz title (EN)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <input
              value={activity.title_ar}
              onChange={(event) => updateActivity(activity.id, (item) => ({ ...item, title_ar: event.target.value } as Activity))}
              placeholder="عنوان الاختبار (AR)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <textarea
            value={activity.quiz?.quizTitle_en || ''}
            onChange={(event) => updateActivity(activity.id, (item) => ({
              ...item,
              quiz: { ...(item as QuizActivity).quiz, quizTitle_en: event.target.value, questions: (item as QuizActivity).quiz?.questions || [] },
            } as Activity))}
            rows={2}
            placeholder="Quiz title (EN)"
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <textarea
            value={activity.quiz?.quizTitle_ar || ''}
            onChange={(event) => updateActivity(activity.id, (item) => ({
              ...item,
              quiz: { ...(item as QuizActivity).quiz, quizTitle_ar: event.target.value, questions: (item as QuizActivity).quiz?.questions || [] },
            } as Activity))}
            rows={2}
            placeholder="عنوان الاختبار (AR)"
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-xs text-slate-400">
            Quiz questions are supported through the existing quiz structure and remain available in the lesson model.
          </div>
        </div>
      );
    }

    if (activity.type === 'CODING_CHALLENGE') {
      return (
        <div className="mt-4">
          <CodingChallengeEditor
            challenge={activity}
            onChange={(value) => updateActivity(activity.id, () => value)}
            isDark={isDark}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`rounded-[2rem] border p-4 sm:p-6 ${isDark ? 'border-white/10 bg-slate-900/50' : 'border-[#C9A876]/20 bg-white/40'}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-[#5C1A24]'}`}>{isAr ? 'محتوى الدرس' : 'Lesson Content'}</h4>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#5C1A24]/70'}`}>
            {isAr ? 'أنشطة الدرس، ترتيبها، وإعدادات التحدي البرمجي.' : 'Activities, ordering, and challenge configuration.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-xl bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] px-4 py-2.5 text-sm font-semibold text-white"
        >
          + {isAr ? 'إضافة نشاط' : 'Add Activity'}
        </button>
      </div>

      {sortedActivities.length === 0 ? (
        <div className={`rounded-2xl border border-dashed px-4 py-8 text-center text-sm ${isDark ? 'border-white/10 text-slate-400' : 'border-[#C9A876]/25 text-[#5C1A24]/70'}`}>
          {isAr ? 'لا توجد أنشطة حتى الآن. أضف نشاطاً جديداً.' : 'No activities yet. Add a new activity to start building the lesson.'}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedActivities.map((activity) => (
            <div
              key={activity.id}
              className={`rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-slate-950/60' : 'border-[#C9A876]/20 bg-white/70'}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{activity.type}</div>
                  <div className={`mt-1 text-base font-semibold ${isDark ? 'text-white' : 'text-[#1F2937]'}`}>
                    {renderActivitySummary(activity, isAr)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setEditingId(editingId === activity.id ? null : activity.id)} className="rounded-xl border border-[#8C3B3F]/30 bg-[#8C3B3F]/10 px-3 py-1.5 text-xs font-semibold text-[#8C3B3F]">
                    {isAr ? 'تعديل' : 'Edit'}
                  </button>
                  <button type="button" onClick={() => moveActivity(activity.id, 'up')} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    {isAr ? 'أعلى' : '↑'}
                  </button>
                  <button type="button" onClick={() => moveActivity(activity.id, 'down')} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    {isAr ? 'أسفل' : '↓'}
                  </button>
                  <button type="button" onClick={() => removeActivity(activity.id)} className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-500">
                    {isAr ? 'حذف' : 'Delete'}
                  </button>
                </div>
              </div>

              {editingId === activity.id && renderEditor(activity)}
            </div>
          ))}
        </div>
      )}

      <ActivityTypePicker open={pickerOpen} isDark={isDark} onSelect={addActivity} onClose={() => setPickerOpen(false)} />
    </div>
  );
}

export { SUPPORTED_ACTIVITY_TYPES };
export type { ActivityType as SupportedActivityType };
