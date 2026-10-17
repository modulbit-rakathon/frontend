// DATOVÉ TYPY A KONSTANTY – vše na jednom místě.
// Když se změní tvar dat (třeba přijde nové pole z backendu), upravuje se hlavně tady.
//
// Používáme JSDoc komentáře (@typedef): JavaScript je nekontroluje, ale editor
// (VS Code) podle nich napovídá a ukazuje, co má objekt obsahovat.
//
// Popisky (label, title…) se překládají až při čtení (getter), takže jsou
// vždy v aktuálním jazyce – viz src/i18n/.
import { formatDate, getLang, t, tIn } from './i18n/index.js';

// ---------------------------------------------------------------
// Položka v seznamu (lék, doplněk stravy, onkologická léčba)
// ---------------------------------------------------------------

/** Typ položky – všechno ukládáme do jednoho seznamu a rozlišujeme podle typu. */
export const ITEM_TYPES = {
  LEK: 'lek', // běžný lék
  DOPLNEK: 'doplnek', // doplněk stravy nebo bylinka
  ONKO: 'onko', // onkologická léčba
};

/** Odkud údaje pocházejí (stejné hodnoty jako backend). */
export const SOURCES = {
  BOX: 'box', // fotka krabičky
  NOTE: 'note', // fotka lístku od lékaře
  MANUAL: 'manual', // pacient zadal ručně
};

/**
 * @typedef {Object} Dosage – dávkování
 * @property {'schedule'|'as_needed'|'other'} mode – podle rozpisu / podle potřeby / jinak (text)
 * @property {number} morning – kusů ráno
 * @property {number} noon – kusů v poledne
 * @property {number} evening – kusů večer
 * @property {number} night – kusů na noc
 * @property {string} text – volný text pro mode 'other'
 */

/**
 * @typedef {Object} Item – jedna položka v seznamu pacienta
 * @property {string} id
 * @property {'lek'|'doplnek'|'onko'} type
 * @property {string} name – název (bez síly)
 * @property {string} strength – síla, např. "400 mg"
 * @property {Dosage} dosage
 * @property {string} since – "Užívám od" ve tvaru "2024-03", "2024" nebo ""
 * @property {''|'gp'|'onco'|'other'|'self'} prescriber – kdo předepsal
 * @property {'box'|'note'|'manual'} source
 * @property {string} kind – pro backend: 'drug' nebo 'regimen'
 * @property {string|null} active_substance – účinná látka (od backendu)
 * @property {string|null} form – léková forma (od backendu)
 * @property {string} [supplementKey] – jen u doplňků: klíč dlaždice (viz SUPPLEMENTS)
 * @property {('box'|'note'|'manual')[]} [sources] – všechny zdroje (u léku z lístku i krabičky obojí)
 * @property {'printed'|'handwritten'|null} [note_style] – jen u léku z lístku
 * @property {string|null} [catalog_id] – id přípravku v katalogu (jen pro nás, backendu se neposílá)
 * @property {'tablets'|'infusion'|'injection'|''} [oncoForm] – jen u onkologické léčby
 * @property {string} [lastDose] – jen u onkologické léčby: datum poslední dávky "2026-10-01"
 */

// ---------------------------------------------------------------
// Odpověď backendu na focení (POST /api/analyze)
// ---------------------------------------------------------------

/**
 * @typedef {Object} CatalogProduct – přípravek z katalogu léků na serveru (303 přípravků)
 * @property {string} id – např. "cat_245"
 * @property {string} name – např. "PRESTARIUM NEO" (katalog píše velkými písmeny)
 * @property {string} strength – např. "5 mg"
 * @property {string} form – např. "Potahované tablety"
 * @property {string} active_substance – např. "Perindopril-arginin (perindoprilum argininum)"
 * @property {boolean} [supplement] – je to doplněk stravy?
 * @property {number} [score] – jen u kandidátů: jak dobře sedí (0 až 1)
 * @property {'name'|'prefix'|'substance'|'word'|'fuzzy'} [match] – jen u kandidátů: podle čeho se našel
 */

