export declare const RUNNER_VERSION = "masria-cpp17-v1";
export declare const RUNNER_LANGUAGE: "cpp17";
export declare const CPP_STANDARD = "c++17";
/** Official image tag. Verify `g++ -dumpfullversion` at image build. */
export declare const RUNNER_BASE_IMAGE = "gcc:13.4.0-bookworm";
export declare const EXPECTED_GCC_VERSION = "13.4.0";
export declare const COMPILER_PATH = "/usr/local/bin/g++";
export declare const SUPERVISOR_PATH = "/usr/local/bin/masria-supervisor";
export declare const DEFAULT_TIME_LIMIT_MS = 2000;
export declare const MAX_TIME_LIMIT_MS = 10000;
export declare const DEFAULT_MEMORY_LIMIT_MB = 128;
export declare const MAX_MEMORY_LIMIT_MB = 256;
export declare const MAX_OUTPUT_BYTES = 65536;
export declare const MAX_SOURCE_BYTES = 100000;
export declare const MAX_PIDS = 32;
export declare const CPU_LIMIT = "0.50";
export declare const COMPILE_TIME_MS = 15000;
export declare const WORKSPACE_TMPFS_SIZE = "64m";
export declare const PROTOCOL_MAGIC = "MEX1";
/**
 * Educational C++17 defaults:
 * - 2s wall time is enough for intro I/O programs and fails closed on infinite loops.
 * - 10s is a hard ceiling so a misconfigured challenge cannot DoS the host.
 * - 128MB matches typical school OJ limits; 256MB is the absolute cap.
 * - 64KiB stdout/stderr matches the D3A ExecutionResult contract.
 * - 32 PIDs blocks trivial fork bombs inside the job container.
 */
export interface ResolvedJobLimits {
    timeLimitMs: number;
    memoryLimitMb: number;
    maxOutputBytes: number;
    pidsLimit: number;
    cpuLimit: string;
}
export declare function clampJobLimits(input: {
    timeLimitMs?: number;
    memoryLimitMb?: number;
}): ResolvedJobLimits;
//# sourceMappingURL=limits.d.ts.map