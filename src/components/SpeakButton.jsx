// Tlačítko "Přečíst nahlas". Při čtení se změní na "Zastavit čtení".
// Když prohlížeč čtení nahlas neumí, ukáže místo tlačítka krátkou poznámku.
import { useEffect, useState } from 'react';
import { canSpeak, speak, stopSpeaking } from '../accessibility.js';
import { t } from '../i18n/index.js';

/** @param {string} text – co se má přečíst */
export default function SpeakButton({ text, className = 'btn btn-secondary' }) {
  const [speaking, setSpeaking] = useState(false);
  // Čtení selhalo (např. v zařízení není žádný hlas) → ukážeme vysvětlení
  const [failed, setFailed] = useState(false);

  // Když pacient odejde z obrazovky, čtení zastavíme.
  useEffect(() => stopSpeaking, []);

  if (!canSpeak) {
    return <p className="speak-fallback">{t('speak.unsupported')}</p>;
  }

  function handleClick() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const utterance = speak(text);
    setSpeaking(true);
    setFailed(false);
    // Po dočtení (nebo chybě) vrátíme tlačítko do původního stavu
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (event) => {
      setSpeaking(false);
      // 'interrupted' / 'canceled' = čtení jsme zastavili sami, to není chyba
      if (event.error !== 'interrupted' && event.error !== 'canceled') setFailed(true);
    };
  }

  return (
    <>
      <button type="button" className={`${className} no-print`} onClick={handleClick} aria-pressed={speaking}>
        <span aria-hidden="true">{speaking ? '⏹' : '🔊'}</span>
        {speaking ? t('speak.stop') : t('speak.start')}
      </button>
      {failed && (
        <p className="speak-fallback" role="status">
          {t('speak.failed')}
        </p>
      )}
    </>
  );
}
