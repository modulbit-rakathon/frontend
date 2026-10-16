// Lékařský pohled (/doc)
// Lékař zadá 4místný kód od pacienta → stáhneme léky z backendu
// (POST /api/share/claim) a ukážeme je v tabulce. Interakce se spočítají
// hned na pozadí a pod tabulkou je rozbalovací lišta s nálezy a maticí dvojic.
//
// Tahle stránka je pro počítač v ordinaci, ne pro pacienta – proto má
// vlastní rozložení bez spodní lišty (viz App.jsx).
import { useEffect, useMemo, useRef, useState } from 'react';
import { claimShare, apiErrorMessage } from '../api.js';
import { useRetryAfter } from '../useRetryAfter.js';
import { checkMeds } from '../mock/doctorCheck.js';
import { ChevronIcon } from '../components/Icons.jsx';
import { medDosage, pluralLeky } from '../labels.js';

// Zdroj léku v "lékařské" podobě (podstatné jméno)
const SOURCE_NOUNS = { box: 'krabička', note: 'lístek', manual: 'ručně' };

// Texty závažnosti na kartách nálezů
const SEVERITY_TAGS = { high: 'Vysoké', medium: 'Střední' };

// Matice: symbol a popis pro každý typ buňky (barva nikdy není jediná informace)
const CELL = {
  high: { symbol: '!', label: 'vysoké riziko' },
  medium: { symbol: '~', label: 'střední riziko' },
  same: { symbol: '=', label: 'stejná látka' },
  none: { symbol: '', label: 'nic nenalezeno' },
};

// Chybové kódy z backendu → věta pro lékaře
const ERROR_MESSAGES = {
  not_found: 'Kód neexistuje nebo už vypršel. Kód platí 3 minuty a jde použít jen jednou – požádejte pacienta o nový.',
  rate_limited: 'Příliš mnoho špatných pokusů. Zkuste to za chvíli.',
  invalid_input: 'Kód musí mít 4 číslice.',
};

// Zkratka léku do matice, např. "Warfarin" → "WAR"
function abbr(name) {
  return name.replace(/[^\p{L}\d]/gu, '').slice(0, 3).toUpperCase();
}

