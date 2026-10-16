// Spodní lišta se 4 položkami. NavLink sám pozná, která stránka je aktivní,
// a přidá jí třídu "active" (zvýrazníme ji v CSS).
import { NavLink, useLocation } from 'react-router-dom';
import { HomeIcon, CameraIcon, PillIcon, DocumentIcon } from './Icons.jsx';
import { t } from '../i18n/index.js';
import { setNavDirection, tabDirection } from '../navTransition.js';

// label = klíč textu v src/i18n/
const ITEMS = [
  { to: '/', label: 'nav.home', Icon: HomeIcon },
  { to: '/vyfotit', label: 'nav.scan', Icon: CameraIcon },
  { to: '/leky', label: 'nav.meds', Icon: PillIcon },
  { to: '/zprava', label: 'nav.report', Icon: DocumentIcon },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="bottom-nav" aria-label={t('nav.label')}>
      {ITEMS.map(({ to, label, Icon }) => (
        // "end" u "/" = Domů je aktivní jen přesně na "/", ne na každé stránce
        // onClick = směr animace podle pořadí záložek (doprava = dopředu, doleva = zpět)
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="nav-item"
          onClick={() => setNavDirection(tabDirection(pathname, to))}
        >
          <span className="nav-icon">
            <Icon />
          </span>
          <span className="nav-label">{t(label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
