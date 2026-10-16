// Pomocné funkce pro přístupnost:
//   1) velikost písma (uložená v localStorage)
//   2) čtení nahlas (Web Speech API – speechSynthesis)
//   3) hlasové zadání (Web Speech API – SpeechRecognition)

// ---------------------------------------------------------------
// 1) Velikost písma
// ---------------------------------------------------------------

const FONT_KEY = 'pillgaze-font-size';

export const FONT_SIZES = [
  { key: 'normal', label: 'Normální' },
  { key: 'large', label: 'Velké' },
  { key: 'xlarge', label: 'Extra velké' },
];

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
 * Přečte text česky. Vrátí objekt "promluvy", abychom věděli, kdy skončila.
 * Když v zařízení není český hlas, prohlížeč použije výchozí hlas
 * (česky to ale pořád zkusí díky lang = 'cs-CZ').
 */
export function speak(text) {
  window.speechSynthesis.cancel(); // případné předchozí čtení zastavíme
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'cs-CZ';
  utterance.rate = 0.9; // o kousek pomaleji – lépe se poslouchá
  const czechVoice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('cs'));
  if (czechVoice) utterance.voice = czechVoice;
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
 * Spustí poslech jedné věty v češtině.
 * @param {(text: string) => void} onResult – co pacient řekl
 * @param {() => void} onEnd – poslech skončil (s výsledkem i bez)
 * @returns objekt rozpoznávání (jde zastavit přes .stop())
 */
export function listen(onResult, onEnd) {
  const recognition = new Recognition();
  recognition.lang = 'cs-CZ';
  recognition.interimResults = false; // chceme až hotovou větu
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => onResult(event.results[0][0].transcript);
  recognition.onend = onEnd;
  recognition.onerror = onEnd;
  recognition.start();
  return recognition;
}