/**
 * @typedef {Object} CatalogMatch – jak dopadlo hledání léku v katalogu
 * @property {'matched'|'needs_confirmation'|'not_found'} status
 * @property {CatalogProduct} [product] – jen u 'matched': jistá shoda
 * @property {CatalogProduct[]} [candidates] – jen u 'needs_confirmation': max 3, nejlepší první
 */

/**
 * @typedef {Object} Conflict – lístek a krabička říkají něco jiného
 * @property {'name'|'strength'|'frequency'} field
 * @property {{ source: 'box'|'note', value: string }[]} values
 */

/**
 * @typedef {Object} AnalyzedMedication – jeden lék z fotek (tvar podle backendu, docs/api.md v3).
 * Backend už lístky s krabičkami sloučil: stejný lék z obou = jedna položka.
 * @property {string} id
 * @property {'drug'|'regimen'} kind
 * @property {string} name – přesně jak byl přečtený (i s překlepy)
 * @property {string|null} active_substance
 * @property {string|null} strength
 * @property {string|null} form
 * @property {string|null} frequency
 * @property {string|null} amount
 * @property {'box'|'note'} source – nejdůležitější zdroj
 * @property {('box'|'note')[]} sources – všechny fotky, ze kterých lék je
 * @property {'printed'|'handwritten'} [note_style] – jen u lístku: tištěný / psaný rukou
 * @property {string[]} uncertain_fields – např. ["frequency"]
 * @property {Conflict[]} [conflicts]
 * @property {CatalogMatch} [catalog]
 */

/** Stavy párování s katalogem (CatalogMatch.status). */
export const CATALOG_STATUS = {
  MATCHED: 'matched',
  NEEDS_CONFIRMATION: 'needs_confirmation',
  NOT_FOUND: 'not_found',
};

/**
 * Druhy fotek pro POST /api/analyze. `field` = název pole ve formuláři pro backend.
 * (Backend umí ještě 'regimen' = zpráva s onkologickým režimem, zatím ho nefotíme.)
 */
function photoKind(field, extra) {
  return {
    field,
    get title() { return t(`photo.${field}.title`); },
    get add() { return t(`photo.${field}.add`); },
    get upload() { return t(`photo.${field}.upload`); }, // na počítači (průzkumník souborů)
    get hint() { return t(`photo.${field}.hint`); },
    ...extra,
  };
}

export const PHOTO_KINDS = [
  photoKind('note'),
  photoKind('box'),
  // Jen pro pacienty, kteří se léčí na onkologii (profile.onco === 'ano')
  photoKind('regimen', { onco: true }),
];

/** Limity backendu pro jedno odeslání fotek. */
export const PHOTO_LIMITS = {
  maxCount: 10,
  maxBytes: 15 * 1024 * 1024, // 15 MB dohromady
};

/**
 * Pole formuláře, která patří k polím backendu.
 * frequency i amount jsou ve formuláři jedno pole "dávkování".
 */
export const BACKEND_TO_FORM_FIELD = {
  name: 'name',
  strength: 'strength',
  frequency: 'dosage',
  amount: 'dosage',
};

/** Popisky polí formuláře. */
export const FORM_FIELD_LABELS = {
  get name() { return t('field.name'); },
  get strength() { return t('field.strength'); },
  get dosage() { return t('field.dosage'); },
};

// Seznam { key, label } s popiskem přeloženým až při čtení: 'gp' → t('prescriber.gp')
function labelled(prefix, items) {
  return items.map((item) =>
    Object.defineProperty({ ...item }, 'label', { get: () => t(`${prefix}.${item.key}`), enumerable: true }),
  );
}

// ---------------------------------------------------------------
// Dávkování
// ---------------------------------------------------------------

export const DOSAGE_MODES = {
  SCHEDULE: 'schedule',
  AS_NEEDED: 'as_needed',
  OTHER: 'other',
};

/** Denní doby v pořadí, v jakém se píšou do zápisu 1-0-1-0. */
export const DOSE_TIMES = ['morning', 'noon', 'evening', 'night'].map((key) => ({
  key,
  get label() { return t(`dose.${key}`); }, // "Ráno"
  get short() { return t(`dose.${key}.short`); }, // "ráno"
}));

