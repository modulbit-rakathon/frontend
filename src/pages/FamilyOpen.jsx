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
import { medName, pluralLeky } from '../labels.js';
import { decodeShare, diffShare, hasLink, isOld, readHash, rememberLink } from '../familyShare.js';
import { ONCO_ANSWERS, dateText, dosageText, oncoFormText, prescriberText, sinceText } from '../types.js';

const ERROR_TEXTS = {
  empty: 'V odkazu nejsou žádné údaje. Možná se při kopírování usekl.',
  invalid: 'Odkaz je neplatný nebo neúplný. Zkopírujte ho prosím celý, nebo požádejte o nový.',
  newer: 'Odkaz je z novější verze aplikace. Obnovte stránku a zkuste to znovu.',
  unsupported: 'Tento prohlížeč odkaz neumí otevřít. Aktualizujte ho, nebo zkuste jiný (Chrome, Safari).',
};

// Krátký popis položky pro kontrolu: "5 mg · ráno 1 · od března 2024"
function itemDetails(item) {
  return [
    item.strength,
    dosageText(item.dosage),
    sinceText(item.since) && `od ${sinceText(item.since)}`,
    prescriberText(item.prescriber),
    oncoFormText(item.oncoForm),
    item.lastDose && `poslední dávka ${dateText(item.lastDose)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

const oncoLabel = (key) => ONCO_ANSWERS.find((a) => a.key === key)?.label ?? 'neodpovězeno';

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
        setErrorCode(ERROR_TEXTS[error.message] ? error.message : 'invalid');
        setStep('error');
      });
    return () => {
      cancelled = true;
    };
  }, [encoded]);

  if (step === 'loading') {
    return (
      <>
        <h1>Otevírám odkaz…</h1>
        <div className="spinner" role="status" aria-label="Načítám" />
      </>
    );
  }

  if (step === 'error') {
    return (
      <>
        <h1>Odkaz nejde otevřít</h1>
        <div className="box box-warning" role="alert">
          <div className="box-title">
            <WarningIcon />
            <span>Něco s odkazem není v pořádku</span>
          </div>
          <p>{ERROR_TEXTS[errorCode]}</p>
        </div>
        <Link to="/" className="btn btn-primary">
          Zpět domů
        </Link>
      </>
    );
  }

  const oldWarning = isOld(share) && (
    <div className="box box-warning">
      <div className="box-title">
        <WarningIcon />
        <span>Odkaz je starší</span>
      </div>
      <p>Vznikl {new Date(share.at).toLocaleDateString('cs-CZ')}. Zkontrolujte, že údaje pořád platí.</p>
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
  const who = share.name || 'blízkého člověka';

  function start() {
    startHelping({ name: share.name, requestId: share.id, items: share.items, onco: share.onco });
    navigate('/leky', { replace: true });
  }

  if (ownLink) {
    return (
      <>
        <h1>Tento odkaz je váš</h1>
        <p className="subtitle">Vytvořili jste ho na tomto telefonu. Pošlete ho blízkému, který vám s léky pomůže.</p>
        <Link to="/" className="btn btn-primary">
          Zpět domů
        </Link>
        {/* Např. jeden tablet pro celou rodinu – i to jde, vlastní léky zůstanou beze změny */}
        <button type="button" className="btn btn-link" onClick={() => setOwnLink(false)}>
          Přesto vyplnit na tomto telefonu
        </button>
      </>
    );
  }

  // Stejnou žádost už tu někdo vyplňuje – nabídneme pokračovat.
  if (helper && helper.requestId === share.id) {
    return (
      <>
        <h1>Už vyplňujete</h1>
        <p className="subtitle">
          Léky za: <strong>{helper.name || who}</strong> už na tomto telefonu vyplňujete.
        </p>
        <Link to="/leky" className="btn btn-primary" replace>
          Pokračovat
        </Link>
        <button
          type="button"
          className="btn btn-link"
          onClick={() => window.confirm('Začít znovu? Vaše dosavadní změny se smažou.') && start()}
        >
          Začít znovu
        </button>
      </>
    );
  }

  return (
    <>
      <h1>Prosba o pomoc s léky</h1>
      <p className="subtitle">
        {share.name ? (
          <>
            <strong>{share.name}</strong> vás prosí o pomoc se seznamem léků.
          </>
        ) : (
          'Někdo blízký vás prosí o pomoc se seznamem léků.'
        )}
      </p>
      {oldWarning}

      <div className="box box-info">
        <p>
          {share.items.length > 0
            ? `Seznam už obsahuje ${pluralLeky(share.items.length)}.`
            : 'Seznam je zatím prázdný.'}
        </p>
        <p>Léky vyfotíte nebo zapíšete jako obvykle. Na konci pošlete odkaz zpět.</p>
        <p>
          <strong>Vaše vlastní léky na tomto telefonu zůstanou beze změny.</strong>
        </p>
      </div>

      {helper && (
        <div className="box box-warning" role="alert">
          <div className="box-title">
            <WarningIcon />
            <span>Teď vyplňujete za: {helper.name || 'jiného člověka'}</span>
          </div>
          <p>Když začnete tady, ten rozpracovaný seznam se z telefonu smaže. Pokud jste ho ještě neposlali, udělejte to nejdřív.</p>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => (!helper || window.confirm('Smazat rozpracovaný seznam a začít nový?')) && start()}
      >
        Začít vyplňovat za: {who}
      </button>
      <Link to="/" className="btn btn-link">
        Teď ne
      </Link>
    </>
  );
}

// ---------- Pacient otevřel vyplněné léky od blízkého ----------
function OpenResponse({ share, oldWarning }) {
  const { helper, endHelping, ownMeds, ownProfile, importShared } = useMeds();
  // Rozdíl počítáme jen jednou – po uložení by se jinak přepočítal na "nic nového".
  const [diff] = useState(() => diffShare(ownMeds, share));
  const [done, setDone] = useState(false);
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
  const from = share.from || 'Blízký';

  // Odkaz zpět otevřel sám blízký (na telefonu, kde vyplňoval).
  if (helper && helper.requestId === share.id) {
    return (
      <>
        <h1>Tento odkaz pošlete zpět</h1>
        <p className="subtitle">
          Odkaz je pro: <strong>{helper.name || 'blízkého člověka'}</strong>. Pošlete mu ho zprávou nebo ukažte QR kód.
        </p>
        <Link to="/blizky" className="btn btn-primary" replace>
          Zpět
        </Link>
      </>
    );
  }

  // Ukládá se vždy do VLASTNÍCH léků – nejdřív je potřeba ukončit režim pro blízké.
  if (helper) {
    return (
      <>
        <h1>Léky od blízkého</h1>
        <div className="box box-warning">
          <div className="box-title">
            <WarningIcon />
            <span>Teď vyplňujete za: {helper.name || 'jiného člověka'}</span>
          </div>
          <p>Tento odkaz patří do vašich vlastních léků. Nejdřív ukončete vyplňování za blízkého.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.confirm('Ukončit vyplňování? Rozpracovaný seznam se z telefonu smaže.') && endHelping()}
        >
          Ukončit vyplňování
        </button>
        <Link to="/blizky" className="btn btn-link">
          Nejdřív poslat seznam zpět
        </Link>
      </>
    );
  }

  if (done) {
    return (
      <>
        <h1>Uloženo</h1>
        <div className="box box-info" role="status">
          <div className="box-title">
            <CheckIcon />
            <span>Seznam léků je aktuální</span>
          </div>
        </div>
        <Link to="/leky" className="btn btn-primary" replace>
          Zobrazit moje léky
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
          <strong>{medName(item)}</strong>
          {extra ?? (itemDetails(item) && <span className="family-details">{itemDetails(item)}</span>)}
        </span>
      </label>
    </li>
  );

  return (
    <>
      <h1>Léky od blízkého</h1>
      <p className="subtitle">
        <strong>{from}</strong> vám poslal(a) seznam léků. Zkontrolujte ho a uložte.
      </p>
      {oldWarning}
      {alreadyImported && (
        <p className="box box-info">Tento odkaz už jste jednou otevřeli a uložili. Co už máte, se znovu nepřidá.</p>
      )}

      {nothingNew ? (
        <>
          <div className="box box-info" role="status">
            <div className="box-title">
              <CheckIcon />
              <span>Nic nového</span>
            </div>
            <p>Všechno z odkazu už v seznamu máte.</p>
          </div>
          <Link to="/leky" className="btn btn-primary">
            Zobrazit moje léky
          </Link>
        </>
      ) : (
        <div className="field family-review">
          {diff.added.length > 0 && (
            <section>
              <h2>Nové ({diff.added.length})</h2>
              <ul className="family-checks">{diff.added.map((m) => row(`add-${m.id}`, m))}</ul>
            </section>
          )}

          {diff.changed.length > 0 && (
            <section>
              <h2>Změněné ({diff.changed.length})</h2>
              <ul className="family-checks">
                {diff.changed.map(({ before, after }) =>
                  row(
                    `chg-${after.id}`,
                    after,
                    <span className="family-details">
                      Dřív: {itemDetails(before) || 'nezadáno'}
                      <br />
                      Nově: {itemDetails(after) || 'nezadáno'}
                    </span>,
                  ),
                )}
              </ul>
            </section>
          )}

          {diff.removed.length > 0 && (
            <section>
              <h2>Blízký navrhuje odebrat ({diff.removed.length})</h2>
              <p className="family-details">Odeberou se jen ty, které zaškrtnete.</p>
              <ul className="family-checks">{diff.removed.map((m) => row(`del-${m.id}`, m))}</ul>
            </section>
          )}

          {oncoDiffers && (
            <section>
              <h2>Léčíte se na onkologii?</h2>
              <ul className="family-checks">
                <li>
                  <label className={takeOnco ? 'choice choice-on family-choice' : 'choice family-choice'}>
                    <input type="checkbox" checked={takeOnco} onChange={(e) => setTakeOnco(e.target.checked)} />
                    <span>
                      <strong>Odpověď: {oncoLabel(share.onco)}</strong>
                      {ownProfile.onco && <span className="family-details">Teď máte: {oncoLabel(ownProfile.onco)}</span>}
                    </span>
                  </label>
                </li>
              </ul>
            </section>
          )}

          {diff.duplicates.length > 0 && (
            <p className="family-details">
              Už máte, nepřidá se znovu: {diff.duplicates.map((m) => medName(m)).join(', ')}
            </p>
          )}
        </div>
      )}

      {!nothingNew && (
        <>
          <button type="button" className="btn btn-primary" disabled={selectedCount === 0} onClick={save}>
            Uložit vybrané ({selectedCount})
          </button>
          <Link to="/" className="btn btn-link">
            Teď ne
          </Link>
        </>
      )}
    </>
  );
}
