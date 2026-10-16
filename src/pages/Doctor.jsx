// Lékařský pohled (/doc)
// Lékař zadá 4místný kód od pacienta → stáhneme léky z backendu
// (POST /api/share/claim) a ukážeme je v tabulce. Interakce se hned na pozadí
// zkontrolují na backendu (databáze DDInter, viz doctorCheck.js) a pod tabulkou
// je rozbalovací lišta s nálezy a maticí dvojic.
// Onkologická léčba (režimy) má vlastní lištu mezi tabulkou léků a interakcemi.
//
// Dokud není načtený žádný pacient, ptáme se na kód v okně přes celou stránku
// (CodeDialog). Další kód jde zadat v hlavičce, tlačítkem „Zavřít pacienta“
// se načtený pacient zahodí a okno s kódem se ukáže znovu.
//
// Tahle stránka je pro počítač v ordinaci, ne pro pacienta – proto má
// vlastní rozložení bez spodní lišty (viz App.jsx).
//
// Po načtení léků jde zprávu stáhnout jako PDF (generuje backend, POST /api/report/pdf)
// nebo jako soubor FHIR pro nemocniční systém.
import { useEffect, useRef, useState } from 'react';
import { claimShare, downloadReportPdf } from '../api.js';
import { LEVEL_RANK, checkMeds, pickShared } from '../doctorCheck.js';
import { ChevronIcon, DownloadIcon } from '../components/Icons.jsx';
import { medDosage, pluralLeky } from '../labels.js';
import { downloadFhir } from '../fhir.js';
import { ITEM_TYPES, dosageFromText } from '../types.js';
import { getLang, t } from '../i18n/index.js';
import LanguageSwitch from '../components/LanguageSwitch.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

// Zdroj léku v "lékařské" podobě (podstatné jméno): 'box' → "krabička"
const SOURCE_KEYS = ['box', 'note', 'manual'];
const SUPPLEMENT_SUFFIX = /\s+\(doplněk stravy\)$/i;

// Závažnost z DDInter: text na kartě, symbol a popis v matici a barva (třída CSS).
// Barva nikdy není jediná informace – vždy i text nebo symbol.
// tag a label jsou gettery → vždy v aktuálním jazyce ('doc.level.<klíč>.tag/label').
function level(key, symbol, css, hasTag = true) {
  return {
    symbol,
    css,
    get tag() { return hasTag ? t(`doc.level.${key}.tag`) : ''; },
    get label() { return t(`doc.level.${key}.label`); },
  };
}

const LEVELS = {
  major: level('major', '!', 'high'),
  moderate: level('moderate', '~', 'medium'),
  minor: level('minor', '·', 'low'),
  unknown: level('unknown', '?', 'low'),
  same: level('same', '=', 'same'),
  none: level('none', '', 'none', false),
};

// Proč se položku nepodařilo zkontrolovat ('doc.reason.<kód>')
const UNCHECKED_REASONS = ['no_active_substance', 'not_in_source', 'partly_in_source', 'unknown_regimen'];

// Chybové kódy z backendu, pro které máme větu pro lékaře ('doc.error.<kód>')
const ERROR_CODES = ['not_found', 'rate_limited', 'invalid_input', 'offline'];

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

// Zdroj jako text pro lékaře: ['box', 'note'] → "krabička + lístek"
function sourceText(med) {
  return (med.sources ?? [med.source]).map((s) => (SOURCE_KEYS.includes(s) ? t(`doc.source.${s}`) : s)).join(' + ');
}

// Poslední dávku režimu pacient posílá v dávkování jako "poslední dávka/cyklus 1. 10. 2026"
// (viz createSharePin v api.js) – do sloupce "Poslední dávka" stačí datum.
function lastDoseText(med) {
  return med.frequency?.replace(/^poslední dávka\/cyklus\s*/, '') || '—';
}

