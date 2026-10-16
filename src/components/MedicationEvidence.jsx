import { FIELD_LABELS, SOURCE_LABELS, NOTE_STYLE_LABELS } from '../labels.js';

export default function MedicationEvidence({ med }) {
  const originals = med._core?.evidence?.map(item => item._core?.original ?? item)
    ?? [med._core?.original ?? med];
  return (
    <details className="med-evidence">
      <summary>Původní údaje a zdroje</summary>
      {originals.map((original, index) => (
        <div key={index}>
          <p>{SOURCE_LABELS[original.source]}{original.note_style ? ` · ${NOTE_STYLE_LABELS[original.note_style]}` : ''}</p>
          <dl>
            {Object.entries(FIELD_LABELS).map(([field, label]) => (
              <div key={field}><dt>{label}</dt><dd>{original[field] || 'Nezjištěno'}</dd></div>
            ))}
          </dl>
        </div>
      ))}
      {med._core?.catalogSelection?.active && <p>Látka a forma byly nabídnuty z katalogu SÚKL. Výběr není doporučení náhrady léku.</p>}
      {med.conflicts?.map(conflict => (
        <p key={conflict.field}><strong>Rozpor: {FIELD_LABELS[conflict.field]}.</strong>{' '}
          {conflict.values.map(item => `${SOURCE_LABELS[item.source]}: ${item.value}`).join(' / ')}
        </p>
      ))}
    </details>
  );
}
