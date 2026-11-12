/*
 * PRANA placeholder image generator.
 * Renders realistic-ish bead jewellery placeholders (SVG -> WebP) until real
 * product photography is available. Optional: you never need to run this once
 * you have real images in assets/img/.
 *
 * Run:  node tools/make-placeholders.cjs     (needs `sharp`)
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'img');
const ROOT = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

/* ---------- helpers ---------- */
const clamp = (v, a = 0, b = 255) => Math.max(a, Math.min(b, v));
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => '#' + c.map((v) => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(A.map((v, i) => v + (B[i] - v) * t));
};
const lighten = (h, t) => mix(h, '#ffffff', t);
const darken = (h, t) => mix(h, '#000000', t);
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const FILTERS = `
<filter id="b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
<filter id="b4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4.5"/></filter>
<filter id="b9" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="b18" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="b60" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/>
  <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 .09"/>
</filter>`;

function wrap(w, h, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${FILTERS}${defs}</defs>${body}<rect width="${w}" height="${h}" filter="url(#grain)"/></svg>`;
}

function background(w, h, bg, glow, glowAt = [0.5, 0.4]) {
  const defs = `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
  <radialGradient id="glow" cx="${glowAt[0]}" cy="${glowAt[1]}" r=".62"><stop offset="0" stop-color="${glow}" stop-opacity=".8"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>`;
  const body = `<rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#glow)"/>`;
  return { defs, body };
}

let uid = 0;
/* one glossy bead. kind: plain | band | fleck | rudra | moon | metal */
function bead(cx, cy, r, base, kind, R) {
  const id = 'g' + uid++;
  const metal = kind === 'metal';
  const hi = lighten(base, metal ? 0.78 : 0.5);
  const lo = darken(base, metal ? 0.55 : 0.5);
  const edge = darken(base, 0.74);
  let defs = `<radialGradient id="${id}" cx="36%" cy="30%" r="78%" fx="32%" fy="26%">
    <stop offset="0" stop-color="${hi}"/><stop offset=".32" stop-color="${base}"/>
    <stop offset=".78" stop-color="${lo}"/><stop offset="1" stop-color="${edge}"/></radialGradient>`;
  let body = `<ellipse cx="${cx + r * 0.14}" cy="${cy + r * 0.95}" rx="${r * 0.92}" ry="${r * 0.26}" fill="#000" opacity=".2" filter="url(#b9)"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`;

  if (kind === 'band') {
    const ang = Math.floor(R() * 180);
    defs += `<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(${ang} .5 .5)">
      <stop offset="0" stop-color="#1a0d00" stop-opacity=".4"/><stop offset=".22" stop-color="#f6c869" stop-opacity=".5"/>
      <stop offset=".48" stop-color="#1a0d00" stop-opacity=".32"/><stop offset=".74" stop-color="#f6c869" stop-opacity=".42"/>
      <stop offset="1" stop-color="#1a0d00" stop-opacity=".4"/></linearGradient>`;
    body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}b)"/>`;
  }
  if (kind === 'fleck') {
    for (let k = 0; k < 7; k++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * 0.8;
      body += `<circle cx="${cx + Math.cos(a) * d}" cy="${cy + Math.sin(a) * d}" r="${r * (0.025 + R() * 0.03)}" fill="#ecd08a" opacity=".85"/>`;
    }
    for (let k = 0; k < 3; k++) {
      const a = R() * Math.PI * 2, d = R() * r * 0.6;
      body += `<ellipse cx="${cx + Math.cos(a) * d}" cy="${cy + Math.sin(a) * d}" rx="${r * 0.3}" ry="${r * 0.06}" fill="#b9c6ea" opacity=".16" transform="rotate(${R() * 180} ${cx} ${cy})"/>`;
    }
  }
  if (kind === 'rudra') {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + R() * 0.3;
      const x1 = cx + Math.cos(a) * r * 0.2, y1 = cy + Math.sin(a) * r * 0.2;
      const x2 = cx + Math.cos(a) * r * 0.95, y2 = cy + Math.sin(a) * r * 0.95;
      const qx = cx + Math.cos(a + 0.5) * r * 0.62, qy = cy + Math.sin(a + 0.5) * r * 0.62;
      body += `<path d="M${x1},${y1} Q${qx},${qy} ${x2},${y2}" stroke="#2c1708" stroke-width="${r * 0.05}" fill="none" opacity=".55"/>`;
    }
  }
  if (kind === 'moon') {
    defs += `<radialGradient id="${id}m" cx="64%" cy="66%" r="55%"><stop offset="0" stop-color="#9fbcff" stop-opacity=".55"/><stop offset="1" stop-color="#9fbcff" stop-opacity="0"/></radialGradient>`;
    body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}m)"/>`;
  }
  // specular + bounce
  const sx = cx - r * 0.34, sy = cy - r * 0.4;
  body += `<ellipse cx="${sx}" cy="${sy}" rx="${r * 0.24}" ry="${r * 0.13}" fill="#fff" opacity=".82" transform="rotate(-35 ${sx} ${sy})" filter="url(#b2)"/>`;
  body += `<ellipse cx="${cx + r * 0.36}" cy="${cy + r * 0.52}" rx="${r * 0.3}" ry="${r * 0.13}" fill="${lighten(base, 0.6)}" opacity=".2" filter="url(#b4)"/>`;
  return { defs, body };
}

