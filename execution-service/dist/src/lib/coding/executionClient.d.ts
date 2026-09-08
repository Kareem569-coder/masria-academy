/**
 * D3F: Trusted Execution Service HTTP Client
 *
 * Server-only module for communicating with the isolated execution-service.
 * Never import this into client components.
 *
 * Responsibilities:
 * - Read execution-service URL from trusted environment configuration
 * - Authenticate requests with service-to-service token
 * - Send validated ExecutionRequest data
 * - Validate ExecutionResult before returning
 * - Handle timeouts and infrastructure failures
 * - Never expose secrets, private tests, or reference solutions
 */
import { type ExecutionRequest, type ExecutionResult, type ExecutionService } from '@/lib/coding/execution';
export declare const EXECUTION_CLIENT_DEFAULT_TIMEOUT_MS = 30000;
export declare const EXECUTION_CLIENT_MAX_RESPONSE_SIZE = 1000000;
interface ExecutionClientConfig {
    executionServiceUrl: string;
    serviceToken: string;
    timeoutMs?: number;
    maxResponseSize?: number;
}
/**
 * HTTP client for the isolated execution-service.
 * Implements the ExecutionService interface.
 */
export declare class RemoteExecutionService implements ExecutionService {
    private config;
    constructor(config: ExecutionClientConfig);
    /**
     * Execute a coding submission via HTTP POST to the execution-service.
     */
    execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
/**
 * Factory function to create a RemoteExecutionService from environment variables.
 * Only available on the server.
 */
export declare function createRemoteExecutionService(): RemoteExecutionService;
export {};
//# sourceMappingURL=executionClient.d.ts.map