// Malá lišta nahoře na každé obrazovce:
//   - "Jste bez internetu" (a co i tak funguje),
//   - stav fotek, které čekají ve frontě (posílám / přečtené – zkontrolujte).
// Novou verzi appky service worker stáhne a stránku načte znovu sám (vite.config.js).
// Když je všechno v pořádku, nezobrazí nic.
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOffline } from './OfflineContext.jsx';
import { CheckIcon, OfflineIcon } from '../components/Icons.jsx';
import './offline.css';
import { t } from '../i18n/index.js';

// Jak často se ptát serveru, jestli není nová verze appky (1 hodina)
const UPDATE_CHECK_MS = 60 * 60 * 1000;
let updateTimer = null; // časovač jen jeden, i když se lišta vykreslí znovu

/** @param {{ doctor?: boolean }} props – doctor = lékařský pohled (bez fronty fotek) */
export default function AppStatus({ doctor = false }) {
  const { online, jobs, sendingId } = useOffline();
  const location = useLocation();

  // Service worker (viz vite.config.js): po stažení nové verze se stránka sama obnoví.
  useRegisterSW({
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
      {!online && (
        <div className="app-status app-status-offline" role="status">
          <p className="app-status-title">
            <OfflineIcon />
            <span>{t('offline.title')}</span>
          </p>
          {doctor ? (
            <p>{t('offline.doctorText')}</p>
          ) : (
            <p>
              {t('offline.patientText')}
              {waitingPhotos > 0 && ` ${t('offline.waitingPhotos', { count: waitingPhotos })}`}
            </p>
          )}
        </div>
      )}

      {!doctor && online && sendingId && !onScan && (
        <div className="app-status" role="status">
          <p>{t('offline.sendingSaved')}</p>
        </div>
      )}

      {!doctor && finished > 0 && !sendingId && !onScan && (
        <Link to="/vyfotit?fronta=1" className="app-status app-status-ready">
          <p className="app-status-title">
            <CheckIcon />
            <span>{t('offline.readyTitle')}</span>
          </p>
          <p>{t('offline.readyText')}</p>
        </Link>
      )}
    </div>
  );
}
