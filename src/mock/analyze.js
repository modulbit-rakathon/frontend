// MOCK (náhrada) za backend, který čte fotku (POST /api/analyze).
// Zapíná se v souboru .env.local řádkem:  VITE_MOCK_API=true
// (pak appka backend vůbec nevolá – hodí se bez internetu nebo na ukázku).
//
// Na rozdíl od skutečného backendu vrací i `field_boxes` = kde na fotce
// AI hodnotu našla. Až to bude umět backend, stačí mock vypnout.
// Tvar dat: viz AnalyzedMedication v src/types.js.

// Ukázkové výsledky pro fotku KRABIČKY – při každém focení další v pořadí.
const BOX_SAMPLES = [
  {
    name: 'Warfarin',
    active_substance: 'warfarin',
    strength: '5 mg',
    form: 'tablet',
    frequency: null,
    amount: null,
    uncertain_fields: [],
    field_boxes: {
      name: { x: 0.18, y: 0.3, w: 0.5, h: 0.14 },
      strength: { x: 0.18, y: 0.47, w: 0.22, h: 0.1 },
    },
  },
  {
    name: 'Ibuprofen',
    active_substance: 'ibuprofen',
    strength: '400 mg',
    form: 'tablet',
    frequency: '3× denně',
    amount: '1 tableta',
    // "frequency" bylo na fotce špatně čitelné → pacient to musí zkontrolovat
    uncertain_fields: ['frequency'],
    field_boxes: {
      name: { x: 0.15, y: 0.22, w: 0.55, h: 0.15 },
      strength: { x: 0.15, y: 0.4, w: 0.25, h: 0.1 },
      frequency: { x: 0.15, y: 0.66, w: 0.6, h: 0.1 },
    },
  },
];

// Ukázkový výsledek pro fotku LÍSTKU OD LÉKAŘE – víc léků najednou.
const NOTE_SAMPLE = [
  {
    name: 'Metformin',
    active_substance: 'metformin',
    strength: '500 mg',
    form: null,
    frequency: '1-0-1',
    amount: null,
    uncertain_fields: [],
    field_boxes: {
      name: { x: 0.08, y: 0.12, w: 0.4, h: 0.1 },
      strength: { x: 0.5, y: 0.12, w: 0.18, h: 0.1 },
      frequency: { x: 0.7, y: 0.12, w: 0.2, h: 0.1 },
    },
  },
  {
    name: 'Anopyrin',
    active_substance: 'kyselina acetylsalicylová',
    strength: '100 mg',
    form: null,
    frequency: '1-0-0',
    amount: null,
    uncertain_fields: ['strength'],
    field_boxes: {
      name: { x: 0.08, y: 0.3, w: 0.4, h: 0.1 },
      strength: { x: 0.5, y: 0.3, w: 0.18, h: 0.1 },
      frequency: { x: 0.7, y: 0.3, w: 0.2, h: 0.1 },
    },
  },
];

// Počítadlo, kolikátá fotka krabičky to je (abychom střídali ukázkové výsledky).
let boxCount = 0;

// Doplní pole, která posílá i skutečný backend.
function withBackendFields(sample, source, i) {
  return { id: `mock_${Date.now()}_${i}`, kind: 'drug', source, ...structuredClone(sample) };
}

/**
 * Předstírá analýzu fotky.
 * @param {File} file – fotka vybraná uživatelem
 * @param {'box'|'note'} source – co je na fotce
 * @returns {Promise<{ medications: Array, unreadable_items: number }>}
 *
 * Tip pro testování: když se soubor jmenuje např. "chyba.jpg",
 * funkce vrátí chybu a uvidíte obrazovku "Nepodařilo se přečíst fotku".
 */
export function analyzePhoto(file, source) {
  return new Promise((resolve, reject) => {
    // Počkáme pár sekund, jako by AI přemýšlela (ať je vidět načítání).
    setTimeout(() => {
      if (file.name.toLowerCase().includes('chyba')) {
        reject(new Error('nothing_found'));
        return;
      }

      const samples = source === 'note' ? NOTE_SAMPLE : [BOX_SAMPLES[boxCount++ % BOX_SAMPLES.length]];
      resolve({
        medications: samples.map((s, i) => withBackendFields(s, source, i)),
        unreadable_items: 0,
      });
    }, 4000);
  });
}
