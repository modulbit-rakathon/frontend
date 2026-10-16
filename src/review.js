// Kontrola léků přečtených z fotek – logika bez vzhledu.
//
// Z každého léku od backendu (AnalyzedMedication) uděláme "koncept" (draft):
// údaje, které pacient vidí a může upravit, plus co už zkontroloval.
// Obrazovka Scan.jsx koncepty jen zobrazuje a mění funkcemi odsud.
//
// Co musí pacient vyřešit, než lék uloží (viz draftTodos):
//   1. rozpory – lístek a krabička říkají něco jiného (conflicts) → vybrat, co platí,
//   2. katalog – needs_confirmation → vybrat přípravek, vyhledat jiný, nebo "nechat jak je",
//   3. nejistá pole (uncertain_fields) → "Je to správně" nebo opravit.
import { catalogName, medName } from './labels.js';
import { BACKEND_TO_FORM_FIELD, CATALOG_STATUS, ITEM_TYPES, dosageFromText } from './types.js';

/**
 * @typedef {Object} Draft
 * @property {string} id
 * @property {import('./types.js').AnalyzedMedication} med – původní odpověď backendu
 * @property {string} name
 * @property {string} strength
 * @property {import('./types.js').Dosage} dosage
 * @property {string} since
 * @property {string} prescriber
 * @property {string|null} active_substance
 * @property {string|null} form
 * @property {import('./types.js').CatalogProduct|null} product – přípravek z katalogu (nebo nic)
 * @property {null|string} catalogChoice – jen u needs_confirmation: id kandidáta, 'other' (hledat), 'keep' (nechat)
 * @property {string[]} resolvedConflicts – pole s rozporem, kde už pacient vybral hodnotu
 * @property {string[]} checkedFields – nejistá pole formuláře, která pacient potvrdil ('name'|'strength'|'dosage')
 */

/** Lék od backendu → koncept pro kontrolu. @returns {Draft} */
export function makeDraft(med) {
  const matched = med.catalog?.status === CATALOG_STATUS.MATCHED;
  return {
    id: med.id,
    med,
    name: medName(med),
    strength: med.strength ?? '',
    dosage: dosageFromText(med.frequency, med.amount),
    since: '',
    prescriber: '',
    active_substance: med.active_substance ?? null,
    form: med.form ?? null,
    product: matched ? med.catalog.product : null,
    catalogChoice: null,
    resolvedConflicts: [],
    checkedFields: [],
  };
}

// Nejistá pole backendu (frequency, amount…) → pole formuláře (dosage…), každé jen jednou
function uncertainFormFields(med) {
  const fields = (med.uncertain_fields ?? []).map((f) => BACKEND_TO_FORM_FIELD[f]).filter(Boolean);
  return [...new Set(fields)];
}

/** Čeká lék na výběr přípravku z katalogu? */
export function needsCatalogChoice(draft) {
  return draft.med.catalog?.status === CATALOG_STATUS.NEEDS_CONFIRMATION && draft.catalogChoice === null;
}

/** Rozpory, které pacient ještě nevyřešil. @returns {import('./types.js').Conflict[]} */
export function openConflicts(draft) {
  return (draft.med.conflicts ?? []).filter((c) => !draft.resolvedConflicts.includes(c.field));
}

/**
 * Nejistá pole formuláře, která ještě nikdo nepotvrdil.
 * Pole s rozporem sem nepatří (řeší se výběrem hodnoty) a název u needs_confirmation
 * taky ne (vyřeší ho výběr přípravku).
 */
export function openFields(draft) {
  const conflictFields = (draft.med.conflicts ?? []).map((c) => BACKEND_TO_FORM_FIELD[c.field]);
  const byCatalog = draft.med.catalog?.status === CATALOG_STATUS.NEEDS_CONFIRMATION ? ['name'] : [];
  return uncertainFormFields(draft.med).filter(
    (f) => !draft.checkedFields.includes(f) && !conflictFields.includes(f) && !byCatalog.includes(f),
  );
}

