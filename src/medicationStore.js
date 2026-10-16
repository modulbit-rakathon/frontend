import { getShareIssues } from '@pillgaze/core';
import { makeId } from './core.js';

export const STORAGE_KEY = 'pillgaze-state-v1';
export const LEGACY_STORAGE_KEY = 'pillgaze-meds';
export const emptyState = () => ({ version: 1, medications: [], analyses: [] });

export function validateState(state) {
  if (state?.version !== 1 || !Array.isArray(state.medications) || !Array.isArray(state.analyses)) {
    throw new Error('Uložený seznam má neznámý formát. Data nebyla přepsána.');
  }
  const ids = new Set();
  for (const med of state.medications) {
    if (!med || typeof med.id !== 'string' || !med.id || ids.has(med.id) || typeof med.name !== 'string'
        || getShareIssues([{ ...med, kind: med.kind ?? 'drug' }])
          .some(issue => issue.code === 'invalid_medication')) {
      throw new Error('Uložený seznam obsahuje neplatný záznam. Data nebyla přepsána.');
    }
    ids.add(med.id);
  }
  const analysisIds = new Set();
  for (const analysis of state.analyses) {
    if (!analysis || typeof analysis.id !== 'string' || !analysis.id || analysisIds.has(analysis.id)
        || !Number.isSafeInteger(analysis.unreadableCount) || analysis.unreadableCount < 0
        || typeof analysis.resolved !== 'boolean') {
      throw new Error('Uložené informace o nepřečtených položkách jsou poškozené.');
    }
    analysisIds.add(analysis.id);
  }
  return state;
}

export function readState(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw !== null) return validateState(JSON.parse(raw));
  const legacy = storage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === null) return emptyState();
  const medications = JSON.parse(legacy);
  if (!Array.isArray(medications)) throw new Error('Starší uložený seznam není platný.');
  // Keep legacy records and evidence. The share gate requires a fresh review.
  return validateState({ ...emptyState(), medications });
}

export function appendAnalysis(state, result) {
  if (!Number.isSafeInteger(result.unreadable_count) || result.unreadable_count < 0) {
    throw new Error('Neplatný počet nepřečtených položek.');
  }
  const medications = result.medications.map(med => ({ ...med, id: makeId() }));
  const next = {
    ...state,
    medications: [...state.medications, ...medications],
    analyses: [...state.analyses, {
      id: result.analysisId, unreadableCount: result.unreadable_count, resolved: false,
    }],
  };
  return { state: validateState(next), medications };
}

export function unreadableCount(state) {
  return state.analyses.reduce((sum, item) => sum + (item.resolved ? 0 : item.unreadableCount), 0);
}
