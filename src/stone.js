// Procedural stone surfaces (tileable value noise) and height→normal helpers.
import * as THREE from 'three';

function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Fractal value noise that tiles over a size×size canvas. Each octave is a periodic lattice of
// random values, bilinearly smoothed; the lattice and per-column weights are computed once
// per octave, so the inner loop is just table lookups.
function fbmField(size, periods, seed) {
  const out = new Float32Array(size * size);
  let amp = 0.5, total = 0;
  const x0 = new Int32Array(size), x1 = new Int32Array(size), u = new Float32Array(size);
  periods.forEach((period, o) => {
    const lat = new Float32Array(period * period);
    for (let j = 0; j < period; j++) for (let i = 0; i < period; i++) lat[j * period + i] = hash(i, j, seed + o);
    const f = period / size;
    for (let x = 0; x < size; x++) {
      const p = x * f, i = Math.floor(p), t = p - i;
      x0[x] = i % period; x1[x] = (i + 1) % period; u[x] = t * t * (3 - 2 * t);
    }
    for (let y = 0; y < size; y++) {
      const r0 = x0[y] * period, r1 = x1[y] * period, v = u[y];
      for (let x = 0; x < size; x++) {
        const a = lat[r0 + x0[x]], b = lat[r0 + x1[x]], c = lat[r1 + x0[x]], d = lat[r1 + x1[x]];
        const ux = u[x];
        out[y * size + x] += (a + (b - a) * ux + (c - a) * v + (a - b - c + d) * ux * v) * amp;
      }
    }
    total += amp; amp *= 0.5;
  });
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
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
  const n = fbmField(size, [4, 8, 16, 32, 64, 128], seed * 17);
  const vn = s.vein && fbmField(size, [3, 6, 12, 24], seed * 31 + 99);
  const [br, bg, bb] = s.base, [vr, vg, vb] = s.vary;
  for (let y = 0, i = 0; y < size; y++) {
    for (let x = 0; x < size; x++, i++) {
      const k = (n[i] - 0.5) * 2;
      let r = br + k * vr, g = bg + k * vg, b = bb + k * vb;
      if (vn) {
        const band = Math.abs(Math.sin((x / size + vn[i] * 1.6) * Math.PI * 3));
        const vv = Math.pow(1 - band, 18) * 0.8;
        r += (s.vein[0] - r) * vv; g += (s.vein[1] - g) * vv; b += (s.vein[2] - b) * vv;
      }
      if (s.speck && hash(x, y, seed + 7) < s.speck * 0.25) {
        const k2 = 0.5 + hash(y, x, seed) * 0.5;
        r += (s.speckColor[0] - r) * k2; g += (s.speckColor[1] - g) * k2; b += (s.speckColor[2] - b) * k2;
      }
      const j = i * 4;
      img.data[j] = r; img.data[j + 1] = g; img.data[j + 2] = b; img.data[j + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tileCache.set(key, c);
  return c;
}

// Fine grain bump for stone faces, as a normal map.
export function grainNormalTile(size = 256, seed = 3, strength = 1.2) {
  const h = fbmField(size, [16, 32, 64, 128], seed);
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
  for (let y = 0; y < h; y++) {
    const yu = y > 0 ? y - 1 : (wrap ? h - 1 : 0), yd = y < h - 1 ? y + 1 : (wrap ? 0 : h - 1);
    for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : (wrap ? w - 1 : 0), xr = x < w - 1 ? x + 1 : (wrap ? 0 : w - 1);
      // canvas rows go down while texture v goes up, hence ny = +dy
      const nx = -(height[y * w + xr] - height[y * w + xl]) * strength;
      const ny = (height[yd * w + x] - height[yu * w + x]) * strength;
      const k = 127.5 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * w + x) * 4;
      out[i] = nx * k + 127.5; out[i + 1] = ny * k + 127.5; out[i + 2] = k + 127.5; out[i + 3] = 255;
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
