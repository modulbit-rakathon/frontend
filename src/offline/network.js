// Jsme připojeni k internetu?
//
// Prohlížeč to hlásí přes navigator.onLine a události "online"/"offline".
// To ale nestačí: telefon může být připojený k Wi-Fi bez internetu
// (čekárna, slabý signál) a navigator.onLine pak lže, že je vše v pořádku.
// Proto si pamatujeme i to, že nám naposledy spadl požadavek na server
// (hlásí api.js), a dokud se to nespraví, zkoušíme občas "zaťukat" na server.
import { useEffect, useState } from 'react';

// Jak často zkusit, jestli už internet zase jde (ms)
const PROBE_MS = 20000;

let fetchFailed = false; // spadl poslední požadavek na server?
let probeTimer = null;
const listeners = new Set();

function browserOnline() {
  // Starší prohlížeče onLine neznají → bereme, že internet je.
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Je teď internet? */
export function isOnline() {
  return browserOnline() && !fetchFailed;
}

function notify() {
  const online = isOnline();
  listeners.forEach((fn) => fn(online));
}

// Zkusí stáhnout malý soubor z vlastního serveru, mimo mezipaměť.
// Přijde jakákoli odpověď (i 404) → spojení funguje.
async function probe() {
  try {
    await fetch(`/manifest.webmanifest?ping=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
    reportNetworkSuccess();
  } catch {
    // pořád nic – zkusíme to za chvíli znovu
  }
}

/** api.js: požadavek na server spadl, protože se nedalo spojit. */
export function reportNetworkFailure() {
  if (!fetchFailed) {
    fetchFailed = true;
    notify();
  }
  if (!probeTimer) probeTimer = setInterval(probe, PROBE_MS);
}

/** api.js: server odpověděl → spojení funguje. */
export function reportNetworkSuccess() {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  if (fetchFailed) {
    fetchFailed = false;
    notify();
  }
}

/** Zavolá `fn(online)` při každé změně. Vrací funkci na odhlášení. */
export function subscribeOnline(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== 'undefined') {
  // Prohlížeč hlásí návrat internetu → zapomeneme starou chybu a hned to ověříme.
  window.addEventListener('online', () => {
    fetchFailed = false;
    notify();
  });
  window.addEventListener('offline', notify);
}

/** Hook: `const online = useOnline();` – překreslí komponentu, když se připojení změní. */
export function useOnline() {
  const [online, setOnline] = useState(isOnline);
  useEffect(() => {
    setOnline(isOnline());
    return subscribeOnline(setOnline);
  }, []);
  return online;
}
