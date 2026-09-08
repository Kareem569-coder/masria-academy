import { type SupervisorReport } from '../sandbox/protocol';
import type { DockerJobSpec } from '../sandbox/dockerArgs';
export interface DockerRunOutcome {
    report: SupervisorReport;
    oomKilled: boolean;
    cleanupPerformed: boolean;
}
export declare function dockerAvailable(env?: NodeJS.ProcessEnv): Promise<boolean>;
export declare function runIsolatedDockerJob(input: {
    spec: DockerJobSpec;
    payload: Buffer;
    wallClockMs: number;
}): Promise<DockerRunOutcome>;
export declare function jobWallClockMs(timeLimitMs: number): number;
//# sourceMappingURL=dockerJob.d.ts.map