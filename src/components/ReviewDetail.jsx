// Rozbalený řádek v tabulce "Sedí to?" – všechno, co jde s jedním lékem z fotek udělat:
//   - vybrat přípravek z katalogu (když si backend nebyl jistý),
//   - vybrat, co platí, když se lístek a krabička liší,
//   - potvrdit nejistě přečtené údaje nebo je opravit,
//   - lék odebrat.
// Sama nic neukládá – každou změnu pošle nahoru funkcí onChange(novýKoncept).
import { useState } from 'react';
import CatalogSearch from './CatalogSearch.jsx';
import MedForm from './MedForm.jsx';
import { CheckIcon, WarningIcon } from './Icons.jsx';
import { catalogName } from '../labels.js';
import {
  applyForm,
  chooseProduct,
  confirmField,
  formFieldsToCheck,
  keepAsRead,
  needsCatalogChoice,
  openConflicts,
  openFields,
  resolveConflict,
} from '../review.js';
import { BACKEND_TO_FORM_FIELD, CATALOG_STATUS, FORM_FIELD_LABELS, dosageFromText, dosageText } from '../types.js';

const FROM_SOURCE = { box: 'na krabičce', note: 'na lístku' };

// Hodnota pole formuláře jako text pro pacienta
function fieldValue(draft, field) {
  if (field === 'dosage') return dosageText(draft.dosage) || 'nepřečteno';
  return draft[field] || 'nepřečteno';
}

// Hodnota z rozporu jako text (dávkování "1-0-0" → "ráno 1")
function conflictValue(field, value) {
  if (field === 'frequency') return dosageText(dosageFromText(value, null)) || value;
  return value;
}

// Přípravek z katalogu jako jeden řádek: "Brufen 400 mg"
function productTitle(p) {
  return `${catalogName(p.name)} ${p.strength}`.trim();
}

/**
 * @param {import('../review.js').Draft} draft
 * @param {(d: import('../review.js').Draft) => void} onChange
 * @param {() => void} onRemove
 * @param {boolean} editing – je otevřený formulář "Opravit"? (vždy jen u jednoho léku –
 *                            formulář má pevná id polí)
 * @param {(on: boolean) => void} onEdit
 */
export default function ReviewDetail({ draft, onChange, onRemove, editing, onEdit }) {
  // Je otevřené hledání v katalogu?
  const [searching, setSearching] = useState(false);

  const status = draft.med.catalog?.status;
  const choosing = needsCatalogChoice(draft);
  const conflicts = openConflicts(draft);
  const fields = openFields(draft);

  function pick(product, choice) {
    onChange(chooseProduct(draft, product, choice));
    setSearching(false);
  }

  if (editing) {
    return (
      <div className="review-detail">
        <MedForm
          initial={draft}
          uncertainFields={formFieldsToCheck(draft)}
          submitLabel="Uložit změny"
          onSubmit={(values) => {
            onChange(applyForm(draft, values));
            onEdit(false);
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={() => onEdit(false)}>
          Zrušit úpravy
        </button>
      </div>
    );
  }

  return (
    <div className="review-detail">
      {/* --- 1) Katalog: jistá shoda nebo už vybraný přípravek --- */}
      {draft.product && (
        <p className="review-ok">
          <CheckIcon size={24} />
          <span>
            V seznamu léků: <strong>{productTitle(draft.product)}</strong>
            {draft.product.active_substance && ` (${draft.product.active_substance})`}
          </span>
        </p>
      )}

      {/* --- 2) Katalog: backend si nebyl jistý → pacient vybere --- */}
      {choosing && (
        <div className="review-question">
          <p className="review-question-title">
            <WarningIcon size={24} />
            Který lék to je?
          </p>
          <p>
            Na fotce jsme přečetli <strong>„{draft.med.name}“</strong>.
          </p>
          <ul className="catalog-results">
            {(draft.med.catalog.candidates ?? []).map((c) => (
              <li key={c.id}>
                <button type="button" className="catalog-result" onClick={() => pick(c, c.id)}>
                  <strong>{productTitle(c)}</strong>
                  <span>{[c.active_substance, c.form].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-secondary" aria-expanded={searching} onClick={() => setSearching(!searching)}>
            Jiný lék – vyhledat
          </button>
          <button type="button" className="btn btn-link" onClick={() => onChange(keepAsRead(draft))}>
            Nevím – nechat, jak je přečteno
          </button>
        </div>
      )}

      {/* --- 3) Katalog: nic nenalezeno → hledání nabídneme, ale není povinné --- */}
      {status === CATALOG_STATUS.NOT_FOUND && !draft.product && (
        <div className="review-question review-question-info">
          <p>Tento lék jsme v seznamu léků nenašli. Lékař ho uvidí tak, jak je přečtený.</p>
          <button type="button" className="btn btn-secondary" aria-expanded={searching} onClick={() => setSearching(!searching)}>
            Vyhledat v seznamu léků
          </button>
        </div>
      )}

      {/* Pacient vybral kandidáta nebo nechal přečtené → jde to změnit */}
      {status === CATALOG_STATUS.NEEDS_CONFIRMATION && !choosing && (
        <button
          type="button"
          className="btn btn-link"
          onClick={() => onChange({ ...draft, catalogChoice: null, product: null })}
        >
          {draft.catalogChoice === 'keep' ? 'Necháno, jak je přečteno – změnit' : 'Vybrat jiný lék'}
        </button>
      )}

      {searching && (
        <CatalogSearch idPrefix={draft.id} initialQuery={draft.name} onPick={(p) => pick(p, 'other')} />
      )}

      {/* --- 4) Rozpory mezi lístkem a krabičkou --- */}
      {conflicts.map((c) => {
        const label = FORM_FIELD_LABELS[BACKEND_TO_FORM_FIELD[c.field]].toLowerCase();
        return (
          <div key={c.field} className="review-question">
            <p className="review-question-title">
              <WarningIcon size={24} />
              Lístek a krabička se liší – {label}. Co platí?
            </p>
            <ul className="catalog-results">
              {c.values.map((v) => (
                <li key={v.source}>
                  <button
                    type="button"
                    className="catalog-result"
                    onClick={() => onChange(resolveConflict(draft, c.field, v.value))}
                  >
                    <strong>{conflictValue(c.field, v.value)}</strong>
                    <span>{FROM_SOURCE[v.source] ?? v.source}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {/* --- 5) Nejistě přečtené údaje --- */}
      {fields.map((f) => (
        <div key={f} className="review-question">
          <p className="review-question-title">
            <WarningIcon size={24} />
            Špatně čitelné – {FORM_FIELD_LABELS[f].toLowerCase()}
          </p>
          <p>
            Přečetli jsme: <strong>{fieldValue(draft, f)}</strong>
          </p>
          <div className="review-actions">
            <button type="button" className="btn-check" onClick={() => onChange(confirmField(draft, f))}>
              Je to správně
            </button>
            <button type="button" className="btn-check" onClick={() => onEdit(true)}>
              Opravit
            </button>
          </div>
        </div>
      ))}

      {/* --- 6) Úpravy a odebrání --- */}
      <div className="review-actions">
        <button type="button" className="btn btn-secondary" onClick={() => onEdit(true)}>
          Upravit údaje
        </button>
        <button type="button" className="btn-text" onClick={onRemove}>
          Odebrat – tento lék neberu
        </button>
      </div>
    </div>
  );
}
