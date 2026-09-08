'use client';

import { useMemo, useRef } from 'react';
import { PROGRAMMING_LANGUAGES, type ProgrammingLanguageId } from '@/lib/coding/languages';

export type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language: ProgrammingLanguageId;
  readOnly?: boolean;
  disabled?: boolean;
  starterCode?: string;
  id?: string;
  className?: string;
};

const KEYWORD_PATTERN = /(\b(?:return|int|float|double|char|bool|void|auto|const|if|else|for|while|switch|case|break|continue|class|struct|using|namespace|std|cout|cin|public|private|protected|include|new|delete|true|false|nullptr|template|typename)\b)/g;
const NUMBER_PATTERN = /\b(\d+(?:\.\d+)?)\b/g;
const STRING_PATTERN = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;
const COMMENT_PATTERN = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
const OPERATOR_PATTERN = /(===|!==|==|!=|<=|>=|&&|\|\||[-+*/%=<>!&|;:(){}\[\].,])/g;

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export function getLanguageDisplayName(language: ProgrammingLanguageId): string {
  return PROGRAMMING_LANGUAGES[language]?.displayName ?? language;
}

export function getCodeDirection(): 'ltr' {
  return 'ltr';
}

export function getChallengeStarterCode(
  challenge: { starterCodeByLanguage?: Array<{ language: ProgrammingLanguageId; starterCode: string }> | undefined; defaultLanguage?: ProgrammingLanguageId; },
  language: ProgrammingLanguageId
): string {
  const starterCode = challenge?.starterCodeByLanguage?.find((entry) => entry.language === language)?.starterCode;
  if (starterCode && starterCode.trim().length > 0) {
    return starterCode;
  }

  const fallbackLanguage = challenge?.defaultLanguage ?? 'cpp17';
  return challenge?.starterCodeByLanguage?.find((entry) => entry.language === fallbackLanguage)?.starterCode
    ?? PROGRAMMING_LANGUAGES[language]?.defaultStarterCode
    ?? PROGRAMMING_LANGUAGES.cpp17.defaultStarterCode;
}

export function buildCodingDraftStorageKey(
  studentId: string,
  lessonId: string,
  activityId: string,
  challengeVersion: number,
  language: ProgrammingLanguageId
): string {
  return `masria:coding-draft:${studentId}:${lessonId}:${activityId}:${challengeVersion}:${language}`;
}

export function resolveChallengeCode(
  starterCode: string,
  draftCode?: string | null,
  fallbackCode?: string | null
): string {
  if (typeof draftCode === 'string' && draftCode.length > 0) {
    return draftCode;
  }
  return starterCode || fallbackCode || '';
}

export function resetChallengeCode(
  starterCode: string,
  currentValue: string
): string {
  return starterCode || currentValue || '';
}

function highlightCode(value: string): string {
  const escaped = escapeHtml(value);

  return escaped
    .replace(COMMENT_PATTERN, '<span style="color:#94a3b8">$1</span>')
    .replace(STRING_PATTERN, '<span style="color:#86efac">$1</span>')
    .replace(KEYWORD_PATTERN, '<span style="color:#7dd3fc">$1</span>')
    .replace(NUMBER_PATTERN, '<span style="color:#f9a8d4">$1</span>')
    .replace(OPERATOR_PATTERN, '<span style="color:#cbd5e1">$1</span>');
}

export default function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  disabled = false,
  starterCode,
  id,
  className = '',
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLPreElement | null>(null);

  const lineNumbers = useMemo(() => {
    const totalLines = Math.max(1, (value || '').split('\n').length);
    return Array.from({ length: totalLines }, (_, index) => index + 1);
  }, [value]);

  const syncScroll = () => {
    if (!textareaRef.current || !overlayRef.current) return;
    overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
  };

  const showStarterHint = !!starterCode && value !== starterCode;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#020817] shadow-[0_0_30px_rgba(15,23,42,0.45)] ${className}`.trim()}
      dir={getCodeDirection()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-slate-950/75 px-4 py-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          {getLanguageDisplayName(language)}
        </div>
        {showStarterHint && (
          <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">
            Starter modified
          </div>
        )}
      </div>

      <div className="flex min-h-[18rem] max-h-[28rem] overflow-auto bg-[#020817]">
        <div className="select-none border-r border-white/10 bg-slate-950/80 px-3 py-4 text-right text-xs leading-6 text-slate-500">
          {lineNumbers.map((lineNumber) => (
            <div key={`line-${lineNumber}`} className="h-6">{lineNumber}</div>
          ))}
        </div>

        <div className="relative flex-1 overflow-auto" dir="ltr" style={{ direction: 'ltr' }}>
          <pre
            ref={overlayRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre font-mono text-[14px] leading-6 text-slate-200"
            dir="ltr"
            dangerouslySetInnerHTML={{ __html: highlightCode(value || '') || '&nbsp;' }}
            style={{
              padding: '1rem',
              minHeight: '100%',
              minWidth: '100%',
              tabSize: 2,
              direction: 'ltr',
              textAlign: 'left',
              unicodeBidi: 'plaintext',
            }}
          />

          {/* LTR isolation wrapper for textarea - critical for Arabic RTL context */}
          <div
            dir="ltr"
            style={{
              position: 'relative',
              zIndex: 10,
              height: '100%',
              minHeight: '18rem',
              width: '100%',
              direction: 'ltr',
            }}
          >
            <textarea
              id={id}
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              readOnly={readOnly}
              disabled={disabled}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              wrap="off"
              onScroll={syncScroll}
              dir="ltr"
              className="h-full w-full resize-none border-0 bg-transparent px-4 py-4 font-mono text-[14px] leading-6 text-transparent caret-slate-100 outline-none placeholder:text-slate-500"
              style={{
                minWidth: '100%',
                tabSize: 2,
                whiteSpace: 'pre',
                overflow: 'auto',
                direction: 'ltr',
                textAlign: 'left',
                unicodeBidi: 'plaintext',
              }}
              aria-label={`Code editor for ${getLanguageDisplayName(language)}`}
              aria-readonly={readOnly}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
