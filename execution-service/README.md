# MASRIA Execution Service

Isolated C++17 execution service for the MASRIA educational platform.

## Purpose

This service is responsible ONLY for executing untrusted student C++17 source code inside isolated Docker containers. It:

- Accepts validated `ExecutionRequest` from the trusted gateway
- Executes code in isolated Docker containers with strict resource limits
- Returns `ExecutionResult` (NOT a grade/verdict)
- Never calculates AC/WA/CE/etc. (evaluator responsibility)
- Never writes to Firestore
- Never updates student progress
- Never accesses private challenge configuration

## Security Architecture

### Container Isolation

Every student execution runs in a fresh isolated container with:

- **No network**: `--network none`
- **Read-only root filesystem**: `--read-only`
- **Temporary writable workspace only**: `--tmpfs /workspace:rw,noexec,nosuid,nodev,size=64m`
- **Non-root user**: `--user 65534:65534` (nobody)
- **Dropped capabilities**: `--cap-drop ALL`
- **No privilege escalation**: `--security-opt no-new-privileges:true`
- **Strict memory limits**: Configurable, max 256MB
- **Strict CPU limits**: 0.50 CPU cores
- **Strict process/PID limits**: Max 32 PIDs
- **Execution timeout**: Configurable, max 10s
- **Output size limits**: 64KB stdout/stderr

### Source Handling

Student source is treated as untrusted input:

- Never constructs shell commands by string concatenation
- Never interpolates source into shell commands
- Writes source to known file path: `/workspace/main.cpp`
- Invokes compiler using argument array
- Compiler and executable remain inside isolated container

### Compilation

Compiles as C++17 with: `g++ -std=c++17 -O2 -pipe main.cpp -o main`

Compilation failure maps to: `ExecutionResult.status = "FAILED"`, `failureReason = "COMPILE_ERROR"`

### Resource Limits

Service-controlled limits (never student-provided):

- `DEFAULT_TIME_LIMIT_MS`: 2000ms
- `MAX_TIME_LIMIT_MS`: 10_000ms
- `DEFAULT_MEMORY_LIMIT_MB`: 128MB
- `MAX_MEMORY_LIMIT_MB`: 256MB
- `MAX_OUTPUT_BYTES`: 65_536
- `MAX_PIDS`: 32
- `CPU_LIMIT`: 0.50

## Project Structure

```
execution-service/
├── src/
│   ├── contract/
│   │   └── execution.ts          # ExecutionRequest/ExecutionResult contracts
│   ├── config/
│   │   ├── auth.ts                # Authentication
│   │   ├── limits.ts              # Resource limits
│   │   └── versions.ts            # Version constants
│   ├── runner/
│   │   ├── dockerJob.ts           # Docker job execution
│   │   ├── execute.ts             # Main execution logic
│   │   ├── idempotency.ts         # Idempotency gate
│   │   └── mapResult.ts           # Supervisor report mapping
│   ├── sandbox/
│   │   ├── dockerArgs.ts          # Docker argument builder
│   │   ├── protocol.ts            # Supervisor protocol
│   │   └── supervisor.c           # C supervisor binary
│   └── server.ts                  # HTTP server
├── tests/
│   ├── contract.test.ts           # Contract validation tests
│   ├── runner.test.ts             # Runner configuration tests
│   └── integration.docker.test.ts  # Docker integration tests
├── Dockerfile                     # Job container image
├── Dockerfile.job                 # Service container image
├── docker-compose.yml             # Local development
├── package.json
├── tsconfig.json
└── README.md
```

## API

### POST /execute

Executes a C++17 source code request.

**Request:**
```json
{
  "requestId": "exec:masria-exec-1:sub-123",
  "submissionId": "sub-123",
  "studentId": "student-1",
  "lessonId": "lesson-1",
  "activityId": "activity-1",
  "challengeVersion": 1,
  "language": "cpp17",
  "sourceCode": "#include <iostream>\nint main() { return 0; }",
  "requestedAt": "2026-09-01T00:00:00.000Z",
  "contractVersion": "masria-exec-1",
  "status": "QUEUED",
  "timeLimitMs": 2000,
  "memoryLimitMb": 128
}
```

**Response:**
```json
{
  "requestId": "exec:masria-exec-1:sub-123",
  "submissionId": "sub-123",
  "status": "COMPLETED",
  "language": "cpp17",
  "stdout": "Hello, World!",
  "stderr": "",
  "exitCode": 0,
  "executionTimeMs": 100,
  "memoryUsedKb": 1024,
  "runnerVersion": "masria-cpp17-gcc13.4.0-v1",
  "completedAt": "2026-09-01T00:00:01.000Z"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "runnerVersion": "masria-cpp17-gcc13.4.0-v1",
  "language": "cpp17"
}
```

## Authentication

The service requires an internal service token via `Authorization: Bearer <token>` header.

Set via environment variable: `EXECUTION_SERVICE_TOKEN`

The browser must never receive this token. Only the trusted gateway should call this service.

## Development

### Install dependencies

```bash
cd execution-service
npm install
```

### Run unit tests (no Docker required)

```bash
npm test
```

### Run Docker integration tests (requires Docker)

```bash
npm run test:integration
```

### Build TypeScript

```bash
npm run build
```

### Start service locally

```bash
npm start
```

Or with docker-compose:

```bash
docker-compose up
```

## Docker Images

### Job Container (Dockerfile)

Based on `gcc:13.4.0-bookworm` with:

- Pinned GCC 13.4.0
- Non-root execution user
- Minimal packages
- No credentials or secrets

### Service Container (Dockerfile.job)

Node.js runtime with:

- TypeScript compilation
- Docker CLI for job execution
- Internal service token authentication

## Contract Compatibility

The execution-service mirrors the D3A execution contract from MASRIA to maintain compatibility while being physically separate.

Contract version: `masria-exec-1`

Runner version: `masria-cpp17-gcc13.4.0-v1`

## Security Review Checklist

- [x] No child_process/exec/execSync/spawn in MASRIA Next.js app
- [x] Docker process invocation only inside execution-service
- [x] No Docker socket exposed to student containers
- [x] No network access from job containers
- [x] No host filesystem mounts
- [x] No credentials enter the job
- [x] Student code treated as untrusted
- [x] Limits are service-controlled
- [x] Output is bounded
- [x] PIDs are bounded
- [x] Containers destroyed after jobs
- [x] No evaluator logic exists
- [x] No Firestore writes exist
- [x] No browser-facing execution endpoint without authentication
- [x] C++17 is the only enabled runtime

## Known Limitations

1. **C++17 Only**: Other languages (python3, java17, javascript-node) are not yet supported.
2. **No stdin support**: The current contract does not include stdin input for test cases. This will be added in D3C.
3. **Windows Development**: Docker integration tests require Docker Desktop on Windows for local testing.
4. **Authentication**: Current authentication uses a simple bearer token. D3C will refine this with a more robust mechanism.

## Next Steps (D3C)

1. Add stdin support for test case input
2. Implement evaluator logic (AC/WA determination)
3. Integrate with Firestore for writing CodingEvaluation
4. Refine authentication mechanism
5. Add support for additional languages (python3, java17, javascript-node)

## License

UNLICENSED - Internal educational platform use only.
