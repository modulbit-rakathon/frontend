// Volání backendu PillGaze.
import { ITEM_TYPES, dateText, dosageToBackend, oncoFormText } from './types.js';
import { analyzePhotos as mockAnalyzePhotos } from './mock/analyze.js';
import { searchCatalog as mockSearchCatalog } from './mock/catalog.js';
import { reportNetworkFailure, reportNetworkSuccess } from './offline/network.js';
import { rememberProducts, searchRemembered } from './offline/catalogCache.js';
// Voláme jen "/api/..." na stejné adrese, kde běží appka. Na backend to přepošle
// proxy a ta přidá i API klíč, takže klíč nikdy není v prohlížeči:
// při vývoji Vite (vite.config.js), v produkci nginx (nginx.conf.template).

// VITE_MOCK_API=true → focení a hledání v katalogu nevolá backend, ale mock (src/mock/)
export const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

// Společná funkce pro všechna volání: pošle požadavek a zpracuje chyby.
// Bez internetu vrátí chybu 'offline' (obrazovky pak ukážou vlídnou hlášku).
async function request(path, options) {
  // Prohlížeč ví, že internet není → nemá smysl čekat.
  if (!navigator.onLine) throw new Error('offline');

  let res;
  try {
    res = await fetch(path, options);
  } catch (error) {
    // Zrušení (pacient píše dál) a vypršení času necháme, jak jsou.
    if (error.name === 'AbortError' || error.name === 'TimeoutError') throw error;
    // Jinak se nepodařilo spojit se serverem (není signál, Wi-Fi bez internetu…).
    reportNetworkFailure();
    throw new Error('offline');
  }
  reportNetworkSuccess();

  // Odpověď se pokusíme přečíst jako JSON. Když to nejde
  // (např. server spadl a poslal HTML stránku), necháme data prázdná.
  const data = await res.json().catch(() => null);

  // res.ok = false znamená chybu (400, 401, 502…). Backend posílá { error: { code, message } }.
  if (!res.ok) {
    throw new Error(data?.error?.code ?? `http_${res.status}`);
  }

  return data;
}

/**
 * Pošle všechny fotky najednou. Backend je přečte, každý lék vyhledá
 * v katalogu a stejný lék z lístku i z krabičky sloučí do jedné položky.
 * @param {{ note: File[], box: File[] }} photos – fotky podle druhu
 * @returns {Promise<{ medications: import('./types.js').AnalyzedMedication[], unreadable_items: number }>}
 * Chyby (error.message): 'nothing_found' (na fotkách žádný lék), 'payload_too_large'
 * (moc fotek / moc velké), 'unsupported_media_type' (není JPEG/PNG), 'rate_limited', 'model_error',
 * 'offline' (není internet – Scan fotky uloží do fronty, viz offline/photoQueue.js).
 */
export function analyzePhotos(photos) {
  // Mock místo backendu (zapíná se v .env.local: VITE_MOCK_API=true)
  if (USE_MOCK) return mockAnalyzePhotos(photos);

  // Data posíláme jako "formulář" (multipart/form-data). Každá fotka jde
  // do pole podle druhu: "note" = lístek, "box" = krabička. Pole se může opakovat.
  const form = new FormData();
  for (const [field, files] of Object.entries(photos)) {
    files.forEach((file) => form.append(field, file));
  }

  return request('/api/analyze', {
    method: 'POST',
    body: form,
    // Ručně psaný lístek může trvat i 40 s. Když backend neodpoví do 120 sekund, vzdáme to.
    signal: AbortSignal.timeout(120000),
  }).then((data) => {
    // Přípravky z katalogu si zapamatujeme pro hledání bez internetu.
    data?.medications?.forEach((med) =>
      rememberProducts([med.catalog?.product, ...(med.catalog?.candidates ?? [])].filter(Boolean)),
    );
    return data;
  });
}

/**
 * Hledá v katalogu léků podle názvu nebo účinné látky (bez AI, jen v seznamu na serveru).
 * @param {string} query – aspoň 2 znaky
 * @param {AbortSignal} [signal] – pro zrušení, když pacient píše dál
 * @returns {Promise<{ products: import('./types.js').CatalogProduct[], offline?: boolean }>} max 20, nejlepší první;
 *   offline = true → bez internetu, výsledky jen z dřív viděných přípravků
 */
