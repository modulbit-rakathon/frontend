// Obrazovka: Otevřený odkaz z režimu pro blízké (/pomoc#d=…)
//
// Odkaz může být:
//   - žádost (t: 'req') – blízký začne vyplňovat léky za pacienta,
//   - odpověď (t: 'res') – pacient zkontroluje, co blízký přidal / změnil, a sám potvrdí uložení.
// Nic se nepřepisuje potichu: nové a změněné položky jsou předvybrané, odebrání ne.
//
// Stavy (`step`): 'loading' → 'error' | 'ready' → 'done'
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { CheckIcon, WarningIcon } from '../components/Icons.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { medName } from '../labels.js';
import { decodeShare, diffShare, hasLink, isOld, readHash, rememberLink } from '../familyShare.js';
import { dateText, dosageText, itemName, oncoFormText, prescriberText, sinceText } from '../types.js';
import { joinList, localeOf, t, tRich } from '../i18n/index.js';
import { setNavDirection } from '../navTransition.js';
import BackButton from '../components/BackButton.jsx';

// Chyby z decodeShare, pro které máme vlastní text
const ERROR_CODES = ['empty', 'invalid', 'newer', 'unsupported'];

// Název položky v jazyce appky (doplňky z dlaždic se přeloží)
const displayName = (item) => medName({ ...item, name: itemName(item) });

// Krátký popis položky pro kontrolu: "5 mg · ráno 1 · od března 2024"
function itemDetails(item) {
  return [
    item.strength,
    dosageText(item.dosage),
    item.since && t('family.res.since', { date: sinceText(item.since) }),
    prescriberText(item.prescriber),
    oncoFormText(item.oncoForm),
    item.lastDose && t('common.lastDose', { date: dateText(item.lastDose) }),
  ]
    .filter(Boolean)
    .join(' · ');
}

const oncoLabel = (key) => (key ? t(`onco.answer.${key}`) : t('common.unanswered'));

export default function FamilyOpen() {
  // Odkaz čteme jen jednou při otevření (po uložení ho z adresy smažeme).
  const [encoded] = useState(() => readHash(window.location.hash));
  const [step, setStep] = useState('loading');
  const [share, setShare] = useState(null);
  const [errorCode, setErrorCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    decodeShare(encoded)
      .then((data) => {
        if (cancelled) return;
        setShare(data);
        setStep('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorCode(ERROR_CODES.includes(error.message) ? error.message : 'invalid');
        setStep('error');
      });
    return () => {
      cancelled = true;
    };
  }, [encoded]);

  if (step === 'loading') {
    return (
      <>
        <h1>{t('family.open.loading')}</h1>
        <div className="spinner" role="status" aria-label={t('common.loading')} />
      </>
    );
  }

  if (step === 'error') {
    return (
      <>
        <BackButton to="/" />
        <h1>{t('family.open.errorTitle')}</h1>
        <div className="box box-warning" role="alert">
          <div className="box-title">
            <WarningIcon />
            <span>{t('family.open.errorBox')}</span>
          </div>
          <p>{t(`family.open.error.${errorCode}`)}</p>
        </div>
        <Link to="/" className="btn btn-primary" onClick={() => setNavDirection('back')}>
          {t('family.backHome')}
        </Link>
      </>
    );
  }

  const oldWarning = isOld(share) && (
    <div className="box box-warning">
      <div className="box-title">
        <WarningIcon />
        <span>{t('family.open.oldTitle')}</span>
      </div>
      <p>{t('family.open.oldText', { date: new Intl.DateTimeFormat(localeOf()).format(new Date(share.at)) })}</p>
    </div>
  );

  return share.t === 'req' ? (
    <OpenRequest share={share} oldWarning={oldWarning} />
  ) : (
    <OpenResponse share={share} oldWarning={oldWarning} />
  );
}

