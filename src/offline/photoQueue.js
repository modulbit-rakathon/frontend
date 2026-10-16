// Fronta fotek, které čekají na internet.
//
// Když pacient pošle fotky bez internetu, uložíme je do IndexedDB
// (databáze v prohlížeči – na rozdíl od localStorage unese i velké fotky).
// Jakmile je internet zpět, OfflineContext je pošle na backend a výsledek
// uloží sem. Pacient ho pak zkontroluje na obrazovce Vyfotit.
//
// Jedna položka fronty ("úloha"):
//   { id, createdAt, status, photos: [{ field, file }], result?, errorCode? }
//   status: 'waiting' – čeká na internet
//           'ready'   – přečteno, čeká na kontrolu pacientem (result = odpověď backendu)
//           'failed'  – backend fotky nepřečetl (errorCode = kód chyby)
// Fotky i výsledky zůstávají jen v tomto telefonu.

const DB_NAME = 'pillgaze-offline';
const STORE = 'photo-queue';

let dbPromise = null;

// Otevře (a poprvé vytvoří) databázi.
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // Když se otevření nepovede (třeba anonymní okno), příště to zkusíme znovu.
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

// Pomocník: provede jednu operaci nad úložištěm a počká na výsledek.
async function run(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Všechny úlohy, nejstarší první. */
export async function listJobs() {
  const jobs = await run('readonly', (store) => store.getAll());
  return (jobs ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Uloží fotky do fronty.
 * @param {Array<{ field: string, file: File }>} photos
 * @returns {Promise<string>} id úlohy
 */
export async function addJob(photos) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const job = {
    id,
    createdAt: Date.now(),
    status: 'waiting',
    photos: photos.map((p) => ({ field: p.field, file: p.file })),
  };
  await run('readwrite', (store) => store.put(job));
  return id;
}

/** Změní úlohu (např. status a výsledek). */
export async function updateJob(id, changes) {
  const job = await run('readonly', (store) => store.get(id));
  if (!job) return; // mezitím smazaná
  await run('readwrite', (store) => store.put({ ...job, ...changes }));
}

/** Smaže úlohu (pacient výsledek uložil nebo zahodil). */
export async function deleteJob(id) {
  await run('readwrite', (store) => store.delete(id));
}

/**
 * Fotky rozdělené podle druhu, jak je chce analyzePhotos v api.js.
 * @param {Array<{ field: string, file: File }>} photos
 * @returns {{ note: File[], box: File[], regimen: File[] }}
 */
export function photosByField(photos) {
  const pick = (field) => photos.filter((p) => p.field === field).map((p) => p.file);
  return { note: pick('note'), box: pick('box'), regimen: pick('regimen') };
}
