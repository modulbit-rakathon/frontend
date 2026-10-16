// Přípravky z katalogu, které už appka jednou viděla.
//
// Každý úspěšný výsledek hledání (GET /api/catalog) si uložíme do localStorage.
// Bez internetu pak hledáme aspoň v nich – pacient tak často najde lék,
// který už dřív hledal nebo vyfotil. Jsou to jen veřejné údaje z katalogu
// (název, síla, forma, účinná látka), nic o pacientovi.

const KEY = 'pillgaze-catalog-cache';
const MAX_PRODUCTS = 1000; // víc nepotřebujeme, celý katalog má pár stovek přípravků
const MAX_RESULTS = 20; // stejně jako backend

// Bez diakritiky a malými písmeny, ať "pantoprazol" najde i "Pantoprazol".
function simplify(text) {
  return (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

/** Přidá přípravky do paměti (stejné id přepíše novější verzí). */
export function rememberProducts(products) {
  if (!products?.length) return;
  try {
    const byId = new Map(load().map((p) => [p.id, p]));
    products.forEach((p) => {
      byId.delete(p.id); // nejnovější dáme na konec
      byId.set(p.id, p);
    });
    const list = [...byId.values()].slice(-MAX_PRODUCTS);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // plný nebo nedostupný localStorage – nevadí, jen nebudeme mít zálohu
  }
}

/** Hledá v uložených přípravcích podle názvu nebo účinné látky. */
export function searchRemembered(query) {
  const q = simplify(query.trim());
  return load()
    .filter((p) => simplify(p.name).includes(q) || simplify(p.active_substance).includes(q))
    .slice(0, MAX_RESULTS);
}
