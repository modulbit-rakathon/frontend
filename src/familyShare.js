// REŽIM PRO BLÍZKÉ – sdílení seznamu léků odkazem (bez backendu).
//
// Jak to funguje:
//   1) Pacient vytvoří "žádost" (t: 'req') – odkaz, který otevře appku v režimu pro blízké.
//      Volitelně v něm pošle i svůj současný seznam.
//   2) Blízký léky vyplní na svém telefonu (jeho vlastní data zůstanou beze změny)
//      a vytvoří "odpověď" (t: 'res') – odkaz zpět.
//   3) Pacient odkaz otevře, uvidí, co je nové / změněné, a sám potvrdí uložení.
//
// Data jsou v odkazu ZA KŘÍŽKEM (#…), ne v ?dotazu. Část za # prohlížeč
// nikdy neposílá na server, takže se léky nedostanou do logů serveru.
//
// Tvar odkazu:  https://…/pomoc#d=1z.<base64url>
//   "1"  = verze formátu
//   "z"  = zkomprimované (deflate-raw), "j" = jen JSON (prohlížeč bez CompressionStream)
//
// Tento soubor nesahá na React – jde vyzkoušet i v Node (localStorage jen v rememberLink/hasLink).
import { ITEM_TYPES, normalizeItem } from './types.js';

export const SHARE_VERSION = 1;
export const SHARE_PATH = '/pomoc';

// Delší odkaz už některé aplikace na zprávy zkrátí nebo rozbijí.
export const MAX_LINK_LENGTH = 8000;
// Delší odkaz už v QR kódu telefon z obrazovky špatně načte.
export const MAX_QR_LENGTH = 1200;
// Odkaz starší než tohle označíme jako starý (ale otevřít jde).
export const OLD_AFTER_DAYS = 30;

// Pole položky, která do odkazu posíláme. Nic jiného z odkazu nepřijmeme.
const ITEM_FIELDS = [
  'id', 'type', 'name', 'strength', 'dosage', 'since', 'prescriber', 'source', 'sources',
  'note_style', 'kind', 'active_substance', 'form', 'catalog_id', 'supplementKey', 'oncoForm', 'lastDose',
];
const ONCO_KEYS = ['', 'ano', 'ne', 'nechci'];

// Náhodné ID odkazu (žádost i odpověď mají vlastní).
export function makeShareId() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------
// Převod položek do odkazu a zpět
// ---------------------------------------------------------------

// Je hodnota "prázdná"? Prázdné hodnoty do odkazu nedáváme (kratší odkaz).
function isEmpty(value) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

// Položka → malý objekt do odkazu (jen známá pole, bez prázdných hodnot).
function packItem(item) {
  const out = {};
  for (const key of ITEM_FIELDS) {
    if (!isEmpty(item[key])) out[key] = item[key];
  }
  return out;
}

// Text z odkazu: jen řetězec, oříznutý na rozumnou délku.
function cleanText(value, max = 200) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

// Dávkování z odkazu: jen čísla a text, nic jiného.
function cleanDosage(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const num = (n) => (Number.isFinite(n) && n >= 0 && n <= 20 ? n : 0);
  return {
    mode: ['schedule', 'as_needed', 'other'].includes(raw.mode) ? raw.mode : 'schedule',
    morning: num(raw.morning),
    noon: num(raw.noon),
    evening: num(raw.evening),
    night: num(raw.night),
    text: cleanText(raw.text),
  };
}

// Položka z odkazu → Item. Neplatnou položku (bez názvu…) vrátí jako null.
function unpackItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name).trim();
  if (!name || !Object.values(ITEM_TYPES).includes(raw.type)) return null;

  const item = {};
  for (const key of ITEM_FIELDS) {
    if (key === 'dosage' || key === 'sources') continue;
    if (typeof raw[key] === 'string') item[key] = cleanText(raw[key]);
  }
  item.name = name;
  item.dosage = cleanDosage(raw.dosage);
  if (Array.isArray(raw.sources)) item.sources = raw.sources.filter((s) => ['box', 'note', 'manual'].includes(s));
  if (!['box', 'note', 'manual'].includes(item.source)) item.source = 'manual';
  return normalizeItem(item);
}

