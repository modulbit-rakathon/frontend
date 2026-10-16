// Obrazovka 1: Domů
import { Link } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import FontSizeSwitch from '../components/FontSizeSwitch.jsx';
import { CameraIcon, PillIcon, ChevronIcon } from '../components/Icons.jsx';
import { pluralLeky } from '../labels.js';

export default function Home() {
  const { meds } = useMeds();

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

      <Link to="/zprava" className="btn btn-secondary">
        Zpráva pro lékaře
      </Link>

      <FontSizeSwitch />
    </>
  );
}
