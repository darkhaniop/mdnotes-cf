import { Hono } from 'hono';
import type { AuthVariables } from './middleware/auth';
import { onError } from './middleware/error';
import { securityHeaders } from './middleware/security';
import auth from './routes/auth';
import projects from './routes/projects';
import { assetsById } from './routes/assets';
import { documentsById } from './routes/documents';

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  ASSET_COOKIE_SECRET: string;
  PBKDF2_ITERATIONS?: string;
};

export type AppEnv = { Bindings: Bindings; Variables: AuthVariables };

const api = new Hono<AppEnv>().basePath('/api');

api.get('/health', (c) => c.json({ ok: true, service: 'mdnotes', time: Date.now() }));
api.route('/auth', auth);
api.route('/projects', projects);
api.route('/assets', assetsById);
api.route('/documents', documentsById);

const app = new Hono<AppEnv>();

app.onError(onError);
app.use('*', securityHeaders);
app.route('/', api);

/**
 * Anything that is not an API route is the SPA. The Worker runs first for every
 * request (`run_worker_first: true`) so the security headers also cover the HTML
 * document — Static Assets served directly would bypass the middleware. The
 * assets binding still performs the SPA fallback via `not_found_handling`.
 */
app.all('*', (c) => {
  if (new URL(c.req.url).pathname.startsWith('/api/')) {
    return c.json({ error: 'not_found' }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
