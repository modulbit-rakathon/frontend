// Obrazovka 1: Domů
// Pozor: pacientská část NIKDE neukazuje interakce ani varování o lécích –
// zadavatel je chce jen pro lékaře (/doc).
import { Link } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { CameraIcon, PillIcon, ChevronIcon } from '../components/Icons.jsx';
import { pluralLeky } from '../labels.js';
import { ITEM_TYPES, itemsOfType } from '../types.js';
import OncoQuestion from '../components/OncoQuestion.jsx';
import FontSizeSwitch from '../components/FontSizeSwitch.jsx';
import LanguageSwitch from '../components/LanguageSwitch.jsx';
import { t } from '../i18n/index.js';

export default function Home() {
  const { meds: items, profile, helper } = useMeds();
  const meds = itemsOfType(items, ITEM_TYPES.LEK);

  return (
    <>
      <h1>{t('home.greeting')}</h1>
      <p className="subtitle">{t('home.question')}</p>

      {/* Hlavní akce obrazovky – velké tlačítko */}
      <Link to="/vyfotit" className="hero-button">
        <CameraIcon size={72} />
        <span className="hero-title">{t('common.photoMed')}</span>
        <span className="hero-sub">{t('home.heroSub')}</span>
      </Link>

      <Link to="/leky" className="card card-link">
        <span className="card-link-icon">
          <PillIcon size={40} />
        </span>
        <span className="card-link-text">
          <strong>{t('home.myMeds')}</strong>
          <span>{meds.length === 0 ? t('home.noneYet') : pluralLeky(meds.length)}</span>
        </span>
        <ChevronIcon />
      </Link>

      {/* Při prvním spuštění (dokud pacient neodpoví) se zeptáme na onkologii */}
      {profile.onco === '' && <OncoQuestion />}

      <Link to="/zprava" className="btn btn-secondary">
        {t('home.report')}
      </Link>

      {/* Režim pro blízké – v něm už o pomoc nežádáme */}
      {!helper && (
        <Link to="/blizky" className="btn btn-link">
          Požádat blízkého o pomoc
        </Link>
      )}

      <FontSizeSwitch />
      <LanguageSwitch />
    </>
  );
}
