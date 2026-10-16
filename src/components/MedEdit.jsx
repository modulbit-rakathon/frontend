// Úprava uloženého léku v "Moje léky".
//
// Krok 1: formulář (MedForm) předvyplněný uloženými údaji.
// Krok 2: jen když se změnil název nebo síla – lék znovu najdeme v katalogu.
//         Staré katalogové přiřazení (účinná látka, forma, catalog_id) by k novému
//         názvu nemuselo patřit a lékař by viděl špatnou látku i interakce.
//         Když katalog najde přesně jeden přípravek se stejným názvem a silou, přiřadí se sám,
//         jinak pacient vybere z hledání, nebo lék uloží bez přiřazení.
//
// Nic se neuloží, dokud pacient úpravu nedokončí. "Zrušit" změny zahodí.
import { useEffect, useState } from 'react';
import CatalogSearch from './CatalogSearch.jsx';
import MedForm from './MedForm.jsx';
import { WarningIcon } from './Icons.jsx';
import { useMeds } from '../context/MedsContext.jsx';
import { searchCatalog } from '../api.js';
import { catalogName } from '../labels.js';
import { t } from '../i18n/index.js';

const NO_CATALOG = { active_substance: null, form: null, catalog_id: null };

// Bez diakritiky, mezer navíc a velkých písmen – "Brufen  400 MG" = "brufen 400 mg"
function simplify(text) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Přípravek z katalogu, který přesně odpovídá názvu a síle – nebo null.
// Bez síly stačí název, ale jen když je takový přípravek jediný.
function exactProduct(products, { name, strength }) {
  const sameName = products.filter((p) => simplify(catalogName(p.name)) === simplify(name));
  const matches = strength ? sameName.filter((p) => simplify(p.strength) === simplify(strength)) : sameName;
  return matches.length === 1 ? matches[0] : null;
}

/**
 * @param {import('../types.js').Item} med – upravovaný lék
 * @param {() => void} onDone – úpravy skončily (uloženo nebo zrušeno)
 */
export default function MedEdit({ med, onDone }) {
  const { updateMed } = useMeds();
  // Hodnoty z formuláře, které čekají na nové ověření v katalogu (null = jsme ve formuláři)
  const [pending, setPending] = useState(null);
  const [checking, setChecking] = useState(false);

  function save(changes) {
    updateMed(med.id, changes);
    onDone();
  }

  function handleSubmit(values) {
    const same = (a, b) => simplify(a) === simplify(b);
    if (same(values.name, med.name) && same(values.strength, med.strength)) {
      save(values); // katalogové přiřazení platí dál
      return;
    }
    setPending(values);
  }

  // Nový název nebo síla → zkusíme přípravek najít sami
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    setChecking(true);
    searchCatalog(pending.name)
      .then((data) => {
        if (cancelled) return;
        const product = exactProduct(data.products ?? [], pending);
        if (product) pick(product);
        else setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pending]);

  // Stejně jako chooseProduct v review.js: název, síla a účinná látka z katalogu
  function pick(product) {
    save({
      ...pending,
      name: catalogName(product.name),
      strength: product.strength || pending.strength,
      active_substance: product.active_substance,
      form: product.form || null,
      catalog_id: product.id,
    });
  }

  const cancel = (
    <button type="button" className="btn btn-secondary" onClick={onDone}>
      {t('common.cancel')}
    </button>
  );

  if (!pending) {
    return (
      <div className="med-details">
        <MedForm initial={med} submitLabel={t('review.saveChanges')} onSubmit={handleSubmit} />
        {cancel}
      </div>
    );
  }

  if (checking) {
    return (
      <div className="med-details">
        <p role="status">{t('meds.checkingCatalog')}</p>
      </div>
    );
  }

  return (
    <div className="med-details">
      <div className="review-question">
        <p className="review-question-title">
          <WarningIcon size={24} />
          {t('review.whichMed')}
        </p>
        <p>{t('meds.recheckText')}</p>
        <CatalogSearch idPrefix={`edit-${med.id}`} initialQuery={pending.name} onPick={pick} />
        <button type="button" className="btn btn-link" onClick={() => save({ ...pending, ...NO_CATALOG })}>
          {t('meds.saveWithoutCatalog')}
        </button>
      </div>
      {cancel}
    </div>
  );
}
