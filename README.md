# Pillgaze Frontend

## Kritéria

Protože naše aplikace je primárně pro starší uživatele, musíme se držet určitých parametrů. Naše aplikace musí mít:

- velká barevná tlačítka
- velký text
- rychlé a jednoduché ovládání

Funkce:

- [ ] export pdfka
- [ ] přihlášení lékaře přes jednorázový kód
- [ ] reakce léků na sebe

Frontend projektu **Pillgaze** – mobilní webová appka. Pacient vyfotí krabičku léku, AI rozpozná údaje, pacient je potvrdí, lék se přidá do seznamu, zobrazí se možné interakce a vygeneruje se zpráva pro lékaře.

Stack: React + Vite, react-router-dom, obyčejné CSS (`src/index.css`).

## Jak appku spustit

Potřebujete [Node.js](https://nodejs.org/) verze 18 nebo novější.

```bash
cd frontend
npm install      # jen poprvé – stáhne knihovny
npm run dev      # spustí vývojový server
```

V terminálu se vypíše něco takového:

```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.23:5173/
```

- **Na počítači:** otevřete v prohlížeči adresu `Local` (`http://localhost:5173/`).
  Tip: v prohlížeči zapněte mobilní zobrazení (F12 → ikonka telefonu), appka je dělaná pro mobil.
- **Na mobilu:** telefon musí být na stejné Wi-Fi jako počítač. Otevřete v něm adresu `Network`.

Server zastavíte v terminálu klávesami `Ctrl + C`. Změny v kódu se v prohlížeči projeví samy.

### Produkční build

```bash
npm run build    # vytvoří složku dist/
npm run preview  # spustí zkompilovanou verzi (adresa se opět vypíše v terminálu)
```

## Testování bez AI

AI je zatím jen napodobená (`src/mock/analyze.js`):

- Každá fotka vrátí další ukázkový lék v pořadí: Warfarin → Ibuprofen → Metformin. Po prvních dvou se objeví interakce.
- Fotka, která má v názvu `chyba` (např. `chyba.jpg`), ukáže obrazovku „Nepodařilo se přečíst fotku“.
- Na počítači se místo fotoaparátu otevře výběr souboru – stačí vybrat jakýkoli obrázek.

Léky se ukládají do `localStorage` prohlížeče. Smazat je můžete tlačítkem „Odebrat“ nebo vymazáním dat stránky.

## Struktura

```text
src/
  main.jsx              vstupní bod
  App.jsx               obrazovky podle adresy + spodní lišta
  index.css             všechny styly
  labels.js             sdílené texty (štítky, závažnost)
  context/MedsContext.jsx   seznam léků (sdílený + localStorage)
  mock/analyze.js       náhrada za AI čtení fotky
  mock/interactions.js  náhrada za databázi interakcí
  components/           lišta, ikony, formulář léku, boxy s interakcemi
  pages/                Domů, Vyfotit, Moje léky, Zpráva
```
