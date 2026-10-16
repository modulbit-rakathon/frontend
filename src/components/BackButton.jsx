// Šipka "Zpět" v levém horním rohu obrazovky.
// Vede vždy na pevně danou "nadřazenou" obrazovku (to), nebo zavolá onClick
// u kroků uvnitř jedné obrazovky. Je to předvídatelnější než "historie zpět".
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from './Icons.jsx';
import { t } from '../i18n/index.js';
import { setNavDirection } from '../navTransition.js';

/**
 * @param {string} [to] – kam se vrátit, např. '/leky'
 * @param {() => void} [onClick] – místo "to": krok zpět uvnitř obrazovky
 * @param {string} [label] – vlastní text místo "Zpět"
 */
export default function BackButton({ to, onClick, label }) {
  const navigate = useNavigate();
  function goBack() {
    setNavDirection('back'); // animace jako při návratu
    navigate(to);
  }
  return (
    <button type="button" className="back-btn no-print" onClick={onClick ?? goBack}>
      <ArrowLeftIcon />
      <span>{label ?? t('common.back')}</span>
    </button>
  );
}
