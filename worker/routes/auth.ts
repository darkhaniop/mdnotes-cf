import { Hono, type Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, eq, gt, lt } from 'drizzle-orm';
import { credentialsSchema, type UserDto } from '@shared/schemas/auth';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from '@shared/constants';
import type { AppEnv } from '../index';
import type { User } from '../db/schema';
import { createDb, schema, type Db } from '../db/client';
import { newId, newOpaqueToken, sha256Hex } from '../lib/ids';
import { hashPassword, resolveIterations, verifyPassword } from '../lib/password';
import { signAccessToken, signAssetCookie } from '../lib/jwt';
import { clearAuthCookies, readRefreshCookie, setAssetCookie, setRefreshCookie } from '../lib/cookies';
import { conflict, unauthorized } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/ratelimit';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    isGuest: user.isGuest === 1,
    createdAt: user.createdAt,
  };
}

async function createSession(db: Db, userId: string, userAgent: string | undefined) {
  const token = newOpaqueToken();
  await db.insert(schema.sessions).values({
    id: newId(),
    userId,
    refreshHash: await sha256Hex(token),
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000,
    userAgent: userAgent?.slice(0, 300) ?? null,
  });
  // Opportunistic sweep so expired rows do not accumulate.
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, Date.now()));
  return token;
}

const auth = new Hono<AppEnv>();

async function issue(c: Context<AppEnv>, user: User, opts: { newSession: boolean }) {
  const db = createDb(c.env.DB);
  if (opts.newSession) {
    const refresh = await createSession(db, user.id, c.req.header('user-agent'));
    setRefreshCookie(c, refresh);
  }
  const accessToken = await signAccessToken(c.env.JWT_SECRET, {
    sub: user.id,
    isGuest: user.isGuest === 1,
  });
  setAssetCookie(c, await signAssetCookie(c.env.ASSET_COOKIE_SECRET, user.id));
  return c.json({
    user: toUserDto(user),
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

auth.post('/guest', rateLimit({ bucket: 'guest', limit: 30, windowSeconds: 300 }), async (c) => {
  const db = createDb(c.env.DB);
  const [user] = await db.insert(schema.users).values({ id: newId() }).returning();
  return issue(c, user!, { newSession: true });
});

auth.post(
  '/signup',
  rateLimit({ bucket: 'signup', limit: 10, windowSeconds: 900 }),
  zValidator('json', credentialsSchema),
  async (c) => {
    const { email, password } = c.req.valid('json');
    const db = createDb(c.env.DB);
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing) throw conflict('email_taken', 'That email is already registered');

    const passwordHash = await hashPassword(password, resolveIterations(c.env.PBKDF2_ITERATIONS));
    const [user] = await db
      .insert(schema.users)
      .values({ id: newId(), email, passwordHash, isGuest: 0 })
      .returning();
    return issue(c, user!, { newSession: true });
  },
);

auth.post(
  '/login',
  rateLimit({ bucket: 'login', limit: 10, windowSeconds: 900 }),
  zValidator('json', credentialsSchema),
  async (c) => {
    const { email, password } = c.req.valid('json');
    const db = createDb(c.env.DB);
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized('invalid_credentials', 'Email or password is incorrect');
    }
    await db
      .update(schema.users)
      .set({ lastSeenAt: Date.now() })
      .where(eq(schema.users.id, user.id));
    return issue(c, user, { newSession: true });
  },
);

/**
 * Upgrades the *current* guest row in place: projects, documents and assets all
 * keep pointing at the same user id, so nothing has to be migrated.
 */
auth.post(
  '/upgrade',
  requireAuth,
  rateLimit({ bucket: 'upgrade', limit: 10, windowSeconds: 900 }),
  zValidator('json', credentialsSchema),
  async (c) => {
    const { email, password } = c.req.valid('json');
    const db = createDb(c.env.DB);
    const [current] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, c.get('userId')))
      .limit(1);
    if (!current) throw unauthorized('invalid_token', 'Your session expired');
    if (current.isGuest !== 1) throw conflict('already_registered', 'This account already has a login');

    const [taken] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (taken) throw conflict('email_taken', 'That email is already registered');

    const passwordHash = await hashPassword(password, resolveIterations(c.env.PBKDF2_ITERATIONS));
    const [user] = await db
      .update(schema.users)
      .set({ email, passwordHash, isGuest: 0, updatedAt: Date.now() })
      .where(eq(schema.users.id, current.id))
      .returning();
    return issue(c, user!, { newSession: false });
  },
);

/** Rotating refresh: the presented token is always deleted, used or not. */
auth.post('/refresh', async (c) => {
  const presented = readRefreshCookie(c);
  if (!presented) throw unauthorized('no_refresh_token', 'Not signed in');
  const db = createDb(c.env.DB);
  const refreshHash = await sha256Hex(presented);

  const [session] = await db
    .delete(schema.sessions)
    .where(
      and(eq(schema.sessions.refreshHash, refreshHash), gt(schema.sessions.expiresAt, Date.now())),
    )
    .returning();
  if (!session) {
    clearAuthCookies(c);
    throw unauthorized('invalid_refresh_token', 'Please sign in again');
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  if (!user) {
    clearAuthCookies(c);
    throw unauthorized('invalid_refresh_token', 'Please sign in again');
  }
  await db.update(schema.users).set({ lastSeenAt: Date.now() }).where(eq(schema.users.id, user.id));
  return issue(c, user, { newSession: true });
});

auth.post('/logout', async (c) => {
  const presented = readRefreshCookie(c);
  if (presented) {
    const db = createDb(c.env.DB);
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.refreshHash, await sha256Hex(presented)));
  }
  clearAuthCookies(c);
  return c.json({ ok: true });
});

auth.get('/me', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, c.get('userId')))
    .limit(1);
  if (!user) throw unauthorized('invalid_token', 'Your session expired');
  return c.json({ user: toUserDto(user) });
});

export default auth;
