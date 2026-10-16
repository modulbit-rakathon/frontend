// Překlady appky – vlastní malý modul, bez knihovny.
//
// Jazyky: čeština (výchozí), angličtina, ukrajinština. Texty jsou v souborech
// cs.js / en.js / uk.js pod stejnými klíči, např. 'home.greeting'.
//
// Použití v komponentě:
//   import { t } from '../i18n/index.js';
//   <h1>{t('home.greeting')}</h1>
//   t('scan.counter', { count: 3, max: 10 })        → "Fotky: 3 z 10"
//   t('count.meds', { count: 5 })                   → "5 léků" (správný tvar podle počtu)
//
// Celá appka se po změně jazyka překreslí, protože App.jsx volá useLang().
// Když text v jazyce chybí, použije se čeština.
import { createElement, Fragment, useSyncExternalStore } from 'react';
import cs from './cs.js';
import en from './en.js';
import uk from './uk.js';

/** Nabízené jazyky. name = název jazyka v tom jazyce (aby ho každý poznal). */
export const LANGUAGES = [
  { key: 'cs', name: 'Čeština', locale: 'cs-CZ' },
  { key: 'en', name: 'English', locale: 'en-GB' },
  { key: 'uk', name: 'Українська', locale: 'uk-UA' },
];

const DICTS = { cs, en, uk };
const DEFAULT_LANG = 'cs';
const LANG_KEY = 'pillgaze-lang';

// Při první návštěvě zkusíme jazyk prohlížeče. Kdo má v prohlížeči
// češtinu (nebo slovenštinu) kdekoli v seznamu, dostane češtinu.
function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (DICTS[saved]) return saved;
  } catch {
    // localStorage nemusí být dostupný – pokračujeme podle prohlížeče
  }
  if (typeof navigator === 'undefined') return DEFAULT_LANG;
  const prefs = (navigator.languages?.length ? navigator.languages : [navigator.language])
    .filter(Boolean)
    .map((l) => l.slice(0, 2).toLowerCase());
  if (prefs.some((l) => l === 'cs' || l === 'sk')) return 'cs';
  return prefs.find((l) => DICTS[l]) ?? DEFAULT_LANG;
}

let current = detectLang();
const listeners = new Set();

/** Aktuální jazyk ('cs' | 'en' | 'uk'). */
export function getLang() {
  return current;
}

/** Kód pro prohlížeč (datum, čísla, čtení nahlas), např. 'cs-CZ'. */
export function localeOf(lang = current) {
  return LANGUAGES.find((l) => l.key === lang)?.locale ?? 'cs-CZ';
}

/**
 * Zapíše jazyk do stránky: <html lang>, popis stránky.
 * Volá se hned při startu (main.jsx) a po každé změně jazyka.
 */
export function applyLang() {
  document.documentElement.lang = current;
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
}

/** Přepne jazyk, uloží ho a překreslí appku. */
export function setLang(lang) {
  if (!DICTS[lang] || lang === current) return;
  current = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // localStorage nemusí být dostupný – jazyk pak platí jen do zavření.
  }
  applyLang();
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Hook: vrátí aktuální jazyk a komponentu překreslí, když se změní. */
export function useLang() {
  return useSyncExternalStore(subscribe, getLang);
}

/**
 * Text v zadaném jazyce. Hodnota ve slovníku může být:
 *   - text s {proměnnými},
 *   - objekt s tvary podle počtu { one, few, many, other } (Intl.PluralRules) – vyžaduje params.count,
 *   - pole (např. názvy měsíců) – vrátí se celé.
 */
export function tIn(lang, key, params) {
  let value = DICTS[lang]?.[key] ?? DICTS[DEFAULT_LANG][key];
  if (value === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] chybí text: ${key}`);
    return key;
  }
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    const form = new Intl.PluralRules(localeOf(lang)).select(params?.count ?? 0);
    value = value[form] ?? value.other;
  }
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) => (params[name] ?? match).toString());
}

/** Text v aktuálním jazyce – viz tIn. */
export function t(key, params) {
  return tIn(current, key, params);
}

/**
 * Jako t(), ale za {proměnné} jde dosadit i kus JSX (např. <strong>).
 * Vrací pole, které jde rovnou vložit do JSX.
 *   tRich('pin.expiry', { time: <strong>2:41</strong> })
 */
export function tRich(key, parts) {
  const text = t(key);
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const name = piece.match(/^\{(\w+)\}$/)?.[1];
    const content = name && parts[name] !== undefined ? parts[name] : piece;
    return createElement(Fragment, { key: i }, content);
  });
}

/** Datum "2026-10-01" → "1. 10. 2026" / "01/10/2026" / "01.10.2026". */
export function formatDate(isoDate, lang = current) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(localeOf(lang)).format(new Date(y, (m || 1) - 1, d || 1));
}

/** Číslo podle jazyka, např. 3,4 v češtině / 3.4 v angličtině. */
export function formatNumber(value, options, lang = current) {
  return new Intl.NumberFormat(localeOf(lang), options).format(value);
}

/** Seznam jako věta: ["A", "B", "C"] → "A, B a C" / "A, B and C" / "A, B і C". */
export function joinList(items, lang = current) {
  if (typeof Intl.ListFormat !== 'function') return items.join(', ');
  return new Intl.ListFormat(localeOf(lang), { type: 'conjunction' }).format(items);
}
