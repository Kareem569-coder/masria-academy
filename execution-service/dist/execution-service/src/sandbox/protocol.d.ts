export declare function collectSandboxForbiddenKeys(value: Record<string, unknown>): string[];
export declare function isValidUtf8(source: string): boolean;
export declare function encodeJobPayload(input: {
    timeLimitMs: number;
    memoryLimitMb: number;
    maxOutputBytes: number;
    sourceCode: string;
}): Buffer;
export interface SupervisorReport {
    status: string;
    failureReason: string;
    stdout: string;
    stderr: string;
    exitCode: number;
    signal: number;
    executionTimeMs: number;
}
export declare function parseSupervisorReport(raw: string): SupervisorReport;
//# sourceMappingURL=protocol.d.ts.map