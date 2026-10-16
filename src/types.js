// DATOVÉ TYPY A KONSTANTY – vše na jednom místě.
// Když se změní tvar dat (třeba přijde nové pole z backendu), upravuje se hlavně tady.
//
// Používáme JSDoc komentáře (@typedef): JavaScript je nekontroluje, ale editor
// (VS Code) podle nich napovídá a ukazuje, co má objekt obsahovat.

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
 * @property {'tablets'|'infusion'|'injection'|''} [oncoForm] – jen u onkologické léčby
 * @property {string} [lastDose] – jen u onkologické léčby: datum poslední dávky "2026-10-01"
 */

// ---------------------------------------------------------------
// Odpověď backendu na focení (POST /api/analyze)
// ---------------------------------------------------------------

/**
 * @typedef {Object} FieldBox – obdélník na fotce, odkud AI hodnotu přečetla.
 * Souřadnice jsou POMĚRNÉ (0 až 1), ať nezáleží na velikosti fotky:
 * x = 0.5 znamená "od poloviny šířky fotky".
 * @property {number} x – levý okraj
 * @property {number} y – horní okraj
 * @property {number} w – šířka
 * @property {number} h – výška
 */

/**
 * @typedef {Object} AnalyzedMedication – jeden lék z fotky (tvar podle backendu, docs/api.md)
 * @property {string} id
 * @property {string} kind
 * @property {string} name
 * @property {string|null} active_substance
 * @property {string|null} strength
 * @property {string|null} form
 * @property {string|null} frequency
 * @property {string|null} amount
 * @property {'box'|'note'} source
 * @property {string[]} uncertain_fields – např. ["frequency"]
 * @property {Object<string, FieldBox>} [field_boxes] – TODO(backend): backend zatím
 *   nevrací. Klíče jako u polí: name, strength, frequency, amount. Vrací ho jen mock.
 */

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

/** Popisky polí formuláře (i pro rámečky na fotce). */
export const FORM_FIELD_LABELS = {
  name: 'Název',
  strength: 'Síla',
  dosage: 'Dávkování',
};

// ---------------------------------------------------------------
// Dávkování
// ---------------------------------------------------------------

export const DOSAGE_MODES = {
  SCHEDULE: 'schedule',
  AS_NEEDED: 'as_needed',
  OTHER: 'other',
};

/** Denní doby v pořadí, v jakém se píšou do zápisu 1-0-1-0. */
export const DOSE_TIMES = [
  { key: 'morning', label: 'Ráno', short: 'ráno' },
  { key: 'noon', label: 'Poledne', short: 'v poledne' },
  { key: 'evening', label: 'Večer', short: 'večer' },
  { key: 'night', label: 'Na noc', short: 'na noc' },
];

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
 * Prázdné dávkování → "".
 */
export function dosageText(d) {
  if (!hasDosage(d)) return '';
  if (d.mode === DOSAGE_MODES.AS_NEEDED) return 'podle potřeby';
  if (d.mode === DOSAGE_MODES.OTHER) return d.text.trim();
  return DOSE_TIMES.filter((t) => d[t.key] > 0)
    .map((t) => `${t.short} ${d[t.key]}`)
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

  if (/podle potřeby|dle potřeby|při bolesti/i.test(freq)) {
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
 * @returns {{ frequency: string|null, amount: string|null }}
 */
export function dosageToBackend(d) {
  if (!hasDosage(d)) return { frequency: null, amount: null };
  if (d.mode === DOSAGE_MODES.SCHEDULE) {
    return { frequency: `${dosageCode(d)} (${dosageText(d)})`, amount: null };
  }
  return { frequency: dosageText(d), amount: null };
}

// ---------------------------------------------------------------
// Kdo předepsal, užívám od
// ---------------------------------------------------------------

export const PRESCRIBERS = [
  { key: 'gp', label: 'Praktický lékař' },
  { key: 'onco', label: 'Onkolog' },
  { key: 'other', label: 'Jiný lékař' },
  { key: 'self', label: 'Sám / sama' },
];

export const MONTHS = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

/** "2024-03" → "březen 2024", "2024" → "2024", "" → "" */
export function sinceText(since) {
  if (!since) return '';
  const [year, month] = since.split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

export function prescriberText(key) {
  return PRESCRIBERS.find((p) => p.key === key)?.label ?? '';
}

// ---------------------------------------------------------------
// Doplňky stravy a bylinky (dlaždice na stránce /doplnky)
// icon = emoji, je jen ozdoba (čtečka ho přeskočí), význam nese text.
// ---------------------------------------------------------------

export const SUPPLEMENTS = [
  { key: 'trezalka', label: 'Třezalka', icon: '🌼' },
  { key: 'kurkuma', label: 'Kurkuma', icon: '🟡' },
  { key: 'grapefruit', label: 'Grapefruit nebo grapefruitový džus', icon: '🍊' },
  { key: 'ostropestrec', label: 'Ostropestřec', icon: '🌿' },
  { key: 'zensen', label: 'Ženšen', icon: '🫚' },
  { key: 'cesnek', label: 'Česnek v tabletách', icon: '🧄' },
  { key: 'zeleny-caj', label: 'Zelený čaj (extrakt)', icon: '🍵' },
  { key: 'vitamin-c', label: 'Vitamín C ve vysokých dávkách', icon: '🍋' },
  { key: 'vitamin-d', label: 'Vitamín D', icon: '☀️' },
  { key: 'omega-3', label: 'Omega-3', icon: '🐟' },
  { key: 'probiotika', label: 'Probiotika', icon: '🥛' },
  { key: 'cbd', label: 'CBD', icon: '🍃' },
];

// ---------------------------------------------------------------
// Onkologická léčba
// ---------------------------------------------------------------

/** Běžné názvy pro našeptávání (pacient může napsat i cokoli jiného). */
export const ONCO_SUGGESTIONS = [
  'kapecitabin',
  'tamoxifen',
  'letrozol',
  'anastrozol',
  'imatinib',
  'pembrolizumab',
  'nivolumab',
  'chemoterapie – nevím název',
];

export const ONCO_FORMS = [
  { key: 'tablets', label: 'Tablety' },
  { key: 'infusion', label: 'Infuze v nemocnici' },
  { key: 'injection', label: 'Injekce' },
];

/** Odpovědi na otázku "Léčíte se na onkologii?" */
export const ONCO_ANSWERS = [
  { key: 'ano', label: 'Ano' },
  { key: 'ne', label: 'Ne' },
  { key: 'nechci', label: 'Nechci uvádět' },
];

export function oncoFormText(key) {
  return ONCO_FORMS.find((f) => f.key === key)?.label ?? '';
}

/** "2026-10-01" → "1. 10. 2026" */
export function dateText(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${Number(d)}. ${Number(m)}. ${y}`;
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
 * @property {boolean} supplementsAsked – už jsme se ptali na doplňky?
 * @property {''|'ano'|'ne'|'nechci'} onco – "Léčíte se na onkologii?" ('' = zatím neodpověděl)
 */
export const EMPTY_PROFILE = { supplementsAsked: false, onco: '' };

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
