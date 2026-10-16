// Pomocné funkce pro přístupnost:
//   1) velikost písma (uložená v localStorage)
//   2) čtení nahlas (Web Speech API – speechSynthesis)
//   3) hlasové zadání (Web Speech API – SpeechRecognition)

import { getLang, localeOf, t } from './i18n/index.js';

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

/** Umí prohlížeč číst nahlas? */
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Přečte text v jazyce appky. Vrátí objekt "promluvy", abychom věděli, kdy skončila.
 * Když v zařízení není hlas pro daný jazyk, prohlížeč použije výchozí hlas
 * (jazyk to ale pořád zkusí díky lang, např. 'cs-CZ').
 */
export function speak(text) {
  window.speechSynthesis.cancel(); // případné předchozí čtení zastavíme
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = localeOf();
  utterance.rate = 0.9; // o kousek pomaleji – lépe se poslouchá
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(getLang()));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel();
}

// ---------------------------------------------------------------
// 3) Hlasové zadání
// ---------------------------------------------------------------

// Chrome a Safari mají rozpoznávání řeči pod názvem s předponou "webkit".
// POZOR: Chrome posílá nahraný zvuk ke zpracování na servery Googlu.
const Recognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

/** Umí prohlížeč hlasové zadání? Když ne, tlačítko mikrofonu se vůbec neukáže. */
export const canListen = Boolean(Recognition);

/**
 * Spustí poslech jedné věty v jazyce appky.
 * @param {(text: string) => void} onResult – co pacient řekl
 * @param {() => void} onEnd – poslech skončil (s výsledkem i bez)
 * @returns objekt rozpoznávání (jde zastavit přes .stop())
 */
export function listen(onResult, onEnd) {
  const recognition = new Recognition();
  recognition.lang = localeOf();
  recognition.interimResults = false; // chceme až hotovou větu
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => onResult(event.results[0][0].transcript);
  recognition.onend = onEnd;
  recognition.onerror = onEnd;
  recognition.start();
  return recognition;
}
