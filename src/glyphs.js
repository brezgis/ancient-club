// Hieroglyph typesetting: a tiny Manuel-de-Codage-style layout engine.
//
// Syntax (per line):  groups separated by spaces.
//   A:B   stack B under A        A*B   put B beside A
//   (..)  grouping               <  >  open / close a cartouche
//   Codes are Gardiner sign codes: D4, O4, G43, Aa15, M17A ...
//
// Signs keep their natural size from the font (a Z1 stroke stays small, an N35
// water-line stays flat) and each group is only shrunk if it overflows its quadrat.

import GARDINER from './gardiner.js';

export const HIERO_FONT = '"Noto Sans Egyptian Hieroglyphs"';
const MEASURE_PX = 200;
const measureCache = new Map();

export function signChar(code) {
  const cp = GARDINER[code];
  if (!cp) throw new Error(`Unknown Gardiner code: ${code}`);
  return String.fromCodePoint(cp);
}

// Ink bounding box of a sign, in em units, relative to the text origin (read from the font's outlines).
const measureCtx = document.createElement('canvas').getContext('2d');
function measureSign(code) {
  let m = measureCache.get(code);
  if (m) return m;
  measureCtx.font = `${MEASURE_PX}px ${HIERO_FONT}`;
  const t = measureCtx.measureText(signChar(code));
  const w = t.actualBoundingBoxLeft + t.actualBoundingBoxRight, h = t.actualBoundingBoxAscent + t.actualBoundingBoxDescent;
  m = w > 0 && h > 0
    ? { ox: -t.actualBoundingBoxLeft / MEASURE_PX, oy: -t.actualBoundingBoxAscent / MEASURE_PX, w: w / MEASURE_PX, h: h / MEASURE_PX }
    : { ox: 0, oy: 0, w: 0.3, h: 0.3 };
  measureCache.set(code, m);
  return m;
}

// --- parser -----------------------------------------------------------------
function parseGroup(src) {
  let i = 0;
  const peek = () => src[i];
  function factor() {
    if (peek() === '(') { i++; const e = expr(); i++; return e; }
    let s = '';
    while (i < src.length && /[A-Za-z0-9]/.test(src[i])) s += src[i++];
    if (!s) throw new Error(`Bad hieroglyph group "${src}"`);
    return { type: 'sign', code: s };
  }
  function term() {
    const items = [factor()];
    while (peek() === '*') { i++; items.push(factor()); }
    return items.length === 1 ? items[0] : { type: 'row', items };
  }
  function expr() {
    const items = [term()];
    while (peek() === ':') { i++; items.push(term()); }
    return items.length === 1 ? items[0] : { type: 'col', items };
  }
  return expr();
}

const GAP = 0.06;

// Returns {w, h, draw(ctx, x, y, s)} where (x, y) is the top-left and s the em size in px.
function layout(node) {
  if (node.type === 'sign') {
    const m = measureSign(node.code);
    const ch = signChar(node.code);
    return {
      w: m.w, h: m.h,
      draw(ctx, x, y, s) {
        ctx.font = `${s}px ${HIERO_FONT}`;
        ctx.fillText(ch, x - m.ox * s, y - m.oy * s);
      },
    };
  }
  const kids = node.items.map(layout);
  if (node.type === 'row') {
    const w = kids.reduce((a, k) => a + k.w, 0) + GAP * (kids.length - 1);
    const h = Math.max(...kids.map(k => k.h));
    return {
      w, h,
      draw(ctx, x, y, s) {
        let cx = x;
        for (const k of kids) { k.draw(ctx, cx, y + (h - k.h) * s / 2, s); cx += (k.w + GAP) * s; }
      },
    };
  }
  const w = Math.max(...kids.map(k => k.w));
  const h = kids.reduce((a, k) => a + k.h, 0) + GAP * (kids.length - 1);
  return {
    w, h,
    draw(ctx, x, y, s) {
      let cy = y;
      for (const k of kids) { k.draw(ctx, x + (w - k.w) * s / 2, cy, s); cy += (k.h + GAP) * s; }
    },
  };
}