// Zkratka léku do matice, např. "Warfarin" → "WAR"
function abbr(name) {
  return name.replace(/[^\p{L}\d]/gu, '').slice(0, 3).toUpperCase();
}

export default function Doctor() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false); // čekáme na backend?
  const [errorCode, setErrorCode] = useState(''); // kód chyby ('' = žádná chyba)
  // null = zatím nic nenačteno. Při chybě léky NEMAŽEME – kód je jednorázový,
  // takže by o ně lékař přišel třeba jen kvůli omylem zadanému dalšímu kódu.
  const [meds, setMeds] = useState(null);
  const [open, setOpen] = useState(false); // jsou interakce rozbalené?
  const [oncoOpen, setOncoOpen] = useState(true); // je onkologická léčba rozbalená?
  const [supplementsOpen, setSupplementsOpen] = useState(true);
  // Kontrola interakcí: status 'loading' | 'done' | 'error', result = výsledek checkMeds
  const [check, setCheck] = useState({ status: 'loading', result: null });
  const [pdfState, setPdfState] = useState('idle'); // 'idle' | 'loading' | 'error'
  const [confirmDiscard, setConfirmDiscard] = useState(false); // ptáme se na zavření pacienta?
  // Pořadí kontroly interakcí – výsledek staré kontroly (předchozí pacient)
  // nesmí přepsat výsledek pro nového.
  const checkRun = useRef(0);

  // Spustí kontrolu interakcí na pozadí (preload) – po rozbalení lišty je už hotová.
  async function runCheck(list) {
    const run = ++checkRun.current;
    setCheck({ status: 'loading', result: null });
    try {
      const result = await checkMeds(list);
      if (run === checkRun.current) setCheck({ status: 'done', result });
    } catch {
      if (run === checkRun.current) setCheck({ status: 'error', result: null });
    }
  }

  // Zahodí načteného pacienta → znovu se ukáže okno s kódem
  function discardPatient() {
    checkRun.current++;
    setMeds(null);
    setPin('');
    setErrorCode('');
    setCheck({ status: 'loading', result: null });
    setPdfState('idle');
  }

  async function handleSubmit(event) {
    event.preventDefault(); // formulář nemá znovu načíst stránku

    if (pin.length !== 4) {
      setErrorCode('invalid_input');
      return;
    }

    setLoading(true);
    setErrorCode('');
    try {
      const data = await claimShare(pin);
      setMeds(data.medications);
      setPin('');
      setOpen(false);
      setOncoOpen(true);
      setSupplementsOpen(true);
      setPdfState('idle');
      runCheck(data.medications);
    } catch (err) {
      setErrorCode(ERROR_CODES.includes(err.message) ? err.message : 'network');
    } finally {
      setLoading(false); // "finally" proběhne vždy – po úspěchu i po chybě
    }
  }

  // PDF vygeneruje backend, my ho jen uložíme jako soubor (přes dočasný odkaz).
  async function handlePdf() {
    setPdfState('loading');
    try {
      const { blob, filename } = await downloadReportPdf(meds.map(pickShared), getLang());
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setPdfState('idle');
    } catch {
      setPdfState('error');
    }
  }

  // Do pole pustíme jen číslice, nejvýš 4.
  function handlePinChange(event) {
    setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
  }

  // Běžné léky jdou do tabulky; režimy a doplňky mají vlastní rozbalovací lišty.
  // Interakce a matice ale počítají se vším dohromady.
  const supplements = meds?.filter((m) => SUPPLEMENT_SUFFIX.test(m.name)) ?? [];
  const drugs = meds?.filter((m) => m.kind !== 'regimen' && !SUPPLEMENT_SUFFIX.test(m.name)) ?? [];
  const regimens = meds?.filter((m) => m.kind === 'regimen') ?? [];
  const count = meds?.length ?? 0;
  const pairCount = (count * (count - 1)) / 2;
  const result = check.result;
  const findingCount = result ? result.findings.length + result.duplicates.length : 0;
  const nameOf = (id) => meds?.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="doc">
      {/* První kód: okno přes celou stránku, dokud není načtený žádný pacient */}
      <CodeDialog
        open={meds === null}
        pin={pin}
        loading={loading}
        errorCode={errorCode}
        onPinChange={handlePinChange}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={confirmDiscard}
        title={t('doc.discardTitle')}
        text={t('doc.discardText')}
        confirmLabel={t('doc.discard')}
        cancelLabel={t('doc.discardKeep')}
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          discardPatient();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />

      {/* ---------- Hlavička se zadáním dalšího kódu ---------- */}
      <header className="doc-header no-print">
        <span className="doc-brand">{t('doc.brand')}</span>
        {meds !== null && (
          <>
            <form className="doc-form" onSubmit={handleSubmit}>
              <label htmlFor="doc-pin">{t('doc.pinLabel')}</label>
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
                {loading ? t('doc.loading') : t('doc.load')}
              </button>
            </form>
            <button
              type="button"
              className="doc-button doc-button-secondary doc-discard"
              onClick={() => setConfirmDiscard(true)}
            >
              {t('doc.discard')}
            </button>
          </>
        )}
      </header>

      <main className="doc-main">
        {/* Chyba prvního kódu se ukazuje přímo v okně s kódem */}
        {meds !== null && errorCode && (
          <p className="doc-error" role="alert">
            {t(`doc.error.${errorCode}`, { button: t('doc.load') })}
          </p>
        )}

        {meds !== null && (
          <>
            {/* ---------- Tabulka léků ---------- */}
            <h1 className="doc-title">{t('doc.medsTitle', { count: drugs.length })}</h1>
            <p className="doc-muted no-print">{t('doc.oneTime')}</p>

            {/* ---------- Stažení zprávy ---------- */}
            <div className="doc-actions no-print">
              <button
                type="button"
                className="doc-button doc-button-secondary"
                disabled={pdfState === 'loading'}
                onClick={handlePdf}
              >
                <DownloadIcon size={22} />
                {pdfState === 'loading' ? t('doc.pdfLoading') : t('doc.pdf')}
              </button>
              {/* Soubor pro nemocniční systém (standard FHIR R4) */}
              <button
                type="button"
                className="doc-button doc-button-secondary"
                onClick={() => downloadFhir(toFhirItems(meds))}
              >
                <DownloadIcon size={22} />
                {t('doc.fhir')}
              </button>
            </div>
            {pdfState === 'error' && (
              <p className="doc-error no-print" role="alert">
                {t('doc.pdfError')}
              </p>
            )}

            {drugs.length > 0 && (
              <div className="doc-table-wrap">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>{t('doc.col.med')}</th>
                      <th>{t('doc.col.substance')}</th>
                      <th>{t('doc.col.strength')}</th>
                      <th>{t('doc.col.dosage')}</th>
                      <th>{t('doc.col.source')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drugs.map((med) => (
                      <tr key={med.id}>
                        <td>
                          <strong>{med.name}</strong>
                        </td>
                        <td>{med.active_substance || '—'}</td>
                        <td>{med.strength || '—'}</td>
                        <td>{medDosage(med) || '—'}</td>
                        {/* sources[] = lék byl nalezen na více místech (lístek i krabička) */}
                        <td>{sourceText(med)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- Rozbalovací lišta s onkologickou léčbou ---------- */}
            {regimens.length > 0 && (
              <section className="doc-interactions doc-onco">
                <button
                  type="button"
                  className="doc-toggle"
                  aria-expanded={oncoOpen}
                  aria-controls="doc-onco-body"
                  onClick={() => setOncoOpen(!oncoOpen)}
                >
                  <span className={oncoOpen ? 'doc-chevron doc-chevron-open' : 'doc-chevron'}>
                    <ChevronIcon size={22} />
                  </span>
                  <strong>{t('doc.onco.title', { count: regimens.length })}</strong>
                  <span className="doc-toggle-hint">{oncoOpen ? t('doc.hide') : t('doc.show')}</span>
                </button>

                {oncoOpen && (
                  <div id="doc-onco-body" className="doc-onco-body doc-table-wrap">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th>{t('doc.col.regimen')}</th>
                          <th>{t('doc.col.drugs')}</th>
                          <th>{t('doc.col.oncoForm')}</th>
                          <th>{t('doc.col.lastDose')}</th>
                          <th>{t('doc.col.source')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regimens.map((med) => (
                          <tr key={med.id}>
                            <td>
                              <strong>{med.name}</strong>
                            </td>
                            <td>
                              <RegimenDrugs info={result?.regimens[med.id]} status={check.status} />
                            </td>
                            <td>{med.form || '—'}</td>
                            <td>{lastDoseText(med)}</td>
                            <td>{sourceText(med)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ---------- Rozbalovací lišta s doplňky stravy ---------- */}
            {supplements.length > 0 && (
              <section className="doc-interactions doc-onco">
                <button
                  type="button"
                  className="doc-toggle"
                  aria-expanded={supplementsOpen}
                  aria-controls="doc-supplements-body"
                  onClick={() => setSupplementsOpen(!supplementsOpen)}
                >
                  <span className={supplementsOpen ? 'doc-chevron doc-chevron-open' : 'doc-chevron'}>
                    <ChevronIcon size={22} />
                  </span>
                  <strong>{t('doc.supplements.title', { count: supplements.length })}</strong>
                  <span className="doc-toggle-hint">{supplementsOpen ? t('doc.hide') : t('doc.show')}</span>
                </button>

                {supplementsOpen && (
                  <div id="doc-supplements-body" className="doc-onco-body doc-table-wrap">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th>{t('doc.col.supplement')}</th>
                          <th>{t('doc.col.source')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplements.map((med) => (
                          <tr key={med.id}>
                            <td>
                              <strong>{med.name.replace(SUPPLEMENT_SUFFIX, '')}</strong>
                            </td>
                            <td>{sourceText(med)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ---------- Rozbalovací lišta s interakcemi ---------- */}
            <section className={open ? 'doc-interactions doc-interactions-open' : 'doc-interactions'}>
              {check.status === 'loading' && <p className="doc-toggle doc-toggle-static">{t('doc.interLoading')}</p>}

              {check.status === 'error' && (
                <div className="doc-toggle doc-toggle-static" role="alert">
                  <strong>{t('doc.interError')}</strong>
                  <button type="button" className="doc-button doc-button-secondary doc-toggle-retry" onClick={() => runCheck(meds)}>
                    {t('common.tryAgain')}
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
                  <strong>{t('doc.interactions', { count: findingCount })}</strong>
                  {result.unchecked.length > 0 && (
                    <span className="doc-muted">{t('doc.uncheckedCount', { count: result.unchecked.length })}</span>
                  )}
                  <span className="doc-toggle-hint">{open ? t('doc.hide') : t('doc.show')}</span>
                </button>
              )}

              {check.status === 'done' && open && (
                <div id="doc-interactions-body" className="doc-interactions-body">
                  {/* Vlevo: seznam nálezů */}
                  <div className="doc-findings">
                    {findingCount === 0 && (
                      <p className="doc-finding doc-finding-none">
                        {t('doc.none', { db: result.checkedAgainst?.name ?? 'DDInter' })}
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
                              <span className="doc-kind"> ({LEVELS[pair.level].tag.toLocaleLowerCase(getLang())})</span>
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
                        <p>{t('doc.duplicate', { substance: d.substance })}</p>
                      </article>
                    ))}

                    {/* Co se zkontrolovat nepodařilo – nikdy to nezamlčíme */}
                    {result.unchecked.length > 0 && (
                      <div className="doc-finding doc-finding-none">
                        <p className="doc-finding-tag">{t('doc.uncheckedTag')}</p>
                        <ul className="doc-unchecked">
                          {result.unchecked.map((u) => (
                            <li key={u.id}>
                              <strong>{u.name}</strong> – {UNCHECKED_REASONS.includes(u.reason) ? t(`doc.reason.${u.reason}`) : u.reason}
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
                          {t('doc.sourceLabel')}{' '}
                          <a href={result.checkedAgainst.url} target="_blank" rel="noreferrer">
                            {result.checkedAgainst.name}
                          </a>{' '}
                          ({result.checkedAgainst.license}, {result.checkedAgainst.version}). {t('doc.verify')}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Vpravo: matice dvojic */}
                  <div className="doc-matrix-box">
                    <h2>
                      {t('doc.matrix')}{' '}
                      <span className="doc-muted">
                        {pluralLeky(meds.length)} = {t('doc.pairs', { count: pairCount })}
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

      {/* Jazyk – jen nenápadně dole, hlavička má jen nadpis a kód.
          Bez pacienta je přepínač v okně s kódem. */}
      {meds !== null && (
        <footer className="doc-footer no-print">
          <LanguageSwitch variant="doc" />
        </footer>
      )}
    </div>
  );
}

// Okno pro první kód. Nejde zavřít (Esc ani klepnutím vedle) – bez kódu
// stránka nemá co ukázat. Zbytek stránky je pod oknem neovladatelný,
// proto je přepínač jazyka i tady.
function CodeDialog({ open, pin, loading, errorCode, onPinChange, onSubmit }) {
  const ref = useRef(null);
  const inputRef = useRef(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setClosing(false);
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!open && dialog.open) {
      // Po načtení pacienta okno krátce zmizí (stejně jako ConfirmDialog)
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        dialog.close();
        return;
      }
      setClosing(true);
      const timer = setTimeout(() => {
        dialog.close();
        setClosing(false);
      }, 160);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Po chybě vrátíme fokus do pole, ať jde kód rovnou přepsat
  useEffect(() => {
    if (errorCode) inputRef.current?.select();
  }, [errorCode]);

  return (
    <dialog
      ref={ref}
      className={closing ? 'confirm-dialog doc-code-dialog confirm-dialog-closing' : 'confirm-dialog doc-code-dialog'}
      aria-labelledby="doc-code-title"
      aria-describedby="doc-code-text"
      onCancel={(e) => e.preventDefault()}
    >
      <form className="confirm-body" onSubmit={onSubmit}>
        <h2 id="doc-code-title">{t('doc.pinLabel')}</h2>
        <p id="doc-code-text">{t('doc.enterCode')}</p>
        <input
          ref={inputRef}
          className="doc-pin doc-code-pin"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0000"
          aria-labelledby="doc-code-title"
          aria-invalid={Boolean(errorCode)}
          value={pin}
          onChange={onPinChange}
        />
        {errorCode && (
          <p className="doc-error" role="alert">
            {t(`doc.error.${errorCode}`, { button: t('doc.load') })}
          </p>
        )}
        <div className="confirm-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('doc.loading') : t('doc.load')}
          </button>
        </div>
        <LanguageSwitch variant="doc" />
      </form>
    </dialog>
  );
}

// Léčiva onkologického režimu podle zkratky (z /api/regimens/resolve)
function RegimenDrugs({ info, status }) {
  if (status === 'loading') return <span className="doc-muted">{t('doc.regimenLoading')}</span>;
  if (!info) return <span className="doc-muted">{t('doc.regimenUnknown')}</span>;
  return (
    <>
      {info.drugs.join(', ')}
      <span className="doc-kind">
        {' '}
        ({t('doc.byAbbr')}
        {info.variants.length > 1 ? `, ${t('doc.variants', { count: info.variants.length })}` : ''},{' '}
        <a href={info.source.url} target="_blank" rel="noreferrer">
          HemOnc
        </a>
        )
      </span>
    </>
  );
}
