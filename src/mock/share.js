// MOCK (náhrada) za backend, který vytvoří PIN pro lékaře.
// Až bude hotový backend, nahradíme obsah funkce createSharePin voláním API, např.:
//
//   const res = await fetch('/api/share', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ medications: meds }),
//   });
//   if (!res.ok) throw new Error('Nepodařilo se vytvořit PIN.');
//   return res.json();
//
// Zbytek aplikace se měnit nemusí, pokud backend vrátí stejný tvar dat.

// Pevný PIN pro testování – mock vrací pořád tenhle.
const TEST_PIN = '1234';

// Jak dlouho PIN platí (v minutách) – jen pro ukázku.
const VALID_MINUTES = 3;

// Jak dlouho nejvýš čekáme na odpověď serveru, než to vzdáme (v milisekundách).
const TIMEOUT_MS = 5000;

// Jak dlouho "server" předstírá přemýšlení. Dejte víc než TIMEOUT_MS
// (např. 8000) a uvidíte chybovou obrazovku.
const FAKE_DELAY_MS = 1000;

/**
 * Předstírá, že backend uložil léky a vrátil PIN.
 * @param {Array} meds – seznam léků pacienta (z useMeds)
 * @returns {Promise<{ pin: string, expires_at: string }>}
 *   pin        – 4místný kód, který pacient nadiktuje lékaři
 *   expires_at – kdy PIN přestane platit (ISO datum, např. "2026-10-16T14:30:00.000Z")
 */
export function createSharePin(meds) {
  // Skutečný backend léky uloží; mock je zatím nepotřebuje.
  void meds;

  return new Promise((resolve, reject) => {
    // "Budík": když server do TIMEOUT_MS neodpoví, vrátíme chybu.
    // Promise jde ukončit jen jednou – co přijde dřív (PIN, nebo budík), vyhraje.
    const timer = setTimeout(() => {
      reject(new Error('Server neodpověděl včas.'));
    }, TIMEOUT_MS);

    // Předstíráme, že se volá server.
    setTimeout(() => {
      clearTimeout(timer); // PIN dorazil → budík už nepotřebujeme
      const expiresAt = new Date(Date.now() + VALID_MINUTES * 60 * 1000);
      resolve({ pin: TEST_PIN, expires_at: expiresAt.toISOString() });
    }, FAKE_DELAY_MS);
  });
}
