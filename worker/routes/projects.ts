import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { createProjectSchema, updateProjectSchema, type ProjectDto } from '@shared/schemas/project';
import type { AppEnv } from '../index';
import type { Project } from '../db/schema';
import { createDb, schema, type Db } from '../db/client';
import { newId, slugify } from '../lib/ids';
import { requireAuth, requireOwnership } from '../middleware/auth';
import { deleteProjectObjects } from '../lib/r2';
import { notFound } from '../middleware/error';
import assets from './assets';
import documents from './documents';

export function toProjectDto(project: Project, counts?: { documents: number; assets: number }): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    ...(counts ? { documentCount: counts.documents, assetCount: counts.assets } : {}),
  };
}

/** Appends `-2`, `-3`, … until the (user, slug) unique index is satisfied. */
async function uniqueSlug(db: Db, userId: string, name: string, excludeId?: string): Promise<string> {
  const base = slugify(name, 'project');
  const rows = await db
    .select({ slug: schema.projects.slug, id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId));
  const taken = new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

const projects = new Hono<AppEnv>();

projects.get('/', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select({
      project: schema.projects,
      documentCount: sql<number>`(select count(*) from ${schema.documents} where ${schema.documents.projectId} = ${schema.projects.id})`,
      assetCount: sql<number>`(select count(*) from ${schema.assets} where ${schema.assets.projectId} = ${schema.projects.id})`,
    })
    .from(schema.projects)
    .where(eq(schema.projects.userId, c.get('userId')))
    .orderBy(desc(schema.projects.updatedAt));

  return c.json({
    projects: rows.map((r) =>
      toProjectDto(r.project, { documents: Number(r.documentCount), assets: Number(r.assetCount) }),
    ),
  });
});

projects.post('/', requireAuth, zValidator('json', createProjectSchema), async (c) => {
  const { name, description } = c.req.valid('json');
  const db = createDb(c.env.DB);
  const userId = c.get('userId');
  const [project] = await db
    .insert(schema.projects)
    .values({
      id: newId(),
      userId,
      name,
      slug: await uniqueSlug(db, userId, name),
      description: description ?? null,
    })
    .returning();
  return c.json({ project: toProjectDto(project!, { documents: 0, assets: 0 }) }, 201);
});

projects.get('/:projectId', requireAuth, requireOwnership, (c) => {
  return c.json({ project: toProjectDto(c.get('project')) });
});

projects.patch(
  '/:projectId',
  requireAuth,
  requireOwnership,
  zValidator('json', updateProjectSchema),
  async (c) => {
    const patch = c.req.valid('json');
    const current = c.get('project');
    const db = createDb(c.env.DB);
    const [updated] = await db
      .update(schema.projects)
      .set({
        ...(patch.name !== undefined
          ? { name: patch.name, slug: await uniqueSlug(db, current.userId, patch.name, current.id) }
          : {}),
        ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
        updatedAt: Date.now(),
      })
      .where(eq(schema.projects.id, current.id))
      .returning();
    if (!updated) throw notFound('project_not_found');
    return c.json({ project: toProjectDto(updated) });
  },
);

projects.delete('/:projectId', requireAuth, requireOwnership, async (c) => {
  const project = c.get('project');
  const db = createDb(c.env.DB);
  // D1's FK cascade removes the asset rows but never touches R2, so the bucket
  // has to be purged explicitly and *before* the rows disappear.
  await deleteProjectObjects(c.env.BUCKET, project.id);
  await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, project.id), eq(schema.projects.userId, project.userId)));
  return c.body(null, 204);
});

projects.route('/:projectId/assets', assets);
projects.route('/:projectId/documents', documents);

export default projects;
