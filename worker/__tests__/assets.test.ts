import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { apiFetch, guestClient, json, type Client } from './helpers';
import {
  dedupeFilename,
  isAllowedMime,
  normalizeFilename,
  referenceToFilename,
  sniffMatches,
} from '../lib/assetName';
import { projectPrefix } from '../lib/r2';

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngBytes(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_HEAD, 0);
  return bytes;
}

function pdfBytes(): Uint8Array {
  return new TextEncoder().encode('%PDF-1.7\n% a tiny pdf\n');
}

function upload(client: Client, projectId: string, file: File) {
  const form = new FormData();
  form.set('file', file);
  return client.fetch(`/api/projects/${projectId}/assets`, { method: 'POST', body: form });
}

async function makeProject(client: Client, name = 'Assets') {
  const res = await client.fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return (await json(res)).project;
}

describe('assetName helpers', () => {
  it('recognises allow-listed mimes only', () => {
    expect(isAllowedMime('image/png')).toBe(true);
    expect(isAllowedMime('image/svg+xml')).toBe(false);
    expect(isAllowedMime('text/html')).toBe(false);
  });

  it('sniffs magic bytes', () => {
    expect(sniffMatches('image/png', pngBytes(12))).toBe(true);
    expect(sniffMatches('image/png', new Uint8Array(12))).toBe(false);
    expect(sniffMatches('application/pdf', pdfBytes().subarray(0, 12))).toBe(true);
    expect(sniffMatches('image/png', new Uint8Array(4))).toBe(false);
  });

  it('normalises filenames to a slug plus the MIME extension', () => {
    expect(normalizeFilename('My Photo.PNG', 'image/png')).toBe('my-photo.png');
    expect(normalizeFilename('report.pdf', 'application/pdf')).toBe('report.pdf');
    expect(normalizeFilename('shot.jpeg', 'image/jpeg')).toBe('shot.jpg');
    expect(normalizeFilename('../../etc/passwd.png', 'image/png')).toBe('passwd.png');
    expect(normalizeFilename('物理.png', 'image/png')).toBe('file.png');
  });

  it('de-duplicates within a project', () => {
    const taken = new Set(['report.pdf', 'report-1.pdf']);
    expect(dedupeFilename('report.pdf', taken)).toBe('report-2.pdf');
    expect(dedupeFilename('other.pdf', taken)).toBe('other.pdf');
  });

  it('resolves markdown references to the flat name space', () => {
    expect(referenceToFilename('diagram.png')).toBe('diagram.png');
    expect(referenceToFilename('./img/diagram.png')).toBe('diagram.png');
    expect(referenceToFilename('../assets/My%20Photo.PNG')).toBe('my-photo.png');
    expect(referenceToFilename('spec.pdf?v=2')).toBe('spec.pdf');
    expect(referenceToFilename('shot.jpeg')).toBe('shot.jpg');
  });
});

describe('asset upload', () => {
  it('uploads a PNG and serves it back', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const res = await upload(
      client,
      project.id,
      new File([pngBytes()], 'Screen Shot.png', { type: 'image/png' }),
    );
    expect(res.status).toBe(201);
    const { asset } = await json(res);
    expect(asset.filename).toBe('screen-shot.png');
    expect(asset.contentType).toBe('image/png');
    expect(asset.url).toBe(`/api/projects/${project.id}/assets/${asset.id}`);

    const fetched = await client.fetch(asset.url);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get('content-type')).toBe('image/png');
    expect(fetched.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
    expect((await fetched.arrayBuffer()).byteLength).toBe(64);
  });

  it('honours If-None-Match with a 304', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const { asset } = await json(
      await upload(client, project.id, new File([pngBytes()], 'a.png', { type: 'image/png' })),
    );
    const first = await client.fetch(asset.url);
    const etag = first.headers.get('etag')!;
    expect(etag).toBeTruthy();
    const second = await client.fetch(asset.url, { headers: { 'if-none-match': etag } });
    expect(second.status).toBe(304);
  });

  it('serves PDFs inline', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const { asset } = await json(
      await upload(
        client,
        project.id,
        new File([pdfBytes()], 'Spec Sheet.pdf', { type: 'application/pdf' }),
      ),
    );
    const res = await client.fetch(asset.url);
    expect(res.headers.get('content-disposition')).toBe('inline; filename="spec-sheet.pdf"');
  });

  it('de-duplicates repeated filenames in a project', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const names: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { asset } = await json(
        await upload(client, project.id, new File([pngBytes()], 'shot.png', { type: 'image/png' })),
      );
      names.push(asset.filename);
    }
    expect(names).toEqual(['shot.png', 'shot-1.png', 'shot-2.png']);
  });

  it('rejects a disallowed MIME type', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const res = await upload(
      client,
      project.id,
      new File(['<svg onload="alert(1)"/>'], 'x.svg', { type: 'image/svg+xml' }),
    );
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('unsupported_type');
  });

  it('rejects spoofed magic bytes', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const res = await upload(
      client,
      project.id,
      new File([new TextEncoder().encode('<html>not a png at all</html>')], 'evil.png', {
        type: 'image/png',
      }),
    );
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('content_mismatch');
  });

  it('rejects an oversize declaration', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const form = new FormData();
    form.set('file', new File([pngBytes()], 'a.png', { type: 'image/png' }));
    const res = await client.fetch(`/api/projects/${project.id}/assets`, {
      method: 'POST',
      body: form,
      headers: { 'content-length': String(40 * 1024 * 1024) },
    });
    expect(res.status).toBe(413);
  });

  it('rejects an empty upload', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const res = await upload(
      client,
      project.id,
      new File([], 'empty.png', { type: 'image/png' }),
    );
    expect(res.status).toBe(400);
  });

  it('refuses uploads into someone else`s project', async () => {
    const owner = await guestClient();
    const project = await makeProject(owner);
    const stranger = await guestClient();
    const res = await upload(
      stranger,
      project.id,
      new File([pngBytes()], 'a.png', { type: 'image/png' }),
    );
    expect(res.status).toBe(404);
  });
});

