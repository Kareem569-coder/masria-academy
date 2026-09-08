import { describe, it, expect, beforeAll } from 'vitest';
import { dockerAvailable, runIsolatedDockerJob } from '../src/runner/dockerJob';
import { buildDockerRunArgs } from '../src/sandbox/dockerArgs';
import { encodeJobPayload, parseSupervisorReport } from '../src/sandbox/protocol';
import { clampJobLimits } from '../src/config/limits';

describe('Docker Integration Tests', () => {
  let dockerIsAvailable: boolean = false;

  beforeAll(async () => {
    dockerIsAvailable = await dockerAvailable();
  });

  it('detects Docker availability', () => {
    expect(typeof dockerIsAvailable).toBe('boolean');
  });

  // Skip all Docker tests if Docker is not available
  const runIfDockerAvailable = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!dockerIsAvailable) {
        console.log(`Skipping ${name}: Docker not available`);
        return;
      }
      await fn();
    });
  };

  runIfDockerAvailable('executes Hello World C++17 program', async () => {
    const spec = buildDockerRunArgs({
      requestId: 'test-hello-world',
      limits: clampJobLimits({}),
    });

    const payload = encodeJobPayload({
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      maxOutputBytes: 65_536,
      sourceCode: '#include <iostream>\nint main() { std::cout << "Hello, World!"; return 0; }',
    });

    const outcome = await runIsolatedDockerJob({
      spec,
      payload,
      wallClockMs: 20_000,
    });

    expect(outcome.report.status).toBe('COMPLETED');
    expect(outcome.report.stdout).toContain('Hello, World!');
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.cleanupPerformed).toBe(true);
  });

  runIfDockerAvailable('detects compile error', async () => {
    const spec = buildDockerRunArgs({
      requestId: 'test-compile-error',
      limits: clampJobLimits({}),
    });

    const payload = encodeJobPayload({
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      maxOutputBytes: 65_536,
      sourceCode: '#include <iostream>\nint main() { invalid syntax here',
    });

    const outcome = await runIsolatedDockerJob({
      spec,
      payload,
      wallClockMs: 20_000,
    });

    expect(outcome.report.status).toBe('FAILED');
    expect(outcome.report.failureReason).toBe('COMPILE_ERROR');
    expect(outcome.report.exitCode).not.toBe(0);
  });

  runIfDockerAvailable('enforces time limit on infinite loop', async () => {
    const spec = buildDockerRunArgs({
      requestId: 'test-timeout',
      limits: clampJobLimits({ timeLimitMs: 1000 }),
    });

    const payload = encodeJobPayload({
      timeLimitMs: 1000,
      memoryLimitMb: 128,
      maxOutputBytes: 65_536,
      sourceCode: '#include <iostream>\nint main() { while(true) {} return 0; }',
    });

    const outcome = await runIsolatedDockerJob({
      spec,
      payload,
      wallClockMs: 20_000,
    });

    expect(outcome.report.status).toBe('FAILED');
    expect(outcome.report.failureReason).toBe('TIME_LIMIT');
  });

  runIfDockerAvailable('enforces output limit', async () => {
    const spec = buildDockerRunArgs({
      requestId: 'test-output-limit',
      limits: clampJobLimits({}),
    });

    const largeOutput = 'x'.repeat(100_000);
    const payload = encodeJobPayload({
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      maxOutputBytes: 65_536,
      sourceCode: `#include <iostream>\nint main() { std::cout << "${largeOutput}"; return 0; }`,
    });

    const outcome = await runIsolatedDockerJob({
      spec,
      payload,
      wallClockMs: 20_000,
    });

    expect(outcome.report.status).toBe('FAILED');
    expect(outcome.report.failureReason).toBe('OUTPUT_LIMIT');
  });

  runIfDockerAvailable('detects runtime error', async () => {
    const spec = buildDockerRunArgs({
      requestId: 'test-runtime-error',
      limits: clampJobLimits({}),
    });

    const payload = encodeJobPayload({
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      maxOutputBytes: 65_536,
      sourceCode: '#include <iostream>\nint main() { int* p = nullptr; *p = 0; return 0; }',
    });

    const outcome = await runIsolatedDockerJob({
      spec,
      payload,
      wallClockMs: 20_000,
    });

    expect(outcome.report.status).toBe('FAILED');
    expect(outcome.report.failureReason).toBe('RUNTIME_ERROR');
  });

  runIfDockerAvailable('prevents network access', async () => {
    const spec = buildDockerRunArgs({
      requestId: 'test-network-block',
      limits: clampJobLimits({}),
    });

    // Program that would try to make a network request
    const payload = encodeJobPayload({
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      maxOutputBytes: 65_536,
      sourceCode: '#include <iostream>\n#include <sys/socket.h>\n#include <netinet/in.h>\nint main() { int sock = socket(AF_INET, SOCK_STREAM, 0); return sock < 0 ? 1 : 0; }',
    });

    const outcome = await runIsolatedDockerJob({
      spec,
      payload,
      wallClockMs: 20_000,
    });

    // Network should be blocked, so socket creation should fail
    expect(outcome.report.status).toBe('FAILED');
  });

  runIfDockerAvailable('prevents filesystem access outside workspace', async () => {
    const spec = buildDockerRunArgs({
      requestId: 'test-filesystem-block',
      limits: clampJobLimits({}),
    });

    // Program that tries to read /etc/passwd
    const payload = encodeJobPayload({
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      maxOutputBytes: 65_536,
      sourceCode: '#include <iostream>\n#include <fstream>\nint main() { std::ifstream f("/etc/passwd"); return f.good() ? 1 : 0; }',
    });

    const outcome = await runIsolatedDockerJob({
      spec,
      payload,
      wallClockMs: 20_000,
    });

    // Filesystem access should be blocked
    expect(outcome.report.status).toBe('FAILED');
  });

  runIfDockerAvailable('runs as non-root user', async () => {
    const spec = buildDockerRunArgs({
      requestId: 'test-non-root',
      limits: clampJobLimits({}),
    });

    const payload = encodeJobPayload({
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      maxOutputBytes: 65_536,
      sourceCode: '#include <iostream>\n#include <unistd.h>\nint main() { std::cout << getuid(); return 0; }',
    });

    const outcome = await runIsolatedDockerJob({
      spec,
      payload,
      wallClockMs: 20_000,
    });

    expect(outcome.report.status).toBe('COMPLETED');
    // UID 65534 is the "nobody" user specified in Docker args
    expect(outcome.report.stdout).toContain('65534');
  });

  runIfDockerAvailable('enforces PID limit', async () => {
    const spec = buildDockerRunArgs({
      requestId: 'test-pid-limit',
      limits: clampJobLimits({}),
    });

    // Program that tries to fork bomb
    const payload = encodeJobPayload({
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      maxOutputBytes: 65_536,
      sourceCode: '#include <iostream>\n#include <unistd.h>\nint main() { for(int i=0;i<100;i++) fork(); return 0; }',
    });

    const outcome = await runIsolatedDockerJob({
      spec,
      payload,
      wallClockMs: 20_000,
    });

    // Should fail due to PID limit
    expect(outcome.report.status).toBe('FAILED');
  });

  runIfDockerAvailable('cleans up container after execution', async () => {
    const spec = buildDockerRunArgs({
      requestId: 'test-cleanup',
      limits: clampJobLimits({}),
    });

    const payload = encodeJobPayload({
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      maxOutputBytes: 65_536,
      sourceCode: '#include <iostream>\nint main() { std::cout << "test"; return 0; }',
    });

    const outcome = await runIsolatedDockerJob({
      spec,
      payload,
      wallClockMs: 20_000,
    });

    expect(outcome.cleanupPerformed).toBe(true);
  });
});
