// Hlavní komponenta: určuje, která obrazovka se ukáže pro kterou adresu,
// a pod ni vždy přidá spodní lištu.
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav.jsx';
import Home from './pages/Home.jsx';
import Scan from './pages/Scan.jsx';
import Meds from './pages/Meds.jsx';
import Report from './pages/Report.jsx';
import Pin from './pages/Pin.jsx';

export default function App() {
  const location = useLocation();

  return (
    <div className="app">
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          {/* key = každé kliknutí na "Vyfotit" začne focení znovu od začátku */}
          <Route path="/vyfotit" element={<Scan key={location.key} />} />
          <Route path="/leky" element={<Meds />} />
          <Route path="/zprava" element={<Report />} />
          {/* Neznámá adresa → pošleme uživatele domů */}
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path= "/pin" element={<Pin />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