/** Prázdné dávkování (nic nevybráno). @returns {Dosage} */
export function emptyDosage() {
  return { mode: DOSAGE_MODES.SCHEDULE, morning: 0, noon: 0, evening: 0, night: 0, text: '' };
}

/** Je dávkování vyplněné? */
export function hasDosage(d) {
  if (!d) return false;
  if (d.mode === DOSAGE_MODES.AS_NEEDED) return true;
  if (d.mode === DOSAGE_MODES.OTHER) return d.text.trim() !== '';
  return DOSE_TIMES.some((t) => d[t.key] > 0);
}

/** Zápis typu "1-0-1-0" (jen pro mode 'schedule'). */
export function dosageCode(d) {
  return DOSE_TIMES.map((t) => d[t.key]).join('-');
}

/**
 * Čitelný text, např. "ráno 1, večer 1" / "podle potřeby" / "1× týdně".
 * Prázdné dávkování → "". lang = jazyk textu (výchozí aktuální).
 */
export function dosageText(d, lang = getLang()) {
  if (!hasDosage(d)) return '';
  if (d.mode === DOSAGE_MODES.AS_NEEDED) return tIn(lang, 'dosage.asNeeded');
  if (d.mode === DOSAGE_MODES.OTHER) return d.text.trim();
  return DOSE_TIMES.filter((time) => d[time.key] > 0)
    .map((time) => `${tIn(lang, `dose.${time.key}.short`)} ${d[time.key]}`)
    .join(', ');
}

/**
 * Z textu od backendu ("1-0-1-0", "dle potřeby", "3× denně"…) udělá Dosage.
 * Co neumíme rozložit na ráno/poledne/večer, dáme do volného textu.
 * @returns {Dosage}
 */
export function dosageFromText(frequency, amount) {
  const d = emptyDosage();
  const freq = (frequency ?? '').trim();
  const amt = (amount ?? '').trim();

  // "1-0-1" nebo "1-0-1-0" (i s mezerami, i s půlkami jako 0,5)
  const match = freq.match(/^(\d+(?:[.,]\d)?)\s*-\s*(\d+(?:[.,]\d)?)\s*-\s*(\d+(?:[.,]\d)?)(?:\s*-\s*(\d+(?:[.,]\d)?))?$/);
  if (match) {
    const nums = match.slice(1).map((n) => Number((n ?? '0').replace(',', '.')));
    DOSE_TIMES.forEach((t, i) => (d[t.key] = nums[i]));
    return d;
  }

  // Česky i v ostatních jazycích appky (hlasové zadání)
  if (/podle potřeby|dle potřeby|při bolesti|as needed|when needed|if needed|за потреби|при потребі|при болю/i.test(freq)) {
    d.mode = DOSAGE_MODES.AS_NEEDED;
    return d;
  }

  const text = [freq, amt].filter(Boolean).join(', ');
  if (text) {
    d.mode = DOSAGE_MODES.OTHER;
    d.text = text;
  }
  return d;
}

/**
 * Pro backend (/api/share zná jen textová pole frequency a amount).
 * Pro lékaře posíláme vždy česky, ať je appka pacienta v jakémkoli jazyce.
 * @returns {{ frequency: string|null, amount: string|null }}
 */
export function dosageToBackend(d) {
  if (!hasDosage(d)) return { frequency: null, amount: null };
  if (d.mode === DOSAGE_MODES.SCHEDULE) {
    return { frequency: `${dosageCode(d)} (${dosageText(d, 'cs')})`, amount: null };
  }
  return { frequency: dosageText(d, 'cs'), amount: null };
}

// ---------------------------------------------------------------
// Kdo předepsal, užívám od
// ---------------------------------------------------------------

export const PRESCRIBERS = labelled('prescriber', [{ key: 'gp' }, { key: 'onco' }, { key: 'other' }, { key: 'self' }]);

/** Názvy měsíců v aktuálním jazyce: ['leden', 'únor', …] */
export function monthNames() {
  return t('months');
}

/** "2024-03" → "březen 2024", "2024" → "2024", "" → "" */
export function sinceText(since) {
  if (!since) return '';
  const [year, month] = since.split('-');
  return month ? `${monthNames()[Number(month) - 1]} ${year}` : year;
}

