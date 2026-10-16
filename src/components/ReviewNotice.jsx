import { getShareIssues } from '@pillgaze/core';
import { Link } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { WarningIcon } from './Icons.jsx';

export default function ReviewNotice() {
  const { meds, analyses, unreadableCount, resolveAnalysis } = useMeds();
  const issues = getShareIssues(meds, { unreadableCount }).filter(issue => issue.code !== 'item_count' || meds.length > 50);
  if (!issues.length) return null;
  const indexes = [...new Set(issues.filter(issue => issue.index !== null).map(issue => issue.index))];
  function resolve(id) {
    if (window.confirm('Zkontrolovali jste původní fotku nebo lístek a doplnili všechny nepřečtené léky? Potvrďte jen tehdy, když seznam nic nevynechává.')) {
      try { resolveAnalysis(id); } catch { /* The persistent storage alert explains the failure. */ }
    }
  }
  return (
    <div className="box box-warning" role="status">
      <div className="box-title"><WarningIcon /><span>Seznam potřebuje kontrolu</span></div>
      <p>Dokud údaje nezkontrolujete, nelze vytvořit PIN.</p>
      {meds.length > 50 && <p>Sdílet lze nejvýše 50 položek.</p>}
      {indexes.map(index => (
        <Link className="box-link" key={meds[index].id} to={`/vyfotit?upravit=${encodeURIComponent(meds[index].id)}`}>
          Zkontrolovat: {meds[index].name || 'Nepojmenovaný lék'}
        </Link>
      ))}
      {analyses.filter(item => item.unreadableCount > 0 && !item.resolved).map((item, index) => (
        <div key={item.id}>
          <p>Fotka s neúplným výsledkem {index + 1}: nepřečtených položek {item.unreadableCount}.</p>
          <Link className="box-link" to="/vyfotit?rucne=1">Doplnit lék ručně</Link>
          <button type="button" className="btn-text" onClick={() => resolve(item.id)}>Všechny chybějící položky jsem ověřil/a a doplnil/a</button>
        </div>
      ))}
    </div>
  );
}

export function StorageNotice() {
  const { storageError, resetStorage } = useMeds();
  if (!storageError) return null;
  return (
    <div className="box box-warning" role="alert">
      <p>{storageError}</p>
      <button className="btn-text" type="button" onClick={() => {
        if (window.confirm('Opravdu smazat všechny místně uložené léky a začít znovu?')) resetStorage();
      }}>Smazat místní seznam</button>
    </div>
  );
}
