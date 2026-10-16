// Obrazovka 2: Vyfotit léky
//
// Postup:
//   1. Pacient nafotí lístek od lékaře a krabičky léků (max 10 fotek najednou).
//   2. Klepne na "Odeslat fotky" – všechny jdou na backend v JEDNOM požadavku.
//   3. Backend léky přečte, vyhledá je v katalogu a stejný lék z lístku
//      i z krabičky spojí. Appka ukáže tabulku "Sedí to?".
//   4. Pacient vyřeší, co je potřeba, a klepne na "Uložit" → léky jdou do localStorage.
//
// Obrazovka má několik "kroků" (stavů). V proměnné `step` je, který právě ukazujeme:
//   'pick'    – sbírání fotek
//   'loading' – čekáme na backend
//   'review'  – tabulka s léky ke kontrole
//   'error'   – fotky se nepodařilo přečíst
//   'manual'  – ruční zadání léku (prázdný formulář)
import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { analyzePhotos } from '../api.js';
import MedForm from '../components/MedForm.jsx';
import ReviewDetail from '../components/ReviewDetail.jsx';
import { CameraIcon, CheckIcon, WarningIcon } from '../components/Icons.jsx';
import { medTitle, sourcesText } from '../labels.js';
import { shrinkPhoto, sizeText } from '../photos.js';
import { draftToItem, draftTodos, makeDraft } from '../review.js';
import { ITEM_TYPES, PHOTO_KINDS, PHOTO_LIMITS, dosageText } from '../types.js';

// Uklidňující texty při čtení fotek – střídají se každých 5 sekund.
const LOADING_MESSAGES = [
  'Čtu text na fotkách…',
  'Hledám léky v seznamu léků…',
  'Porovnávám lístek s krabičkami…',
  'Ručně psaný lístek trvá déle. Ještě chvilku…',
];

// Chyby od backendu → co řekneme pacientovi
const ERROR_TEXTS = {
  nothing_found: 'Na fotkách jsme nenašli žádný lék.',
  payload_too_large: 'Fotek je moc nebo jsou moc velké.',
  unsupported_media_type: 'Tento formát fotky neumíme přečíst.',
  rate_limited: 'Moc pokusů za sebou. Zkuste to prosím za minutu.',
};

// Jednoduché unikátní id pro fotku
let photoCounter = 0;

// Správný tvar slova: 1 fotka, 2 fotky, 5 fotek
function pluralFotky(count) {
  if (count === 1) return '1 fotku';
  if (count >= 2 && count <= 4) return `${count} fotky`;
  return `${count} fotek`;
}

