// Příprava fotek před odesláním na backend.
//
// Fotka z mobilu má klidně 4–8 MB, ale backend přijme max 15 MB za všechny
// fotky dohromady (a jen JPEG nebo PNG). Proto každou fotku zmenšíme
// a uložíme jako JPEG. Text na krabičce i na lístku zůstane dobře čitelný.
//
// Zároveň orientačně zkontrolujeme, jestli fotka není moc tmavá nebo rozmazaná
// (photoQuality.js). Pacient pak může fotku vyfotit znovu ještě před odesláním.

import { formatNumber, t } from './i18n/index.js';
import { ANALYSIS_SIDE, analyzeGray, judge, toGray } from './photoQuality.js';

// Delší strana zmenšené fotky v pixelech
const MAX_SIDE = 2000;
// Kvalita JPEGu (0 až 1). 0.85 = skoro bez viditelného rozdílu, ale mnohem menší soubor.
const QUALITY = 0.85;

/**
 * Zmenší fotku, převede ji na JPEG a orientačně zkontroluje, jestli není tmavá nebo rozmazaná.
 * @param {File} file – fotka z fotoaparátu nebo galerie
 * @returns {Promise<{ file: File, quality: { dark: boolean, blurry: boolean } | null }>}
 *   file = zmenšená fotka (nebo původní, když je menší);
 *   quality = null, když kontrola nešla udělat (fotka se pak normálně pošle bez upozornění).
 * Když prohlížeč fotku neumí otevřít (třeba formát HEIC v Chrome), vrátí chybu.
 */
export async function preparePhoto(file) {
  // imageOrientation 'from-image' = otočí fotku podle údaje z fotoaparátu (jinak by byla bokem)
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  // Poměr zmenšení: menší fotky nezvětšujeme (max 1)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const quality = checkQuality(bitmap);
  bitmap.close(); // uvolní paměť

  // toBlob funguje přes "callback", tak ho zabalíme do Promise
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  canvas.width = canvas.height = 0; // Safari jinak drží paměť canvasu
  if (!blob) throw new Error('shrink_failed');

  // Když byl původní JPEG/PNG už menší, necháme původní.
  const isOk = file.type === 'image/jpeg' || file.type === 'image/png';
  if (isOk && file.size <= blob.size) return { file, quality };

  // Název necháme (jen koncovku změníme na .jpg) – mock podle názvu pozná "chyba.jpg".
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return { file: new File([blob], name, { type: 'image/jpeg' }), quality };
}

// Kontrola jasu a ostrosti nad malou kopií fotky (viz photoQuality.js).
// Když cokoli selže, vrátí null – varování se neukáže, ale fotka jde poslat dál.
function checkQuality(bitmap) {
  const canvas = document.createElement('canvas');
  try {
    const start = performance.now();
    const scale = Math.min(1, ANALYSIS_SIDE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    // willReadFrequently = data drží v paměti procesoru, getImageData je pak rychlejší
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const gray = toGray(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    const measured = analyzeGray(gray, canvas.width, canvas.height);
    const quality = judge(measured);
    if (import.meta.env.DEV) {
      // Pro ladění prahů a měření rychlosti na mobilu
      console.debug('[kvalita fotky]', { ...measured, ...quality, ms: Math.round(performance.now() - start) });
    }
    return quality;
  } catch {
    return null;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

/** Velikost v MB s jedním desetinným místem, např. "3,4 MB" (čárka/tečka podle jazyka). */
export function sizeText(bytes) {
  const n = formatNumber(bytes / 1024 / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return t('unit.mb', { n });
}
