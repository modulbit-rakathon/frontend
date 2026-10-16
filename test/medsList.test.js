import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreRemovedItem } from '../src/context/medsList.js';

test('restores the original item, including its ID and data, at its prior index', () => {
  const first = { id: 'first', name: 'First' };
  const removed = { id: 'removed', name: 'Medicine', strength: '10 mg', extra: { source: 'photo' } };
  const last = { id: 'last', name: 'Last' };

  const restored = restoreRemovedItem([first, last], { item: removed, index: 1 });

  assert.deepEqual(restored, [first, removed, last]);
  assert.equal(restored[1], removed);
});

test('restores the last item when deletion left the list empty', () => {
  const removed = { id: 'only', name: 'Only medicine' };

  assert.deepEqual(restoreRemovedItem([], { item: removed, index: 0 }), [removed]);
});

test('does not insert a duplicate ID', () => {
  const current = [{ id: 'same', name: 'Current' }];

  assert.equal(restoreRemovedItem(current, { item: { id: 'same' }, index: 0 }), current);
});
