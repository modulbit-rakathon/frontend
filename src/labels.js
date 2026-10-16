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

// Jen název léku, bez síly. Backend někdy pošle "IBUPROFEN 400 mg" a sílu
// zvlášť "400 mg" – tu z konce názvu uřízneme, ať se neukazuje dvakrát.
export function medName(med) {
  const name = med.name.trim();
  const strength = med.strength?.trim();
  if (strength && name.toLowerCase().endsWith(strength.toLowerCase())) {
    const cut = name.slice(0, name.length - strength.length).trim();
    if (cut) return cut; // když by z názvu nic nezbylo, necháme ho celý
  }
  return name;
}

// Věta do zprávy podle toho, odkud údaje skutečně pocházejí.
// Např. ["box", "manual"] → "Údaje pocházejí z fotek krabiček a z ručního zadání. Pacient je potvrdil."
export function sourcesSentence(items) {
  const parts = {
    box: 'z fotek krabiček',
    note: 'z fotky lístku od lékaře',
    manual: 'z ručního zadání',
  };
  // Každý zdroj jen jednou a ve stálém pořadí
  const used = ['box', 'note', 'manual'].filter((s) => items.some((i) => i.source === s));
  if (used.length === 0) return '';

  const texts = used.map((s) => parts[s]);
  const joined =
    texts.length === 1 ? texts[0] : `${texts.slice(0, -1).join(', ')} a ${texts[texts.length - 1]}`;
  return `Údaje pocházejí ${joined}. Pacient je potvrdil.`;
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
