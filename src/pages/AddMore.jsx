// Obrazovka: Užíváte ještě něco dalšího? (/dalsi)
//
// Ukáže se jednou – po přidání prvních léků. Nabídne zadat i onkologickou
// léčbu a doplňky stravy, nebo to přeskočit. Z obou obrazovek
// (s ?krok=1) se pacient vrací sem, dokud nedá "Pokračovat".
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { CheckIcon, ChevronIcon } from '../components/Icons.jsx';
import { ITEM_TYPES, itemsOfType } from '../types.js';
import { t } from '../i18n/index.js';

export default function AddMore() {
  const navigate = useNavigate();
  const { meds, profile, updateProfile } = useMeds();
  const treatments = itemsOfType(meds, ITEM_TYPES.ONKO);
  const supplements = itemsOfType(meds, ITEM_TYPES.DOPLNEK);

  // Jakmile pacient tuhle obrazovku jednou uvidí, po dalším přidání léků se už neptáme.
  useEffect(() => {
    updateProfile({ extrasAsked: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kdo na onkologii odpověděl "Ne" / "Nechci uvádět", tomu léčbu nenabízíme.
  const offerOnco = profile.onco === '' || profile.onco === 'ano';

  const anyAdded = treatments.length > 0 || supplements.length > 0;

  return (
    <>
      <div className="box box-info" role="status">
        <div className="box-title">
          <CheckIcon />
          <span>{t('more.saved')}</span>
        </div>
      </div>

      <h1>{t('more.title')}</h1>
      <p className="subtitle">{t('more.subtitle')}</p>

      {offerOnco && (
        // Klepnutí na onkologickou léčbu = odpověď "Ano" (otázku už znovu neklademe).
        <Link to="/onkologie?krok=1" className="card card-link" onClick={() => updateProfile({ onco: 'ano' })}>
          <span className="card-link-text">
            <strong>{t('common.oncoTreatment')}</strong>
            <span>{treatments.length > 0 ? t('more.entered', { count: treatments.length }) : t('more.oncoSub')}</span>
          </span>
          {treatments.length > 0 ? <CheckIcon /> : <ChevronIcon />}
        </Link>
      )}

      <Link to="/doplnky?krok=1" className="card card-link">
        <span className="card-link-text">
          <strong>{t('common.supplements')}</strong>
          <span>{supplements.length > 0 ? t('more.entered', { count: supplements.length }) : t('more.suppSub')}</span>
        </span>
        {supplements.length > 0 ? <CheckIcon /> : <ChevronIcon />}
      </Link>

      <button type="button" className="btn btn-primary" onClick={() => navigate('/leky')}>
        {anyAdded ? t('more.continue') : t('more.nothing')}
      </button>
    </>
  );
}
