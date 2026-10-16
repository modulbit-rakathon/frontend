// Spodní lišta se 4 položkami. NavLink sám pozná, která stránka je aktivní,
// a přidá jí třídu "active" (zvýrazníme ji v CSS).
import { NavLink } from 'react-router-dom';
import { HomeIcon, CameraIcon, PillIcon, DocumentIcon } from './Icons.jsx';

const ITEMS = [
  { to: '/', label: 'Domů', Icon: HomeIcon },
  { to: '/vyfotit', label: 'Vyfotit', Icon: CameraIcon },
  { to: '/leky', label: 'Léky', Icon: PillIcon },
  { to: '/zprava', label: 'Zpráva', Icon: DocumentIcon },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Hlavní menu">
      {ITEMS.map(({ to, label, Icon }) => (
        // "end" u "/" = Domů je aktivní jen přesně na "/", ne na každé stránce
        <NavLink key={to} to={to} end={to === '/'} className="nav-item">
          <span className="nav-icon">
            <Icon />
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
