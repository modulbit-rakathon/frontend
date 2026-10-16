// Pomocné funkce pro přístupnost:
//   1) velikost písma (uložená v localStorage)
//   2) čtení nahlas (Web Speech API – speechSynthesis)
//   3) hlasové zadání (Web Speech API – SpeechRecognition)

import { localeOf, t } from './i18n/index.js';

// ---------------------------------------------------------------
// 1) Velikost písma
// ---------------------------------------------------------------

const FONT_KEY = 'pillgaze-font-size';

export const FONT_SIZES = ['normal', 'large', 'xlarge'].map((key) => ({
  key,
  get label() { return t(`font.${key}`); }, // "Normální" / "Velké" / "Extra velké"
}));

/** Přečte uloženou velikost písma ('normal' když nic není nebo localStorage nejde). */
export function loadFontSize() {
  try {
    const saved = localStorage.getItem(FONT_KEY);
    return FONT_SIZES.some((f) => f.key === saved) ? saved : 'normal';
  } catch {
    return 'normal';
  }
}

/**
 * Nastaví velikost písma: zapíše ji na <html data-font="large"> (podle toho
 * zvětší CSS celou aplikaci – viz index.css) a uloží ji.
 */
export function applyFontSize(key) {
  document.documentElement.dataset.font = key;
  try {
    localStorage.setItem(FONT_KEY, key);
  } catch {
    // localStorage nemusí být dostupný – velikost pak platí jen do zavření.
  }
}

// ---------------------------------------------------------------
// 2) Čtení nahlas
// ---------------------------------------------------------------
// Prohlížeče se tu dost liší, proto:
//   - hlasy se načítají až po chvíli (událost 'voiceschanged', Safari ji
//     nemusí poslat vůbec) → hlas hledáme až při čtení, jinak stačí lang,
//   - Chrome uřízne dlouhé čtení po ~15 s → text dělíme na věty,
//   - iOS Safari čte jen když speak() zavoláme hned v kliknutí → nic nečekáme,
//   - Android občas nepošle 'end' → hlídáme konec i sami (watchdog),
//   - zastavení posílá chybu 'interrupted'/'canceled' → to není chyba.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

/** Umí prohlížeč číst nahlas? */
export const canSpeak = Boolean(synth) && typeof window.SpeechSynthesisUtterance === 'function';

let voices = [];

function loadVoices() {
  try {
    voices = synth.getVoices() || [];
  } catch {
    voices = [];
  }
}

if (canSpeak) {
  loadVoices();
  if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
  else synth.onvoiceschanged = loadVoices;
  // Při zavření / obnovení stránky čtení ukončíme (Chrome jinak čte dál).
  window.addEventListener('pagehide', () => stopSpeaking());
}

// 'cs_CZ' (Android) i 'cs-CZ' → 'cs-cz'
const normLang = (lang) => String(lang || '').replace('_', '-').toLowerCase();

