'use client';

import { PROGRAMMING_LANGUAGES, type ProgrammingLanguageId } from '@/lib/coding/languages';
import type { CodingChallengeActivity, Difficulty, PublicTestCase } from '@/types/models';

const SUPPORTED_LANGUAGE_IDS: ProgrammingLanguageId[] = ['cpp17'];
const difficultyOptions: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

const makeTestCase = (index: number): PublicTestCase => ({
  id: `public-${Date.now()}-${index}`,
  input: '',
  expectedOutput: '',
});

type Props = {
  challenge: CodingChallengeActivity;
  onChange: (challenge: CodingChallengeActivity) => void;
  isDark?: boolean;
};

export default function CodingChallengeEditor({ challenge, onChange, isDark = false }: Props) {
  const cppTemplate = challenge.starterCodeByLanguage.find((item) => item.language === 'cpp17')?.starterCode || PROGRAMMING_LANGUAGES.cpp17.defaultStarterCode;

  const updateStarterCode = (nextCode: string) => {
    const existing = challenge.starterCodeByLanguage.filter((item) => item.language !== 'cpp17');
    onChange({
      ...challenge,
      allowedLanguages: ['cpp17'],
      defaultLanguage: 'cpp17',
      starterCodeByLanguage: [...existing, { language: 'cpp17', starterCode: nextCode }],
    });
  };

  const updateField = <K extends keyof CodingChallengeActivity>(field: K, value: CodingChallengeActivity[K]) => {
    onChange({ ...challenge, [field]: value } as CodingChallengeActivity);
  };

  const updateTestCase = (id: string, field: 'input' | 'expectedOutput', value: string) => {
    const nextCases = challenge.publicTestCases.map((testCase) =>
      testCase.id === id ? { ...testCase, [field]: value } : testCase
    );
    onChange({ ...challenge, publicTestCases: nextCases });
  };

  const addTestCase = () => {
    onChange({
      ...challenge,
      publicTestCases: [...challenge.publicTestCases, makeTestCase(challenge.publicTestCases.length + 1)],
    });
  };

  const removeTestCase = (id: string) => {
    onChange({
      ...challenge,
      publicTestCases: challenge.publicTestCases.filter((testCase) => testCase.id !== id),
    });
  };

  const updateLimit = (field: 'maxAttempts' | 'timeLimitMs' | 'memoryLimitMb', value: string) => {
    const trim = value.trim();
    onChange({
      ...challenge,
      [field]: trim === '' ? undefined : Number(trim),
    });
  };

  const textInputClass = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${
    isDark ? 'border-white/10 bg-slate-950/80 text-slate-100 placeholder:text-slate-500' : 'border-[#C9A876]/25 bg-white/80 text-slate-800 placeholder:text-slate-400'
  }`;

  return (
    <div className="space-y-5 rounded-2xl border border-[#C9A876]/20 bg-black/10 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Title (EN)</label>
          <input value={challenge.title_en} onChange={(e) => updateField('title_en', e.target.value)} className={textInputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Title (AR)</label>
          <input value={challenge.title_ar} onChange={(e) => updateField('title_ar', e.target.value)} className={textInputClass} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Description (EN)</label>
          <textarea value={challenge.description_en || ''} onChange={(e) => updateField('description_en', e.target.value)} rows={3} className={textInputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Description (AR)</label>
          <textarea value={challenge.description_ar || ''} onChange={(e) => updateField('description_ar', e.target.value)} rows={3} className={textInputClass} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Problem statement (EN)</label>
          <textarea value={challenge.problem_en} onChange={(e) => updateField('problem_en', e.target.value)} rows={4} className={textInputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Problem statement (AR)</label>
          <textarea value={challenge.problem_ar} onChange={(e) => updateField('problem_ar', e.target.value)} rows={4} className={textInputClass} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Input description (EN)</label>
          <textarea value={challenge.inputDescription_en || ''} onChange={(e) => updateField('inputDescription_en', e.target.value)} rows={2} className={textInputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Input description (AR)</label>
          <textarea value={challenge.inputDescription_ar || ''} onChange={(e) => updateField('inputDescription_ar', e.target.value)} rows={2} className={textInputClass} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Output description (EN)</label>
          <textarea value={challenge.outputDescription_en || ''} onChange={(e) => updateField('outputDescription_en', e.target.value)} rows={2} className={textInputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Output description (AR)</label>
          <textarea value={challenge.outputDescription_ar || ''} onChange={(e) => updateField('outputDescription_ar', e.target.value)} rows={2} className={textInputClass} />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Constraints</label>
        <textarea value={challenge.constraints_en || ''} onChange={(e) => updateField('constraints_en', e.target.value)} rows={3} className={textInputClass} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Language</label>
          <select
            value={challenge.defaultLanguage}
            onChange={(e) => {
              const nextLanguage = e.target.value as ProgrammingLanguageId;
              onChange({
                ...challenge,
                allowedLanguages: SUPPORTED_LANGUAGE_IDS.filter((lang) => lang === nextLanguage),
                defaultLanguage: nextLanguage,
              });
            }}
            className={textInputClass}
          >
            {SUPPORTED_LANGUAGE_IDS.map((languageId) => (
              <option key={languageId} value={languageId}>{PROGRAMMING_LANGUAGES[languageId].displayName} ({PROGRAMMING_LANGUAGES[languageId].runtimeLabel})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Difficulty</label>
          <select value={challenge.difficulty} onChange={(e) => updateField('difficulty', e.target.value as Difficulty)} className={textInputClass}>
            {difficultyOptions.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Starter code</label>
        <textarea value={cppTemplate} onChange={(e) => updateStarterCode(e.target.value)} rows={12} className={`${textInputClass} font-mono`} />
      </div>

      <div className="space-y-3 rounded-xl border border-dashed border-[#C9A876]/30 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200">Public test cases</h4>
          <button type="button" onClick={addTestCase} className="rounded-xl bg-gradient-to-r from-[#5C1A24] via-[#8C3B3F] to-[#C9A876] px-3 py-1.5 text-xs font-semibold text-white">
            + Add case
          </button>
        </div>

        {challenge.publicTestCases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-slate-400">No public test cases yet.</div>
        ) : (
          <div className="space-y-4">
            {challenge.publicTestCases.map((testCase, index) => (
              <div key={testCase.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Case {index + 1}</span>
                  <button type="button" onClick={() => removeTestCase(testCase.id)} className="text-xs text-rose-400 hover:text-rose-300">
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Input</label>
                    <textarea value={testCase.input} onChange={(e) => updateTestCase(testCase.id, 'input', e.target.value)} rows={3} className={textInputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Expected output</label>
                    <textarea value={testCase.expectedOutput} onChange={(e) => updateTestCase(testCase.id, 'expectedOutput', e.target.value)} rows={3} className={textInputClass} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Max attempts</label>
          <input type="number" min={0} value={challenge.maxAttempts ?? ''} onChange={(e) => updateLimit('maxAttempts', e.target.value)} className={textInputClass} placeholder="Optional" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Time limit (ms)</label>
          <input type="number" min={0} value={challenge.timeLimitMs ?? ''} onChange={(e) => updateLimit('timeLimitMs', e.target.value)} className={textInputClass} placeholder="Optional" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Memory limit (MB)</label>
          <input type="number" min={0} value={challenge.memoryLimitMb ?? ''} onChange={(e) => updateLimit('memoryLimitMb', e.target.value)} className={textInputClass} placeholder="Optional" />
        </div>
      </div>
    </div>
  );
}
