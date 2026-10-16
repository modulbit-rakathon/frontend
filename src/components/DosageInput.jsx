// Zadání dávkování bez psaní – pro starší lidi.
//
//   [ Ráno   ]  −  1  +
//   [ Poledne]
//   [ Večer  ]  −  1  +
//   [ Na noc ]
//   Zápis: 1-0-1-0
//
//   [ Podle potřeby ]  [ Jinak (napsat) ]
//
// Komponenta je "řízená" (controlled): hodnotu dostává zvenku (value)
// a každou změnu hlásí funkcí onChange(novéDávkování).
import { DOSE_TIMES, DOSAGE_MODES, dosageCode, dosageFromText, emptyDosage } from '../types.js';
import VoiceButton from './VoiceButton.jsx';
import { t } from '../i18n/index.js';

const MAX_COUNT = 9;

/**
 * @param {import('../types.js').Dosage} value
 * @param {(d: import('../types.js').Dosage) => void} onChange
 */
export default function DosageInput({ value, onChange }) {
  const isSchedule = value.mode === DOSAGE_MODES.SCHEDULE;

  // Změní počet kusů pro jednu denní dobu (ráno, poledne…).
  function setCount(key, count) {
    const safe = Math.max(0, Math.min(MAX_COUNT, count));
    // Klepnutí na denní dobu přepne zpátky na rozpis (kdyby bylo vybrané "podle potřeby").
    onChange({ ...value, mode: DOSAGE_MODES.SCHEDULE, [key]: safe });
  }

  // Klepnutí na velké tlačítko denní doby: zapne (1 kus) nebo vypne (0).
  function toggleTime(key) {
    const isOn = isSchedule && value[key] > 0;
    setCount(key, isOn ? 0 : 1);
  }

  // "Podle potřeby" a "Jinak" – druhé klepnutí volbu zase zruší.
  function toggleMode(mode) {
    if (value.mode === mode) {
      onChange(emptyDosage());
    } else {
      onChange({ ...emptyDosage(), mode, text: value.text });
    }
  }

  return (
    <div className="dosage">
      <ul className="dosage-times">
        {DOSE_TIMES.map((time) => {
          const count = isSchedule ? value[time.key] : 0;
          const isOn = count > 0;
          return (
            <li key={time.key} className="dosage-row">
              {/* aria-pressed = čtečka obrazovky řekne "zapnuto / vypnuto" */}
              <button
                type="button"
                className={isOn ? 'toggle toggle-on' : 'toggle'}
                aria-pressed={isOn}
                onClick={() => toggleTime(time.key)}
              >
                <span className="toggle-check" aria-hidden="true">
                  {isOn ? '✓' : ''}
                </span>
                {time.label}
              </button>

              {isOn && (
                <div className="stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    aria-label={t('dosage.less', { time: time.label })}
                    onClick={() => setCount(time.key, count - 1)}
                  >
                    −
                  </button>
                  {/* aria-live = čtečka přečte nové číslo po změně */}
                  <span className="stepper-value" aria-live="polite">
                    {count}
                    <span className="sr-only"> {t('dosage.pieces')}</span>
                  </span>
                  <button
                    type="button"
                    className="stepper-btn"
                    aria-label={t('dosage.more', { time: time.label })}
                    onClick={() => setCount(time.key, count + 1)}
                    disabled={count >= MAX_COUNT}
                  >
                    +
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isSchedule && DOSE_TIMES.some((time) => value[time.key] > 0) && (
        <p className="dosage-code">
          {t('dosage.code')} <strong>{dosageCode(value)}</strong>
        </p>
      )}

      <div className="dosage-modes">
        <button
          type="button"
          className={value.mode === DOSAGE_MODES.AS_NEEDED ? 'toggle toggle-on' : 'toggle'}
          aria-pressed={value.mode === DOSAGE_MODES.AS_NEEDED}
          onClick={() => toggleMode(DOSAGE_MODES.AS_NEEDED)}
        >
          <span className="toggle-check" aria-hidden="true">
            {value.mode === DOSAGE_MODES.AS_NEEDED ? '✓' : ''}
          </span>
          {t('dosage.asNeededButton')}
        </button>
        <button
          type="button"
          className={value.mode === DOSAGE_MODES.OTHER ? 'toggle toggle-on' : 'toggle'}
          aria-pressed={value.mode === DOSAGE_MODES.OTHER}
          onClick={() => toggleMode(DOSAGE_MODES.OTHER)}
        >
          <span className="toggle-check" aria-hidden="true">
            {value.mode === DOSAGE_MODES.OTHER ? '✓' : ''}
          </span>
          {t('dosage.other')}
        </button>
      </div>

      {/* Hlasem: "jedna ráno, jedna večer" se nepřevede, uloží se jako text (Jinak).
          Zápis "1-0-1" nebo "podle potřeby" se rozpozná. */}
      <VoiceButton label={t('dosage.voice')} onResult={(text) => onChange(dosageFromText(text, ''))} />

      {value.mode === DOSAGE_MODES.OTHER && (
        <input
          type="text"
          className="text-input"
          aria-label={t('dosage.ownWords')}
          placeholder={t('dosage.otherPlaceholder')}
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
        />
      )}
    </div>
  );
}
