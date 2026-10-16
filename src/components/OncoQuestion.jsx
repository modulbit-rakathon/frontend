// Otázka "Léčíte se na onkologii?" se třemi velkými tlačítky.
// Odpověď uložíme do profilu. Při "Ano" pošleme pacienta zadat léčbu.
import { useMeds } from '../context/MedsContext.jsx';
import { ONCO_ANSWERS } from '../types.js';
import { t } from '../i18n/index.js';
import { useAppNavigate } from '../navigation.js';

export default function OncoQuestion() {
  const navigate = useAppNavigate();
  const { profile, updateProfile } = useMeds();

  function answer(key) {
    updateProfile({ onco: key });
    if (key === 'ano') navigate('/onkologie');
  }

  return (
    // role="group" + aria-labelledby = čtečka přečte otázku spolu s tlačítky
    <section className="card question" role="group" aria-labelledby="onco-question">
      <h2 id="onco-question">{t('onco.question')}</h2>
      <div className="question-answers">
        {ONCO_ANSWERS.map((a) => (
          <button
            key={a.key}
            type="button"
            className={profile.onco === a.key ? 'toggle toggle-on' : 'toggle'}
            aria-pressed={profile.onco === a.key}
            onClick={() => answer(a.key)}
          >
            <span className="toggle-check" aria-hidden="true">
              {profile.onco === a.key ? '✓' : ''}
            </span>
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