export default function Doctor() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false); // čekáme na backend?
  const [errorMsg, setErrorMsg] = useState(''); // text chyby ('' = žádná chyba)
  // null = zatím nic nenačteno. Při chybě léky NEMAŽEME – kód je jednorázový,
  // takže by o ně lékař přišel třeba jen kvůli omylem zadanému dalšímu kódu.
  const [meds, setMeds] = useState(null);
  const [open, setOpen] = useState(false); // jsou interakce rozbalené?
  const [retryAfter, setRetryAfter] = useRetryAfter();
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  // Interakce přepočítáme jen když se změní seznam léků (useMemo si výsledek pamatuje).
  const { findings, matrix } = useMemo(() => checkMeds(meds ?? []), [meds]);

  async function handleSubmit(event) {
    event.preventDefault(); // formulář nemá znovu načíst stránku
    if (controllerRef.current || retryAfter > 0) return;

    if (pin.length !== 4) {
      setErrorMsg(ERROR_MESSAGES.invalid_input);
      return;
    }

    setLoading(true);
    setErrorMsg('');
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const data = await claimShare(pin, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setMeds(data.medications);
      setOpen(false);
    } catch (err) {
      if (controller.signal.aborted) return;
      setErrorMsg(err.retryAfter ? apiErrorMessage(err) : ERROR_MESSAGES[err.message] ?? apiErrorMessage(err));
      setRetryAfter(err.retryAfter ?? 0);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      controllerRef.current = null;
    }
  }

  // Do pole pustíme jen číslice, nejvýš 4.
  function handlePinChange(event) {
    setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
  }

  const count = meds?.length ?? 0;
  const pairCount = (count * (count - 1)) / 2;

  return (
    <div className="doc">
      {/* ---------- Hlavička se zadáním kódu ---------- */}
      <header className="doc-header">
        <span className="doc-brand">Lékař</span>
        <form className="doc-form" onSubmit={handleSubmit}>
          <label htmlFor="doc-pin">Kód pacienta</label>
          <input
            id="doc-pin"
            className="doc-pin"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000"
            value={pin}
            onChange={handlePinChange}
          />
          <button type="submit" className="doc-button" disabled={loading || retryAfter > 0}>
            {loading ? 'Načítám…' : retryAfter > 0 ? `Počkejte ${retryAfter} s` : 'Načíst'}
          </button>
        </form>
      </header>

      <main className="doc-main">
        {meds === null && !errorMsg && (
          <p className="doc-muted">Zadejte 4místný kód, který vám nadiktuje pacient.</p>
        )}

        {errorMsg && (
          <p className="doc-error" role="alert">
            {errorMsg}
          </p>
        )}

        {meds !== null && (
          <>
            {/* ---------- Tabulka léků ---------- */}
            <h1 className="doc-title">Léky pacienta ({meds.length})</h1>
            <p className="doc-muted">
              Kód je jednorázový – data zmizí po zavření nebo obnovení stránky.
            </p>

            <div className="doc-table-wrap">
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Lék</th>
                    <th>Účinná látka</th>
                    <th>Síla</th>
                    <th>Dávkování</th>
                    <th>Zdroj</th>
                  </tr>
                </thead>
                <tbody>
                  {meds.map((med) => (
                    <tr key={med.id}>
                      <td>
                        <strong>{med.name}</strong>
                        {med.form && <p>{med.form}</p>}
                        {med.kind === 'regimen' && <span className="doc-kind"> (režim)</span>}
                      </td>
                      <td>{med.active_substance || '—'}</td>
                      <td>{med.strength || '—'}</td>
                      <td>{medDosage(med) || '—'}</td>
                      {/* sources[] = lék byl nalezen na více místech (lístek i krabička) */}
                      <td>{(med.sources ?? [med.source]).map((s) => SOURCE_NOUNS[s]).join(' + ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---------- Rozbalovací lišta s interakcemi ---------- */}
            <section className={open ? 'doc-interactions doc-interactions-open' : 'doc-interactions'}>
              <button
                type="button"
                className="doc-toggle"
                aria-expanded={open}
                aria-controls="doc-interactions-body"
                onClick={() => setOpen(!open)}
              >
                <span className={open ? 'doc-chevron doc-chevron-open' : 'doc-chevron'}>
                  <ChevronIcon size={22} />
                </span>
                <strong>Interakce ({findings.length})</strong>
                <span className="doc-toggle-hint">{open ? 'Skrýt' : 'Zobrazit'}</span>
              </button>

              {open && (
                <div id="doc-interactions-body" className="doc-interactions-body">
                  {/* Vlevo: seznam nálezů */}
                  <div className="doc-findings">
                    {findings.length === 0 && (
                      <p className="doc-finding doc-finding-none">
                        V naší databázi jsme nic nenašli. To neznamená, že žádné interakce nejsou.
                      </p>
                    )}
                    {findings.map((f) => (
                      <article key={f.id} className={`doc-finding doc-finding-${f.severity}`}>
                        <p className="doc-finding-tag">
                          {SEVERITY_TAGS[f.severity]} · {f.tag}
                        </p>
                        <h3>{f.title}</h3>
                        {f.meds.length > 0 && <p className="doc-finding-meds">{f.meds.join(', ')}</p>}
                        <p>{f.description}</p>
                      </article>
                    ))}
                    <p className="doc-note">
                      Kontrola jen proti ukázkové databázi PillGaze. Není úplná, ověřte s farmaceutem.
                    </p>
                  </div>

                  {/* Vpravo: matice dvojic */}
                  <div className="doc-matrix-box">
                    <h2>
                      Matice dvojic{' '}
                      <span className="doc-muted">
                        {pluralLeky(meds.length)} = {pairCount} dvojic
                      </span>
                    </h2>
                    <div className="doc-matrix-row">
                      <table className="doc-matrix">
                        <thead>
                          <tr>
                            <th />
                            {meds.map((m) => (
                              <th key={m.id} scope="col" title={m.name}>
                                {abbr(m.name)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {meds.map((rowMed, i) => (
                            <tr key={rowMed.id}>
                              <th scope="row" title={rowMed.name}>
                                {abbr(rowMed.name)}
                              </th>
                              {meds.map((colMed, j) => {
                                const value = matrix[i][j];
                                if (value === 'self') {
                                  return <td key={colMed.id} className="cell cell-self" />;
                                }
                                // title = popisek po najetí myší, aria-label = pro čtečku obrazovky
                                const text = `${rowMed.name} × ${colMed.name}: ${CELL[value].label}`;
                                return (
                                  <td key={colMed.id} className={`cell cell-${value}`} title={text} aria-label={text}>
                                    {CELL[value].symbol}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Legenda */}
                      <ul className="doc-legend">
                        {['high', 'medium', 'same', 'none'].map((key) => (
                          <li key={key}>
                            <span className={`cell cell-${key}`}>{CELL[key].symbol}</span>
                            {CELL[key].label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
