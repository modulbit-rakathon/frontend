// Obrazovka 2: Vyfotit lék
//
// Obrazovka má několik "kroků" (stavů). V proměnné `step` je, který právě ukazujeme:
//   'pick'    – úvod, tlačítko pro vyfocení
//   'loading' – "Čtu fotku…" (čekáme na AI)
//   'confirm' – pacient kontroluje, co AI přečetla
//   'error'   – fotku se nepodařilo přečíst
//   'manual'  – ruční zadání léku (prázdný formulář)
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMeds } from '../context/MedsContext.jsx';
import { analyzePhoto, apiErrorMessage } from '../api.js';
import { loadCatalog, preparePhoto } from '../core.js';
import MedForm from '../components/MedForm.jsx';
import { CameraIcon, WarningIcon } from '../components/Icons.jsx';
import { medTitle } from '../labels.js';

export default function Scan() {
  const navigate = useNavigate();
  const { meds, addMed, addAnalysis, updateMed } = useMeds();

  // Adresa /vyfotit?rucne=1 otevře rovnou ruční zadání.
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('upravit');
  const [step, setStep] = useState(editId ? 'edit' : searchParams.get('rucne') ? 'manual' : 'pick');
  const [error, setError] = useState('');

  const [photoUrl, setPhotoUrl] = useState(null); // náhled vyfocené fotky
  const [pending, setPending] = useState([]); // léky z fotky, které čekají na potvrzení
  const [unreadable, setUnreadable] = useState(0); // co AI nepřečetla

  // Odkaz na skrytý <input type="file">, abychom ho mohli "kliknout" z tlačítka.
  const fileInputRef = useRef(null);
  // Co pacient fotí: 'box' = krabička, 'note' = lístek od lékaře.
  // Pamatujeme si to, aby "Vyfotit znovu" fotilo zase totéž.
  const photoSourceRef = useRef('box');
  // Číslo aktuálního požadavku – díky němu umíme ignorovat zrušené čtení.
  const requestIdRef = useRef(0);
  const controllerRef = useRef(null);

  useEffect(() => () => {
    requestIdRef.current++;
    controllerRef.current?.abort();
  }, []);

  // Když se fotka změní (nebo odejdeme z obrazovky), uvolníme starý náhled z paměti.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // Otevře fotoaparát (na mobilu) nebo výběr souboru (na počítači).
  // source = co se fotí; bez něj se fotí totéž co minule.
  function openCamera(source) {
    if (source) photoSourceRef.current = source;
    fileInputRef.current.click();
  }

  // Zavolá se, když pacient vyfotí / vybere fotku.
  async function handleFileChange(event) {
    const file = event.target.files[0];
    event.target.value = ''; // vyčistíme, aby šla stejná fotka vybrat znovu
    if (!file) return;

    setPhotoUrl(URL.createObjectURL(file));
    setStep('loading');
    setError('');
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const requestId = ++requestIdRef.current;
    try {
      await loadCatalog();
      if (requestId !== requestIdRef.current) return;
      const raw = await analyzePhoto(file, photoSourceRef.current, { signal: controller.signal });
      const result = await preparePhoto(raw);
      // Pacient mezitím dal "Zrušit" nebo vyfotil jinou fotku → výsledek zahodíme.
      if (requestId !== requestIdRef.current) return;

      // Persist the whole batch before reviewing its first row: navigation must not hide omissions.
      const drafts = addAnalysis(result);
      setUnreadable(result.unreadable_count);
      if (drafts.length === 0) {
        setError(result.unreadable_count > 0
          ? `Nepřečtených položek: ${result.unreadable_count}. Doplňte je ručně a zkontrolujte seznam.`
          : 'Na fotce nebyl rozpoznán žádný lék.');
        setStep('error');
        return;
      }
      setPending(drafts);
      setStep('confirm');
    } catch (failure) {
      if (requestId !== requestIdRef.current) return;
      setError(failure instanceof TypeError
        ? 'Výsledek nelze zpracovat. Zkontrolujte připojení; pokud se chyba opakuje, ověřte katalog a formát odpovědi backendu.'
        : apiErrorMessage(failure));
      setStep('error');
    }
  }

  function cancelLoading() {
    requestIdRef.current++; // tím "zneplatníme" běžící čtení
    controllerRef.current?.abort();
    setStep('pick');
  }

  // Pacient potvrdil lék z fotky.
  function handleConfirm(saved, original) {
    updateMed(saved, original);

    const rest = pending.slice(1);
    if (rest.length > 0) {
      setPending(rest); // na fotce bylo víc léků → ukážeme další
    } else {
      navigate('/leky');
    }
  }

  // Pacient zadal lék ručně.
  function handleManual(saved) {
    addMed(saved);
    navigate('/leky');
  }

  return (
    <>
      {/* Skrytý vstup pro fotku. capture="environment" = zadní fotoaparát */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        onChange={handleFileChange}
        hidden
      />

      {step === 'pick' && (
        <>
          <h1>Vyfotit lék</h1>
          <p className="subtitle">Vyfoťte krabičku nebo lístek od lékaře.</p>
          <button type="button" className="hero-button" onClick={() => openCamera('box')}>
            <CameraIcon size={72} />
            <span className="hero-title">Vyfotit krabičku</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => openCamera('note')}>
            <CameraIcon />
            Vyfotit lístek od lékaře
          </button>
          <button type="button" className="btn btn-link" onClick={() => setStep('manual')}>
            Zadat ručně
          </button>
        </>
      )}

      {step === 'loading' && (
        <>
          <h1>Čtu fotku…</h1>
          <p className="subtitle">Chvilku to potrvá.</p>
          <img src={photoUrl} alt="Vaše fotka" className="photo-preview" />
          <div className="spinner" role="status" aria-label="Načítám" />
          <button type="button" className="btn btn-secondary" onClick={cancelLoading}>
            Zrušit
          </button>
        </>
      )}

      {step === 'confirm' && pending.length > 0 && (
        <>
          <h1>Zkontrolujte, prosím</h1>
          <p className="subtitle">Co jsme přečetli z fotky:</p>

          <div className="confirm-header">
            <img src={photoUrl} alt="Vaše fotka" className="photo-thumb" />
            <p className="confirm-name">{medTitle(pending[0])}</p>
          </div>

          {unreadable > 0 && (
            <div className="box box-warning">
              <div className="box-title">
                <WarningIcon />
                <span>Něco na fotce nešlo přečíst</span>
              </div>
              <p>Zkuste to vyfotit znovu.</p>
            </div>
          )}

          {/* key = při dalším léku z fotky se formulář vytvoří znovu s novými hodnotami */}
          <MedForm
            key={pending[0].id}
            initial={pending[0]}
            onSubmit={handleConfirm}
          />
          <button type="button" className="btn btn-secondary" onClick={() => openCamera()}>
            Vyfotit znovu
          </button>
          <button type="button" className="btn btn-link" onClick={() => setStep('manual')}>
            Zadat ručně
          </button>
        </>
      )}

      {step === 'error' && (
        <>
          <h1>Nepodařilo se přečíst fotku</h1>
          {error && <p className="box box-warning" role="alert">{error}</p>}
          {photoUrl && <img src={photoUrl} alt="Vaše fotka" className="photo-preview" />}
          <div className="box box-info">
            <p>
              <strong>Zkuste:</strong>
            </p>
            <ul>
              <li>víc světla</li>
              <li>krabičku zblízka</li>
              <li>bez odlesků</li>
            </ul>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => openCamera()}>
            <CameraIcon />
            Vyfotit znovu
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('manual')}>
            Zadat lék ručně
          </button>
        </>
      )}

      {step === 'manual' && (
        <>
          <h1>Zadat lék ručně</h1>
          <p className="subtitle">Opište údaje z krabičky nebo lístku.</p>
          <MedForm onSubmit={handleManual} />
          <button type="button" className="btn btn-secondary" onClick={() => openCamera()}>
            <CameraIcon />
            Raději vyfotit
          </button>
        </>
      )}

      {step === 'edit' && (
        <>
          <h1>Zkontrolujte údaje</h1>
          {meds.find(med => med.id === editId) ? (
            <MedForm key={editId} initial={meds.find(med => med.id === editId)} editing onSubmit={(saved, original) => {
              updateMed(saved, original);
              navigate('/leky');
            }} />
          ) : <p className="box box-warning" role="alert">Tento lék už není v seznamu.</p>}
        </>
      )}
    </>
  );
}
