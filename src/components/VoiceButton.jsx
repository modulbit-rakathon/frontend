// Tlačítko s mikrofonem pro hlasové zadání (v jazyce appky).
// Když prohlížeč rozpoznávání řeči neumí (např. Firefox), tlačítko se vůbec neukáže.
import { useEffect, useRef, useState } from 'react';
import { canListen, listen } from '../accessibility.js';
import { localeOf, t } from '../i18n/index.js';

// Chyby rozpoznávání, pro které máme vlastní hlášku (voice.error.*)
const KNOWN_ERRORS = ['not-allowed', 'service-not-allowed', 'audio-capture', 'no-speech', 'network', 'language-not-supported'];

/**
 * @param {(text: string) => void} onResult – co pacient řekl
 * @param {string} label – pro čtečku, např. "Říct název léku"
 * @param {string} lang – jazyk poslechu, výchozí = jazyk appky
 */
export default function VoiceButton({ onResult, label, lang = localeOf() }) {
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
        if (code) setError(KNOWN_ERRORS.includes(code) ? code : 'unknown');
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
        {listening ? t('voice.listening') : label}
      </button>
      {error && (
        <p className="speak-fallback" role="status">
          {t(`voice.error.${error}`)}
        </p>
      )}
    </>
  );
}
