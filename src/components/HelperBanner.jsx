// Pruh nahoře v režimu pro blízké: je vždy vidět, za koho se léky vyplňují.
// Barva není jediná informace – je tam i text "Vyplňujete za".
import { useLocation } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { t, tRich } from '../i18n/index.js';
import { Link } from './TransitionLink.jsx';

export default function HelperBanner() {
  const { helper, meds } = useMeds();
  const { pathname } = useLocation();
  if (!helper) return null;

  return (
    <div className="helper-banner no-print" role="status">
      <p>
        {tRich('family.helpingFor', { name: <strong>{helper.name || t('family.defaultName')}</strong> })}
        <span className="helper-banner-sub">{t('family.ownSafe')}</span>
      </p>
      {/* Na obrazovce pro odeslání tlačítko nedává smysl */}
      {pathname !== '/blizky' && (
        <Link to="/blizky" className="btn btn-primary helper-banner-btn">
          {t('family.bannerDone', { count: meds.length })}
        </Link>
      )}
    </div>
  );
}
