import { type ResolvedJobLimits } from '../config/limits';
export interface DockerJobSpec {
    args: string[];
    image: string;
    containerName: string;
}
export declare function sanitizeContainerName(requestId: string): string;
export declare function buildDockerRunArgs(input: {
    requestId: string;
    limits: ResolvedJobLimits;
    image?: string;
}): DockerJobSpec;
export declare function dockerArgsExposeNetwork(args: string[]): boolean;
export declare function dockerArgsContainHostSecrets(args: string[]): boolean;
//# sourceMappingURL=dockerArgs.d.ts.map