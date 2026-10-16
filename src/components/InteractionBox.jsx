// Box s lékovými interakcemi.
// - Když nějaké jsou: žlutý box s ikonou varování a seznamem.
// - Když žádné nejsou: šedý informační box (nechceme pacientovi dát falešný klid).
import { Link } from 'react-router-dom';
import { WarningIcon, InfoIcon, ChevronIcon } from './Icons.jsx';
import { SEVERITY_LABELS } from '../labels.js';

// Plný výpis interakcí (obrazovka Moje léky)
export function InteractionList({ interactions }) {
  if (interactions.length === 0) {
    return (
      <div className="box box-info" role="status">
        <div className="box-title">
          <InfoIcon />
          <span>Interakce nenalezeny</span>
        </div>
        <p>Interakce nenalezeny v naší databázi. To neznamená, že žádné nejsou.</p>
        <p>
          <strong>Ukažte seznam lékaři.</strong>
        </p>
      </div>
    );
  }

  return (
    <div className="box box-warning" role="alert">
      <div className="box-title">
        <WarningIcon />
        <span>{interactions.length === 1 ? 'Možná interakce' : 'Možné interakce'}</span>
      </div>
      <ul className="interaction-list">
        {interactions.map((it) => (
          <li key={it.id}>
            <strong className="interaction-pair">
              {it.medA.name} + {it.medB.name}
            </strong>
            <span className="interaction-severity">{SEVERITY_LABELS[it.severity]}</span>
            <span>{it.description}</span>
          </li>
        ))}
      </ul>
      <Link to="/zprava" className="box-link">
        Ukázat lékaři
      </Link>
    </div>
  );
}

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
