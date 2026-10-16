// Obrazovka 4: Zpráva pro lékaře
// Pacient ji ukáže lékaři nebo ji nasdílí kódem (/pin).
// "Stáhnout PDF" a export FHIR jsou jen v lékařském pohledu (/doc).
import { Link } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { CameraIcon, MedicIcon } from '../components/Icons.jsx';
import { medName, sourcesSentence, sourcesText } from '../labels.js';
import SpeakButton from '../components/SpeakButton.jsx';
import { getLang, localeOf, t } from '../i18n/index.js';
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

export default function Report() {
  const { meds: items, profile } = useMeds();

  // V jednom seznamu jsou léky i doplňky – ve zprávě je dáme do samostatných sekcí.
  const meds = itemsOfType(items, ITEM_TYPES.LEK);
  const supplements = itemsOfType(items, ITEM_TYPES.DOPLNEK);
  const treatments = itemsOfType(items, ITEM_TYPES.ONKO);

  // Text pro tlačítko "Přečíst nahlas" – celá zpráva jako souvislé věty.
  const speechText = [
    treatments.length > 0 &&
      t('report.speakOnco', {
        list: treatments
          .map((item) => [item.name, oncoFormText(item.oncoForm), item.lastDose && t('common.lastDose', { date: dateText(item.lastDose) })].filter(Boolean).join(', '))
          .join('. '),
      }),
    meds.length > 0 &&
      t('report.speakMeds', {
        list: meds.map((m) => [medName(m), m.strength, dosageText(m.dosage)].filter(Boolean).join(', ')).join('. '),
      }),
    supplements.length > 0 && t('report.speakSupplements', { list: supplements.map(itemName).join(', ') }),
  ]
    .filter(Boolean)
    .join(' ');

  // Dnešní datum podle jazyka, např. "16. 10. 2026"
  const today = new Date().toLocaleDateString(localeOf());

  if (items.length === 0) {
    return (
      <>
        <h1>{t('report.title')}</h1>
        <p className="subtitle">{t('common.noMedsYet')}</p>
        <Link to="/vyfotit" className="btn btn-primary">
          <CameraIcon />
          {t('common.photoMed')}
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="no-print">
        <h1>{t('report.title')}</h1>
        <p className="subtitle">{t('report.subtitle')}</p>
      </div>

      {/* "Papír" se zprávou – tahle část se vytiskne */}
      <article className="report-paper">
        <header className="report-header">
          <h2>{t('report.heading')}</h2>
          <p>{t('report.date', { date: today })}</p>
        </header>

        {/* Interakce se pacientovi záměrně NEUKAZUJÍ – vidí je jen lékař na /doc. */}

        {/* Onkologická léčba je ve zprávě ÚPLNĚ NAHOŘE (zadání MOÚ) */}
        <section className="report-onco">
          <h3>{t('common.oncoTreatment')}</h3>
          {treatments.length > 0 ? (
            <ul className="report-list">
              {treatments.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  {oncoFormText(item.oncoForm) && ` – ${oncoFormText(item.oncoForm).toLocaleLowerCase(getLang())}`}
                  {item.lastDose && `, ${t('report.lastDoseCycle', { date: dateText(item.lastDose) })}`}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {profile.onco === 'ano'
                ? t('report.oncoNotEntered')
                : t('report.oncoAnswer', {
                    answer: (ONCO_ANSWERS.find((a) => a.key === profile.onco)?.label ?? t('common.unanswered')).toLocaleLowerCase(getLang()),
                  })}
            </p>
          )}
        </section>

        <section>
          <h3>{t('report.meds', { count: meds.length })}</h3>
          {meds.length === 0 && <p>{t('report.noMeds')}</p>}
          {/* Obal tabulky – na úzkém displeji jde tabulka posouvat do strany */}
          {meds.length > 0 && (
          <div className="table-wrap">
            <table className="report-table report-table-stack">
              <thead>
                <tr>
                  <th>{t('report.col.med')}</th>
                  <th>{t('report.col.strength')}</th>
                  <th>{t('report.col.dosage')}</th>
                  <th>{t('report.col.since')}</th>
                  <th>{t('report.col.source')}</th>
                </tr>
              </thead>
              <tbody>
                {meds.map((med) => (
                  <tr key={med.id}>
                    <td>
                      <strong>{medName(med)}</strong>
                    </td>
                    <td data-label={t('report.col.strength')}>{med.strength || '–'}</td>
                    <td data-label={t('report.col.dosage')}>{dosageText(med.dosage) || '–'}</td>
                    <td data-label={t('report.col.since')}>{[sinceText(med.since), prescriberText(med.prescriber)].filter(Boolean).join(', ') || '–'}</td>
                    <td data-label={t('report.col.source')}>{sourcesText(med)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>

        {supplements.length > 0 && (
          <section>
            <h3>{t('report.supplements', { count: supplements.length })}</h3>
            <ul className="report-list">
              {supplements.map((s) => (
                <li key={s.id}>{itemName(s)}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Věta podle skutečných zdrojů (fotka krabičky / lístek / ručně) */}
        <p className="report-note">{sourcesSentence(meds)}</p>
      </article>

      <SpeakButton text={speechText} />
      <Link to="/pin" className="btn btn-primary no-print">
        <MedicIcon />
        {t('report.share')}
      </Link>
    </>
  );
}
