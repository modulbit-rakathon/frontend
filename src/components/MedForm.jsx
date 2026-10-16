// Formulář s údaji o léku. Používá se:
//  - po vyfocení (pole jsou předvyplněná z AI, nejistá pole jsou žlutá),
//  - při ručním zadání (pole jsou prázdná).
//
// Dávkování se nepíše, ale kliká (komponenta DosageInput).
//
// Nejistá pole (AI si nebyla jistá) jsou žlutá s textem "Zkontrolujte prosím".
// Lék nejde přidat, dokud pacient každé takové pole neodklepne
// tlačítkem "Je to správně" nebo ho neopraví.
import { useState } from 'react';
import { WarningIcon, CheckIcon } from './Icons.jsx';
import DosageInput from './DosageInput.jsx';
import VoiceButton from './VoiceButton.jsx';
import { MONTHS, PRESCRIBERS, emptyDosage } from '../types.js';

// Roky pro "Užívám od": letos a 30 let zpátky
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 31 }, (_, i) => String(THIS_YEAR - i));

/**
 * @param initial – počáteční hodnoty { name, strength, dosage, since, prescriber } (nebo nic)
 * @param uncertainFields – pole formuláře, která AI nepřečetla jistě, např. ["dosage"]
 * @param onSubmit – zavolá se s vyplněnými údaji po kliknutí na "Ano, přidat lék"
 * @param onFieldFocus – (nepovinné) dá vědět, které pole pacient právě upravuje
 *                       ('name' | 'strength' | 'dosage' | null) – kvůli zvýraznění na fotce
 */
export default function MedForm({ initial, uncertainFields = [], onSubmit, onFieldFocus = () => {} }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [strength, setStrength] = useState(initial?.strength ?? '');
  const [dosage, setDosage] = useState(initial?.dosage ?? emptyDosage());
  // Nejistá pole, která už pacient zkontroloval (odklepl nebo opravil)
  const [checked, setChecked] = useState([]);

  function markChecked(key) {
    setChecked((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  // Změna hodnoty = pacient pole opravil → počítá se jako zkontrolované
  function change(key, setter) {
    return (value) => {
      setter(value);
      markChecked(key);
    };
  }
  const [since, setSince] = useState(initial?.since ?? ''); // "2024-03", "2024" nebo ""
  const [prescriber, setPrescriber] = useState(initial?.prescriber ?? '');

  // "Užívám od" je složené ze dvou rozbalovacích seznamů (měsíc + rok).
  const [sinceYear, sinceMonth = ''] = since ? since.split('-') : ['', ''];
  function changeSince(year, month) {
    // Bez roku nemá měsíc smysl → prázdné
    setSince(year ? (month ? `${year}-${month}` : year) : '');
  }

  function handleSubmit(event) {
    event.preventDefault(); // zabrání znovunačtení stránky (výchozí chování formuláře)
    onSubmit({ name: name.trim(), strength: strength.trim(), dosage, since, prescriber });
  }

  // Kolik žlutých polí ještě zbývá zkontrolovat
  const toCheck = uncertainFields.filter((key) => !checked.includes(key));

  // Lék jde přidat, jen když má název a všechna nejistá pole jsou zkontrolovaná.
  const canSubmit = name.trim() !== '' && toCheck.length === 0;

  // Pomocné funkce pro nejistá pole
  const isUncertain = (key) => toCheck.includes(key);
  const wasUncertain = (key) => uncertainFields.includes(key);
  const fieldClass = (key) => (isUncertain(key) ? 'field field-uncertain' : 'field');
  const hint = (key) => {
    if (isUncertain(key)) {
      return (
        <div className="field-hint-row">
          <p className="field-hint" id={`hint-${key}`}>
            <WarningIcon size={24} />
            Zkontrolujte prosím
          </p>
          <button type="button" className="btn-check" onClick={() => markChecked(key)}>
            Je to správně
          </button>
        </div>
      );
    }
    // Už zkontrolované – fajfka + text (ne jen změna barvy)
    if (wasUncertain(key)) {
      return (
        <p className="field-ok">
          <CheckIcon size={24} /> Zkontrolováno
        </p>
      );
    }
    return null;
  };

  return (
    // onBlur na celém formuláři: když fokus odejde mimo formulář, zvýraznění na fotce zhasne
    <form
      onSubmit={handleSubmit}
      className="med-form"
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && onFieldFocus(null)}
    >
      <div className={fieldClass('name')} onFocus={() => onFieldFocus('name')}>
        <label htmlFor="field-name">Název léku</label>
        <input
          id="field-name"
          type="text"
          value={name}
          placeholder="např. Ibuprofen"
          onChange={(e) => change('name', setName)(e.target.value)}
          aria-describedby={isUncertain('name') ? 'hint-name' : undefined}
        />
        {/* Hlasové zadání – zobrazí se jen v prohlížeči, který ho umí */}
        <VoiceButton label="Říct název nahlas" onResult={change('name', setName)} />
        {hint('name')}
      </div>

      <div className={fieldClass('strength')} onFocus={() => onFieldFocus('strength')}>
        <label htmlFor="field-strength">Síla</label>
        <input
          id="field-strength"
          type="text"
          value={strength}
          placeholder="např. 400 mg"
          onChange={(e) => change('strength', setStrength)(e.target.value)}
          aria-describedby={isUncertain('strength') ? 'hint-strength' : undefined}
        />
        {hint('strength')}
      </div>

      {/* fieldset + legend = skupina ovládacích prvků s jedním nadpisem */}
      <fieldset
        className={fieldClass('dosage')}
        aria-describedby={isUncertain('dosage') ? 'hint-dosage' : undefined}
        onFocus={() => onFieldFocus('dosage')}
      >
        <legend>Kdy a kolik kusů</legend>
        <DosageInput value={dosage} onChange={change('dosage', setDosage)} />
        {hint('dosage')}
      </fieldset>

      <fieldset className="field">
        <legend>
          Užívám od <span className="optional">(nepovinné)</span>
        </legend>
        <div className="since-row">
          <select aria-label="Rok" value={sinceYear} onChange={(e) => changeSince(e.target.value, sinceMonth)}>
            <option value="">rok</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            aria-label="Měsíc (nejdřív vyberte rok)"
            value={sinceMonth}
            disabled={!sinceYear}
            onChange={(e) => changeSince(sinceYear, e.target.value)}
          >
            <option value="">měsíc nevím</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, '0')}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>
          Kdo lék předepsal <span className="optional">(nepovinné)</span>
        </legend>
        <div className="choice-grid">
          {PRESCRIBERS.map((p) => (
            // Skutečné radio tlačítko (kvůli čtečkám), jen vypadá jako velká dlaždice
            <label key={p.key} className={prescriber === p.key ? 'choice choice-on' : 'choice'}>
              <input
                type="radio"
                name="prescriber"
                value={p.key}
                checked={prescriber === p.key}
                onChange={() => setPrescriber(p.key)}
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Vysvětlíme, proč tlačítko nejde stisknout */}
      {toCheck.length > 0 && (
        <p className="submit-note" role="status">
          Nejdřív zkontrolujte žlutá pole (zbývá {toCheck.length}).
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
        <CheckIcon />
        Ano, přidat lék
      </button>
    </form>
  );
}
