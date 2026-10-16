// Obrazovka: Onkologická léčba (/onkologie)
//
// Pacient zadá název léčby (s našeptáváním), formu a kdy byla poslední dávka.
// Položky ukládáme do stejného seznamu jako léky, s type: 'onko'.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import OncoQuestion from '../components/OncoQuestion.jsx';
import { CheckIcon } from '../components/Icons.jsx';
import {
  ITEM_TYPES,
  ONCO_FORMS,
  ONCO_SUGGESTIONS,
  dateText,
  emptyDosage,
  itemsOfType,
  oncoFormText,
} from '../types.js';

// Dnešní datum ve tvaru "2026-10-16" (pro max u výběru data).
// Švédský formát data je shodou okolností přesně RRRR-MM-DD, a to v místním čase.
const TODAY = new Date().toLocaleDateString('sv-SE');

export default function Onco() {
  const navigate = useNavigate();
  const { meds, addMed, removeMed, profile } = useMeds();
  const treatments = itemsOfType(meds, ITEM_TYPES.ONKO);

  const [name, setName] = useState('');
  const [form, setForm] = useState(''); // 'tablets' | 'infusion' | 'injection'
  const [lastDose, setLastDose] = useState(''); // "2026-10-01"

  // Našeptávání: návrhy, které obsahují napsaný text. Prázdné pole = všechny.
  const typed = name.trim().toLowerCase();
  const suggestions = ONCO_SUGGESTIONS.filter((s) => s.includes(typed) && s !== typed);

  function handleSubmit(event) {
    event.preventDefault();
    addMed({
      type: ITEM_TYPES.ONKO,
      name: name.trim(),
      oncoForm: form,
      lastDose,
      strength: '',
      dosage: emptyDosage(),
      source: 'manual',
      kind: 'regimen', // backend zná "regimen" = onkologická léčba
    });
    // Formulář vyčistíme, ať jde přidat další léčba
    setName('');
    setForm('');
    setLastDose('');
  }

  return (
    <>
      <h1>Onkologická léčba</h1>

      {/* Dokud pacient neodpověděl "Ano", ukážeme nejdřív otázku */}
      {profile.onco !== 'ano' ? (
        <OncoQuestion />
      ) : (
        <>
          <p className="subtitle">Tyto údaje uvidí lékař ve zprávě úplně nahoře.</p>

          {treatments.length > 0 && (
            <ul className="med-list">
              {treatments.map((t) => (
                <li key={t.id} className="card onco-card">
                  <h2 className="med-name">{t.name}</h2>
                  <p>{[oncoFormText(t.oncoForm), t.lastDose && `poslední dávka ${dateText(t.lastDose)}`].filter(Boolean).join(' · ')}</p>
                  <button type="button" className="btn-text" onClick={() => removeMed(t.id)}>
                    Odebrat<span className="sr-only"> {t.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="med-form" onSubmit={handleSubmit}>
            <h2>{treatments.length === 0 ? 'Jakou léčbu máte?' : 'Přidat další léčbu'}</h2>

            <div className="field">
              <label htmlFor="onco-name">Název léčby</label>
              <input
                id="onco-name"
                type="text"
                autoComplete="off"
                placeholder="začněte psát, nebo vyberte níže"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {suggestions.length > 0 && (
                // Našeptávač jako velká tlačítka – na klepnutí doplní název
                <ul className="suggestions" aria-label="Návrhy">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button type="button" className="suggestion" onClick={() => setName(s)}>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <fieldset className="field">
              <legend>Jak léčbu dostáváte</legend>
              <div className="choice-grid choice-grid-1">
                {ONCO_FORMS.map((f) => (
                  <label key={f.key} className={form === f.key ? 'choice choice-on' : 'choice'}>
                    <input
                      type="radio"
                      name="onco-form"
                      value={f.key}
                      checked={form === f.key}
                      onChange={() => setForm(f.key)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="field">
              <label htmlFor="onco-last">
                Kdy byla poslední dávka nebo cyklus <span className="optional">(nepovinné)</span>
              </label>
              <input
                id="onco-last"
                type="date"
                max={TODAY}
                value={lastDose}
                onChange={(e) => setLastDose(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              <CheckIcon />
              Přidat léčbu
            </button>
          </form>

          <button type="button" className="btn btn-secondary" onClick={() => navigate('/leky')}>
            Hotovo
          </button>
        </>
      )}
    </>
  );
}
