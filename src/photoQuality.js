// Orientační kontrola kvality fotky: není moc tmavá? není rozmazaná?
//
// Běží v prohlížeči nad malou šedotónovou kopií fotky (viz photos.js), bez AI
// a bez odesílání kamkoli. Je to jen odhad – pacient může fotku vždycky poslat.
// Soubor nesahá na DOM, takže jde testovat v Node (test/photoQuality.test.js).

// Fotka je tmavá, když je tmavá v průměru A ZÁROVEŇ i její nejsvětlejší místa
// jsou šedivá. Tmavá krabička na světlém stole tak projde.
export const DARK_MEAN = 55;
export const DARK_P95 = 120;

// Ostrost měříme šířkou hran (v pixelech kopie o delší straně ANALYSIS_SIDE):
// ostré písmo má přechod z bílé do černé na 2–3 px, rozmazané na 4,5 a víc.
// Od této průměrné šířky varujeme. Nastaveno spíš opatrně, aby normálně
// čitelné fotky varování nedostávaly (lehké změkčení vyjde kolem 3,5).
export const BLUR_WIDTH = 4.5;
// Velikost kopie, nad kterou kontrolu děláme (viz photos.js)
export const ANALYSIS_SIDE = 800;

// Hrana = rozdíl jasu sousedů aspoň tolik (po vyhlazení šumu)
const EDGE_MIN = 10;
// Šířku hrany měříme nejvýš do této vzdálenosti
const MAX_WIDTH = 30;
// Rozhoduje nejostřejších 40 % hran = text a ostré okraje. Rozostřené pozadí
// (stůl za krabičkou) tak výsledek nestáhne.
const SHARPEST = 0.4;
// Méně hran = na fotce není nic, podle čeho by šlo ostrost posoudit
const MIN_EDGES = 50;

/**
 * Převede RGBA pixely (z canvasu, ImageData.data) na jas 0–255.
 * @param {Uint8ClampedArray|Uint8Array} rgba
 * @returns {Uint8Array}
 */
export function toGray(rgba) {
  const gray = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    // Koeficienty Rec. 601: oko je nejcitlivější na zelenou
    gray[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
  }
  return gray;
}

/**
 * Změří jas a ostrost šedotónové fotky.
 * @returns {{ mean: number, p95: number, edgeWidth: number|null }}
 *   edgeWidth je null, když na fotce nejsou hrany (nejde posoudit).
 */
export function analyzeGray(gray, width, height) {
  const count = width * height;
  if (count === 0) return { mean: 0, p95: 0, edgeWidth: null };

  // Jas: průměr a 95. percentil z histogramu
  const histogram = new Uint32Array(256);
  let sum = 0;
  for (let i = 0; i < count; i++) {
    histogram[gray[i]]++;
    sum += gray[i];
  }
  let p95 = 255;
  for (let v = 0, seen = 0; v < 256; v++) {
    seen += histogram[v];
    if (seen >= count * 0.95) {
      p95 = v;
      break;
    }
  }

  return { mean: sum / count, p95, edgeWidth: measureEdgeWidth(gray, width, height) };
}

// Průměrná šířka nejostřejších hran. Projdeme každý druhý řádek a sloupec,
// najdeme v nich hrany a od každé jdeme na obě strany, dokud jas pořád stoupá
// (nebo klesá). Rozmazaná hrana je široká, ostrá úzká. Na rozdíl od měření
// "jemných detailů" to nezkreslí šum fotoaparátu ani velikost písma.
function measureEdgeWidth(gray, width, height) {
  if (width < 5 || height < 5) return null;
  const smooth = smooth121(gray, width, height);
  const widths = new Uint32Array(MAX_WIDTH * 2 + 1); // histogram šířek

  for (let y = 1; y < height - 1; y += 2) collectEdges(smooth, y * width, 1, width, widths);
  for (let x = 1; x < width - 1; x += 2) collectEdges(smooth, x, width, height, widths);

  let edges = 0;
  for (const n of widths) edges += n;
  if (edges < MIN_EDGES) return null;

  // Průměr nejužších SHARPEST hran
  let need = Math.ceil(edges * SHARPEST);
  let total = 0;
  for (let w = 0; w < widths.length && need > 0; w++) {
    const take = Math.min(widths[w], need);
    total += take * w;
    need -= take;
  }
  return total / Math.ceil(edges * SHARPEST);
}

// Jedna čára (řádek nebo sloupec): data[start + i * step] pro i = 0..len-1
function collectEdges(data, start, step, len, widths) {
  const at = (i) => data[start + i * step];
  for (let i = 2; i < len - 2; i++) {
    const diff = at(i + 1) - at(i - 1);
    const strength = Math.abs(diff);
    if (strength < EDGE_MIN) continue;
    // Bereme jen vrchol hrany (nejstrmější místo), ne každý pixel přechodu
    if (strength < Math.abs(at(i + 2) - at(i)) || strength <= Math.abs(at(i) - at(i - 2))) continue;

    const sign = diff > 0 ? 1 : -1;
    let left = i;
    while (left > 0 && i - left < MAX_WIDTH && sign * (at(left) - at(left - 1)) > 0) left--;
    let right = i;
    while (right < len - 1 && right - i < MAX_WIDTH && sign * (at(right + 1) - at(right)) > 0) right++;
    widths[right - left]++;
  }
}

// Lehké vyhlazení (jádro 1-2-1 vodorovně i svisle), aby šum nezastavil
// měření šířky hrany uprostřed přechodu.
function smooth121(gray, width, height) {
  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    tmp[row] = gray[row];
    tmp[row + width - 1] = gray[row + width - 1];
    for (let x = 1; x < width - 1; x++) {
      tmp[row + x] = (gray[row + x - 1] + 2 * gray[row + x] + gray[row + x + 1]) / 4;
    }
  }
  out.set(tmp.subarray(0, width));
  out.set(tmp.subarray((height - 1) * width), (height - 1) * width);
  for (let i = width; i < (height - 1) * width; i++) {
    out[i] = (tmp[i - width] + 2 * tmp[i] + tmp[i + width]) / 4;
  }
  return out;
}

/**
 * Z naměřených hodnot rozhodne, na co pacienta upozornit.
 * U tmavé fotky rozmazání nehlásíme – tma sama sníží kontrast a jedno upozornění stačí.
 * @returns {{ dark: boolean, blurry: boolean }}
 */
export function judge({ mean, p95, edgeWidth }) {
  const dark = mean < DARK_MEAN && p95 < DARK_P95;
  const blurry = !dark && edgeWidth !== null && edgeWidth >= BLUR_WIDTH;
  return { dark, blurry };
}
