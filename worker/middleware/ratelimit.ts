import type { MiddlewareHandler } from 'hono';
import { sql } from 'drizzle-orm';
import type { AppEnv } from '../index';
import { createDb, schema } from '../db/client';
import { tooManyRequests } from './error';

export type RateLimitOptions = {
  /** Namespace, e.g. `login`. */
  bucket: string;
  limit: number;
  windowSeconds: number;
};

function clientKey(c: Parameters<MiddlewareHandler>[0]): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * Fixed-window counter in D1. Good enough for brute-force slowdown on
 * login/signup; not a precise distributed limiter.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const db = createDb(c.env.DB);
    const key = `${options.bucket}:${clientKey(c)}`;
    const windowStart = Math.floor(Date.now() / 1000 / options.windowSeconds) * options.windowSeconds;

    const [row] = await db
      .insert(schema.rateLimits)
      .values({ key, count: 1, windowStart })
      .onConflictDoUpdate({
        target: schema.rateLimits.key,
        set: {
          count: sql`case when ${schema.rateLimits.windowStart} = ${windowStart} then ${schema.rateLimits.count} + 1 else 1 end`,
          windowStart: sql`${windowStart}`,
        },
      })
      .returning();

    if (row && row.count > options.limit) {
      const retryAfter = windowStart + options.windowSeconds - Math.floor(Date.now() / 1000);
      c.header('Retry-After', String(Math.max(1, retryAfter)));
      throw tooManyRequests('rate_limited', 'Too many attempts. Try again shortly.');
    }

    await next();
  };
}
