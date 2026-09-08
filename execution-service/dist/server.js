import { createServer } from 'node:http';
import { authorizeBearerToken, getExpectedServiceToken } from './config/auth';
import { RUNNER_VERSION } from './config/limits';
import { executeTrustedRequest, safeLogFields } from './runner/execute';
const MAX_BODY_BYTES = 120_000;
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('payload too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}
function send(res, statusCode, body) {
    const payload = JSON.stringify(body);
    res.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    res.end(payload);
}
export function createExecutionServer(options) {
    return createServer(async (req, res) => {
        try {
            if (req.method === 'GET' && req.url === '/health') {
                send(res, 200, { status: 'ok', runnerVersion: RUNNER_VERSION, language: 'cpp17' });
                return;
            }
            if (req.method !== 'POST' || req.url !== '/execute') {
                send(res, 404, { errors: ['not found'] });
                return;
            }
            const token = options?.token ?? getExpectedServiceToken();
            if (!authorizeBearerToken(req.headers.authorization, token)) {
                send(res, 401, { errors: ['unauthenticated'] });
                return;
            }
            let parsed;
            try {
                parsed = JSON.parse(await readBody(req));
            }
            catch {
                send(res, 400, { errors: ['malformed request'] });
                return;
            }
            const outcome = await executeTrustedRequest(parsed, {
                token,
                authorizationHeader: req.headers.authorization,
            });
            if (outcome.result) {
                console.info(JSON.stringify(safeLogFields(outcome.result)));
                send(res, outcome.statusCode, outcome.result);
                return;
            }
            send(res, outcome.statusCode, { errors: outcome.errors });
        }
        catch (error) {
            const message = error instanceof Error && error.message === 'payload too large'
                ? 'payload too large'
                : 'internal error';
            send(res, message === 'payload too large' ? 413 : 500, { errors: [message] });
        }
    });
}
const isMain = process.argv[1]?.includes('server');
if (isMain) {
    const port = Number(process.env.PORT ?? 8787);
    const server = createExecutionServer();
    server.listen(port, '127.0.0.1', () => {
        console.info(JSON.stringify({
            event: 'listening',
            bind: '127.0.0.1',
            port,
            runnerVersion: RUNNER_VERSION,
        }));
    });
}
//# sourceMappingURL=server.js.map