// Příprava fotek před odesláním na backend.
//
// Fotka z mobilu má klidně 4–8 MB, ale backend přijme max 15 MB za všechny
// fotky dohromady (a jen JPEG nebo PNG). Proto každou fotku zmenšíme
// a uložíme jako JPEG. Text na krabičce i na lístku zůstane dobře čitelný.

import { formatNumber, t } from './i18n/index.js';

// Delší strana zmenšené fotky v pixelech
const MAX_SIDE = 2000;
// Kvalita JPEGu (0 až 1). 0.85 = skoro bez viditelného rozdílu, ale mnohem menší soubor.
const QUALITY = 0.85;

/**
 * Zmenší fotku a převede ji na JPEG.
 * @param {File} file – fotka z fotoaparátu nebo galerie
 * @returns {Promise<File>} zmenšená fotka (nebo původní, když je menší)
 * Když prohlížeč fotku neumí otevřít (třeba formát HEIC v Chrome), vrátí chybu.
 */
export async function shrinkPhoto(file) {
  // imageOrientation 'from-image' = otočí fotku podle údaje z fotoaparátu (jinak by byla bokem)
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  // Poměr zmenšení: menší fotky nezvětšujeme (max 1)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close(); // uvolní paměť

  // toBlob funguje přes "callback", tak ho zabalíme do Promise
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('shrink_failed');

  // Když byl původní JPEG/PNG už menší, necháme původní.
  const isOk = file.type === 'image/jpeg' || file.type === 'image/png';
  if (isOk && file.size <= blob.size) return file;

  // Název necháme (jen koncovku změníme na .jpg) – mock podle názvu pozná "chyba.jpg".
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

/** Velikost v MB s jedním desetinným místem, např. "3,4 MB" (čárka/tečka podle jazyka). */
export function sizeText(bytes) {
  const n = formatNumber(bytes / 1024 / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return t('unit.mb', { n });
}
