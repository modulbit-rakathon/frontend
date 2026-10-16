// Obrazovka 3: Moje léky
// Každý lék je tlačítko s názvem. Po klepnutí se pod ním rozbalí podrobnosti.
// Otevřený může být vždy jen jeden lék (ID máme v `openId`).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { CameraIcon, ChevronIcon, PillIcon } from '../components/Icons.jsx';
import { SOURCE_LABELS, medTitle } from '../labels.js';

export default function Meds() {
  const { meds, removeMed } = useMeds();
  const [openId, setOpenId] = useState(null); // ID rozbaleného léku (null = žádný)

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

  // Klepnutí na otevřený lék ho zavře, na jiný lék ho otevře.
  function toggle(id) {
    setOpenId((current) => (current === id ? null : id));
  }

  function handleRemove(med) {
    if (window.confirm(`Opravdu odebrat lék ${med.name}?`)) {
      removeMed(med.id);
    }
  }

  return (
    <>
      <h1>Moje léky</h1>

      <ul className="med-list">
        {meds.map((med) => {
          const isOpen = openId === med.id;
          const detailsId = `med-details-${med.id}`;
          return (
            <li key={med.id} className="card med-card">
              {/* aria-expanded = čtečka obrazovky řekne, jestli je lék rozbalený */}
              <button
                type="button"
                className="med-toggle"
                aria-expanded={isOpen}
                aria-controls={detailsId}
                onClick={() => toggle(med.id)}
              >
                <span className="med-name">{medTitle(med)}</span>
                <span className={isOpen ? 'med-chevron med-chevron-open' : 'med-chevron'}>
                  <ChevronIcon />
                </span>
              </button>

              {isOpen && (
                <div id={detailsId} className="med-details">
                  <dl>
                    <dt>Síla</dt>
                    <dd>{med.strength || 'Nezadáno'}</dd>
                    <dt>Jak často</dt>
                    <dd>{med.frequency || 'Nezadáno'}</dd>
                    <dt>Kolik</dt>
                    <dd>{med.amount || 'Nezadáno'}</dd>
                    <dt>Zdroj</dt>
                    <dd>{SOURCE_LABELS[med.source]}</dd>
                  </dl>
                  <button type="button" className="btn-text" onClick={() => handleRemove(med)}>
                    Odebrat
                  </button>
                </div>
              )}
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
