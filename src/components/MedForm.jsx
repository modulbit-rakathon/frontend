import { useEffect, useState } from 'react';
import {
  finalizeMedication, searchMedicationCandidates, selectMedicationCandidate,
} from '@pillgaze/core';
import { loadCatalog, prepareForReview, formValues, editedValues } from '../core.js';
import { FIELD_LABELS, SOURCE_LABELS } from '../labels.js';
import MedicationEvidence from './MedicationEvidence.jsx';
import { WarningIcon, CheckIcon } from './Icons.jsx';

const PLACEHOLDERS = {
  name: 'např. Ibuprofen', strength: 'např. 400 mg',
  active_substance: 'Jen pokud ji znáte', form: 'např. tableta',
  frequency: 'např. 3× denně', amount: 'např. 1 tableta',
};

export default function MedForm({ initial, onSubmit, editing = false }) {
  const [original] = useState(initial);
  const [catalog, setCatalog] = useState(null);
  const [current, setCurrent] = useState(null);
  const [values, setValues] = useState(() => formValues(original));
  const [confirmed, setConfirmed] = useState([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [choices, setChoices] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadCatalog().then(data => {
      if (cancelled) return;
      const prepared = prepareForReview(original, data);
      setCurrent(prepared);
      setCatalog(data);
      setError('');
    }).catch(() => {
      if (!cancelled) setError('Katalog nebo záznam se nepodařilo načíst. Zkuste načtení znovu.');
    });
    return () => { cancelled = true; };
  }, [original, attempt]);

  useEffect(() => {
    setChoices([]);
    if (!catalog || current?.kind === 'regimen' || !searchOpen || values.name.trim().length < 2) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      try {
        const result = searchMedicationCandidates(values.name.trim(), catalog, { limit: 6 });
        const suggested = values.name === current.name ? current._core.suggestions?.candidates ?? [] : [];
        setChoices((result.candidates.length ? result.candidates : suggested).slice(0, 6));
      } catch {
        setError('Zadejte alespoň dvě písmena názvu léku.');
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [catalog, current, values.name, searchOpen]);

  function change(field, value) {
    setValues(previous => editedValues(current, previous, field, value));
    setConfirmed(previous => ['name', 'strength', 'form'].includes(field) ? [] : previous.filter(item => item !== field));
    if (field === 'name') setSearchOpen(true);
    setError('');
  }

  function choose(candidate) {
    try {
      const draft = finalizeMedication(current, values, { catalog });
      const selected = selectMedicationCandidate(draft, candidate.id, { catalog });
      setCurrent(selected);
      setValues(formValues(selected));
      setConfirmed([]);
      setSearchOpen(false);
      setError('');
    } catch {
      setError('Výběr se nepodařil. Zkontrolujte název a zkuste to znovu.');
    }
  }

  function submit(event) {
    event.preventDefault();
    try {
      const saved = finalizeMedication(current, values, { catalog, confirmedFields: confirmed });
      onSubmit(saved, original);
    } catch (failure) {
      setError(failure instanceof TypeError ? 'Údaje se nepodařilo uložit. Zkontrolujte vyplněná pole.' : failure.message);
    }
  }

  if (!catalog || !current) return (
    <div className="box box-info" role={error ? 'alert' : 'status'}>
      <p>{error || 'Načítám katalog léčiv…'}</p>
      {error && <button type="button" className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Zkusit znovu</button>}
    </div>
  );

  return (
    <form onSubmit={submit} className="med-form">
      <p>Neznámé údaje nechte prázdné. U nejistých údajů potvrďte jen to, co jste opravdu zkontrolovali.</p>
      {current.kind === 'regimen' && <p className="box box-info">Onkologický režim — nerozepisujeme jej automaticky na jednotlivé léky.</p>}
      {Object.entries(FIELD_LABELS).map(([field, label]) => {
        const identityChanged = ['name', 'strength', 'form'].some(key => values[key] !== current[key]);
        const isUncertain = current.uncertain_fields.includes(field) || values[field] !== current[field] || identityChanged;
        const conflicts = current.conflicts.filter(item => item.field === field);
        const inputId = `field-${field}`;
        return (
          <div key={field} className={isUncertain ? 'field field-uncertain' : 'field'}>
            <label htmlFor={inputId}>{label}</label>
            <input id={inputId} type="text" value={values[field]} placeholder={PLACEHOLDERS[field]}
              onChange={event => change(field, event.target.value)}
              aria-describedby={isUncertain ? `${inputId}-hint` : undefined} />
            {isUncertain && <p className="field-hint" id={`${inputId}-hint`}><WarningIcon size={24} />Zkontrolujte; pokud údaj neznáte, nechte prázdné.</p>}
            {[...values[field]].length > 100 && <p role="alert">Pro sdílení zkraťte tento údaj na nejvýše 100 znaků.</p>}
            {conflicts.map(conflict => <p key={conflict.field}>Zdroje se liší: {conflict.values.map(item => `${SOURCE_LABELS[item.source]}: ${item.value}`).join(' / ')}. Zadejte a potvrďte ověřenou hodnotu.</p>)}
            {values[field].trim() && (
              <label className="field-confirmation">
                <input type="checkbox" checked={confirmed.includes(field)} onChange={event => setConfirmed(previous =>
                  event.target.checked ? [...previous, field] : previous.filter(item => item !== field))} />
                Zkontrolováno: {label}
              </label>
            )}
            {field === 'name' && current.kind === 'drug' && searchOpen && values.name.trim().length >= 2 && (
              <div className="catalog-search" aria-live="polite">
                {searching ? <p>Hledám v SÚKL…</p> : choices.length ? (
                  <details>
                    <summary>Návrhy z katalogu SÚKL ({choices.length})</summary>
                    <p>Vyberte skutečně užívanou sílu a formu. Nejde o doporučení náhrady.</p>
                    <ul className="catalog-options">
                      {choices.map(candidate => (
                        <li key={candidate.id}><button type="button" className="btn btn-secondary" onClick={() => choose(candidate)}>
                          {candidate.name} · {candidate.strength} · {candidate.form || 'forma nezjištěna'} · {candidate.registrationNumber}
                        </button></li>
                      ))}
                    </ul>
                  </details>
                ) : <p>V katalogu nebyl nalezen návrh. Název můžete opsat ručně; nic neopravujeme automaticky.</p>}
              </div>
            )}
          </div>
        );
      })}
      <MedicationEvidence med={current} />
      {error && <p className="box box-warning" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={!values.name.trim()}>
        <CheckIcon />{editing ? 'Uložit kontrolu' : 'Ano, přidat lék'}
      </button>
    </form>
  );
}
