import { spawn } from 'node:child_process';
import { COMPILE_TIME_MS } from '../config/limits';
import { parseSupervisorReport } from '../sandbox/protocol';
export async function dockerAvailable(env = process.env) {
    if (env.MASRIA_SKIP_DOCKER === '1') {
        return false;
    }
    return await new Promise((resolve) => {
        const child = spawn('docker', ['info'], { stdio: ['ignore', 'ignore', 'ignore'] });
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            resolve(false);
        }, 4000);
        child.on('error', () => {
            clearTimeout(timer);
            resolve(false);
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve(code === 0);
        });
    });
}
export async function runIsolatedDockerJob(input) {
    const stdoutChunks = [];
    const stderrChunks = [];
    await new Promise((resolve, reject) => {
        const child = spawn('docker', input.spec.args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            env: {
                PATH: process.env.PATH,
                SYSTEMROOT: process.env.SYSTEMROOT,
                DOCKER_HOST: process.env.DOCKER_HOST,
            },
        });
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
        }, input.wallClockMs);
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
        child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
        child.stdin.on('error', () => undefined);
        child.stdin.end(input.payload);
        child.on('close', (code) => {
            clearTimeout(timer);
            if (code !== 0 && stdoutChunks.length === 0) {
                const errText = Buffer.concat(stderrChunks).toString('utf8').slice(0, 500);
                reject(new Error(errText || `docker run exited ${code}`));
                return;
            }
            resolve();
        });
    });
    const raw = Buffer.concat(stdoutChunks).toString('utf8');
    const report = parseSupervisorReport(raw);
    return {
        report,
        oomKilled: false,
        cleanupPerformed: input.spec.args.includes('--rm'),
    };
}
export function jobWallClockMs(timeLimitMs) {
    return COMPILE_TIME_MS + timeLimitMs + 5000;
}
//# sourceMappingURL=dockerJob.js.map