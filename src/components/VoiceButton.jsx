// Tlačítko s mikrofonem pro hlasové zadání (v jazyce appky).
// Když prohlížeč rozpoznávání řeči neumí, tlačítko se vůbec neukáže.
import { useEffect, useRef, useState } from 'react';
import { canListen, listen } from '../accessibility.js';
import { t } from '../i18n/index.js';

/**
 * @param {(text: string) => void} onResult – co pacient řekl
 * @param {string} label – pro čtečku, např. "Říct název léku"
 */
export default function VoiceButton({ onResult, label }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  // Při odchodu z obrazovky poslech ukončíme.
  useEffect(() => () => recognitionRef.current?.stop(), []);

  if (!canListen) return null;

  function handleClick() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    setListening(true);
    recognitionRef.current = listen(onResult, () => setListening(false));
  }

  return (
    <button
      type="button"
      className={listening ? 'voice-btn voice-btn-on' : 'voice-btn'}
      onClick={handleClick}
      aria-pressed={listening}
    >
      <span aria-hidden="true">🎤</span>
      {listening ? t('voice.listening') : label}
    </button>
  );
}
