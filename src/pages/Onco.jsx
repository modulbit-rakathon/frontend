// Obrazovka: Onkologická léčba (/onkologie)
//
// Pacient zadá název léčby (s našeptáváním), formu a kdy byla poslední dávka.
// Položky ukládáme do stejného seznamu jako léky, s type: 'onko'.
// Adresa /onkologie?krok=1 = jsme tu jako krok po přidání prvních léků (z /dalsi).
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import OncoQuestion from '../components/OncoQuestion.jsx';
import { CheckIcon } from '../components/Icons.jsx';
import {
  ITEM_TYPES,
  ONCO_FORMS,
  dateText,
  emptyDosage,
  itemsOfType,
  oncoFormText,
  oncoSuggestions,
} from '../types.js';
import { getLang, t } from '../i18n/index.js';
import BackButton from '../components/BackButton.jsx';

// Dnešní datum ve tvaru "2026-10-16" (pro max u výběru data).
// Švédský formát data je shodou okolností přesně RRRR-MM-DD, a to v místním čase.
const TODAY = new Date().toLocaleDateString('sv-SE');

export default function Onco() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Jako krok se vracíme na otázku "Užíváte ještě něco dalšího?"
  const backTo = searchParams.get('krok') === '1' ? '/dalsi' : '/leky';
  const { meds, addMed, removeMed, profile } = useMeds();
  const treatments = itemsOfType(meds, ITEM_TYPES.ONKO);

  const [name, setName] = useState('');
  const [form, setForm] = useState(''); // 'tablets' | 'infusion' | 'injection'
  const [lastDose, setLastDose] = useState(''); // "2026-10-01"

  // Našeptávání: návrhy, které obsahují napsaný text. Prázdné pole = všechny.
  const typed = name.trim().toLocaleLowerCase(getLang());
  const suggestions = oncoSuggestions().filter((s) => s.includes(typed) && s !== typed);

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
      <BackButton to={backTo} />
      <h1>{t('common.oncoTreatment')}</h1>

      {/* Dokud pacient neodpověděl "Ano", ukážeme nejdřív otázku */}
      {profile.onco !== 'ano' ? (
        <OncoQuestion />
      ) : (
        <>
          <p className="subtitle">{t('oncoPage.subtitle')}</p>

          {treatments.length > 0 && (
            <ul className="med-list">
              {treatments.map((item) => (
                <li key={item.id} className="card onco-card">
                  <h2 className="med-name">{item.name}</h2>
                  <p>{[oncoFormText(item.oncoForm), item.lastDose && t('common.lastDose', { date: dateText(item.lastDose) })].filter(Boolean).join(' · ')}</p>
                  <button type="button" className="btn-text" onClick={() => removeMed(item.id)}>
                    {t('common.remove')}<span className="sr-only"> {item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="med-form" onSubmit={handleSubmit}>
            <h2>{treatments.length === 0 ? t('oncoPage.which') : t('oncoPage.addAnother')}</h2>

            <div className="field">
              <label htmlFor="onco-name">{t('oncoPage.name')}</label>
              <input
                id="onco-name"
                type="text"
                autoComplete="off"
                placeholder={t('oncoPage.placeholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {suggestions.length > 0 && (
                // Našeptávač jako velká tlačítka – na klepnutí doplní název
                <ul className="suggestions" aria-label={t('oncoPage.suggestions')}>
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
              <legend>{t('oncoPage.how')}</legend>
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
                {t('oncoPage.lastDose')} <span className="optional">{t('common.optional')}</span>
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
              {t('oncoPage.add')}
            </button>
          </form>

          <button type="button" className="btn btn-secondary" onClick={() => navigate(backTo)}>
            {t('common.done')}
          </button>
        </>
      )}
    </>
  );
}
