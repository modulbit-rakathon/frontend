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
import { t } from './i18n/index.js';

// Denní doba → kód FHIR (EventTiming). HS = před spaním.
const FHIR_WHEN = { morning: 'MORN', noon: 'NOON', evening: 'EVE', night: 'HS' };

// Texty v souboru jsou v jazyce, který má lékař právě zapnutý.
const SOURCES = ['box', 'note', 'manual'];
const CATEGORIES = Object.values(ITEM_TYPES); // lek, doplnek, onko

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
  return DOSE_TIMES.filter((time) => d[time.key] > 0).map((time) => ({
    sequence: 1,
    text: `${time.short} ${d[time.key]} ${t('unit.pieces')}`,
    timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd', when: [FHIR_WHEN[time.key]] } },
    doseAndRate: [{ doseQuantity: { value: d[time.key], unit: t('unit.pieces') } }],
  }));
}

/** Poznámky: zdroj údajů a vše, pro co FHIR nemá jednoduché pole. */
// "síla (původně 5 mg)"
function doctorEditText(item, field) {
  const { original } = item.doctorEdits;
  const value = field === 'dosage' ? [original.frequency, original.amount].filter(Boolean).join(' · ') : original[field];
  return t('fhir.doctorEdit.field', { field: t(`fhir.field.${field}`), value: value || '—' });
}

function toFhirNotes(item) {
  const lines = [
    // U léku z lístku i z krabičky jsou zdroje dva. Režim od lékaře má source 'manual'
    // jen kvůli backendu – "zadáno ručně pacientem" by nebyla pravda.
    !item.addedByDoctor && t('fhir.source', {
      list: (item.sources?.length ? item.sources : [item.source])
        .map((s) => (SOURCES.includes(s) ? t(`fhir.source.${s}`) : s))
        .join(' + '),
    }),
    item.active_substance && t('fhir.substance', { value: item.active_substance }),
    item.prescriber && t('fhir.prescriber', { value: prescriberText(item.prescriber) }),
    item.oncoForm && t('fhir.oncoForm', { value: oncoFormText(item.oncoForm) }),
    item.lastDose && t('fhir.lastDose', { date: dateText(item.lastDose) }),
    // Opravy lékaře v /doc – původní zdroj se nesmí vydávat za autora opravy
    item.doctorEdits && t('fhir.doctorEdit', { list: item.doctorEdits.fields.map((f) => doctorEditText(item, f)).join('; ') }),
    item.doctorEdits?.unverified && t('fhir.unverified'),
    // Forma léčby z lékařského pohledu je už text (od pacienta / lékaře), ne klíč
    !item.oncoForm && item.type === 'onko' && item.form && t('fhir.oncoForm', { value: item.form }),
    // Léčba upravená lékařem v /doc
    item.regimenEdits &&
      t('fhir.doctorEdit', {
        list: item.regimenEdits.fields
          .map((f) => {
            // Poslední dávka je uložená jako "poslední dávka/cyklus 1. 10. 2026" – stačí datum
            const value = item.regimenEdits.original[f]?.replace(/^poslední dávka\/cyklus\s*/, '');
            return t('fhir.doctorEdit.field', { field: t(`fhir.field.${f}`), value: value || '—' });
          })
          .join('; '),
      }),
    // Léčba doplněná lékařem v /doc – pacient ji neuvedl
    item.addedByDoctor && t('fhir.addedByDoctor'),
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
        // "patientspecified" = údaj uvádí pacient. U režimu doplněného lékařem to neplatí.
        coding: item.addedByDoctor
          ? undefined
          : [
              {
                system: 'http://terminology.hl7.org/CodeSystem/medication-statement-category',
                code: 'patientspecified',
              },
            ],
        text: CATEGORIES.includes(item.type) ? t(`fhir.category.${item.type}`) : undefined,
      },
      medicationCodeableConcept: { text: [item.name, item.strength].filter(Boolean).join(' ') },
      subject: { reference: patientUrl },
      dateAsserted: now,
      // Kdo údaj uvedl: pacient, nebo lékař v /doc (anonymně, jen popisem)
      informationSource: item.addedByDoctor ? { display: t('fhir.addedByDoctor.source') } : { reference: patientUrl },
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
