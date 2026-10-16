// "Context" = místo, kde držíme data sdílená mezi obrazovkami.
// Tady je to seznam léků pacienta. Ukládáme ho i do localStorage,
// takže léky zůstanou uložené i po zavření prohlížeče.
import { createContext, useContext, useEffect, useState } from 'react';
import { findInteractions } from '../mock/interactions.js';

const STORAGE_KEY = 'pillgaze-meds';

const MedsContext = createContext(null);

// Načte léky z localStorage (když tam nic není nebo je to rozbité, vrátí prázdný seznam).
function loadMeds() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Jednoduché unikátní ID pro každý lék (podle času + náhodné číslo).
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function MedsProvider({ children }) {
  // useState(loadMeds) → při prvním spuštění načteme uložené léky.
  const [meds, setMeds] = useState(loadMeds);

  // Pokaždé, když se seznam léků změní, uložíme ho do localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meds));
    } catch {
      // localStorage nemusí být dostupný (např. anonymní okno) – nevadí.
    }
  }, [meds]);

  // Přidá nový lék na konec seznamu.
  function addMed(med) {
    setMeds((prev) => [...prev, { ...med, id: makeId() }]);
  }

  // Odebere lék podle ID.
  function removeMed(id) {
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }

  // Interakce spočítáme vždy znovu z aktuálního seznamu léků.
  const interactions = findInteractions(meds);

  return (
    <MedsContext.Provider value={{ meds, addMed, removeMed, interactions }}>
      {children}
    </MedsContext.Provider>
  );
}

// Vlastní "hook": v libovolné komponentě stačí napsat
//   const { meds, addMed } = useMeds();
export function useMeds() {
  return useContext(MedsContext);
}
