// Spodní lišta se 4 položkami. NavLink sám pozná, která stránka je aktivní,
// a přidá jí třídu "active" (zvýrazníme ji v CSS).
import { NavLink } from './TransitionLink.jsx';
import { HomeIcon, CameraIcon, PillIcon, DocumentIcon } from './Icons.jsx';
import { t } from '../i18n/index.js';

// label = klíč textu v src/i18n/
const ITEMS = [
  { to: '/', label: 'nav.home', Icon: HomeIcon },
  { to: '/vyfotit', label: 'nav.scan', Icon: CameraIcon },
  { to: '/leky', label: 'nav.meds', Icon: PillIcon },
  { to: '/zprava', label: 'nav.report', Icon: DocumentIcon },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label={t('nav.label')}>
      {ITEMS.map(({ to, label, Icon }, index) => (
        // "end" u "/" = Domů je aktivní jen přesně na "/", ne na každé stránce
        <NavLink key={to} to={to} end={to === '/'} className="nav-item" data-nav-index={index}>
          <span className="nav-icon">
            <Icon />
          </span>
          <span className="nav-label">{t(label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
