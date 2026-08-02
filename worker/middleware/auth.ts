import type { MiddlewareHandler } from 'hono';
import { and, eq } from 'drizzle-orm';
import type { AppEnv } from '../index';
import { createDb, schema } from '../db/client';
import type { Project } from '../db/schema';
import { verifyAccessToken, verifyAssetCookie } from '../lib/jwt';
import { readAssetCookie } from '../lib/cookies';
import { notFound, unauthorized } from './error';

export type AuthVariables = {
  userId: string;
  isGuest: boolean;
  project: Project;
};

function bearer(c: Parameters<MiddlewareHandler>[0]): string | null {
  const header = c.req.header('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/** Requires the Bearer access JWT. Every mutating route uses this. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = bearer(c);
  if (!token) throw unauthorized('missing_token', 'Sign in to continue');
  const claims = await verifyAccessToken(c.env.JWT_SECRET, token);
  if (!claims) throw unauthorized('invalid_token', 'Your session expired');
  c.set('userId', claims.sub);
  c.set('isGuest', claims.isGuest);
  await next();
};

/**
 * Read-only auth for asset GETs: accepts the Bearer token, or falls back to the
 * `mdn_at` cookie so `<img>`/`<object>` tags can load. Never used on a mutating
 * route, which is what keeps the cookie CSRF-safe.
 */
export const requireReadAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = bearer(c);
  if (token) {
    const claims = await verifyAccessToken(c.env.JWT_SECRET, token);
    if (claims) {
      c.set('userId', claims.sub);
      c.set('isGuest', claims.isGuest);
      return next();
    }
  }
  const cookie = readAssetCookie(c);
  if (cookie) {
    const userId = await verifyAssetCookie(c.env.ASSET_COOKIE_SECRET, cookie);
    if (userId) {
      c.set('userId', userId);
      return next();
    }
  }
  throw unauthorized('missing_token', 'Sign in to continue');
};

/**
 * Loads the project by id *and* owner. Foreign or missing rows both yield 404 —
 * a 403 would confirm the id exists.
 */
export const requireOwnership: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  if (!projectId) throw notFound('project_not_found');
  const db = createDb(c.env.DB);
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!project) throw notFound('project_not_found', 'That project does not exist');
  c.set('project', project);
  await next();
};
