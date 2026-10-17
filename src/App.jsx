// Hlavní komponenta: určuje, která obrazovka se ukáže pro kterou adresu,
// a pod ni vždy přidá spodní lištu.
import { Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav.jsx';
import HelperBanner from './components/HelperBanner.jsx';
import Home from './pages/Home.jsx';
import Scan from './pages/Scan.jsx';
import Meds from './pages/Meds.jsx';
import Report from './pages/Report.jsx';
import Pin from './pages/Pin.jsx';
import Doctor from './pages/Doctor.jsx';
import Supplements from './pages/Supplements.jsx';
import Onco from './pages/Onco.jsx';
import AddMore from './pages/AddMore.jsx';
import AppStatus from './offline/AppStatus.jsx';
import Family from './pages/Family.jsx';
import FamilyOpen from './pages/FamilyOpen.jsx';
import EnterCode from './pages/EnterCode.jsx';
import { useLang } from './i18n/index.js';
import Settings from './pages/Settings.jsx';
import InstallGate from './install/InstallGate.jsx';
import { isMobile, isStandalone } from './install/installPrompt.js';
import { useMeds } from './context/MedsContext.jsx';
import { t } from './i18n/index.js';
import { useTransitionLocation } from './navTransition.js';

// Na mobilu v prohlížeči appku nepustíme – nejdřív ji pacient přidá na plochu.
// Zjišťujeme jednou při startu: z plochy se appka spouští znovu od začátku.
const mustInstall = isMobile() && !isStandalone();

export default function App() {
  // Adresa, která se právě vykresluje – přechod na novou je animovaný
  // a řeší i scroll (nahoru / obnovení při návratu), viz navTransition.js.
  const location = useTransitionLocation();
  const { lastRemoved, undoRemoveMed, helper } = useMeds();
  // Po změně jazyka se překreslí celá appka (všechny texty jdou přes t()).
  useLang();

  // Lékařský pohled je pro počítač v ordinaci – vlastní rozložení,
  // bez úzkého mobilního rámečku a bez spodní lišty pacienta.
  if (location.pathname.startsWith('/doc')) {
    return (
      <>
        <AppStatus doctor />
        <Doctor />
      </>
    );
  }

  // Odkaz pro blízké (/pomoc) nese data za # a otevírá se rovnou z SMS/e-mailu –
  // ten necháme fungovat i v prohlížeči. Blízký pak vyplňuje léky za pacienta
  // (focení, seznam, odeslání), takže v režimu pro blízké pustíme celou appku.
  // Jinak na mobilu chceme appku z plochy.
  if (mustInstall && !helper && location.pathname !== '/pomoc') {
    return <InstallGate />;
  }

  return (
    <div className="app">
      {/* Bez internetu / fotky ve frontě / nová verze appky */}
      <AppStatus />
      <main className="page">
        {/* Režim pro blízké: pruh "Vyplňujete za: …" */}
        <HelperBanner />
        {lastRemoved && (
          <div className="box box-info undo-notice" role="status">
            <span>{t('meds.removed')}</span>
            <button type="button" className="btn-text" onClick={undoRemoveMed}>
              {t('common.undo')}
            </button>
          </div>
        )}
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          {/* key = každé kliknutí na "Vyfotit" začne focení znovu od začátku */}
          <Route path="/vyfotit" element={<Scan key={location.key} />} />
          <Route path="/leky" element={<Meds />} />
          <Route path="/zprava" element={<Report />} />
          <Route path="/pin" element={<Pin />} />
          <Route path="/doplnky" element={<Supplements />} />
          <Route path="/onkologie" element={<Onco />} />
          {/* Po přidání prvních léků: "Užíváte ještě něco dalšího?" */}
          <Route path="/dalsi" element={<AddMore />} />
          {/* Režim pro blízké: vytvoření odkazu / otevření odkazu (data jsou za #) */}
          <Route path="/blizky" element={<Family />} />
          <Route path="/pomoc" element={<FamilyOpen />} />
          {/* Kód od lékaře nebo blízkého – léky poslané zpět do telefonu */}
          <Route path="/kod" element={<EnterCode />} />
          <Route path="/nastaveni" element={<Settings />} />
          {/* Neznámá adresa → pošleme uživatele domů */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
