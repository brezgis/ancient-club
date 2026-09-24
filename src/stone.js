// Procedural stone surfaces (tileable value noise) and height→normal helpers.
import * as THREE from 'three';

function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Periodic value noise so textures tile seamlessly.
function makeNoise(period, seed) {
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const p = (a) => ((a % period) + period) % period;
    const a = hash(p(xi), p(yi), seed), b = hash(p(xi + 1), p(yi), seed);
    const c = hash(p(xi), p(yi + 1), seed), d = hash(p(xi + 1), p(yi + 1), seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(noises, x, y, size) {
  let v = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < noises.length; o++) {
    const f = noises[o].period / size;
    v += noises[o].fn(x * f, y * f) * amp;
    tot += amp; amp *= 0.5;
  }
  return v / tot;
}

export const STONES = {
  granodiorite: { base: [58, 60, 64], vary: [34, 34, 36], speck: 0.22, speckColor: [150, 140, 138], vein: [120, 96, 92], rough: 0.62 },
  limestone: { base: [214, 198, 168], vary: [26, 26, 24], speck: 0.03, speckColor: [180, 160, 130], vein: null, rough: 0.9 },
  sandstone: { base: [196, 150, 104], vary: [36, 30, 26], speck: 0.05, speckColor: [150, 110, 80], vein: [210, 170, 125], rough: 0.95 },
  marble: { base: [226, 222, 214], vary: [14, 14, 14], speck: 0.0, speckColor: [0, 0, 0], vein: [150, 146, 150], rough: 0.4 },
  plaster: { base: [204, 200, 192], vary: [10, 10, 10], speck: 0.01, speckColor: [200, 200, 200], vein: null, rough: 0.8 },
  gold: { base: [212, 160, 60], vary: [30, 24, 10], speck: 0.0, speckColor: [0, 0, 0], vein: null, rough: 0.3, metal: 1 },
  basalt: { base: [30, 29, 30], vary: [16, 16, 16], speck: 0.12, speckColor: [70, 70, 72], vein: null, rough: 0.55 },
};

const tileCache = new Map();

// A tileable stone tile canvas.
export function stoneTile(kind, size = 512, seed = 1) {
  const key = `${kind}:${size}:${seed}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const s = STONES[kind];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const noises = [4, 8, 16, 32, 64, 128].map((p, i) => ({ period: p, fn: makeNoise(p, seed * 17 + i) }));
  const veinNoise = [3, 6, 12, 24].map((p, i) => ({ period: p, fn: makeNoise(p, seed * 31 + i + 99) }));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(noises, x, y, size);
      let r = s.base[0] + (n - 0.5) * 2 * s.vary[0];
      let g = s.base[1] + (n - 0.5) * 2 * s.vary[1];
      let b = s.base[2] + (n - 0.5) * 2 * s.vary[2];
      if (s.vein) {
        const vn = fbm(veinNoise, x, y, size);
        const band = Math.abs(Math.sin((x / size + vn * 1.6) * Math.PI * 3));
        const vv = Math.pow(1 - band, 18) * 0.8;
        r += (s.vein[0] - r) * vv; g += (s.vein[1] - g) * vv; b += (s.vein[2] - b) * vv;
      }
      if (s.speck && hash(x, y, seed + 7) < s.speck * 0.25) {
        const k = 0.5 + hash(y, x, seed) * 0.5;
        r += (s.speckColor[0] - r) * k; g += (s.speckColor[1] - g) * k; b += (s.speckColor[2] - b) * k;
      }
      const i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tileCache.set(key, c);
  return c;
}

// Fine grain bump for stone faces, as a normal map.
export function grainNormalTile(size = 256, seed = 3, strength = 1.2) {
  const noises = [16, 32, 64, 128].map((p, i) => ({ period: p, fn: makeNoise(p, seed + i) }));
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = fbm(noises, x, y, size);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  heightToNormal(h, size, size, strength * 6, img.data, true);
  ctx.putImageData(img, 0, 0);
  return c;
}

// height: Float32Array in [0,1], 1 = surface. Writes RGBA normal map into out.
export function heightToNormal(height, w, h, strength, out, wrap = false) {
  const at = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; }
    else { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); }
    return height[y * w + x];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // canvas rows go down while texture v goes up, hence +dy
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
}

const matCache = new Map();

// A plain tiled stone material for architecture and slab sides.
export function stoneMaterial(kind, { repeat = 1, seed = 1, color = null } = {}) {
  const key = `${kind}:${repeat}:${seed}:${color}`;
  if (matCache.has(key)) return matCache.get(key);
  const s = STONES[kind];
  const map = new THREE.CanvasTexture(stoneTile(kind, 512, seed));
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.anisotropy = 8;
  const normalMap = new THREE.CanvasTexture(grainNormalTile(256, seed + 5));
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(repeat * 2, repeat * 2);
  const m = new THREE.MeshStandardMaterial({
    map, normalMap, roughness: s.rough, metalness: s.metal ?? 0,
    normalScale: new THREE.Vector2(0.5, 0.5),
  });
  if (color) m.color.set(color);
  matCache.set(key, m);
  return m;
}
