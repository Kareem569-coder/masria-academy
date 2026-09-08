export const PROGRAMMING_LANGUAGE_IDS = [
  'cpp17',
  'python3',
  'java17',
  'javascript-node',
] as const;

export type ProgrammingLanguageId = (typeof PROGRAMMING_LANGUAGE_IDS)[number];

export interface ProgrammingLanguage {
  id: ProgrammingLanguageId;
  displayName: string;
  runtimeLabel: string;
  defaultStarterCode: string;
}

export const PROGRAMMING_LANGUAGES: Record<ProgrammingLanguageId, ProgrammingLanguage> = {
  cpp17: {
    id: 'cpp17',
    displayName: 'C++',
    runtimeLabel: 'GNU C++17',
    defaultStarterCode: '#include <iostream>\n\nint main() {\n  // Write your code here\n  return 0;\n}\n',
  },
  python3: {
    id: 'python3',
    displayName: 'Python',
    runtimeLabel: 'Python 3',
    defaultStarterCode: '# Write your code here\n',
  },
  java17: {
    id: 'java17',
    displayName: 'Java',
    runtimeLabel: 'Java 17',
    defaultStarterCode: 'public class Main {\n  public static void main(String[] args) {\n    // Write your code here\n  }\n}\n',
  },
  'javascript-node': {
    id: 'javascript-node',
    displayName: 'JavaScript',
    runtimeLabel: 'Node.js',
    defaultStarterCode: '// Write your code here\n',
  },
};

export function isProgrammingLanguageId(value: unknown): value is ProgrammingLanguageId {
  return typeof value === 'string'
    && (PROGRAMMING_LANGUAGE_IDS as readonly string[]).includes(value);
}
