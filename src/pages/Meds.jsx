// Obrazovka 3: Moje léky
// Každý lék je tlačítko s názvem. Po klepnutí se pod ním rozbalí podrobnosti.
// Otevřený může být vždy jen jeden lék (ID máme v `openId`).
import { useState } from 'react';
import { mergeMedications } from '@pillgaze/core';
import { Link } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { CameraIcon, ChevronIcon, PillIcon } from '../components/Icons.jsx';
import { SOURCE_LABELS, medTitle } from '../labels.js';
import ReviewNotice from '../components/ReviewNotice.jsx';
import MedicationEvidence from '../components/MedicationEvidence.jsx';
import MedForm from '../components/MedForm.jsx';
import { loadCatalog, makeId, prepareForReview } from '../core.js';

export default function Meds() {
  const { meds, removeMed, replaceMerged } = useMeds();
  const [openId, setOpenId] = useState(null); // ID rozbaleného léku (null = žádný)
  const [selected, setSelected] = useState([]);
  const [mergeDraft, setMergeDraft] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');

  async function prepareMerge() {
    const originals = meds.filter(med => selected.includes(med.id));
    if (originals.length < 2 || !window.confirm(`Jsou tyto záznamy skutečně tentýž užívaný lék?\n${originals.map(medTitle).join('\n')}\nRůzné síly ani samostatně užívané přípravky neslučujte.`)) return;
    setMerging(true);
    setMergeError('');
    try {
      const catalog = await loadCatalog();
      const med = mergeMedications(originals.map(item => prepareForReview(item, catalog)), {
        catalog, mergedId: makeId(), groupConfirmed: true,
      });
      setMergeDraft({ med, originals });
    } catch {
      setMergeError('Záznamy nelze sloučit. Zkontrolujte načtení katalogu a neslučujte onkologický režim s jednotlivým lékem.');
    } finally {
      setMerging(false);
    }
  }

  // Prázdný stav – zatím žádné léky
  if (meds.length === 0) {
    return (
      <>
        <h1>Moje léky</h1>
        <ReviewNotice />
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
      try { removeMed(med.id); } catch { /* StorageNotice keeps the failed operation visible. */ }
    }
  }

  return (
    <>
      <h1>Moje léky</h1>
      <ReviewNotice />

      {mergeDraft && (
        <section className="box box-info">
          <h2>Zkontrolujte sloučený záznam</h2>
          <p>Původní záznamy nahradíme až po uložení. Rozpory je nutné vyřešit před sdílením.</p>
          <MedForm key={mergeDraft.med.id} initial={mergeDraft.med} editing onSubmit={saved => {
            replaceMerged(saved, mergeDraft.originals);
            setMergeDraft(null);
            setSelected([]);
          }} />
          <button type="button" className="btn btn-secondary" onClick={() => setMergeDraft(null)}>Zrušit sloučení</button>
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
                    <dt>Účinná látka</dt>
                    <dd>{med.active_substance || 'Nezadáno'}</dd>
                    <dt>Léková forma</dt>
                    <dd>{med.form || 'Nezadáno'}</dd>
                    <dt>Jak často</dt>
                    <dd>{med.frequency || 'Nezadáno'}</dd>
                    <dt>Kolik</dt>
                    <dd>{med.amount || 'Nezadáno'}</dd>
                    <dt>Zdroj</dt>
                    <dd>{(med.sources ?? [med.source]).map(source => SOURCE_LABELS[source]).join(' + ')}</dd>
                  </dl>
                  <MedicationEvidence med={med} />
                  <Link className="btn-text" to={`/vyfotit?upravit=${encodeURIComponent(med.id)}`}>Zkontrolovat nebo upravit</Link>
                  <button type="button" className="btn-text" onClick={() => handleRemove(med)}>
                    Odebrat
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {meds.length > 1 && !mergeDraft && (
        <details className="med-evidence">
          <summary>Sloučit více záznamů stejného léku</summary>
          <p>Jen pokud jde o tentýž užívaný lék opsaný z více zdrojů. Nic neslučujeme automaticky.</p>
          {meds.map(med => (
            <div className="field" key={med.id}>
              <label className="field-confirmation">
                <input type="checkbox" checked={selected.includes(med.id)} onChange={event => {
                  setSelected(previous => event.target.checked ? [...previous, med.id] : previous.filter(id => id !== med.id));
                }} />
                {medTitle(med)} ({SOURCE_LABELS[med.source]})
              </label>
            </div>
          ))}
          {mergeError && <p role="alert">{mergeError}</p>}
          <button type="button" className="btn btn-secondary" disabled={selected.length < 2 || merging} onClick={prepareMerge}>
            {merging ? 'Připravuji sloučení…' : 'Porovnat vybrané záznamy'}
          </button>
        </details>
      )}

      <Link to="/vyfotit" className="btn btn-dashed">
        + Přidat lék
      </Link>
    </>
  );
}
