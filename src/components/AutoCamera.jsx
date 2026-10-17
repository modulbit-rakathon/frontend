// Fotoaparát, který vyfotí sám, když je obraz ostrý a telefon se nehýbe.
// onPhoto(file) – zavolá se s každou vyfocenou fotkou (JPEG)
// onClose()     – pacient dal "Hotovo"
// onFallback()  – kamera nejde zapnout → pacient chce systémový fotoaparát telefonu
// onGallery()   – pacient chce místo focení vybrat fotky z galerie
// field         – co se fotí ('note' | 'box' | 'regimen'), podle toho je nápověda
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/index.js';

// ---- Čísla k vyladění (viz krok 5) ----
const CHECK_MS = 150; // jak často kontrolujeme obraz
const SHARP_MIN = 120; // minimální ostrost
const MOTION_MAX = 6; // největší dovolený pohyb mezi snímky
const STEADY_CHECKS = 4; // kolikrát po sobě musí být obraz v pořádku
const REARM_MOTION = 20; // po vyfocení: takový pohyb = pacient míří na další krabičku
const W = 160; // zmenšený snímek pro výpočty (rychlejší než plné rozlišení)
const H = 120;

// Snímek → pole jasů (0–255), jedno číslo na pixel
function toGray(ctx) {
  const { data } = ctx.getImageData(0, 0, W, H);
  const gray = new Float32Array(W * H);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }
  return gray;
}

// Ostrost: pro každý pixel porovnáme jas se 4 sousedy. Ostré hrany = velké rozdíly.
// Výsledek je rozptyl těch rozdílů (čím víc, tím ostřejší obraz).
function sharpness(gray) {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const edge = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - W] - gray[i + W];
      sum += edge;
      sumSq += edge * edge;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

// Pohyb: průměrný rozdíl jasu proti předchozímu snímku
function motion(gray, prev) {
  if (!prev) return Infinity;
  let diff = 0;
  for (let i = 0; i < gray.length; i++) diff += Math.abs(gray[i] - prev[i]);
  return diff / gray.length;
}

export default function AutoCamera({ field, onPhoto, onClose, onFallback, onGallery }) {
  const videoRef = useRef(null);
  const armedRef = useRef(true); // smí se teď fotit automaticky?
  const captureRef = useRef(null);
  const [error, setError] = useState('');
  const [steadyNow, setSteadyNow] = useState(false); // je obraz právě ostrý a v klidu?
  const [gotIt, setGotIt] = useState(false); // ukazujeme "Mám to"

  // Vyfotí plné rozlišení z videa a pošle ho ven jako soubor
  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    armedRef.current = false; // další automatická fotka až po pohybu jinam

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onPhoto(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        navigator.vibrate?.(80); // iPhone vibraci z webu neumí – tam se nic nestane
        setGotIt(true);
        setTimeout(() => setGotIt(false), 1500);
      },
      'image/jpeg',
      0.9
    );
  }
  captureRef.current = capture; // ať interval níž volá vždy aktuální verzi

  useEffect(() => {
    let stream;
    let timer;
    let stopped = false;
    let prev = null;
    let steady = 0;

    const small = document.createElement('canvas');
    small.width = W;
    small.height = H;
    const ctx = small.getContext('2d', { willReadFrequently: true });

    function check() {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return; // video ještě neběží

      ctx.drawImage(video, 0, 0, W, H);
      const gray = toGray(ctx);
      const move = motion(gray, prev);
      prev = gray;

      // Po vyfocení čekáme, až pacient namíří jinam
      if (!armedRef.current) {
        if (move > REARM_MOTION) armedRef.current = true;
        return;
      }

      const ok = move < MOTION_MAX && sharpness(gray) > SHARP_MIN;
      steady = ok ? steady + 1 : 0;
      setSteadyNow(ok);

      if (steady >= STEADY_CHECKS) {
        steady = 0;
        captureRef.current();
      }
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch {
        // Zakázaná kamera, starý prohlížeč nebo stránka bez HTTPS
        setError(t('autocam.noCamera'));
        return;
      }
      // Pacient mezitím odešel → kameru hned vypneme
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
      timer = setInterval(check, CHECK_MS);
    }

    start();

    // Úklid při zavření: zastavit kontrolu a VYPNOUT KAMERU (jinak svítí kontrolka dál)
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="autocam">
      {error ? (
        <>
          <div className="box box-warning">
            <p>{error}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={onFallback}>
            {t('autocam.systemCamera')}
          </button>
        </>
      ) : (
        <>
          {/* playsInline = na iPhonu se video nepřepne do celé obrazovky */}
          <video ref={videoRef} className="autocam-video" playsInline muted autoPlay />
          <p className={gotIt ? 'autocam-hint autocam-hint-ok' : 'autocam-hint'} role="status">
            {gotIt ? t('autocam.gotIt') : steadyNow ? t('autocam.hold') : t(`autocam.aim.${field}`)}
          </p>
          <button type="button" className="btn btn-primary" onClick={capture}>
            {t('autocam.shoot')}
          </button>
        </>
      )}
      {/* Fotky už má v telefonu → vybere je z galerie (i víc najednou) */}
      <button type="button" className="btn btn-link" onClick={onGallery}>
        {t('scan.fromGallery')}
      </button>
      <button type="button" className="btn btn-secondary" onClick={onClose}>
        {t('common.done')}
      </button>
    </div>
  );
}
