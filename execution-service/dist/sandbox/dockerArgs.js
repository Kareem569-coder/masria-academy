import { COMPILE_TIME_MS, CPU_LIMIT, MAX_PIDS, RUNNER_BASE_IMAGE, SUPERVISOR_PATH, WORKSPACE_TMPFS_SIZE, } from '../config/limits';
const HOST_SECRET_ENV = [
    'EXECUTION_SERVICE_TOKEN',
    'FIREBASE_API_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
];
export function sanitizeContainerName(requestId) {
    const slug = requestId.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 40);
    return `mex-${slug || 'job'}`;
}
export function buildDockerRunArgs(input) {
    const image = input.image ?? RUNNER_BASE_IMAGE;
    const containerName = sanitizeContainerName(input.requestId);
    const args = [
        'run',
        '--rm',
        '--interactive',
        '--network',
        'none',
        '--read-only',
        '--tmpfs',
        `/workspace:rw,exec,nosuid,nodev,size=${WORKSPACE_TMPFS_SIZE}`,
        '--tmpfs',
        '/tmp:rw,noexec,nosuid,nodev,size=16m',
        '--user',
        '65534:65534',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges=true',
        '--memory',
        `${input.limits.memoryLimitMb}m`,
        '--memory-swap',
        `${input.limits.memoryLimitMb}m`,
        '--cpus',
        input.limits.cpuLimit,
        '--pids-limit',
        String(input.limits.pidsLimit),
        '--ulimit',
        `nproc=${input.limits.pidsLimit}:${input.limits.pidsLimit}`,
        '--name',
        containerName,
        '--entrypoint',
        SUPERVISOR_PATH,
        image,
    ];
    if (args.includes('--privileged') || args.includes('-v') || args.includes('--volume')) {
        throw new Error('refusing to build a privileged or bind-mounted job spec');
    }
    for (const secret of HOST_SECRET_ENV) {
        if (args.includes(secret) || args.some((part) => part.includes(secret))) {
            throw new Error('refusing to pass host secrets into the job container');
        }
    }
    if (CPU_LIMIT !== input.limits.cpuLimit) {
        throw new Error('cpu limit mismatch');
    }
    if (input.limits.pidsLimit > MAX_PIDS) {
        throw new Error('pid limit exceeds server maximum');
    }
    if (COMPILE_TIME_MS < 1) {
        throw new Error('invalid compile budget');
    }
    return { args, image, containerName };
}
export function dockerArgsExposeNetwork(args) {
    const networkIndex = args.indexOf('--network');
    return networkIndex === -1 || args[networkIndex + 1] !== 'none';
}
export function dockerArgsContainHostSecrets(args) {
    return HOST_SECRET_ENV.some((secret) => args.some((part) => part.includes(secret)));
}
//# sourceMappingURL=dockerArgs.js.map