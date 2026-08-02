import { Hono } from 'hono';

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  ASSET_COOKIE_SECRET: string;
  PBKDF2_ITERATIONS?: string;
};

export type AppEnv = { Bindings: Bindings };

const app = new Hono<AppEnv>().basePath('/api');

app.get('/health', (c) => c.json({ ok: true, service: 'mdnotes', time: Date.now() }));

app.notFound((c) => c.json({ error: 'not_found' }, 404));

export default app;
