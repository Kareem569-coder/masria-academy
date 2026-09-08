export declare const AUTH_HEADER = "authorization";
export declare const BEARER_PREFIX = "Bearer ";
export declare function getExpectedServiceToken(env?: NodeJS.ProcessEnv): string;
export declare function authorizeBearerToken(headerValue: string | undefined, expectedToken: string): boolean;
//# sourceMappingURL=auth.d.ts.map