function scaled(box, maxW, maxH) {
  const f = Math.min(1, maxW / box.w, maxH / box.h);
  return {
    w: box.w * f, h: box.h * f,
    draw(ctx, x, y, s) { box.draw(ctx, x, y, s * f); },
  };
}

// Typeset a line of hieroglyphs. Returns {width, height, draw(ctx, x, y, em)} in em units.
export function typesetHieroglyphs(mdc) {
  const tokens = mdc.trim().split(/\s+/);
  const items = [];
  for (const t of tokens) {
    if (t === '<' || t === '>') { items.push({ cartouche: t }); continue; }
    items.push({ box: scaled(layout(parseGroup(t)), 1.1, 1.0) });
  }
  const PAD = 0.14;
  let width = 0;
  const placed = [];
  let cartStart = null;
  for (const it of items) {
    if (it.cartouche === '<') { cartStart = width; width += 0.22; continue; }
    if (it.cartouche === '>') {
      width += 0.12;
      placed.push({ cartouche: [cartStart, width] });
      width += 0.3 + PAD;
      cartStart = null;
      continue;
    }
    placed.push({ x: width, box: it.box });
    width += it.box.w + PAD;
  }
  width -= PAD;
  const height = 1.0;
  return {
    width, height,
    draw(ctx, x0, y0, em) {
      for (const p of placed) {
        if (p.cartouche) {
          const [a, b] = p.cartouche;
          const top = y0 - 0.14 * em, bot = y0 + 1.14 * em, r = 0.62 * em;
          ctx.save();
          ctx.lineWidth = 0.07 * em;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.beginPath();
          ctx.roundRect(x0 + a * em, top, (b - a) * em, bot - top, r);
          ctx.stroke();
          // the knotted rope that closes a cartouche
          ctx.fillRect(x0 + (b + 0.06) * em, top, 0.1 * em, bot - top);
          ctx.restore();
          continue;
        }
        const { box } = p;
        box.draw(ctx, x0 + p.x * em, y0 + (height - box.h) * em / 2, em);
      }
    },
  };
}

export async function loadFonts() {
  const fonts = [
    ['Noto Sans Egyptian Hieroglyphs', 'vendor/fonts/noto-sans-egyptian-hieroglyphs-egyptian-hieroglyphs-400-normal.woff2', {}],
    ['EB Garamond', 'vendor/fonts/eb-garamond-latin-400-normal.woff2', { unicodeRange: 'U+0000-00FF,U+2000-206F' }],
    ['EB Garamond', 'vendor/fonts/eb-garamond-latin-ext-400-normal.woff2', { unicodeRange: 'U+0100-02AF,U+1E00-1EFF,U+A720-A7FF,U+0300-036F' }],
    ['EB Garamond', 'vendor/fonts/eb-garamond-greek-400-normal.woff2', { unicodeRange: 'U+0370-03FF' }],
    ['EB Garamond', 'vendor/fonts/eb-garamond-greek-ext-400-normal.woff2', { unicodeRange: 'U+1F00-1FFF' }],
    ['EB Garamond', 'vendor/fonts/eb-garamond-latin-400-italic.woff2', { style: 'italic', unicodeRange: 'U+0000-00FF,U+2000-206F' }],
    ['EB Garamond', 'vendor/fonts/eb-garamond-greek-400-italic.woff2', { style: 'italic', unicodeRange: 'U+0370-03FF' }],
    ['EB Garamond', 'vendor/fonts/eb-garamond-greek-ext-400-italic.woff2', { style: 'italic', unicodeRange: 'U+1F00-1FFF' }],
    ['EB Garamond', 'vendor/fonts/eb-garamond-latin-600-normal.woff2', { weight: '600', unicodeRange: 'U+0000-00FF,U+2000-206F' }],
  ];
  await Promise.allSettled(fonts.map(async ([family, url, desc]) => {
    const f = new FontFace(family, `url(${url})`, desc);
    await f.load();
    document.fonts.add(f);
  }));
}
