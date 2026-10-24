import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Inclusive-UX revamp browser acceptance (specs/007-inclusive-ux, UXA-01–UXA-28
 * browser-covered subset). Owner-authorised batch 2026-10-18; see
 * docs/handoffs/inclusive-ux-batch.md. Extended 2026-10-19 per the inclusive-ux
 * review (R3/R4/R5/R6/R7 acceptance gaps; see
 * docs/handoffs/inclusive-ux-corrections-prepared.md).
 *
 * Read-only planner input. Do not replace, skip or weaken these assertions.
 * Machines cannot verify reading comfort; this proves behaviour, not field
 * usability (UXA-31 remains manual).
 */

const credentials = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../tests/fixtures/f02-demo-credentials.json',
    ),
    'utf8',
  ),
).marshal as { username: string; password: string };

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel(/username/i).fill(credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page.getByLabel('Vehicle registration')).toBeVisible();
}

async function fillDraft(page: Page) {
  await page.getByLabel('Vehicle registration').fill('GJ05JP6207');
  await page.getByLabel('Gate pass number').fill('DEMO-GP-0010');
  await page.getByLabel('Driver name').fill('Kavita Joshi');
  await page.getByLabel('Department', { exact: true }).selectOption({ label: 'Logistics' });
  await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
  await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
}

async function openSummary(page: Page) {
  await fillDraft(page);
  await page.getByRole('button', { name: 'Check details' }).click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
}

async function drawStroke(page: Page) {
  const canvas = page.getByTestId('signature-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('missing canvas geometry');
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 12 });
  await page.mouse.up();
}

test('UXA-06: tablet redirects to the single admin sign-in page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/127\.0\.0\.1:5174\//);
  await expect(page.getByRole('heading', { level: 1, name: /^sign in$/i })).toBeVisible();
  await expect(
    page.getByText(
      'Use your assigned account. Marshals continue to the tablet; Supervisors and Admins continue to the dashboard.',
    ),
  ).toBeVisible();
});

test('UXA-02: no horizontal document overflow at 390, 768, 1024 and 1280 widths', async ({
  page,
}) => {
  const widths = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 900 },
  ];
  for (const size of widths) {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /^sign in$/i })).toBeVisible();
    const loginOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(loginOverflow, `login overflow at ${size.width}`).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  for (const [index, size] of widths.entries()) {
    await page.setViewportSize(size);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `entry overflow at ${size.width}`).toBeLessThanOrEqual(1);
    if (index === 0) {
      await expect(page.getByText('Step 1 of 3: Enter details')).toBeVisible();
    }
  }
});

test('UXA-01: three named stages, no competing section step numbers, heading focus', async ({
  page,
}) => {
  await signIn(page);
  const strip = page.getByRole('list', { name: 'Entry progress' });
  await expect(strip.getByText('Enter details', { exact: true })).toBeVisible();
  await expect(strip.getByText('Check details', { exact: true })).toBeVisible();
  await expect(strip.getByText('Photos and signature', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Step [12]$/)).toHaveCount(0);

  await fillDraft(page);
  await page.getByRole('button', { name: 'Check details' }).click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeFocused();
  await expect(page.getByText(/^Step [23]$/)).toHaveCount(0);
});

