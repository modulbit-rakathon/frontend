// Hledání přípravku v katalogu léků (GET /api/catalog).
//
//   [ Název léku nebo účinná látka: brufen      ]
//   [ Brufen 400 mg – Ibuprofen, Potahované tablety ]   ← klepnutím vybrat
//
// Hledá se, až pacient přestane na chvíli psát (300 ms) a napíše aspoň 2 znaky –
// tak neposíláme na server dotaz po každém písmenku (server má limit 120 dotazů za minutu).
import { useEffect, useState } from 'react';
import { searchCatalog } from '../api.js';
import { catalogName } from '../labels.js';
import { t } from '../i18n/index.js';

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * @param {(product: import('../types.js').CatalogProduct) => void} onPick – pacient vybral přípravek
 * @param {string} [initialQuery] – čím hledání předvyplnit (třeba přečteným názvem)
 * @param {string} idPrefix – kvůli unikátním id, když je na stránce hledání víckrát
 */
export default function CatalogSearch({ onPick, initialQuery = '', idPrefix }) {
  const [query, setQuery] = useState(initialQuery);
  // 'short' = málo znaků, 'loading', 'done', 'error'
  const [status, setStatus] = useState('short');
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_LENGTH) {
      setStatus('short');
      setProducts([]);
      return;
    }

    // AbortController = umí zrušit rozběhnutý dotaz, když pacient píše dál
    const controller = new AbortController();
    setStatus('loading');

    // "Debounce": dotaz pošleme až po 300 ms bez psaní.
    // Když pacient mezitím napíše další písmeno, useEffect se spustí znovu
    // a úklidová funkce dole tenhle časovač zruší.
    const timer = setTimeout(() => {
      searchCatalog(q, controller.signal)
        .then((data) => {
          setProducts(data.products);
          setStatus('done');
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus('error');
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const inputId = `${idPrefix}-search`;

  return (
    <div className="catalog-search">
      <label htmlFor={inputId}>{t('catalog.label')}</label>
      <input
        id={inputId}
        type="search"
        className="text-input"
        value={query}
        placeholder={t('catalog.placeholder')}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* aria-live = čtečka přečte, když se změní stav hledání */}
      <p className="catalog-status" aria-live="polite">
        {status === 'short' && t('catalog.short', { count: MIN_LENGTH })}
        {status === 'loading' && t('catalog.loading')}
        {status === 'done' && products.length === 0 && t('catalog.none')}
        {status === 'done' && products.length > 0 && t('catalog.found', { count: products.length })}
        {status === 'error' && t('catalog.error')}
      </p>

      {status === 'done' && products.length > 0 && (
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
      )}
    </div>
  );
}
