// Obrazovka 4: Zpráva pro lékaře
// "Stáhnout PDF" zatím jen otevře tisk prohlížeče (window.print()).
// V tiskovém okně jde zvolit "Uložit jako PDF". Co se vytiskne, řídí
// sekce @media print v index.css (schová lištu, tlačítka atd.).
import { Link } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { CameraIcon, DownloadIcon, MedicIcon, WarningIcon } from '../components/Icons.jsx';
import { SOURCE_LABELS, SEVERITY_LABELS, medDosage } from '../labels.js';
import ReviewNotice from '../components/ReviewNotice.jsx';
import MedicationEvidence from '../components/MedicationEvidence.jsx';

export default function Report() {
  const { meds, interactions } = useMeds();

  // Dnešní datum v českém formátu, např. "16. 10. 2026"
  const today = new Date().toLocaleDateString('cs-CZ');

  if (meds.length === 0) {
    return (
      <>
        <h1>Zpráva pro lékaře</h1>
        <ReviewNotice />
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
      <ReviewNotice />

      {/* "Papír" se zprávou – tahle část se vytiskne */}
      <article className="report-paper">
        <header className="report-header">
          <h2>Farmakologická anamnéza</h2>
          <p>Datum: {today}</p>
        </header>

        {interactions.length > 0 && (
          <section className="report-interactions">
            <h3>
              <WarningIcon />
              Možné interakce ({interactions.length})
            </h3>
            <ul>
              {interactions.map((it) => (
                <li key={it.id}>
                  <strong>
                    {it.medA.name} + {it.medB.name}
                  </strong>{' '}
                  ({SEVERITY_LABELS[it.severity].toLowerCase()}) – {it.description}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3>Užívané léky ({meds.length})</h3>
          {/* Obal tabulky – na úzkém displeji jde tabulka posouvat do strany */}
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Lék</th>
                  <th>Síla</th>
                  <th>Dávkování</th>
                  <th>Zdroj</th>
                </tr>
              </thead>
              <tbody>
                {meds.map((med) => (
                  <tr key={med.id}>
                    <td>
                      <strong>{med.name}</strong>
                      <p>{[med.active_substance, med.form].filter(Boolean).join(' · ')}</p>
                      <MedicationEvidence med={med} />
                    </td>
                    <td>{med.strength || '–'}</td>
                    <td>{medDosage(med) || '–'}</td>
                    <td>{(med.sources ?? [med.source]).map(source => SOURCE_LABELS[source]).join(' + ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="report-note">
          Seznam sestavený pacientem; případné nevyřešené údaje jsou označené výše.
          Nejde o lékařsky ověřenou medikaci. Kontrola interakcí vychází jen z ukázkové databáze a nemusí být úplná.
        </p>
      </article>

      <Link to="/pin" className="btn btn-primary no-print">
        <MedicIcon />
        Sdílet s lékařem
      </Link>
      <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}>
        <DownloadIcon />
        Stáhnout PDF
      </button>
    </>
  );
}
