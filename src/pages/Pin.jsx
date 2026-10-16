// Obrazovka: Sdílení zprávy s lékařem pomocí PINu
//
// Po otevření hned požádáme backend o PIN (zatím mock v mock/share.js).
// Stavy obrazovky (proměnná `step`):
//   'loading' – čekáme na PIN
//   'ready'   – PIN je tu, ukážeme ho velkým písmem
//   'error'   – nepodařilo se ho získat
import { useEffect, useState } from 'react';
import { useMeds } from '../context/MedsContext.jsx';
import { createSharePin } from '../mock/share.js';
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

  function newPin() {
    setAttempt((n) => n + 1);
  }

  return (
    <>
      <h1>Sdílet s lékařem</h1>

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
