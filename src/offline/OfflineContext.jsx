// Sdílený stav "bez internetu" pro celou appku:
//   - online: jsme připojeni? (viz network.js)
//   - jobs: fronta fotek čekajících na internet (viz photoQueue.js)
//   - sendingId: kterou úlohu z fronty právě posíláme
//
// Fronta se zpracuje sama: hned po návratu internetu, při spuštění appky
// a pak každých 30 sekund, dokud v ní něco čeká.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { USE_MOCK, analyzePhotos } from '../api.js';
import { isOnline, useOnline } from './network.js';
import { addJob, deleteJob, listJobs, photosByField, updateJob } from './photoQueue.js';

const RETRY_MS = 30000;

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const online = useOnline();
  const [jobs, setJobs] = useState([]);
  const [sendingId, setSendingId] = useState(null);
  const busyRef = useRef(false); // běží zrovna odesílání? (ať neposíláme dvakrát)

  async function refresh() {
    try {
      setJobs(await listJobs());
    } catch {
      setJobs([]); // IndexedDB nejde použít – fronta prostě nebude
    }
  }

  // Pošle všechny čekající úlohy, jednu po druhé.
  async function processQueue() {
    if (busyRef.current || !isOnline() || USE_MOCK) return;
    busyRef.current = true;
    try {
      for (const job of await listJobs()) {
        if (job.status !== 'waiting') continue;
        if (!isOnline()) break;
        setSendingId(job.id);
        try {
          const result = await analyzePhotos(photosByField(job.photos));
          await updateJob(
            job.id,
            result.medications.length > 0
              ? { status: 'ready', result }
              : { status: 'failed', errorCode: 'nothing_found' },
          );
        } catch (error) {
          // Internet zase vypadl → úloha počká na další pokus.
          if (error.message === 'offline') break;
          await updateJob(job.id, { status: 'failed', errorCode: error.message });
        }
        await refresh();
      }
    } catch {
      // chyba IndexedDB – zkusíme to příště
    } finally {
      busyRef.current = false;
      setSendingId(null);
      refresh();
    }
  }

  // Po spuštění načteme frontu a při každém návratu internetu ji zkusíme odeslat.
  useEffect(() => {
    refresh();
    if (online) processQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Dokud něco čeká, zkoušíme to občas znovu (internet mohl naskočit "potichu").
  const waiting = jobs.filter((j) => j.status === 'waiting').length;
  useEffect(() => {
    if (waiting === 0) return;
    const timer = setInterval(processQueue, RETRY_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  /** Uloží fotky do fronty. Vrací id úlohy. */
  async function enqueuePhotos(photos) {
    const id = await addJob(photos);
    // Požádáme prohlížeč, ať data v telefonu nemaže při nedostatku místa.
    navigator.storage?.persist?.().catch(() => {});
    await refresh();
    return id;
  }

  /** Odebere úlohu z fronty (výsledek je uložený nebo ho pacient nechce). */
  async function removeJob(id) {
    try {
      await deleteJob(id);
    } finally {
      await refresh();
    }
  }

  return (
    <OfflineContext.Provider value={{ online, jobs, sendingId, enqueuePhotos, removeJob }}>
      {children}
    </OfflineContext.Provider>
  );
}

// const { online, jobs } = useOffline();
export function useOffline() {
  return useContext(OfflineContext);
}
