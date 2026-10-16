import {
  MEDICATION_FIELDS, prepareAnalysisResult, prepareMedications,
} from '@pillgaze/core';

let catalogPromise;
let sequence = 0;

export function makeId() {
  // Observation IDs also work on LAN HTTP; they are not access tokens or PINs.
  return globalThis.crypto?.randomUUID?.()
    ?? `local-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function loadCatalog() {
  catalogPromise ??= import('@pillgaze/core/sukl-catalog', { with: { type: 'json' } })
    .then(module => module.default)
    .catch(error => {
      catalogPromise = undefined;
      throw error;
    });
  return catalogPromise;
}

export async function preparePhoto(response, analysisId = makeId()) {
  const catalog = await loadCatalog();
  return { ...prepareAnalysisResult(response, { catalog, analysisId }), analysisId };
}

export function prepareForReview(med, catalog) {
  if (med?._core?.version === 1) return structuredClone(med);
  return prepareMedications([med ?? { id: makeId(), kind: 'drug', source: 'manual' }], {
    catalog, analysisId: makeId(),
  })[0];
}

export function formValues(med) {
  return Object.fromEntries(MEDICATION_FIELDS.map(field => [field, med?.[field] ?? '']));
}

export function editedValues(current, values, field, value) {
  const next = { ...values, [field]: value };
  if (['name', 'strength', 'form'].includes(field) && current?._core?.catalogSelection?.active) {
    for (const derived of ['active_substance', 'form']) {
      const origin = current._core.fieldOrigins?.[derived];
      if (derived !== field && origin?.kind === 'catalog' && next[derived] === origin.value) {
        next[derived] = '';
      }
    }
  }
  return next;
}
