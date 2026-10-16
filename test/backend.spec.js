import { test, expect } from '@playwright/test';
import { createSharePayload } from '@pillgaze/core';
import { readdirSync, readFileSync } from 'node:fs';

for (const source of ['box', 'note']) {
test(`unchanged Go backend (${source}): analyze, review, share and one-use doctor claim`, async ({ page, browser }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/vyfotit');
  const analysisResponse = page.waitForResponse(response => response.url().endsWith('/api/analyze'));
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: source === 'box' ? 'Vyfotit krabičku' : 'Vyfotit lístek od lékaře', exact: true }).click();
  await (await choosing).setFiles({
    name: 'synthetic.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=', 'base64'),
  });
  const analyzed = await analysisResponse;
  expect(analyzed.status()).toBe(200);
  expect(analyzed.request().headers()['x-api-key']).toBeUndefined();
  const raw = await analyzed.json();
  expect(raw.medications.length).toBeGreaterThan(0);
  for (const med of raw.medications) {
    await expect(page.locator('#field-name')).toHaveValue(med.name);
    for (const checkbox of await page.locator('.field-confirmation input').all()) await checkbox.check();
    await page.getByRole('button', { name: 'Ano, přidat lék' }).click();
  }
  await expect(page).toHaveURL(/\/leky$/);
  if (raw.unreadable_items > 0) {
    await expect(page.getByText('Seznam potřebuje kontrolu')).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    // Synthetic fixture only: explicitly exercise resolution, never infer it from saving another row.
    await page.getByRole('button', { name: 'Všechny chybějící položky jsem ověřil/a a doplnil/a' }).click();
  }
  await page.reload();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('pillgaze-state-v1')));
  const expected = createSharePayload(state.medications);
  expect(state.analyses.every(item => item.unreadableCount === 0 || item.resolved)).toBe(true);
  expect(state.medications.map(med => med._core.original.id)).toEqual(raw.medications.map(med => med.id));
  const shareResponse = page.waitForResponse(response => response.url().endsWith('/api/share'));
  await page.goto('/pin');
  const shared = await shareResponse;
  expect(shared.status()).toBe(201);
  expect(shared.request().postDataJSON()).toEqual(expected);
  expect(shared.request().headers()['x-api-key']).toBeUndefined();
  const { pin } = await shared.json();
  expect(pin).toMatch(/^\d{4}$/);
  await expect(page.locator('.pin-code')).toHaveText(pin);

  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:52726', viewport: { width: 1280, height: 900 } });
  const doctor = await context.newPage();
  doctor.on('pageerror', error => errors.push(error.message));
  await doctor.goto('/doc');
  await doctor.getByLabel('Kód pacienta').fill(pin);
  const claimedResponse = doctor.waitForResponse(response => response.url().endsWith('/api/share/claim'));
  await doctor.getByRole('button', { name: 'Načíst', exact: true }).click();
  const claimed = await claimedResponse;
  expect(claimed.status()).toBe(200);
  expect(await claimed.json()).toEqual(expected);
  await expect(doctor.locator('.doc-table tbody tr')).toHaveCount(raw.medications.length);
  const consumedResponse = doctor.waitForResponse(response => response.url().endsWith('/api/share/claim'));
  await doctor.getByRole('button', { name: 'Načíst', exact: true }).click();
  expect((await consumedResponse).status()).toBe(404);
  await expect(doctor.getByRole('alert')).toContainText('Kód neexistuje nebo už vypršel');
  expect(errors).toEqual([]);
  for (const file of readdirSync('dist/assets').filter(name => name.endsWith('.js'))) {
    expect(readFileSync(`dist/assets/${file}`, 'utf8').includes(process.env.APP_API_KEY)).toBe(false);
  }
  await context.close();
});
}