test('UXA-04: linked summary focuses every control, edits keep unrelated errors, server errors included', async ({
  page,
}) => {
  await signIn(page);
  await page.getByTestId('check-details').click();

  const summary = page.getByTestId('error-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).toContainText('Fix these details');
  await expect(summary.getByRole('link')).toHaveCount(6);

  // Every summary link must focus its actual control (R3).
  const targets: Array<[RegExp, string]> = [
    [/vehicle number/i, 'vehicle-registration'],
    [/gate pass number is required/i, 'gate-pass-number'],
    [/driver name is required/i, 'driver-name'],
    [/select a department/i, 'master-department'],
    [/select a vehicle type/i, 'master-vehicle-type'],
    [/select at least one violation/i, 'violations-group'],
  ];
  for (const [name, id] of targets) {
    await summary.getByRole('link', { name }).click();
    await expect(page.locator(`#${id}`), `${id} focus`).toBeFocused();
  }

  // One edit clears only its own error; unrelated errors remain (R3).
  await page.getByLabel('Driver name').fill('Kavita Joshi');
  await expect(summary).not.toContainText('Driver name is required');
  await expect(summary).toContainText('Gate pass number is required');
  await expect(summary).toContainText('Select at least one violation');
  await expect(page.locator('#gate-pass-number')).toHaveAttribute('aria-invalid', 'true');

  // Server-side field errors keep summary coverage (contractor) and focus.
  await page.route('**/challans/validate', async (route) => {
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'invalid_draft',
        message: 'Some details need attention.',
        fields: [
          {
            field: 'contractorId',
            code: 'inactive_master',
            message: 'Choose an active contractor.',
          },
        ],
      }),
    });
  });
  await page.getByLabel('Vehicle registration').fill('GJ05JP6207');
  await page.getByLabel('Gate pass number').fill('DEMO-GP-0010');
  await page.getByLabel('Department', { exact: true }).selectOption({ label: 'Logistics' });
  await page.getByLabel('Vehicle type').selectOption({ label: 'Car' });
  await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
  await page.getByTestId('check-details').click();
  await expect(summary).toContainText('Choose an active contractor.');
  await summary.getByRole('link', { name: /choose an active contractor/i }).click();
  await expect(page.locator('#master-contractor')).toBeFocused();
});

test('UXA-09: picker roves, selects, dismisses a searched panel and reopens with valid active state', async ({
  page,
}) => {
  await signIn(page);
  const input = page.getByLabel('Vehicle registration');
  await input.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('vehicle-panel')).toBeVisible();
  await expect(input).toHaveAttribute('aria-expanded', 'true');

  // ArrowDown advances and ArrowUp returns to the earlier option.
  const active = page.locator('[role="option"][data-active="true"]');
  await page.keyboard.press('ArrowDown');
  await expect(active).toHaveCount(1);
  const firstActive = await active.textContent();
  await page.keyboard.press('ArrowDown');
  await expect(active).toHaveCount(1);
  expect(await active.textContent()).not.toBe(firstActive);
  await page.keyboard.press('ArrowUp');
  await expect(active).toHaveCount(1);
  expect(await active.textContent()).toBe(firstActive);

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('vehicle-panel')).toHaveCount(0);
  await expect(page.getByLabel('Gate pass number')).not.toHaveValue('');
  await expect(input).not.toHaveAttribute('aria-activedescendant');

  // Active-descendant stays valid while a held search result replaces loading.
  let releaseSearch: () => void = () => undefined;
  const searchGate = new Promise<void>((resolve) => {
    releaseSearch = resolve;
  });
  const searchIssued = page.waitForRequest((request) => request.url().includes('q=GJ0'));
  await page.route('**/registry/lookup*', async (route) => {
    if (route.request().url().includes('q=GJ0')) {
      await searchGate;
    }
    await route.continue();
  });
  await input.fill('GJ0');
  await expect(page.getByTestId('vehicle-panel')).toContainText('Searching the registry…');
  await searchIssued;
  await expect(input).not.toHaveAttribute('aria-activedescendant');
  releaseSearch();
  await expect(page.locator('[role="option"]').first()).toBeVisible();
  // Any active-descendant reference must point at an existing option.
  const idAfterLoad = await input.getAttribute('aria-activedescendant');
  if (idAfterLoad !== null) {
    await expect(page.locator(`#${idAfterLoad}`)).toHaveCount(1);
  }
  await page.keyboard.press('ArrowDown');
  const activeId = await input.getAttribute('aria-activedescendant');
  expect(activeId ?? '').not.toBe('');
  await expect(page.locator(`#${activeId ?? ''}`)).toHaveCount(1);

  // Escape must dismiss an actively searched result set (R4).
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('vehicle-panel')).toHaveCount(0);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).not.toHaveAttribute('aria-activedescendant');

  // A deliberate reopen after dismissal works.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('vehicle-panel')).toBeVisible();
});

