// "Context" = místo, kde držíme data sdílená mezi obrazovkami.
// Tady je to:
//   - seznam položek pacienta (léky, doplňky, onkologická léčba – rozlišené podle `type`),
//   - profil (odpovědi na otázky, např. "Léčíte se na onkologii?").
// Obojí ukládáme do localStorage, takže zůstane i po zavření prohlížeče.
//
// Režim pro blízké (viz familyShare.js): když tu někdo vyplňuje léky za jiného
// člověka, `meds` a `profile` ukazují JEHO seznam (uložený zvlášť pod HELPER_KEY).
// Vlastní léky na tomto telefonu tím zůstanou beze změny.
import { createContext, useContext, useEffect, useState } from 'react';
import { findInteractions } from '../mock/interactions.js';
import { EMPTY_PROFILE, normalizeItem } from '../types.js';
import { restoreRemovedItem } from './medsList.js';

const STORAGE_KEY = 'pillgaze-meds';
const PROFILE_KEY = 'pillgaze-profile';
const HELPER_KEY = 'pillgaze-helper';
const UNDO_TIMEOUT_MS = 5000;

const MedsContext = createContext(null);

// Bezpečné čtení z localStorage: když tam nic není, je to rozbité
// nebo localStorage nejde použít, vrátí `fallback`.
function load(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage nemusí být dostupný (např. anonymní okno) – nevadí.
  }
}

// Jednoduché unikátní ID pro každou položku (podle času + náhodné číslo).
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function MedsProvider({ children }) {
  // Při prvním spuštění načteme uložená data.
  // normalizeItem doplní pole, která položky uložené starší verzí appky nemají.
  const [meds, setMeds] = useState(() => load(STORAGE_KEY, []).map(normalizeItem));
  const [profile, setProfile] = useState(() => ({ ...EMPTY_PROFILE, ...load(PROFILE_KEY, {}) }));
  // Režim pro blízké: { name, requestId, meds, profile, base } nebo null
  const [helper, setHelper] = useState(() => load(HELPER_KEY, null));
  const [lastRemoved, setLastRemoved] = useState(null);

  // Pokaždé, když se data změní, uložíme je.
  useEffect(() => save(STORAGE_KEY, meds), [meds]);
  useEffect(() => save(PROFILE_KEY, profile), [profile]);
  useEffect(() => {
    if (helper) save(HELPER_KEY, helper);
    else {
      try {
        localStorage.removeItem(HELPER_KEY);
      } catch {
        // nevadí
      }
    }
  }, [helper]);

  // Nabídka "Vrátit" po odebrání zmizí sama po 5 s (další odebrání odpočet obnoví).
  useEffect(() => {
    if (!lastRemoved) return;
    const timer = setTimeout(() => setLastRemoved(null), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [lastRemoved]);

  // Změna seznamu jde buď do vlastních léků, nebo do léků toho, za koho vyplňujeme.
  function changeMeds(update) {
    if (helper) setHelper((h) => ({ ...h, meds: update(h.meds) }));
    else setMeds(update);
  }

  const activeMeds = helper ? helper.meds : meds;
  const activeProfile = helper ? helper.profile : profile;

  // Přidá novou položku na konec seznamu.
  function addMed(med) {
    changeMeds((prev) => [...prev, normalizeItem({ ...med, id: makeId() })]);
  }

  // Odebere položku podle ID.
  function removeMed(id) {
    const index = activeMeds.findIndex((m) => m.id === id);
    if (index === -1) return;
    setLastRemoved({ item: activeMeds[index], index, fromHelper: Boolean(helper) });
    changeMeds((prev) => prev.filter((m) => m.id !== id));
  }

  // Vrátí poslední odebranou položku na původní místo ve stejném seznamu.
  function undoRemoveMed() {
    if (!lastRemoved) return;
    const { fromHelper, item, index } = lastRemoved;
    const restore = (previous) => restoreRemovedItem(previous, { item, index });
    if (fromHelper) setHelper((h) => (h ? { ...h, meds: restore(h.meds) } : h));
    else setMeds(restore);
    setLastRemoved(null);
  }

  // Přepíše údaje položky (ID zůstává stejné).
  function updateMed(id, changes) {
    changeMeds((prev) => prev.map((m) => (m.id === id ? normalizeItem({ ...m, ...changes, id }) : m)));
  }

  // Změní jen některé údaje v profilu, např. updateProfile({ onco: 'ano' }).
  function updateProfile(changes) {
    if (helper) setHelper((h) => ({ ...h, profile: { ...h.profile, ...changes } }));
    else setProfile((prev) => ({ ...prev, ...changes }));
  }

  // Začne vyplňovat za blízkého (data z odkazu, viz FamilyOpen.jsx).
  function startHelping({ name, requestId, items, onco }) {
    setLastRemoved(null);
    setHelper({
      name,
      requestId,
      meds: items,
      profile: { ...EMPTY_PROFILE, onco: onco ?? '' },
      base: items.map((i) => i.id), // co přišlo v žádosti – podle toho pacient pozná, co se odebralo
    });
  }

  // Ukončí režim pro blízké a smaže rozpracovaný seznam z tohoto zařízení.
  function endHelping() {
    setLastRemoved(null);
    setHelper(null);
  }

  // Import odpovědi od blízkého – VŽDY do vlastních léků (ne do režimu pro blízké).
  // Pacient předem vybral, co chce: add = nové, replace = změněné, remove = ID k odebrání.
  function importShared({ add = [], replace = [], remove = [], onco }) {
    const replaceById = new Map(replace.map((r) => [r.id, r]));
    setMeds((prev) => [
      ...prev.filter((m) => !remove.includes(m.id)).map((m) => (replaceById.has(m.id) ? normalizeItem(replaceById.get(m.id)) : m)),
      ...add.map((m) => normalizeItem({ ...m, id: makeId() })),
    ]);
    if (onco) setProfile((prev) => ({ ...prev, onco }));
  }

  // Interakce spočítáme vždy znovu z aktuálního seznamu léků.
  // (Pacientská část je NEZOBRAZUJE – jsou jen pro lékaře.)
  const interactions = findInteractions(activeMeds);

  return (
    <MedsContext.Provider
      value={{
        meds: activeMeds,
        addMed,
        removeMed,
        lastRemoved,
        undoRemoveMed,
        updateMed,
        interactions,
        profile: activeProfile,
        updateProfile,
        // režim pro blízké
        helper,
        ownMeds: meds,
        ownProfile: profile,
        startHelping,
        endHelping,
        importShared,
      }}
    >
      {children}
    </MedsContext.Provider>
  );
}

// Vlastní "hook": v libovolné komponentě stačí napsat
//   const { meds, addMed } = useMeds();
export function useMeds() {
  return useContext(MedsContext);
}
