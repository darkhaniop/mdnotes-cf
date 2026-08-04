import { describe, expect, it } from 'vitest';
import { guestClient, json, type Client } from './helpers';
import { excerptOf } from '../routes/documents';
import { MAX_DOC_BYTES } from '@shared/constants';

async function makeProject(client: Client, name = 'Docs') {
  const res = await client.fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return (await json(res)).project;
}

async function makeDocument(client: Client, projectId: string, title: string, content = '') {
  const res = await client.fetch(`/api/projects/${projectId}/documents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  expect(res.status).toBe(201);
  return (await json(res)).document;
}

describe('excerptOf', () => {
  it('flattens markdown into prose', () => {
    expect(excerptOf('# Title\n\nSome **bold** text with a [link](http://x)')).toBe(
      'Title Some bold text with a link',
    );
    expect(excerptOf('```js\nconst x = 1;\n```\nafter')).toBe('after');
    expect(excerptOf('![alt](img.png) caption')).toBe('caption');
  });

  it('truncates long content', () => {
    expect(excerptOf('a'.repeat(500)).endsWith('…')).toBe(true);
  });
});

describe('documents', () => {
  it('creates, lists and reads a document', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const doc = await makeDocument(client, project.id, 'First Note', '# Hello\n\nWorld');
    expect(doc.slug).toBe('first-note');

    const list = await json(await client.fetch(`/api/projects/${project.id}/documents`));
    expect(list.documents).toHaveLength(1);
    expect(list.documents[0].excerpt).toBe('Hello World');
    expect(list.documents[0].content).toBeUndefined();

    const fetched = await json(await client.fetch(`/api/documents/${doc.id}`));
    expect(fetched.document.content).toBe('# Hello\n\nWorld');
  });

  it('de-duplicates slugs within a project', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const a = await makeDocument(client, project.id, 'Notes');
    const b = await makeDocument(client, project.id, 'Notes');
    expect([a.slug, b.slug]).toEqual(['notes', 'notes-2']);
  });

  it('updates content and title', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const doc = await makeDocument(client, project.id, 'Draft');
    const res = await client.fetch(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Final', content: 'body text' }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.document.title).toBe('Final');
    expect(body.document.slug).toBe('final');
    expect(body.document.content).toBe('body text');
    expect(body.document.updatedAt).toBeGreaterThanOrEqual(doc.updatedAt);
  });

  it('409s when the expected updatedAt is stale', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const doc = await makeDocument(client, project.id, 'Concurrent');

    const first = await client.fetch(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'from tab A', expectedUpdatedAt: doc.updatedAt }),
    });
    expect(first.status).toBe(200);

    const second = await client.fetch(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'from tab B', expectedUpdatedAt: doc.updatedAt }),
    });
    expect(second.status).toBe(409);
    expect((await json(second)).error).toBe('stale_document');
  });

  it('accepts a patch with no expectedUpdatedAt', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const doc = await makeDocument(client, project.id, 'Loose');
    const res = await client.fetch(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'no guard' }),
    });
    expect(res.status).toBe(200);
  });

  it('rejects content over the 1 MB cap', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const doc = await makeDocument(client, project.id, 'Huge');
    const res = await client.fetch(`/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'x'.repeat(MAX_DOC_BYTES + 1) }),
    });
    expect(res.status).toBe(400);
  });

  it('deletes a document', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const doc = await makeDocument(client, project.id, 'Doomed');
    expect((await client.fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await client.fetch(`/api/documents/${doc.id}`)).status).toBe(404);
  });

  it('hides another users document behind a 404', async () => {
    const owner = await guestClient();
    const project = await makeProject(owner);
    const doc = await makeDocument(owner, project.id, 'Private', 'secret');
    const stranger = await guestClient();

    expect((await stranger.fetch(`/api/documents/${doc.id}`)).status).toBe(404);
    expect(
      (
        await stranger.fetch(`/api/documents/${doc.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: 'hijacked' }),
        })
      ).status,
    ).toBe(404);
    expect((await stranger.fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })).status).toBe(
      404,
    );
    expect((await stranger.fetch(`/api/projects/${project.id}/documents`)).status).toBe(404);
  });

  it('cascades document deletion when the project is deleted', async () => {
    const client = await guestClient();
    const project = await makeProject(client);
    const doc = await makeDocument(client, project.id, 'Child');
    await client.fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    expect((await client.fetch(`/api/documents/${doc.id}`)).status).toBe(404);
  });
});
