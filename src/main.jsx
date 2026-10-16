// Vstupní bod aplikace – tento soubor se spustí jako první.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { MedsProvider } from './context/MedsContext.jsx';
import './index.css';
import './ripple.js'; // vlna při klepnutí na tlačítka
import { applyFontSize, loadFontSize } from './accessibility.js';
import { applyLang } from './i18n/index.js';

// Uloženou velikost písma a jazyk nastavíme hned, ještě před prvním vykreslením.
applyFontSize(loadFontSize());
applyLang();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* BrowserRouter = umožňuje přepínat obrazovky podle adresy (/, /leky, …) */}
    <BrowserRouter>
      {/* MedsProvider = sdílí seznam léků se všemi obrazovkami */}
      <MedsProvider>
        <App />
      </MedsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
