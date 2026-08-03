import { describe, expect, it } from 'vitest';
import { apiFetch, guestClient, json } from './helpers';

async function createProject(client: Awaited<ReturnType<typeof guestClient>>, name: string) {
  const res = await client.fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  return (await json(res)).project;
}

describe('projects', () => {
  it('requires authentication', async () => {
    expect((await apiFetch('/api/projects')).status).toBe(401);
  });

  it('creates, lists and reads back a project', async () => {
    const client = await guestClient();
    const created = await createProject(client, 'Physics Notes');
    expect(created.slug).toBe('physics-notes');
    expect(created.documentCount).toBe(0);

    const list = await json(await client.fetch('/api/projects'));
    expect(list.projects).toHaveLength(1);
    expect(list.projects[0].id).toBe(created.id);

    const one = await json(await client.fetch(`/api/projects/${created.id}`));
    expect(one.project.name).toBe('Physics Notes');
  });

  it('de-duplicates slugs within one user but not across users', async () => {
    const a = await guestClient();
    const first = await createProject(a, 'Notes');
    const second = await createProject(a, 'Notes');
    expect(first.slug).toBe('notes');
    expect(second.slug).toBe('notes-2');

    const b = await guestClient();
    const other = await createProject(b, 'Notes');
    expect(other.slug).toBe('notes');
  });

  it('falls back to a generated slug when the name has no ASCII', async () => {
    const client = await guestClient();
    const project = await createProject(client, '物理');
    expect(project.slug).toMatch(/^project-[a-z0-9-_]{6}$/);
  });

  it('rejects an empty name', async () => {
    const client = await guestClient();
    const res = await client.fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });
    expect(res.status).toBe(400);
  });

  it('renames a project and re-slugs it', async () => {
    const client = await guestClient();
    const project = await createProject(client, 'Old Name');
    const res = await client.fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Name', description: 'now with a description' }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.project.name).toBe('New Name');
    expect(body.project.slug).toBe('new-name');
    expect(body.project.description).toBe('now with a description');
  });

  it('deletes a project', async () => {
    const client = await guestClient();
    const project = await createProject(client, 'Doomed');
    expect((await client.fetch(`/api/projects/${project.id}`, { method: 'DELETE' })).status).toBe(
      204,
    );
    expect((await client.fetch(`/api/projects/${project.id}`)).status).toBe(404);
  });

  it('hides another users project behind a 404, never a 403', async () => {
    const owner = await guestClient();
    const project = await createProject(owner, 'Private');
    const stranger = await guestClient();

    for (const init of [
      { method: 'GET' as const },
      {
        method: 'PATCH' as const,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'hijacked' }),
      },
      { method: 'DELETE' as const },
    ]) {
      const res = await stranger.fetch(`/api/projects/${project.id}`, init);
      expect(res.status).toBe(404);
    }

    const still = await json(await owner.fetch(`/api/projects/${project.id}`));
    expect(still.project.name).toBe('Private');
  });

  it('404s for a project id that does not exist', async () => {
    const client = await guestClient();
    expect((await client.fetch(`/api/projects/${crypto.randomUUID()}`)).status).toBe(404);
  });
});
