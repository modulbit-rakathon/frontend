// Tlačítko "Přečíst nahlas". Při čtení se změní na "Zastavit čtení".
// Když prohlížeč čtení nahlas neumí, ukáže místo tlačítka krátkou poznámku.
// V celé aplikaci čte vždy jen jedno tlačítko (nové čtení zastaví předchozí).
import { useEffect, useRef, useState } from 'react';
import { canSpeak, hasVoiceFor, speak } from '../accessibility.js';

// Název jazyka do hlášky "chybí český hlas"
const VOICE_NAMES = { cs: 'český', en: 'anglický', uk: 'ukrajinský', de: 'německý', sk: 'slovenský' };

/**
 * @param {string} text – co se má přečíst
 * @param {string} lang – jazyk čtení, např. 'cs-CZ' (výchozí), 'en-GB', 'uk-UA'
 */
export default function SpeakButton({ text, lang = 'cs-CZ', className = 'btn btn-secondary' }) {
  const [speaking, setSpeaking] = useState(false);
  // Čtení selhalo (např. v zařízení není žádný hlas) → ukážeme vysvětlení
  const [failed, setFailed] = useState(false);
  // V zařízení chybí hlas pro jazyk → upozorníme, že čtení může znít divně
  const [noVoice, setNoVoice] = useState(false);
  const stopRef = useRef(null);

  // Když pacient odejde z obrazovky, naše čtení zastavíme.
  useEffect(() => () => stopRef.current?.(), []);

  if (!canSpeak) {
    return <p className="speak-fallback">Čtení nahlas tento prohlížeč neumí.</p>;
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

  const voiceName = VOICE_NAMES[lang.split('-')[0]] || 'potřebný';

  return (
    <>
      <button type="button" className={`${className} no-print`} onClick={handleClick} aria-pressed={speaking}>
        <span aria-hidden="true">{speaking ? '⏹' : '🔊'}</span>
        {speaking ? 'Zastavit čtení' : 'Přečíst nahlas'}
      </button>
      {failed ? (
        <p className="speak-fallback no-print" role="status">
          Čtení nahlas se nepovedlo – v zařízení asi chybí hlas pro čtení. Zkuste jiný prohlížeč, nebo si hlas
          doinstalujte v nastavení telefonu (Převod textu na řeč).
        </p>
      ) : (
        noVoice && (
          <p className="speak-fallback no-print" role="status">
            V zařízení chybí {voiceName} hlas, čtení proto může znít nesrozumitelně. Hlas jde doinstalovat
            v nastavení telefonu (Převod textu na řeč).
          </p>
        )
      )}
    </>
  );
}
