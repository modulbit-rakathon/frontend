// Obrazovka: Doplňky stravy a bylinky (/doplnky)
//
// Velké dlaždice – klepnutím doplněk zapnete / vypnete.
// Nic nehodnotíme ani nevarujeme, jen sbíráme údaje pro lékaře.
//
// Doplňky ukládáme do stejného seznamu jako léky, jen s type: 'doplnek'.
// Adresa /doplnky?krok=1 = jsme tu jako krok po přidání prvního léku.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { CheckIcon } from '../components/Icons.jsx';
import { ITEM_TYPES, SUPPLEMENTS, emptyDosage, itemsOfType } from '../types.js';

export default function Supplements() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isStep = searchParams.get('krok') === '1';

  const { meds, addMed, removeMed, updateProfile } = useMeds();
  const supplements = itemsOfType(meds, ITEM_TYPES.DOPLNEK);

  const [otherOpen, setOtherOpen] = useState(false); // je otevřené pole "Jiné"?
  const [otherText, setOtherText] = useState('');

  // Jakmile pacient tuhle obrazovku jednou uvidí, už se po přidání léku znovu neptáme.
  useEffect(() => {
    updateProfile({ supplementsAsked: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vytvoří položku doplňku ve stejném tvaru jako lék.
  function makeSupplement(name, supplementKey) {
    return {
      type: ITEM_TYPES.DOPLNEK,
      name,
      supplementKey,
      strength: '',
      dosage: emptyDosage(),
      source: 'manual',
      kind: 'drug',
    };
  }

  // Klepnutí na dlaždici: když doplněk v seznamu je, odebereme ho, jinak přidáme.
  function toggle(supplement) {
    const existing = supplements.find((s) => s.supplementKey === supplement.key);
    if (existing) {
      removeMed(existing.id);
    } else {
      addMed(makeSupplement(supplement.label, supplement.key));
    }
  }

  function addOther(event) {
    event.preventDefault();
    const name = otherText.trim();
    if (!name) return;
    addMed(makeSupplement(name, 'jine'));
    setOtherText('');
  }

  // Vlastní doplňky (zadané přes "Jiné")
  const others = supplements.filter((s) => s.supplementKey === 'jine');

  return (
    <>
      <h1>Berete i něco z tohohle?</h1>
      <p className="subtitle">I bylinky a vitamíny jsou pro lékaře důležité.</p>

      <ul className="tile-grid">
        {SUPPLEMENTS.map((s) => {
          const isOn = supplements.some((i) => i.supplementKey === s.key);
          return (
            <li key={s.key}>
              <button
                type="button"
                className={isOn ? 'tile tile-on' : 'tile'}
                aria-pressed={isOn}
                onClick={() => toggle(s)}
              >
                <span className="tile-icon" aria-hidden="true">
                  {s.icon}
                </span>
                <span className="tile-label">{s.label}</span>
                {/* Fajfka + text, ať výběr není poznat jen podle barvy */}
                {isOn && (
                  <span className="tile-state">
                    <CheckIcon size={22} /> Beru
                  </span>
                )}
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className={otherOpen ? 'tile tile-on' : 'tile'}
            aria-expanded={otherOpen}
            onClick={() => setOtherOpen(!otherOpen)}
          >
            <span className="tile-icon" aria-hidden="true">
              ➕
            </span>
            <span className="tile-label">Jiné</span>
          </button>
        </li>
      </ul>

      {otherOpen && (
        <form className="other-form" onSubmit={addOther}>
          <label htmlFor="other-supplement">Co dalšího berete?</label>
          <input
            id="other-supplement"
            type="text"
            className="text-input"
            placeholder="např. hořčík, echinacea"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" disabled={!otherText.trim()}>
            Přidat
          </button>
        </form>
      )}

      {others.length > 0 && (
        <ul className="chip-list" aria-label="Další doplňky">
          {others.map((o) => (
            <li key={o.id} className="chip">
              {o.name}
              <button type="button" className="btn-text" onClick={() => removeMed(o.id)}>
                Odebrat<span className="sr-only"> {o.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn btn-primary" onClick={() => navigate('/leky')}>
        {isStep && supplements.length === 0 ? 'Nic z toho neberu' : 'Hotovo'}
      </button>
    </>
  );
}
