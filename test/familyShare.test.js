import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeShare, diffShare, encodeShare, makeResponse } from '../src/familyShare.js';

const own = [
  {
    id: 'a',
    type: 'lek',
    name: 'Prestarium Neo',
    strength: '5 mg',
    dosage: { mode: 'schedule', morning: 1, noon: 0, evening: 0, night: 0, text: '' },
    since: '2024-03',
    prescriber: 'gp',
    active_substance: 'perindoprilum',
    catalog_id: 'cat_245',
  },
  { id: 'b', type: 'lek', name: 'Godasal', strength: '100 mg', since: '2020', active_substance: 'kyselina acetylsalicylová' },
];

async function doctorShare(items) {
  const data = makeResponse({ id: 'x', rid: '', from: 'lékař', items, onco: '', base: [], doc: true });
  return decodeShare(await encodeShare(data, { compress: false }));
}

test('doctor correction changes only the edited fields', async () => {
  const share = await doctorShare([
    { id: 'a', type: 'lek', name: 'Prestarium Neo', strength: '10 mg', edited: ['strength'] },
  ]);
  assert.equal(share.doc, true);

  const diff = diffShare(own, share);
  assert.equal(diff.changed.length, 1);
  const { after } = diff.changed[0];
  assert.equal(after.strength, '10 mg');
  // Údaje, které lékař neopravoval, zůstanou
  assert.equal(after.since, '2024-03');
  assert.equal(after.prescriber, 'gp');
  assert.deepEqual(after.dosage, own[0].dosage);
  assert.equal(after.active_substance, 'perindoprilum');
  assert.equal(diff.unchanged, 0);
  assert.deepEqual(diff.removed, []);
});

test('renamed product does not keep the old active substance', async () => {
  const share = await doctorShare([{ id: 'b', type: 'lek', name: 'Anopyrin', edited: ['name'] }]);
  const { after } = diffShare(own, share).changed[0];
  assert.equal(after.name, 'Anopyrin');
  assert.equal(after.active_substance, null);
  assert.equal(after.catalog_id, null);
  assert.equal(after.strength, '100 mg');
});

test('cleared dosage stays unknown, deleted items are not re-added', async () => {
  const share = await doctorShare([
    { id: 'a', type: 'lek', name: 'Prestarium Neo', edited: ['dosage'] },
    { id: 'gone', type: 'lek', name: 'Smazaný lék', strength: '1 mg', edited: ['strength'] },
  ]);
  const diff = diffShare(own, share);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.changed[0].after.dosage.mode, 'schedule');
  assert.equal(diff.changed[0].after.dosage.morning, 0);
  assert.deepEqual(diff.added, []);
});

test('family response is still taken as a whole item', async () => {
  const data = makeResponse({ id: 'y', rid: 'r', items: [{ id: 'b', type: 'lek', name: 'Godasal', strength: '' }], base: ['b'] });
  const share = await decodeShare(await encodeShare(data, { compress: false }));
  assert.equal(share.doc, false);
  assert.equal(diffShare(own, share).changed[0].after.since, '');
});
