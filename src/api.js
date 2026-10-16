// Volání backendu PillGaze.
// Adresa a klíč se berou ze souboru frontend/.env.local
const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

/**
 * Pošle fotku na backend a vrátí, co AI přečetla.
 * @param {File} file – fotka
 * @param {'box' | 'note' | 'regimen'} source – co je na fotce
 */
export async function analyzePhoto(file, source) {
  // Data posíláme jako "formulář" (multipart/form-data) – tak to backend chce.
  const form = new FormData();
  form.append('source', source);
  form.append('image', file);

  const res = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'X-Api-Key': API_KEY },
    body: form,
    // Když backend neodpoví do 120 sekund, vzdáme to.
    signal: AbortSignal.timeout(120000),
  });

  const data = await res.json();

  // res.ok = false znamená chybu (401, 422, 502…). Backend posílá { error: { code, message } }.
  if (!res.ok) {
    throw new Error(data.error.code);
  }

  return data; // { medications: [...], unreadable_items: číslo }
}