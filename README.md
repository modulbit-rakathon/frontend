# Pillgaze Frontend

Frontend projektu **Pillgaze**: mobilní webová appka pro pacienty a jednoduchý pohled pro lékaře.

Pacient vyfotí krabičku léku nebo lístek od lékaře, AI rozpozná údaje, pacient je potvrdí a lék se přidá do seznamu. Lékař pak v prohlížeči zadá jednorázový kód od pacienta a uvidí jeho léky a možné interakce.

Stack: React + Vite, react-router-dom, obyčejné CSS (`src/index.css`).

## Kritéria

### Pacientská část (mobil)

Appka je primárně pro starší uživatele, proto musí mít:

- velká barevná tlačítka (min. 56 px na výšku), jedna hlavní akce na obrazovce
- velký text, všude min. 18 px, i u štítků a ve spodní liště
- vysoký kontrast, barva nikdy není jediný nosič informace (vždy i ikona nebo text)
- rychlé a jednoduché ovládání, žádná gesta, všechno jde tlačítkem
- texty česky a lidsky ("Jak často", ne "Frekvence dávkování")

### Lékařský pohled (`/doc`, desktop)

- lékař vidí **jen léky**: žádné jméno, rok narození ani jiné údaje o pacientovi
- hlavička obsahuje jen nadpis "Lékař" a pole na kód pacienta
- může být hustší než pacientská část, lékař sedí u počítače

## Funkce

Pacient:

- [ ] vyfocení lístku a krabiček (až 10 fotek najednou), kontrola v tabulce „Sedí to?“
- [ ] ruční zadání léku
- [ ] seznam léků s možnými interakcemi
- [ ] vygenerování jednorázového kódu pro lékaře

Lékař (`/doc`):

- [ ] zadání jednorázového kódu od pacienta
- [ ] tabulka léků (lék, účinná látka, síla, dávkování, zdroj)
- [ ] interakce léků v rozbalovací liště pod tabulkou

## Lékařský pohled `/doc`

1. Lékař zadá kód pacienta a klikne "Načíst".
2. Zobrazí se tabulka léků: lék, účinná látka, síla, dávkování, zdroj (krabička / lístek / ručně).
3. Zároveň se na pozadí načtou interakce (preload), aby byly po rozkliknutí hned k dispozici.
4. Pod tabulkou je nenápadná rozbalovací lišta "Interakce (počet)". Styl splývá s tabulkou (bílé pozadí, šedý okraj, bez výrazných barev).

Stavy lišty:

- **načítání:** "Načítám interakce…"
- **načteno:** "Interakce (5)" + "Zobrazit"
- **nic nenalezeno:** "Interakce nenalezeny v naší databázi. To neznamená, že žádné nejsou."
- **chyba:** "Interakce se nepodařilo načíst" + "Zkusit znovu", kliknutí spustí nový request

Po rozkliknutí se zobrazí seznam nálezů seřazený podle závažnosti, matice dvojic (každý lék s každým), seznam nezkontrolovaných položek a zdroj dat.

Interakce kontroluje backend (`POST /api/interactions`, databáze DDInter) podle účinné látky. Onkologický režim (např. FOLFOX) se nejdřív rozloží na léčiva (`POST /api/regimens/resolve`) a ta se kontrolují proti ostatním lékům; dvojice uvnitř jednoho režimu se vynechávají. Duplicity (stejná účinná látka u dvou přípravků) dopočítává frontend. Logika je v `src/doctorCheck.js`.

## Jak se porovnávají léky

Interakce se kontrolují podle **účinné látky**, ne podle obchodního názvu (Paralen → paracetamol):

1. **Dvojice (každý s každým)** v databázi DDInter na backendu, závažnost `major` / `moderate` / `minor` / `unknown`. Z dvojic se kreslí matice.
2. **Onkologické režimy:** zkratka (FOLFOX) se rozloží na léčiva a ta se kontrolují proti ostatním lékům.
3. **Duplicity:** dva přípravky se stejnou účinnou látkou, např. Paralen + Panadol (počítá frontend).

Prázdný výsledek nikdy neznamená „žádné interakce“: vždy se ukáže zdroj a seznam toho, co se zkontrolovat nepodařilo (chybí účinná látka, látka není v DDInter, neznámá zkratka režimu).

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
  Tip: v prohlížeči zapněte mobilní zobrazení (F12 → ikonka telefonu), pacientská část je dělaná pro mobil.
- **Na mobilu:** telefon musí být na stejné Wi-Fi jako počítač. Otevřete v něm adresu `Network`.
- **Lékařský pohled:** otevřete `http://localhost:5173/doc` (na počítači, bez mobilního zobrazení).

Server zastavíte v terminálu klávesami `Ctrl + C`. Změny v kódu se v prohlížeči projeví samy.

### Produkční build

