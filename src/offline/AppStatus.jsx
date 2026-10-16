// Malá lišta nahoře na každé obrazovce:
//   - "Jste bez internetu" (a co i tak funguje),
//   - stav fotek, které čekají ve frontě (posílám / přečtené – zkontrolujte),
//   - nová verze appky → tlačítko "Načíst novou verzi".
// Když je všechno v pořádku, nezobrazí nic.
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOffline } from './OfflineContext.jsx';
import { CheckIcon, OfflineIcon, RefreshIcon } from '../components/Icons.jsx';
import './offline.css';

// Jak často se ptát serveru, jestli není nová verze appky (1 hodina)
const UPDATE_CHECK_MS = 60 * 60 * 1000;
let updateTimer = null; // časovač jen jeden, i když se lišta vykreslí znovu

/** @param {{ doctor?: boolean }} props – doctor = lékařský pohled (bez fronty fotek) */
export default function AppStatus({ doctor = false }) {
  const { online, jobs, sendingId } = useOffline();
  const location = useLocation();

  // Service worker (viz vite.config.js): needRefresh = je stažená nová verze.
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Appka může být otevřená dlouho – občas se zeptáme na novou verzi.
      if (!registration || updateTimer) return;
      updateTimer = setInterval(() => navigator.onLine && registration.update(), UPDATE_CHECK_MS);
    },
  });

  // Po návratu internetu se zeptáme na novou verzi hned.
  useEffect(() => {
    if (!online) return;
    navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
  }, [online]);

  const waitingPhotos = jobs
    .filter((j) => j.status === 'waiting')
    .reduce((sum, j) => sum + j.photos.length, 0);
  const finished = jobs.filter((j) => j.status !== 'waiting').length;
  // Na obrazovce Vyfotit má pacient frontu přímo před sebou.
  const onScan = location.pathname === '/vyfotit';

  return (
    <div className={doctor ? 'app-status-area app-status-area-doc no-print' : 'app-status-area no-print'}>
      {needRefresh && (
        <div className="app-status app-status-update" role="status">
          <p className="app-status-title">
            <RefreshIcon />
            <span>Je připravená nová verze aplikace</span>
          </p>
          <p>Vaše léky zůstanou uložené.</p>
          <div className="app-status-actions">
            <button type="button" className="btn btn-primary" onClick={() => updateServiceWorker(true)}>
              Načíst novou verzi
            </button>
            <button type="button" className="btn btn-link" onClick={() => setNeedRefresh(false)}>
              Teď ne
            </button>
          </div>
        </div>
      )}

      {!online && (
        <div className="app-status app-status-offline" role="status">
          <p className="app-status-title">
            <OfflineIcon />
            <span>Jste bez internetu</span>
          </p>
          {doctor ? (
            <p>Načíst léky pacienta jde až po připojení.</p>
          ) : (
            <p>
              Nevadí. Vaše léky jsou uložené v telefonu a appka funguje dál.
              {waitingPhotos > 0 && ` Uložené fotky (${waitingPhotos}) pošleme, až bude internet.`}
            </p>
          )}
        </div>
      )}

      {!doctor && online && sendingId && !onScan && (
        <div className="app-status" role="status">
          <p>Internet je zpět. Posílám uložené fotky…</p>
        </div>
      )}

      {!doctor && finished > 0 && !sendingId && !onScan && (
        <Link to="/vyfotit?fronta=1" className="app-status app-status-ready">
          <p className="app-status-title">
            <CheckIcon />
            <span>Fotky jsou zpracované</span>
          </p>
          <p>Klepněte sem a zkontrolujte, co jsme přečetli.</p>
        </Link>
      )}
    </div>
  );
}
