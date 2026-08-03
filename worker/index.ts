import { Hono } from 'hono';
import type { AuthVariables } from './middleware/auth';
import { onError } from './middleware/error';
import auth from './routes/auth';
import projects from './routes/projects';

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  ASSET_COOKIE_SECRET: string;
  PBKDF2_ITERATIONS?: string;
};

export type AppEnv = { Bindings: Bindings; Variables: AuthVariables };

const app = new Hono<AppEnv>().basePath('/api');

app.onError(onError);

app.get('/health', (c) => c.json({ ok: true, service: 'mdnotes', time: Date.now() }));

app.route('/auth', auth);
app.route('/projects', projects);

app.notFound((c) => c.json({ error: 'not_found' }, 404));

export default app;
