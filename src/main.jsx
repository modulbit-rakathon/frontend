// Vstupní bod aplikace – tento soubor se spustí jako první.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import App from './App.jsx';
import { MedsProvider } from './context/MedsContext.jsx';
import { OfflineProvider } from './offline/OfflineContext.jsx';
import Home from './pages/Home.jsx';
import Scan from './pages/Scan.jsx';
import Meds from './pages/Meds.jsx';
import Report from './pages/Report.jsx';
import Pin from './pages/Pin.jsx';
import Supplements from './pages/Supplements.jsx';
import Onco from './pages/Onco.jsx';
import Family from './pages/Family.jsx';
import FamilyOpen from './pages/FamilyOpen.jsx';
import Settings from './pages/Settings.jsx';
import './index.css';
import './ripple.js'; // vlna při klepnutí na tlačítka
import { applyFontSize, loadFontSize } from './accessibility.js';
import { applyLang } from './i18n/index.js';

function Root() {
  return (
    <MedsProvider>
      {/* OfflineProvider = hlídá internet a posílá fotky, které na něj čekaly */}
      <OfflineProvider>
        <App />
      </OfflineProvider>
    </MedsProvider>
  );
}

function ScanRoute() {
  const location = useLocation();
  return <Scan key={location.key} />;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Home /> },
      { path: 'vyfotit', element: <ScanRoute /> },
      { path: 'leky', element: <Meds /> },
      { path: 'zprava', element: <Report /> },
      { path: 'pin', element: <Pin /> },
      { path: 'doplnky', element: <Supplements /> },
      { path: 'onkologie', element: <Onco /> },
      { path: 'blizky', element: <Family /> },
      { path: 'pomoc', element: <FamilyOpen /> },
      { path: 'nastaveni', element: <Settings /> },
      { path: 'doc/*', element: null },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

// Uloženou velikost písma a jazyk nastavíme hned, ještě před prvním vykreslením.
applyFontSize(loadFontSize());
applyLang();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
