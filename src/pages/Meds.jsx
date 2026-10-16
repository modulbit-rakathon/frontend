// Obrazovka 3: Moje léky
// Každý lék je tlačítko s názvem. Po klepnutí se pod ním rozbalí podrobnosti.
// Otevřený může být vždy jen jeden lék (ID máme v `openId`).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { CameraIcon, ChevronIcon, PillIcon } from '../components/Icons.jsx';
import { medName, sourcesText } from '../labels.js';
import SpeakButton from '../components/SpeakButton.jsx';
import {
  ITEM_TYPES,
  ONCO_ANSWERS,
  dateText,
  dosageText,
  itemsOfType,
  oncoFormText,
  prescriberText,
  sinceText,
} from '../types.js';

export default function Meds() {
  const { meds: items, removeMed, profile } = useMeds();
  const [openId, setOpenId] = useState(null); // ID rozbaleného léku (null = žádný)

  // V jednom seznamu jsou léky i doplňky – rozdělíme je podle typu.
  const meds = itemsOfType(items, ITEM_TYPES.LEK);
  const supplements = itemsOfType(items, ITEM_TYPES.DOPLNEK);
  const treatments = itemsOfType(items, ITEM_TYPES.ONKO);

  // Prázdný stav – zatím nic
  if (items.length === 0) {
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
        <Link to="/doplnky" className="btn btn-link">
          Doplňky stravy a bylinky
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

      {/* ---------- Onkologická léčba (jen když pacient odpověděl "Ano") ---------- */}
      {profile.onco === 'ano' && (
        <section className="onco-section" aria-labelledby="onco-title">
          <h2 id="onco-title">Onkologická léčba</h2>
          {treatments.length === 0 ? (
            <p>Zatím nezadáno.</p>
          ) : (
            <ul className="onco-list">
              {treatments.map((t) => (
                <li key={t.id}>
                  <strong>{t.name}</strong>
                  {[oncoFormText(t.oncoForm), t.lastDose && `poslední dávka ${dateText(t.lastDose)}`]
                    .filter(Boolean)
                    .map((text) => ` · ${text}`)}
                </li>
              ))}
            </ul>
          )}
          <Link to="/onkologie" className="btn btn-secondary">
            {treatments.length === 0 ? 'Zadat léčbu' : 'Upravit léčbu'}
          </Link>
        </section>
      )}

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
                {/* Jen název – síla je v podrobnostech níž */}
                <span className="med-name">{medName(med)}</span>
                <span className={isOpen ? 'med-chevron med-chevron-open' : 'med-chevron'}>
                  <ChevronIcon />
                </span>
              </button>

              {isOpen && (
                <div id={detailsId} className="med-details">
                  <dl>
                    <dt>Síla</dt>
                    <dd>{med.strength || 'Nezadáno'}</dd>
                    <dt>Kdy a kolik</dt>
                    <dd>{dosageText(med.dosage) || 'Nezadáno'}</dd>
                    {med.since && (
                      <>
                        <dt>Užívám od</dt>
                        <dd>{sinceText(med.since)}</dd>
                      </>
                    )}
                    {med.prescriber && (
                      <>
                        <dt>Předepsal</dt>
                        <dd>{prescriberText(med.prescriber)}</dd>
                      </>
                    )}
                    <dt>Zdroj</dt>
                    <dd>{sourcesText(med)}</dd>
                  </dl>
                  <SpeakButton
                    text={[
                      medName(med),
                      med.strength && `síla ${med.strength}`,
                      dosageText(med.dosage) || 'dávkování nezadáno',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  />
                  <button type="button" className="btn-text" onClick={() => handleRemove(med)}>
                    Odebrat
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {meds.length === 0 && <p className="subtitle">Zatím žádné léky.</p>}

      <Link to="/vyfotit" className="btn btn-dashed">
        + Přidat lék
      </Link>

      {/* ---------- Doplňky stravy a bylinky ---------- */}
      <section className="list-section" aria-labelledby="supplements-title">
        <h2 id="supplements-title">Doplňky stravy a bylinky</h2>
        {supplements.length === 0 ? (
          <p className="subtitle">I bylinky a vitamíny jsou pro lékaře důležité.</p>
        ) : (
          <ul className="chip-list">
            {supplements.map((s) => (
              <li key={s.id} className="chip">
                {s.name}
              </li>
            ))}
          </ul>
        )}
        <Link to="/doplnky" className="btn btn-secondary">
          {supplements.length === 0 ? 'Berete i doplňky nebo bylinky?' : 'Upravit doplňky'}
        </Link>
      </section>

      {/* Odpověď na onkologii jde kdykoli změnit */}
      {profile.onco !== 'ano' && (
        <p className="onco-answer">
          Léčba na onkologii:{' '}
          <strong>{ONCO_ANSWERS.find((a) => a.key === profile.onco)?.label ?? 'neodpovězeno'}</strong>{' '}
          <Link to="/onkologie">Změnit</Link>
        </p>
      )}
    </>
  );
}
