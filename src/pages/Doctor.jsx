// Lékařský pohled (/doc)
// Lékař zadá 4místný kód od pacienta → stáhneme léky z backendu
// (POST /api/share/claim) a ukážeme je v tabulce. Interakce se hned na pozadí
// zkontrolují na backendu (databáze DDInter, viz doctorCheck.js) a pod tabulkou
// je rozbalovací lišta s nálezy a maticí dvojic.
//
// Tahle stránka je pro počítač v ordinaci, ne pro pacienta – proto má
// vlastní rozložení bez spodní lišty (viz App.jsx).
//
// Po načtení léků jde zprávu stáhnout jako PDF (tisk prohlížeče → "Uložit jako PDF")
// nebo jako soubor FHIR pro nemocniční systém.
import { useState } from 'react';
import { claimShare } from '../api.js';
import { LEVEL_RANK, checkMeds } from '../doctorCheck.js';
import { ChevronIcon, DownloadIcon } from '../components/Icons.jsx';
import { medDosage, pluralLeky } from '../labels.js';
import { downloadFhir } from '../fhir.js';
import { ITEM_TYPES, dosageFromText } from '../types.js';

// Zdroj léku v "lékařské" podobě (podstatné jméno)
const SOURCE_NOUNS = { box: 'krabička', note: 'lístek', manual: 'ručně' };

// Závažnost z DDInter: text na kartě, symbol a popis v matici a barva (třída CSS).
// Barva nikdy není jediná informace – vždy i text nebo symbol.
const LEVELS = {
  major: { tag: 'Závažná', symbol: '!', label: 'závažná interakce', css: 'high' },
  moderate: { tag: 'Středně závažná', symbol: '~', label: 'středně závažná interakce', css: 'medium' },
  minor: { tag: 'Méně závažná', symbol: '·', label: 'méně závažná interakce', css: 'low' },
  unknown: { tag: 'Závažnost neuvedena', symbol: '?', label: 'interakce bez uvedené závažnosti', css: 'low' },
  same: { tag: 'Duplicita', symbol: '=', label: 'stejná účinná látka', css: 'same' },
  none: { tag: '', symbol: '', label: 'v DDInter nenalezeno', css: 'none' },
};

// Proč se položku nepodařilo zkontrolovat
const UNCHECKED_REASONS = {
  no_active_substance: 'neznámá účinná látka',
  not_in_source: 'látka není v DDInter',
  partly_in_source: 'část látek není v DDInter',
  unknown_regimen: 'neznámá zkratka režimu',
};

// Chybové kódy z backendu → věta pro lékaře
const ERROR_MESSAGES = {
  not_found: 'Kód neexistuje nebo už vypršel. Kód platí 3 minuty a jde použít jen jednou – požádejte pacienta o nový.',
  rate_limited: 'Příliš mnoho špatných pokusů. Zkuste to za chvíli.',
  invalid_input: 'Kód musí mít 4 číslice.',
  offline: 'Počítač není připojený k internetu. Po připojení klikněte znovu na „Načíst“.',
};

