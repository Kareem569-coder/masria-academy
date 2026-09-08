export const RUNNER_VERSION = 'masria-cpp17-v1';
export const RUNNER_LANGUAGE = 'cpp17' as const;
export const C_STANDARD = 'c++17';

/** Official Docker image tag. Verify `g++ -dumpfullversion` at image build. */
export const RUNNER_BASE_IMAGE = 'gcc:13.4.0-bookworm';
export const EXPECTED_GCC_VERSION = '13.4.0';
export const COMPILER_PATH = '/usr/local/bin/g++';
export const JOB_IMAGE_NAME = 'masria-cpp17-runner:13.4.0';

export const PROTOCOL_MAGIC = 'MEX1';
