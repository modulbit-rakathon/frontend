# Pillgaze Frontend

Frontend projektu **Pillgaze**: mobilní webová appka pro pacienty a jednoduchý pohled pro lékaře.

Pacient vyfotí krabičku léku nebo lístek od lékaře, AI rozpozná údaje, pacient je potvrdí a lék se přidá do seznamu. Lékař pak v prohlížeči zadá jednorázový kód od pacienta a uvidí jeho léky a možné interakce.

Stack: React + Vite, react-router-dom, obyčejné CSS (`src/index.css`).

## Napojení core a backendu

Frontend používá **`@pillgaze/core` 0.6.1**, přiložený ve
`vendor/pillgaze-core-0.6.1.tgz`. Instalace nepotřebuje přístup k soukromému npm registru.
Verzujte archiv, `package.json` i `package-lock.json` společně.

Tok je skutečně zapojený: `POST /api/analyze` → core → kontrola ve formuláři →
místní seznam → `createSharePayload` → `POST /api/share` → `/doc` →
`POST /api/share/claim`. API odpovídá
[backendovému kontraktu v2](https://github.com/modulbit-rakathon/backend/blob/73f620b8f838158290256f4cf505353bc89be4b2/docs/api.md).
Vzhled, navigace a lékařská obrazovka vycházejí z Jonášovy verze `b796b33`;
nové prvky používají stejné styly.

- SÚKL katalog (21 226 variant) se načte až při zpracování nebo úpravě léku.
  Psaní názvu nabídne kandidáty; chybný OCR název zůstává původní, dokud pacient sám nevybere variantu.
- Formulář uchovává všech šest údajů, původní OCR, zdroje, styl zápisu a historii.
  Zaškrtnutí „Zkontrolováno“ je výslovné, nikoli automatický důsledek uložení.
  Neznámý údaj může zůstat prázdný; nepředvyplňujeme obvyklé dávkování.
- „Moje léky“ umožňuje novou kontrolu a volitelné sloučení výslovně vybraných
  záznamů téhož léku. Původní podklady se zachovají, rozpory se nezamlčí.
- Celá dávka z fotky se uloží jako návrhy ještě před kontrolou prvního léku.
  Odchod ze stránky ani reload nesmaže ostatní řádky nebo počet nepřečtených položek.
  Chybějící položky musí pacient doplnit a výslovně potvrdit kontrolu původního podkladu.
- PIN nelze vytvořit s nezkontrolovanými údaji, rozpory nebo nepřečtenými položkami.
  Po síti odejde pouze povolený JSON, nikdy `_core` ani interní kandidáti.
- Záznamy jsou v `localStorage` pod `pillgaze-state-v1`; staré `pillgaze-meds`
  se zachovají a vyžadují novou kontrolu. Chyby a plné úložiště se zobrazí, neignorují.
  Data jsou místní zdravotní údaje, nikoli anonymní jen proto, že neobsahují jméno.
  Na sdíleném zařízení je po použití smažte.

Katalog není důkaz klinické zaměnitelnosti ani dostupnosti léčiva. Interakce jsou
stále **ukázková, neověřená data**; toto propojení z nich nedělá klinický nástroj.

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

- [x] vyfocení krabičky nebo lístku a kontrola údajů od API
- [x] ruční zadání a hledání v katalogu SÚKL
- [x] seznam léků, úpravy a potvrzené sloučení
- [x] vygenerování jednorázového kódu pro lékaře
- [ ] klinicky ověřená kontrola interakcí (zatím pouze ukázka)

Lékař (`/doc`):

- [x] zadání jednorázového kódu od pacienta
- [x] tabulka léků (lék, účinná látka, síla, forma, dávkování, zdroje)
- [x] ukázkové interakce v rozbalovací liště pod tabulkou

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

Po rozkliknutí se zobrazí seznam nálezů seřazený podle závažnosti, matice dvojic (každý lék s každým) a disclaimer o zdroji dat.

## Jak se porovnávají léky

Interakce se kontrolují podle **účinné látky**, ne podle obchodního názvu (Paralen → paracetamol). Probíhají tři kontroly:

1. **Dvojice (každý s každým):** všechny dvojice léků se porovnají v databázi interakcí. 7 léků = 21 dvojic. Z výsledků se kreslí matice.
2. **Skupiny se stejným účinkem:** každá látka má štítky rizik (`krvácení`, `QT`, `serotonin`, `útlum`, …). Když stejný štítek má víc léků, vznikne jeden nález se všemi léky, např. "Riziko krvácení se sčítá (4 léky)".
3. **Duplicity:** dva přípravky se stejnou účinnou látkou, např. Paralen + Coldrex.

Všechny nálezy mají stejný formát:

```json
{
  "severity": "high",
  "type": "group",
  "title": "Riziko krvácení se sčítá",
  "medications": ["warfarin", "ibuprofen", "anopyrin", "citalopram"],
  "description": "Každý zvlášť zvyšuje riziko krvácení, dohromady výrazně."
}
```

- `severity`: `high` / `medium` / `low`
- `type`: `pair` / `group` / `duplicate`
- matici si frontend skládá z nálezů typu `pair`

## Jak appku spustit

Potřebujete [Node.js](https://nodejs.org/) verze 20 nebo novější.

```bash
cd frontend
npm ci           # nainstaluje přesné verze včetně přiloženého core
cp .env.example .env.local
# Do .env.local doplňte APP_API_URL a APP_API_KEY od Vítka.
npm run dev      # spustí vývojový server
```

Klíč patří pouze do **serverové** proměnné `APP_API_KEY`, ne do JavaScriptu,
`VITE_API_KEY` nebo commitu. Vite dev/preview proxy ho přidává na serveru;
prohlížeč volá stejný origin `/api`. Starší názvy `VITE_API_URL` / `VITE_API_KEY`
proxy dočasně přijímá kvůli kompatibilitě, ale přejmenujte je na `APP_*`.
Bez konfigurace API vrátí čitelnou chybu, ne mockový úspěch.

Pro skutečné nasazení `dist/` nastavte na hostingu **same-origin serverovou proxy
`/api/*`** na Vítkův backend s hlavičkou `X-Api-Key`. Prostý statický hosting ani
nastavení `APP_API_KEY` až při buildu nestačí. Vite preview není produkční server.
Proxy musí mít odpovídající přístupová a rate-limit pravidla; samotné schování
klíče neřeší veřejný přístup k aplikaci.

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

SÚKL je oddělený lazy chunk přibližně 11 MB / 1,13 MB gzip.
Zapněte HTTP kompresi a cache verzovaných assetů. Velikostní warning při buildu
je očekávaný; lékařské `/doc` tento katalog nepotřebuje.

## Testování bez AI

```bash
npm test
npx playwright install chromium  # jednou na testovacím počítači
npm run test:e2e
```

Unit testy používají skutečný přiložený core a celý SÚKL.
Browser testy spouštějí produkční build na `127.0.0.1:52726` a nahrazují jen API
syntetickými odpověďmi. Pokrývají opravu OCR, explicitní výběr, metadata, obnovu
stavu, PIN a `/doc`, neúplné fotky, sloučení, zrušení uploadu, plné/poškozené
úložiště, souběžné úpravy, výpadek katalogu, chybné JSON a `Retry-After`.

Pro kontrolu proti **skutečným Go handlerům**, bez modelu a skutečných pacientských fotek:

```bash
# Terminál 1, ve Vítkově backendu, s odpovídající verzí Go:
MOCK_AI=true APP_API_KEY=local-test PORT=8080 \
  ALLOWED_ORIGIN=http://127.0.0.1:52726 go run ./cmd/server

# Terminál 2, v tomto frontendu:
PILLGAZE_TEST_BACKEND_URL=http://127.0.0.1:8080 \
  APP_API_KEY=local-test npm run test:backend
```

Test kontroluje skutečný multipart upload, pacientovo potvrzení, přesný share
JSON, načtení v odděleném prohlížeči lékaře a odmítnutí již použitého PINu.
Kontrola běží jen proti localhostu a nemění backend. Ověřená revize backendu:
`73f620b8f838158290256f4cf505353bc89be4b2`.

To není ověření živého OCR modelu, klinické správnosti ani produkčního nasazení.
Před demem navíc projděte skutečnou fotku z mobilu a předání lékaři proti
nasazenému API. Bez platného API klíče tento poslední krok nelze provést.

## Struktura

```text
src/
  main.jsx              vstupní bod
  App.jsx               obrazovky podle adresy + spodní lišta
  index.css             všechny styly
  labels.js             sdílené texty (štítky, závažnost)
  api.js                skutečný HTTP transport analyze/share/claim
  core.js               lazy SÚKL a příprava údajů přes core
  medicationStore.js    validace a migrace místního stavu
  context/MedsContext.jsx   seznam léků (sdílený + localStorage)
  mock/analyze.js       stará ukázka, aplikace ji nepoužívá
  mock/interactions.js  náhrada za databázi interakcí
  components/           lišta, ikony, formulář léku, boxy s interakcemi
  pages/                Domů, Vyfotit, Moje léky, Zpráva
  pages/Doctor.jsx      skutečné jednorázové načtení /doc
vendor/                 verzovaný instalační balíček core
test/                   unit a browser integrační testy
```
