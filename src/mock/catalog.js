// MOCK (náhrada) za hledání v katalogu léků (GET /api/catalog?q=...).
// Zapíná se spolu s mockem focení:  VITE_MOCK_API=true  v .env.local
//
// Skutečný katalog má 303 přípravků. Tady je jen pár řádků
// (opsaných z katalogu na backendu), aby šlo hledání vyzkoušet bez internetu.
// Pozor: skutečná id má jen prvních pět přípravků, ostatní id jsou vymyšlená.

/** @type {import('../types.js').CatalogProduct[]} */
export const MOCK_CATALOG = [
  { id: 'cat_022', name: 'BRUFEN', strength: '400 mg', form: 'Potahované tablety', active_substance: 'Ibuprofen (ibuprofenum)' },
  { id: 'cat_080', name: 'CONTROLOC', strength: '20 mg', form: 'Enterosolventní tablety', active_substance: 'Pantoprazol (pantoprazolum)' },
  { id: 'cat_171', name: 'PANTOMYL', strength: '40 mg', form: 'Enterosolventní tablety', active_substance: 'Pantoprazol (pantoprazolum)' },
  { id: 'cat_172', name: 'WARFARIN ORION', strength: '5 mg', form: 'Tablety', active_substance: 'Sodná sůl warfarinu (warfarinum natricum)' },
  { id: 'cat_245', name: 'PRESTARIUM NEO', strength: '5 mg', form: 'Potahované tablety', active_substance: 'Perindopril-arginin (perindoprilum argininum)' },
  { id: 'cat_243', name: 'PRESTARIUM NEO COMBI', strength: '10 mg / 2,5 mg', form: 'Potahované tablety', active_substance: 'Perindopril-arginin / indapamid (perindoprilum argininum / indapamidum)' },
  { id: 'cat_010', name: 'ANOPYRIN', strength: '100 mg', form: 'Tablety', active_substance: 'Kyselina acetylsalicylová' },
  { id: 'cat_001', name: 'AGEN 5', strength: '5 mg', form: 'Tablety', active_substance: 'Amlodipin (amlodipinum)' },
  { id: 'cat_002', name: 'AGEN 10', strength: '10 mg', form: 'Tablety', active_substance: 'Amlodipin (amlodipinum)' },
  { id: 'cat_260', name: 'SIOFOR', strength: '500 mg', form: 'Potahované tablety', active_substance: 'Metformin-hydrochlorid (metformini hydrochloridum)' },
  { id: 'cat_261', name: 'SIOFOR', strength: '850 mg', form: 'Potahované tablety', active_substance: 'Metformin-hydrochlorid (metformini hydrochloridum)' },
  { id: 'cat_140', name: 'HELICID 20 ZENTIVA', strength: '20 mg', form: 'Enterosolventní tvrdé tobolky', active_substance: 'Omeprazol (omeprazolum)' },
  { id: 'cat_300', name: 'XARELTO', strength: '20 mg', form: 'Potahované tablety', active_substance: 'Rivaroxaban (rivaroxabanum)' },
  { id: 'cat_105', name: 'EUTHYROX', strength: '50 mikrogramů', form: 'Tablety', active_substance: 'Sodná sůl levothyroxinu (levothyroxinum natricum)' },
];

// Bez diakritiky a malými písmeny, ať "pantoprazol" najde i "Pantoprazol".
function simplify(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Předstírá hledání v katalogu.
 * @param {string} query
 * @returns {Promise<{ products: import('../types.js').CatalogProduct[] }>}
 */
export function searchCatalog(query) {
  const q = simplify(query.trim());
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Stejně jako backend: méně než 2 znaky = chyba 400
      if (q.length < 2) {
        reject(new Error('invalid_input'));
        return;
      }
      const products = MOCK_CATALOG.filter(
        (p) => simplify(p.name).includes(q) || simplify(p.active_substance).includes(q),
      );
      resolve({ products: products.slice(0, 20) });
    }, 400);
  });
}
