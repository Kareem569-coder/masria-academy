import { timingSafeEqual } from 'node:crypto';

export const AUTH_HEADER = 'authorization';
export const BEARER_PREFIX = 'Bearer ';

export function getExpectedServiceToken(env: NodeJS.ProcessEnv = process.env): string {
  // Support both MASRIA_EXECUTION_SERVICE_TOKEN and EXECUTION_SERVICE_TOKEN for flexibility
  return env.MASRIA_EXECUTION_SERVICE_TOKEN ?? env.EXECUTION_SERVICE_TOKEN ?? '';
}

export function authorizeBearerToken(headerValue: string | undefined, expectedToken: string): boolean {
  if (!expectedToken || expectedToken.length < 16) {
    return false;
  }
  if (!headerValue || !headerValue.startsWith(BEARER_PREFIX)) {
    return false;
  }
  const provided = headerValue.slice(BEARER_PREFIX.length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
