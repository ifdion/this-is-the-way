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
  const maxScroll = await page.getByLabel('Scrollable flow canvas').evaluate(element => element.scrollHeight - element.clientHeight);
  expect(maxScroll).toBeGreaterThan(0);
  await map.click({ position: { x: box.width / 2, y: box.height - 5 } });
  await expect.poll(() => page.getByLabel('Scrollable flow canvas').evaluate(element => element.scrollTop)).toBeCloseTo(maxScroll, 0);
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

test('decision deletion requires an explicit path choice', async ({ page }) => {
  await createFlow(page, 'Choose before deleting');
  await inspector(page).getByRole('button', { name: '◇ Add branch', exact: true }).click();
  await inspector(page).getByRole('button', { name: 'Delete card…' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: /^Delete card/ })).toBeDisabled();
  await dialog.getByRole('combobox').selectOption('next');
  await expect(dialog.getByRole('button', { name: /^Delete card/ })).toBeEnabled();
});

test('undo after renaming a flow does not undo the rename with a text edit', async ({ page }) => {
  await createFlow(page, 'Original name');
  await addStep(page, 'Initial title');
  await inspector(page).getByLabel('Title', { exact: true }).fill('First edit');
  await page.getByRole('button', { name: 'Manage Original name', exact: true }).click();
  await page.getByLabel('Flow name').fill('Renamed');
  await page.getByRole('button', { name: 'Save name' }).click();
  await inspector(page).getByLabel('Title', { exact: true }).fill('Second edit');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Renamed', exact: true })).toBeVisible();
  await expect(inspector(page).getByLabel('Title', { exact: true })).toHaveValue('First edit');
});

test('a pending deletion cannot be dismissed or raced with another edit', async ({ page }) => {
  await createFlow(page, 'Delete safely');
  await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible();
  // A real competing transaction holds the browser-storage write lock.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const opening = indexedDB.open('this-is-the-way', 1);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction('flows', 'readwrite');
      const store = transaction.objectStore('flows');
      const deadline = Date.now() + 10000;
      function hold() {
        store.get('storage-lock').onsuccess = () => {
          resolve();
          if (document.documentElement.dataset.releaseStorageLock !== 'yes' && Date.now() < deadline) hold();
        };
      }
      transaction.oncomplete = () => db.close();
      hold();
    };
  }));
  await page.getByRole('button', { name: 'Manage Delete safely', exact: true }).click();
  await page.getByRole('button', { name: 'Delete this flow…' }).click();
  await page.getByRole('button', { name: 'Delete flow', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => { document.documentElement.dataset.releaseStorageLock = 'yes'; });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your flows', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage Delete safely', exact: true })).toHaveCount(0);
});

test('flow library collapses and the ad stays pinned while controls scroll', async ({ page }) => {
  await createFlow(page, 'Workspace');
  const canvas = page.getByLabel('Scrollable flow canvas');
  const initialWidth = await canvas.evaluate(element => element.clientWidth);
  await page.getByRole('button', { name: 'Collapse flows' }).click();
  await expect(page.getByRole('navigation', { name: 'Saved flows' })).toBeHidden();
  expect(await canvas.evaluate(element => element.clientWidth)).toBeGreaterThan(initialWidth);
  await page.getByRole('button', { name: 'Expand flows' }).click();
  await expect(page.getByRole('navigation', { name: 'Saved flows' })).toBeVisible();
  await inspector(page).getByRole('button', { name: '◇ Add branch', exact: true }).click();
  const ad = page.getByRole('complementary', { name: 'Advertisement' });
  const before = (await ad.boundingBox())!;
  await page.locator('.inspector').evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await page.locator('.inspector').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const after = (await ad.boundingBox())!;
  expect(after.y).toBeCloseTo(before.y, 1);
  expect(after.y + after.height).toBeLessThanOrEqual(1000);
});

