// Tlačítko "Přečíst nahlas". Při čtení se změní na "Zastavit čtení".
// Když prohlížeč čtení nahlas neumí, ukáže místo tlačítka krátkou poznámku.
import { useEffect, useState } from 'react';
import { canSpeak, speak, stopSpeaking } from '../accessibility.js';

/** @param {string} text – co se má přečíst */
export default function SpeakButton({ text, className = 'btn btn-secondary' }) {
  const [speaking, setSpeaking] = useState(false);

  // Když pacient odejde z obrazovky, čtení zastavíme.
  useEffect(() => stopSpeaking, []);

  if (!canSpeak) {
    return <p className="speak-fallback">Čtení nahlas tento prohlížeč neumí.</p>;
  }

  function handleClick() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const utterance = speak(text);
    setSpeaking(true);
    // Po dočtení (nebo chybě) vrátíme tlačítko do původního stavu
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
  }

  return (
    <button type="button" className={`${className} no-print`} onClick={handleClick} aria-pressed={speaking}>
      <span aria-hidden="true">{speaking ? '⏹' : '🔊'}</span>
      {speaking ? 'Zastavit čtení' : 'Přečíst nahlas'}
    </button>
  );
}
