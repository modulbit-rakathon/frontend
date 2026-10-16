// Animované přechody mezi obrazovkami (View Transitions API), aby appka
// na mobilu působila jako aplikace. Kde prohlížeč API nemá, stránka se
// přepne normálně bez animace.
//
// Jak to funguje: App nevykresluje stránku podle aktuální adresy, ale podle
// "zobrazené" adresy (shown). Když se adresa změní, sejmeme obrázek staré
// stránky, uvnitř document.startViewTransition překreslíme na novou a CSS
// (index.css, oddíl PŘECHODY) mezi nimi udělá posun. Směr dáváme na <html>
// jako data-nav="forward" | "back".
import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigationType } from 'react-router-dom';

// Pořadí záložek ve spodní liště – podle něj určujeme směr při přepínání.
export const TAB_ORDER = ['/', '/vyfotit', '/leky', '/zprava'];

// Pod kterou záložku patří obrazovky, které v liště nejsou (ostatní = Domů).
const PARENT_TAB = {
  '/pin': '/zprava',
  '/doplnky': '/leky',
  '/onkologie': '/leky',
  '/dalsi': '/leky',
};

function tabIndex(pathname) {
  const i = TAB_ORDER.indexOf(PARENT_TAB[pathname] ?? pathname);
  return i === -1 ? 0 : i;
}

/** Směr při klepnutí na záložku: doprava v pořadí = dopředu, doleva (nebo na
 *  vlastní záložku z podstránky) = zpět. */
export function tabDirection(fromPath, toPath) {
  return tabIndex(toPath) > tabIndex(fromPath) ? 'forward' : 'back';
}

// Nápověda směru pro nejbližší navigaci (tlačítka "Zpět", spodní lišta).
// Platí jen chvilku, aby nezůstala viset, když navigace nakonec neproběhne.
let hint = null;

/** Zavolejte těsně před navigate()/kliknutím na odkaz. */
export function setNavDirection(dir) {
  hint = { dir, at: Date.now() };
}

function takeHint() {
  const h = hint;
  hint = null;
  return h && Date.now() - h.at < 1000 ? h.dir : null;
}

// Pozice scrollu pro každý záznam historie (klíč = location.key, ten
// React Router ukládá do history.state, takže ho při návratu dostaneme zpět).
const scrollMemory = new Map();

// iOS Safari: tah od okraje = zpět/dopředu s vlastní animací prohlížeče.
// Tu naši pak nepouštíme, jinak by se přehrála dvakrát.
const EDGE_PX = 30;
let edgeTouch = false;
let edgeTouchEndedAt = 0;
let skipNextPop = false;

if (typeof window !== 'undefined') {
  // Scroll při návratu obnovujeme sami (až po výměně stránky).
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

  const opts = { capture: true, passive: true };
  window.addEventListener(
    'touchstart',
    (e) => {
      const x = e.touches[0]?.clientX ?? EDGE_PX;
      edgeTouch = x < EDGE_PX || x > window.innerWidth - EDGE_PX;
    },
    opts
  );
  const endTouch = () => {
    if (edgeTouch) edgeTouchEndedAt = Date.now();
    edgeTouch = false;
  };
  window.addEventListener('touchend', endTouch, opts);
  window.addEventListener('touchcancel', endTouch, opts);

  // Registruje se při načtení modulu, tedy dřív než posluchač React Routeru.
  window.addEventListener('popstate', (e) => {
    skipNextPop =
      e.hasUAVisualTransition === true || edgeTouch || Date.now() - edgeTouchEndedAt < 700;
  });
}

const canAnimate = () =>
  typeof document !== 'undefined' &&
  typeof document.startViewTransition === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Náhrada za useLocation() v App: vrací adresu, která se má právě vykreslit,
 * a přechod na novou adresu animuje. Tuto adresu předejte <Routes location>.
 */
export function useTransitionLocation() {
  const location = useLocation();
  const navType = useNavigationType();
  const [shown, setShown] = useState(location);
  const shownRef = useRef(location);
  const latestRef = useRef(location);
  latestRef.current = location;
  const idxRef = useRef(window.history.state?.idx ?? 0);
  const scrollTarget = useRef(null);
  const transitionRef = useRef(null);

  useLayoutEffect(() => {
    const from = shownRef.current;
    if (location.key === from.key) {
      // Rychlé "tam a hned zpět" ještě před výměnou stránky: zůstáváme, kde jsme.
      idxRef.current = window.history.state?.idx ?? 0;
      scrollTarget.current = null;
      return;
    }

    // Dopředu/zpět podle indexu v history.state (React Router ho tam
    // ukládá jako idx). Spolehlivé i při skákání přes historii prohlížeče.
    const idx = window.history.state?.idx ?? 0;
    const prevIdx = idxRef.current;
    idxRef.current = idx;
    const hinted = takeHint();
    const isPop = navType === 'POP';
    const swipe = isPop && skipNextPop;
    skipNextPop = false;
    const dir = isPop ? (idx < prevIdx ? 'back' : 'forward') : hinted ?? 'forward';

    // Jiná obrazovka → nahoru (při návratu na uloženou pozici).
    // Změna jen v ?parametrech (kroky uvnitř obrazovky) scroll nemění, jako dřív.
    const samePage = location.pathname === from.pathname;
    scrollMemory.set(from.key, window.scrollY);
    scrollTarget.current = samePage ? null : isPop ? scrollMemory.get(location.key) ?? 0 : 0;

    // Rozběhnutý přechod ukončíme – při rychlém klikání vždy vyhraje poslední adresa.
    transitionRef.current?.skipTransition();
    transitionRef.current = null;

    if (samePage || swipe || !canAnimate()) {
      shownRef.current = location;
      setShown(location);
      return;
    }

    document.documentElement.dataset.nav = dir;
    const vt = document.startViewTransition(() => {
      const next = latestRef.current;
      shownRef.current = next;
      flushSync(() => setShown(next));
    });
    transitionRef.current = vt;
    // Přeskočený přechod odmítne "ready" – to je v pořádku, nechceme chybu v konzoli.
    vt.ready.catch(() => {});
    vt.finished.finally(() => {
      if (transitionRef.current === vt) transitionRef.current = null;
    });
  }, [location, navType]);

  // Scroll až po vykreslení nové stránky (při přechodu ještě před snímkem nové stránky).
  useLayoutEffect(() => {
    if (scrollTarget.current == null) return;
    window.scrollTo(0, scrollTarget.current);
    scrollTarget.current = null;
  }, [shown]);

  return shown;
}

/**
 * Krok uvnitř jedné obrazovky (beze změny adresy, např. šipka zpět ve focení)
 * se stejnou animací jako přechod mezi obrazovkami.
 * @param {'forward' | 'back'} dir
 * @param {() => void} update – změna stavu, která překreslí obrazovku
 */
export function animateStep(dir, update) {
  if (!canAnimate()) {
    update();
    return;
  }
  document.documentElement.dataset.nav = dir;
  const vt = document.startViewTransition(() => flushSync(update));
  vt.ready.catch(() => {});
}
