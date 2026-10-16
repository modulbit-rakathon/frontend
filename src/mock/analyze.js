// MOCK (náhrada) za AI, která čte fotku krabičky.
// Až bude hotový backend, nahradíme obsah funkce analyzePhoto voláním API
// (např. fetch('/api/analyze', ...)). Zbytek aplikace se měnit nemusí,
// protože tvar vrácených dat zůstane stejný.

// Ukázkové léky – při každém focení vrátíme další v pořadí.
const SAMPLE_RESULTS = [
  {
    medications: [
      {
        name: 'Warfarin',
        strength: '5 mg',
        frequency: '1× denně večer',
        amount: '1 tableta',
        source: 'box',
        uncertain_fields: [],
      },
    ],
    unreadable_items: [],
  },
  {
    medications: [
      {
        name: 'Ibuprofen',
        strength: '400 mg',
        frequency: '3× denně',
        amount: '1 tableta',
        source: 'box',
        // "frequency" bylo na fotce špatně čitelné → pacient to musí zkontrolovat
        uncertain_fields: ['frequency'],
      },
    ],
    unreadable_items: [],
  },
  {
    medications: [
      {
        name: 'Metformin',
        strength: '500 mg',
        frequency: '2× denně',
        amount: '1 tableta',
        source: 'note',
        uncertain_fields: ['amount'],
      },
    ],
    unreadable_items: [],
  },
];

// Počítadlo, kolikátá fotka to je (abychom střídali ukázkové výsledky).
let callCount = 0;

/**
 * Předstírá analýzu fotky.
 * @param {File} file – fotka vybraná uživatelem
 * @returns {Promise<{ medications: Array, unreadable_items: Array }>}
 *
 * Tip pro testování: když se soubor jmenuje např. "chyba.jpg",
 * funkce vrátí chybu a uvidíte obrazovku "Nepodařilo se přečíst fotku".
 */
export function analyzePhoto(file) {
  return new Promise((resolve, reject) => {
    // Počkáme 1,5 sekundy, jako by AI přemýšlela.
    setTimeout(() => {
      if (file.name.toLowerCase().includes('chyba')) {
        reject(new Error('Fotku se nepodařilo přečíst.'));
        return;
      }

      const result = SAMPLE_RESULTS[callCount % SAMPLE_RESULTS.length];
      callCount++;

      // structuredClone vytvoří kopii, aby se úpravy neprojevily ve vzorových datech.
      resolve(structuredClone(result));
    }, 1500);
  });
}
