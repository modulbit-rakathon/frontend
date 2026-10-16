// Návrhy léků z katalogu pod polem "Název léku" při ručním zadání.
//
//   Název léku: [ brufe            ]
//   Myslíte některý z těchto léků?
//   [ Brufen 400 mg – Ibuprofen · Potahované tablety ]   ← klepnutím vybrat
//
// Hledá se, až pacient napíše aspoň 3 znaky a chvíli (600 ms) nepíše.
// Na rozdíl od CatalogSearch nic neříká, když nic nenajde – název jde zadat i bez katalogu.
import { useEffect, useState } from 'react';
import { searchCatalog } from '../api.js';
import { catalogName } from '../labels.js';
import { t } from '../i18n/index.js';

const MIN_LENGTH = 3;
const DEBOUNCE_MS = 600;
const MAX_RESULTS = 4;

/**
 * @param {string} query – co pacient napsal do pole s názvem
 * @param {boolean} [paused] – nehledat (třeba když už pacient přípravek vybral)
 * @param {(product: import('../types.js').CatalogProduct) => void} onPick
 */
export default function CatalogSuggestions({ query, paused = false, onPick }) {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const q = query.trim();
    setProducts([]);
    if (paused || q.length < MIN_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCatalog(q, controller.signal)
        .then((data) => setProducts((data.products ?? []).slice(0, MAX_RESULTS)))
        // Návrhy jsou jen pomoc navíc – když hledání selže, prostě nic nenabídneme.
        .catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, paused]);

  return (
    // aria-live = čtečka oznámí, že se objevily návrhy
    <div className="catalog-suggestions" aria-live="polite">
      {products.length > 0 && (
        <>
          <p className="catalog-status">{t('form.suggestTitle')}</p>
          <ul className="catalog-results">
            {products.map((p) => (
              <li key={p.id}>
                <button type="button" className="catalog-result" onClick={() => onPick(p)}>
                  <strong>
                    {catalogName(p.name)} {p.strength}
                  </strong>
                  <span>{[p.active_substance, p.form].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