/** Najde nejlepší hlas pro jazyk: přesná shoda > stejný jazyk; offline hlas má přednost. */
function pickVoice(lang) {
  if (!voices.length) loadVoices();
  const want = normLang(lang);
  const prefix = want.split('-')[0];
  let best = null;
  let bestScore = 0;
  for (const v of voices) {
    const l = normLang(v.lang);
    let score = 0;
    if (l === want) score = 4;
    else if (l.split('-')[0] === prefix) score = 2;
    if (!score) continue;
    if (v.localService) score += 1; // offline hlas: funguje bez sítě a nemá limit 15 s
    if (v.default) score += 0.5;
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Je v zařízení hlas pro daný jazyk?
 * true / false, nebo null když seznam hlasů ještě (nebo vůbec) nemáme.
 */
export function hasVoiceFor(lang = localeOf()) {
  if (!canSpeak) return false;
  if (!voices.length) loadVoices();
  if (!voices.length) return null;
  return Boolean(pickVoice(lang));
}

/** Rozdělí text na kousky do ~max znaků (po větách, pak po čárkách, pak po slovech). */
export function splitText(text, max = 180) {
  // Konec věty = . ! ? ; a mezera. Tečku za číslicí ("2.5 mg", "1. 3.") nebereme.
  // (Bez lookbehind v regexu – starší iOS Safari ho neumí.)
  const clean = String(text).replace(/\s+/g, ' ').trim();
  const sentences = [];
  let start = 0;
  for (let i = 0; i < clean.length - 1; i++) {
    const ch = clean[i];
    if (clean[i + 1] !== ' ' || !'.!?;'.includes(ch)) continue;
    if (ch === '.' && /\d/.test(clean[i - 1] || '')) continue;
    sentences.push(clean.slice(start, i + 1));
    start = i + 2;
  }
  if (start < clean.length) sentences.push(clean.slice(start));
  const chunks = [];
  for (const sentence of sentences) {
    let rest = sentence.trim();
    while (rest.length > max) {
      // zkusíme říznout za čárkou, jinak za mezerou
      let cut = rest.lastIndexOf(', ', max);
      if (cut < max / 3) cut = rest.lastIndexOf(' ', max);
      if (cut < max / 3) cut = max;
      chunks.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) chunks.push(rest);
  }
  return chunks;
}

// Aktuální čtení – v celé aplikaci najednou čte vždy jen jedno.
let current = null;

function finish(session, error) {
  if (current !== session) return;
  current = null;
  clearInterval(session.timer);
  if (error) session.onError?.(error);
  else session.onEnd?.();
}

/**
 * Přečte text (výchozí je jazyk appky). Předchozí čtení zastaví.
 * @param {string} text
 * @param {{ lang?: string, onEnd?: () => void, onError?: (code: string) => void }} options
 *   onEnd – dočteno nebo zastaveno; onError – čtení se nepovedlo (kód chyby)
 * @returns funkce, která zastaví právě toto čtení
 */
export function speak(text, { lang = localeOf(), onEnd, onError } = {}) {
  stopSpeaking();
  const chunks = splitText(text);
  const session = { onEnd, onError, started: false, idle: 0, utterances: [] };
  if (!canSpeak || !chunks.length) {
    onEnd?.();
    return () => {};
  }
  current = session;

  const voice = pickVoice(lang);
  chunks.forEach((chunk, index) => {
    const u = new window.SpeechSynthesisUtterance(chunk);
    u.lang = voice ? voice.lang : lang; // bez hlasu pořád pomůže aspoň lang
    if (voice) u.voice = voice;
    u.rate = 0.9; // o kousek pomaleji – lépe se poslouchá
    u.onstart = () => {
      session.started = true;
    };
    u.onerror = (event) => {
      // vlastní zastavení není chyba
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      if (current !== session) return; // chyba starého čtení
      try {
        synth.cancel(); // zbytek fronty už nečteme
      } catch {
        // nic
      }
      finish(session, event.error || 'unknown');
    };
    if (index === chunks.length - 1) u.onend = () => finish(session);
    // Odkazy si držíme, jinak je Chrome uklidí a 'end' nepřijde.
    session.utterances.push(u);
  });

  try {
    // Chrome občas zůstane "zaseknutý" v pauze → nejdřív resume()
    if (synth.paused) synth.resume();
    // iOS: všechny kousky do fronty hned teď, ještě v rámci kliknutí
    session.utterances.forEach((u) => synth.speak(u));
  } catch {
    finish(session, 'unknown');
    return () => {};
  }

  // Hlídač: konec, když 'end' nepřijde (Android), a nic, když čtení vůbec nezačne (bez hlasů).
  const startedAt = Date.now();
  session.timer = setInterval(() => {
    if (current !== session) return clearInterval(session.timer);
    if (synth.paused) synth.resume(); // Chrome: zaseknutá pauza
    const busy = synth.speaking || synth.pending;
    if (!session.started && !busy && Date.now() - startedAt > 3000) {
      finish(session, 'no-voice');
      return;
    }
    // dvakrát po sobě nic nečte → hotovo
    session.idle = session.started && !busy ? session.idle + 1 : 0;
    if (session.idle >= 2) finish(session);
  }, 700);

  return () => {
    if (current === session) stopSpeaking();
  };
}

/** Zastaví čtení (kdekoli v aplikaci). */
export function stopSpeaking() {
  if (!canSpeak) return;
  const session = current;
  try {
    synth.cancel();
  } catch {
    // nic
  }
  if (session) finish(session);
}

// ---------------------------------------------------------------
// 3) Hlasové zadání
// ---------------------------------------------------------------

// Chrome a Safari mají rozpoznávání řeči pod názvem s předponou "webkit".
// Firefox ho nemá vůbec → tlačítko mikrofonu se neukáže.
// POZOR: Chrome posílá nahraný zvuk ke zpracování na servery Googlu (offline nejde).
const Recognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

/** Umí prohlížeč hlasové zadání? Když ne, tlačítko mikrofonu se vůbec neukáže. */
export const canListen = Boolean(Recognition);

/**
 * Spustí poslech jedné věty (výchozí je jazyk appky).
 * @param {(text: string) => void} onResult – co pacient řekl
 * @param {(error?: string) => void} onEnd – poslech skončil; při chybě s kódem chyby
 * @param {string} lang
 * @returns objekt rozpoznávání (jde zastavit přes .stop() / .abort())
 */
export function listen(onResult, onEnd, lang = localeOf()) {
  stopSpeaking(); // ať mikrofon neslyší naše vlastní čtení
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.interimResults = false; // chceme až hotovou větu
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let error;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    onEnd(error);
  };
  recognition.onresult = (event) => {
    const text = event.results?.[0]?.[0]?.transcript?.trim();
    if (text) onResult(text);
  };
  recognition.onerror = (event) => {
    // 'aborted' = zastavili jsme sami
    if (event.error !== 'aborted') error = event.error || 'unknown';
  };
  recognition.onend = end;
  try {
    recognition.start();
  } catch {
    error = 'unknown';
    end();
  }
  return recognition;
}
