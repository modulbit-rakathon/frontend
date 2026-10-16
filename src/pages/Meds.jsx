// Obrazovka 3: Moje léky
import { Link } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { InteractionList } from '../components/InteractionBox.jsx';
import { CameraIcon, PillIcon, WarningIcon } from '../components/Icons.jsx';
import { SOURCE_LABELS, medTitle } from '../labels.js';

export default function Meds() {
  const { meds, removeMed, interactions } = useMeds();

  // Prázdný stav – zatím žádné léky
  if (meds.length === 0) {
    return (
      <>
        <h1>Moje léky</h1>
        <div className="empty-state">
          <PillIcon size={96} />
          <h2>Zatím tu nejsou žádné léky</h2>
          <p>Začněte vyfocením krabičky nebo lístku od lékaře.</p>
        </div>
        <Link to="/vyfotit" className="btn btn-primary">
          <CameraIcon />
          Vyfotit lék
        </Link>
        <Link to="/vyfotit?rucne=1" className="btn btn-link">
          Zadat ručně
        </Link>
      </>
    );
  }

  // ID všech léků, které mají nějakou interakci (aby šly na kartě zvýraznit)
  const medsWithInteraction = new Set(interactions.flatMap((it) => [it.medA.id, it.medB.id]));

  function handleRemove(med) {
    if (window.confirm(`Opravdu odebrat lék ${med.name}?`)) {
      removeMed(med.id);
    }
  }

  return (
    <>
      <h1>Moje léky</h1>

      <InteractionList interactions={interactions} />

      <ul className="med-list">
        {meds.map((med) => {
          const hasInteraction = medsWithInteraction.has(med.id);
          return (
            <li key={med.id} className={hasInteraction ? 'card med-card med-card-warning' : 'card med-card'}>
              <div className="med-card-top">
                <h2 className="med-name">{medTitle(med)}</h2>
                {hasInteraction && (
                  <span className="med-warning">
                    <WarningIcon />
                    Interakce
                  </span>
                )}
              </div>
              <p className="med-dosage">
                {med.frequency || 'Dávkování nezadáno'}
                {med.amount && ` · ${med.amount}`}
              </p>
              <div className="med-card-bottom">
                <span className="tag">{SOURCE_LABELS[med.source]}</span>
                <button type="button" className="btn-text" onClick={() => handleRemove(med)}>
                  Odebrat
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Link to="/vyfotit" className="btn btn-dashed">
        + Přidat lék
      </Link>
    </>
  );
}
