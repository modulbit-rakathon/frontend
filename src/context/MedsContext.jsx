import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { findInteractions } from '../mock/interactions.js';
import { makeId } from '../core.js';
import {
  STORAGE_KEY, LEGACY_STORAGE_KEY, emptyState, readState, validateState,
  appendAnalysis, unreadableCount,
} from '../medicationStore.js';

const MedsContext = createContext(null);

function load() {
  try {
    return { state: readState(localStorage), raw: localStorage.getItem(STORAGE_KEY), error: '' };
  } catch {
    return { state: emptyState(), raw: null, error: 'Uložená data nelze načíst. Nebyla smazána ani přepsána.' };
  }
}

export function MedsProvider({ children }) {
  const [loaded, setLoaded] = useState(load);
  const latest = useRef(loaded);
  const [storageError, setStorageError] = useState('');

  function replace(next) {
    latest.current = next;
    setLoaded(next);
  }

  useEffect(() => {
    const changed = event => {
      if (event.key === STORAGE_KEY || event.key === null) replace(load());
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);

  function commit(next) {
    if (latest.current.error) throw new Error(latest.current.error);
    try {
      if (localStorage.getItem(STORAGE_KEY) !== latest.current.raw) {
        replace(load());
        throw new Error('Seznam se změnil v jiném okně. Zkontrolujte jej a zopakujte úpravu.');
      }
      validateState(next);
      const raw = JSON.stringify(next);
      localStorage.setItem(STORAGE_KEY, raw);
      replace({ state: next, raw, error: '' });
      setStorageError('');
    } catch (error) {
      const message = error.name === 'QuotaExceededError'
        ? 'Úložiště je plné. Změna se neuložila; uvolněte místo a zkuste to znovu.'
        : error.name === 'SecurityError'
          ? 'Prohlížeč nepovoluje ukládání. Změna se neuložila.'
          : error.message;
      setStorageError(message);
      throw new Error(message, { cause: error });
    }
  }

  function addMed(med) {
    const saved = { ...med, id: makeId() };
    commit({ ...latest.current.state, medications: [...latest.current.state.medications, saved] });
    return saved;
  }

  function addAnalysis(result) {
    const next = appendAnalysis(latest.current.state, result);
    commit(next.state);
    return next.medications;
  }

  function updateMed(med, original) {
    const state = latest.current.state;
    const existing = state.medications.find(item => item.id === med.id);
    if (!existing) {
      throw new Error('Tento záznam už není v seznamu. Načtěte aktuální seznam znovu.');
    }
    if (!original || JSON.stringify(existing) !== JSON.stringify(original)) {
      throw new Error('Záznam se změnil v jiném okně. Vraťte se do seznamu a otevřete jeho aktuální podobu.');
    }
    commit({ ...state, medications: state.medications.map(item => item.id === med.id ? med : item) });
  }

  function removeMed(id) {
    const state = latest.current.state;
    commit({ ...state, medications: state.medications.filter(med => med.id !== id) });
  }

  function replaceMerged(med, originals) {
    const state = latest.current.state;
    if (originals.length < 2 || originals.some(original =>
      JSON.stringify(state.medications.find(item => item.id === original.id)) !== JSON.stringify(original))) {
      throw new Error('Některý původní záznam se změnil. Vyberte skupinu znovu.');
    }
    const ids = new Set(originals.map(original => original.id));
    commit({ ...state, medications: [...state.medications.filter(item => !ids.has(item.id)), med] });
  }

  function resolveAnalysis(id) {
    const state = latest.current.state;
    commit({ ...state, analyses: state.analyses.map(item => item.id === id ? { ...item, resolved: true } : item) });
  }

  function resetStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      replace(load());
      setStorageError('');
    } catch {
      setStorageError('Data nelze smazat. Povolte úložiště v nastavení prohlížeče.');
    }
  }

  const { medications: meds, analyses } = loaded.state;
  const interactions = findInteractions(meds);
  return (
    <MedsContext.Provider value={{
      meds, analyses, unreadableCount: unreadableCount(loaded.state),
      addMed, addAnalysis, updateMed, removeMed, replaceMerged, resolveAnalysis, interactions,
      storageError: loaded.error || storageError, resetStorage,
    }}>
      {children}
    </MedsContext.Provider>
  );
}

export function useMeds() {
  return useContext(MedsContext);
}
