// Fotoaparát přímo v aplikaci (přes celou obrazovku).
//
// Pacient nemusí odcházet do systémového fotoaparátu ani vybírat z nabídky:
// vidí náhled zadní kamery, klepne na spoušť a může fotit dál.
// Každá fotka jde hned přes onCapture do seznamu fotek na obrazovce Scan.
//
// Když kamera nejde zapnout (zákaz, chybí, používá ji jiná appka), ukážeme
// vysvětlení a tlačítko, které otevře systémový výběr fotky (onFallback).
import { useEffect, useRef, useState } from 'react';
import { CameraIcon, CheckIcon } from './Icons.jsx';
import { PHOTO_LIMITS } from '../types.js';
import { t } from '../i18n/index.js';

// Kvalita JPEGu z kamery – zmenšení a další komprese dělá až shrinkPhoto.
const QUALITY = 0.92;

// Pořadové číslo fotky do názvu souboru
let shotCounter = 0;

/**
 * @param {object} props
 * @param {string} props.title – druh fotky (např. "Krabičky léků")
 * @param {number} props.remaining – kolik fotek ještě jde přidat
 * @param {(file: File) => void} props.onCapture – nová fotka
 * @param {() => void} props.onClose – zavřít fotoaparát
 * @param {() => void} props.onFallback – otevřít systémový výběr fotky
 */
export default function CameraCapture({ title, remaining, onCapture, onClose, onFallback }) {
  const dialogRef = useRef(null);
  const videoRef = useRef(null);
  const shutterRef = useRef(null);
  const streamRef = useRef(null);

  // 'starting' | 'ready' | 'denied' | 'unavailable'
  const [status, setStatus] = useState('starting');
  const [taken, setTaken] = useState(0);
  const [thumbUrl, setThumbUrl] = useState('');
  const [flash, setFlash] = useState(false);
  // Pacient při focení nemůže fotky odebírat → stačí si limit zapamatovat při otevření.
  const [limit] = useState(remaining);
  const full = taken >= limit;

  // Zapnutí kamery při otevření, vypnutí při zavření
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus(error.name === 'NotAllowedError' || error.name === 'SecurityError' ? 'denied' : 'unavailable');
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  // Fokus do dialogu, po zavření zpátky na tlačítko, které ho otevřelo.
  // Stránka pod fotoaparátem se mezitím neposouvá.
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current.querySelector('button')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // Jakmile kamera běží, fokus na spoušť
  useEffect(() => {
    if (status === 'ready') shutterRef.current?.focus();
  }, [status]);

  // Uvolnění náhledu poslední fotky
  useEffect(() => () => thumbUrl && URL.revokeObjectURL(thumbUrl), [thumbUrl]);

  // Esc zavře; Tab zůstává uvnitř dialogu.
  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (full || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `foto-${++shotCounter}.jpg`, { type: 'image/jpeg' }));
        setThumbUrl(URL.createObjectURL(blob));
      },
      'image/jpeg',
      QUALITY,
    );

    setTaken((n) => n + 1);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  }

  const failed = status === 'denied' || status === 'unavailable';

  return (
    <div
      ref={dialogRef}
      className="camera-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-title"
      onKeyDown={handleKeyDown}
    >
      <div className="camera-top">
        <h2 id="camera-title" className="camera-title">
          {title}
        </h2>
        <button type="button" className="camera-close" onClick={onClose}>
          {t('camera.close')}
        </button>
      </div>

      <div className="camera-view">
        <video ref={videoRef} className="camera-video" autoPlay playsInline muted aria-hidden="true" />
        {flash && <div className="camera-flash" aria-hidden="true" />}

        {status === 'starting' && (
          <p className="camera-message" role="status">
            {t('camera.starting')}
          </p>
        )}

        {failed && (
          <div className="camera-message camera-error" role="alert">
            <p>
              <strong>{t(`camera.${status}`)}</strong>
            </p>
            <p>{t(`camera.${status}.hint`)}</p>
            <button type="button" className="btn btn-primary" onClick={onFallback}>
              <CameraIcon />
              {t('camera.fallback')}
            </button>
          </div>
        )}
      </div>

      {!failed && (
        <div className="camera-controls">
          <div className="camera-thumb-slot">
            {thumbUrl && <img className="camera-thumb" src={thumbUrl} alt={t('camera.lastPhoto')} />}
          </div>
          <button
            ref={shutterRef}
            type="button"
            className="camera-shutter"
            aria-label={t('camera.shutter')}
            onClick={takePhoto}
            disabled={status !== 'ready' || full}
          />
          <button type="button" className="camera-done" onClick={onClose}>
            <CheckIcon size={24} />
            {t('camera.done')}
          </button>
          {/* role="status" = čtečka přečte, že fotka přibyla */}
          <p className="camera-count" role="status">
            {full ? t('scan.tooMany', { max: PHOTO_LIMITS.maxCount }) : taken > 0 ? t('camera.taken', { count: taken }) : ''}
          </p>
        </div>
      )}
    </div>
  );
}
