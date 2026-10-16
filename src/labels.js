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

// Název léku + síla, např. "Ibuprofen 400 mg"
export function medTitle(med) {
  return [med.name, med.strength].filter(Boolean).join(' ');
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
