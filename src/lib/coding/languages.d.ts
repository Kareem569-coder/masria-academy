export declare const PROGRAMMING_LANGUAGE_IDS: readonly ["cpp17", "python3", "java17", "javascript-node"];
export type ProgrammingLanguageId = (typeof PROGRAMMING_LANGUAGE_IDS)[number];
export interface ProgrammingLanguage {
    id: ProgrammingLanguageId;
    displayName: string;
    runtimeLabel: string;
    defaultStarterCode: string;
}
export declare const PROGRAMMING_LANGUAGES: Record<ProgrammingLanguageId, ProgrammingLanguage>;
export declare function isProgrammingLanguageId(value: unknown): value is ProgrammingLanguageId;
//# sourceMappingURL=languages.d.ts.map