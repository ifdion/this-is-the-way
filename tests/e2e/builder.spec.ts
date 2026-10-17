import { test, expect, type Page } from '@playwright/test';

async function createFlow(page: Page, name: string) {
  await page.goto('/builder');
  await page.getByRole('button', { name: '＋ Create a flow', exact: true }).click();
  await page.getByLabel('Flow name').fill(name);
  await page.getByRole('button', { name: 'Create flow →' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Card inspector' });
async function addStep(page: Page, title: string) {
  await inspector(page).getByRole('button', { name: '＋ Add step', exact: true }).first().click();
  await inspector(page).getByLabel('Title', { exact: true }).fill(title);
  await inspector(page).getByRole('button', { name: 'Save changes' }).click();
}

test('landing describes the app and links to the working builder', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Clear paths.');
  await page.getByRole('link', { name: 'Open builder ↗' }).click();
  await expect(page.getByRole('button', { name: '＋ Create a flow', exact: true })).toBeVisible();
});

test('edit, autosave, reopen, duplicate, rename, and delete independent flows', async ({ page }) => {
  await createFlow(page, 'Checkout');
  await addStep(page, 'Pay');
  await expect(page.getByRole('button', { name: 'step: Pay', exact: true })).toBeVisible();
  await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Open flow/ }).click();
  await expect(page.getByRole('button', { name: 'step: Pay', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manage Checkout', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Checkout (copy)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manage Checkout (copy)', exact: true }).click();
  await page.getByLabel('Flow name').fill('Other');
  await page.getByRole('button', { name: 'Save name' }).click();
  await page.getByRole('button', { name: 'Manage Other', exact: true }).click();
  await page.getByRole('button', { name: 'Delete this flow…' }).click();
  await page.getByRole('button', { name: 'Delete flow', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Manage Other', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Manage Checkout', exact: true })).toHaveCount(2);
});

test('inspector typing autosaves without requiring the Save changes button', async ({ page }) => {
  await createFlow(page, 'Automatic saving');
  await addStep(page, 'Before');
  await inspector(page).getByLabel('Title', { exact: true }).fill('Saved automatically');
  await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Open flow/ }).click();
  await expect(page.getByRole('button', { name: 'step: Saved automatically', exact: true })).toBeVisible();
});

test('simulation follows No branches and aliases with Back and Restart', async ({ page }) => {
  await page.goto('/builder');
  await page.getByRole('button', { name: 'Try an example ↗' }).click();
  await page.getByRole('button', { name: '▷ Simulate' }).click();
  const controls = page.getByRole('complementary', { name: 'Simulation controls' });
  await controls.getByRole('button', { name: 'Next step ↓' }).click();
  await controls.getByRole('button', { name: 'Next step ↓' }).click();
  await expect(controls.getByRole('heading')).toHaveText('Ready to build?');
  await controls.getByRole('button', { name: '→ No', exact: true }).click();
  await expect(controls.getByRole('heading')).toHaveText('Need more clarity?');
  await controls.getByRole('button', { name: '↓ Yes', exact: true }).click();
  await controls.getByRole('button', { name: 'Next step ↓' }).click();
  await expect(controls.getByRole('heading')).toHaveText('Shape the idea');
  await controls.getByRole('button', { name: '← Back' }).click();
  await expect(controls.getByRole('heading')).toHaveText('Talk it through');
  await controls.getByRole('button', { name: '↺ Restart' }).click();
  await expect(controls.getByRole('heading')).toHaveText('Start');
  await page.getByRole('button', { name: '⌘ Build' }).click();
  await page.getByRole('button', { name: '▷ Simulate' }).click();
  await expect(controls.getByText('0 transitions taken · diagram unchanged')).toBeVisible();
});

test('binary branches, searchable alias cards, safe deletion, and undo are wired', async ({ page }) => {
  await createFlow(page, 'Retry');
  await addStep(page, 'Prepare');
  await inspector(page).getByRole('button', { name: '◇ Add branch', exact: true }).click();
  await inspector(page).getByLabel('Question', { exact: true }).fill('Ready?');
  await inspector(page).getByRole('button', { name: 'Save changes' }).click();
  await inspector(page).locator('.path-actions').filter({ hasText: 'NO · ALTERNATIVE' }).getByRole('button', { name: '↩ Loop to an existing step' }).click();
  await page.getByPlaceholder('Search by name…').fill('Prepare');
  await page.getByRole('dialog').getByRole('button', { name: /Prepare/ }).click();
  await expect(page.getByRole('button', { name: 'alias: Prepare' })).toBeVisible();
  await page.getByRole('button', { name: 'step: Prepare', exact: true }).click();
  await inspector(page).getByRole('button', { name: 'Delete card…' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Delete card', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Go to alias → Prepare' }).click();
  await inspector(page).getByRole('button', { name: 'Delete alias…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete card', exact: true }).click();
  await expect(page.getByRole('button', { name: 'alias: Prepare' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'alias: Prepare' })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'alias: Prepare' })).toHaveCount(0);
});

test('minimap appears for vertical overflow and navigates the viewport', async ({ page }) => {
  await createFlow(page, 'Long path');
  await expect(page.getByTestId('minimap')).toHaveCount(0);
  for (let i = 1; i <= 4; i++) await addStep(page, `Step ${i}`);
  await expect(page.getByTestId('minimap')).toBeVisible();
  const map = page.getByRole('button', { name: 'Navigate minimap' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height - 5 } });
  await expect.poll(() => page.getByLabel('Scrollable flow canvas').evaluate(element => element.scrollTop)).toBeGreaterThan(100);
});

test('minimap also appears for width-only overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1500 });
  await createFlow(page, 'Wide path');
  await inspector(page).getByRole('button', { name: '◇ Add branch', exact: true }).click();
  for (let i = 0; i < 2; i++) await inspector(page).locator('.path-actions').filter({ hasText: 'NO · ALTERNATIVE' }).getByRole('button', { name: '◇ Add branch', exact: true }).click();
  await expect(page.getByTestId('minimap')).toBeVisible();
  const overflow = await page.getByLabel('Scrollable flow canvas').evaluate(element => ({ horizontal: element.scrollWidth > element.clientWidth, vertical: element.scrollHeight > element.clientHeight }));
  expect(overflow).toEqual({ horizontal: true, vertical: false });
});

test('unconfigured AdSense does not contact the ad network', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (/googlesyndication|doubleclick/.test(request.url())) requests.push(request.url()); });
  await page.goto('/builder');
  await page.getByRole('button', { name: 'Try an example ↗' }).click();
  await expect(page.getByRole('complementary', { name: 'Advertisement' })).toBeVisible();
  expect(requests).toEqual([]);
});
