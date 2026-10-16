// Instalace na plochu (PWA) – zjištění zařízení a zachycení systémové nabídky.
//
// Chrome / Edge / Samsung na Androidu pošlou událost "beforeinstallprompt"
// klidně ještě před vykreslením Reactu. Proto ji chytáme hned při načtení
// tohoto souboru (importuje ho main.jsx) a schováme si ji na později.
// iPhone tuhle událost nezná – tam ukážeme návod přes tlačítko Sdílet.
import { useSyncExternalStore } from 'react';

let deferredPrompt = null; // uložená nabídka "Nainstalovat aplikaci"
let installed = false; // Android hlásí dokončenou instalaci (appinstalled)
let snapshot = { canPrompt: false, installed: false };
const listeners = new Set();

function emit() {
  snapshot = { canPrompt: !!deferredPrompt, installed };
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Zabráníme vlastnímu banneru prohlížeče – nabídku otevře naše tlačítko.
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

/** iPhone / iPad (iPadOS se hlásí jako Mac, pozná se podle dotyku). */
export function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Telefon nebo tablet – tam appku chceme jen z plochy. */
export function isMobile() {
  return isIOS() || /Android|Mobi/i.test(navigator.userAgent);
}

/** Appka už běží z plochy (ne v prohlížeči). */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

/** Otevře systémovou nabídku instalace. Vrací true, když ji pacient potvrdil. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const e = deferredPrompt;
  // Nabídku jde otevřít jen jednou – pak ji prohlížeč případně pošle znovu.
  deferredPrompt = null;
  emit();
  e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === 'accepted';
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Hook: { canPrompt, installed } – překreslí se, když přijde nabídka nebo instalace. */
export function useInstallPrompt() {
  return useSyncExternalStore(subscribe, () => snapshot);
}
