import { Hono, type Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import {
  createDocumentSchema,
  updateDocumentSchema,
  type DocumentDto,
  type DocumentSummary,
} from '@shared/schemas/document';
import type { AppEnv } from '../index';
import type { Document } from '../db/schema';
import { createDb, schema, type Db } from '../db/client';
import { newId, slugify } from '../lib/ids';
import { requireAuth, requireOwnership } from '../middleware/auth';
import { conflict, notFound } from '../middleware/error';

export function toDocumentDto(doc: Document): DocumentDto {
  return {
    id: doc.id,
    projectId: doc.projectId,
    title: doc.title,
    slug: doc.slug,
    content: doc.content,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Strips the most common markdown noise so list rows read as prose. */
export function excerptOf(content: string, length = 160): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > length ? `${plain.slice(0, length).trimEnd()}…` : plain;
}

function toSummary(doc: Omit<Document, 'content'> & { content: string }): DocumentSummary {
  const { content, ...rest } = toDocumentDto(doc);
  return { ...rest, excerpt: excerptOf(content) };
}

async function uniqueSlug(db: Db, projectId: string, title: string, excludeId?: string) {
  const base = slugify(title, 'document');
  const rows = await db
    .select({ id: schema.documents.id, slug: schema.documents.slug })
    .from(schema.documents)
    .where(eq(schema.documents.projectId, projectId));
  const taken = new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Mounted under /api/projects/:projectId/documents. */
const documents = new Hono<AppEnv>();

documents.get('/', requireAuth, requireOwnership, async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.projectId, c.get('project').id))
    .orderBy(desc(schema.documents.updatedAt));
  return c.json({ documents: rows.map(toSummary) });
});

documents.post(
  '/',
  requireAuth,
  requireOwnership,
  zValidator('json', createDocumentSchema),
  async (c) => {
    const { title, content } = c.req.valid('json');
    const project = c.get('project');
    const db = createDb(c.env.DB);
    const [doc] = await db
      .insert(schema.documents)
      .values({
        id: newId(),
        projectId: project.id,
        title,
        slug: await uniqueSlug(db, project.id, title),
        content: content ?? '',
      })
      .returning();
    await db
      .update(schema.projects)
      .set({ updatedAt: Date.now() })
      .where(eq(schema.projects.id, project.id));
    return c.json({ document: toDocumentDto(doc!) }, 201);
  },
);

export default documents;

/** Mounted at /api/documents — ownership comes from the join on projects. */
export const documentsById = new Hono<AppEnv>();

async function loadOwned(c: Context<AppEnv>, docId: string) {
  const db = createDb(c.env.DB);
  const [row] = await db
    .select({ document: schema.documents })
    .from(schema.documents)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.documents.projectId))
    .where(and(eq(schema.documents.id, docId), eq(schema.projects.userId, c.get('userId'))))
    .limit(1);
  if (!row) throw notFound('document_not_found', 'That document does not exist');
  return { db, document: row.document };
}

documentsById.get('/:docId', requireAuth, async (c) => {
  const { document } = await loadOwned(c, c.req.param('docId'));
  return c.json({ document: toDocumentDto(document) });
});

documentsById.patch(
  '/:docId',
  requireAuth,
  zValidator('json', updateDocumentSchema),
  async (c) => {
    const patch = c.req.valid('json');
    const { db, document } = await loadOwned(c, c.req.param('docId'));

    // Optimistic concurrency: the client echoes back the updatedAt it last saw.
    if (patch.expectedUpdatedAt !== undefined && patch.expectedUpdatedAt !== document.updatedAt) {
      throw conflict('stale_document', 'This document changed somewhere else. Reload to continue.');
    }

    const [updated] = await db
      .update(schema.documents)
      .set({
        ...(patch.title !== undefined
          ? {
              title: patch.title,
              slug: await uniqueSlug(db, document.projectId, patch.title, document.id),
            }
          : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        updatedAt: Date.now(),
      })
      .where(eq(schema.documents.id, document.id))
      .returning();
    await db
      .update(schema.projects)
      .set({ updatedAt: Date.now() })
      .where(eq(schema.projects.id, document.projectId));
    return c.json({ document: toDocumentDto(updated!) });
  },
);

documentsById.delete('/:docId', requireAuth, async (c) => {
  const { db, document } = await loadOwned(c, c.req.param('docId'));
  await db.delete(schema.documents).where(eq(schema.documents.id, document.id));
  return c.body(null, 204);
});
