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
import { getLang, t } from '../i18n/index.js';

// Uklidňující texty při čtení fotek – střídají se každých 5 sekund (viz 'scan.loadingMessages').
const loadingMessages = () => t('scan.loadingMessages');

// Chyby od backendu, pro které máme vlastní větu pro pacienta ('scan.error.<kód>')
const ERROR_CODES = ['nothing_found', 'payload_too_large', 'unsupported_media_type', 'rate_limited'];

// Jednoduché unikátní id pro fotku
let photoCounter = 0;

// Druh fotky malými písmeny do věty ("krabičky léků")
const lower = (text) => text.toLocaleLowerCase(getLang());

export default function Scan() {
  const navigate = useNavigate();
  const { addMed, profile } = useMeds();

  // Fotku zprávy z onkologie nabízíme jen pacientům, kteří se tam léčí.
  const photoKinds = PHOTO_KINDS.filter((kind) => !kind.onco || profile.onco === 'ano');

  // Kam jít po přidání léků: poprvé se ještě zeptáme na doplňky stravy.
  const afterAdd = profile.supplementsAsked ? '/leky' : '/doplnky?krok=1';

  // Adresa /vyfotit?rucne=1 otevře rovnou ruční zadání.
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(searchParams.get('rucne') ? 'manual' : 'pick');

  // Nafocené fotky: { id, field: 'note'|'box'|'regimen', file, url (náhled) }
  const [photos, setPhotos] = useState([]);
  const [preparing, setPreparing] = useState(false); // zmenšujeme fotky
  const [pickMessage, setPickMessage] = useState(''); // upozornění při přidávání fotek

  const [drafts, setDrafts] = useState([]); // léky z fotek ke kontrole (viz review.js)
  const [unreadable, setUnreadable] = useState(0); // kolik léků AI nepřečetla
  const [openIds, setOpenIds] = useState([]); // které řádky tabulky jsou rozbalené
  const [editingId, setEditingId] = useState(null); // u kterého léku je otevřený formulář
  const [errorCode, setErrorCode] = useState('');
  const [loadingIndex, setLoadingIndex] = useState(0); // který uklidňující text ukazujeme

  // Odkazy na skryté <input type="file">, abychom je mohli "kliknout" z tlačítek:
  // jeden otevře rovnou fotoaparát, druhý galerii/soubory.
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  // Jaký druh fotky pacient právě přidává ('note', 'box' nebo 'regimen').
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
      setLoadingIndex((i) => Math.min(i + 1, loadingMessages().length - 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [step]);

  // ---------- 1) Sbírání fotek ----------

  // Otevře fotoaparát (useCamera) nebo výběr z galerie
  // (z galerie jde vybrat víc fotek najednou).
  function openPicker(field, useCamera) {
    photoFieldRef.current = field;
    setPickMessage('');
    (useCamera ? cameraInputRef : fileInputRef).current.click();
  }

  async function handleFiles(event) {
    const files = [...event.target.files];
    event.target.value = ''; // vyčistíme, aby šla stejná fotka vybrat znovu
    if (files.length === 0) return;

    // Víc než 10 fotek backend nepřijme → přebytečné nepřidáme.
    const free = PHOTO_LIMITS.maxCount - photos.length;
    const accepted = files.slice(0, free);
    let message = files.length > free ? t('scan.tooMany', { max: PHOTO_LIMITS.maxCount }) : '';

    setPreparing(true);
    const added = [];
    for (const file of accepted) {
      try {
        const small = await shrinkPhoto(file);
        added.push({ id: ++photoCounter, field: photoFieldRef.current, file: small, url: URL.createObjectURL(small) });
      } catch {
        message = t('scan.openFailed');
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
      setPickMessage(t('scan.tooBig', { size: sizeText(totalBytes) }));
      return;
    }

    setStep('loading');
    const requestId = ++requestIdRef.current;
    try {
      const result = await analyzePhotos({
        note: photos.filter((p) => p.field === 'note').map((p) => p.file),
        box: photos.filter((p) => p.field === 'box').map((p) => p.file),
        regimen: photos.filter((p) => p.field === 'regimen').map((p) => p.file),
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
      {/* Skryté vstupy pro fotky. capture="environment" = na mobilu rovnou zadní fotoaparát.
          multiple = z galerie jde vybrat víc fotek najednou.
          image/* (ne jen jpeg/png): fotky z iPhonu (HEIC) převede shrinkPhoto na JPEG. */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFiles} hidden />
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} hidden />

      {step === 'pick' && (
        <>
          <h1>{t('scan.title')}</h1>
          <p className="subtitle">{t('scan.subtitle', { max: PHOTO_LIMITS.maxCount })}</p>

          {photoKinds.map((kind, i) => {
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
                        <img src={p.url} alt={t('scan.photoAlt', { kind: kind.title, n: index + 1 })} />
                        <button
                          type="button"
                          className="btn-text"
                          aria-label={t('scan.removePhoto', { n: index + 1, kind: lower(kind.title) })}
                          onClick={() => removePhoto(p.id)}
                        >
                          {t('common.remove')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="photo-actions">
                  <button
                    type="button"
                    className="btn btn-dashed"
                    onClick={() => openPicker(kind.field, true)}
                    disabled={preparing || photos.length >= PHOTO_LIMITS.maxCount}
                  >
                    <CameraIcon />
                    {kind.add}
                  </button>
                  <button
                    type="button"
                    className="btn btn-link"
                    aria-label={t('scan.fromGalleryAria', { kind: lower(kind.title) })}
                    onClick={() => openPicker(kind.field, false)}
                    disabled={preparing || photos.length >= PHOTO_LIMITS.maxCount}
                  >
                    {t('scan.fromGallery')}
                  </button>
                </div>
              </section>
            );
          })}

          {/* role="status" = čtečka přečte změnu (přidaná fotka, upozornění) */}
          <p className="photo-counter" role="status">
            {preparing ? t('scan.preparing') : t('scan.counter', { count: photos.length, max: PHOTO_LIMITS.maxCount })}
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
            {photos.length === 0 ? t('scan.sendNone') : t('scan.send', { count: photos.length })}
          </button>
          <button type="button" className="btn btn-link" onClick={() => setStep('manual')}>
            {t('common.enterManually')}
          </button>
        </>
      )}

      {step === 'loading' && (
        <>
          <h1>{t('scan.reading')}</h1>
          <p className="subtitle">{t('scan.readingSub')}</p>
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
              {loadingMessages()[loadingIndex]}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={cancelLoading}>
            {t('common.cancel')}
          </button>
        </>
      )}

      {step === 'review' && (
        <>
          <h1>{t('scan.reviewTitle')}</h1>
          <p className="subtitle">{t('scan.reviewSub')}</p>

          {unreadable > 0 && (
            <div className="box box-warning">
              <div className="box-title">
                <WarningIcon />
                <span>{t('scan.unreadableTitle')}</span>
              </div>
              <p>{t('scan.unreadableText')}</p>
            </div>
          )}

          {drafts.length === 0 ? (
            <p className="empty-state">{t('scan.allRemoved')}</p>
          ) : (
            <div className="table-wrap">
              <table className="report-table review-table">
                <caption className="sr-only">{t('scan.caption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('scan.col.med')}</th>
                    <th scope="col">{t('scan.col.dosage')}</th>
                    <th scope="col">{t('scan.col.status')}</th>
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
                          <td>{dosageText(d.dosage) || t('common.notRead')}</td>
                          <td>
                            {/* Stav ikonou i slovy – ne jen barvou */}
                            {todos > 0 ? (
                              <span className="review-status review-status-todo">
                                <WarningIcon size={24} />
                                {t('scan.statusTodo')}
                              </span>
                            ) : (
                              <span className="review-status review-status-ok">
                                <CheckIcon size={24} />
                                {t('scan.statusOk')}
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
              {t('scan.remaining', { count: remaining })}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveAll}
            disabled={drafts.length === 0 || remaining > 0}
          >
            <CheckIcon />
            {t('scan.saveAll')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('pick')}>
            {t('scan.editAndResend')}
          </button>
          <button type="button" className="btn btn-link" onClick={() => setStep('manual')}>
            {t('common.enterMedManually')}
          </button>
        </>
      )}

      {step === 'error' && (
        <>
          <h1>{t('scan.errorTitle')}</h1>
          <div className="box box-info">
            <p>
              <strong>{ERROR_CODES.includes(errorCode) ? t(`scan.error.${errorCode}`) : t('common.checkConnection')}</strong>
            </p>
            {errorCode === 'nothing_found' && (
              <>
                <p>{t('scan.tipsTitle')}</p>
                <ul>
                  <li>{t('scan.tip.light')}</li>
                  <li>{t('scan.tip.close')}</li>
                  <li>{t('scan.tip.glare')}</li>
                </ul>
              </>
            )}
          </div>
          <button type="button" className="btn btn-primary" onClick={send}>
            {t('common.tryAgain')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('pick')}>
            <CameraIcon />
            {t('scan.editPhotos')}
          </button>
          <button type="button" className="btn btn-link" onClick={() => setStep('manual')}>
            {t('common.enterMedManually')}
          </button>
        </>
      )}

      {step === 'manual' && (
        <>
          <h1>{t('common.enterMedManually')}</h1>
          <p className="subtitle">{t('scan.manualSub')}</p>
          <MedForm onSubmit={handleManual} />
          <button type="button" className="btn btn-secondary" onClick={() => setStep('pick')}>
            <CameraIcon />
            {t('scan.ratherPhoto')}
          </button>
        </>
      )}
    </>
  );
}