// ---------------------------------------------------------------
// Komprese a base64url
// ---------------------------------------------------------------

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// Prožene bajty přes CompressionStream / DecompressionStream.
async function pipe(bytes, stream) {
  const response = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== 'undefined';

/**
 * Data → text za "#d=" (např. "1z.eJy…").
 * @param {object} data
 * @param {{ compress?: boolean }} [options] – compress: false = bez komprese (pro testy)
 */
export async function encodeShare(data, { compress = canCompress() } = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  if (compress) {
    return `${SHARE_VERSION}z.${toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
  }
  return `${SHARE_VERSION}j.${toBase64Url(bytes)}`;
}

/**
 * Text za "#d=" → data. Při chybě vyhodí Error s kódem:
 *   'empty' (nic tam není), 'newer' (odkaz z novější verze appky),
 *   'unsupported' (prohlížeč neumí rozbalit), 'invalid' (poškozený / useknutý odkaz).
 */
export async function decodeShare(text) {
  if (!text) throw new Error('empty');
  const match = /^(\d+)([zj])\.([A-Za-z0-9_-]+)$/.exec(text.trim());
  if (!match) throw new Error('invalid');
  const [, version, mode, body] = match;
  if (Number(version) > SHARE_VERSION) throw new Error('newer');
  if (Number(version) !== SHARE_VERSION) throw new Error('invalid');
  if (mode === 'z' && typeof DecompressionStream === 'undefined') throw new Error('unsupported');

  let json;
  try {
    let bytes = fromBase64Url(body);
    if (mode === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    // Useknutý odkaz (např. ho aplikace na zprávy zkrátila) skončí tady.
    throw new Error('invalid');
  }
  return validateShare(json);
}

// Zkontroluje obsah odkazu a vrátí jen to, čemu rozumíme.
function validateShare(json) {
  if (!json || typeof json !== 'object' || !['req', 'res'].includes(json.t)) throw new Error('invalid');
  if (typeof json.id !== 'string' || !json.id) throw new Error('invalid');
  const items = Array.isArray(json.items) ? json.items.slice(0, 200).map(unpackItem).filter(Boolean) : [];
  return {
    t: json.t,
    id: cleanText(json.id, 40),
    rid: cleanText(json.rid, 40),
    name: cleanText(json.n, 60).trim(), // jak se jmenuje pacient
    from: cleanText(json.from, 60).trim(), // jen u odpovědi: kdo vyplňoval
    at: Number.isFinite(json.at) ? json.at : 0, // kdy odkaz vznikl (ms)
    onco: ONCO_KEYS.includes(json.onco) ? json.onco : '',
    items,
    base: Array.isArray(json.base) ? json.base.filter((id) => typeof id === 'string') : [],
  };
}

// ---------------------------------------------------------------
// Vytvoření žádosti / odpovědi
// ---------------------------------------------------------------

/** Žádost pacienta o pomoc. `items` může být prázdné (pacient nechce posílat svůj seznam). */
export function makeRequest({ id, name, items, onco }) {
  return { t: 'req', id, n: name || undefined, at: Date.now(), onco: onco || undefined, items: items.map(packItem) };
}

/**
 * Odpověď blízkého. `base` = ID položek, které přišly v žádosti –
 * podle nich pacient pozná, co blízký odebral.
 */
export function makeResponse({ id, rid, name, from, items, onco, base }) {
  return {
    t: 'res', id, rid, n: name || undefined, from: from || undefined, at: Date.now(),
    onco: onco || undefined, items: items.map(packItem), base,
  };
}

/** Celý odkaz. */
export function shareUrl(origin, encoded) {
  return `${origin}${SHARE_PATH}#d=${encoded}`;
}

/** Z části adresy za # vytáhne zakódovaná data ("#d=1z.…" → "1z.…"). */
export function readHash(hash) {
  return new URLSearchParams((hash || '').replace(/^#/, '')).get('d') ?? '';
}

/** Je odkaz starší než OLD_AFTER_DAYS? */
export function isOld(share, now = Date.now()) {
  return share.at > 0 && now - share.at > OLD_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------
// Porovnání odpovědi s vlastním seznamem pacienta
// ---------------------------------------------------------------

// Klíč pro hledání duplicit: typ + název + síla, bez velkých písmen a mezer navíc.
function sameKey(item) {
  const norm = (s) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${item.type}|${norm(item.name)}|${norm(item.strength)}`;
}

// Liší se položky v něčem, co pacient vidí?
const COMPARE_FIELDS = ['type', 'name', 'strength', 'dosage', 'since', 'prescriber', 'oncoForm', 'lastDose'];
function isChanged(a, b) {
  return COMPARE_FIELDS.some((key) => JSON.stringify(a[key] ?? '') !== JSON.stringify(b[key] ?? ''));
}

/**
 * Co se po importu změní. Nic se nepřepisuje potichu – pacient vybírá.
 * @param {Array} own – současný seznam pacienta
 * @param {object} share – dekódovaná odpověď (decodeShare)
 * @returns {{ added: Array, changed: Array<{ before: object, after: object }>,
 *   removed: Array, duplicates: Array, unchanged: number }}
 */
export function diffShare(own, share) {
  const ownById = new Map(own.map((m) => [m.id, m]));
  const ownKeys = new Set(own.map(sameKey));
  const result = { added: [], changed: [], removed: [], duplicates: [], unchanged: 0 };
  const seenKeys = new Set();

  for (const item of share.items) {
    const mine = ownById.get(item.id);
    if (mine) {
      // Položka, která přišla z pacientova seznamu (stejné ID)
      if (isChanged(mine, item)) result.changed.push({ before: mine, after: item });
      else result.unchanged += 1;
    } else if (ownKeys.has(sameKey(item)) || seenKeys.has(sameKey(item))) {
      // Stejný lék (název + síla) už pacient má, nebo je v odpovědi dvakrát
      result.duplicates.push(item);
    } else {
      result.added.push(item);
    }
    seenKeys.add(sameKey(item));
  }

  // Co bylo v žádosti, pacient to pořád má, ale v odpovědi to chybí = blízký to odebral.
  const inShare = new Set(share.items.map((i) => i.id));
  for (const id of share.base) {
    if (!inShare.has(id) && ownById.has(id)) result.removed.push(ownById.get(id));
  }
  return result;
}

// ---------------------------------------------------------------
// Které odkazy jsme na tomto zařízení vytvořili / použili
// (pozná se tak odkaz otevřený na stejném telefonu nebo použitý podruhé)
// ---------------------------------------------------------------

const LINKS_KEY = 'pillgaze-family-links';

function loadLinks() {
  try {
    return JSON.parse(localStorage.getItem(LINKS_KEY)) ?? {};
  } catch {
    return {};
  }
}

/** Zapamatuje si ID odkazu. kind: 'sent' (vytvořili jsme žádost) nebo 'imported' (odpověď jsme uložili). */
export function rememberLink(kind, id) {
  try {
    const links = loadLinks();
    // Stačí posledních 20 – starší nás nezajímají.
    links[kind] = [id, ...(links[kind] ?? []).filter((x) => x !== id)].slice(0, 20);
    localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  } catch {
    // localStorage nemusí být dostupný – nevadí, jen nepoznáme opakované otevření.
  }
}

export function hasLink(kind, id) {
  return (loadLinks()[kind] ?? []).includes(id);
}
