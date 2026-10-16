// Formulář s údaji o léku. Používá se:
//  - při kontrole léku z fotek (tlačítko "Opravit" – pole předvyplněná, nejistá jsou žlutá),
//  - při ručním zadání (pole jsou prázdná).
//
// Dávkování se nepíše, ale kliká (komponenta DosageInput).
//
// Při ručním zadání (suggest) nabízí pod názvem léky z katalogu (CatalogSuggestions).
// Vybraný přípravek doplní název, sílu, účinnou látku a catalog_id.
//
// Nejistá pole (AI si nebyla jistá) jsou žlutá s textem "Zkontrolujte prosím".
// Lék nejde přidat, dokud pacient každé takové pole neodklepne
// tlačítkem "Je to správně" nebo ho neopraví.
import { useState } from 'react';
import { WarningIcon, CheckIcon } from './Icons.jsx';
import DosageInput from './DosageInput.jsx';
import VoiceButton from './VoiceButton.jsx';
import CatalogSuggestions from './CatalogSuggestions.jsx';
import { catalogName } from '../labels.js';
import { PRESCRIBERS, emptyDosage, monthNames } from '../types.js';
import { t } from '../i18n/index.js';

// Roky pro "Užívám od": letos a 30 let zpátky
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 31 }, (_, i) => String(THIS_YEAR - i));

/**
 * @param initial – počáteční hodnoty { name, strength, dosage, since, prescriber } (nebo nic)
 * @param uncertainFields – pole formuláře, která AI nepřečetla jistě, např. ["dosage"]
 * @param onSubmit – zavolá se s vyplněnými údaji po kliknutí na "Ano, přidat lék"
 * @param submitLabel – (nepovinné) text hlavního tlačítka
 * @param suggest – (nepovinné) nabízet při psaní názvu léky z katalogu
 */
export default function MedForm({ initial, uncertainFields = [], onSubmit, submitLabel = t('form.submit'), suggest = false }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [strength, setStrength] = useState(initial?.strength ?? '');
  // Přípravek z katalogu, který pacient vybral z návrhů (null = žádný)
  const [picked, setPicked] = useState(null);
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

  // Pacient název přepsal → vybraný přípravek už k němu nepatří
  function changeName(value) {
    change('name', setName)(value);
    setPicked(null);
  }

  function pickProduct(product) {
    setName(catalogName(product.name));
    if (product.strength) setStrength(product.strength);
    markChecked('name');
    if (product.strength) markChecked('strength');
    setPicked(product);
  }

  function handleSubmit(event) {
    event.preventDefault(); // zabrání znovunačtení stránky (výchozí chování formuláře)
    const values = { name: name.trim(), strength: strength.trim(), dosage, since, prescriber };
    // Katalogové údaje jen když síla pořád odpovídá vybranému přípravku –
    // jinak by lékař viděl látku a interakce jiného přípravku.
    const catalog =
      picked && (!picked.strength || values.strength === picked.strength)
        ? { active_substance: picked.active_substance, form: picked.form || null, catalog_id: picked.id }
        : {};
    onSubmit({ ...values, ...catalog });
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
            {t('form.checkPlease')}
          </p>
          <button type="button" className="btn-check" onClick={() => markChecked(key)}>
            {t('common.isCorrect')}
          </button>
        </div>
      );
    }
    // Už zkontrolované – fajfka + text (ne jen změna barvy)
    if (wasUncertain(key)) {
      return (
        <p className="field-ok">
          <CheckIcon size={24} /> {t('form.checked')}
        </p>
      );
    }
    return null;
  };

  return (
    <form onSubmit={handleSubmit} className="med-form">
      <div className={fieldClass('name')}>
        <label htmlFor="field-name">{t('form.medName')}</label>
        <input
          id="field-name"
          type="text"
          value={name}
          placeholder={t('form.namePlaceholder')}
          autoComplete={suggest ? 'off' : undefined}
          onChange={(e) => changeName(e.target.value)}
          aria-describedby={isUncertain('name') ? 'hint-name' : undefined}
        />
        {/* Hlasové zadání – zobrazí se jen v prohlížeči, který ho umí */}
        <VoiceButton label={t('form.voiceName')} onResult={changeName} />
        {suggest && <CatalogSuggestions query={name} paused={Boolean(picked)} onPick={pickProduct} />}
        {picked && (
          <p className="field-ok">
            <CheckIcon size={24} />
            {picked.active_substance
              ? t('form.fromCatalogSubstance', { substance: picked.active_substance })
              : t('form.fromCatalog')}
          </p>
        )}
        {hint('name')}
      </div>

      <div className={fieldClass('strength')}>
        <label htmlFor="field-strength">{t('field.strength')}</label>
        <input
          id="field-strength"
          type="text"
          value={strength}
          placeholder={t('form.strengthPlaceholder')}
          onChange={(e) => change('strength', setStrength)(e.target.value)}
          aria-describedby={isUncertain('strength') ? 'hint-strength' : undefined}
        />
        {hint('strength')}
      </div>

      {/* fieldset + legend = skupina ovládacích prvků s jedním nadpisem */}
      <fieldset
        className={fieldClass('dosage')}
        aria-describedby={isUncertain('dosage') ? 'hint-dosage' : undefined}
      >
        <legend>{t('form.whenHowMany')}</legend>
        <DosageInput value={dosage} onChange={change('dosage', setDosage)} />
        {hint('dosage')}
      </fieldset>

      <fieldset className="field">
        <legend>
          {t('form.since')} <span className="optional">{t('common.optional')}</span>
        </legend>
        <div className="since-row">
          <select aria-label={t('form.year')} value={sinceYear} onChange={(e) => changeSince(e.target.value, sinceMonth)}>
            <option value="">{t('form.yearEmpty')}</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            aria-label={t('form.month')}
            value={sinceMonth}
            disabled={!sinceYear}
            onChange={(e) => changeSince(sinceYear, e.target.value)}
          >
            <option value="">{t('form.monthUnknown')}</option>
            {monthNames().map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, '0')}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>
          {t('form.prescriber')} <span className="optional">{t('common.optional')}</span>
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
          {t('form.remaining', { count: toCheck.length })}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
        <CheckIcon />
        {submitLabel}
      </button>
    </form>
  );
}
