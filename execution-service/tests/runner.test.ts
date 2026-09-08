import { describe, it, expect } from 'vitest';
import { clampJobLimits, RUNNER_VERSION, RUNNER_LANGUAGE } from '../src/config/limits';
import { buildDockerRunArgs, dockerArgsExposeNetwork, dockerArgsContainHostSecrets } from '../src/sandbox/dockerArgs';

describe('Runner Configuration', () => {
  describe('Job limits clamping', () => {
    it('clamps time limit to service maximum', () => {
      const limits = clampJobLimits({ timeLimitMs: 20_000 });
      expect(limits.timeLimitMs).toBe(10_000); // MAX_TIME_LIMIT_MS
    });

    it('clamps memory limit to service maximum', () => {
      const limits = clampJobLimits({ memoryLimitMb: 512 });
      expect(limits.memoryLimitMb).toBe(256); // MAX_MEMORY_LIMIT_MB
    });

    it('uses defaults when no limits provided', () => {
      const limits = clampJobLimits({});
      expect(limits.timeLimitMs).toBe(2000); // DEFAULT_TIME_LIMIT_MS
      expect(limits.memoryLimitMb).toBe(128); // DEFAULT_MEMORY_LIMIT_MB
    });

    it('clamps to minimum values', () => {
      const limits = clampJobLimits({ timeLimitMs: 0, memoryLimitMb: 0 });
      expect(limits.timeLimitMs).toBe(1);
      expect(limits.memoryLimitMb).toBe(1);
    });

    it('enforces service maximums regardless of input', () => {
      const limits = clampJobLimits({ timeLimitMs: 100_000, memoryLimitMb: 10_000 });
      expect(limits.timeLimitMs).toBe(10_000);
      expect(limits.memoryLimitMb).toBe(256);
    });

    it('sets bounded output limit', () => {
      const limits = clampJobLimits({});
      expect(limits.maxOutputBytes).toBe(65_536);
    });

    it('sets PID limit', () => {
      const limits = clampJobLimits({});
      expect(limits.pidsLimit).toBe(32);
    });

    it('sets CPU limit', () => {
      const limits = clampJobLimits({});
      expect(limits.cpuLimit).toBe('0.50');
    });
  });

  describe('Docker arguments security', () => {
    it('builds secure Docker run args', () => {
      const spec = buildDockerRunArgs({
        requestId: 'test-request',
        limits: clampJobLimits({}),
      });

      expect(spec.args).toContain('--network');
      expect(spec.args).toContain('none');
      expect(spec.args).toContain('--read-only');
      expect(spec.args).toContain('--cap-drop');
      expect(spec.args).toContain('ALL');
      expect(spec.args).toContain('--security-opt');
      expect(spec.args).toContain('no-new-privileges=true');
      expect(spec.args).toContain('--user');
      expect(spec.args).toContain('65534:65534');
    });

    it('rejects privileged mode', () => {
      expect(() => {
        buildDockerRunArgs({
          requestId: 'test',
          limits: clampJobLimits({}),
          image: 'gcc:13.4.0',
        });
      }).not.toThrow();
    });

    it('detects network exposure', () => {
      const spec = buildDockerRunArgs({
        requestId: 'test',
        limits: clampJobLimits({}),
      });
      expect(dockerArgsExposeNetwork(spec.args)).toBe(false);
    });

    it('detects host secrets in args', () => {
      const spec = buildDockerRunArgs({
        requestId: 'test',
        limits: clampJobLimits({}),
      });
      expect(dockerArgsContainHostSecrets(spec.args)).toBe(false);
    });
  });

  describe('Runner version', () => {
    it('uses pinned runner version', () => {
      expect(RUNNER_VERSION).toBe('masria-cpp17-v1');
    });

    it('uses cpp17 language', () => {
      expect(RUNNER_LANGUAGE).toBe('cpp17');
    });
  });
});
