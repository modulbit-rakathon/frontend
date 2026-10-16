// Obrazovka 3: Moje léky
// Každý lék je tlačítko s názvem. Po klepnutí se pod ním rozbalí podrobnosti.
// Otevřený může být vždy jen jeden lék (ID máme v `openId`).
import { useState } from 'react';
import { Link } from '../components/TransitionLink.jsx';
import { useMeds } from '../context/MedsContext.jsx';
import { CameraIcon, ChevronIcon, PillIcon } from '../components/Icons.jsx';
import { medName, sourcesText } from '../labels.js';
import SpeakButton from '../components/SpeakButton.jsx';
import MedEdit from '../components/MedEdit.jsx';
import { t } from '../i18n/index.js';
import {
  ITEM_TYPES,
  ONCO_ANSWERS,
  dateText,
  dosageText,
  itemName,
  itemsOfType,
  oncoFormText,
  prescriberText,
  sinceText,
} from '../types.js';

export default function Meds() {
  const { meds: items, removeMed, profile } = useMeds();
  const [openId, setOpenId] = useState(null); // ID rozbaleného léku (null = žádný)
  // ID léku, který se upravuje – vždy jen jeden (formulář má pevná id polí)
  const [editingId, setEditingId] = useState(null);

  // V jednom seznamu jsou léky i doplňky – rozdělíme je podle typu.
  const meds = itemsOfType(items, ITEM_TYPES.LEK);
  const supplements = itemsOfType(items, ITEM_TYPES.DOPLNEK);
  const treatments = itemsOfType(items, ITEM_TYPES.ONKO);

  // Prázdný stav – zatím nic
  if (items.length === 0) {
    return (
      <>
        <h1>{t('meds.title')}</h1>
        <div className="empty-state">
          <PillIcon size={96} />
          <h2>{t('meds.emptyTitle')}</h2>
          <p>{t('meds.emptyText')}</p>
        </div>
        <Link to="/vyfotit" className="btn btn-primary">
          <CameraIcon />
          {t('common.photoMed')}
        </Link>
        <Link to="/vyfotit?rucne=1" className="btn btn-link">
          {t('common.enterManually')}
        </Link>
        <Link to="/doplnky" className="btn btn-link">
          {t('common.supplements')}
        </Link>
      </>
    );
  }

  // Klepnutí na otevřený lék ho zavře, na jiný lék ho otevře.
  function toggle(id) {
    setOpenId((current) => (current === id ? null : id));
    setEditingId(null);
  }

  function handleRemove(med) {
    if (window.confirm(t('meds.confirmRemove', { name: med.name }))) {
      removeMed(med.id);
    }
  }

  return (
    <>
      <h1>{t('meds.title')}</h1>

      {/* ---------- Onkologická léčba (jen když pacient odpověděl "Ano") ---------- */}
      {profile.onco === 'ano' && (
        <section className="onco-section" aria-labelledby="onco-title">
          <h2 id="onco-title">{t('common.oncoTreatment')}</h2>
          {treatments.length === 0 ? (
            <p>{t('meds.oncoNone')}</p>
          ) : (
            <ul className="onco-list">
              {treatments.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  {[oncoFormText(item.oncoForm), item.lastDose && t('common.lastDose', { date: dateText(item.lastDose) })]
                    .filter(Boolean)
                    .map((text) => ` · ${text}`)}
                </li>
              ))}
            </ul>
          )}
          <Link to="/onkologie" className="btn btn-secondary">
            {treatments.length === 0 ? t('meds.oncoAdd') : t('meds.oncoEdit')}
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

              {isOpen && editingId === med.id && (
                <div id={detailsId}>
                  <MedEdit med={med} onDone={() => setEditingId(null)} />
                </div>
              )}

              {isOpen && editingId !== med.id && (
                <div id={detailsId} className="med-details">
                  <dl>
                    <dt>{t('meds.strength')}</dt>
                    <dd>{med.strength || t('common.notEntered')}</dd>
                    <dt>{t('meds.whenHowMuch')}</dt>
                    <dd>{dosageText(med.dosage) || t('common.notEntered')}</dd>
                    {med.since && (
                      <>
                        <dt>{t('meds.since')}</dt>
                        <dd>{sinceText(med.since)}</dd>
                      </>
                    )}
                    {med.prescriber && (
                      <>
                        <dt>{t('meds.prescriber')}</dt>
                        <dd>{prescriberText(med.prescriber)}</dd>
                      </>
                    )}
                    <dt>{t('meds.source')}</dt>
                    <dd>{sourcesText(med)}</dd>
                  </dl>
                  <SpeakButton
                    text={[
                      medName(med),
                      med.strength && t('meds.speakStrength', { strength: med.strength }),
                      dosageText(med.dosage) || t('meds.speakNoDosage'),
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  />
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingId(med.id)}>
                    {t('meds.edit')}
                  </button>
                  <button type="button" className="btn-text" onClick={() => handleRemove(med)}>
                    {t('common.remove')}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {meds.length === 0 && <p className="subtitle">{t('meds.none')}</p>}

      <Link to="/vyfotit" className="btn btn-dashed">
        {t('meds.add')}
      </Link>

      {/* ---------- Doplňky stravy a bylinky ---------- */}
      <section className="list-section" aria-labelledby="supplements-title">
        <h2 id="supplements-title">{t('common.supplements')}</h2>
        {supplements.length === 0 ? (
          <p className="subtitle">{t('common.supplementsMatter')}</p>
        ) : (
          <ul className="chip-list">
            {supplements.map((s) => (
              <li key={s.id} className="chip">
                {itemName(s)}
              </li>
            ))}
          </ul>
        )}
        <Link to="/doplnky" className="btn btn-secondary">
          {supplements.length === 0 ? t('meds.supplementsAsk') : t('meds.supplementsEdit')}
        </Link>
      </section>

      {/* Odpověď na onkologii jde kdykoli změnit */}
      {profile.onco !== 'ano' && (
        <p className="onco-answer">
          {t('meds.oncoAnswer')}{' '}
          <strong>{ONCO_ANSWERS.find((a) => a.key === profile.onco)?.label ?? t('common.unanswered')}</strong>{' '}
          <Link to="/onkologie">{t('meds.change')}</Link>
        </p>
      )}
    </>
  );
}
