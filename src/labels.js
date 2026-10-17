// Texty, které se opakují na více místech, máme pohromadě tady.
// Samotné překlady jsou v src/i18n/.
import { joinList, t } from './i18n/index.js';

// Odkud lék pochází → štítek na kartě léku
export const SOURCE_LABELS = {
  get box() { return t('source.box'); },
  get note() { return t('source.note'); },
  get manual() { return t('source.manual'); },
};

// Odkud lék je, když ho backend sloučil z více fotek: ["box", "note"] → "z krabičky a z lístku"
export function sourcesText(med) {
  const list = med.sources?.length ? med.sources : [med.source];
  const texts = ['box', 'note', 'manual'].filter((s) => list.includes(s)).map((s) => SOURCE_LABELS[s]);
  return joinList(texts);
}

// Katalog píše názvy velkými písmeny ("PRESTARIUM NEO") – pro pacienta je
// převedeme na "Prestarium Neo". Slova s číslicí necháme, jak jsou.
export function catalogName(name) {
  return name
    .toLowerCase()
    .split(' ')
    .map((word) => (/\d/.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

// Závažnost interakce → text (barva nikdy nesmí být jediná informace)
export const SEVERITY_LABELS = {
  get high() { return t('severity.high'); },
  get medium() { return t('severity.medium'); },
};

// Název léku + síla, např. "Ibuprofen 400 mg".
// Backend někdy pošle sílu už v názvu ("IBUPROFEN 400 mg") – pak ji nepřidáváme podruhé.
export function medTitle(med) {
  if (!med.strength || med.name.toLowerCase().includes(med.strength.toLowerCase())) {
    return med.name;
  }
  // "Paralen 500" + "500 mg" → číslo už v názvu je, sílu nepřidáváme ("Paralen 500 500 mg" by mátlo)
  const number = med.strength.match(/^[\d,.]+/)?.[0];
  if (number && med.name.split(' ').includes(number)) {
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
  // Každý zdroj jen jednou a ve stálém pořadí
  const used = ['box', 'note', 'manual'].filter((s) =>
    items.some((i) => (i.sources?.length ? i.sources : [i.source]).includes(s)),
  );
  if (used.length === 0) return '';

  // "A, B a C" – spojku doplní joinList podle jazyka
  return t('sources.sentence', { list: joinList(used.map((s) => t(`sources.${s}`))) });
}

// Dávkování, např. "3× denně · 1 tableta"
export function medDosage(med) {
  return [med.frequency, med.amount].filter(Boolean).join(' · ');
}

// Správný tvar slova podle počtu: 1 lék, 2 léky, 5 léků (podle jazyka, viz 'count.meds')
export function pluralLeky(count) {
  return t('count.meds', { count });
}

// Zbývající čas platnosti kódu jako "2:41"
export function formatLeft(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}
