// Volání backendu PillGaze.
// Adresa a klíč se berou ze souboru frontend/.env.local
//
// Při vývoji (npm run dev) voláme jen "/api/..." a Vite to přepošle
// na backend (viz proxy ve vite.config.js). V hotové appce voláme backend přímo.
const API_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

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
    name: med.name,
    active_substance: med.active_substance ?? null,
    strength: med.strength || null,
    form: med.form ?? null,
    frequency: med.frequency || null,
    amount: med.amount || null,
    source: med.source,
  }));

  return request('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medications }),
    signal: AbortSignal.timeout(15000),
  });
}
