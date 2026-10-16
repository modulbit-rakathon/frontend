// "Context" = místo, kde držíme data sdílená mezi obrazovkami.
// Tady je to:
//   - seznam položek pacienta (léky, doplňky, onkologická léčba – rozlišené podle `type`),
//   - profil (odpovědi na otázky, např. "Léčíte se na onkologii?").
// Obojí ukládáme do localStorage, takže zůstane i po zavření prohlížeče.
import { createContext, useContext, useEffect, useState } from 'react';
import { findInteractions } from '../mock/interactions.js';
import { EMPTY_PROFILE, normalizeItem } from '../types.js';

const STORAGE_KEY = 'pillgaze-meds';
const PROFILE_KEY = 'pillgaze-profile';

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

  // Pokaždé, když se data změní, uložíme je.
  useEffect(() => save(STORAGE_KEY, meds), [meds]);
  useEffect(() => save(PROFILE_KEY, profile), [profile]);

  // Přidá novou položku na konec seznamu.
  function addMed(med) {
    setMeds((prev) => [...prev, normalizeItem({ ...med, id: makeId() })]);
  }

  // Odebere položku podle ID.
  function removeMed(id) {
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }

  // Změní jen některé údaje v profilu, např. updateProfile({ onco: 'ano' }).
  function updateProfile(changes) {
    setProfile((prev) => ({ ...prev, ...changes }));
  }

  // Interakce spočítáme vždy znovu z aktuálního seznamu léků.
  // (Pacientská část je NEZOBRAZUJE – jsou jen pro lékaře.)
  const interactions = findInteractions(meds);

  return (
    <MedsContext.Provider value={{ meds, addMed, removeMed, interactions, profile, updateProfile }}>
      {children}
    </MedsContext.Provider>
  );
}

// Vlastní "hook": v libovolné komponentě stačí napsat
//   const { meds, addMed } = useMeds();
export function useMeds() {
  return useContext(MedsContext);
}
