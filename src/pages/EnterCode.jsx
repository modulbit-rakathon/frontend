// Obrazovka: Zadat kód (/kod)
//
// Lékař (/doc) nebo blízký pošle pacientovi léky jednorázovým kódem (HandoffCode).
// Pacient ho tady opíše → vyzvedneme data z backendu (claimHandoff v api.js)
// a ukážeme stejnou kontrolu jako u odkazu (FamilyOpen): nic se neuloží bez potvrzení.
import { useState } from 'react';
import { claimHandoff } from '../api.js';
import FamilyOpen from './FamilyOpen.jsx';
import BackButton from '../components/BackButton.jsx';
import { t } from '../i18n/index.js';

// Chyby z backendu, pro které máme vlastní text (jinak obecná)
const ERROR_CODES = ['not_found', 'rate_limited', 'offline'];

export default function EnterCode() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState('');
  const [encoded, setEncoded] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (pin.length !== 4) {
      setErrorCode('length');
      return;
    }
    setLoading(true);
    setErrorCode('');
    try {
      const { data } = await claimHandoff(pin);
      setEncoded(data);
    } catch (error) {
      setErrorCode(ERROR_CODES.includes(error.message) ? error.message : 'other');
    } finally {
      setLoading(false);
    }
  }

  if (encoded) return <FamilyOpen encoded={encoded} />;

  return (
    <>
      <BackButton to="/" />
      <h1>{t('enterCode.title')}</h1>
      <p className="subtitle">{t('enterCode.subtitle')}</p>

      <form className="family-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="enter-code">{t('enterCode.label')}</label>
          <input
            id="enter-code"
            className="code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="0000"
            aria-invalid={Boolean(errorCode)}
            aria-describedby={errorCode ? 'enter-code-error' : undefined}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>

        {errorCode && (
          <p id="enter-code-error" className="box box-warning" role="alert">
            {t(`enterCode.error.${errorCode}`)}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? t('enterCode.loading') : t('enterCode.submit')}
        </button>
      </form>
    </>
  );
}
