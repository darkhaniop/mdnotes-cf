import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createDb, schema } from '../db/client';

describe('db', () => {
  it('has the migrated tables and round-trips a user', async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    await db.insert(schema.users).values({ id });
    const rows = await db.select().from(schema.users);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, isGuest: 1, email: null });
    expect(rows[0].createdAt).toBeGreaterThan(0);
  });

  it('cascades project deletion to documents', async () => {
    const db = createDb(env.DB);
    const userId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId });
    await db.insert(schema.projects).values({ id: projectId, userId, name: 'p', slug: 'p' });
    await db
      .insert(schema.documents)
      .values({ id: crypto.randomUUID(), projectId, title: 'd', slug: 'd' });
    await db.delete(schema.projects);
    expect(await db.select().from(schema.documents)).toHaveLength(0);
  });
});