export function searchCatalog(query, signal) {
  if (USE_MOCK) return mockSearchCatalog(query);

  // encodeURIComponent = bezpečně zapíše mezery a diakritiku do adresy
  return request(`/api/catalog?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    signal: signal ?? AbortSignal.timeout(15000),
  })
    .then((data) => {
      rememberProducts(data?.products);
      return data;
    })
    .catch((error) => {
      // Bez internetu hledáme v přípravcích, které appka už viděla (viz offline/catalogCache.js).
      // offline: true → CatalogSearch řekne pacientovi, že výsledky nemusí být úplné.
      if (error.message === 'offline') return { products: searchRemembered(query), offline: true };
      throw error;
    });
}

/**
 * Pošle seznam léků na backend a ten vrátí PIN pro lékaře.
 * @param {Array} meds – léky pacienta (z useMeds)
 * @returns {Promise<{ pin: string, expires_at: string, expires_in: number }>}
 */
export function createSharePin(meds) {
  // Backend chce u každého léku "id" a "kind". Starší léky uložené
  // v prohlížeči "kind" nemají, tak jim dáme výchozí "drug" (lék).
  const medications = meds.map((med) => ({
    id: med.id,
    kind: med.kind ?? 'drug',
    // TODO(backend): backend nezná typ "doplněk" (kind je jen drug/regimen),
    // tak ho lékaři aspoň připíšeme k názvu.
    // Texty pro lékaře posíláme vždy česky (lang 'cs'), ať je appka v jakémkoli jazyce.
    name: med.type === ITEM_TYPES.DOPLNEK ? `${med.name} (doplněk stravy)` : med.name,
    active_substance: med.active_substance ?? null,
    strength: med.strength || null,
    form: med.type === ITEM_TYPES.ONKO ? oncoFormText(med.oncoForm, 'cs') || null : med.form ?? null,
    // Backend zná dávkování jen jako text → "1-0-1-0 (ráno 1, večer 1)"
    // TODO(backend): "Užívám od", "Kdo předepsal" a "poslední dávka" backend zatím
    // neumí přijmout jako samostatná pole. Poslední dávku onkologické léčby
    // proto posíláme jako text v dávkování.
    ...(med.type === ITEM_TYPES.ONKO
      ? { frequency: med.lastDose ? `poslední dávka/cyklus ${dateText(med.lastDose, 'cs')}` : null, amount: null }
      : dosageToBackend(med.dosage)),
    source: med.source,
    // Z čeho lék je (lístek i krabička) a jestli byl lístek psaný rukou.
    // Pole catalog, uncertain_fields a conflicts NEposíláme – backend by je odmítl (400).
    ...(med.sources?.length ? { sources: med.sources } : {}),
    ...(med.note_style ? { note_style: med.note_style } : {}),
  }));

  return request('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medications }),
    signal: AbortSignal.timeout(15000),
  });
}

/**
 * Aplikace lékaře: vyzvedne léky pacienta podle PINu.
 * PIN je jednorázový – po úspěšném vyzvednutí ho backend smaže.
 * @param {string} pin – 4 číslice
 * @returns {Promise<{ medications: Array }>}
 * Chyby (error.message): 'not_found' (špatný nebo vypršelý PIN),
 * 'rate_limited' (moc špatných pokusů), 'invalid_input' (PIN nemá 4 číslice).
 */
export function claimShare(pin) {
  return request('/api/share/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
    signal: AbortSignal.timeout(15000),
  });
}

/**
 * Lékař nebo blízký: data pro pacienta (zakódovaná jako dřív do odkazu, viz encodeShare
 * ve familyShare.js) uloží backend pod jednorázový kód. Pacient ho opíše v appce.
 * @param {string} encoded – výsledek encodeShare ("1z.…")
 * @returns {Promise<{ pin: string, expires_at: string, expires_in: number }>}
 * Chyby (error.message): 'invalid_input', 'payload_too_large', 'rate_limited', 'offline'
 */
export function createHandoff(encoded) {
  return request('/api/handoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: encoded }),
    signal: AbortSignal.timeout(15000),
  });
}

/**
 * Pacient: vyzvedne data podle kódu. Kód je jednorázový.
 * @param {string} pin – 4 číslice
 * @returns {Promise<{ data: string }>} data = text pro decodeShare
 * Chyby (error.message): 'not_found', 'rate_limited', 'invalid_input', 'offline'
 */
export function claimHandoff(pin) {
  return request('/api/handoff/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
    signal: AbortSignal.timeout(15000),
  });
}

/**
 * Aplikace lékaře: zpráva jako PDF (generuje backend, POST /api/report/pdf).
 * Interakce, rozklad režimů i duplicity si backend spočítá sám.
 * Odpověď je PDF (ne JSON), proto vlastní fetch místo request().
 * @param {Array} medications – léky ve tvaru z claimShare (jen pole, která backend zná)
 * @param {'cs'|'en'|'uk'} lang – jazyk zprávy
 * @returns {Promise<{ blob: Blob, filename: string }>}
 * Chyby (error.message): 'invalid_input', 'payload_too_large', 'rate_limited' (20 za minutu), 'offline'
 */
export async function downloadReportPdf(medications, lang) {
  if (!navigator.onLine) throw new Error('offline');

  let res;
  try {
    res = await fetch('/api/report/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medications, lang }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') throw error;
    reportNetworkFailure();
    throw new Error('offline');
  }
  reportNetworkSuccess();

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.code ?? `http_${res.status}`);
  }

  // Název souboru posílá backend v hlavičce, např. "pillgaze-leky-2026-10-16-2130.pdf"
  const filename = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'pillgaze-leky.pdf';
  return { blob: await res.blob(), filename };
}

/**
 * Aplikace lékaře: zkontroluje interakce léků v databázi DDInter (na backendu).
 * Kontroluje se jen podle účinné látky – lék bez ní backend vrátí v "unchecked".
 * @param {Array} medications – léky ve tvaru z claimShare (jen pole, která backend zná)
 * @returns {Promise<{ pairs: Array<{ a: string, b: string, substance_a: string, substance_b: string,
 *   level: 'major'|'moderate'|'minor'|'unknown' }>, checked_against: { name: string, url: string,
 *   license: string, version: string }, unchecked: Array<{ id: string, name: string,
 *   reason: 'no_active_substance'|'not_in_source'|'partly_in_source', substances?: string[] }>, note: string }>}
 */
export function checkInteractions(medications) {
  return request('/api/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medications }),
    signal: AbortSignal.timeout(15000),
  });
}

/**
 * Aplikace lékaře: rozloží zkratku onkologického režimu (FOLFOX…) na léčiva.
 * Hledá se jen přesná zkratka, neznámá vrací chybu 'not_found'.
 * @param {string} text – zkratka režimu (name položky s kind = regimen)
 * @returns {Promise<{ query: string, regimens: Array<{ name: string, indication: string, drugs: string[] }>,
 *   source: { name: string, url: string }, note: string }>}
 */
export function resolveRegimen(text) {
  return request('/api/regimens/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 100) }),
    signal: AbortSignal.timeout(15000),
  });
}
