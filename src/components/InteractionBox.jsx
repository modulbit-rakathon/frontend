// Upozornění na lékové interakce.
import { Link } from 'react-router-dom';
import { WarningIcon, ChevronIcon } from './Icons.jsx';

// Krátké upozornění (obrazovka Domů) – celé je to odkaz na seznam léků.
export function InteractionSummary({ count }) {
  if (count === 0) return null;

  const label = count === 1 ? '1 možná interakce' : `${count} možné interakce`;

  return (
    <Link to="/leky" className="box box-warning box-row">
      <WarningIcon size={36} />
      <span className="box-row-text">
        <strong>{label}</strong>
        <span>Ukažte ji lékaři</span>
      </span>
      <ChevronIcon />
    </Link>
  );
}
