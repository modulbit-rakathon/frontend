// Fotka s barevnými rámečky tam, odkud AI přečetla jednotlivé údaje.
//
//   ┌──────────────────────────┐
//   │  ┏━━━━━━━━━━┓ Název       │
//   │  ┃IBUPROFEN ┃            │
//   │  ┗━━━━━━━━━━┛            │
//   └──────────────────────────┘
//
// Souřadnice rámečků jsou poměrné (0–1), takže sedí při jakékoli velikosti fotky.
// Když backend souřadnice nepošle (zatím je posílá jen mock), ukáže se jen fotka.
import { FORM_FIELD_LABELS } from '../types.js';

/**
 * @param {string} src – adresa fotky
 * @param {Object<string, import('../types.js').FieldBox>} boxes – rámečky podle pole formuláře
 * @param {string|null} activeField – pole, které pacient právě upravuje (zvýrazní se)
 * @param {string[]} uncertainFields – nejistá pole (rámeček bude žlutý)
 */
export default function PhotoHighlights({ src, boxes = {}, activeField = null, uncertainFields = [] }) {
  return (
    <div className="photo-frame-wrap">
      <div className="photo-frame">
        <img src={src} alt="Vaše fotka" className="photo-frame-img" />
        {Object.entries(boxes).map(([field, box]) => {
          const classes = ['photo-box'];
          if (uncertainFields.includes(field)) classes.push('photo-box-uncertain');
          if (field === activeField) classes.push('photo-box-active');
          return (
            // aria-hidden: rámečky jsou jen vizuální pomůcka, údaje jsou i ve formuláři
            <span
              key={field}
              className={classes.join(' ')}
              aria-hidden="true"
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
              }}
            >
              <span className="photo-box-label">{FORM_FIELD_LABELS[field] ?? field}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Z field_boxes od backendu (klíče name, strength, frequency, amount)
 * udělá rámečky pro pole formuláře (name, strength, dosage).
 */
export function boxesForForm(fieldBoxes, mapping) {
  const result = {};
  for (const [backendField, box] of Object.entries(fieldBoxes ?? {})) {
    const formField = mapping[backendField];
    // Dávkování může mít víc rámečků (frequency i amount) – necháme ten první.
    if (formField && !result[formField]) result[formField] = box;
  }
  return result;
}
