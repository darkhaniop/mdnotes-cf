import { expect, test, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PNG_FIXTURE = fileURLToPath(new URL('./fixtures/shot.png', import.meta.url));

const DOCUMENT_SOURCE = [
  '# Field notes',
  '',
  '![a screenshot](shot.png)',
  '',
  'Mass and energy: $E=mc^2$',
  '',
  '```mermaid',
  'graph TD;',
  '  A[Start] --> B[Finish];',
  '```',
  '',
].join('\n');

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function continueAsGuest(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

async function createProject(page: Page, name: string) {
  await page.getByTestId('new-project').click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByTestId('project-title')).toHaveText(name);
}

async function readDownload(download: Download): Promise<string> {
  const path = await download.path();
  return readFile(path, 'utf8');
}

async function createDocument(page: Page, title: string) {
  await page.getByTestId('new-document').click();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/\/docs\/[^/]+\/edit$/);
}

async function typeIntoEditor(page: Page, text: string) {
  const editor = page.getByTestId('markdown-editor').locator('.cm-content');
  await editor.click();
  // `fill` on a contenteditable replaces the whole document in one operation,
  // which keeps this fast and avoids CodeMirror's auto-continuation of lists.
  await editor.fill(text);
}

test.describe('mdnotes primary flow', () => {
  test('guest writes a document with an image, math and a diagram, then signs up', async ({
    page,
  }) => {
    await continueAsGuest(page);
    await createProject(page, 'Field Notes');

    // Upload a PNG into the project.
    await page.getByTestId('asset-input').setInputFiles(PNG_FIXTURE);
    await expect(page.getByTestId('asset-grid').getByText('shot.png')).toBeVisible();

    // Open the upload in a modal: the image loads through the mdn_at cookie.
    await page.getByRole('button', { name: 'Preview shot.png' }).click();
    const assetModal = page.getByTestId('asset-preview');
    await expect(assetModal).toContainText('shot.png');
    const modalImage = assetModal.getByTestId('asset-preview-image');
    await expect
      .poll(() => modalImage.evaluate((el: HTMLImageElement) => el.naturalWidth), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    await expect(assetModal.getByTestId('asset-download')).toHaveAttribute('download', 'shot.png');
    await expect(assetModal.getByRole('link', { name: 'Open in a new tab' })).toHaveAttribute(
      'target',
      '_blank',
    );
    await page.keyboard.press('Escape');
    await expect(assetModal).toHaveCount(0);

    // Create a document; the app drops straight into edit mode.
    await createDocument(page, 'Observations');

    // Edit mode carries the same breadcrumb trail as view mode.
    await expect(page.getByTestId('breadcrumbs')).toContainText('Projects');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Field Notes');
    await expect(page.getByTestId('document-title')).toHaveCount(0);
    const titleField = page.getByTestId('title-input');
    await expect(titleField).toHaveValue('Observations');
    await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveCount(1);

    await typeIntoEditor(page, DOCUMENT_SOURCE);

    const preview = page.getByTestId('markdown-preview');

    // The image resolves by bare filename through /assets/by-name and loads.
    const image = preview.getByAltText('a screenshot');
    await expect(image).toHaveAttribute('src', /\/assets\/by-name\/shot\.png$/);
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // KaTeX rendered the formula.
    await expect(preview.locator('.katex').first()).toBeVisible();
    await expect(preview.locator('.katex-mathml')).toContainText('E');

    // Mermaid rendered an SVG rather than the error card.
    await expect(preview.getByTestId('mermaid-diagram').locator('svg')).toBeVisible({
      timeout: 20_000,
    });
    await expect(preview.getByTestId('mermaid-error')).toHaveCount(0);

    // The helper panel inserts a working block at the cursor.
    await page.getByTestId('markdown-editor').locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.getByTestId('insert-block').click();
    await page.getByTestId('insert-table').click();
    await expect(preview.getByRole('table')).toBeVisible();
    await expect(preview.getByRole('columnheader', { name: 'Column A' })).toBeVisible();

    // Hide the preview.
    await page.getByTestId('toggle-preview').click();
    await expect(preview).toHaveCount(0);
    await expect(page.getByTestId('markdown-editor')).toBeVisible();

    // The editor exports the live buffer, before it has been saved.
    const editDownload = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-document').click(),
    ]);
    expect(editDownload[0].suggestedFilename()).toBe('observations.md');
    expect(await readDownload(editDownload[0])).toContain('![a screenshot](shot.png)');

    // Save explicitly, then switch to view mode.
    await page.getByTestId('save-document').click();
    await expect(page.getByTestId('save-state')).toHaveText('Saved');
    await page.getByTestId('done-editing').click();
    await expect(page).toHaveURL(/\/docs\/[^/]+$/);

    // The breadcrumb replaced the old <h1>: ancestors are links, the current
    // document is plain text.
    const crumbs = page.getByTestId('breadcrumbs');
    await expect(crumbs.getByRole('link', { name: 'Projects' })).toBeVisible();
    await expect(crumbs.getByRole('link', { name: 'Field Notes' })).toBeVisible();
    const viewTitle = page.getByTestId('document-title');
    await expect(viewTitle).toHaveText('Observations');
    await expect(viewTitle).toHaveAttribute('aria-current', 'page');
    const viewPreview = page.getByTestId('markdown-preview');
    await expect(viewPreview.getByRole('heading', { name: 'Field notes' })).toBeVisible();
    await expect(viewPreview.getByAltText('a screenshot')).toBeVisible();
    await expect(viewPreview.locator('.katex').first()).toBeVisible();

    // Upgrade the guest account; the same row is mutated, so the work survives.
    await page.getByRole('link', { name: 'Save your work' }).click();
    const email = uniqueEmail();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('hunter2hunter2');
    await page.getByRole('button', { name: 'Save my work' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByTestId('user-email')).toHaveText(email);

    // The project and its document are still there.
    await page.getByRole('link', { name: 'Field Notes' }).click();
    await expect(page.getByTestId('project-title')).toHaveText('Field Notes');
    await expect(page.getByTestId('document-list').getByText('Observations')).toBeVisible();
    await expect(page.getByTestId('asset-grid').getByText('shot.png')).toBeVisible();

    await page.getByTestId('document-link').click();
    await expect(page.getByTestId('document-title')).toHaveText('Observations');
    await expect(page.getByTestId('markdown-preview').getByAltText('a screenshot')).toBeVisible();

    // The project crumb walks back up the trail.
    await page.getByTestId('breadcrumbs').getByRole('link', { name: 'Field Notes' }).click();
    await expect(page.getByTestId('project-title')).toHaveText('Field Notes');
  });

  test('the breadcrumb title is the only title, and it edits in place', async ({ page }) => {
    await continueAsGuest(page);
    await createProject(page, 'Renames');
    await createDocument(page, 'First draft');

    const title = page.getByTestId('title-input');
    // One title in the header, and it is the editable control itself.
    await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveCount(1);
    await expect(title).toHaveValue('First draft');

    // Fully operable from the keyboard: focus it, retype, commit with Enter.
    await title.focus();
    await expect(title).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Second draft');
    await expect(page.getByTestId('save-state')).toHaveText('Unsaved changes');
    await page.keyboard.press('Enter');
    await expect(title).not.toBeFocused();
    await expect(page.getByTestId('save-state')).toHaveText('Saved');

    // Escape abandons an in-progress rename rather than committing it.
    await title.focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Throwaway');
    await expect(title).toHaveValue('Throwaway');
    await page.keyboard.press('Escape');
    await expect(title).toHaveValue('Second draft');

    // The committed rename reached the server: view mode and the project list
    // both show it after a reload.
    await page.getByTestId('done-editing').click();
    await expect(page.getByTestId('document-title')).toHaveText('Second draft');
    await page.reload();
    await expect(page.getByTestId('document-title')).toHaveText('Second draft');
    await page.getByTestId('breadcrumbs').getByRole('link', { name: 'Renames' }).click();
    await expect(page.getByTestId('document-list').getByText('Second draft')).toBeVisible();
  });

  test('Done leaves the editor even when the save fails', async ({ page }) => {
    await continueAsGuest(page);
    await createProject(page, 'Offline');
    await createDocument(page, 'Unreachable');

    await typeIntoEditor(page, 'work the user does not want to lose');
    // Every write from here on fails. `save` toasts, and Done must still leave —
    // trapping the user in the editor is what makes the button look broken.
    await page.route('**/api/documents/**', (route) =>
      route.request().method() === 'PATCH' ? route.abort('failed') : route.continue(),
    );

    await page.getByTestId('done-editing').click();
    await expect(page).toHaveURL(/\/docs\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByTestId('document-title')).toHaveText('Unreachable');
  });

  test('both toolbars export the markdown source on screen', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await continueAsGuest(page);
    await createProject(page, 'Exports');
    await createDocument(page, 'Ünïcode Notes!');

    await typeIntoEditor(page, '# Draft\n\nstill unsaved');

    // Edit mode exports the live buffer, not the last saved version.
    const editDownload = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-document').click(),
    ]);
    expect(editDownload[0].suggestedFilename()).toBe('unicode-notes.md');
    expect(await readDownload(editDownload[0])).toBe('# Draft\n\nstill unsaved');

    const copiedToast = page.getByText('Markdown copied to the clipboard');
    await page.getByTestId('copy-document').click();
    await expect(copiedToast).toHaveCount(1);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      '# Draft\n\nstill unsaved',
    );
    // Let it auto-dismiss, so the view-mode assertion below cannot pass on this
    // toast instead of its own.
    await expect(copiedToast).toHaveCount(0, { timeout: 20_000 });

    // Same pair, same behaviour, in view mode.
    await page.getByTestId('done-editing').click();
    await expect(page).toHaveURL(/\/docs\/[^/]+$/);
    const viewDownload = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-document').click(),
    ]);
    expect(viewDownload[0].suggestedFilename()).toBe('unicode-notes.md');
    expect(await readDownload(viewDownload[0])).toBe('# Draft\n\nstill unsaved');

    await page.getByTestId('copy-document').click();
    await expect(copiedToast).toHaveCount(1);
  });

  test('log out and log back in returns the same data', async ({ page }) => {
    await continueAsGuest(page);
    await createProject(page, 'Persisted');

    const email = uniqueEmail();
    await page.getByRole('link', { name: 'Save your work' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('hunter2hunter2');
    await page.getByRole('button', { name: 'Save my work' }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL('/');

    await page.getByRole('link', { name: 'Log in' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('hunter2hunter2');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('link', { name: 'Persisted' })).toBeVisible();
  });

  test('a guest can back out of the auth screens without losing the session', async ({ page }) => {
    await continueAsGuest(page);
    await createProject(page, 'Escape Hatch');
    const projectUrl = page.url();

    // Save your work -> signup is otherwise a dead end.
    await page.getByRole('link', { name: 'Save your work' }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await page.getByTestId('continue-as-guest').click();
    await expect(page).toHaveURL(projectUrl);
    await expect(page.getByTestId('project-title')).toHaveText('Escape Hatch');

    // Same guest, same work — not a fresh session.
    await expect(page.getByText('Guest', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'mdnotes' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('link', { name: 'Escape Hatch' })).toBeVisible();

    // The hop through /login keeps the escape hatch too.
    await page.getByRole('link', { name: 'Save your work' }).click();
    await page.getByRole('link', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByTestId('continue-as-guest').click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('link', { name: 'Escape Hatch' })).toBeVisible();
  });

  test('the theme follows the system by default and remembers a choice', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await continueAsGuest(page);
    await expect(page.locator('html')).toHaveClass(/dark/);

    // "System" is live, not read once at boot.
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveClass(/light/);

    // An explicit choice overrides the system and survives a reload.
    await page.getByTestId('theme-toggle').click();
    await page.getByTestId('theme-dark').click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByTestId('theme-toggle')).toHaveAttribute('data-theme', 'dark');
  });

  test('a reload keeps the session via the refresh cookie', async ({ page }) => {
    await continueAsGuest(page);
    await createProject(page, 'Reloadable');
    await page.reload();
    await expect(page.getByTestId('project-title')).toHaveText('Reloadable');
  });
});