// Léky od backendu mají jiný tvar než léky v telefonu pacienta (dávkování je text,
// chybí "type"). FHIR export čeká tvar z telefonu, tak je převedeme.
function toFhirItems(meds) {
  return meds.map((med) => ({
    ...med,
    type: med.kind === 'regimen' ? ITEM_TYPES.ONKO : ITEM_TYPES.LEK,
    source: med.source ?? med.sources?.[0],
    // Pacient posílá "1-0-1-0 (ráno 1, večer 1)" – závorku uřízneme, aby šlo
    // dávkování rozložit na ráno/poledne/večer/noc.
    dosage: dosageFromText(med.frequency?.replace(/\s*\(.*\)$/, ''), med.amount),
  }));
}

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
  // Kontrola interakcí: status 'loading' | 'done' | 'error', result = výsledek checkMeds
  const [check, setCheck] = useState({ status: 'loading', result: null });

  // Spustí kontrolu interakcí na pozadí (preload) – po rozbalení lišty je už hotová.
  async function runCheck(list) {
    setCheck({ status: 'loading', result: null });
    try {
      setCheck({ status: 'done', result: await checkMeds(list) });
    } catch {
      setCheck({ status: 'error', result: null });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault(); // formulář nemá znovu načíst stránku

    if (pin.length !== 4) {
      setErrorMsg(ERROR_MESSAGES.invalid_input);
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await claimShare(pin);
      setMeds(data.medications);
      setOpen(false);
      runCheck(data.medications);
    } catch (err) {
      setErrorMsg(ERROR_MESSAGES[err.message] ?? 'Nepodařilo se spojit se serverem. Zkuste to znovu.');
    } finally {
      setLoading(false); // "finally" proběhne vždy – po úspěchu i po chybě
    }
  }

  // Do pole pustíme jen číslice, nejvýš 4.
  function handlePinChange(event) {
    setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
  }

  const count = meds?.length ?? 0;
  const pairCount = (count * (count - 1)) / 2;
  const result = check.result;
  const findingCount = result ? result.findings.length + result.duplicates.length : 0;
  const nameOf = (id) => meds?.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="doc">
      {/* ---------- Hlavička se zadáním kódu ---------- */}
      <header className="doc-header no-print">
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
          <button type="submit" className="doc-button" disabled={loading}>
            {loading ? 'Načítám…' : 'Načíst'}
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
            <p className="doc-muted no-print">
              Kód je jednorázový – data zmizí po zavření nebo obnovení stránky.
            </p>

            {/* ---------- Stažení zprávy ---------- */}
            <div className="doc-actions no-print">
              <button type="button" className="doc-button doc-button-secondary" onClick={() => window.print()}>
                <DownloadIcon size={22} />
                Stáhnout PDF
              </button>
              {/* Soubor pro nemocniční systém (standard FHIR R4) */}
              <button
                type="button"
                className="doc-button doc-button-secondary"
                onClick={() => downloadFhir(toFhirItems(meds))}
              >
                <DownloadIcon size={22} />
                Stáhnout pro nemocniční systém (FHIR)
              </button>
            </div>

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
                        {med.kind === 'regimen' && <span className="doc-kind"> (režim)</span>}
                      </td>
                      <td>
                        {med.kind === 'regimen' ? <RegimenDrugs info={result?.regimens[med.id]} status={check.status} /> : med.active_substance || '—'}
                      </td>
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
              {check.status === 'loading' && <p className="doc-toggle doc-toggle-static">Načítám interakce…</p>}

              {check.status === 'error' && (
                <div className="doc-toggle doc-toggle-static" role="alert">
                  <strong>Interakce se nepodařilo načíst</strong>
                  <button type="button" className="doc-button doc-button-secondary doc-toggle-retry" onClick={() => runCheck(meds)}>
                    Zkusit znovu
                  </button>
                </div>
              )}

              {check.status === 'done' && (
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
                  <strong>Interakce ({findingCount})</strong>
                  {result.unchecked.length > 0 && (
                    <span className="doc-muted">· nezkontrolováno: {result.unchecked.length}</span>
                  )}
                  <span className="doc-toggle-hint">{open ? 'Skrýt' : 'Zobrazit'}</span>
                </button>
              )}

              {check.status === 'done' && open && (
                <div id="doc-interactions-body" className="doc-interactions-body">
                  {/* Vlevo: seznam nálezů */}
                  <div className="doc-findings">
                    {findingCount === 0 && (
                      <p className="doc-finding doc-finding-none">
                        Interakce nenalezeny v databázi {result.checkedAgainst?.name ?? 'DDInter'}. To neznamená, že žádné
                        nejsou.
                      </p>
                    )}
                    {result.findings.map((f) => (
                      <article key={f.id} className={`doc-finding doc-finding-${LEVELS[f.level].css}`}>
                        <p className="doc-finding-tag">{LEVELS[f.level].tag}</p>
                        <h3>
                          {nameOf(f.a)} × {nameOf(f.b)}
                        </h3>
                        {/* U režimu může být víc dvojic látek – závažnost píšeme jen když se liší */}
                        {f.pairs.map((pair) => (
                          <p key={pair.substances} className="doc-finding-meds">
                            {pair.substances}
                            {f.pairs.length > 1 && pair.level !== f.level && (
                              <span className="doc-kind"> ({LEVELS[pair.level].tag.toLowerCase()})</span>
                            )}
                          </p>
                        ))}
                      </article>
                    ))}
                    {result.duplicates.map((d) => (
                      <article key={d.id} className="doc-finding doc-finding-medium">
                        <p className="doc-finding-tag">{LEVELS.same.tag}</p>
                        <h3>
                          {nameOf(d.a)} + {nameOf(d.b)}
                        </h3>
                        <p>Dva přípravky se stejnou účinnou látkou ({d.substance}).</p>
                      </article>
                    ))}

                    {/* Co se zkontrolovat nepodařilo – nikdy to nezamlčíme */}
                    {result.unchecked.length > 0 && (
                      <div className="doc-finding doc-finding-none">
                        <p className="doc-finding-tag">Nezkontrolováno</p>
                        <ul className="doc-unchecked">
                          {result.unchecked.map((u) => (
                            <li key={u.id}>
                              <strong>{u.name}</strong> – {UNCHECKED_REASONS[u.reason] ?? u.reason}
                              {u.substances?.length > 0 && ` (${u.substances.join(', ')})`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="doc-note">
                      {result.note}{' '}
                      {result.checkedAgainst && (
                        <>
                          Zdroj:{' '}
                          <a href={result.checkedAgainst.url} target="_blank" rel="noreferrer">
                            {result.checkedAgainst.name}
                          </a>{' '}
                          ({result.checkedAgainst.license}, {result.checkedAgainst.version}). Ověřte s farmaceutem.
                        </>
                      )}
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
                          {meds.map((rowMed) => (
                            <tr key={rowMed.id}>
                              <th scope="row" title={rowMed.name}>
                                {abbr(rowMed.name)}
                              </th>
                              {meds.map((colMed) => {
                                if (rowMed.id === colMed.id) {
                                  return <td key={colMed.id} className="cell cell-self" />;
                                }
                                const level = LEVELS[result.cells[`${rowMed.id}|${colMed.id}`] ?? 'none'];
                                // title = popisek po najetí myší, aria-label = pro čtečku obrazovky
                                const text = `${rowMed.name} × ${colMed.name}: ${level.label}`;
                                return (
                                  <td key={colMed.id} className={`cell cell-${level.css}`} title={text} aria-label={text}>
                                    {level.symbol}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Legenda – od nejzávažnější */}
                      <ul className="doc-legend">
                        {Object.keys(LEVELS)
                          .sort((x, y) => LEVEL_RANK[y] - LEVEL_RANK[x])
                          .map((key) => (
                            <li key={key}>
                              <span className={`cell cell-${LEVELS[key].css}`}>{LEVELS[key].symbol}</span>
                              {LEVELS[key].label}
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

// Léčiva onkologického režimu podle zkratky (z /api/regimens/resolve)
function RegimenDrugs({ info, status }) {
  if (status === 'loading') return <span className="doc-muted">Hledám složení…</span>;
  if (!info) return <span className="doc-muted">neznámá zkratka</span>;
  return (
    <>
      {info.drugs.join(', ')}
      <span className="doc-kind">
        {' '}
        (podle zkratky{info.variants.length > 1 ? `, ${info.variants.length} varianty` : ''},{' '}
        <a href={info.source.url} target="_blank" rel="noreferrer">
          HemOnc
        </a>
        )
      </span>
    </>
  );
}
