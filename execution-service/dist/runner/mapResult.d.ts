import type { ExecutionRequest, ExecutionResult } from '../contract/execution';
import type { SupervisorReport } from '../sandbox/protocol';
export declare function mapSupervisorReportToExecutionResult(request: ExecutionRequest, report: SupervisorReport, extras?: {
    oomKilled?: boolean;
}): ExecutionResult;
//# sourceMappingURL=mapResult.d.ts.map