export default function Scan() {
  const navigate = useNavigate();
  const { addMed, profile } = useMeds();

  // Kam jít po přidání léků: poprvé se ještě zeptáme na doplňky stravy.
  const afterAdd = profile.supplementsAsked ? '/leky' : '/doplnky?krok=1';

  // Adresa /vyfotit?rucne=1 otevře rovnou ruční zadání.
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(searchParams.get('rucne') ? 'manual' : 'pick');

  // Nafocené fotky: { id, field: 'note'|'box', file, url (náhled) }
  const [photos, setPhotos] = useState([]);
  const [preparing, setPreparing] = useState(false); // zmenšujeme fotky
  const [pickMessage, setPickMessage] = useState(''); // upozornění při přidávání fotek

  const [drafts, setDrafts] = useState([]); // léky z fotek ke kontrole (viz review.js)
  const [unreadable, setUnreadable] = useState(0); // kolik léků AI nepřečetla
  const [openIds, setOpenIds] = useState([]); // které řádky tabulky jsou rozbalené
  const [editingId, setEditingId] = useState(null); // u kterého léku je otevřený formulář
  const [errorCode, setErrorCode] = useState('');
  const [loadingIndex, setLoadingIndex] = useState(0); // který uklidňující text ukazujeme

  // Odkaz na skrytý <input type="file">, abychom ho mohli "kliknout" z tlačítka.
  const fileInputRef = useRef(null);
  // Jaký druh fotky pacient právě přidává ('note' nebo 'box').
  const photoFieldRef = useRef('box');
  // Číslo aktuálního požadavku – díky němu umíme ignorovat zrušené čtení.
  const requestIdRef = useRef(0);
  // Aktuální fotky pro úklid při odchodu z obrazovky
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Při odchodu z obrazovky uvolníme náhledy fotek z paměti.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  // Při načítání střídáme uklidňující texty.
  useEffect(() => {
    if (step !== 'loading') return;
    setLoadingIndex(0);
    const timer = setInterval(() => {
      // Poslední text necháme svítit, nezačínáme znovu od začátku.
      setLoadingIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [step]);

  // ---------- 1) Sbírání fotek ----------

  // Otevře výběr fotky. Na mobilu nabídne fotoaparát i galerii
  // (z galerie jde vybrat víc fotek najednou).
  function openPicker(field) {
    photoFieldRef.current = field;
    setPickMessage('');
    fileInputRef.current.click();
  }

  async function handleFiles(event) {
    const files = [...event.target.files];
    event.target.value = ''; // vyčistíme, aby šla stejná fotka vybrat znovu
    if (files.length === 0) return;

    // Víc než 10 fotek backend nepřijme → přebytečné nepřidáme.
    const free = PHOTO_LIMITS.maxCount - photos.length;
    const accepted = files.slice(0, free);
    let message = files.length > free ? `Najednou jde poslat nejvýš ${PHOTO_LIMITS.maxCount} fotek.` : '';

    setPreparing(true);
    const added = [];
    for (const file of accepted) {
      try {
        const small = await shrinkPhoto(file);
        added.push({ id: ++photoCounter, field: photoFieldRef.current, file: small, url: URL.createObjectURL(small) });
      } catch {
        message = 'Některou fotku se nepodařilo otevřít. Vyfoťte ji prosím znovu.';
      }
    }
    setPreparing(false);
    setPhotos((prev) => [...prev, ...added]);
    setPickMessage(message);
  }

  function removePhoto(id) {
    const photo = photos.find((p) => p.id === id);
    URL.revokeObjectURL(photo.url);
    setPhotos(photos.filter((p) => p.id !== id));
    setPickMessage('');
  }

  // ---------- 2) Odeslání ----------

  async function send() {
    const totalBytes = photos.reduce((sum, p) => sum + p.file.size, 0);
    if (totalBytes > PHOTO_LIMITS.maxBytes) {
      setPickMessage(`Fotky mají dohromady ${sizeText(totalBytes)}, víc než 15 MB. Odeberte některé.`);
      return;
    }

    setStep('loading');
    const requestId = ++requestIdRef.current;
    try {
      const result = await analyzePhotos({
        note: photos.filter((p) => p.field === 'note').map((p) => p.file),
        box: photos.filter((p) => p.field === 'box').map((p) => p.file),
      });
      // Pacient mezitím dal "Zrušit" → výsledek zahodíme.
      if (requestId !== requestIdRef.current) return;

      if (result.medications.length === 0) {
        setErrorCode('nothing_found');
        setStep('error');
        return;
      }
      const newDrafts = result.medications.map(makeDraft);
      setDrafts(newDrafts);
      setUnreadable(result.unreadable_items);
      // Rozbalíme rovnou řádky, u kterých je co řešit
      setOpenIds(newDrafts.filter((d) => draftTodos(d) > 0).map((d) => d.id));
      setEditingId(null);
      setStep('review');
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setErrorCode(error.message);
      setStep('error');
    }
  }

  function cancelLoading() {
    requestIdRef.current++; // tím "zneplatníme" běžící čtení
    setStep('pick');
  }

  // ---------- 3) Kontrola ----------

  function updateDraft(changed) {
    setDrafts((prev) => prev.map((d) => (d.id === changed.id ? changed : d)));
  }

  function removeDraft(id) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function toggleRow(id) {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // ---------- 4) Uložení ----------

  function saveAll() {
    drafts.forEach((d) => addMed(draftToItem(d)));
    navigate(afterAdd);
  }

  // Pacient zadal lék ručně.
  function handleManual(values) {
    addMed({ ...values, type: ITEM_TYPES.LEK, source: 'manual', kind: 'drug' });
    navigate(afterAdd);
  }

  const remaining = drafts.filter((d) => draftTodos(d) > 0).length;

  return (
    <>
      {/* Skrytý vstup pro fotky. multiple = z galerie jde vybrat víc fotek najednou.
          image/* (ne jen jpeg/png): fotky z iPhonu (HEIC) převede shrinkPhoto na JPEG. */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} hidden />

      {step === 'pick' && (
        <>
          <h1>Vyfotit léky</h1>
          <p className="subtitle">
            Vyfoťte lístek od lékaře a krabičky léků. Najednou můžete poslat až {PHOTO_LIMITS.maxCount} fotek.
          </p>

          {PHOTO_KINDS.map((kind, i) => {
            const list = photos.filter((p) => p.field === kind.field);
            return (
              <section key={kind.field} className="photo-group" aria-labelledby={`photos-${kind.field}`}>
                <h2 id={`photos-${kind.field}`}>
                  {i + 1}. {kind.title}
                  {list.length > 0 && <span className="photo-group-count"> ({list.length})</span>}
                </h2>
                <p className="photo-group-hint">{kind.hint}</p>

                {list.length > 0 && (
                  <ul className="photo-list">
                    {list.map((p, index) => (
                      <li key={p.id} className="photo-item">
                        <img src={p.url} alt={`${kind.title}, fotka ${index + 1}`} />
                        <button
                          type="button"
                          className="btn-text"
                          aria-label={`Odebrat fotku ${index + 1} – ${kind.title.toLowerCase()}`}
                          onClick={() => removePhoto(p.id)}
                        >
                          Odebrat
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  className="btn btn-dashed"
                  onClick={() => openPicker(kind.field)}
                  disabled={preparing || photos.length >= PHOTO_LIMITS.maxCount}
                >
                  <CameraIcon />
                  {kind.add}
                </button>
              </section>
            );
          })}

          {/* role="status" = čtečka přečte změnu (přidaná fotka, upozornění) */}
          <p className="photo-counter" role="status">
            {preparing ? 'Připravuji fotky…' : `Fotky: ${photos.length} z ${PHOTO_LIMITS.maxCount}`}
          </p>
          {pickMessage && (
            <div className="box box-warning">
              <div className="box-title">
                <WarningIcon />
                <span>{pickMessage}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={send}
            disabled={photos.length === 0 || preparing}
          >
            {photos.length === 0 ? 'Odeslat fotky' : `Odeslat ${pluralFotky(photos.length)}`}
          </button>
          <button type="button" className="btn btn-link" onClick={() => setStep('manual')}>
            Zadat ručně
          </button>
        </>
      )}

      {step === 'loading' && (
        <>
          <h1>Čtu fotky…</h1>
          <p className="subtitle">Nic nemusíte dělat. Ručně psaný lístek může trvat až minutu.</p>
          <ul className="photo-list photo-list-small" aria-hidden="true">
            {photos.map((p) => (
              <li key={p.id} className="photo-item">
                <img src={p.url} alt="" />
              </li>
            ))}
          </ul>
          <div className="loading-box">
            <div className="spinner" aria-hidden="true" />
            {/* aria-live = čtečka obrazovky přečte každý nový text */}
            <p className="loading-text" aria-live="polite">
              {LOADING_MESSAGES[loadingIndex]}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={cancelLoading}>
            Zrušit
          </button>
        </>
      )}

      {step === 'review' && (
        <>
          <h1>Sedí to?</h1>
          <p className="subtitle">Tohle jsme na fotkách přečetli. Klepnutím na lék ho rozbalíte.</p>

          {unreadable > 0 && (
            <div className="box box-warning">
              <div className="box-title">
                <WarningIcon />
                <span>Něco na fotkách nešlo přečíst</span>
              </div>
              <p>Chybějící lék vyfoťte znovu, nebo ho zadejte ručně.</p>
            </div>
          )}

          {drafts.length === 0 ? (
            <p className="empty-state">Všechny léky jste odebrali.</p>
          ) : (
            <div className="table-wrap">
              <table className="report-table review-table">
                <caption className="sr-only">Léky přečtené z fotek</caption>
                <thead>
                  <tr>
                    <th scope="col">Lék</th>
                    <th scope="col">Dávkování</th>
                    <th scope="col">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => {
                    const todos = draftTodos(d);
                    const isOpen = openIds.includes(d.id);
                    return (
                      // Fragment = obal bez vlastního HTML (dva řádky tabulky za sebou)
                      <Fragment key={d.id}>
                        <tr className={todos > 0 ? 'review-row review-row-todo' : 'review-row'}>
                          <td>
                            <button
                              type="button"
                              className="review-toggle"
                              aria-expanded={isOpen}
                              aria-controls={`detail-${d.id}`}
                              onClick={() => toggleRow(d.id)}
                            >
                              <strong>{medTitle(d)}</strong>
                              <span>{sourcesText(d.med)}</span>
                            </button>
                          </td>
                          <td>{dosageText(d.dosage) || 'nepřečteno'}</td>
                          <td>
                            {/* Stav ikonou i slovy – ne jen barvou */}
                            {todos > 0 ? (
                              <span className="review-status review-status-todo">
                                <WarningIcon size={24} />
                                Zkontrolovat
                              </span>
                            ) : (
                              <span className="review-status review-status-ok">
                                <CheckIcon size={24} />
                                Sedí
                              </span>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="review-detail-row" id={`detail-${d.id}`}>
                            <td colSpan={3}>
                              <ReviewDetail
                                draft={d}
                                onChange={updateDraft}
                                onRemove={() => removeDraft(d.id)}
                                editing={editingId === d.id}
                                onEdit={(on) => setEditingId(on ? d.id : null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {remaining > 0 && (
            <p className="submit-note" role="status">
              Nejdřív zkontrolujte léky označené „Zkontrolovat“ (zbývá {remaining}).
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveAll}
            disabled={drafts.length === 0 || remaining > 0}
          >
            <CheckIcon />
            Ano, uložit do mých léků
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('pick')}>
            Upravit fotky a poslat znovu
          </button>
          <button type="button" className="btn btn-link" onClick={() => setStep('manual')}>
            Zadat lék ručně
          </button>
        </>
      )}

      {step === 'error' && (
        <>
          <h1>Nepodařilo se přečíst fotky</h1>
          <div className="box box-info">
            <p>
              <strong>{ERROR_TEXTS[errorCode] ?? 'Zkontrolujte připojení k internetu a zkuste to znovu.'}</strong>
            </p>
            {errorCode === 'nothing_found' && (
              <>
                <p>Zkuste:</p>
                <ul>
                  <li>víc světla</li>
                  <li>krabičku zblízka</li>
                  <li>bez odlesků</li>
                </ul>
              </>
            )}
          </div>
          <button type="button" className="btn btn-primary" onClick={send}>
            Zkusit znovu
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('pick')}>
            <CameraIcon />
            Upravit fotky
          </button>
          <button type="button" className="btn btn-link" onClick={() => setStep('manual')}>
            Zadat lék ručně
          </button>
        </>
      )}

      {step === 'manual' && (
        <>
          <h1>Zadat lék ručně</h1>
          <p className="subtitle">Opište údaje z krabičky nebo lístku.</p>
          <MedForm onSubmit={handleManual} />
          <button type="button" className="btn btn-secondary" onClick={() => setStep('pick')}>
            <CameraIcon />
            Raději vyfotit
          </button>
        </>
      )}
    </>
  );
}