/** Kolik věcí u léku zbývá vyřešit (0 = lék sedí). */
export function draftTodos(draft) {
  return (needsCatalogChoice(draft) ? 1 : 0) + openConflicts(draft).length + openFields(draft).length;
}

/**
 * Pacient vybral přípravek z katalogu (kandidáta nebo z hledání).
 * Účinná látka se MUSÍ přepsat z katalogu – bez ní by lékař neviděl interakce.
 * Název a sílu bereme z katalogu, protože pacient potvrdil "je to tenhle přípravek".
 * @returns {Draft}
 */
export function chooseProduct(draft, product, choice) {
  return {
    ...draft,
    product,
    catalogChoice: choice,
    name: catalogName(product.name),
    strength: product.strength || draft.strength,
    active_substance: product.active_substance,
    form: product.form || draft.form,
    // Název už je vyřešený (= smazat "name" z uncertain_fields)
    checkedFields: [...new Set([...draft.checkedFields, 'name', ...(product.strength ? ['strength'] : [])])],
  };
}

/** Pacient nechal lék tak, jak byl přečtený (bez přípravku z katalogu). @returns {Draft} */
export function keepAsRead(draft) {
  return {
    ...draft,
    product: null,
    catalogChoice: 'keep',
    name: medName(draft.med),
    active_substance: draft.med.active_substance ?? null,
    checkedFields: [...new Set([...draft.checkedFields, 'name'])],
  };
}

/**
 * Pacient vybral hodnotu u rozporu (např. sílu z krabičky).
 * @param {'name'|'strength'|'frequency'} field
 * @returns {Draft}
 */
export function resolveConflict(draft, field, value) {
  const changes = {
    name: { name: value },
    strength: { strength: value },
    frequency: { dosage: dosageFromText(value, null) },
  }[field];
  return {
    ...draft,
    ...changes,
    resolvedConflicts: [...new Set([...draft.resolvedConflicts, field])],
    checkedFields: [...new Set([...draft.checkedFields, BACKEND_TO_FORM_FIELD[field]])],
  };
}

/** Pacient potvrdil nejisté pole tlačítkem "Je to správně". @returns {Draft} */
export function confirmField(draft, field) {
  return { ...draft, checkedFields: [...new Set([...draft.checkedFields, field])] };
}

/**
 * Pole, která má formulář "Upravit" zvýraznit žlutě: nejistá pole + pole s rozporem.
 * @returns {string[]} pole formuláře ('name'|'strength'|'dosage')
 */
export function formFieldsToCheck(draft) {
  const conflictFields = openConflicts(draft).map((c) => BACKEND_TO_FORM_FIELD[c.field]);
  return [...new Set([...openFields(draft), ...conflictFields])];
}

/**
 * Pacient údaje opravil ve formuláři. MedForm ho pustí dál, jen když potvrdil
 * všechna žlutá pole → nejistá pole i rozpory označíme jako vyřešené.
 * @returns {Draft}
 */
export function applyForm(draft, values) {
  return {
    ...draft,
    ...values,
    checkedFields: [...new Set([...draft.checkedFields, ...formFieldsToCheck(draft)])],
    resolvedConflicts: [...new Set([...draft.resolvedConflicts, ...openConflicts(draft).map((c) => c.field)])],
  };
}

/**
 * Hotový koncept → položka do seznamu pacienta (localStorage).
 * @returns {Omit<import('./types.js').Item, 'id'>}
 */
export function draftToItem(draft) {
  const { med } = draft;
  return {
    type: med.kind === 'regimen' ? ITEM_TYPES.ONKO : ITEM_TYPES.LEK,
    name: draft.name.trim(),
    strength: draft.strength.trim(),
    dosage: draft.dosage,
    since: draft.since,
    prescriber: draft.prescriber,
    source: med.source,
    sources: med.sources ?? [med.source],
    note_style: med.note_style ?? null,
    kind: med.kind ?? 'drug',
    active_substance: draft.active_substance,
    form: draft.form,
    catalog_id: draft.product?.id ?? null,
  };
}