test('UXA-13/14: Other is listed last and remarks explain the Other requirement with a counter', async ({
  page,
}) => {
  await signIn(page);
  const violations = page.getByRole('group', { name: 'Violations' });
  const labels = await violations
    .locator('label')
    .evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? '').trim()));
  expect(labels.at(-1)).toBe('Other');

  await violations.getByRole('checkbox', { name: 'Other', exact: true }).check();
  await expect(
    page.getByText('Required because Other is selected.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('0/2000', { exact: true })).toBeVisible();
  await page.getByLabel('Remarks').fill('Driver explained the reason');
  await expect(page.getByText('27/2000', { exact: true })).toBeVisible();
});

test('UXA-12: manual entry stays truthful on the form and on the summary (R5)', async ({
  page,
}) => {
  await signIn(page);
  const input = page.getByLabel('Vehicle registration');
  await input.fill('GJ05JP6207');
  // The search results auto-show; dismiss them, then reopen deliberately.
  await expect(page.getByTestId('vehicle-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('vehicle-panel')).toHaveCount(0);
  await page.getByTestId('vehicle-browse').click();
  await expect(page.getByTestId('vehicle-panel')).toBeVisible();
  await page.getByTestId('vehicle-new-entry').click();
  await expect(page.getByText('Manual entry.', { exact: true })).toBeVisible();
  await expect(page.getByText(/These details apply only to this challan/)).toBeVisible();
  await expect(page.getByText(/Not in the registry/u)).toHaveCount(0);

  await page.getByTestId('vehicle-switch-registry').click();
  await expect(page.getByTestId('vehicle-panel')).toBeVisible();
  await page.locator('[role="option"]').first().click();
  await expect(page.getByLabel('Gate pass number')).not.toHaveValue('');

  await page.getByTestId('vehicle-browse').click();
  await expect(page.getByTestId('vehicle-panel')).toBeVisible();
  await page.getByTestId('vehicle-new-entry').click();
  await expect(page.getByText(/Existing details kept. Check them before continuing/)).toBeVisible();

  // The summary must not claim registry absence for a carried registered plate.
  await page.getByRole('checkbox', { name: 'Not wearing a seat belt' }).check();
  await page.getByTestId('check-details').click();
  await expect(page.getByRole('heading', { name: 'Driver summary' })).toBeVisible();
  await expect(page.getByText('GJ05JP6207').first()).toBeVisible();
  await expect(page.getByText('Manual entry', { exact: true })).toBeVisible();
  await expect(page.getByText(/not in the registry/i)).toHaveCount(0);
});

test('UXA-16: summary exposes Change details and Continue to photos with retained values', async ({
  page,
}) => {
  await signIn(page);
  await openSummary(page);
  await expect(page.getByRole('button', { name: 'Continue to photos' })).toBeVisible();
  await page.getByRole('button', { name: 'Change details' }).click();
  await expect(page.getByRole('heading', { name: /vehicle & driver/i })).toBeFocused();
  await expect(page.getByLabel('Vehicle registration')).toHaveValue('GJ05JP6207');
});

test('UXA-23/27: signature confirmed state, Sign again, and honest local-only copy', async ({
  page,
}) => {
  await signIn(page);
  await openSummary(page);
  await page.getByRole('button', { name: 'Continue to photos' }).click();
  await expect(page.getByTestId('signature-pad')).toBeVisible();
  await drawStroke(page);
  await expect(page.getByTestId('signature-confirm')).toBeEnabled();
  await page.getByTestId('signature-confirm').click();
  await expect(page.getByText('Signature confirmed', { exact: true })).toBeVisible();
  await expect(page.getByTestId('signature-confirm')).toBeDisabled();
  await expect(
    page.getByText('Signature captured on this device. No challan has been submitted.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign again' }).click();
  await expect(page.getByText('Signature confirmed', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('signature-confirm')).toBeDisabled();
});

test('UXA-23/29: a restored signature keeps the confirmed presentation; drawing area is named and Clear is separated', async ({
  page,
}) => {
  await signIn(page);
  await openSummary(page);
  await page.getByRole('button', { name: 'Continue to photos' }).click();
  await expect(page.getByTestId('signature-pad')).toBeVisible();

  // R6: the drawing surface is named, described and grouped under its heading.
  await expect(page.getByRole('group', { name: 'Driver signature' })).toBeVisible();
  await expect(page.getByLabel('Signature drawing area')).toHaveAttribute(
    'aria-describedby',
    'signature-instructions',
  );

  await drawStroke(page);
  await page.getByTestId('signature-confirm').click();
  await expect(page.getByText('Signature confirmed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to summary' }).click();
  await expect(page.getByText('Driver signature captured.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to photos' }).click();
  await expect(page.getByTestId('signature-canvas')).toBeVisible();

  // R2: restoration without mutation stays in the confirmed presentation.
  await expect(page.getByText('Signature confirmed', { exact: true })).toBeVisible();
  await expect(page.getByTestId('signature-confirm')).toBeDisabled();
  await expect(
    page.getByText('Signature captured on this device. No challan has been submitted.'),
  ).toBeVisible();

  // R6: destructive Clear is physically separated from confirmation.
  const confirmBox = await page.getByTestId('signature-confirm').boundingBox();
  const clearBox = await page.getByTestId('signature-clear').boundingBox();
  if (!confirmBox || !clearBox) throw new Error('missing control geometry');
  expect(clearBox.y).toBeGreaterThanOrEqual(confirmBox.y + confirmBox.height);
});

test('UXA-25: refusal reports blank fields and limit breaches, then confirms plainly', async ({
  page,
}) => {
  await signIn(page);
  await openSummary(page);
  await page.getByRole('button', { name: 'Continue to photos' }).click();
  await page.getByRole('button', { name: 'Driver refuses to sign' }).click();
  await expect(page.getByRole('heading', { name: 'Record refusal to sign' })).toBeVisible();

  await page.getByTestId('refusal-confirm').click();
  const errors = page.getByTestId('refusal-errors');
  await expect(errors).toBeVisible();
  await expect(errors).toContainText(/refused to sign/i);
  await expect(errors).toContainText(/witnessing supervisor.*name/i);
  await expect(errors).toContainText(/witnessing supervisor.*staff id/i);
  await errors.getByRole('link', { name: /witnessing supervisor.*name/i }).click();
  await expect(page.getByLabel(/witnessing supervisor name/i)).toBeFocused();

  // A limit breach maps to a length correction, not a blank-field message.
  const reason = page.getByLabel(/Reason/i);
  await reason.fill('x'.repeat(2001));
  await expect(page.getByText('2001/2000', { exact: true })).toBeVisible();
  await page.getByTestId('refusal-confirm').click();
  await expect(errors).toContainText(/shorten the reason/i);
  await errors.getByRole('link', { name: /shorten the reason/i }).click();
  await expect(reason).toBeFocused();
  await expect(reason).toHaveValue('x'.repeat(2001));

  await reason.fill('Driver left the scene');
  await page.getByLabel(/witnessing supervisor name/i).fill('S. Iyer');
  await page.getByLabel(/witnessing supervisor staff id/i).fill('DEMO-EMP-007');
  await page.getByTestId('refusal-confirm').click();
  await expect(page.getByText(/Refusal recorded with witness S. Iyer/u)).toBeVisible();
  await expect(page.getByText(/Bound to summary revision/u)).toHaveCount(0);
  await expect(page.getByText(/no challan has been submitted/iu)).toBeVisible();
});

test('UXA-03: tablet controls meet the 56px minimum and the primary action is 64px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  const checkButton = await page.getByRole('button', { name: 'Check details' }).boundingBox();
  expect(checkButton?.height ?? 0).toBeGreaterThanOrEqual(64);

  for (const label of ['Vehicle registration', 'Gate pass number', 'Driver name']) {
    const box = await page.getByLabel(label).boundingBox();
    expect(box?.height ?? 0, `${label} height`).toBeGreaterThanOrEqual(56);
  }
  const rows = page.getByRole('group', { name: 'Violations' }).getByRole('checkbox');
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const item = rows.nth(index);
    const box = await item.boundingBox();
    expect(box?.height ?? 0, `violation row ${index}`).toBeGreaterThanOrEqual(56);
  }
});
