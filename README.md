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

- [ ] vyfocení krabičky nebo lístku a potvrzení údajů od AI
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
  pages/Doctor.jsx      lékařský pohled /doc (plánováno)
```
