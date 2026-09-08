import { type ExecutionRequest, type ExecutionResult } from '../contract/execution';
import { dockerAvailable, runIsolatedDockerJob } from './dockerJob';
export interface ExecuteContext {
    token?: string;
    authorizationHeader?: string;
    dockerRunner?: typeof runIsolatedDockerJob;
    dockerProbe?: typeof dockerAvailable;
}
export declare function previewTrustedRequest(body: unknown): {
    ok: true;
    request: ExecutionRequest;
} | {
    ok: false;
    errors: string[];
};
export declare function executeTrustedRequest(body: unknown, context?: ExecuteContext): Promise<{
    statusCode: number;
    result?: ExecutionResult;
    errors?: string[];
}>;
export declare function safeLogFields(result: ExecutionResult): Record<string, unknown>;
//# sourceMappingURL=execute.d.ts.map