// ---------- Blízký otevřel žádost o pomoc ----------
function OpenRequest({ share, oldWarning }) {
  const navigate = useNavigate();
  const { helper, startHelping } = useMeds();
  // Odkaz vytvořený na tomto telefonu – nejspíš ho pacient omylem otevřel sám.
  const [ownLink, setOwnLink] = useState(() => hasLink('sent', share.id));
  // Otevřené potvrzení: 'restart' | 'replace' | null
  const [confirming, setConfirming] = useState(null);
  const who = share.name || t('family.defaultName');

  function start() {
    startHelping({ name: share.name, requestId: share.id, items: share.items, onco: share.onco });
    navigate('/leky', { replace: true });
  }

  if (ownLink) {
    return (
      <>
        <BackButton to="/" />
        <h1>{t('family.req.ownTitle')}</h1>
        <p className="subtitle">{t('family.req.ownText')}</p>
        <Link to="/" className="btn btn-primary" onClick={() => setNavDirection('back')}>
          {t('family.backHome')}
        </Link>
        {/* Např. jeden tablet pro celou rodinu – i to jde, vlastní léky zůstanou beze změny */}
        <button type="button" className="btn btn-link" onClick={() => setOwnLink(false)}>
          {t('family.req.ownAnyway')}
        </button>
      </>
    );
  }

  // Stejnou žádost už tu někdo vyplňuje – nabídneme pokračovat.
  if (helper && helper.requestId === share.id) {
    return (
      <>
        <BackButton to="/" />
        <h1>{t('family.req.continueTitle')}</h1>
        <p className="subtitle">
          {tRich('family.req.continueText', { name: <strong>{helper.name || who}</strong> })}
        </p>
        <Link to="/leky" className="btn btn-primary" replace>
          {t('family.req.continue')}
        </Link>
        <button
          type="button"
          className="btn btn-link"
          onClick={() => setConfirming('restart')}
        >
          {t('family.req.restart')}
        </button>
        <ConfirmDialog
          open={confirming === 'restart'}
          title={t('family.req.confirmRestartTitle')}
          text={t('family.req.confirmRestartText')}
          confirmLabel={t('family.req.restart')}
          cancelLabel={t('family.keepFilling')}
          danger
          onConfirm={start}
          onCancel={() => setConfirming(null)}
        />
      </>
    );
  }

  return (
    <>
      <BackButton to="/" />
      <h1>{t('family.req.title')}</h1>
      <p className="subtitle">
        {share.name
          ? tRich('family.req.askNamed', { name: <strong>{share.name}</strong> })
          : t('family.req.askUnnamed')}
      </p>
      {oldWarning}

      <div className="box box-info">
        <p>
          {share.items.length > 0
            ? t('family.req.listCount', { count: share.items.length })
            : t('family.req.listEmpty')}
        </p>
        <p>{t('family.req.howTo')}</p>
        <p>
          <strong>{t('family.req.ownSafe')}</strong>
        </p>
      </div>

      {helper && (
        <div className="box box-warning" role="alert">
          <div className="box-title">
            <WarningIcon />
            <span>{t('family.helpingFor', { name: helper.name || t('family.otherPerson') })}</span>
          </div>
          <p>{t('family.req.otherWarn')}</p>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => (helper ? setConfirming('replace') : start())}
      >
        {t('family.req.start', { name: who })}
      </button>
      <Link to="/" className="btn btn-link">
        {t('family.notNow')}
      </Link>
      <ConfirmDialog
        open={confirming === 'replace'}
        title={t('family.req.confirmReplaceTitle')}
        text={t('family.req.confirmReplaceText')}
        confirmLabel={t('family.req.replace')}
        cancelLabel={t('common.back')}
        danger
        onConfirm={start}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

// ---------- Pacient otevřel vyplněné léky od blízkého ----------
function OpenResponse({ share, oldWarning }) {
  const { helper, endHelping, ownMeds, ownProfile, importShared } = useMeds();
  // Rozdíl počítáme jen jednou – po uložení by se jinak přepočítal na "nic nového".
  const [diff] = useState(() => diffShare(ownMeds, share));
  const [done, setDone] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const alreadyImported = hasLink('imported', share.rid);

  // Co je zaškrtnuté: nové a změněné ano, odebrání ne (nic nemažeme bez souhlasu).
  const [checked, setChecked] = useState(() => {
    const on = {};
    diff.added.forEach((m) => (on[`add-${m.id}`] = true));
    diff.changed.forEach(({ after }) => (on[`chg-${after.id}`] = true));
    return on;
  });
  // Odpověď na onkologii: když ji pacient ještě nemá, převezmeme ji; jinak jen na přání.
  const oncoDiffers = share.onco !== '' && share.onco !== ownProfile.onco;
  const [takeOnco, setTakeOnco] = useState(ownProfile.onco === '');

  const toggle = (key) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  // Odkaz zpět otevřel sám blízký (na telefonu, kde vyplňoval).
  if (helper && helper.requestId === share.id) {
    return (
      <>
        <BackButton to="/" />
        <h1>{t('family.res.selfTitle')}</h1>
        <p className="subtitle">
          {tRich('family.res.selfText', { name: <strong>{helper.name || t('family.defaultName')}</strong> })}
        </p>
        <Link to="/blizky" className="btn btn-primary" replace onClick={() => setNavDirection('back')}>
          {t('family.res.back')}
        </Link>
      </>
    );
  }

  // Ukládá se vždy do VLASTNÍCH léků – nejdřív je potřeba ukončit režim pro blízké.
  if (helper) {
    return (
      <>
        <BackButton to="/" />
        <h1>{t('family.res.title')}</h1>
        <div className="box box-warning">
          <div className="box-title">
            <WarningIcon />
            <span>{t('family.helpingFor', { name: helper.name || t('family.otherPerson') })}</span>
          </div>
          <p>{t('family.res.helperText')}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setConfirmEnd(true)}
        >
          {t('family.res.endHelping')}
        </button>
        <Link to="/blizky" className="btn btn-link">
          {t('family.res.sendFirst')}
        </Link>
        <ConfirmDialog
          open={confirmEnd}
          title={t('family.res.confirmEndTitle')}
          text={t('family.res.confirmEndText')}
          confirmLabel={t('family.res.endHelping')}
          cancelLabel={t('common.back')}
          danger
          onConfirm={() => {
            setConfirmEnd(false);
            endHelping();
          }}
          onCancel={() => setConfirmEnd(false)}
        />
      </>
    );
  }

  if (done) {
    return (
      <>
        <h1>{t('family.res.savedTitle')}</h1>
        <div className="box box-info" role="status">
          <div className="box-title">
            <CheckIcon />
            <span>{t('family.res.savedText')}</span>
          </div>
        </div>
        <Link to="/leky" className="btn btn-primary" replace>
          {t('family.res.showMeds')}
        </Link>
      </>
    );
  }

  const nothingNew =
    diff.added.length + diff.changed.length + diff.removed.length === 0 && !oncoDiffers;
  const selectedCount = Object.values(checked).filter(Boolean).length + (oncoDiffers && takeOnco ? 1 : 0);

  function save() {
    importShared({
      add: diff.added.filter((m) => checked[`add-${m.id}`]),
      replace: diff.changed.filter(({ after }) => checked[`chg-${after.id}`]).map(({ after }) => after),
      remove: diff.removed.filter((m) => checked[`del-${m.id}`]).map((m) => m.id),
      onco: oncoDiffers && takeOnco ? share.onco : undefined,
    });
    if (share.rid) rememberLink('imported', share.rid);
    // Data z adresy smažeme, ať se po obnovení stránky neukládají znovu.
    window.history.replaceState(window.history.state, '', window.location.pathname);
    setDone(true);
  }

  // Jeden řádek se zaškrtávátkem
  const row = (key, item, extra) => (
    <li key={key}>
      <label className={checked[key] ? 'choice choice-on family-choice' : 'choice family-choice'}>
        <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)} />
        <span>
          <strong>{displayName(item)}</strong>
          {extra ?? (itemDetails(item) && <span className="family-details">{itemDetails(item)}</span>)}
        </span>
      </label>
    </li>
  );

  return (
    <>
      <BackButton to="/" />
      <h1>{t('family.res.title')}</h1>
      <p className="subtitle">
        {share.from
          ? tRich('family.res.introNamed', { name: <strong>{share.from}</strong> })
          : t('family.res.introUnnamed')}
      </p>
      {oldWarning}
      {alreadyImported && <p className="box box-info">{t('family.res.already')}</p>}

      {nothingNew ? (
        <>
          <div className="box box-info" role="status">
            <div className="box-title">
              <CheckIcon />
              <span>{t('family.res.nothingTitle')}</span>
            </div>
            <p>{t('family.res.nothingText')}</p>
          </div>
          <Link to="/leky" className="btn btn-primary">
            {t('family.res.showMeds')}
          </Link>
        </>
      ) : (
        <div className="field family-review">
          {diff.added.length > 0 && (
            <section>
              <h2>{t('family.res.added', { count: diff.added.length })}</h2>
              <ul className="family-checks">{diff.added.map((m) => row(`add-${m.id}`, m))}</ul>
            </section>
          )}

          {diff.changed.length > 0 && (
            <section>
              <h2>{t('family.res.changed', { count: diff.changed.length })}</h2>
              <ul className="family-checks">
                {diff.changed.map(({ before, after }) =>
                  row(
                    `chg-${after.id}`,
                    after,
                    <span className="family-details">
                      {t('family.res.before', { text: itemDetails(before) || t('family.res.notEntered') })}
                      <br />
                      {t('family.res.after', { text: itemDetails(after) || t('family.res.notEntered') })}
                    </span>,
                  ),
                )}
              </ul>
            </section>
          )}

          {diff.removed.length > 0 && (
            <section>
              <h2>{t('family.res.removed', { count: diff.removed.length })}</h2>
              <p className="family-details">{t('family.res.removedHint')}</p>
              <ul className="family-checks">{diff.removed.map((m) => row(`del-${m.id}`, m))}</ul>
            </section>
          )}

          {oncoDiffers && (
            <section>
              <h2>{t('onco.question')}</h2>
              <ul className="family-checks">
                <li>
                  <label className={takeOnco ? 'choice choice-on family-choice' : 'choice family-choice'}>
                    <input type="checkbox" checked={takeOnco} onChange={(e) => setTakeOnco(e.target.checked)} />
                    <span>
                      <strong>{t('family.res.oncoAnswer', { answer: oncoLabel(share.onco) })}</strong>
                      {ownProfile.onco && (
                        <span className="family-details">
                          {t('family.res.oncoNow', { answer: oncoLabel(ownProfile.onco) })}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              </ul>
            </section>
          )}

          {diff.duplicates.length > 0 && (
            <p className="family-details">
              {t('family.res.duplicates', { list: joinList(diff.duplicates.map(displayName)) })}
            </p>
          )}
        </div>
      )}

      {!nothingNew && (
        <>
          <button type="button" className="btn btn-primary" disabled={selectedCount === 0} onClick={save}>
            {t('family.res.save', { count: selectedCount })}
          </button>
          <Link to="/" className="btn btn-link">
            {t('family.notNow')}
          </Link>
        </>
      )}
    </>
  );
}
