// Lékařský pohled (/doc)
// Lékař zadá 4místný kód od pacienta → stáhneme léky z backendu
// (POST /api/share/claim) a ukážeme je v tabulce. Interakce se hned na pozadí
// zkontrolují na backendu (databáze DDInter, viz doctorCheck.js) a pod tabulkou
// je rozbalovací lišta s nálezy a maticí dvojic.
// Léky, onkologická léčba (režimy), doplňky i interakce jsou v rozbalovacích lištách,
// každá s tlačítkem „Kopírovat“ (prostý text do dokumentace).
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
//
// Lékař může u běžných léků opravit název, sílu a dávkování (EditRow). Opravy
// zůstávají jen v této relaci: položka si v "doctorEdits" pamatuje, co lékař změnil
// a jak to bylo původně. Po každé opravě se interakce kontrolují znovu.
// Pacientovi jde opravy poslat jednorázovým kódem (SendBackDialog, HandoffCode) – pacient
// ho opíše v appce a na telefonu se nic nezmění, dokud opravy sám nepotvrdí (viz familyShare.js).
//
// Onkologickou léčbu (režim) může lékař doplnit sám (zkratka, např. FOLFOX, forma podání,
// poslední dávka) – i když ji pacient neuvedl. Je to samostatná položka kind = 'regimen'
// s příznakem addedByDoctor: rozloží se na léčiva (doctorCheck.js) a zkontrolují se interakce.
// Léčbu od pacienta může lékař upravit – opravy si pamatuje "regimenEdits" (jako u léků).
// Léčiva z režimu se ukazují jen u režimu, nikdy jako pacientem nahlášené léky.
// Do telefonu pacienta se režim neposílá.
import { useEffect, useRef, useState } from 'react';
import { claimShare, downloadReportPdf } from '../api.js';
import { LEVEL_RANK, checkMeds, pickShared } from '../doctorCheck.js';
import { ChevronIcon, CopyIcon, DownloadIcon } from '../components/Icons.jsx';
import { catalogName, medDosage, pluralLeky } from '../labels.js';
import { downloadFhir } from '../fhir.js';
import { ITEM_TYPES, ONCO_FORMS, dateText, dosageFromText, dosageToBackend, oncoFormText } from '../types.js';
import { MAX_LINK_LENGTH, encodeShare, makeResponse, makeShareId } from '../familyShare.js';
import { getLang, t } from '../i18n/index.js';
import LanguageSwitch from '../components/LanguageSwitch.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CatalogSuggestions from '../components/CatalogSuggestions.jsx';
import HandoffCode from '../components/HandoffCode.jsx';

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
const UNCHECKED_REASONS = ['no_active_substance', 'not_in_source', 'partly_in_source', 'unknown_regimen', 'resolve_failed'];

// Chybové kódy z backendu, pro které máme větu pro lékaře ('doc.error.<kód>')
const ERROR_CODES = ['not_found', 'rate_limited', 'invalid_input', 'offline'];

// Pacient posílá "1-0-1-0 (ráno 1, večer 1)" – závorku uřízneme, aby šlo
// dávkování rozložit na ráno/poledne/večer/noc.
function dosageCodeText(med) {
  return [med.frequency?.replace(/\s*\(.*\)$/, ''), med.amount].filter(Boolean).join(', ');
}

// Léky od backendu mají jiný tvar než léky v telefonu pacienta (dávkování je text,
// chybí "type"). FHIR export čeká tvar z telefonu, tak je převedeme.
function toFhirItems(meds) {
  return meds.map((med) => ({
    ...med,
    type: med.kind === 'regimen' ? ITEM_TYPES.ONKO : ITEM_TYPES.LEK,
    source: med.source ?? med.sources?.[0],
    dosage: dosageFromText(dosageCodeText(med)),
  }));
}

// Lék pro backend (PDF): jen známá pole + co opravil lékař
function toReportMed(med) {
  // TODO(backend): backend nezná "položku doplnil lékař" (source je jen box/note/manual).
  // Než ji bude znát, napíšeme to do sloupce dávkování, ať je ve zprávě vidět, kdo léčbu doplnil.
  if (med.addedByDoctor) {
    return { ...pickShared(med), frequency: [med.frequency, t('doc.onco.reportNote')].filter(Boolean).join(' · ') };
  }
  // Oprava léčby: backend zná jen name / strength / dosage. Poslední dávka je v "dávkování".
  // TODO(backend): změnu formy podání zpráva zatím neoznačí.
  if (med.regimenEdits) {
    const fields = med.regimenEdits.fields.map((f) => REGIMEN_REPORT_FIELDS[f]).filter(Boolean);
    return fields.length > 0 ? { ...pickShared(med), edited_fields: fields } : pickShared(med);
  }
  return med.doctorEdits ? { ...pickShared(med), edited_fields: med.doctorEdits.fields } : pickShared(med);
}

// ---------- Onkologická léčba ----------

