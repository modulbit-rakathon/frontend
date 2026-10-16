// Obrazovka: Sdílení s lékařem (/pin)
//
// Po otevření pošleme léky na backend a ten vrátí kód (viz createSharePin v api.js).
// Ukážeme:
//   - QR kód, který lékaři otevře stránku /doc (bez kódu – PIN nesmí být v adrese,
//     viz backend docs/api.md),
//   - velký 4místný kód, který lékař na /doc opíše,
//   - kolik minut kód ještě platí,
//   - tlačítko "Ukončit sdílení".
//
// Stavy obrazovky (proměnná `step`):
//   'loading' – čekáme na kód
//   'ready'   – kód je tu
//   'expired' – kód už neplatí, nabídneme nový
//   'ended'   – pacient sdílení ukončil
//   'error'   – nepodařilo se ho získat
//   'empty'   – pacient nemá žádné léky, není co sdílet
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useMeds } from '../context/MedsContext.jsx';
import { createSharePin } from '../api.js';
import { WarningIcon } from '../components/Icons.jsx';
import { t, tRich } from '../i18n/index.js';

// Adresa lékařské stránky (stejný server, na kterém běží appka)
const DOCTOR_URL = `${window.location.origin}/doc`;

// Zbývající čas jako "2:41"
function formatLeft(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

export default function Pin() {
  const { meds } = useMeds();

  const [step, setStep] = useState('loading');
  const [share, setShare] = useState(null); // { pin, expires_at, expires_in }
  const [qrUrl, setQrUrl] = useState(''); // obrázek QR kódu (data: adresa)
  const [now, setNow] = useState(Date.now()); // aktuální čas pro odpočet
  // Zvýšením tohohle čísla spustíme nové načtení kódu (tlačítko "Zkusit znovu" / "Nový kód").
  const [attempt, setAttempt] = useState(0);

  // QR kód vygenerujeme jednou – vede vždy na stejnou adresu /doc.
  useEffect(() => {
    QRCode.toDataURL(DOCTOR_URL, { width: 480, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQrUrl)
      .catch(() => setQrUrl('')); // bez QR to taky jde – lékař adresu napíše
  }, []);

  useEffect(() => {
    // Když pacient odejde z obrazovky dřív, než kód dorazí, výsledek zahodíme.
    let cancelled = false;

    // Bez léků není co sdílet (backend by prázdný seznam odmítl).
    if (meds.length === 0) {
      setStep('empty');
      return;
    }

    setStep('loading');
    createSharePin(meds)
      .then((result) => {
        if (cancelled) return;
        setShare(result);
        setStep('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStep('error');
      });

    return () => {
      cancelled = true;
    };
    // Léky schválně nedáváme do závislostí – kód chceme jen při otevření nebo na požádání.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Odpočet: každou sekundu posuneme "now". Když čas vyprší, přepneme na 'expired'.
  useEffect(() => {
    if (step !== 'ready') return;
    const expiresAt = new Date(share.expires_at).getTime();
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= expiresAt) setStep('expired');
    }, 1000);
    return () => clearInterval(timer);
  }, [step, share]);

  function newPin() {
    setAttempt((n) => n + 1);
  }

  // TODO(backend): backend zatím neumí sdílení zrušit (chybí endpoint).
  // Proto kód jen skryjeme. Na serveru přestane platit sám – po uplynutí
  // platnosti nebo po prvním použití lékařem.
  function endSharing() {
    setShare(null);
    setStep('ended');
  }

  const msLeft = share ? new Date(share.expires_at).getTime() - now : 0;

  return (
    <>
      <h1>{t('pin.title')}</h1>

      {step === 'empty' && (
        <p className="subtitle">{t('common.noMedsYet')}</p>
      )}

      {step === 'loading' && (
        <>
          <p className="subtitle">{t('pin.preparing')}</p>
          <div className="spinner" role="status" aria-label={t('common.loading')} />
        </>
      )}

      {step === 'ready' && (
        <>
          <p className="subtitle">{t('pin.show')}</p>

          {qrUrl && (
            <figure className="share-qr">
              <img src={qrUrl} alt={t('pin.qrAlt')} />
              <figcaption>{t('pin.qrCaption', { url: DOCTOR_URL.replace(/^https?:\/\//, '') })}</figcaption>
            </figure>
          )}

          <p className="share-step">{t('pin.enterCode')}</p>
          {/* Čtečka obrazovky přečte kód po jednotlivých číslicích: "1 2 3 4" */}
          <p className="pin-code" aria-label={t('pin.codeAria', { digits: share.pin.split('').join(' ') })}>
            {share.pin}
          </p>

          {/* aria-live off: odpočet by čtečka jinak hlásila každou sekundu */}
          <p className="pin-expiry">
            {tRich('pin.expiry', { time: <strong>{formatLeft(msLeft)}</strong> })}
          </p>

          <button type="button" className="btn btn-secondary" onClick={endSharing}>
            {t('pin.end')}
          </button>
        </>
      )}

      {step === 'ended' && (
        <>
          <div className="box box-info" role="status">
            <div className="box-title">
              <span>{t('pin.endedTitle')}</span>
            </div>
            <p>{t('pin.endedText')}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={newPin}>
            {t('pin.shareAgain')}
          </button>
        </>
      )}

      {step === 'expired' && (
        <>
          <div className="box box-info">
            <div className="box-title">
              <WarningIcon />
              <span>{t('pin.expiredTitle')}</span>
            </div>
            <p>{t('pin.expiredText')}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={newPin}>
            {t('pin.newCode')}
          </button>
        </>
      )}

      {step === 'error' && (
        <>
          <div className="box box-warning">
            <div className="box-title">
              <WarningIcon />
              <span>{t('pin.errorTitle')}</span>
            </div>
            <p>{t('common.checkConnection')}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={newPin}>
            {t('common.tryAgain')}
          </button>
        </>
      )}
    </>
  );
}
