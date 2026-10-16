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
import { analyzePhoto } from '../api.js';
import MedForm from '../components/MedForm.jsx';
import PhotoHighlights, { boxesForForm } from '../components/PhotoHighlights.jsx';
import { CameraIcon, WarningIcon } from '../components/Icons.jsx';
import { medName, medTitle } from '../labels.js';
import { BACKEND_TO_FORM_FIELD, ITEM_TYPES, dosageFromText, dosageText } from '../types.js';

// Uklidňující texty při čtení fotky – střídají se každé 3 sekundy.
const LOADING_MESSAGES = [
  'Čtu text na fotce…',
  'Hledám název léku…',
  'Kontroluji sílu a dávkování…',
  'Ještě chvilku, už to skoro mám…',
];

// Lék od backendu → počáteční hodnoty formuláře
function formInitial(med) {
  return {
    name: medName(med),
    strength: med.strength ?? '',
    dosage: dosageFromText(med.frequency, med.amount),
  };
}

// Nejistá pole od backendu (frequency, amount…) → pole formuláře (dosage…)
function formUncertain(med) {
  return [...new Set((med.uncertain_fields ?? []).map((f) => BACKEND_TO_FORM_FIELD[f]).filter(Boolean))];
}

export default function Scan() {
  const navigate = useNavigate();
  const { addMed, profile } = useMeds();

  // Kam jít po přidání léku: poprvé se ještě zeptáme na doplňky stravy.
  const afterAdd = profile.supplementsAsked ? '/leky' : '/doplnky?krok=1';

  // Adresa /vyfotit?rucne=1 otevře rovnou ruční zadání.
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(searchParams.get('rucne') ? 'manual' : 'pick');

  const [photoUrl, setPhotoUrl] = useState(null); // náhled vyfocené fotky
  const [pending, setPending] = useState([]); // léky z fotky, které čekají na potvrzení
  const [unreadable, setUnreadable] = useState(0); // co AI nepřečetla
  const [allFromPhoto, setAllFromPhoto] = useState([]); // všechny léky z fotky (pro přepis lístku)
  const [activeField, setActiveField] = useState(null); // pole, které pacient právě upravuje
  const [loadingIndex, setLoadingIndex] = useState(0); // který uklidňující text ukazujeme

  // Odkaz na skrytý <input type="file">, abychom ho mohli "kliknout" z tlačítka.
  const fileInputRef = useRef(null);
  // Co pacient fotí: 'box' = krabička, 'note' = lístek od lékaře.
  // Pamatujeme si to, aby "Vyfotit znovu" fotilo zase totéž.
  const photoSourceRef = useRef('box');
  // Číslo aktuálního požadavku – díky němu umíme ignorovat zrušené čtení.
  const requestIdRef = useRef(0);

  // Když se fotka změní (nebo odejdeme z obrazovky), uvolníme starý náhled z paměti.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // Při načítání střídáme uklidňující texty.
  useEffect(() => {
    if (step !== 'loading') return;
    setLoadingIndex(0);
    const timer = setInterval(() => {
      // Poslední text necháme svítit, nezačínáme znovu od začátku.
      setLoadingIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1));
    }, 3000);
    return () => clearInterval(timer);
  }, [step]);

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

    const requestId = ++requestIdRef.current;
    try {
      const result = await analyzePhoto(file, photoSourceRef.current);
      // Pacient mezitím dal "Zrušit" nebo vyfotil jinou fotku → výsledek zahodíme.
      if (requestId !== requestIdRef.current) return;

      if (result.medications.length === 0) {
        setStep('error');
        return;
      }
      setPending(result.medications);
      setAllFromPhoto(result.medications);
      setUnreadable(result.unreadable_items);
      setStep('confirm');
    } catch {
      if (requestId !== requestIdRef.current) return;
      setStep('error');
    }
  }

  function cancelLoading() {
    requestIdRef.current++; // tím "zneplatníme" běžící čtení
    setStep('pick');
  }

  // Pacient potvrdil lék z fotky.
  function handleConfirm(values) {
    const current = pending[0];
    // Formulář vrací jen to, co pacient vidí (název, síla, dávkování).
    // Ostatní údaje od backendu (druh, účinná látka, léková forma) doplníme sami.
    addMed({
      ...values,
      type: ITEM_TYPES.LEK,
      source: current.source,
      kind: current.kind ?? 'drug',
      active_substance: current.active_substance ?? null,
      form: current.form ?? null,
    });

    const rest = pending.slice(1);
    if (rest.length > 0) {
      setPending(rest); // na fotce bylo víc léků → ukážeme další
    } else {
      navigate(afterAdd);
    }
  }

  // Pacient zadal lék ručně.
  function handleManual(values) {
    addMed({ ...values, type: ITEM_TYPES.LEK, source: 'manual', kind: 'drug' });
    navigate(afterAdd);
  }

  return (
    <>
      {/* Skrytý vstup pro fotku. capture="environment" = zadní fotoaparát */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
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
          <p className="subtitle">Nic nemusíte dělat. Obvykle to trvá do půl minuty.</p>
          <img src={photoUrl} alt="Vaše fotka" className="photo-preview" />
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

      {step === 'confirm' && pending.length > 0 && (
        <>
          <h1>Zkontrolujte, prosím</h1>
          <p className="subtitle">
            {pending[0].source === 'note' ? 'Co jsme přečetli z lístku:' : 'Co jsme přečetli z fotky:'}
          </p>

          {pending[0].source === 'note' ? (
            // LÍSTEK: fotka poznámky vedle přepsaného textu
            <div className="note-compare">
              <PhotoHighlights
                src={photoUrl}
                boxes={boxesForForm(pending[0].field_boxes, BACKEND_TO_FORM_FIELD)}
                activeField={activeField}
                uncertainFields={formUncertain(pending[0])}
              />
              <div className="note-transcript">
                <h2>Přepis lístku</h2>
                <ol>
                  {allFromPhoto.map((m) => {
                    const isCurrent = m.id === pending[0].id;
                    const isDone = !pending.some((p) => p.id === m.id);
                    return (
                      <li key={m.id} className={isCurrent ? 'note-line note-line-current' : 'note-line'}>
                        <strong>{medTitle(m)}</strong>
                        {dosageText(dosageFromText(m.frequency, m.amount)) &&
                          ` – ${dosageText(dosageFromText(m.frequency, m.amount))}`}
                        {/* Stav slovy, ne jen barvou */}
                        {isCurrent && <span className="note-state"> (teď kontrolujete)</span>}
                        {isDone && <span className="note-state"> (přidáno)</span>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          ) : (
            // KRABIČKA: velká fotka, pod ní rozpoznaná pole
            <PhotoHighlights
              src={photoUrl}
              boxes={boxesForForm(pending[0].field_boxes, BACKEND_TO_FORM_FIELD)}
              activeField={activeField}
              uncertainFields={formUncertain(pending[0])}
            />
          )}

          {allFromPhoto.length > 1 && (
            <p className="confirm-progress">
              Lék {allFromPhoto.length - pending.length + 1} z {allFromPhoto.length}
            </p>
          )}

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
            initial={formInitial(pending[0])}
            uncertainFields={formUncertain(pending[0])}
            onSubmit={handleConfirm}
            onFieldFocus={setActiveField}
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
    </>
  );
}
