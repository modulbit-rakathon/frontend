// MOCK (náhrada) za backend, který čte fotky (POST /api/analyze, kontrakt v3).
// Zapíná se v souboru .env.local řádkem:  VITE_MOCK_API=true
// (pak appka backend vůbec nevolá – hodí se bez internetu nebo na ukázku).
//
// Vrací stejný výsledek jako mock na backendu (MOCK_AI=true) po vyfocení
// lístku a krabičky – ukazuje všechny situace, které musí obrazovka umět:
//   1. Prestarium Neo – z lístku i krabičky, sloučené, v katalogu jistě (matched)
//   2. Warfarin Orion – sloučené, ale lístek a krabička se liší v síle (conflicts)
//   3. Paralen 500   – v katalogu není (not_found)
//   4. Ibuprofen 400 – obecný název, pacient vybere přípravek (needs_confirmation)
//   5. Pantomil      – nejistě přečtený rukopis, pacient vybere přípravek (needs_confirmation)
// Tvar dat: viz AnalyzedMedication v src/types.js.
import { MOCK_CATALOG } from './catalog.js';

// Přípravek z mock katalogu podle id
const product = (id) => MOCK_CATALOG.find((p) => p.id === id);

// Výsledek, když je na fotkách lístek i krabička
const MERGED = [
  {
    id: 'med_01',
    kind: 'drug',
    name: 'Prestarium Neo 5 mg',
    active_substance: 'perindoprilum argininum',
    strength: '5 mg',
    form: 'potahované tablety',
    frequency: '1-0-0',
    amount: '1 tbl',
    source: 'box',
    sources: ['box', 'note'],
    note_style: 'handwritten',
    uncertain_fields: [],
    catalog: { status: 'matched', product: product('cat_245') },
  },
  {
    id: 'med_02',
    kind: 'drug',
    name: 'Warfarin Orion 5 mg',
    active_substance: 'warfarinum natricum',
    strength: '5 mg',
    form: 'tablety',
    frequency: null,
    amount: '1 tbl',
    source: 'box',
    sources: ['box', 'note'],
    note_style: 'handwritten',
    // strength = rozpor lístek × krabička, frequency = na lístku nečitelné
    uncertain_fields: ['frequency', 'strength'],
    conflicts: [
      {
        field: 'strength',
        values: [
          { source: 'box', value: '5 mg' },
          { source: 'note', value: '3 mg' },
        ],
      },
    ],
    catalog: { status: 'matched', product: product('cat_172') },
  },
  {
    id: 'med_03',
    kind: 'drug',
    name: 'Paralen 500',
    active_substance: 'paracetamolum',
    strength: '500 mg',
    form: 'tablety',
    frequency: null,
    amount: null,
    source: 'box',
    sources: ['box'],
    uncertain_fields: [],
    catalog: { status: 'not_found' },
  },
  {
    id: 'med_04',
    kind: 'drug',
    name: 'Ibuprofen 400',
    active_substance: null,
    strength: '400 mg',
    form: null,
    frequency: 'při bolesti, max. 3x denně',
    amount: '1 tbl',
    source: 'note',
    sources: ['note'],
    note_style: 'handwritten',
    uncertain_fields: [],
    catalog: {
      status: 'needs_confirmation',
      candidates: [{ ...product('cat_022'), score: 0.8, match: 'substance' }],
    },
  },
  {
    id: 'med_05',
    kind: 'drug',
    name: 'Pantomil',
    active_substance: null,
    strength: '40 mg',
    form: null,
    frequency: '1-0-0',
    amount: '1 tbl',
    source: 'note',
    sources: ['note'],
    note_style: 'handwritten',
    uncertain_fields: ['name'],
    catalog: {
      status: 'needs_confirmation',
      candidates: [
        { ...product('cat_171'), score: 0.86, match: 'fuzzy' },
        { ...product('cat_080'), score: 0.55, match: 'fuzzy' },
      ],
    },
  },
];

/**
 * Předstírá analýzu fotek.
 * @param {{ note: File[], box: File[] }} photos
 * @returns {Promise<{ medications: Array, unreadable_items: number }>}
 *
 * Tipy pro testování:
 *  - fotka s "chyba" v názvu (např. "chyba.jpg") → obrazovka "Nepodařilo se přečíst fotky",
 *  - jen fotky krabiček → jen léky z krabiček (bez lístku nejsou rozpory ani kandidáti).
 */
export function analyzePhotos(photos) {
  const all = [...photos.note, ...photos.box];
  return new Promise((resolve, reject) => {
    // Počkáme pár sekund, jako by AI přemýšlela (ať je vidět načítání).
    setTimeout(() => {
      if (all.some((f) => f.name.toLowerCase().includes('chyba'))) {
        reject(new Error('nothing_found'));
        return;
      }

      const hasNote = photos.note.length > 0;
      const hasBox = photos.box.length > 0;
      // Vybereme léky podle toho, jaké fotky přišly (structuredClone = kopie, ať mock nikdo nezmění)
      const medications = structuredClone(MERGED)
        .filter((m) => (hasNote && m.sources.includes('note')) || (hasBox && m.sources.includes('box')))
        .map((m) => {
          if (hasNote && hasBox) return m;
          // Jen jeden druh fotek → nic se neslučuje, není s čím mít rozpor
          const only = hasNote ? 'note' : 'box';
          const { conflicts, ...rest } = m;
          return {
            ...rest,
            source: only,
            sources: [only],
            uncertain_fields: m.uncertain_fields.filter((f) => !conflicts?.some((c) => c.field === f)),
          };
        });

      // Na lístku byl jeden řádek nečitelný (jako na backendu)
      resolve({ medications, unreadable_items: hasNote ? 1 : 0 });
    }, 4000);
  });
}
