const SANDBOX_FORBIDDEN_KEYS = [
    'compilerFlags',
    'compilerPath',
    'linkerFlags',
    'outputPath',
    'libraries',
    'command',
    'argv',
    'env',
    'environment',
    'environmentVariables',
    'network',
    'networkAccess',
    'allowNetwork',
    'filesystem',
    'cwd',
    'workingDirectory',
    'filePath',
    'timeout',
    'memoryLimit',
    'docker',
    'privileged',
    'mounts',
];
export function collectSandboxForbiddenKeys(value) {
    return SANDBOX_FORBIDDEN_KEYS.filter((key) => key in value);
}
export function isValidUtf8(source) {
    const bytes = Buffer.from(source, 'utf8');
    return bytes.toString('utf8') === source && Buffer.isUtf8(bytes);
}
export function encodeJobPayload(input) {
    const source = Buffer.from(input.sourceCode, 'utf8');
    const header = Buffer.alloc(4 + 16);
    header.write('MEX1', 0, 4, 'ascii');
    header.writeUInt32BE(input.timeLimitMs, 4);
    header.writeUInt32BE(input.memoryLimitMb, 8);
    header.writeUInt32BE(input.maxOutputBytes, 12);
    header.writeUInt32BE(source.length, 16);
    return Buffer.concat([header, source]);
}
export function parseSupervisorReport(raw) {
    const line = raw.trim().split('\n').filter(Boolean).at(-1);
    if (!line) {
        throw new Error('empty supervisor report');
    }
    const parsed = JSON.parse(line);
    if (typeof parsed.status !== 'string') {
        throw new Error('invalid supervisor status');
    }
    return {
        status: parsed.status,
        failureReason: typeof parsed.failureReason === 'string' ? parsed.failureReason : '',
        stdout: typeof parsed.stdout === 'string' ? parsed.stdout : '',
        stderr: typeof parsed.stderr === 'string' ? parsed.stderr : '',
        exitCode: Number.isInteger(parsed.exitCode) ? parsed.exitCode : -1,
        signal: Number.isInteger(parsed.signal) ? parsed.signal : 0,
        executionTimeMs: Number.isInteger(parsed.executionTimeMs) ? parsed.executionTimeMs : 0,
    };
}
//# sourceMappingURL=protocol.js.map