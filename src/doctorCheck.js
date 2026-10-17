// Kontrola interakcí pro LÉKAŘSKÝ pohled (/doc) – volá backend.
//
// Postup:
//   1. Onkologické režimy (kind = regimen, např. "FOLFOX") rozložíme na léčiva
//      (POST /api/regimens/resolve). Bez toho by se chemoterapie vůbec nekontrolovala.
//   2. Každé léčivo z režimu pošleme jako samostatný "pomocný" lék s účinnou látkou
//      a s id "<id režimu>#<pořadí>", ať víme, ke kterému řádku tabulky patří.
//   3. Vše pošleme na POST /api/interactions (databáze DDInter).
//   4. Nálezy převedeme zpátky na řádky tabulky (pomocné léky → jejich režim)
//      a dopočítáme duplicity (dva přípravky se stejnou účinnou látkou).
//
// Prázdný výsledek NIKDY neznamená "žádné interakce" – UI vždy ukazuje zdroj,
// poznámku backendu a co se zkontrolovat nepodařilo.
import { checkInteractions, resolveRegimen } from './api.js';

// Pořadí závažnosti – čím větší číslo, tím horší.
export const LEVEL_RANK = { none: 0, same: 1, unknown: 2, minor: 3, moderate: 4, major: 5 };

// Pole, která backend u léku přijme (neznámé pole = 400)
const ALLOWED_FIELDS = ['id', 'kind', 'name', 'active_substance', 'strength', 'form', 'frequency', 'amount', 'source', 'sources', 'note_style'];

// Oddělovač v id pomocného léku z režimu: "med_03#1"
const PART = '#';

// Lék jen s poli, která backend přijme (používá i stažení PDF v Doctor.jsx)
export function pickShared(med) {
  return Object.fromEntries(ALLOWED_FIELDS.filter((k) => med[k] !== undefined).map((k) => [k, med[k]]));
}

// id pomocného léku → id řádku v tabulce
function ownerId(id) {
  return id.split(PART)[0];
}

// Účinná látka pro porovnání duplicit: malá písmena, bez solí v závorce
function substanceKey(med) {
  return med.active_substance?.toLowerCase().replace(/\(.*\)/, '').trim() || null;
}

/**
 * Rozloží všechny režimy v seznamu. Režim, který se rozložit nepodařilo, se nekontroluje:
 *   null             = neznámá zkratka (backend ji v tabulce režimů nemá) → "neověřeno"
 *   { failed: true } = chyba spojení / serveru → lékař to musí vědět, zkusí kontrolu znovu
 * @returns {Promise<Record<string, { drugs: string[], variants: Array, source: object, note: string } | { failed: true } | null>>}
 */
