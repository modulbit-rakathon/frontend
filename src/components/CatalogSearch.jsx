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
  // true = bez internetu, hledali jsme jen v přípravcích uložených v telefonu
  const [offline, setOffline] = useState(false);

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
          setOffline(Boolean(data.offline));
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
      <label htmlFor={inputId}>Název léku nebo účinná látka</label>
      <input
        id={inputId}
        type="search"
        className="text-input"
        value={query}
        placeholder="např. Brufen"
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* aria-live = čtečka přečte, když se změní stav hledání */}
      <p className="catalog-status" aria-live="polite">
        {status === 'short' && `Napište aspoň ${MIN_LENGTH} písmena.`}
        {status === 'loading' && 'Hledám…'}
        {status === 'done' && !offline && products.length === 0 && 'Nic jsme nenašli. Zkuste jiný název.'}
        {status === 'done' && offline && products.length === 0 &&
          'Jste bez internetu, celý seznam léků teď prohledat nejde. Lék můžete nechat, jak je přečtený.'}
        {status === 'done' && offline && products.length > 0 &&
          'Jste bez internetu. Hledám jen v lécích, které už appka zná.'}
        {status === 'done' && products.length > 0 && ` Nalezeno: ${products.length}. Klepněte na správný lék.`}
        {status === 'error' && 'Hledání se nepovedlo. Zkontrolujte internet a zkuste to znovu.'}
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
