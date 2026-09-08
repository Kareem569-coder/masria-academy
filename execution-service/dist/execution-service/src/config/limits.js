export const RUNNER_VERSION = 'masria-cpp17-v1';
export const RUNNER_LANGUAGE = 'cpp17';
export const CPP_STANDARD = 'c++17';
/** Official image tag. Verify `g++ -dumpfullversion` at image build. */
export const RUNNER_BASE_IMAGE = 'gcc:13.4.0-bookworm';
export const EXPECTED_GCC_VERSION = '13.4.0';
export const COMPILER_PATH = '/usr/local/bin/g++';
export const SUPERVISOR_PATH = '/usr/local/bin/masria-supervisor';
export const DEFAULT_TIME_LIMIT_MS = 2000;
export const MAX_TIME_LIMIT_MS = 10_000;
export const DEFAULT_MEMORY_LIMIT_MB = 128;
export const MAX_MEMORY_LIMIT_MB = 256;
export const MAX_OUTPUT_BYTES = 65_536;
export const MAX_SOURCE_BYTES = 100_000;
export const MAX_PIDS = 32;
export const CPU_LIMIT = '0.50';
export const COMPILE_TIME_MS = 15_000;
export const WORKSPACE_TMPFS_SIZE = '64m';
export const PROTOCOL_MAGIC = 'MEX1';
export function clampJobLimits(input) {
    const timeLimitMs = clamp(input.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS, 1, MAX_TIME_LIMIT_MS);
    const memoryLimitMb = clamp(input.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB, 1, MAX_MEMORY_LIMIT_MB);
    return {
        timeLimitMs,
        memoryLimitMb,
        maxOutputBytes: MAX_OUTPUT_BYTES,
        pidsLimit: MAX_PIDS,
        cpuLimit: CPU_LIMIT,
    };
}
function clamp(value, min, max) {
    if (!Number.isFinite(value))
        return min;
    return Math.min(max, Math.max(min, Math.floor(value)));
}
//# sourceMappingURL=limits.js.map