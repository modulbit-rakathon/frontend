// Kód pro pacienta (lékař v /doc nebo blízký posílá léky zpět).
//
// Data (encodeShare z familyShare.js) uloží backend pod jednorázový 4místný kód
// (createHandoff v api.js). Pacient ho opíše v appce na obrazovce /kod.
// Odkaz ani QR nepoužíváme: otevřely by se v prohlížeči, ne v appce z plochy.
//
// Stavy (`step`): 'loading' → 'ready' → 'expired' | 'offline' | 'error'
import { useEffect, useState } from 'react';
import { createHandoff } from '../api.js';
import { useOnline } from '../offline/network.js';
import { OfflineIcon, WarningIcon } from './Icons.jsx';
import { formatLeft } from '../labels.js';
import { t, tRich } from '../i18n/index.js';

// intro = věta nad kódem (kdo a kde ho zadá)
export default function HandoffCode({ encoded, intro }) {
  const online = useOnline();
  const [step, setStep] = useState('loading');
  const [share, setShare] = useState(null); // { pin, expires_at, expires_in }
  const [now, setNow] = useState(Date.now());
  // Zvýšením spustíme nový kód ("Vytvořit nový kód" / "Zkusit znovu").
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStep('loading');
    createHandoff(encoded)
      .then((result) => {
        if (cancelled) return;
        setShare(result);
        setNow(Date.now());
        setStep('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setStep(error.message === 'offline' ? 'offline' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [encoded, attempt]);

  // Odpočet platnosti, po vypršení nabídneme nový kód.
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

  // Internet je zpět → kód vytvoříme sami.
  useEffect(() => {
    if (online && step === 'offline') setAttempt((n) => n + 1);
  }, [online, step]);

  const retry = () => setAttempt((n) => n + 1);

  if (step === 'loading') {
    return <div className="spinner" role="status" aria-label={t('handoff.preparing')} />;
  }

  if (step === 'ready') {
    const msLeft = new Date(share.expires_at).getTime() - now;
    return (
      <div className="handoff-code">
        <p className="share-step">{intro}</p>
        {/* Čtečka obrazovky přečte kód po jednotlivých číslicích: "1 2 3 4" */}
        <p className="pin-code" aria-label={t('pin.codeAria', { digits: share.pin.split('').join(' ') })}>
          {share.pin}
        </p>
        {/* aria-live off: odpočet by čtečka jinak hlásila každou sekundu */}
        <p className="pin-expiry">{tRich('handoff.expiry', { time: <strong>{formatLeft(msLeft)}</strong> })}</p>
      </div>
    );
  }

  const [css, Icon, title, text, button] = {
    expired: ['box-info', WarningIcon, 'handoff.expiredTitle', 'handoff.expiredText', 'pin.newCode'],
    offline: ['box-info', OfflineIcon, 'handoff.offlineTitle', 'handoff.offlineText', 'common.tryAgain'],
    error: ['box-warning', WarningIcon, 'handoff.errorTitle', 'common.checkConnection', 'common.tryAgain'],
  }[step];

  return (
    <div className="handoff-code">
      <div className={`box ${css}`} role="status">
        <div className="box-title">
          <Icon />
          <span>{t(title)}</span>
        </div>
        <p>{t(text)}</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={retry}>
        {t(button)}
      </button>
    </div>
  );
}
