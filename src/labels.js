// Texty, které se opakují na více místech, máme pohromadě tady.

// Odkud lék pochází → štítek na kartě léku
export const SOURCE_LABELS = {
  box: 'z krabičky',
  note: 'z lístku',
  manual: 'ručně',
};

// Závažnost interakce → text (barva nikdy nesmí být jediná informace)
export const SEVERITY_LABELS = {
  high: 'Vysoké riziko',
  medium: 'Střední riziko',
};

// Název léku + síla, např. "Ibuprofen 400 mg".
// Backend někdy pošle sílu už v názvu ("IBUPROFEN 400 mg") – pak ji nepřidáváme podruhé.
export function medTitle(med) {
  if (!med.strength || med.name.toLowerCase().includes(med.strength.toLowerCase())) {
    return med.name;
  }
  return `${med.name} ${med.strength}`;
}

// Dávkování, např. "3× denně · 1 tableta"
export function medDosage(med) {
  return [med.frequency, med.amount].filter(Boolean).join(' · ');
}

// Správný tvar slova podle počtu: 1 lék, 2 léky, 5 léků
export function pluralLeky(count) {
  if (count === 1) return '1 lék';
  if (count >= 2 && count <= 4) return `${count} léky`;
  return `${count} léků`;
}
