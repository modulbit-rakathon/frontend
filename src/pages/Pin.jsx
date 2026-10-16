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
import { createSharePayload, getShareIssues } from '@pillgaze/core';
import { useMeds } from '../context/MedsContext.jsx';
import { createSharePin, apiErrorMessage } from '../api.js';
import { WarningIcon } from '../components/Icons.jsx';
import ReviewNotice from '../components/ReviewNotice.jsx';
import { useRetryAfter } from '../useRetryAfter.js';

export default function Pin() {
  const { meds, unreadableCount, storageError } = useMeds();

  const [step, setStep] = useState('loading');
  const [share, setShare] = useState(null); // { pin, expires_at }
  // Zvýšením tohohle čísla spustíme nové načtení PINu (tlačítko "Zkusit znovu" / "Nový PIN").
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [retryAfter, setRetryAfter] = useRetryAfter();

  useEffect(() => {
    // Když pacient odejde z obrazovky dřív, než PIN dorazí, výsledek zahodíme.
    let cancelled = false;
    const controller = new AbortController();
    setShare(null);
    if (storageError || getShareIssues(meds, { unreadableCount }).some(issue => issue.code !== 'item_count')) {
      setStep('blocked');
      return;
    }

    // Bez léků není co sdílet (backend by prázdný seznam odmítl).
    if (meds.length === 0) {
      setStep('empty');
      return;
    }

    setStep('loading');
    if (meds.length > 50) {
      setStep('blocked');
      return;
    }
    const payload = createSharePayload(meds, { unreadableCount });
    // Defer the side effect so StrictMode's initial cleanup does not allocate an extra PIN.
    const timer = setTimeout(() => createSharePin(payload, { signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        setShare(result);
        setStep('ready');
      })
      .catch(failure => {
        if (cancelled) return;
        setError(apiErrorMessage(failure));
        setRetryAfter(failure.retryAfter ?? 0);
        setStep('error');
      }), 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, meds, unreadableCount, storageError]);

  // Když PIN vyprší, přepneme obrazovku na 'expired' (lékař by ho už nemohl použít).
  useEffect(() => {
    if (step !== 'ready') return;

    const msLeft = new Date(share.expires_at).getTime() - Date.now();
    const timer = setTimeout(() => setStep('expired'), Math.max(msLeft, 0));

    // Když se obrazovka zavře nebo přijde nový PIN, starý budík zrušíme.
    return () => clearTimeout(timer);
  }, [step, share]);

  function newPin() {
    if (retryAfter === 0) setAttempt((n) => n + 1);
  }

  return (
    <>
      <h1>Sdílet s lékařem</h1>
      {step === 'blocked' && <ReviewNotice />}

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
            <p role="alert">{error}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={newPin} disabled={retryAfter > 0}>
            {retryAfter > 0 ? `Zkusit znovu za ${retryAfter} s` : 'Zkusit znovu'}
          </button>
        </>
      )}
    </>
  );
}
