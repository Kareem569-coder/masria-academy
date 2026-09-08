export const PROGRAMMING_LANGUAGE_IDS = [
    'cpp17',
    'python3',
    'java17',
    'javascript-node',
];
export const PROGRAMMING_LANGUAGES = {
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
export function isProgrammingLanguageId(value) {
    return typeof value === 'string'
        && PROGRAMMING_LANGUAGE_IDS.includes(value);
}
//# sourceMappingURL=languages.js.map