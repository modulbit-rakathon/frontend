// Obrazovka: Sdílení zprávy s lékařem pomocí PINu
//
// Po otevření hned pošleme léky na backend a ten vrátí PIN (viz createSharePin v api.js).
// Stavy obrazovky (proměnná `step`):
//   'loading' – čekáme na PIN
//   'ready'   – PIN je tu, ukážeme ho velkým písmem
//   'expired' – PIN už neplatí, nabídneme nový
//   'error'   – nepodařilo se ho získat
//   'empty'   – pacient nemá žádné léky, není co sdílet
import { useEffect, useState } from 'react';
import { useMeds } from '../context/MedsContext.jsx';
import { createSharePin } from '../api.js';
import { WarningIcon } from '../components/Icons.jsx';

export default function Pin() {
  const { meds } = useMeds();

  const [step, setStep] = useState('loading');
  const [share, setShare] = useState(null); // { pin, expires_at }
  // Zvýšením tohohle čísla spustíme nové načtení PINu (tlačítko "Zkusit znovu" / "Nový PIN").
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Když pacient odejde z obrazovky dřív, než PIN dorazí, výsledek zahodíme.
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
    // Léky schválně nedáváme do závislostí – PIN chceme jen při otevření nebo na požádání.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Když PIN vyprší, přepneme obrazovku na 'expired' (lékař by ho už nemohl použít).
  useEffect(() => {
    if (step !== 'ready') return;

    const msLeft = new Date(share.expires_at).getTime() - Date.now();
    const timer = setTimeout(() => setStep('expired'), Math.max(msLeft, 0));

    // Když se obrazovka zavře nebo přijde nový PIN, starý budík zrušíme.
    return () => clearTimeout(timer);
  }, [step, share]);

  function newPin() {
    setAttempt((n) => n + 1);
  }

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
          <p className="subtitle">Lékaři nadiktujte tento kód</p>
          {/* Čtečka obrazovky přečte PIN po jednotlivých číslicích: "1 2 3 4" */}
          <p className="pin-code" aria-label={`PIN ${share.pin.split('').join(' ')}`}>
            {share.pin}
          </p>
          <p className="pin-expiry">
            Platí do{' '}
            {new Date(share.expires_at).toLocaleTimeString('cs-CZ', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <button type="button" className="btn btn-secondary" onClick={newPin}>
            Vytvořit nový kód
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
