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

export default function Home() {
  const { meds: items, profile } = useMeds();
  const meds = itemsOfType(items, ITEM_TYPES.LEK);

  return (
    <>
      <h1>Dobrý den</h1>
      <p className="subtitle">Co chcete udělat?</p>

      {/* Hlavní akce obrazovky – velké tlačítko */}
      <Link to="/vyfotit" className="hero-button">
        <CameraIcon size={72} />
        <span className="hero-title">Vyfotit lék</span>
        <span className="hero-sub">krabičku nebo lístek od lékaře</span>
      </Link>

      <Link to="/leky" className="card card-link">
        <span className="card-link-icon">
          <PillIcon size={40} />
        </span>
        <span className="card-link-text">
          <strong>Moje léky</strong>
          <span>{meds.length === 0 ? 'Zatím žádné' : pluralLeky(meds.length)}</span>
        </span>
        <ChevronIcon />
      </Link>

      {/* Při prvním spuštění (dokud pacient neodpoví) se zeptáme na onkologii */}
      {profile.onco === '' && <OncoQuestion />}

      <Link to="/zprava" className="btn btn-secondary">
        Zpráva pro lékaře
      </Link>

      <FontSizeSwitch />
    </>
  );
}
