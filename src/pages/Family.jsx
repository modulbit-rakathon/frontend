// Obrazovka: Pomoc od blízkého (/blizky)
//
// Dvě podoby podle toho, kdo ji otevře:
//   - pacient: vytvoří odkaz "Požádat blízkého o pomoc" (volitelně i se svým seznamem),
//   - blízký v režimu pro blízké: hotový seznam pošle odkazem zpět.
// Léky jsou v odkazu za # (viz familyShare.js) – na server se nedostanou.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import ShareLink from '../components/ShareLink.jsx';
import { WarningIcon } from '../components/Icons.jsx';
import { medName } from '../labels.js';
import {
  MAX_LINK_LENGTH,
  encodeShare,
  makeRequest,
  makeResponse,
  makeShareId,
  rememberLink,
  shareUrl,
} from '../familyShare.js';

// Upozornění, které ukážeme před vytvořením každého odkazu.
function PrivacyNote() {
  return (
    <div className="box box-info">
      <div className="box-title">
        <WarningIcon />
        <span>Odkaz obsahuje seznam léků</span>
      </div>
      <p>Pošlete ho jen člověku, kterému důvěřujete. Kdo odkaz má, seznam uvidí.</p>
    </div>
  );
}

export default function Family() {
  const { helper } = useMeds();
  // key = po ukončení režimu pro blízké začne obrazovka od začátku
  return helper ? <SendBack key="send" /> : <AskForHelp key="ask" />;
}

// ---------- Pacient žádá o pomoc ----------
function AskForHelp() {
  const { meds, profile } = useMeds();
  const [name, setName] = useState('');
  const [includeList, setIncludeList] = useState(true);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  async function create(event) {
    event.preventDefault();
    setError('');
    const id = makeShareId();
    const data = makeRequest({
      id,
      name: name.trim(),
      items: includeList ? meds : [],
      onco: includeList ? profile.onco : '',
    });
    try {
      const link = shareUrl(window.location.origin, await encodeShare(data));
      if (link.length > MAX_LINK_LENGTH) {
        setError('Seznam je na odkaz moc dlouhý. Zkuste ho poslat bez současných léků.');
        return;
      }
      // Zapamatujeme si, že odkaz je náš – kdyby se otevřel na tomto telefonu.
      rememberLink('sent', id);
      setUrl(link);
    } catch {
      setError('Odkaz se nepodařilo vytvořit. Zkuste to prosím znovu.');
    }
  }

  if (url) {
    return (
      <>
        <h1>Odkaz je hotový</h1>
        <p className="subtitle">Pošlete ho blízkému. Až léky vyplní, pošle vám odkaz zpět. Ten pak jen otevřete.</p>
        <ShareLink url={url} title="PillGaze – pomoc s léky" text="Prosím, pomůžeš mi vyplnit seznam léků?" />
        <Link to="/" className="btn btn-link">
          Hotovo
        </Link>
      </>
    );
  }

  return (
    <>
      <h1>Pomoc od blízkého</h1>
      <p className="subtitle">Někdo blízký může léky vyplnit za vás na svém telefonu.</p>

      <ol className="family-steps">
        <li>Pošlete mu odkaz.</li>
        <li>On léky vyfotí nebo zapíše.</li>
        <li>Pošle vám odkaz zpět. Vy zkontrolujete, co přidal, a uložíte.</li>
      </ol>

      <form className="family-form" onSubmit={create}>
        <div className="field">
          <label htmlFor="family-name">Za koho se léky vyplňují? (nepovinné)</label>
          <input
            id="family-name"
            type="text"
            maxLength={60}
            placeholder="např. maminka Jana"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {meds.length > 0 && (
          <div className="field">
            <label className={includeList ? 'choice choice-on' : 'choice'}>
              <input type="checkbox" checked={includeList} onChange={(e) => setIncludeList(e.target.checked)} />
              Poslat i léky, které už mám ({meds.length})
            </label>
          </div>
        )}

        <PrivacyNote />

        {error && (
          <p className="box box-warning" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary">
          Vytvořit odkaz
        </button>
      </form>
    </>
  );
}

// ---------- Blízký posílá vyplněné léky zpět ----------
function SendBack() {
  const navigate = useNavigate();
  const { helper, meds, profile, endHelping } = useMeds();
  const who = helper.name || 'blízkého člověka';
  const [from, setFrom] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  async function create(event) {
    event.preventDefault();
    setError('');
    const data = makeResponse({
      id: helper.requestId,
      rid: makeShareId(),
      name: helper.name,
      from: from.trim(),
      items: meds,
      onco: profile.onco,
      base: helper.base ?? [],
    });
    try {
      const link = shareUrl(window.location.origin, await encodeShare(data));
      if (link.length > MAX_LINK_LENGTH) {
        setError('Seznam je na odkaz moc dlouhý. Pošlete ho prosím po částech.');
        return;
      }
      setUrl(link);
    } catch {
      setError('Odkaz se nepodařilo vytvořit. Zkuste to prosím znovu.');
    }
  }

  function finish() {
    const ok = url
      ? window.confirm(`Ukončit vyplňování za ${who}? Seznam se z tohoto telefonu smaže. Odkaz, který jste poslali, platí dál.`)
      : window.confirm(`Seznam jste ještě neposlali. Opravdu ho smazat a ukončit vyplňování za ${who}?`);
    if (!ok) return;
    endHelping();
    navigate('/');
  }

  return (
    <>
      <h1>Poslat léky zpět</h1>
      <p className="subtitle">
        Vyplňujete za: <strong>{who}</strong>
      </p>

      {meds.length === 0 ? (
        <p className="box box-info">Seznam je zatím prázdný.</p>
      ) : (
        <ul className="family-list">
          {meds.map((m) => (
            <li key={m.id}>{medName(m)}</li>
          ))}
        </ul>
      )}

      {!url && (
        <form className="family-form" onSubmit={create}>
          <div className="field">
            <label htmlFor="family-from">Vaše jméno (nepovinné)</label>
            <input
              id="family-from"
              type="text"
              maxLength={60}
              placeholder="např. Jana, dcera"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <PrivacyNote />
          {error && (
            <p className="box box-warning" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary">
            Vytvořit odkaz zpět
          </button>
          <Link to="/leky" className="btn btn-secondary">
            Ještě něco doplnit
          </Link>
        </form>
      )}

      {url && (
        <>
          <p className="share-step">Pošlete tento odkaz zpět.</p>
          <ShareLink url={url} title="PillGaze – vyplněné léky" text="Léky jsem vyplnil(a). Otevři odkaz a zkontroluj je." />
          {/* Po změně seznamu se odkaz vytvoří znovu (obrazovka začne od začátku) */}
          <Link to="/leky" className="btn btn-secondary">
            Ještě něco změnit
          </Link>
        </>
      )}

      <button type="button" className="btn btn-text family-end" onClick={finish}>
        Ukončit vyplňování za: {who}
      </button>
    </>
  );
}
