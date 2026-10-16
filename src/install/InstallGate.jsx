// Obrazovka "Nejdřív si PillGaze přidejte na plochu".
// Na mobilu appku pustíme jen z plochy (jako PWA): tam funguje bez internetu,
// má vlastní ikonu a data zůstanou na jednom místě.
//   - Android (Chrome, Edge, Samsung): tlačítko otevře systémovou nabídku instalace.
//   - Android bez nabídky (Firefox, už nainstalováno…): návod přes menu ⋮.
//   - iPhone / iPad: návod přes tlačítko Sdílet.
import { useState } from 'react';
import { isIOS, promptInstall, useInstallPrompt } from './installPrompt.js';
import { CheckIcon, InfoIcon } from '../components/Icons.jsx';
import LanguageSwitch from '../components/LanguageSwitch.jsx';
import { t } from '../i18n/index.js';

// Ikonka "Sdílet" ze Safari (čtverec se šipkou nahoru)
function ShareIcon() {
  return (
    <svg className="install-inline-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M8 11H6v10h12V11h-2" />
    </svg>
  );
}

// Ikonka "Přidat na plochu" (čtverec s plusem)
function AddSquareIcon({ size = 26 }) {
  return (
    <svg className="install-inline-icon" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

// Tři tečky pod sebou – menu prohlížeče na Androidu
function MenuDotsIcon() {
  return (
    <svg className="install-inline-icon" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function Steps({ steps }) {
  return (
    <ol className="install-steps">
      {steps.map((step, i) => (
        <li key={i} className="install-step">
          <span className="install-step-num" aria-hidden="true">{i + 1}</span>
          <span className="install-step-text">
            <span className="install-step-title">{step.title}</span>
            {step.hint && <span className="install-step-hint">{step.hint}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function InstallGate() {
  const { canPrompt, installed } = useInstallPrompt();
  const [declined, setDeclined] = useState(false);
  const ios = isIOS();

  async function handleInstall() {
    const accepted = await promptInstall();
    if (!accepted) setDeclined(true);
  }

  const openFromHome = { title: t('install.stepOpen') };

  let body;
  if (installed) {
    body = (
      <div className="install-done" role="status">
        <span className="install-done-icon"><CheckIcon size={36} /></span>
        <p className="install-done-title">{t('install.doneTitle')}</p>
        <p>{t('install.doneText')}</p>
      </div>
    );
  } else if (ios) {
    body = (
      <Steps
        steps={[
          {
            title: <>{t('install.iosTap')} <ShareIcon /> <strong>{t('install.iosShare')}</strong></>,
            hint: t('install.iosShareHint'),
          },
          {
            title: <>{t('install.choose')} <AddSquareIcon /> <strong>{t('install.addToHome')}</strong></>,
            hint: t('install.iosAddHint'),
          },
          openFromHome,
        ]}
      />
    );
  } else if (canPrompt) {
    body = (
      <button type="button" className="btn btn-primary install-button" onClick={handleInstall}>
        <AddSquareIcon size={30} />
        {t('install.addToHome')}
      </button>
    );
  } else {
    // Android bez systémové nabídky – ruční postup přes menu prohlížeče.
    body = (
      <>
        {declined && <p className="install-declined">{t('install.declined')}</p>}
        <Steps
          steps={[
            {
              title: <>{t('install.androidTap')} <MenuDotsIcon /> <strong>{t('install.androidMenu')}</strong></>,
              hint: t('install.androidMenuHint'),
            },
            {
              title: <>{t('install.choose')} <AddSquareIcon /> <strong>{t('install.androidAdd')}</strong></>,
              hint: t('install.androidAddHint'),
            },
            openFromHome,
          ]}
        />
      </>
    );
  }

  return (
    <main className="install-gate">
      <header className="install-brand">
        <img src="/icons/icon-192.png" alt="" width="72" height="72" className="install-logo" />
        <span className="install-name">PillGaze</span>
      </header>
      <p className="subtitle install-tagline">{t('install.tagline')}</p>

      <section className="card install-card" aria-labelledby="install-title">
        <h1 id="install-title" className="install-title">{t('install.title')}</h1>
        <p className="install-why">{t('install.why')}</p>
        {body}
      </section>

      <p className="install-note">
        <InfoIcon size={24} />
        <span>{t('install.alreadyHave')}</span>
      </p>

      <div className="install-lang">
        <LanguageSwitch />
      </div>
    </main>
  );
}
