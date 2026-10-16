// Export seznamu léků do formátu FHIR R4 – standard, kterému rozumí
// nemocniční informační systémy.
//
// Výsledek je "Bundle" (balík) typu "collection", který obsahuje:
//   - jednoho anonymního pacienta (Patient) – BEZ jména a jiných osobních údajů,
//   - pro každý lék, doplněk i onkologickou léčbu jeden MedicationStatement
//     ("pacient uvádí, že užívá…").
// Specifikace: https://hl7.org/fhir/R4/medicationstatement.html
import {
  DOSAGE_MODES,
  DOSE_TIMES,
  ITEM_TYPES,
  dateText,
  dosageText,
  oncoFormText,
  prescriberText,
} from './types.js';

// Denní doba → kód FHIR (EventTiming). HS = před spaním.
const FHIR_WHEN = { morning: 'MORN', noon: 'NOON', evening: 'EVE', night: 'HS' };

const SOURCE_TEXT = {
  box: 'fotka krabičky',
  note: 'fotka lístku od lékaře',
  manual: 'zadáno ručně pacientem',
};

const CATEGORY_TEXT = {
  [ITEM_TYPES.LEK]: 'Lék',
  [ITEM_TYPES.DOPLNEK]: 'Doplněk stravy / bylinka',
  [ITEM_TYPES.ONKO]: 'Onkologická léčba',
};

// Náhodné UUID. crypto.randomUUID funguje jen na https/localhost,
// na mobilu přes http://192.168… ne – proto záložní varianta.
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Dávkování → pole FHIR Dosage (pro 1-0-1-0 jedna položka za každou denní dobu). */
function toFhirDosage(item) {
  const d = item.dosage;
  const text = dosageText(d);
  if (!text) return undefined; // nevyplněno → pole dosage vůbec nebude

  if (d.mode === DOSAGE_MODES.AS_NEEDED) {
    return [{ text, asNeededBoolean: true }];
  }
  if (d.mode === DOSAGE_MODES.OTHER) {
    return [{ text }]; // volný text neumíme převést na strukturu
  }
  // Stejné "sequence" = dávky platí SOUBĚŽNĚ (ráno i večer každý den).
  // Různá čísla by ve FHIR znamenala "nejdřív tohle, potom tamto".
  return DOSE_TIMES.filter((t) => d[t.key] > 0).map((t) => ({
    sequence: 1,
    text: `${t.short} ${d[t.key]} ks`,
    timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd', when: [FHIR_WHEN[t.key]] } },
    doseAndRate: [{ doseQuantity: { value: d[t.key], unit: 'ks' } }],
  }));
}

/** Poznámky: zdroj údajů a vše, pro co FHIR nemá jednoduché pole. */
function toFhirNotes(item) {
  const lines = [
    `Zdroj: ${SOURCE_TEXT[item.source] ?? item.source}`,
    item.active_substance && `Účinná látka: ${item.active_substance}`,
    item.prescriber && `Předepsal: ${prescriberText(item.prescriber)}`,
    item.oncoForm && `Forma léčby: ${oncoFormText(item.oncoForm)}`,
    item.lastDose && `Poslední dávka / cyklus: ${dateText(item.lastDose)}`,
  ];
  return lines.filter(Boolean).map((text) => ({ text }));
}

/**
 * Sestaví FHIR R4 Bundle.
 * @param {import('./types.js').Item[]} items – všechny položky pacienta
 * @returns {Object} JSON objekt Bundle
 */
export function buildFhirBundle(items) {
  const now = new Date().toISOString();
  const patientUrl = `urn:uuid:${uuid()}`;

  const statements = items.map((item) => {
    const resource = {
      resourceType: 'MedicationStatement',
      status: 'active',
      category: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/medication-statement-category',
            code: 'patientspecified', // údaj uvádí pacient
          },
        ],
        text: CATEGORY_TEXT[item.type],
      },
      medicationCodeableConcept: { text: [item.name, item.strength].filter(Boolean).join(' ') },
      subject: { reference: patientUrl },
      dateAsserted: now,
      informationSource: { reference: patientUrl },
      note: toFhirNotes(item),
    };

    // "Užívám od" – FHIR přijme i jen rok ("2024") nebo rok-měsíc ("2024-03")
    if (item.since) resource.effectivePeriod = { start: item.since };

    const dosage = toFhirDosage(item);
    if (dosage) resource.dosage = dosage;

    return { fullUrl: `urn:uuid:${uuid()}`, resource };
  });

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: now,
    entry: [
      // Anonymní pacient – jen kvůli odkazům, žádné osobní údaje
      { fullUrl: patientUrl, resource: { resourceType: 'Patient', active: true } },
      ...statements,
    ],
  };
}

/** Stáhne Bundle jako soubor .json do zařízení. */
export function downloadFhir(items) {
  const bundle = buildFhirBundle(items);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
  const url = URL.createObjectURL(blob);

  // Trik pro stažení: vytvoříme neviditelný odkaz a "klikneme" na něj.
  const link = document.createElement('a');
  link.href = url;
  link.download = `pillgaze-fhir-${new Date().toLocaleDateString('sv-SE')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
