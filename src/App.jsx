// Hlavní komponenta: určuje, která obrazovka se ukáže pro kterou adresu,
// a pod ni vždy přidá spodní lištu.
import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import Family from './pages/Family.jsx';
import FamilyOpen from './pages/FamilyOpen.jsx';

export default function App() {
  const location = useLocation();

  // Po přechodu na jinou obrazovku začneme nahoře (jinak by zůstala
  // odscrollovaná pozice z předchozí obrazovky).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Lékařský pohled je pro počítač v ordinaci – vlastní rozložení,
  // bez úzkého mobilního rámečku a bez spodní lišty pacienta.
  if (location.pathname.startsWith('/doc')) {
    return <Doctor />;
  }

  return (
    <div className="app">
      <main className="page">
        {/* Režim pro blízké: pruh "Vyplňujete za: …" */}
        <HelperBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          {/* key = každé kliknutí na "Vyfotit" začne focení znovu od začátku */}
          <Route path="/vyfotit" element={<Scan key={location.key} />} />
          <Route path="/leky" element={<Meds />} />
          <Route path="/zprava" element={<Report />} />
          <Route path="/pin" element={<Pin />} />
          <Route path="/doplnky" element={<Supplements />} />
          <Route path="/onkologie" element={<Onco />} />
          {/* Režim pro blízké: vytvoření odkazu / otevření odkazu (data jsou za #) */}
          <Route path="/blizky" element={<Family />} />
          <Route path="/pomoc" element={<FamilyOpen />} />
          {/* Neznámá adresa → pošleme uživatele domů */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
