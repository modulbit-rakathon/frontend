// Formulář s údaji o léku. Používá se:
//  - po vyfocení (pole jsou předvyplněná z AI, nejistá pole jsou žlutá),
//  - při ručním zadání (pole jsou prázdná).
import { useState } from 'react';
import { WarningIcon, CheckIcon } from './Icons.jsx';

// Pole formuláře: klíč v datech + popisek, který uvidí pacient
const FIELDS = [
  { key: 'name', label: 'Název léku', placeholder: 'např. Ibuprofen' },
  { key: 'strength', label: 'Síla', placeholder: 'např. 400 mg' },
  { key: 'frequency', label: 'Jak často', placeholder: 'např. 3× denně' },
  { key: 'amount', label: 'Kolik najednou', placeholder: 'např. 1 tableta' },
];

/**
 * @param initial – počáteční hodnoty (z AI nebo prázdné)
 * @param uncertainFields – pole, která AI nepřečetla jistě, např. ["frequency"]
 * @param onSubmit – zavolá se s vyplněnými údaji po kliknutí na "Ano, přidat lék"
 */
export default function MedForm({ initial, uncertainFields = [], onSubmit }) {
  // values = aktuální obsah všech polí (objekt { name, strength, ... })
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    strength: initial?.strength ?? '',
    frequency: initial?.frequency ?? '',
    amount: initial?.amount ?? '',
  });

  // Při psaní do pole přepíšeme jen tu jednu hodnotu.
  function handleChange(key, newValue) {
    setValues((prev) => ({ ...prev, [key]: newValue }));
  }

  function handleSubmit(event) {
    event.preventDefault(); // zabrání znovunačtení stránky (výchozí chování formuláře)
    onSubmit({
      name: values.name.trim(),
      strength: values.strength.trim(),
      frequency: values.frequency.trim(),
      amount: values.amount.trim(),
    });
  }

  // Bez názvu léku nedovolíme lék přidat.
  const canSubmit = values.name.trim() !== '';

  return (
    <form onSubmit={handleSubmit} className="med-form">
      {FIELDS.map((field) => {
        const isUncertain = uncertainFields.includes(field.key);
        const inputId = `field-${field.key}`;

        return (
          <div key={field.key} className={isUncertain ? 'field field-uncertain' : 'field'}>
            <label htmlFor={inputId}>{field.label}</label>
            <input
              id={inputId}
              type="text"
              value={values[field.key]}
              placeholder={field.placeholder}
              onChange={(e) => handleChange(field.key, e.target.value)}
              aria-describedby={isUncertain ? `${inputId}-hint` : undefined}
            />
            {isUncertain && (
              <p className="field-hint" id={`${inputId}-hint`}>
                <WarningIcon size={24} />
                Zkontrolujte
              </p>
            )}
          </div>
        );
      })}

      <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
        <CheckIcon />
        Ano, přidat lék
      </button>
    </form>
  );
}
