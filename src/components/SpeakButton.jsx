// Tlačítko "Přečíst nahlas". Při čtení se změní na "Zastavit čtení".
// Když prohlížeč čtení nahlas neumí, ukáže místo tlačítka krátkou poznámku.
// V celé aplikaci čte vždy jen jedno tlačítko (nové čtení zastaví předchozí).
import { useEffect, useRef, useState } from 'react';
import { canSpeak, hasVoiceFor, speak } from '../accessibility.js';
import { localeOf, t } from '../i18n/index.js';

/**
 * @param {string} text – co se má přečíst
 * @param {string} lang – jazyk čtení, např. 'cs-CZ', 'en-GB', 'uk-UA' (výchozí = jazyk appky)
 */
export default function SpeakButton({ text, lang = localeOf(), className = 'btn btn-secondary' }) {
  const [speaking, setSpeaking] = useState(false);
  // Čtení selhalo (např. v zařízení není žádný hlas) → ukážeme vysvětlení
  const [failed, setFailed] = useState(false);
  // V zařízení chybí hlas pro jazyk → upozorníme, že čtení může znít divně
  const [noVoice, setNoVoice] = useState(false);
  const stopRef = useRef(null);

  // Když pacient odejde z obrazovky, naše čtení zastavíme.
  useEffect(() => () => stopRef.current?.(), []);

  if (!canSpeak) {
    return <p className="speak-fallback">{t('speak.unsupported')}</p>;
  }

  function handleClick() {
    if (speaking) {
      stopRef.current?.();
      return;
    }
    setFailed(false);
    setNoVoice(hasVoiceFor(lang) === false);
    setSpeaking(true);
    // speak() voláme hned v kliknutí – jinak iOS Safari nic nepřečte
    stopRef.current = speak(text, {
      lang,
      onEnd: () => setSpeaking(false),
      onError: () => {
        setSpeaking(false);
        setFailed(true);
      },
    });
  }

  return (
    <>
      <button type="button" className={`${className} no-print`} onClick={handleClick} aria-pressed={speaking}>
        <span aria-hidden="true">{speaking ? '⏹' : '🔊'}</span>
        {speaking ? t('speak.stop') : t('speak.start')}
      </button>
      {failed ? (
        <p className="speak-fallback no-print" role="status">
          {t('speak.failed')}
        </p>
      ) : (
        noVoice && (
          <p className="speak-fallback no-print" role="status">
            {t('speak.noVoice', { language: t(`speak.voiceName.${lang.split('-')[0]}`) })}
          </p>
        )
      )}
    </>
  );
}
