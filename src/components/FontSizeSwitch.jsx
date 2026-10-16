// Přepínač velikosti písma: Normální / Velké / Extra velké.
// Volba se uloží do localStorage, takže platí i po dalším otevření.
import { useState } from 'react';
import { FONT_SIZES, applyFontSize, loadFontSize } from '../accessibility.js';

export default function FontSizeSwitch() {
  const [size, setSize] = useState(loadFontSize);

  function choose(key) {
    setSize(key);
    applyFontSize(key);
  }

  return (
    <div className="font-switch" role="group" aria-labelledby="font-switch-label">
      <span id="font-switch-label" className="font-switch-label">
        Velikost písma
      </span>
      <div className="font-switch-buttons">
        {FONT_SIZES.map((f, i) => (
          <button
            key={f.key}
            type="button"
            className={size === f.key ? 'font-btn font-btn-on' : 'font-btn'}
            aria-pressed={size === f.key}
            onClick={() => choose(f.key)}
          >
            {/* Písmeno "A" v rostoucí velikosti jako náhled + slovní popis */}
            <span className={`font-btn-sample font-btn-sample-${i}`} aria-hidden="true">
              A
            </span>
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
