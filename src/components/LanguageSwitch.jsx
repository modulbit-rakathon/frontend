// Přepínač jazyka: Čeština / English / Українська.
// Názvy jazyků jsou vždy v daném jazyce, aby je každý poznal i bez znalosti češtiny.
// Volba se uloží do localStorage (viz src/i18n/index.js).
//
// variant="doc" = malá verze pro lékařský pohled (/doc).
import { LANGUAGES, setLang, t, useLang } from '../i18n/index.js';

export default function LanguageSwitch({ variant }) {
  const lang = useLang();

  if (variant === 'doc') {
    return (
      <div className="doc-lang" role="group" aria-label={t('lang.label')}>
        {LANGUAGES.map((l) => (
          <button
            key={l.key}
            type="button"
            lang={l.key}
            className={lang === l.key ? 'doc-lang-btn doc-lang-btn-on' : 'doc-lang-btn'}
            aria-pressed={lang === l.key}
            onClick={() => setLang(l.key)}
          >
            {l.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="font-switch lang-switch" role="group" aria-labelledby="lang-switch-label">
      <span id="lang-switch-label" className="font-switch-label">
        {t('lang.label')}
      </span>
      <div className="lang-switch-buttons">
        {LANGUAGES.map((l) => (
          <button
            key={l.key}
            type="button"
            lang={l.key}
            className={lang === l.key ? 'font-btn lang-btn font-btn-on' : 'font-btn lang-btn'}
            aria-pressed={lang === l.key}
            onClick={() => setLang(l.key)}
          >
            {/* Fajfka + podtržení, ať výběr není poznat jen podle barvy */}
            <span className="toggle-check" aria-hidden="true">
              {lang === l.key ? '✓' : ''}
            </span>
            {/* Vlastní <span>, aby šel podtrhnout jen název, ne fajfka */}
            <span className="lang-btn-name">{l.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
