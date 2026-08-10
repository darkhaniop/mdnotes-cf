import { expect, test, type Page } from '@playwright/test';
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

    // Create a document; the app drops straight into edit mode.
    await page.getByTestId('new-document').click();
    await page.getByLabel('Title').fill('Observations');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/\/docs\/[^/]+\/edit$/);

    // Edit mode carries the same breadcrumb trail as view mode.
    await expect(page.getByTestId('breadcrumbs')).toContainText('Projects');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Field Notes');
    await expect(page.getByTestId('document-title')).toHaveText('Observations');

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

    // Hide the preview.
    await page.getByTestId('toggle-preview').click();
    await expect(preview).toHaveCount(0);
    await expect(page.getByTestId('markdown-editor')).toBeVisible();

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

  test('a reload keeps the session via the refresh cookie', async ({ page }) => {
    await continueAsGuest(page);
    await createProject(page, 'Reloadable');
    await page.reload();
    await expect(page.getByTestId('project-title')).toHaveText('Reloadable');
  });
});
