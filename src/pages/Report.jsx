// Obrazovka 4: Zpráva pro lékaře
// Pacient ji ukáže lékaři nebo ji nasdílí kódem (/pin).
// "Stáhnout PDF" a export FHIR jsou jen v lékařském pohledu (/doc).
import { Link } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { CameraIcon, MedicIcon } from '../components/Icons.jsx';
import { medName, sourcesSentence, sourcesText } from '../labels.js';
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

export default function Report() {
  const { meds: items, profile } = useMeds();

  // V jednom seznamu jsou léky i doplňky – ve zprávě je dáme do samostatných sekcí.
  const meds = itemsOfType(items, ITEM_TYPES.LEK);
  const supplements = itemsOfType(items, ITEM_TYPES.DOPLNEK);
  const treatments = itemsOfType(items, ITEM_TYPES.ONKO);

  // Text pro tlačítko "Přečíst nahlas" – celá zpráva jako souvislé věty.
  const speechText = [
    treatments.length > 0 &&
      `Onkologická léčba: ${treatments
        .map((t) => [t.name, oncoFormText(t.oncoForm), t.lastDose && `poslední dávka ${dateText(t.lastDose)}`].filter(Boolean).join(', '))
        .join('. ')}.`,
    meds.length > 0 &&
      `Užívané léky: ${meds
        .map((m) => [medName(m), m.strength, dosageText(m.dosage)].filter(Boolean).join(', '))
        .join('. ')}.`,
    supplements.length > 0 && `Doplňky stravy a bylinky: ${supplements.map((s) => s.name).join(', ')}.`,
  ]
    .filter(Boolean)
    .join(' ');

  // Dnešní datum v českém formátu, např. "16. 10. 2026"
  const today = new Date().toLocaleDateString('cs-CZ');

  if (items.length === 0) {
    return (
      <>
        <h1>Zpráva pro lékaře</h1>
        <p className="subtitle">Zatím nemáte žádné léky. Nejdřív nějaký přidejte.</p>
        <Link to="/vyfotit" className="btn btn-primary">
          <CameraIcon />
          Vyfotit lék
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="no-print">
        <h1>Zpráva pro lékaře</h1>
        <p className="subtitle">Ukažte ji při návštěvě</p>
      </div>

      {/* "Papír" se zprávou – tahle část se vytiskne */}
      <article className="report-paper">
        <header className="report-header">
          <h2>Farmakologická anamnéza</h2>
          <p>Datum: {today}</p>
        </header>

        {/* Interakce se pacientovi záměrně NEUKAZUJÍ – vidí je jen lékař na /doc. */}

        {/* Onkologická léčba je ve zprávě ÚPLNĚ NAHOŘE (zadání MOÚ) */}
        <section className="report-onco">
          <h3>Onkologická léčba</h3>
          {treatments.length > 0 ? (
            <ul className="report-list">
              {treatments.map((t) => (
                <li key={t.id}>
                  <strong>{t.name}</strong>
                  {oncoFormText(t.oncoForm) && ` – ${oncoFormText(t.oncoForm).toLowerCase()}`}
                  {t.lastDose && `, poslední dávka / cyklus ${dateText(t.lastDose)}`}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {profile.onco === 'ano'
                ? 'Pacient se léčí na onkologii, léčbu zatím nezadal.'
                : `Léčí se na onkologii: ${(ONCO_ANSWERS.find((a) => a.key === profile.onco)?.label ?? 'neodpovězeno').toLowerCase()}.`}
            </p>
          )}
        </section>

        <section>
          <h3>Užívané léky ({meds.length})</h3>
          {meds.length === 0 && <p>Žádné léky nezadány.</p>}
          {/* Obal tabulky – na úzkém displeji jde tabulka posouvat do strany */}
          {meds.length > 0 && (
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Lék</th>
                  <th>Síla</th>
                  <th>Dávkování</th>
                  <th>Od / předepsal</th>
                  <th>Zdroj</th>
                </tr>
              </thead>
              <tbody>
                {meds.map((med) => (
                  <tr key={med.id}>
                    <td>
                      <strong>{medName(med)}</strong>
                    </td>
                    <td>{med.strength || '–'}</td>
                    <td>{dosageText(med.dosage) || '–'}</td>
                    <td>{[sinceText(med.since), prescriberText(med.prescriber)].filter(Boolean).join(', ') || '–'}</td>
                    <td>{sourcesText(med)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>

        {supplements.length > 0 && (
          <section>
            <h3>Doplňky stravy a bylinky ({supplements.length})</h3>
            <ul className="report-list">
              {supplements.map((s) => (
                <li key={s.id}>{s.name}</li>
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
        Sdílet s lékařem
      </Link>
    </>
  );
}
