import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharePayload, finalizeMedication, getShareIssues, selectMedicationCandidate } from '@pillgaze/core';
import { loadCatalog, preparePhoto, prepareForReview, editedValues, formValues } from '../src/core.js';
import { appendAnalysis, emptyState, readState, unreadableCount, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../src/medicationStore.js';
import { analysis, medication } from './fixtures.js';

const catalog = await loadCatalog();
const fields = ['name', 'active_substance', 'strength', 'form', 'frequency', 'amount'];
const storage = data => ({ getItem: key => data[key] ?? null });

test('pinned full SÚKL catalog and real OCR candidates are loaded', async () => {
  assert.equal(catalog.length, 21226);
  assert.equal(await loadCatalog(), catalog);
  const prepared = await preparePhoto(analysis(), 'photo-1');
  assert.ok(prepared.medications[0]._core.suggestions.candidates.some(item => item.name === 'WARFARIN ORION'));
  assert.equal(prepared.medications[0].name, medication.name);
  assert.equal(prepared.medications[0]._core.original.active_substance, null);
});

test('selection, explicit review, persistence and strict backend payload preserve all six fields', async () => {
  const prepared = await preparePhoto(analysis());
  const { state, medications: [draft] } = appendAnalysis(emptyState(), prepared);
  const candidate = catalog.find(item => item.name === 'WARFARIN ORION' && item.strength === '3MG');
  const selected = selectMedicationCandidate(draft, candidate.id, { catalog });
  assert.ok(selected.active_substance);
  assert.ok(getShareIssues([selected]).length);
  // Synthetic explicit confirmations. The real UI has separate unchecked checkboxes.
  const reviewed = finalizeMedication(selected, formValues(selected), { catalog, confirmedFields: fields });
  state.medications[0] = reviewed;
  const restored = readState(storage({ [STORAGE_KEY]: JSON.stringify(state) }));
  const payload = createSharePayload(restored.medications, { unreadableCount: unreadableCount(restored) });
  assert.equal(payload.medications[0].id, draft.id);
  assert.notEqual(draft.id, medication.id);
  assert.deepEqual(payload.medications[0].sources, ['note', 'box']);
  assert.equal(payload.medications[0].note_style, 'handwritten');
  assert.equal(payload.medications[0].active_substance, candidate.ingredientText);
  assert.equal(payload.medications[0].form, candidate.form);
  assert.equal(restored.medications[0]._core.original.name, 'WAREARiN');
  assert.ok(!JSON.stringify(payload).includes('_core'));
  assert.ok(!JSON.stringify(payload).includes('uncertain_fields'));
});

test('all drafts and unreadable counts survive navigation, another photo, deletion and reload', async () => {
  const first = appendAnalysis(emptyState(), await preparePhoto(analysis({
    medications: [medication, medication], unreadable_items: 2,
  })));
  assert.notEqual(first.medications[0].id, first.medications[1].id);
  assert.equal(first.medications[0]._core.original.id, first.medications[1]._core.original.id);
  const next = appendAnalysis(first.state, await preparePhoto(analysis({ medications: [], unreadable_items: 1 }))).state;
  next.medications = [];
  const restored = readState(storage({ [STORAGE_KEY]: JSON.stringify(next) }));
  assert.equal(unreadableCount(restored), 3);
  assert.ok(getShareIssues(restored.medications, { unreadableCount: unreadableCount(restored) })
    .some(issue => issue.code === 'unreadable_items'));
});

test('legacy records are not silently discarded or treated as reviewed', () => {
  const old = { id: 'old', name: 'Ibalgin', strength: '400MG', source: 'manual' };
  const restored = readState(storage({ [LEGACY_STORAGE_KEY]: JSON.stringify([old]) }));
  assert.deepEqual(restored.medications, [old]);
  const draft = prepareForReview(old, catalog);
  assert.equal(draft.kind, 'drug');
  assert.equal(draft._core.patientReviewed, false);
});

test('corrupt or unknown stored formats fail explicitly instead of returning a clean empty list', () => {
  for (const raw of ['null', '{}', '{"version":99}', '[null]', 'not json']) {
    assert.throws(() => readState(storage({ [STORAGE_KEY]: raw })));
  }
  assert.throws(() => readState(storage({ [LEGACY_STORAGE_KEY]: '{"wrong":"shape"}' })));
  assert.throws(() => readState(storage({ [LEGACY_STORAGE_KEY]: JSON.stringify([{ id: 'old', kind: 'drug', name: null, source: 'manual' }]) })));
  const bad = { ...emptyState(), analyses: [{ id: 'a', unreadableCount: -1, resolved: false }] };
  assert.throws(() => readState(storage({ [STORAGE_KEY]: JSON.stringify(bad) })));
});

test('editing catalog identity clears stale catalog facts, not manually edited facts or dosage', async () => {
  const [draft] = (await preparePhoto(analysis())).medications;
  const candidate = catalog.find(item => item.name === 'WARFARIN ORION' && item.strength === '3MG');
  const selected = selectMedicationCandidate(draft, candidate.id, { catalog });
  const values = formValues(selected);
  const changed = editedValues(selected, values, 'name', 'jiný lék');
  assert.equal(changed.active_substance, '');
  assert.equal(changed.form, '');
  assert.equal(changed.frequency, selected.frequency);
  assert.equal(editedValues(selected, { ...values, active_substance: 'ručně ověřeno' }, 'strength', '5MG').active_substance, 'ručně ověřeno');
  const reviewed = finalizeMedication(selected, values, { catalog, confirmedFields: fields });
  const reedited = finalizeMedication(reviewed, changed, { catalog });
  assert.deepEqual(reedited._core.patientConfirmedFields, []);
  assert.ok(getShareIssues([reedited]).some(issue => issue.field === 'frequency'));
});

test('regimen and unresolved conflicts are not silently expanded or shared', async () => {
  const [regimen] = (await preparePhoto(analysis({
    medications: [{ ...medication, name: 'FOLFOX', kind: 'regimen', strength: null, frequency: null, amount: null }],
  }))).medications;
  assert.equal(regimen._core.suggestions, null);
  assert.equal(regimen.kind, 'regimen');
  const [conflicted] = (await preparePhoto(analysis({ medications: [{
    ...medication, conflicts: [{ field: 'strength', values: [{ source: 'note', value: '3MG' }, { source: 'box', value: '5MG' }] }],
  }] }))).medications;
  assert.throws(() => createSharePayload([finalizeMedication(conflicted, {}, { catalog })]));
});