/* ---------- scenes ---------- */
function braceletScene(o) {
  const { w = 1000, h = 1250, bg, glow, seed = 1, count = 20, tilt = -14, rBase = 42,
    cxF = 0.5, cyF = 0.52, rxF = 0.31, ryF = 0.19, every = 4, spacer = '#c9a961', pick, focalIdx = -1, focal } = o;
  const R = rng(seed);
  const b = background(w, h, bg, glow);
  let defs = b.defs, body = b.body;
  const cx = w * cxF, cy = h * cyF, rx = w * rxF, ry = w * ryF, a = (tilt * Math.PI) / 180;
  body += `<ellipse cx="${cx + 14}" cy="${cy + rBase * 1.5}" rx="${rx * 1.04}" ry="${ry * 0.95}" fill="#000" opacity=".13" filter="url(#b18)" transform="rotate(${tilt} ${cx} ${cy})"/>`;
  body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#33261a" stroke-width="3.2" transform="rotate(${tilt} ${cx} ${cy})" opacity=".9"/>`;
  const items = [];
  for (let i = 0; i < count; i++) {
    const th = (i / count) * Math.PI * 2 + 0.3;
    const x0 = rx * Math.cos(th), y0 = ry * Math.sin(th);
    items.push({
      i, depth: (Math.sin(th) + 1) / 2,
      x: cx + x0 * Math.cos(a) - y0 * Math.sin(a),
      y: cy + x0 * Math.sin(a) + y0 * Math.cos(a),
    });
  }
  items.sort((p, q) => p.depth - q.depth);
  for (const it of items) {
    const isSpacer = it.i % every === every - 1;
    const isFocal = it.i === focalIdx;
    const r = rBase * (0.8 + 0.32 * it.depth) * (isSpacer ? 0.55 : isFocal ? 1.38 : 1);
    let spec;
    if (isSpacer) spec = { base: spacer, kind: 'metal' };
    else if (isFocal && focal) spec = focal;
    else spec = pick(it.i, R);
    const be = bead(it.x, it.y, r, spec.base, spec.kind || 'plain', R);
    defs += be.defs; body += be.body;
  }
  return wrap(w, h, defs, body);
}

