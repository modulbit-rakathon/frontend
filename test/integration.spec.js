import { test, expect } from '@playwright/test';
import { getShareIssues } from '@pillgaze/core';
import { analysis, medication } from './fixtures.js';

const storageKey = 'pillgaze-state-v1';
const picture = { name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=', 'base64') };
const pageErrors = new WeakMap();

test.beforeEach(({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

function backend(response = analysis()) {
  return { response, shares: [], pins: new Map(), requests: 0 };
}

async function connect(context, api) {
  await context.route('**/api/**', async route => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    const path = new URL(request.url()).pathname;
    if (path === '/api/analyze') {
      api.requests++;
      expect(request.headers()['content-type']).toContain('multipart/form-data');
      return route.fulfill({ json: api.response });
    }
    if (path === '/api/share') {
      const body = request.postDataJSON();
      expect(Object.keys(body)).toEqual(['medications']);
      expect(body.medications.length).toBeGreaterThan(0);
      for (const med of body.medications) {
        expect(Object.keys(med).sort()).toEqual(['id', 'kind', 'name', 'active_substance', 'strength', 'form', 'frequency', 'amount', 'source', 'sources', ...(med.note_style === undefined ? [] : ['note_style'])].sort());
      }
      api.shares.push(body);
      api.pins.set('0482', body);
      return route.fulfill({ status: 201, json: { pin: '0482', expires_in: 180, expires_at: new Date(Date.now() + 180000).toISOString() } });
    }
    const { pin } = request.postDataJSON();
    expect(typeof pin).toBe('string');
    const found = api.pins.get(pin);
    if (!found) return route.fulfill({ status: 404, json: { error: { code: 'not_found' } } });
    api.pins.delete(pin);
    return route.fulfill({ json: found });
  });
}

async function checkVisibleFields(page) {
  const boxes = page.locator('.field-confirmation input');
  for (const box of await boxes.all()) await box.check();
}

async function upload(page) {
  await page.goto('/vyfotit');
  await page.locator('input[type=file]').setInputFiles(picture);
  await expect(page.getByRole('heading', { name: 'Zkontrolujte, prosím' })).toBeVisible();
  await expect(page.locator('#field-name')).toBeVisible();
}

async function manual(page, name = 'IBALGIN') {
  await page.goto('/vyfotit?rucne=1');
  await page.locator('#field-name').fill(name);
  await page.locator('#field-strength').fill('400MG');
  await checkVisibleFields(page);
  await page.getByRole('button', { name: 'Ano, přidat lék' }).click();
  await expect(page).toHaveURL(/\/leky$/);
}

test('real frontend: OCR correction → review → reload → exact share → separate doctor claim', async ({ page, context, browser }) => {
  const api = backend();
  await connect(context, api);
  await upload(page);
  await expect(page.locator('#field-name')).toHaveValue('WAREARiN');
  await page.getByText(/Návrhy z katalogu SÚKL/).click();
  await page.getByRole('button', { name: /WARFARIN ORION · 3MG/ }).click();
  await expect(page.locator('#field-name')).toHaveValue('WARFARIN ORION');
  await expect(page.locator('#field-active_substance')).not.toHaveValue('');
  await expect(page.locator('#field-frequency')).toHaveValue('1-0-0');
  await checkVisibleFields(page);
  await page.getByRole('button', { name: 'Ano, přidat lék' }).click();
  await page.reload();
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(getShareIssues(state.medications)).toEqual([]);
  expect(state.medications[0]._core.original.name).toBe('WAREARiN');
  expect(state.medications[0]._core.original.active_substance).toBeNull();
  expect(state.medications[0].sources).toEqual(['note', 'box']);
  await page.goto('/pin');
  await expect(page.locator('.pin-code')).toHaveText('0482');
  expect(api.shares).toHaveLength(1);
  expect(api.shares[0].medications[0].note_style).toBe('handwritten');

  const doctorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:52726', viewport: { width: 1280, height: 900 } });
  await connect(doctorContext, api);
  const doctor = await doctorContext.newPage();
  await doctor.goto('/doc');
  await doctor.getByLabel('Kód pacienta').fill('0482');
  await doctor.getByRole('button', { name: 'Načíst', exact: true }).click();
  await expect(doctor.getByRole('heading', { name: 'Léky pacienta (1)' })).toBeVisible();
  await expect(doctor.locator('.doc-table')).toContainText('WARFARIN ORION');
  await expect(doctor.locator('.doc-table')).toContainText('lístek + krabička');
  expect(await doctor.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
  await doctor.getByRole('button', { name: 'Načíst', exact: true }).click();
  await expect(doctor.getByRole('alert')).toContainText('už vypršel');
  await expect(doctor.locator('.doc-table')).toContainText('WARFARIN ORION');
  await doctorContext.close();
});

test('unreadable-only result persists and blocks sharing until explicitly resolved', async ({ page, context }) => {
  const api = backend(analysis({ medications: [], unreadable_items: 2 }));
  await connect(context, api);
  await page.goto('/vyfotit');
  await page.locator('input[type=file]').setInputFiles(picture);
  await expect(page.getByRole('alert')).toContainText('Nepřečtených položek: 2');
  await manual(page);
  await page.reload();
  await page.goto('/pin');
  await expect(page.getByText('Seznam potřebuje kontrolu')).toBeVisible();
  expect(api.shares).toHaveLength(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Všechny chybějící položky jsem ověřil/a a doplnil/a' }).click();
  await expect(page.locator('.pin-code')).toHaveText('0482');
  expect(api.shares).toHaveLength(1);
});

test('unreviewed rows cannot disappear after navigating away from a multi-item photograph', async ({ page, context }) => {
  const api = backend(analysis({ medications: [medication, medication] }));
  await connect(context, api);
  await upload(page);
  await checkVisibleFields(page);
  await page.getByRole('button', { name: 'Ano, přidat lék' }).click();
  await page.goto('/leky');
  await page.reload();
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(state.medications).toHaveLength(2);
  expect(state.medications[0].id).not.toBe(state.medications[1].id);
  expect(state.medications[1]._core.patientReviewed).toBe(false);
  await page.goto('/pin');
  await expect(page.getByText('Seznam potřebuje kontrolu')).toBeVisible();
  expect(api.shares).toHaveLength(0);
});

test('editing an identity invalidates old confirmations and preserves original evidence', async ({ page, context }) => {
  await connect(context, backend());
  await manual(page);
  await page.locator('.med-toggle').click();
  await page.getByRole('link', { name: 'Zkontrolovat nebo upravit' }).click();
  await page.locator('#field-name').fill('PARALEN');
  await page.getByRole('button', { name: 'Uložit kontrolu' }).click();
  await expect(page.getByText('Seznam potřebuje kontrolu')).toBeVisible();
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(state.medications[0]._core.patientConfirmedFields).toEqual([]);
  expect(state.medications[0]._core.edits.some(edit => edit.field === 'name' && edit.previous === 'IBALGIN')).toBe(true);
});

test('legacy records require review; corrupt storage is preserved and never silently overwritten', async ({ page, context }) => {
  const api = backend();
  await connect(context, api);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pillgaze-meds', JSON.stringify([{ id: 'old', name: 'IBALGIN', source: 'manual', strength: '400MG' }])));
  await page.goto('/pin');
  await expect(page.getByText('Seznam potřebuje kontrolu')).toBeVisible();
  expect(api.shares).toHaveLength(0);
  await page.evaluate(key => localStorage.setItem(key, '{corrupt'), storageKey);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Uložená data nelze načíst');
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe('{corrupt');
  expect(api.shares).toHaveLength(0);
});

test('catalog failure is visible, not a false no-match; retry recovers', async ({ page, context }) => {
  const block = route => route.abort();
  await context.route('**/assets/sukl-catalog-*.js', block);
  await page.goto('/vyfotit?rucne=1');
  await expect(page.getByRole('alert')).toContainText('Katalog nebo záznam se nepodařilo načíst');
  await context.unroute('**/assets/sukl-catalog-*.js', block);
  await page.getByRole('button', { name: 'Zkusit znovu' }).click();
  await expect(page.locator('#field-name')).toBeVisible();
});

test('share errors and Retry-After are visible and prevent immediate retry', async ({ page, context }) => {
  await connect(context, backend());
  await manual(page);
  await context.route('**/api/share', route => route.fulfill({
    status: 429, headers: { 'Retry-After': '2' }, json: { error: { code: 'rate_limited' } },
  }));
  await page.goto('/pin');
  await expect(page.getByRole('alert')).toContainText('2 sekund');
  await expect(page.getByRole('button', { name: /Zkusit znovu za/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zkusit znovu', exact: true })).toBeEnabled();
});

test('malformed doctor response does not crash the page', async ({ page, context }) => {
  await context.route('**/api/share/claim', route => route.fulfill({ json: { medications: null } }));
  await page.goto('/doc');
  await page.getByLabel('Kód pacienta').fill('0482');
  await page.getByRole('button', { name: 'Načíst', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Server vrátil neplatná data');
  await expect(page.getByRole('button', { name: 'Načíst', exact: true })).toBeEnabled();
});

test('manual merge requires group confirmation, preserves evidence and resolves conflicts explicitly', async ({ page, context }) => {
  const first = { ...medication, name: 'IBALGIN', strength: '400MG', active_substance: null, uncertain_fields: [] };
  const second = { ...first, sources: ['note'], frequency: '0-0-1' };
  const api = backend(analysis({ medications: [first, second] }));
  await connect(context, api);
  await upload(page);
  await page.goto('/leky');
  await page.getByText('Sloučit více záznamů stejného léku', { exact: true }).click();
  for (const checkbox of await page.locator('.field-confirmation input').all()) await checkbox.check();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Porovnat vybrané záznamy' }).click();
  await expect(page.getByRole('heading', { name: 'Zkontrolujte sloučený záznam' })).toBeVisible();
  await expect(page.locator('#field-frequency')).toHaveValue('');
  await page.locator('#field-frequency').fill('1-0-0');
  await checkVisibleFields(page);
  await page.getByRole('button', { name: 'Uložit kontrolu' }).click();
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(state.medications).toHaveLength(1);
  expect(state.medications[0]._core.evidence).toHaveLength(2);
  expect(state.medications[0]._core.resolvedConflicts.some(item => item.field === 'frequency')).toBe(true);
  expect(state.medications[0].sources).toEqual(['note', 'box']);
  expect(getShareIssues(state.medications)).toEqual([]);
});

test('storage quota failure cannot masquerade as a successfully saved medication', async ({ page, context }) => {
  await connect(context, backend());
  await page.goto('/vyfotit?rucne=1');
  await page.locator('#field-name').fill('IBALGIN');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  });
  await page.getByRole('button', { name: 'Ano, přidat lék' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Úložiště je plné');
  await expect(page).toHaveURL(/rucne=1/);
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
});

test('a cancelled upload cannot append stale results', async ({ page, context }) => {
  let release;
  let arrived;
  const started = new Promise(resolve => { arrived = resolve; });
  await context.route('**/api/analyze', async route => {
    arrived();
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ json: analysis() }).catch(() => {});
  });
  await page.goto('/vyfotit');
  await page.locator('input[type=file]').setInputFiles(picture);
  await started;
  await page.getByRole('button', { name: 'Zrušit', exact: true }).click();
  release();
  await expect(page.getByRole('heading', { name: 'Vyfotit lék', exact: true })).toBeVisible();
  await page.goto('/leky');
  await expect(page.getByRole('heading', { name: 'Zatím tu nejsou žádné léky' })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
});

test('PIN expires visibly and the mobile form keeps the existing layout without horizontal overflow', async ({ page, context }) => {
  const api = backend();
  await connect(context, api);
  await manual(page);
  await page.clock.install();
  await page.goto('/pin');
  await expect(page.locator('.pin-code')).toHaveText('0482');
  await page.clock.fastForward(181000);
  await expect(page.getByText('Kód už neplatí', { exact: true })).toBeVisible();
  await page.goto('/vyfotit?rucne=1');
  await expect(page.locator('#field-name')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.bottom-nav')).toBeVisible();
});

test('concurrent edits from a second tab cannot silently overwrite the newer record', async ({ page, context }) => {
  await manual(page);
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  await page.goto(`/vyfotit?upravit=${state.medications[0].id}`);
  await page.locator('#field-frequency').fill('rozpracovaný text');
  const other = await context.newPage();
  await other.goto(`/vyfotit?upravit=${state.medications[0].id}`);
  await other.locator('#field-frequency').fill('ověřeno v jiném okně');
  await other.getByRole('button', { name: 'Uložit kontrolu' }).click();
  await expect(other).toHaveURL(/\/leky$/);
  await page.getByRole('button', { name: 'Uložit kontrolu' }).click();
  await expect(page.getByRole('alert')).toContainText('Záznam se změnil v jiném okně');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).medications[0].frequency, storageKey)).toBe('ověřeno v jiném okně');
  await expect(page.locator('#field-frequency')).toHaveValue('rozpracovaný text');
  await other.close();
});
