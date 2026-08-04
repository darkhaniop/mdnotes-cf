import { Hono, type Context } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { MAX_UPLOAD_BYTES } from '@shared/constants';
import type { AssetDto } from '@shared/schemas/asset';
import type { AppEnv } from '../index';
import type { Asset } from '../db/schema';
import { createDb, schema } from '../db/client';
import { newId, sha256Hex } from '../lib/ids';
import { assetKey } from '../lib/r2';
import {
  dedupeFilename,
  isAllowedMime,
  normalizeFilename,
  referenceToFilename,
  sniffMatches,
} from '../lib/assetName';
import { requireAuth, requireOwnership, requireReadAuth } from '../middleware/auth';
import { badRequest, notFound, tooLarge } from '../middleware/error';

export function toAssetDto(asset: Asset): AssetDto {
  return {
    id: asset.id,
    projectId: asset.projectId,
    filename: asset.filename,
    contentType: asset.contentType as AssetDto['contentType'],
    sizeBytes: asset.sizeBytes,
    sha256: asset.sha256,
    createdAt: asset.createdAt,
    url: `/api/projects/${asset.projectId}/assets/${asset.id}`,
  };
}

/**
 * 1x1 transparent GIF. Served for an unknown by-name reference so a typo in a
 * markdown image renders as an empty image rather than a broken app error.
 */
const PLACEHOLDER_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (ch) => ch.charCodeAt(0),
);

const assets = new Hono<AppEnv>();

assets.get('/', requireAuth, requireOwnership, async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(schema.assets)
    .where(eq(schema.assets.projectId, c.get('project').id))
    .orderBy(desc(schema.assets.createdAt));
  return c.json({ assets: rows.map(toAssetDto) });
});

assets.post('/', requireAuth, requireOwnership, async (c) => {
  const project = c.get('project');
  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES * 1.05) {
    throw tooLarge('file_too_large', 'That file is larger than the 25 MB limit');
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw badRequest('invalid_form', 'Expected a multipart/form-data upload');
  }
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('missing_file', 'No file was uploaded');
  if (file.size === 0) throw badRequest('empty_file', 'That file is empty');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw tooLarge('file_too_large', 'That file is larger than the 25 MB limit');
  }

  const declared = (file.type || '').split(';')[0]!.trim().toLowerCase();
  if (!isAllowedMime(declared)) {
    throw badRequest(
      'unsupported_type',
      'Only PNG, JPEG, WebP, GIF and PDF uploads are supported',
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffMatches(declared, bytes.subarray(0, 12))) {
    throw badRequest('content_mismatch', 'That file’s contents do not match its type');
  }

  const db = createDb(c.env.DB);
  const existing = await db
    .select({ filename: schema.assets.filename })
    .from(schema.assets)
    .where(eq(schema.assets.projectId, project.id));
  const filename = dedupeFilename(
    normalizeFilename(file.name || 'file', declared),
    new Set(existing.map((r) => r.filename)),
  );

  const id = newId();
  const key = assetKey(project.id, id, filename);
  await c.env.BUCKET.put(key, bytes as unknown as ArrayBuffer, {
    httpMetadata: { contentType: declared },
  });

  const [asset] = await db
    .insert(schema.assets)
    .values({
      id,
      projectId: project.id,
      filename,
      r2Key: key,
      contentType: declared,
      sizeBytes: bytes.byteLength,
      sha256: await sha256Hex(bytes.buffer as ArrayBuffer),
    })
    .returning();

  await db
    .update(schema.projects)
    .set({ updatedAt: Date.now() })
    .where(eq(schema.projects.id, project.id));

  return c.json({ asset: toAssetDto(asset!) }, 201);
});

function serve(object: R2ObjectBody, asset: Asset) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('content-type', asset.contentType);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  if (asset.contentType === 'application/pdf') {
    headers.set('content-disposition', `inline; filename="${asset.filename}"`);
  }
  return new Response(object.body, { headers });
}

/**
 * R2's `onlyIf` rejects quoted ETags, but that is exactly how they arrive on the
 * wire, so the header value has to be unwrapped first.
 */
function parseIfNoneMatch(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const first = header.split(',')[0]!.trim();
  if (first === '*' || first === '') return undefined;
  return first.replace(/^W\//, '').replace(/^"|"$/g, '');
}

async function respondWithAsset(c: Context<AppEnv>, asset: Asset): Promise<Response> {
  const ifNoneMatch = parseIfNoneMatch(c.req.header('if-none-match'));
  const object = await c.env.BUCKET.get(asset.r2Key, {
    onlyIf: ifNoneMatch ? { etagDoesNotMatch: ifNoneMatch } : undefined,
  });
  if (!object) throw notFound('asset_missing', 'That file is no longer stored');
  if (!('body' in object) || object.body === null) {
    return new Response(null, {
      status: 304,
      headers: {
        etag: object.httpEtag,
        'cache-control': 'private, max-age=31536000, immutable',
      },
    });
  }
  return serve(object as R2ObjectBody, asset);
}

/**
 * Resolves a bare markdown reference (`diagram.png`) to this project's asset.
 * Read auth only, so the mdn_at cookie is enough for an <img> tag.
 */
assets.get('/by-name/:name', requireReadAuth, requireOwnership, async (c) => {
  const project = c.get('project');
  const filename = referenceToFilename(c.req.param('name'));
  const db = createDb(c.env.DB);
  const [asset] = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.projectId, project.id), eq(schema.assets.filename, filename)))
    .limit(1);
  if (!asset) {
    return new Response(PLACEHOLDER_GIF as unknown as ArrayBuffer, {
      status: 404,
      headers: { 'content-type': 'image/gif', 'cache-control': 'no-store' },
    });
  }
  return respondWithAsset(c, asset);
});

assets.get('/:assetId', requireReadAuth, requireOwnership, async (c) => {
  const db = createDb(c.env.DB);
  const [asset] = await db
    .select()
    .from(schema.assets)
    .where(
      and(
        eq(schema.assets.projectId, c.get('project').id),
        eq(schema.assets.id, c.req.param('assetId')),
      ),
    )
    .limit(1);
  if (!asset) throw notFound('asset_not_found', 'That file does not exist');
  return respondWithAsset(c, asset);
});

assets.delete('/:assetId', requireAuth, requireOwnership, async (c) => {
  const db = createDb(c.env.DB);
  const [asset] = await db
    .delete(schema.assets)
    .where(
      and(
        eq(schema.assets.projectId, c.get('project').id),
        eq(schema.assets.id, c.req.param('assetId')),
      ),
    )
    .returning();
  if (!asset) throw notFound('asset_not_found', 'That file does not exist');
  await c.env.BUCKET.delete(asset.r2Key);
  return c.body(null, 204);
});

/**
 * Top-level `DELETE /api/assets/:assetId`, as listed in the plan. Ownership is
 * proven by the join on projects.user_id rather than by requireOwnership,
 * because there is no project id in the path.
 */
export const assetsById = new Hono<AppEnv>();

assetsById.delete('/:assetId', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const [row] = await db
    .select({ asset: schema.assets })
    .from(schema.assets)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.assets.projectId))
    .where(
      and(
        eq(schema.assets.id, c.req.param('assetId')),
        eq(schema.projects.userId, c.get('userId')),
      ),
    )
    .limit(1);
  if (!row) throw notFound('asset_not_found', 'That file does not exist');
  await db.delete(schema.assets).where(eq(schema.assets.id, row.asset.id));
  await c.env.BUCKET.delete(row.asset.r2Key);
  return c.body(null, 204);
});

export default assets;
