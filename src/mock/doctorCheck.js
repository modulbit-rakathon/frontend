// MOCK kontrola interakcí pro LÉKAŘSKÝ pohled (/doc).
// Backend interakce zatím nemá (viz backend docs/api.md, sekce 5), proto je
// počítáme tady na frontendu z malé ukázkové tabulky.
// POZOR: data jsou jen ilustrační, NEJSOU lékařsky ověřená!
//
// Výsledek má dvě části:
//   findings – seznam nálezů (karty vlevo): skupiny, dvojice, duplicity
//   matrix   – tabulka dvojic N×N (vpravo): každá buňka je
//              'high' | 'medium' | 'same' | 'none' | 'self'

// ---------------------------------------------------------------
// 1) Účinné látky a podle čeho je v textu poznáme
//    (díváme se do účinné látky i do názvu léku, malými písmeny)
// ---------------------------------------------------------------
const SUBSTANCES = {
  warfarin: ['warfarin'],
  ibuprofen: ['ibuprofen', 'ibalgin', 'nurofen'],
  aspirin: ['acetylsalicyl', 'aspirin', 'anopyrin', 'acylpyrin'],
  citalopram: ['citalopram'],
  ondansetron: ['ondansetron'],
  paracetamol: ['paracetamol', 'paralen', 'panadol', 'coldrex'],
};

// ---------------------------------------------------------------
// 2) Interakce dvojic látek
// ---------------------------------------------------------------
const PAIRS = [
  { drugs: ['warfarin', 'ibuprofen'], severity: 'high', description: 'NSAID zvyšuje účinek warfarinu a riziko krvácení.' },
  { drugs: ['warfarin', 'aspirin'], severity: 'high', description: 'Kombinace antikoagulancia a antiagregancia.' },
  { drugs: ['warfarin', 'citalopram'], severity: 'medium', description: 'SSRI zvyšují riziko krvácení.' },
  { drugs: ['ibuprofen', 'aspirin'], severity: 'medium', description: 'Ibuprofen může oslabit antiagregační účinek aspirinu.' },
  { drugs: ['ibuprofen', 'citalopram'], severity: 'medium', description: 'SSRI + NSAID: vyšší riziko krvácení do GIT.' },
  { drugs: ['aspirin', 'citalopram'], severity: 'medium', description: 'SSRI + antiagregans: vyšší riziko krvácení.' },
  { drugs: ['citalopram', 'ondansetron'], severity: 'medium', description: 'Obě látky prodlužují QT interval.' },
];

// ---------------------------------------------------------------
// 3) Skupiny – látky se stejným rizikem, které se sčítá
// ---------------------------------------------------------------
const GROUPS = [
  {
    drugs: ['warfarin', 'ibuprofen', 'aspirin', 'citalopram'],
    severity: 'high',
    title: 'Riziko krvácení se sčítá',
    description: 'Každý zvlášť zvyšuje riziko krvácení, dohromady výrazně.',
  },
  {
    drugs: ['citalopram', 'ondansetron'],
    severity: 'medium',
    title: 'Prodloužení QT intervalu',
    description: 'Zvážit EKG.',
  },
];

// Pořadí závažnosti – čím větší číslo, tím horší.
const RANK = { none: 0, same: 1, medium: 2, high: 3 };

// Které látky z tabulky lék obsahuje? Např. Coldrex → ['paracetamol']
function substancesOf(med) {
  const text = `${med.active_substance ?? ''} ${med.name}`.toLowerCase();
  return Object.keys(SUBSTANCES).filter((key) =>
    SUBSTANCES[key].some((word) => text.includes(word))
  );
}

// Čeština: 2–4 léky, 5+ léků
function lekyLabel(count) {
  return count >= 2 && count <= 4 ? `${count} léky` : `${count} léků`;
}

/**
 * Zkontroluje seznam léků.
 * @param {Array} meds – léky pacienta (z backendu)
 * @returns {{ findings: Array, matrix: string[][] }}
 */
export function checkMeds(meds) {
  // Pro každý lék si předem spočítáme jeho látky.
  const subs = meds.map(substancesOf);

  // Pomocná funkce: indexy léků, které obsahují danou látku
  const medsWith = (drug) => meds.map((_, i) => i).filter((i) => subs[i].includes(drug));

  // --- Matice: začneme samými 'none', na diagonále 'self' ---
  const matrix = meds.map((_, i) => meds.map((_, j) => (i === j ? 'self' : 'none')));

  // Zapíše do buňky (obou symetrických) jen když je to horší než to, co tam už je.
  function mark(i, j, value) {
    if (i === j) return;
    if (RANK[value] > RANK[matrix[i][j]]) {
      matrix[i][j] = value;
      matrix[j][i] = value;
    }
  }

  const findings = [];

  // --- Skupiny (aspoň 2 léky ze skupiny) ---
  for (const group of GROUPS) {
    const members = [...new Set(group.drugs.flatMap(medsWith))];
    if (members.length >= 2) {
      findings.push({
        id: `group-${group.title}`,
        type: 'group',
        severity: group.severity,
        tag: `Skupina · ${lekyLabel(members.length)}`,
        title: group.title,
        meds: members.map((i) => meds[i].name),
        description: group.description,
        medIndexes: members,
      });
    }
  }

  // --- Dvojice ---
  for (const pair of PAIRS) {
    const [a, b] = pair.drugs;
    for (const i of medsWith(a)) {
      for (const j of medsWith(b)) {
        if (i === j) continue;
        mark(i, j, pair.severity);

        // Vysoké riziko vypíšeme vždy zvlášť. Střední jen tehdy,
        // když ho už nepokrývá nějaká skupina (ať se seznam neopakuje).
        const coveredByGroup = findings.some(
          (f) => f.type === 'group' && f.medIndexes.includes(i) && f.medIndexes.includes(j)
        );
        if (pair.severity === 'high' || !coveredByGroup) {
          findings.push({
            id: `pair-${i}-${j}-${a}-${b}`,
            type: 'pair',
            severity: pair.severity,
            tag: 'Dvojice',
            title: `${meds[i].name} + ${meds[j].name}`,
            meds: [],
            description: pair.description,
          });
        }
      }
    }
  }

  // --- Duplicity: stejná látka ve více lécích ---
  for (const drug of Object.keys(SUBSTANCES)) {
    const members = medsWith(drug);
    if (members.length >= 2) {
      for (const i of members) for (const j of members) mark(i, j, 'same');
      findings.push({
        id: `dup-${drug}`,
        type: 'duplicate',
        severity: 'medium',
        tag: 'Duplicita',
        title: `${drug[0].toUpperCase()}${drug.slice(1)} ${members.length}×`,
        meds: members.map((i) => meds[i].name),
        description: 'Stejná účinná látka, hlídat celkovou denní dávku.',
      });
    }
  }

  // Nejzávažnější nálezy nahoru (sort zachová pořadí u stejné závažnosti).
  findings.sort((x, y) => RANK[y.severity] - RANK[x.severity]);

  return { findings, matrix };
}
