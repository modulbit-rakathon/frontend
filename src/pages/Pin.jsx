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
      <h1>Sdílet s lékařem</h1>

      {step === 'empty' && (
        <p className="subtitle">Zatím nemáte žádné léky. Nejdřív nějaký přidejte.</p>
      )}

      {step === 'loading' && (
        <>
          <p className="subtitle">Připravuji kód…</p>
          <div className="spinner" role="status" aria-label="Načítám" />
        </>
      )}

      {step === 'ready' && (
        <>
          <p className="subtitle">Ukažte lékaři tuto obrazovku</p>

          {qrUrl && (
            <figure className="share-qr">
              <img src={qrUrl} alt="QR kód, který otevře stránku pro lékaře" />
              <figcaption>Lékař si QR načte telefonem, nebo otevře {DOCTOR_URL.replace(/^https?:\/\//, '')}</figcaption>
            </figure>
          )}

          <p className="share-step">a zadá tento kód:</p>
          {/* Čtečka obrazovky přečte kód po jednotlivých číslicích: "1 2 3 4" */}
          <p className="pin-code" aria-label={`Kód ${share.pin.split('').join(' ')}`}>
            {share.pin}
          </p>

          {/* aria-live off: odpočet by čtečka jinak hlásila každou sekundu */}
          <p className="pin-expiry">
            Kód platí ještě <strong>{formatLeft(msLeft)}</strong> min a jde použít jen jednou.
          </p>

          <button type="button" className="btn btn-secondary" onClick={endSharing}>
            Ukončit sdílení
          </button>
        </>
      )}

      {step === 'ended' && (
        <>
          <div className="box box-info" role="status">
            <div className="box-title">
              <span>Sdílení ukončeno</span>
            </div>
            <p>Kód jsme skryli. Pokud ho lékař ještě nezadal, sám přestane platit do pár minut.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={newPin}>
            Sdílet znovu
          </button>
        </>
      )}

      {step === 'expired' && (
        <>
          <div className="box box-info">
            <div className="box-title">
              <WarningIcon />
              <span>Kód už neplatí</span>
            </div>
            <p>Z bezpečnostních důvodů platí kód jen pár minut.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={newPin}>
            Vytvořit nový kód
          </button>
        </>
      )}

      {step === 'error' && (
        <>
          <div className="box box-warning">
            <div className="box-title">
              <WarningIcon />
              <span>Kód se nepodařilo vytvořit</span>
            </div>
            <p>Zkontrolujte připojení k internetu a zkuste to znovu.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={newPin}>
            Zkusit znovu
          </button>
        </>
      )}
    </>
  );
}