test('compact cards support conversion, hover labels, and rounded terminals', async ({ page }) => {
  await createFlow(page, 'Cards');
  await addStep(page, 'First');
  await addStep(page, 'Last');
  const start = page.getByRole('button', { name: 'start: Start', exact: true });
  const first = page.getByRole('button', { name: 'step: First', exact: true });
  const last = page.getByRole('button', { name: 'step: Last', exact: true });
  expect(await last.evaluate(element => getComputedStyle(element).borderRadius)).toEqual(await start.evaluate(element => getComputedStyle(element).borderRadius));
  const firstBox = (await first.boundingBox())!;
  const lastBox = (await last.boundingBox())!;
  expect(firstBox.height).toBeLessThan(100);
  expect(lastBox.y - firstBox.y - firstBox.height).toBeLessThan(70);
  await last.hover();
  await expect(last.locator('.card-kind')).toHaveCount(0);
  await page.getByRole('heading', { name: 'Cards', exact: true }).hover();
  await expect(first.locator('.card-kind')).toHaveCSS('opacity', '0');
  await first.hover();
  await expect(first.locator('.card-kind')).toHaveCSS('opacity', '1');
  await first.click();
  await inspector(page).getByRole('button', { name: '◆ Convert to decision' }).click();
  const decision = page.getByRole('button', { name: 'decision: First', exact: true });
  await expect(decision.locator('.decision-icon')).toBeVisible();
  expect(await decision.evaluate(element => getComputedStyle(element).borderRadius)).toBe('10px');
  await expect(page.getByRole('button', { name: 'step: Last', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(first).toBeVisible();
});

test('alias clicks select the loop; the navigation button reveals its target', async ({ page }) => {
  await createFlow(page, 'Navigation');
  for (let i = 1; i <= 7; i++) await addStep(page, `Step ${i}`);
  await page.getByRole('button', { name: '↩ Loop to', exact: true }).click();
  await page.getByPlaceholder('Search by name…').fill('Step 1');
  await page.getByRole('dialog').getByRole('button', { name: /^Step 1/ }).click();
  await page.getByRole('button', { name: 'alias: Step 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'alias: Step 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector(page).getByRole('button', { name: 'Delete alias…' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to referred step: Step 1', exact: true }).click();
  const target = page.getByRole('button', { name: 'step: Step 1', exact: true });
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.getByLabel('Scrollable flow canvas').evaluate(element => element.scrollTop)).toBeLessThan(300);
});

test('the alias panel retargets the loop through the picker', async ({ page }) => {
  await createFlow(page, 'Retarget');
  for (let i = 1; i <= 3; i++) await addStep(page, `Step ${i}`);
  await page.getByRole('button', { name: '↩ Loop to', exact: true }).click();
  await page.getByPlaceholder('Search by name…').fill('Step 1');
  await page.getByRole('dialog').getByRole('button', { name: /^Step 1/ }).click();
  await page.getByRole('button', { name: 'alias: Step 1', exact: true }).click();
  await inspector(page).getByRole('button', { name: '⇄ Change loop target…' }).click();
  const picker = page.getByRole('dialog');
  await expect(picker.getByRole('heading')).toHaveText('Point this loop to another card');
  await page.getByPlaceholder('Search by name…').fill('Step 1');
  await expect(picker.getByRole('button', { name: /^Step 1/ })).toHaveCount(0);
  await page.getByPlaceholder('Search by name…').fill('Step 3');
  await picker.getByRole('button', { name: /^Step 3/ }).click();
  await expect(page.getByRole('button', { name: 'alias: Step 3', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'alias: Step 1', exact: true })).toBeVisible();
});

test('minimap uses actual scroll bounds and updates its viewport after resizing', async ({ page }) => {
  await createFlow(page, 'Accurate overview');
  for (let i = 1; i <= 7; i++) await addStep(page, `Step ${i}`);
  const canvas = page.getByLabel('Scrollable flow canvas');
  async function expectMatchingViewport() {
    await expect.poll(async () => {
      const expected = await canvas.evaluate(element => [element.scrollLeft, element.scrollTop, element.clientWidth, element.clientHeight, element.scrollWidth, element.scrollHeight]);
      const actual = await page.getByTestId('minimap').evaluate(element => {
        const svg = element.querySelector('svg')!;
        const rect = element.querySelector('[data-testid="minimap-viewport"]')!;
        return ['x', 'y', 'width', 'height'].map(name => Number(rect.getAttribute(name))).concat([svg.viewBox.baseVal.width, svg.viewBox.baseVal.height]);
      });
      return actual.every((value, index) => Math.abs(value - expected[index]) <= 1);
    }).toBe(true);
  }
  await expectMatchingViewport();
  await canvas.evaluate(element => { element.scrollTop = 350; });
  await expectMatchingViewport();
  await page.getByRole('button', { name: 'Collapse flows' }).click();
  await expectMatchingViewport();
  await page.setViewportSize({ width: 1280, height: 850 });
  await expectMatchingViewport();
});

test('hovering a loop draws an elbow reference to its highlighted origin', async ({ page }) => {
  await createFlow(page, 'Reference elbow');
  for (let i = 1; i <= 3; i++) await addStep(page, `Step ${i}`);
  await page.getByRole('button', { name: '↩ Loop to', exact: true }).click();
  await page.getByPlaceholder('Search by name…').fill('Step 1');
  await page.getByRole('dialog').getByRole('button', { name: /^Step 1/ }).click();
  await page.getByRole('heading', { name: 'Reference elbow', exact: true }).hover();
  await expect(page.getByTestId('alias-elbow')).toHaveCount(0);
  await page.getByRole('button', { name: 'alias: Step 1', exact: true }).hover();
  const d = await page.getByTestId('alias-elbow').getAttribute('d');
  expect(d).toMatch(/^M\d+,\d+ L\d+,\d+ Q\d+,\d+ \d+,\d+/);
  // right edge of alias out, one elbow, into the right edge of the target
  expect(d).toContain(' Q');
  await expect(page.getByRole('button', { name: 'step: Step 1', exact: true })).toHaveClass(/loop-origin/);
  await page.getByRole('button', { name: 'Go to referred step: Step 1', exact: true }).hover();
  await expect(page.getByTestId('alias-elbow')).toHaveCount(1);
  await page.getByRole('heading', { name: 'Reference elbow', exact: true }).hover();
  await expect(page.getByTestId('alias-elbow')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'step: Step 1', exact: true })).not.toHaveClass(/loop-origin/);
});

test('the continue-this-path card and its arrow only appear under the active card', async ({ page }) => {
  await createFlow(page, 'Placeholders');
  await addStep(page, 'First');
  await addStep(page, 'Last');
  await page.reload();
  await page.getByRole('button', { name: '⌘ Placeholders', exact: true }).click();
  await expect(page.locator('.path-placeholder')).toHaveCount(0);
  await expect(page.locator('.empty-connection')).toHaveCount(0);
  await page.getByRole('button', { name: 'step: First', exact: true }).click();
  await expect(page.locator('.path-placeholder')).toHaveCount(0);
  await page.getByRole('button', { name: 'step: Last', exact: true }).click();
  await expect(page.locator('.path-placeholder')).toHaveCount(1);
  await expect(page.locator('text=Continue this path')).toBeVisible();
  await expect(page.locator('.empty-connection')).toHaveCount(1);
});

test('a terminal step converts into a loop reference through the picker', async ({ page }) => {
  await createFlow(page, 'Terminal loop');
  await addStep(page, 'First');
  await addStep(page, 'Last');
  await page.getByRole('button', { name: 'step: Last', exact: true }).click();
  await inspector(page).getByRole('button', { name: '↩ Convert to loop to…' }).click();
  const picker = page.getByRole('dialog');
  await expect(picker.getByRole('heading')).toHaveText('Convert this terminal step to a loop');
  await picker.getByPlaceholder('Search by name…').fill('First');
  await picker.getByRole('button', { name: /^First/ }).click();
  await expect(page.getByRole('button', { name: 'alias: First', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'step: Last', exact: true })).toHaveCount(0);
  await expect(inspector(page).getByRole('button', { name: '⇄ Change loop target…' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'step: Last', exact: true })).toBeVisible();
});

test('landing preview shows the decision card and an always-visible loop path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.preview-decision .decision-icon')).toBeVisible();
  await expect(page.locator('.preview-loop-curve')).toBeVisible();
  await page.locator('.preview-diagram').hover();
  await expect(page.locator('.preview-loop-curve')).toHaveCSS('opacity', '1');
  await page.getByRole('link', { name: 'Go to preview origin' }).click();
  await expect(page.locator('#preview-origin')).toBeFocused();
  const d = await page.locator('.preview-loop-curve').getAttribute('d');
  expect(d).toMatch(/^M386,226 /);
});