```bash
npm run build    # vytvoří složku dist/
npm run preview  # spustí zkompilovanou verzi (adresa se opět vypíše v terminálu)
```

## Testování bez AI

Focení normálně volá backend (`POST /api/analyze`, kontrakt v3): všechny fotky jdou v jednom
požadavku (pole `note` = lístek, `box` = krabička), backend léky přečte, vyhledá v katalogu
a stejný lék z lístku i krabičky spojí. Hledání „jiný lék“ volá `GET /api/catalog?q=…`.
Bez backendu (nebo na ukázku) zapněte mock v `.env.local`:

```
VITE_MOCK_API=true
```

a restartujte `npm run dev`. Mock (`src/mock/analyze.js` a `src/mock/catalog.js`) vrací
stejné léky jako mock na backendu:

- Prestarium Neo: z lístku i krabičky, v katalogu nalezen → „Sedí“.
- Warfarin Orion: lístek a krabička se liší v síle (5 mg × 3 mg) → pacient vybere, co platí.
- Paralen 500: v katalogu není → lze vyhledat, nebo nechat.
- Ibuprofen 400 a Pantomil: pacient vybere přípravek z nabídky, nebo vyhledá jiný.
- Pošlete-li jen krabičky (nebo jen lístek), vrátí jen léky z nich.
- Fotka, která má v názvu `chyba` (např. `chyba.jpg`), ukáže obrazovku „Nepodařilo se přečíst fotky“.
- Na počítači se místo fotoaparátu otevře výběr souboru – stačí vybrat jakékoli obrázky.

Data se ukládají do `localStorage` prohlížeče. Smazat je můžete tlačítkem „Odebrat“ nebo vymazáním dat stránky.

**Pacientská část nikde neukazuje interakce** – zadavatel je chce jen pro lékaře (`/doc`).

## Bez internetu (PWA)

Appku jde přidat na plochu telefonu a funguje i bez signálu (třeba v čekárně).
Zajišťuje to `vite-plugin-pwa` (Workbox, nastavení ve `vite.config.js`):

- Service worker si při první návštěvě uloží celou appku (HTML, JS, CSS, písma, ikony).
  Jakákoli adresa appky se bez internetu otevře z uložené kopie.
- Léky a profil jsou v `localStorage`, takže seznam léků, zpráva, ruční zadání,
  doplňky a onkologie fungují bez internetu.
- Fotky bez internetu se uloží do IndexedDB (`src/offline/photoQueue.js`) a odešlou se samy,
  jakmile je internet zpět a appka je otevřená. Pacient je pak zkontroluje jako obvykle.
- Hledání v katalogu bez internetu hledá jen v přípravcích, které appka už viděla
  (`src/offline/catalogCache.js`). Kód pro lékaře (`/pin`) a `/doc` potřebují internet.
- Volání `/api/...` service worker nikdy neukládá.
- Nová verze: appka ukáže „Je připravená nová verze aplikace“ a načte ji až po klepnutí.

Při vývoji (`npm run dev`) je service worker vypnutý. Vyzkoušet ho jde přes
`npm run build && npm run preview`. Na serveru musí appka běžet přes **HTTPS**
(výjimka je jen `localhost`) a soubory `sw.js` a `index.html` se nesmí dlouho cachovat
(`Cache-Control: no-cache`), jinak se nová verze neprojeví.

## Struktura

```text
src/
  main.jsx              vstupní bod
  App.jsx               obrazovky podle adresy + spodní lišta
  index.css             všechny styly
  types.js              DATOVÉ TYPY a konstanty na jednom místě (lék, dávkování, doplňky, onkologie)
  labels.js             sdílené texty a formátování
  api.js                volání backendu (+ přepnutí na mock)
  fhir.js               export do FHIR R4 (pro nemocniční systémy)
  accessibility.js      velikost písma, čtení nahlas, hlasové zadání
  context/MedsContext.jsx   seznam položek + profil pacienta (sdílené + localStorage)
  photos.js             zmenšení fotek před odesláním (backend bere max 15 MB)
  review.js             logika kontroly léků z fotek (co musí pacient vyřešit)
  doctorCheck.js        interakce pro lékaře: rozklad onko režimů + /api/interactions (DDInter)
  offline/              PWA: stav internetu, fronta fotek, záloha katalogu, lišta „bez internetu“
  mock/analyze.js       náhrada za AI čtení fotek
  mock/catalog.js       náhrada za hledání v katalogu léků
  mock/interactions.js  náhrada za databázi interakcí (pacientovi se neukazuje)
  components/           lišta, ikony, formulář léku, dávkování, kontrola léku z fotek, hledání v katalogu…
  pages/                Domů, Vyfotit, Moje léky, Zpráva, Doplňky, Onkologie, Sdílení (Pin)
  pages/Doctor.jsx      lékařský pohled /doc
```
