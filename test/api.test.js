import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePhoto, createSharePin, claimShare, apiErrorMessage } from '../src/api.js';
import { medication } from './fixtures.js';

test('analyze sends the actual multipart file and source, never a browser API key', async t => {
  const file = new File(['synthetic'], 'test.png', { type: 'image/png' });
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/api/analyze');
    assert.equal(options.body.get('image').name, 'test.png');
    assert.equal(options.body.get('source'), 'note');
    assert.equal(options.headers?.['X-Api-Key'], undefined);
    return Response.json({ medications: [], unreadable_items: 2 });
  });
  assert.equal((await analyzePhoto(file, 'note')).unreadable_items, 2);
});

test('unsupported and oversized photographs are rejected before upload', t => {
  const fetch = t.mock.method(globalThis, 'fetch');
  assert.throws(() => analyzePhoto(new File(['x'], 'x.heic', { type: 'image/heic' }), 'box'));
  assert.throws(() => analyzePhoto(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'x.png', { type: 'image/png' }), 'box'));
  assert.equal(fetch.mock.callCount(), 0);
});

test('share transmits the given core payload exactly and preserves a leading zero PIN', async t => {
  const payload = { medications: [{ ...medication, uncertain_fields: undefined, conflicts: undefined }] };
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/api/share');
    assert.equal(options.body, JSON.stringify(payload));
    return Response.json({ pin: '0482', expires_at: new Date(Date.now() + 180000).toISOString(), expires_in: 180 }, { status: 201 });
  });
  assert.equal((await createSharePin(payload)).pin, '0482');
});

test('malformed success responses fail instead of crashing the PIN or doctor screen', async t => {
  for (const data of [null, {}, { pin: 482, expires_in: 180, expires_at: new Date().toISOString() }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(data));
    await assert.rejects(createSharePin({ medications: [] }), { message: 'invalid_response' });
  }
  for (const data of [{ medications: [] }, { medications: [null] }, { medications: [medication, medication] }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(data));
    await assert.rejects(claimShare('0482'), { message: 'invalid_response' });
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>not JSON</html>'));
  await assert.rejects(claimShare('0482'), { message: 'invalid_response' });
});

test('claim is POST with string PIN and respects backend rate-limit information', async t => {
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/api/share/claim');
    assert.deepEqual(JSON.parse(options.body), { pin: '0482' });
    return Response.json({ error: { code: 'rate_limited' } }, { status: 429, headers: { 'Retry-After': '2' } });
  });
  await assert.rejects(claimShare('0482'), error => {
    assert.equal(error.retryAfter, 2);
    assert.match(apiErrorMessage(error), /2 sekund/);
    return true;
  });
});

test('caller cancellation reaches the active fetch and is propagated', async t => {
  t.mock.method(globalThis, 'fetch', (_path, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const controller = new AbortController();
  const pending = analyzePhoto(new File(['x'], 'x.png', { type: 'image/png' }), 'box', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
