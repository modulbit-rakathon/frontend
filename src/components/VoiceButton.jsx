// Tlačítko s mikrofonem pro hlasové zadání (výchozí čeština).
// Když prohlížeč rozpoznávání řeči neumí (např. Firefox), tlačítko se vůbec neukáže.
import { useEffect, useRef, useState } from 'react';
import { canListen, listen } from '../accessibility.js';

// Srozumitelné hlášky k chybám rozpoznávání
const ERRORS = {
  'not-allowed': 'Mikrofon není povolený. Povolte ho v nastavení prohlížeče.',
  'service-not-allowed': 'Hlasové zadání je v tomto zařízení vypnuté. Napište to prosím.',
  'audio-capture': 'Mikrofon nejde zapnout. Zkontrolujte, že ho nepoužívá jiná aplikace.',
  'no-speech': 'Nic nebylo slyšet. Zkuste to znovu a mluvte blíž k telefonu.',
  network: 'Hlasové zadání potřebuje internet. Napište to prosím.',
  'language-not-supported': 'Hlasové zadání v tomto jazyce prohlížeč neumí. Napište to prosím.',
};

/**
 * @param {(text: string) => void} onResult – co pacient řekl
 * @param {string} label – pro čtečku, např. "Říct název léku"
 * @param {string} lang – jazyk poslechu, výchozí 'cs-CZ'
 */
export default function VoiceButton({ onResult, label, lang = 'cs-CZ' }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const mountedRef = useRef(true);

  // Při odchodu z obrazovky poslech ukončíme (abort = bez výsledku).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recognitionRef.current?.abort?.();
    };
  }, []);

  if (!canListen) return null;

  function handleClick() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    setError('');
    setListening(true);
    recognitionRef.current = listen(
      (text) => {
        if (mountedRef.current) onResult(text);
      },
      (code) => {
        recognitionRef.current = null;
        if (!mountedRef.current) return;
        setListening(false);
        if (code) setError(ERRORS[code] || 'Hlasové zadání se nepovedlo. Zkuste to znovu, nebo to napište.');
      },
      lang,
    );
  }

  return (
    <>
      <button
        type="button"
        className={listening ? 'voice-btn voice-btn-on' : 'voice-btn'}
        onClick={handleClick}
        aria-pressed={listening}
      >
        <span aria-hidden="true">🎤</span>
        {listening ? 'Poslouchám… (klepnutím ukončit)' : label}
      </button>
      {error && (
        <p className="speak-fallback" role="status">
          {error}
        </p>
      )}
    </>
  );
}