describe('by-name resolution', () => {
  it('resolves a bare reference and normalises the path', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    await upload(
      client,
      project.id,
      new File([pngBytes()], 'diagram.png', { type: 'image/png' }),
    );

    for (const reference of ['diagram.png', 'diagram.PNG', encodeURIComponent('My Diagram.png')]) {
      const res = await client.fetch(`/api/projects/${project.id}/assets/by-name/${reference}`);
      if (reference.includes('My')) {
        expect(res.status).toBe(404);
      } else {
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/png');
      }
    }
  });

  it('returns a placeholder image (not a JSON error) for an unknown name', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const res = await client.fetch(`/api/projects/${project.id}/assets/by-name/missing.png`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('image/gif');
  });

  it('accepts the mdn_at cookie without a bearer token, but not for uploads', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    await upload(client, project.id, new File([pngBytes()], 'shot.png', { type: 'image/png' }));

    const withCookie = await apiFetch(
      `/api/projects/${project.id}/assets/by-name/shot.png`,
      {},
      client.cookies,
    );
    expect(withCookie.status).toBe(200);

    const uploadWithCookieOnly = await apiFetch(
      `/api/projects/${project.id}/assets`,
      { method: 'POST', body: new FormData() },
      client.cookies,
    );
    expect(uploadWithCookieOnly.status).toBe(401);
  });
});

describe('asset deletion', () => {
  it('deletes the row and the R2 object', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const { asset } = await json(
      await upload(client, project.id, new File([pngBytes()], 'gone.png', { type: 'image/png' })),
    );
    expect(await env.BUCKET.head(`p/${project.id}/${asset.id}/gone.png`)).not.toBeNull();

    const res = await client.fetch(`/api/projects/${project.id}/assets/${asset.id}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);
    expect(await env.BUCKET.head(`p/${project.id}/${asset.id}/gone.png`)).toBeNull();
    expect((await client.fetch(asset.url)).status).toBe(404);
  });

  it('supports the top-level DELETE /api/assets/:id form', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const { asset } = await json(
      await upload(client, project.id, new File([pngBytes()], 'x.png', { type: 'image/png' })),
    );
    expect((await client.fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })).status).toBe(204);

    const stranger = await guestClient();
    expect((await stranger.fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })).status).toBe(404);
  });

  it('purges every R2 object when the project is deleted', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    await upload(client, project.id, new File([pngBytes()], 'one.png', { type: 'image/png' }));
    await upload(client, project.id, new File([pngBytes()], 'two.png', { type: 'image/png' }));
    expect((await env.BUCKET.list({ prefix: projectPrefix(project.id) })).objects).toHaveLength(2);

    expect((await client.fetch(`/api/projects/${project.id}`, { method: 'DELETE' })).status).toBe(
      204,
    );
    expect((await env.BUCKET.list({ prefix: projectPrefix(project.id) })).objects).toHaveLength(0);
  });
});
