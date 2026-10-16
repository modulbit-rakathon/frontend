// Volání backendu PillGaze.
import { ITEM_TYPES, dateText, dosageToBackend, oncoFormText } from './types.js';
import { analyzePhoto as mockAnalyzePhoto } from './mock/analyze.js';
// Adresa a klíč se berou ze souboru frontend/.env.local
//
// Při vývoji (npm run dev) voláme jen "/api/..." a Vite to přepošle
// na backend (viz proxy ve vite.config.js). V hotové appce voláme backend přímo.
const API_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;
// VITE_MOCK_API=true → focení nevolá backend, ale mock (src/mock/analyze.js)
const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

// Společná funkce pro všechna volání: pošle požadavek a zpracuje chyby.
async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'X-Api-Key': API_KEY, ...options.headers },
  });

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
 * Pošle fotku na backend a vrátí, co AI přečetla.
 * @param {File} file – fotka
 * @param {'box' | 'note' | 'regimen'} source – co je na fotce
 * @returns {Promise<{ medications: Array, unreadable_items: number }>}
 */
export function analyzePhoto(file, source) {
  // Mock místo backendu (zapíná se v .env.local: VITE_MOCK_API=true)
  if (USE_MOCK) return mockAnalyzePhoto(file, source);

  // Data posíláme jako "formulář" (multipart/form-data) – tak to backend chce.
  const form = new FormData();
  form.append('source', source);
  form.append('image', file);

  return request('/api/analyze', {
    method: 'POST',
    body: form,
    // Když backend neodpoví do 120 sekund, vzdáme to.
    signal: AbortSignal.timeout(120000),
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
    name: med.type === ITEM_TYPES.DOPLNEK ? `${med.name} (doplněk stravy)` : med.name,
    active_substance: med.active_substance ?? null,
    strength: med.strength || null,
    form: med.type === ITEM_TYPES.ONKO ? oncoFormText(med.oncoForm) || null : med.form ?? null,
    // Backend zná dávkování jen jako text → "1-0-1-0 (ráno 1, večer 1)"
    // TODO(backend): "Užívám od", "Kdo předepsal" a "poslední dávka" backend zatím
    // neumí přijmout jako samostatná pole. Poslední dávku onkologické léčby
    // proto posíláme jako text v dávkování.
    ...(med.type === ITEM_TYPES.ONKO
      ? { frequency: med.lastDose ? `poslední dávka/cyklus ${dateText(med.lastDose)}` : null, amount: null }
      : dosageToBackend(med.dosage)),
    source: med.source,
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
