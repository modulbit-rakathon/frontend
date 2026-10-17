import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeGray, judge, toGray } from '../src/photoQuality.js';

const W = 400;
const H = 300;

// Pseudonáhodná čísla se stálým začátkem, aby testy dávaly pořád stejný výsledek
function random(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// "Text": řádky písmen poskládaných z tahů o tloušťce 2 px
function textImage({ bg = 230, fg = 30, area = [0, 0, W, H] } = {}) {
  const rnd = random(7);
  const gray = new Uint8Array(W * H).fill(bg);
  const [x0, y0, x1, y1] = area;
  for (let ly = y0 + 10; ly < y1 - 20; ly += 24) {
    for (let lx = x0 + 10; lx < x1 - 20; lx += 11) {
      for (let s = 0; s < 3; s++) {
        const vertical = rnd() < 0.5;
        const ox = lx + Math.floor(rnd() * 6);
        const oy = ly + Math.floor(rnd() * 10);
        for (let k = 0; k < (vertical ? 14 : 8); k++) {
          for (let t = 0; t < 2; t++) {
            const x = vertical ? ox + t : lx + k;
            const y = vertical ? ly + k : oy + t;
            gray[y * W + x] = fg;
          }
        }
      }
    }
  }
  return gray;
}

// Rozmazání: dvakrát box filtr o poloměru r (vodorovně a svisle)
function blur(gray, r) {
  let data = Float32Array.from(gray);
  for (const vertical of [false, true]) {
    const next = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let n = 0;
        for (let d = -r; d <= r; d++) {
          const xx = vertical ? x : x + d;
          const yy = vertical ? y + d : y;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          sum += data[yy * W + xx];
          n++;
        }
        next[y * W + x] = sum / n;
      }
    }
    data = next;
  }
  return Uint8Array.from(data, Math.round);
}

// Šum fotoaparátu
function noise(gray, amount) {
  const rnd = random(11);
  return Uint8Array.from(gray, (v) => Math.max(0, Math.min(255, Math.round(v + (rnd() - 0.5) * amount * 3))));
}

const check = (gray) => judge(analyzeGray(gray, W, H));

test('ostrý text na světlém pozadí projde', () => {
  assert.deepEqual(check(noise(textImage(), 2)), { dark: false, blurry: false });
});

test('lehce změkčený text (jako po zmenšení fotky) projde', () => {
  assert.deepEqual(check(noise(blur(textImage(), 1), 2)), { dark: false, blurry: false });
});

test('rozmazaný text je blurry', () => {
  assert.deepEqual(check(noise(blur(textImage(), 4), 2)), { dark: false, blurry: true });
  assert.deepEqual(check(noise(blur(textImage(), 7), 2)), { dark: false, blurry: true });
});

test('ztmavená fotka je dark (a rozmazání se k tomu nehlásí)', () => {
  const dark = Uint8Array.from(textImage(), (v) => v * 0.15);
  assert.deepEqual(check(noise(dark, 2)), { dark: true, blurry: false });
});

test('tmavý předmět na světlém stole není dark', () => {
  const gray = new Uint8Array(W * H).fill(210);
  for (let y = 40; y < 260; y++) gray.fill(25, y * W + 60, y * W + 340);
  assert.equal(check(noise(gray, 2)).dark, false);
});

test('malý ostrý text v rohu velké bílé plochy není blurry', () => {
  const gray = textImage({ bg: 235, area: [0, 0, 130, 100] });
  assert.equal(check(noise(gray, 2)).blurry, false);
});

test('prázdná plocha bez hran se nehodnotí jako rozmazaná', () => {
  const result = analyzeGray(new Uint8Array(W * H).fill(200), W, H);
  assert.equal(result.edgeWidth, null);
  assert.equal(judge(result).blurry, false);
});

test('prázdný a 1×1 vstup nespadne', () => {
  assert.deepEqual(judge(analyzeGray(new Uint8Array(0), 0, 0)), { dark: true, blurry: false });
  assert.doesNotThrow(() => analyzeGray(new Uint8Array([128]), 1, 1));
});

test('toGray počítá jas z RGBA', () => {
  assert.deepEqual([...toGray(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]))], [255, 0, 76]);
});