function malaScene(o) {
  const { w = 1000, h = 1250, bg, glow, seed = 5, count = 40, rBase = 27, pick, spacer = '#c9a961', base } = o;
  const R = rng(seed);
  const b = background(w, h, bg, glow, [0.5, 0.36]);
  let defs = b.defs, body = b.body;
  const cx = w / 2, cy = h * 0.37, rx = w * 0.27, ry = w * 0.31;
  body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#2b2016" stroke-width="3" opacity=".9"/>`;
  const items = [];
  for (let i = 0; i < count; i++) {
    const th = Math.PI / 2 + ((i + 0.5) / count) * Math.PI * 2; // start at bottom
    items.push({ i, th, x: cx + rx * Math.cos(th), y: cy + ry * Math.sin(th) });
  }
  // draw top beads first so lower ones overlap naturally
  items.sort((p, q) => p.y - q.y);
  for (const it of items) {
    const r = rBase * (0.9 + 0.2 * ((it.y - (cy - ry)) / (2 * ry)));
    const spec = pick(it.i, R) || { base };
    const be = bead(it.x, it.y, r, spec.base, spec.kind || 'plain', R);
    defs += be.defs; body += be.body;
  }
  // guru bead + tassel
  const gy = cy + ry + rBase * 1.5;
  const g = bead(cx, gy, rBase * 1.5, base, 'rudra', R);
  defs += g.defs; body += g.body;
  const cap = bead(cx, gy + rBase * 1.9, rBase * 0.62, spacer, 'metal', R);
  defs += cap.defs; body += cap.body;
  const ty = gy + rBase * 2.3;
  defs += `<linearGradient id="tas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2c885"/><stop offset=".55" stop-color="#b8923f"/><stop offset="1" stop-color="#8a6a2a"/></linearGradient>`;
  body += `<path d="M${cx - 16},${ty} L${cx - 54},${ty + 250} Q${cx},${ty + 285} ${cx + 54},${ty + 250} L${cx + 16},${ty} Z" fill="url(#tas)"/>`;
  for (let k = -9; k <= 9; k++) {
    const x2 = cx + k * 5.6;
    body += `<line x1="${cx + k * 1.6}" y1="${ty}" x2="${x2}" y2="${ty + 262 + Math.abs(k) * -2}" stroke="#fff3cf" stroke-width="1.2" opacity=".22"/>`;
  }
  body += `<rect x="${cx - 30}" y="${ty + 34}" width="60" height="12" rx="6" fill="#7a5a1e" opacity=".85"/>`;
  return wrap(w, h, defs, body);
}

function macroScene(o) {
  const { w = 1000, h = 1250, bg, glow, seed = 3, r = 185, pick, spacer = '#c9a961' } = o;
  const R = rng(seed);
  const b = background(w, h, bg, glow, [0.5, 0.45]);
  let defs = b.defs, body = b.body;
  const rows = [];
  for (let row = 0; row < 5; row++) {
    const y = row * r * 1.55 - r * 0.2;
    const off = (row % 2) * r * 0.95;
    let g = '';
    for (let col = -1; col < 6; col++) {
      const x = col * r * 1.9 + off;
      const rr = r * (0.94 + R() * 0.12);
      const isSp = R() > 0.86;
      const spec = isSp ? { base: spacer, kind: 'metal' } : pick(col + row * 7, R);
      const be = bead(x, y, isSp ? rr * 0.5 : rr, spec.base, spec.kind || 'plain', R);
      defs += be.defs; g += be.body;
    }
    rows.push({ row, g });
  }
  rows.forEach(({ row, g }) => {
    const blur = row === 0 ? 'url(#b18)' : row === 4 ? 'url(#b9)' : row === 1 ? 'url(#b4)' : '';
    body += blur ? `<g filter="${blur}">${g}</g>` : `<g>${g}</g>`;
  });
  return wrap(w, h, defs, body);
}

/* ---------- palettes ---------- */
const jitter = (hex, R, a = 0.07) => (R() > 0.5 ? lighten(hex, R() * a) : darken(hex, R() * a));
const palettes = {
  jade: (i, R) => ({ base: jitter(i % 5 === 2 ? '#1f4a38' : '#86a47f', R) }),
  moon: (i, R) => ({ base: jitter('#e9e6dc', R, 0.04), kind: 'moon' }),
  tiger: (i, R) => ({ base: jitter('#9b6a2a', R, 0.1), kind: 'band' }),
  lapis: (i, R) => ({ base: jitter('#264a8f', R, 0.08), kind: 'fleck' }),
  rose: (i, R) => ({ base: jitter('#e5b4b6', R, 0.06) }),
  rudra: (i, R) => ({ base: jitter('#6a4327', R, 0.08), kind: 'rudra' }),
  forest: (i, R) => ({ base: jitter(i % 3 ? '#1f4a38' : '#86a47f', R) }),
};

const IVORY = ['#f1ebda', '#ddd3b8'];
const SAGE = ['#d3dcc6', '#aebd9f'];
const FOREST = ['#2b4c3c', '#142a20'];
const BLUSH = ['#f3e4dc', '#e2cdc0'];

