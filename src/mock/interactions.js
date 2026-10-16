// MOCK databáze lékových interakcí.
// Jen pevný seznam dvojic pro ukázku – NENÍ to lékařsky úplný seznam!
// Později ho nahradí skutečná databáze na backendu.

// severity: "high" = vysoká závažnost, "medium" = střední
export const INTERACTIONS = [
  {
    drugs: ['warfarin', 'ibuprofen'],
    severity: 'high',
    description: 'Vyšší riziko krvácení.',
  },
  {
    drugs: ['warfarin', 'aspirin'],
    severity: 'high',
    description: 'Vyšší riziko krvácení.',
  },
  {
    drugs: ['ibuprofen', 'aspirin'],
    severity: 'medium',
    description: 'Ibuprofen může oslabit účinek aspirinu na srdce.',
  },
  {
    drugs: ['warfarin', 'paracetamol'],
    severity: 'medium',
    description: 'Při dlouhodobém užívání může zesílit účinek warfarinu.',
  },
];

// Obchodní názvy léků → účinná látka (aby "Paralen" našel "paracetamol").
const ALIASES = {
  paralen: 'paracetamol',
  panadol: 'paracetamol',
  ibalgin: 'ibuprofen',
  nurofen: 'ibuprofen',
  anopyrin: 'aspirin',
  acylpyrin: 'aspirin',
};

// Převede název léku na seznam látek, které obsahuje (malými písmeny).
// Např. "Paralen 500" → ["paralen", "paracetamol"]
function substancesOf(medName) {
  const name = medName.toLowerCase();
  const result = [name];
  for (const [brand, substance] of Object.entries(ALIASES)) {
    if (name.includes(brand)) result.push(substance);
  }
  return result;
}

// Obsahuje lék danou látku?
function containsDrug(med, drug) {
  return substancesOf(med.name).some((s) => s.includes(drug));
}

/**
 * Projde všechny dvojice léků a vrátí nalezené interakce.
 * @param {Array} meds – seznam léků pacienta
 * @returns {Array<{ id, medA, medB, severity, description }>}
 */
export function findInteractions(meds) {
  const found = [];

  for (const rule of INTERACTIONS) {
    const [drugA, drugB] = rule.drugs;
    const medA = meds.find((m) => containsDrug(m, drugA));
    const medB = meds.find((m) => containsDrug(m, drugB));

    // Interakce platí jen když pacient bere OBA léky.
    if (medA && medB && medA !== medB) {
      found.push({
        id: `${drugA}+${drugB}`,
        medA,
        medB,
        severity: rule.severity,
        description: rule.description,
      });
    }
  }

  return found;
}