export function prescriberText(key) {
  return PRESCRIBERS.find((p) => p.key === key)?.label ?? '';
}

// ---------------------------------------------------------------
// Doplňky stravy a bylinky (dlaždice na stránce /doplnky)
// icon = emoji, je jen ozdoba (čtečka ho přeskočí), význam nese text.
// ---------------------------------------------------------------

export const SUPPLEMENTS = labelled('supplement', [
  { key: 'trezalka', icon: '🌼' },
  { key: 'kurkuma', icon: '🟡' },
  { key: 'grapefruit', icon: '🍊' },
  { key: 'ostropestrec', icon: '🌿' },
  { key: 'zensen', icon: '🫚' },
  { key: 'cesnek', icon: '🧄' },
  { key: 'zeleny-caj', icon: '🍵' },
  { key: 'vitamin-c', icon: '🍋' },
  { key: 'vitamin-d', icon: '☀️' },
  { key: 'omega-3', icon: '🐟' },
  { key: 'probiotika', icon: '🥛' },
  { key: 'cbd', icon: '🍃' },
]);

/** Český název doplňku z dlaždice – tak ho ukládáme a posíláme lékaři. */
export function supplementStoredName(key) {
  return tIn('cs', `supplement.${key}`);
}

/**
 * Název položky pro pacienta: doplněk z dlaždice v aktuálním jazyce,
 * všechno ostatní tak, jak je uložené.
 */
export function itemName(item) {
  return SUPPLEMENTS.some((s) => s.key === item.supplementKey) ? t(`supplement.${item.supplementKey}`) : item.name;
}

// ---------------------------------------------------------------
// Onkologická léčba
// ---------------------------------------------------------------

/** Běžné názvy pro našeptávání (pacient může napsat i cokoli jiného). */
export function oncoSuggestions() {
  return t('onco.suggestions');
}

export const ONCO_FORMS = labelled('oncoForm', [{ key: 'tablets' }, { key: 'infusion' }, { key: 'injection' }]);

/** Odpovědi na otázku "Léčíte se na onkologii?" */
export const ONCO_ANSWERS = labelled('onco.answer', [{ key: 'ano' }, { key: 'ne' }, { key: 'nechci' }]);

/** Forma onkologické léčby jako text. lang = jazyk textu (výchozí aktuální). */
export function oncoFormText(key, lang = getLang()) {
  return ONCO_FORMS.some((f) => f.key === key) ? tIn(lang, `oncoForm.${key}`) : '';
}

/** "2026-10-01" → "1. 10. 2026" (podle jazyka, viz formatDate) */
export function dateText(isoDate, lang = getLang()) {
  return formatDate(isoDate, lang);
}

/** Vybere z celého seznamu jen položky jednoho typu. */
export function itemsOfType(items, type) {
  return items.filter((i) => i.type === type);
}

// ---------------------------------------------------------------
// Profil pacienta (odpovědi na otázky, ne léky)
// ---------------------------------------------------------------

/**
 * @typedef {Object} Profile
 * @property {boolean} extrasAsked – už jsme se po přidání léků ptali na onkologii a doplňky?
 * @property {''|'ano'|'ne'|'nechci'} onco – "Léčíte se na onkologii?" ('' = zatím neodpověděl)
 */
export const EMPTY_PROFILE = { extrasAsked: false, onco: '' };

// ---------------------------------------------------------------
// Převod starých / backendových dat na Item
// ---------------------------------------------------------------

/**
 * Doplní chybějící pole – hodí se pro léky uložené starší verzí appky
 * (měly jen frequency/amount a žádný type).
 * @returns {Item}
 */
export function normalizeItem(raw) {
  // Stará textová pole frequency/amount převedeme na dosage a zahodíme.
  const { frequency, amount, ...rest } = raw;
  return {
    type: ITEM_TYPES.LEK,
    strength: '',
    since: '',
    prescriber: '',
    kind: 'drug',
    active_substance: null,
    form: null,
    ...rest,
    dosage: raw.dosage ?? dosageFromText(frequency, amount),
  };
}