const jobs = [
  // hero (light) + signature (dark)
  ['hero.webp', () => braceletScene({ bg: IVORY, glow: '#ffffff', pick: palettes.jade, seed: 11, count: 21, rBase: 46, tilt: -16, rxF: 0.3, ryF: 0.2, focalIdx: 0, focal: { base: '#e9e6dc', kind: 'moon' } })],
  ['signature.webp', () => braceletScene({ bg: FOREST, glow: '#c9a961', pick: palettes.moon, seed: 21, count: 20, rBase: 46, tilt: 12, spacer: '#d3b36b', focalIdx: 0, focal: { base: '#2c6a52' } })],
  // products
  ['product-sage-jade.webp', () => braceletScene({ bg: SAGE, glow: '#f4f1e2', pick: palettes.jade, seed: 31, tilt: -12 })],
  ['product-moonstone.webp', () => braceletScene({ bg: IVORY, glow: '#ffffff', pick: palettes.moon, seed: 32, tilt: 10, spacer: '#d3b36b' })],
  ['product-tigers-eye.webp', () => braceletScene({ bg: FOREST, glow: '#b8985a', pick: palettes.tiger, seed: 33, tilt: -8, spacer: '#d9bb78' })],
  ['product-lapis.webp', () => braceletScene({ bg: IVORY, glow: '#fff', pick: palettes.lapis, seed: 34, tilt: 14 })],
  ['product-rose-quartz.webp', () => braceletScene({ bg: BLUSH, glow: '#fff7f2', pick: palettes.rose, seed: 35, tilt: -10, spacer: '#c9a961' })],
  ['product-rudraksha-mala.webp', () => malaScene({ bg: SAGE, glow: '#f4f1e2', pick: palettes.rudra, seed: 36, base: '#6a4327' })],
  // collection macros
  ['collection-calm.webp', () => macroScene({ bg: FOREST, glow: '#86a47f', pick: palettes.jade, seed: 41 })],
  ['collection-courage.webp', () => macroScene({ bg: ['#3a2812', '#1a1007'], glow: '#c9893a', pick: palettes.tiger, seed: 42 })],
  ['collection-clarity.webp', () => macroScene({ bg: ['#1c2a4a', '#0d1426'], glow: '#6f8fd6', pick: palettes.lapis, seed: 43 })],
  ['collection-devotion.webp', () => macroScene({ bg: ['#3b2a1a', '#1c130b'], glow: '#c9a961', pick: palettes.rudra, seed: 44 })],
];

/* hand-plate placeholder: tonal "natural light + leaf shadow" backdrop, NOT a hand */
function platePlaceholder() {
  const w = 2400, h = 1500;
  const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6dcc3"/><stop offset=".5" stop-color="#b3c0a3"/><stop offset="1" stop-color="#4a6a56"/></linearGradient>
  <radialGradient id="sun" cx=".28" cy=".22" r=".6"><stop offset="0" stop-color="#fff6e0" stop-opacity=".95"/><stop offset="1" stop-color="#fff6e0" stop-opacity="0"/></radialGradient>`;
  let body = `<rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#sun)"/>`;
  const R = rng(9);
  body += `<g filter="url(#b60)" opacity=".5">`;
  for (let i = 0; i < 9; i++) {
    body += `<ellipse cx="${1200 + R() * 1200}" cy="${R() * 1400}" rx="${160 + R() * 240}" ry="${60 + R() * 90}" fill="#1f3a2e" transform="rotate(${-40 + R() * 80} 1800 700)"/>`;
  }
  body += `</g>`;
  return wrap(w, h, defs, body);
}

(async () => {
  for (const [name, fn] of jobs) {
    const svg = fn();
    await sharp(Buffer.from(svg)).webp({ quality: 84 }).toFile(path.join(OUT, name));
    console.log('wrote', name);
  }
  await sharp(Buffer.from(platePlaceholder())).jpeg({ quality: 82 }).toFile(path.join(ROOT, 'hand-plate.jpg'));
  console.log('wrote hand-plate.jpg');
})().catch((e) => { console.error(e); process.exit(1); });
