// Pruh nahoře v režimu pro blízké: je vždy vidět, za koho se léky vyplňují.
// Barva není jediná informace – je tam i text "Vyplňujete za".
import { Link, useLocation } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';

export default function HelperBanner() {
  const { helper, meds } = useMeds();
  const { pathname } = useLocation();
  if (!helper) return null;

  return (
    <div className="helper-banner no-print" role="status">
      <p>
        Vyplňujete za: <strong>{helper.name || 'blízkého člověka'}</strong>
        <span className="helper-banner-sub">Vaše vlastní léky zůstávají beze změny.</span>
      </p>
      {/* Na obrazovce pro odeslání tlačítko nedává smysl */}
      {pathname !== '/blizky' && (
        <Link to="/blizky" className="btn btn-primary helper-banner-btn">
          Hotovo – poslat zpět ({meds.length})
        </Link>
      )}
    </div>
  );
}
