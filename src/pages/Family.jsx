// Obrazovka: Pomoc od blízkého (/blizky)
//
// Dvě podoby podle toho, kdo ji otevře:
//   - pacient: vytvoří odkaz "Požádat blízkého o pomoc" (volitelně i se svým seznamem),
//   - blízký v režimu pro blízké: hotový seznam pošle zpět jednorázovým kódem (HandoffCode),
//     pacient ho opíše ve své appce.
// V žádosti jsou léky v odkazu za # (viz familyShare.js) – na server se nedostanou.
// Zpáteční seznam drží backend jen po dobu platnosti kódu, bez jmen.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import ShareLink from '../components/ShareLink.jsx';
import HandoffCode from '../components/HandoffCode.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { WarningIcon } from '../components/Icons.jsx';
import { medName } from '../labels.js';
import { itemName } from '../types.js';
import { t, tRich } from '../i18n/index.js';
import {
  MAX_LINK_LENGTH,
  encodeShare,
  makeRequest,
  makeResponse,
  makeShareId,
  rememberLink,
  shareUrl,
} from '../familyShare.js';
import BackButton from '../components/BackButton.jsx';

// Upozornění, které ukážeme před vytvořením každého odkazu / kódu.
function PrivacyNote({ code = false }) {
  return (
    <div className="box box-info">
      <div className="box-title">
        <WarningIcon />
        <span>{t(code ? 'family.privacyCodeTitle' : 'family.privacyTitle')}</span>
      </div>
      <p>{t(code ? 'family.privacyCodeText' : 'family.privacyText')}</p>
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
        setError(t('family.ask.tooLong'));
        return;
      }
      // Zapamatujeme si, že odkaz je náš – kdyby se otevřel na tomto telefonu.
      rememberLink('sent', id);
      setUrl(link);
    } catch {
      setError(t('family.createFailed'));
    }
  }

  if (url) {
    return (
      <>
        <h1>{t('family.ask.readyTitle')}</h1>
        <p className="subtitle">{t('family.ask.readyText')}</p>
        <ShareLink url={url} title={t('family.ask.shareTitle')} text={t('family.ask.shareText')} />
        <Link to="/" className="btn btn-link">
          {t('common.done')}
        </Link>
      </>
    );
  }

  return (
    <>
      <BackButton to="/" />
      <h1>{t('family.ask.title')}</h1>
      <p className="subtitle">{t('family.ask.subtitle')}</p>

      <ol className="family-steps">
        <li>{t('family.ask.step1')}</li>
        <li>{t('family.ask.step2')}</li>
        <li>{t('family.ask.step3')}</li>
      </ol>

      <form className="family-form" onSubmit={create}>
        <div className="field">
          <label htmlFor="family-name">{t('family.ask.nameLabel')}</label>
          <input
            id="family-name"
            type="text"
            maxLength={60}
            placeholder={t('family.ask.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {meds.length > 0 && (
          <div className="field">
            <label className={includeList ? 'choice choice-on' : 'choice'}>
              <input type="checkbox" checked={includeList} onChange={(e) => setIncludeList(e.target.checked)} />
              {t('family.ask.includeList', { count: meds.length })}
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
          {t('family.ask.create')}
        </button>
      </form>
    </>
  );
}

// ---------- Blízký posílá vyplněné léky zpět ----------
function SendBack() {
  const navigate = useNavigate();
  const { helper, meds, profile, endHelping } = useMeds();
  const who = helper.name || t('family.defaultName');
  const [encoded, setEncoded] = useState('');
  const [error, setError] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);

  async function create(event) {
    event.preventDefault();
    setError('');
    // Bez jmen (pacienta ani blízkého): seznam čeká na kód na serveru.
    const data = makeResponse({
      id: helper.requestId,
      rid: makeShareId(),
      items: meds,
      onco: profile.onco,
      base: helper.base ?? [],
    });
    try {
      const text = await encodeShare(data);
      if (text.length > MAX_LINK_LENGTH) {
        setError(t('family.send.tooLong'));
        return;
      }
      setEncoded(text);
    } catch {
      setError(t('family.createFailed'));
    }
  }

  function finish() {
    endHelping();
    navigate('/');
  }

  // Odeslaný a neodeslaný seznam mají jiné varování
  const endKey = encoded ? 'family.send.confirmEndSent' : 'family.send.confirmEndUnsent';

  return (
    <>
      <BackButton to="/leky" />
      <h1>{t('family.send.title')}</h1>
      <p className="subtitle">{tRich('family.helpingFor', { name: <strong>{who}</strong> })}</p>

      {meds.length === 0 ? (
        <p className="box box-info">{t('family.send.empty')}</p>
      ) : (
        <ul className="family-list">
          {meds.map((m) => (
            <li key={m.id}>{medName({ ...m, name: itemName(m) })}</li>
          ))}
        </ul>
      )}

      {!encoded && (
        <form className="family-form" onSubmit={create}>
          <PrivacyNote code />
          {error && (
            <p className="box box-warning" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary">
            {t('family.send.create')}
          </button>
          <Link to="/leky" className="btn btn-secondary">
            {t('family.send.addMore')}
          </Link>
        </form>
      )}

      {encoded && (
        <>
          <HandoffCode encoded={encoded} intro={t('family.send.codeIntro', { name: who })} />
          {/* Po změně seznamu se kód vytvoří znovu (obrazovka začne od začátku) */}
          <Link to="/leky" className="btn btn-secondary">
            {t('family.send.change')}
          </Link>
        </>
      )}

      <button type="button" className="btn btn-text family-end" onClick={() => setConfirmEnd(true)}>
        {t('family.send.end', { name: who })}
      </button>

      <ConfirmDialog
        open={confirmEnd}
        title={t(`${endKey}Title`, { name: who })}
        text={t(`${endKey}Text`, { name: who })}
        confirmLabel={t('family.res.endHelping')}
        cancelLabel={t('family.keepFilling')}
        danger
        onConfirm={finish}
        onCancel={() => setConfirmEnd(false)}
      />
    </>
  );
}