// Pole léčby, která lékař může změnit, a jak se jmenují pro PDF (edited_fields)
const REGIMEN_FIELDS = ['name', 'form', 'frequency'];
const REGIMEN_REPORT_FIELDS = { name: 'name', frequency: 'dosage' };

// Poslední dávku posílá pacient v "frequency" jako "poslední dávka/cyklus 1. 10. 2026"
// (česky, viz createSharePin v api.js) – stejně ji ukládá i lékař.
function lastDoseFrequency(isoDate) {
  return isoDate ? `poslední dávka/cyklus ${dateText(isoDate, 'cs')}` : null;
}

// "poslední dávka/cyklus 1. 10. 2026" → "2026-10-01" pro <input type="date"> ('' = nejde přečíst)
function lastDoseIso(med) {
  const m = med.frequency?.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

/**
 * Uloží úpravu léčby. U léčby od pacienta si pamatujeme původní hodnoty – když je
 * lékař vrátí, značka "opravil lékař" zmizí. Léčba doplněná lékařem žádnou nepotřebuje.
 */
function applyRegimenEdit(med, fields) {
  const original = med.regimenEdits?.original ?? { name: med.name, form: med.form ?? null, frequency: med.frequency ?? null };
  const { regimenEdits, ...next } = { ...med, ...fields };
  if (med.addedByDoctor) return next;
  const changed = REGIMEN_FIELDS.filter((f) => (next[f] ?? null) !== (original[f] ?? null));
  return changed.length > 0 ? { ...next, regimenEdits: { fields: changed, original } } : next;
}

// Nové id pro režim doplněný lékařem (nesmí obsahovat "#", viz doctorCheck.js)
function newRegimenId() {
  return `doc-regimen-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Opravy pro pacienta: jen opravené léky a u nich jen opravená pole (viz diffShare)
function toSendBackItems(meds) {
  return meds
    .filter((med) => med.doctorEdits)
    .map((med) => ({
      id: med.id,
      type: ITEM_TYPES.LEK,
      name: med.name,
      strength: med.strength ?? '',
      dosage: dosageFromText(dosageCodeText(med)),
      active_substance: med.active_substance ?? '',
      catalog_id: med.catalog_id ?? '',
      edited: med.doctorEdits.fields,
    }));
}

/**
 * Uloží opravu lékaře. Co je "opravené", počítáme proti původním hodnotám od pacienta –
 * když lékař hodnotu vrátí, značka zmizí.
 * @param {object} med – lék, jak je teď v tabulce
 * @param {{ name: string, strength: string, dosage: string, product: object|null }} draft
 * @returns {object} nový lék
 */
function applyEdit(med, draft) {
  const original = med.doctorEdits?.original ?? {
    name: med.name,
    strength: med.strength || null,
    frequency: med.frequency || null,
    amount: med.amount || null,
    active_substance: med.active_substance ?? null,
    catalog_id: med.catalog_id ?? null,
  };
  const { doctorEdits, ...next } = med;
  const name = draft.name.trim();
  const product = draft.product;

  // Identita přípravku: z katalogu, nebo původní (stejný název), jinak neznámá.
  // Látka starého přípravku u nového názvu nikdy nezůstane.
  if (product) {
    next.active_substance = product.active_substance || null;
    next.catalog_id = product.id;
  } else if (name !== med.name) {
    const back = name === original.name;
    next.active_substance = back ? original.active_substance : null;
    next.catalog_id = back ? original.catalog_id : null;
  }
  next.name = name;
  next.strength = draft.strength.trim() || null;

  // Dávkování přepíšeme jen když ho lékař změnil – jinak by se text zbytečně přeformátoval
  if (draft.dosage.trim() !== dosageCodeText(med)) {
    const text = draft.dosage.trim();
    // Prázdné = neznámé, nic nedoplňujeme
    Object.assign(next, text ? dosageToBackend(dosageFromText(text)) : { frequency: null, amount: null });
  }

  const fields = [];
  if (next.name !== original.name || next.active_substance !== original.active_substance) fields.push('name');
  if (next.strength !== original.strength) fields.push('strength');
  if (next.frequency !== original.frequency || next.amount !== original.amount) fields.push('dosage');
  if (fields.length === 0) return next;

  // Neověřený = nový název bez výběru z katalogu (látku neznáme, interakce se nekontrolují)
  const unverified = fields.includes('name') && !next.catalog_id && next.active_substance === null;
  return { ...next, doctorEdits: { fields, original, unverified } };
}

// Opravená hodnota: nová hodnota + původní pod ní
function Edited({ value, original }) {
  return (
    <>
      {value || '—'}
      <span className="doc-edited">{t('doc.edit.original', { value: original || '—' })}</span>
    </>
  );
}

// Zdroj jako text pro lékaře: ['box', 'note'] → "krabička + lístek"
function sourceText(med) {
  if (med.addedByDoctor) return t('doc.source.doctor');
  return (med.sources ?? [med.source]).map((s) => (SOURCE_KEYS.includes(s) ? t(`doc.source.${s}`) : s)).join(' + ');
}

// Poslední dávku režimu pacient posílá v dávkování jako "poslední dávka/cyklus 1. 10. 2026"
// (viz createSharePin v api.js) – do sloupce "Poslední dávka" stačí datum.
function lastDoseText(med) {
  return med.frequency?.replace(/^poslední dávka\/cyklus\s*/, '') || '—';
}

// Buňka léčby: opravená hodnota má pod sebou tu původní
function RegimenCell({ med, field, value }) {
  const edits = med.regimenEdits;
  if (!edits?.fields.includes(field)) return value || '—';
  const original = field === 'frequency' ? lastDoseText(edits.original) : edits.original[field];
  return <Edited value={value} original={original === '—' ? '' : original} />;
}

// Zkratka léku do matice, např. "Warfarin" → "WAR"
function abbr(name) {
  return name.replace(/[^\p{L}\d]/gu, '').slice(0, 3).toUpperCase();
}

// --- Text pro schránku (tlačítka „Kopírovat“) ---
// Prostý text k vložení do zdravotnické dokumentace: nadpis sekce a pod ním
// jeden řádek na položku. Bere aktuální hodnoty, tedy i opravy lékaře.

function drugLine(med) {
  const name = [med.name, med.strength].filter(Boolean).join(' ');
  const substance = med.doctorEdits?.unverified ? '' : med.active_substance;
  return `- ${name}${substance ? ` (${substance})` : ''}${medDosage(med) ? ` – ${medDosage(med)}` : ''}`;
}

function drugsText(drugs) {
  return [t('doc.drugs.title', { count: drugs.length }), ...drugs.map(drugLine)].join('\n');
}

function regimensText(regimens, result) {
  const lines = regimens.map((med) => {
    const info = result?.regimens[med.id];
    // Složení: nejednoznačnou zkratku po variantách, neznámou / nezjištěnou nedohadujeme
    let drugs = '';
    if (result && !info) drugs = ` (${t('doc.regimenUnknown')})`;
    else if (info?.failed) drugs = ` (${t('doc.regimenFailed')})`;
    else if (info?.variants.length > 1) {
      const variants = info.variants.map((v) => `${v.name}${v.indication ? ` – ${v.indication}` : ''}: ${v.drugs.join(', ')}`);
      drugs = ` (${t('doc.ambiguous', { count: info.variants.length })} ${variants.join('; ')})`;
    } else if (info) drugs = ` (${info.drugs.join(', ')})`;

    const details = [
      med.form,
      med.frequency && `${t('doc.col.lastDose')}: ${lastDoseText(med)}`,
      // Kdo údaj doplnil / opravil – ať se lékař nevydává za pacienta a naopak
      med.addedByDoctor && t('doc.source.doctor'),
      med.regimenEdits && t('doc.edit.by'),
    ].filter(Boolean);
    return `- ${med.name}${drugs}${details.length ? ` – ${details.join(', ')}` : ''}`;
  });
  return [t('doc.onco.title', { count: regimens.length }), ...lines].join('\n');
}

function supplementsText(supplements) {
  const lines = supplements.map((med) => `- ${med.name.replace(SUPPLEMENT_SUFFIX, '')}`);
  return [t('doc.supplements.title', { count: supplements.length }), ...lines].join('\n');
}

function interactionsText(result, nameOf) {
  const lines = [t('doc.interactions', { count: result.findings.length + result.duplicates.length })];
  if (result.findings.length + result.duplicates.length === 0) {
    lines.push(t('doc.none', { db: result.checkedAgainst?.name ?? 'DDInter' }));
  }
  for (const f of result.findings) {
    lines.push(`- ${LEVELS[f.level].tag}: ${nameOf(f.a)} × ${nameOf(f.b)} (${f.pairs.map((p) => p.substances).join('; ')})`);
    // Popis z DDInter pod dvojici (u režimu bývá u víc dvojic látek stejný → jen jednou)
    for (const description of new Set(f.pairs.map((p) => p.description).filter(Boolean))) {
      lines.push(`  ${description}`);
    }
  }
  for (const d of result.duplicates) {
    lines.push(`- ${LEVELS.same.tag}: ${nameOf(d.a)} + ${nameOf(d.b)} – ${t('doc.duplicate', { substance: d.substance })}`);
  }
  for (const u of result.unchecked) {
    const reason = UNCHECKED_REASONS.includes(u.reason) ? t(`doc.reason.${u.reason}`) : u.reason;
    lines.push(`- ${t('doc.uncheckedTag')}: ${u.name} – ${reason}${u.substances?.length ? ` (${u.substances.join(', ')})` : ''}`);
  }
  if (result.checkedAgainst) {
    const db = result.checkedAgainst;
    lines.push(`${t('doc.sourceLabel')} ${db.name} (${db.license}, ${db.version}). ${t('doc.verify')}`);
  }
  return lines.join('\n');
}

// Zkopíruje text. Starší prohlížeče v ordinaci (nebo stránka bez HTTPS) nemají
// navigator.clipboard – pak zkusíme starý způsob přes skryté textové pole.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export default function Doctor() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false); // čekáme na backend?
  const [errorCode, setErrorCode] = useState(''); // kód chyby ('' = žádná chyba)
  // null = zatím nic nenačteno. Při chybě léky NEMAŽEME – kód je jednorázový,
  // takže by o ně lékař přišel třeba jen kvůli omylem zadanému dalšímu kódu.
  const [meds, setMeds] = useState(null);
  const [open, setOpen] = useState(false); // jsou interakce rozbalené?
  const [drugsOpen, setDrugsOpen] = useState(true); // je tabulka léků rozbalená?
  const [oncoOpen, setOncoOpen] = useState(true); // je onkologická léčba rozbalená?
  const [supplementsOpen, setSupplementsOpen] = useState(true);
  // Kontrola interakcí: status 'loading' | 'done' | 'error', result = výsledek checkMeds
  const [check, setCheck] = useState({ status: 'loading', result: null });
  const [pdfState, setPdfState] = useState('idle'); // 'idle' | 'loading' | 'error'
  const [confirmDiscard, setConfirmDiscard] = useState(false); // ptáme se na zavření pacienta?
  const [editingId, setEditingId] = useState(null); // který lék lékař právě opravuje
  const [sendBackOpen, setSendBackOpen] = useState(false); // okno s kódem pro pacienta
  // Formulář režimu: null = zavřený, 'new' = přidání, jinak id upravovaného režimu
  const [regimenForm, setRegimenForm] = useState(null);
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
    setEditingId(null);
    setRegimenForm(null);
  }

  // Oprava léku: nový seznam a hned nová kontrola interakcí. Starý výsledek
  // patří k jinému seznamu, takže ho do doběhnutí nové kontroly neukazujeme.
  function saveEdit(med, draft) {
    const next = meds.map((m) => (m.id === med.id ? applyEdit(m, draft) : m));
    setMeds(next);
    setEditingId(null);
    setPdfState('idle');
    runCheck(next);
  }

  // Změna seznamu režimů (přidání / úprava / odebrání): starý výsledek kontroly
  // patří k jinému seznamu → spustíme novou kontrolu, PDF se vygeneruje znovu.
  function changeMeds(next) {
    setMeds(next);
    setPdfState('idle');
    runCheck(next);
  }

  // Uložení formuláře léčby. Zkratku bereme doslova – nic nedohadujeme,
  // neznámá zkratka se v tabulce ukáže jako neověřená.
  // draft = { name, form, lastDose } (lastDose = "2026-10-01" nebo '')
  function saveRegimen(draft) {
    if (regimenForm === 'new') {
      changeMeds([
        ...meds,
        {
          id: newRegimenId(),
          kind: 'regimen',
          name: draft.name,
          active_substance: null,
          strength: null,
          form: draft.form || null,
          frequency: lastDoseFrequency(draft.lastDose),
          amount: null,
          source: 'manual', // backend jiný zdroj nepřijme – "lékař" ukazujeme podle addedByDoctor
          addedByDoctor: true,
        },
      ]);
    } else {
      const old = meds.find((m) => m.id === regimenForm);
      const fields = { name: draft.name, form: draft.form || null };
      // Datum přepíšeme jen když ho lékař změnil – jinak by se ztratil text, který nejde přečíst jako datum
      if (draft.lastDose !== lastDoseIso(old)) fields.frequency = lastDoseFrequency(draft.lastDose);
      const next = applyRegimenEdit(old, fields);
      const changed = REGIMEN_FIELDS.some((f) => (next[f] ?? null) !== (old[f] ?? null));
      if (changed) changeMeds(meds.map((m) => (m.id === old.id ? next : m)));
    }
    setRegimenForm(null);
  }

  function removeRegimen(id) {
    if (regimenForm === id) setRegimenForm(null);
    changeMeds(meds.filter((m) => m.id !== id));
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
      setEditingId(null);
      setRegimenForm(null);
      setPin('');
      setOpen(false);
      setDrugsOpen(true);
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
      const { blob, filename } = await downloadReportPdf(meds.map(toReportMed), getLang());
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
  const editedCount = meds?.filter((m) => m.doctorEdits).length ?? 0;

  // „Kopírovat do karty pacienta“: léky, onkologická léčba a doplňky. Interakce jen vlastním tlačítkem.
  function allText() {
    return [
      drugs.length > 0 && drugsText(drugs),
      regimens.length > 0 && regimensText(regimens, result),
      supplements.length > 0 && supplementsText(supplements),
    ]
      .filter(Boolean)
      .join('\n\n');
  }

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

      {meds !== null && (
        <SendBackDialog open={sendBackOpen} meds={meds} onClose={() => setSendBackOpen(false)} />
      )}

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
            <h1 className="doc-title">{t('doc.title')}</h1>
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
              <CopyButton text={allText} label={t('doc.copyAll')} small={false} />
              {/* Opravy zpět do telefonu pacienta – jen když nějaké jsou */}
              {editedCount > 0 && (
                <button
                  type="button"
                  className="doc-button doc-button-secondary"
                  onClick={() => setSendBackOpen(true)}
                >
                  {t('doc.sendBack.button', { count: editedCount })}
                </button>
              )}
            </div>
            {pdfState === 'error' && (
              <p className="doc-error no-print" role="alert">
                {t('doc.pdfError')}
              </p>
            )}

            {/* ---------- Rozbalovací lišta s tabulkou léků ---------- */}
            {drugs.length > 0 && (
              <section className="doc-interactions doc-onco">
                <div className="doc-section-head">
                  <button
                    type="button"
                    className="doc-toggle"
                    aria-expanded={drugsOpen}
                    aria-controls="doc-drugs-body"
                    onClick={() => setDrugsOpen(!drugsOpen)}
                  >
                    <span className={drugsOpen ? 'doc-chevron doc-chevron-open' : 'doc-chevron'}>
                      <ChevronIcon size={22} />
                    </span>
                    <strong>{t('doc.drugs.title', { count: drugs.length })}</strong>
                  </button>
                  <CopyButton text={() => drugsText(drugs)} section={t('doc.drugs.title', { count: drugs.length })} />
                </div>

                {drugsOpen && (
                  <div id="doc-drugs-body" className="doc-onco-body doc-table-wrap">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th>{t('doc.col.med')}</th>
                          <th>{t('doc.col.substance')}</th>
                          <th>{t('doc.col.strength')}</th>
                          <th>{t('doc.col.dosage')}</th>
                          <th>{t('doc.col.source')}</th>
                          <th className="no-print">
                            <span className="sr-only">{t('doc.col.actions')}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {drugs.map((med) =>
                          editingId === med.id ? (
                            <EditRow
                              key={med.id}
                              med={med}
                              onSave={(draft) => saveEdit(med, draft)}
                              onCancel={() => setEditingId(null)}
                            />
                          ) : (
                            <DrugRow key={med.id} med={med} onEdit={() => setEditingId(med.id)} />
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ---------- Rozbalovací lišta s onkologickou léčbou ----------
                Je vidět vždy – i bez léčby, aby ji lékař mohl doplnit. */}
            <section className="doc-interactions doc-onco">
              <div className="doc-section-head">
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
                </button>
                {/* Kopírovat má smysl jen když je co kopírovat */}
                {regimens.length > 0 && (
                  <CopyButton
                    text={() => regimensText(regimens, result)}
                    section={t('doc.onco.title', { count: regimens.length })}
                  />
                )}
              </div>

              {oncoOpen && (
                <div id="doc-onco-body" className="doc-onco-body">
                  {regimens.length === 0 && regimenForm !== 'new' && <p className="doc-muted">{t('doc.onco.none')}</p>}

                  {regimens.length > 0 && (
                    <div className="doc-table-wrap">
                      <table className="doc-table">
                        <thead>
                          <tr>
                            <th>{t('doc.col.regimen')}</th>
                            <th>{t('doc.col.drugs')}</th>
                            <th>{t('doc.col.oncoForm')}</th>
                            <th>{t('doc.col.lastDose')}</th>
                            <th>{t('doc.col.source')}</th>
                            <th className="no-print">
                              <span className="sr-only">{t('doc.col.actions')}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {regimens.map((med) =>
                            regimenForm === med.id ? (
                              <tr key={med.id} className="doc-row-editing">
                                <td colSpan={6}>
                                  <RegimenForm
                                    initial={{ name: med.name, form: med.form ?? '', lastDose: lastDoseIso(med) }}
                                    onSave={saveRegimen}
                                    onCancel={() => setRegimenForm(null)}
                                  />
                                </td>
                              </tr>
                            ) : (
                              <tr
                                key={med.id}
                                className={med.addedByDoctor || med.regimenEdits ? 'doc-row-edited' : undefined}
                              >
                                <td>
                                  <strong>
                                    <RegimenCell med={med} field="name" value={med.name} />
                                  </strong>
                                </td>
                                <td>
                                  <RegimenDrugs info={result?.regimens[med.id]} status={check.status} />
                                </td>
                                <td>
                                  <RegimenCell med={med} field="form" value={med.form} />
                                </td>
                                <td>
                                  <RegimenCell med={med} field="frequency" value={lastDoseText(med)} />
                                </td>
                                <td>
                                  {sourceText(med)}
                                  {med.regimenEdits && <span className="doc-edited">{t('doc.edit.by')}</span>}
                                </td>
                                <td className="no-print doc-row-actions">
                                  {/* Upravit jde každou léčbu. Odebrat jen tu, kterou doplnil lékař –
                                      údaj od pacienta nezmizí. */}
                                  <button
                                    type="button"
                                    className="doc-button doc-button-secondary doc-button-small"
                                    aria-label={t('doc.onco.editFor', { name: med.name })}
                                    onClick={() => setRegimenForm(med.id)}
                                  >
                                    {t('doc.edit.button')}
                                  </button>
                                  {med.addedByDoctor && (
                                    <button
                                      type="button"
                                      className="doc-button doc-button-secondary doc-button-small"
                                      aria-label={t('doc.onco.removeFor', { name: med.name })}
                                      onClick={() => removeRegimen(med.id)}
                                    >
                                      {t('common.remove')}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {regimenForm === 'new' ? (
                    <RegimenForm
                      initial={{ name: '', form: '', lastDose: '' }}
                      onSave={saveRegimen}
                      onCancel={() => setRegimenForm(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="doc-button doc-button-secondary doc-onco-add no-print"
                      onClick={() => setRegimenForm('new')}
                    >
                      {t('doc.onco.add')}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* ---------- Rozbalovací lišta s doplňky stravy ---------- */}
            {supplements.length > 0 && (
              <section className="doc-interactions doc-onco">
                <div className="doc-section-head">
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
                  </button>
                  <CopyButton
                    text={() => supplementsText(supplements)}
                    section={t('doc.supplements.title', { count: supplements.length })}
                  />
                </div>

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
                <div className="doc-section-head">
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
                  </button>
                  <CopyButton
                    text={() => interactionsText(result, nameOf)}
                    section={t('doc.interactions', { count: findingCount })}
                  />
                </div>
              )}

              {check.status === 'done' && open && (
                <div id="doc-interactions-body" className="doc-interactions-body">
                  {/* Nahoře (na širší obrazovce vlevo): matice dvojic */}
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

                  {/* Pod ní (vpravo): seznam nálezů */}
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
                        {/* Nejednoznačná zkratka: kontrolovaly se všechny možné látky, ne potvrzená léčba */}
                        {[f.a, f.b].some((id) => result.regimens[id]?.variants?.length > 1) && (
                          <p className="doc-kind">{t('doc.ambiguousFinding')}</p>
                        )}
                        {/* U režimu může být víc dvojic látek – závažnost píšeme jen když se liší */}
                        {f.pairs.map((pair) => (
                          <div key={pair.substances} className="doc-finding-pair">
                            <p className="doc-finding-meds">
                              {pair.substances}
                              {f.pairs.length > 1 && pair.level !== f.level && (
                                <span className="doc-kind"> ({LEVELS[pair.level].tag.toLocaleLowerCase(getLang())})</span>
                              )}
                            </p>
                            <InteractionText pair={pair} />
                          </div>
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

// Řádek tabulky léků. Opravené hodnoty mají pod sebou tu původní.
function DrugRow({ med, onEdit }) {
  const edits = med.doctorEdits;
  const was = (field) => edits?.fields.includes(field);
  return (
    <tr className={edits ? 'doc-row-edited' : undefined}>
      <td>
        <strong>{was('name') ? <Edited value={med.name} original={edits.original.name} /> : med.name}</strong>
      </td>
      <td>
        {edits?.unverified ? (
          <span className="doc-unverified">{t('doc.edit.unverified')}</span>
        ) : (
          med.active_substance || '—'
        )}
      </td>
      <td>{was('strength') ? <Edited value={med.strength} original={edits.original.strength} /> : med.strength || '—'}</td>
      <td>
        {was('dosage') ? (
          <Edited value={medDosage(med)} original={medDosage(edits.original)} />
        ) : (
          medDosage(med) || '—'
        )}
      </td>
      {/* sources[] = lék byl nalezen na více místech (lístek i krabička) */}
      <td>
        {sourceText(med)}
        {edits && <span className="doc-edited">{t('doc.edit.by')}</span>}
      </td>
      <td className="no-print doc-row-actions">
        <button
          type="button"
          className="doc-button doc-button-secondary doc-button-small"
          aria-label={t('doc.edit.buttonFor', { name: med.name })}
          onClick={onEdit}
        >
          {t('doc.edit.button')}
        </button>
      </td>
    </tr>
  );
}

// Formulář opravy v řádku tabulky. Uložit = nový seznam, Zrušit = beze změny.
function EditRow({ med, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => ({
    name: med.name,
    strength: med.strength ?? '',
    dosage: dosageCodeText(med),
    product: null,
  }));
  const [nameError, setNameError] = useState(false);
  const nameRef = useRef(null);
  const nameChanged = draft.name.trim() !== med.name;

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const set = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  function submit(event) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    onSave(draft);
  }

  // Esc = zrušit (jako v dialogu)
  function handleKeyDown(event) {
    if (event.key === 'Escape') onCancel();
  }

  const id = `doc-edit-${med.id}`;
  return (
    <tr className="doc-row-editing">
      <td colSpan={6}>
        <form className="doc-edit" onSubmit={submit} onKeyDown={handleKeyDown} noValidate>
          <div className="doc-edit-fields">
            <div className="doc-edit-field doc-edit-name">
              <label htmlFor={`${id}-name`}>{t('doc.col.med')}</label>
              <input
                ref={nameRef}
                id={`${id}-name`}
                type="text"
                maxLength={200}
                autoComplete="off"
                value={draft.name}
                aria-invalid={nameError}
                aria-describedby={nameError ? `${id}-name-error` : undefined}
                onChange={(e) => {
                  setNameError(false);
                  // Vlastní název = vybraný přípravek z katalogu už neplatí
                  setDraft((prev) => ({ ...prev, name: e.target.value, product: null }));
                }}
              />
              {nameError && (
                <p id={`${id}-name-error`} className="doc-edit-error" role="alert">
                  {t('doc.edit.nameRequired')}
                </p>
              )}
            </div>
            <div className="doc-edit-field">
              <label htmlFor={`${id}-strength`}>{t('doc.col.strength')}</label>
              <input id={`${id}-strength`} type="text" maxLength={200} autoComplete="off" value={draft.strength} onChange={set('strength')} />
            </div>
            <div className="doc-edit-field">
              <label htmlFor={`${id}-dosage`}>{t('doc.col.dosage')}</label>
              <input
                id={`${id}-dosage`}
                type="text"
                maxLength={200}
                autoComplete="off"
                placeholder="1-0-1"
                aria-describedby={`${id}-dosage-hint`}
                value={draft.dosage}
                onChange={set('dosage')}
              />
              <p id={`${id}-dosage-hint`} className="doc-muted">
                {t('doc.edit.dosageHint')}
              </p>
            </div>
          </div>

          {/* Nový název: přípravek ověříme v katalogu, jinak bude položka nezkontrolovaná */}
          {nameChanged && (
            <div className="doc-edit-identity">
              {draft.product ? (
                <p>
                  {t('doc.edit.picked', {
                    name: `${catalogName(draft.product.name)} ${draft.product.strength}`.trim(),
                    substance: draft.product.active_substance || '—',
                  })}
                </p>
              ) : (
                <p className="doc-muted">{t('doc.edit.identityHint')}</p>
              )}
              <CatalogSuggestions
                query={draft.name}
                paused={Boolean(draft.product)}
                onPick={(product) =>
                  setDraft((prev) => ({
                    ...prev,
                    name: catalogName(product.name),
                    strength: product.strength || prev.strength,
                    product,
                  }))
                }
              />
            </div>
          )}

          <div className="doc-edit-actions">
            <button type="submit" className="doc-button">
              {t('doc.edit.save')}
            </button>
            <button type="button" className="doc-button doc-button-secondary" onClick={onCancel}>
              {t('doc.edit.cancel')}
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

// Okno s odkazem / QR kódem pro pacienta. Odkaz vznikne při otevření okna
// z aktuálních oprav. Data jsou za # (viz familyShare.js) – na server nejdou.
function SendBackDialog({ open, meds, onClose }) {
  const ref = useRef(null);
  const [encoded, setEncoded] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setEncoded('');
    setError(false);
    const data = makeResponse({
      id: makeShareId(),
      rid: '',
      items: toSendBackItems(meds),
      onco: '',
      base: [],
      doc: true,
    });
    encodeShare(data)
      .then((text) => {
        if (cancelled) return;
        if (text.length > MAX_LINK_LENGTH) setError(true);
        else setEncoded(text);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [open, meds]);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog doc-send-dialog"
      aria-labelledby="doc-send-title"
      aria-describedby="doc-send-text"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="confirm-body">
        <h2 id="doc-send-title">{t('doc.sendBack.title')}</h2>
        <p id="doc-send-text">{t('doc.sendBack.text')}</p>
        {error && (
          <p className="doc-error" role="alert">
            {t('doc.sendBack.error')}
          </p>
        )}
        {/* Jen když je okno otevřené – jinak by kód vznikal i na pozadí */}
        {open && encoded && <HandoffCode encoded={encoded} intro={t('doc.sendBack.codeIntro')} />}
        <div className="confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.done')}
          </button>
        </div>
      </div>
    </dialog>
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

// Tlačítko „Kopírovat“. text = funkce, ať se text skládá až při kliknutí.
// Po kliknutí na 2 s ukáže „Zkopírováno“ (aria-live → přečte to i čtečka).
// section = co se kopíruje, jen pro čtečku („Kopírovat: Onkologická léčba“).
function CopyButton({ text, label, section, small = true }) {
  const [state, setState] = useState('idle'); // 'idle' | 'copied' | 'error'
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleClick() {
    const ok = await copyText(text());
    setState(ok ? 'copied' : 'error');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      className={small ? 'doc-button doc-button-secondary doc-button-small doc-copy' : 'doc-button doc-button-secondary doc-copy'}
      onClick={handleClick}
    >
      <CopyIcon size={small ? 18 : 22} />
      <span aria-live="polite">
        {state === 'copied' ? t('doc.copied') : state === 'error' ? t('doc.copyError') : label ?? t('doc.copy')}
      </span>
      {section && <span className="sr-only">: {section}</span>}
    </button>
  );
}

// Co interakce způsobuje (hned vidět) a jak postupovat (rozbalit). Texty jsou
// anglické originály z webu DDInter – backend je má jen u závažných a středně
// závažných dvojic látek z katalogu a režimů, jinde nic neukazujeme.
function InteractionText({ pair }) {
  if (!pair.description && !pair.management) return null;
  return (
    <>
      {pair.description && (
        <p className="doc-finding-desc" lang="en">
          {pair.description}
        </p>
      )}
      {(pair.management || pair.url) && (
        <details className="doc-finding-more">
          <summary>{t('doc.management')}</summary>
          {pair.management && <p lang="en">{pair.management}</p>}
          {pair.url && (
            <p>
              <a href={pair.url} target="_blank" rel="noreferrer">
                {t('doc.managementSource')}
              </a>
            </p>
          )}
        </details>
      )}
    </>
  );
}

// Léčiva onkologického režimu podle zkratky (z /api/regimens/resolve)
function RegimenDrugs({ info, status }) {
  if (status === 'loading') return <span className="doc-muted">{t('doc.regimenLoading')}</span>;
  // Kontrola celá selhala – složení neznáme, ale nic netvrdíme
  if (status === 'error') return <span className="doc-unverified">{t('doc.regimenFailed')}</span>;
  // Neznámá zkratka – nic nedohadujeme
  if (!info) return <span className="doc-unverified">{t('doc.regimenUnknown')}</span>;
  if (info.failed) return <span className="doc-unverified">{t('doc.regimenFailed')}</span>;

  // Víc variant: každou zvlášť. Souhrn látek by vypadal jako potvrzená léčba pacienta.
  if (info.variants.length > 1) {
    return (
      <>
        <span className="doc-unverified">{t('doc.ambiguous', { count: info.variants.length })}</span>
        <ul className="doc-variants">
          {info.variants.map((v, i) => (
            <li key={i}>
              <strong>{v.name}</strong>
              {v.indication && <span className="doc-kind"> ({v.indication})</span>}: {v.drugs.join(', ')}
            </li>
          ))}
        </ul>
        <span className="doc-kind">
          ({t('doc.byAbbr')},{' '}
          <a href={info.source.url} target="_blank" rel="noreferrer">
            HemOnc
          </a>
          )
        </span>
      </>
    );
  }

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

// Formulář léčby (přidání i úprava): zkratka, forma podání, poslední dávka.
// Uložit = nový seznam, Zrušit / Esc = beze změny. Prázdnou zkratku uložit nejde.
function RegimenForm({ initial, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Forma se posílá česky (jako od pacienta), v nabídce je v jazyce lékaře.
  // Hodnotu, která v nabídce není (např. z fotky), necháme jako další volbu.
  const formOptions = ONCO_FORMS.map((f) => ({ value: oncoFormText(f.key, 'cs'), label: f.label }));
  if (initial.form && !formOptions.some((o) => o.value === initial.form)) {
    formOptions.push({ value: initial.form, label: initial.form });
  }

  const set = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  function submit(event) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setError(true);
      inputRef.current?.focus();
      return;
    }
    onSave({ ...draft, name });
  }

  return (
    <form
      className="doc-edit doc-regimen-form"
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      noValidate
    >
      <div className="doc-edit-fields">
        <div className="doc-edit-field doc-edit-name">
          <label htmlFor="doc-regimen-abbr">{t('doc.onco.abbr')}</label>
          <input
            ref={inputRef}
            id="doc-regimen-abbr"
            type="text"
            maxLength={100}
            autoComplete="off"
            placeholder="FOLFOX"
            value={draft.name}
            aria-invalid={error}
            aria-describedby={error ? 'doc-regimen-hint doc-regimen-error' : 'doc-regimen-hint'}
            onChange={(e) => {
              setError(false);
              set('name')(e);
            }}
          />
          <p id="doc-regimen-hint" className="doc-muted">
            {t('doc.onco.abbrHint')}
          </p>
          {error && (
            <p id="doc-regimen-error" className="doc-edit-error" role="alert">
              {t('doc.onco.abbrRequired')}
            </p>
          )}
        </div>
        <div className="doc-edit-field">
          <label htmlFor="doc-regimen-form">{t('doc.col.oncoForm')}</label>
          <select id="doc-regimen-form" value={draft.form} onChange={set('form')}>
            <option value="">{t('common.notEntered')}</option>
            {formOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="doc-edit-field">
          <label htmlFor="doc-regimen-last">{t('doc.col.lastDose')}</label>
          <input
            id="doc-regimen-last"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={draft.lastDose}
            onChange={set('lastDose')}
          />
        </div>
      </div>
      <div className="doc-edit-actions">
        <button type="submit" className="doc-button">
          {t('doc.onco.save')}
        </button>
        <button type="button" className="doc-button doc-button-secondary" onClick={onCancel}>
          {t('doc.edit.cancel')}
        </button>
      </div>
    </form>
  );
}