async function resolveRegimens(meds) {
  const regimens = meds.filter((m) => m.kind === 'regimen');
  const entries = await Promise.all(
    regimens.map(async (med) => {
      try {
        const data = await resolveRegimen(med.name);
        // Víc variant (např. "EC") = zkratka není jednoznačná → kontrolujeme všechna léčiva
        const drugs = [...new Set(data.regimens.flatMap((r) => r.drugs))];
        return [med.id, { drugs, variants: data.regimens, source: data.source, note: data.note }];
      } catch (err) {
        // not_found = zkratku neznáme; invalid_input = prázdná / moc dlouhá zkratka
        if (err.message === 'not_found' || err.message === 'invalid_input') return [med.id, null];
        return [med.id, { failed: true }];
      }
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Zkontroluje seznam léků pacienta.
 * @param {Array} meds – léky z claimShare
 * @returns {Promise<{
 *   findings: Array<{ id: string, a: string, b: string, level: string,
 *     pairs: Array<{ substances: string, level: string, description?: string, management?: string, url?: string }> }>,
 *   cells: Record<string, string>,
 *   regimens: Record<string, object|null>,
 *   unchecked: Array<{ id: string, name: string, reason: string, substances?: string[] }>,
 *   checkedAgainst: object, note: string,
 *   duplicates: Array<{ id: string, a: string, b: string, substance: string }>
 * }>}
 */
export async function checkMeds(meds) {
  const regimens = await resolveRegimens(meds);

  // Seznam pro backend: léky bez změny, režimy nahradí jejich léčiva
  const toCheck = meds.flatMap((med) => {
    if (med.kind !== 'regimen') return [pickShared(med)];
    return (regimens[med.id]?.drugs ?? []).map((drug, i) => ({
      id: `${med.id}${PART}${i}`,
      kind: 'drug',
      name: drug,
      active_substance: drug,
      source: med.source,
      sources: med.sources ?? [med.source],
    }));
  });

  // Prázdný seznam backend odmítne (400) – nastane, když jsou v seznamu jen neznámé režimy
  const data = toCheck.length > 0
    ? await checkInteractions(toCheck)
    : { pairs: [], unchecked: [], checked_against: null, note: '' };

  // Nálezy podle dvojice řádků tabulky. Dvojice uvnitř jednoho režimu
  // (např. oxaliplatina × fluorouracil) je záměrná kombinace → vynecháme.
  // Víc nálezů mezi stejnými dvěma řádky (režim × lék) spojíme do jedné karty
  // se závažností té nejhorší.
  const byRows = {};
  const cells = {};
  for (const pair of data.pairs) {
    const a = ownerId(pair.a);
    const b = ownerId(pair.b);
    if (a === b) continue;
    const key = [a, b].sort().join('|');
    const finding = (byRows[key] ??= { id: key, a, b, level: pair.level, pairs: [] });
    // Popis a doporučení (anglicky z webu DDInter) má backend jen u části dvojic
    finding.pairs.push({
      substances: `${pair.substance_a} × ${pair.substance_b}`,
      level: pair.level,
      description: pair.description,
      management: pair.management,
      url: pair.url,
    });
    if (LEVEL_RANK[pair.level] > LEVEL_RANK[finding.level]) finding.level = pair.level;
    cells[`${a}|${b}`] = finding.level;
    cells[`${b}|${a}`] = finding.level;
  }
  const findings = Object.values(byRows).sort((x, y) => LEVEL_RANK[y.level] - LEVEL_RANK[x.level]);
  findings.forEach((f) => f.pairs.sort((x, y) => LEVEL_RANK[y.level] - LEVEL_RANK[x.level]));

  // Duplicity: dva různé přípravky se stejnou účinnou látkou (DDInter je nehlásí)
  const duplicates = [];
  meds.forEach((m1, i) => {
    meds.slice(i + 1).forEach((m2) => {
      const key = substanceKey(m1);
      if (!key || key !== substanceKey(m2)) return;
      duplicates.push({ id: `${m1.id}=${m2.id}`, a: m1.id, b: m2.id, substance: m1.active_substance });
      if (!cells[`${m1.id}|${m2.id}`]) {
        cells[`${m1.id}|${m2.id}`] = 'same';
        cells[`${m2.id}|${m1.id}`] = 'same';
      }
    });
  });

  // Nezkontrolované položky – pomocné léky z režimu sloučíme pod jejich režim
  const unchecked = [];
  for (const item of data.unchecked) {
    const id = ownerId(item.id);
    const existing = unchecked.find((u) => u.id === id);
    const substances = item.substances ?? (item.id.includes(PART) ? [item.name] : undefined);
    if (existing) {
      existing.substances = [...(existing.substances ?? []), ...(substances ?? [])];
      continue;
    }
    const owner = meds.find((m) => m.id === id);
    unchecked.push({ id, name: owner?.name ?? item.name, reason: id === item.id ? item.reason : 'partly_in_source', substances });
  }
  // Režim, který jsme nerozložili, backend vůbec neviděl → přidáme ho ručně
  for (const med of meds) {
    if (med.kind !== 'regimen') continue;
    if (!regimens[med.id]) unchecked.push({ id: med.id, name: med.name, reason: 'unknown_regimen' });
    else if (regimens[med.id].failed) unchecked.push({ id: med.id, name: med.name, reason: 'resolve_failed' });
  }

  return { findings, cells, regimens, unchecked, checkedAgainst: data.checked_against, note: data.note, duplicates };
}
