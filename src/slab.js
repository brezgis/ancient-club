// An inscribed stone slab. Each line of text is its own carved surface so it can be
// re-carved (translated into English, and back) independently, with a sparkling wipe.
import * as THREE from 'three';
import { typesetHieroglyphs } from './glyphs.js';
import { stoneTile, STONES, heightToNormal, stoneMaterial } from './stone.js';

const PPM = 600; // default texture pixels per metre of stone
const SIDE_SEED = 2;

// Canvas filters (blur) aren't in Safari 17; test by actually blurring a dot.
const CANVAS_BLUR = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 9;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.filter = 'blur(2px)';
  g.fillRect(4, 4, 1, 1);
  return g.getImageData(1, 4, 1, 1).data[3] > 0;
})();
// draw src into ctx blurred by ~px; falls back to a downscale/upscale blur
function drawBlurred(ctx, src, px) {
  if (CANVAS_BLUR) {
    ctx.filter = `blur(${px}px)`;
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    return;
  }
  const k = Math.max(1, px * 1.5);
  const t = drawBlurred.tmp ??= document.createElement('canvas');
  t.width = Math.max(1, Math.round(src.width / k)); t.height = Math.max(1, Math.round(src.height / k));
  const tc = t.getContext('2d');
  tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
  tc.drawImage(src, 0, 0, t.width, t.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(t, 0, 0, src.width, src.height);
}

export const SCRIPT_LABEL = {
  hiero: 'Hieroglyphic', translit: 'Transliteration', greek: 'Ancient Greek', english: 'English',
};

// Draws a stage's text as black ink on a transparent canvas of size w×h.
function renderInk(stage, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';
  if (stage.script === 'hiero') {
    const t = typesetHieroglyphs(stage.text);
    let em = h * 0.74;
    if (t.width * em > w * 0.94) em = (w * 0.94) / t.width;
    t.draw(ctx, (w - t.width * em) / 2, (h - em) / 2, em);
    return c;
  }
  const italic = stage.script === 'translit' ? 'italic ' : '';
  const isCaps = stage.text === stage.text.toUpperCase() && /[Α-Ω]/.test(stage.text);
  const words = stage.text.split(' ');
  for (let size = h * 0.6; size > 6; size *= 0.94) {
    ctx.font = `${italic}${size}px "EB Garamond"`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = isCaps ? `${size * 0.06}px` : '0px';
    const maxLines = Math.max(1, Math.floor(h / (size * 1.12)));
    const lines = [];
    let cur = '';
    for (const wd of words) {
      const test = cur ? cur + ' ' + wd : wd;
      if (ctx.measureText(test).width > w * 0.95 && cur) { lines.push(cur); cur = wd; }
      else cur = test;
    }
    lines.push(cur);
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= w * 0.95)) {
      ctx.textAlign = 'center';
      const lh = size * 1.1;
      const y0 = h / 2 - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => ctx.fillText(l, w / 2, y0 + i * lh));
      return c;
    }
  }
  return c;
}

class CarvedLine {
  constructor(slab, index, def, rect) {
    this.slab = slab;
    this.index = index;
    this.def = def;
    // the carving flips between the original script and English; any stages in between
    // (transliteration, Greek) are shown in the caption instead
    this.faces = [def.stages[0], def.stages.find(st => st.script === 'english') ?? def.stages.at(-1)];
    this.translated = false;
    this.w = Math.round(rect.w * slab.ppm);
    this.h = Math.round(rect.h * slab.ppm);
    this.inks = this.faces.map(f => renderInk(f, this.w, this.h));
    this.transition = null; // {from, to, t}
    this.glow = 0;
    this.hover = 0;

    const mk = () => { const c = document.createElement('canvas'); c.width = this.w; c.height = this.h; return c; };
    this.mask = mk();
    this.colorC = mk(); this.normalC = mk(); this.glowC = mk();
    this.blurC = mk();

    // stone colour underneath this line, cut from the slab face so the seam is invisible
    this.base = mk();
    this.base.getContext('2d').drawImage(slab.faceColor,
      rect.px, rect.py, this.w, this.h, 0, 0, this.w, this.h);

    this.colorTex = new THREE.CanvasTexture(this.colorC);
    this.colorTex.colorSpace = THREE.SRGBColorSpace;
    this.colorTex.anisotropy = 8;
    this.normalTex = new THREE.CanvasTexture(this.normalC);
    this.normalTex.anisotropy = 8;
    this.glowTex = new THREE.CanvasTexture(this.glowC);
    this.glowTex.colorSpace = THREE.SRGBColorSpace;

    const s = STONES[slab.def.stone];
    this.material = new THREE.MeshStandardMaterial({
      map: this.colorTex, normalMap: this.normalTex,
      roughness: s.rough, metalness: s.metal ?? 0,
      emissive: new THREE.Color(1, 0.78, 0.35), emissiveMap: this.glowTex, emissiveIntensity: 0,
      normalScale: new THREE.Vector2(1.6, 1.6),
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(rect.w, rect.h), this.material);
    this.mesh.position.set(rect.cx, rect.cy, slab.depth / 2 + 0.0015);
    this.mesh.userData.line = this;
    this.rect = rect;
    this.compose(this.inks[0]);
  }

  // the in-between readings worth showing alongside the English (transliteration, Greek)
  get readings() { return this.def.stages.filter(st => !this.faces.includes(st)); }

  // Build colour / normal / glow maps from the current ink mask.
  compose(maskSource, freshMask = null) {
    const { w, h } = this;
    const m = this.mask.getContext('2d');
    if (maskSource !== this.mask) { m.clearRect(0, 0, w, h); m.drawImage(maskSource, 0, 0); }

    // bevel: blurred ink gives the sloped walls of a sunk-relief cut
    const b = this.blurC.getContext('2d', { willReadFrequently: true });
    b.clearRect(0, 0, w, h);
    drawBlurred(b, this.mask, Math.max(1, this.h * 0.012));
    const blurred = b.getImageData(0, 0, w, h).data;
    const height = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) height[i] = 1 - blurred[i * 4 + 3] / 255;

    const nctx = this.normalC.getContext('2d');
    const nimg = nctx.createImageData(w, h);
    heightToNormal(height, w, h, 5, nimg.data);
    nctx.putImageData(nimg, 0, 0);

    // colour: stone, darkened inside the cut, with a wash of pigment in the glyphs
    const c = this.colorC.getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.drawImage(this.base, 0, 0);
    c.globalAlpha = 0.5;
    c.globalCompositeOperation = 'multiply';
    c.drawImage(this.blurC, 0, 0);
    c.globalAlpha = 1;
    const pigment = this.slab.def.pigment;
    if (pigment) {
      const tmp = this._tmp ??= Object.assign(document.createElement('canvas'), { width: w, height: h });
      const t = tmp.getContext('2d');
      t.globalCompositeOperation = 'source-over';
      t.clearRect(0, 0, w, h);
      t.drawImage(this.mask, 0, 0);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = pigment;
      t.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 0.72;
      c.drawImage(tmp, 0, 0);
      c.globalAlpha = 1;
    }
    c.globalCompositeOperation = 'source-over';

    // glow map: newly carved letters shine
    const g = this.glowC.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.drawImage(freshMask ?? this.mask, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';

    this.colorTex.needsUpdate = true;
    this.normalTex.needsUpdate = true;
    this.glowTex.needsUpdate = true;
  }

  // Start re-carving into the other face. Returns the duration, or 0 if already carving.
  toggle() {
    if (this.transition) return 0;
    const from = +this.translated;
    this.transition = { from, to: 1 - from, t: 0, dur: 1.25 + this.w / 2400 };
    return this.transition.dur;
  }

  update(dt, sparkles) {
    this.glow = Math.max(0, this.glow - dt * 0.45);
    if (this.transition) {
      const tr = this.transition;
      tr.t += dt / tr.dur;
      const p = Math.min(1, tr.t);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const { w, h } = this;
      const front = ease * (w + w * 0.12) - w * 0.06;
      const m = this.mask.getContext('2d');
      m.clearRect(0, 0, w, h);
      // old text survives to the right of the front, the new text is carved to its left,
      // with a ragged, dissolving edge
      const strips = 24;
      for (let i = 0; i < strips; i++) {
        const y = (i * h) / strips, sh = h / strips + 1;
        const jag = Math.sin(i * 12.9898 + tr.t * 40) * w * 0.02;
        const fx = Math.max(0, front + jag);
        m.drawImage(this.inks[tr.to], 0, y, fx, sh, 0, y, fx, sh);
        m.drawImage(this.inks[tr.from], fx, y, w - fx, sh, fx, y, w - fx, sh);
      }
      this._acc = (this._acc ?? 0) + dt;
      if (this._acc >= 1 / 30 || p >= 1) { this._acc = 0; this.compose(this.mask); }
      this.glow = Math.max(this.glow, 1);
      // sparkles rushing along the front
      if (sparkles && p < 1) {
        const u = THREE.MathUtils.clamp(front / w, 0, 1);
        const n = Math.round(dt * 900);
        for (let i = 0; i < n; i++) {
          const local = new THREE.Vector3(
            this.rect.cx - this.rect.w / 2 + u * this.rect.w,
            this.rect.cy + (Math.random() - 0.5) * this.rect.h,
            this.slab.depth / 2 + 0.01,
          );
          const world = this.slab.group.localToWorld(local);
          const dir = new THREE.Vector3(0.6 + Math.random(), (Math.random() - 0.3) * 1.6, 0.6 + Math.random() * 1.2)
            .transformDirection(this.slab.group.matrixWorld).multiplyScalar(0.35 + Math.random() * 0.6);
          sparkles.emit(world, dir, Math.random() < 0.8 ? 0xffd27a : 0x9fd8ff);
        }
      }
      if (p >= 1) {
        this.translated = tr.to === 1;
        this.transition = null;
        this.compose(this.inks[tr.to]);
        this.slab.onLineDone?.(this);
      }
    }
    const target = this.glow * 1.3 + this.hover * 0.3;
    this.material.emissiveIntensity += (target - this.material.emissiveIntensity) * Math.min(1, dt * 10);
  }
}

export class InscribedSlab {
  constructor(def, { width = 1.3, height = 1.8, depth = 0.22, lineHeight = null, lightColor = 0xffc98a, light = true, lightIntensity = 5.5, ppm = PPM } = {}) {
    this.ppm = ppm;
    this.def = def;
    this.width = width; this.height = height; this.depth = depth;
    this.group = new THREE.Group();
    this.group.name = `slab:${def.title}`;

    const n = def.lines.length;
    const margin = Math.min(width, height) * (def.compact ? 0.1 : 0.12);
    const avail = height - margin * 2;
    const lh = lineHeight ?? Math.min(avail / n, def.compact ? avail : 0.3);
    const totalH = lh * n;

    // the face: stone plus a carved border
    const fw = Math.round(width * ppm), fh = Math.round(height * ppm);
    this.faceColor = document.createElement('canvas');
    this.faceColor.width = fw; this.faceColor.height = fh;
    const fc = this.faceColor.getContext('2d');
    // same tile as the slab's sides (so it's generated once), shifted per slab so no two faces match
    const tile = stoneTile(def.stone, 512, SIDE_SEED);
    const ox = (def.title.length * 97) % 512, oy = (def.title.length * 59) % 512;
    for (let y = -oy; y < fh; y += 512) for (let x = -ox; x < fw; x += 512) fc.drawImage(tile, x, y);

    const borderC = document.createElement('canvas');
    borderC.width = fw; borderC.height = fh;
    const bc = borderC.getContext('2d', { willReadFrequently: true });
    const inset = margin * 0.45 * ppm;
    bc.strokeStyle = '#000';
    bc.lineWidth = Math.max(3, ppm * 0.012);
    if (CANVAS_BLUR) bc.filter = `blur(${ppm * 0.004}px)`;
    bc.strokeRect(inset, inset, fw - inset * 2, fh - inset * 2);
    bc.filter = 'none';
    const bd = bc.getImageData(0, 0, fw, fh).data;
    const hgt = new Float32Array(fw * fh);
    for (let i = 0; i < fw * fh; i++) hgt[i] = 1 - bd[i * 4 + 3] / 255;
    const faceNormal = document.createElement('canvas');
    faceNormal.width = fw; faceNormal.height = fh;
    const fn = faceNormal.getContext('2d');
    const nimg = fn.createImageData(fw, fh);
    heightToNormal(hgt, fw, fh, 4, nimg.data);
    fn.putImageData(nimg, 0, 0);

    const faceShaded = document.createElement('canvas');
    faceShaded.width = fw; faceShaded.height = fh;
    const fs = faceShaded.getContext('2d');
    fs.drawImage(this.faceColor, 0, 0);
    fs.globalAlpha = 0.5;
    fs.drawImage(borderC, 0, 0);

    const faceMap = new THREE.CanvasTexture(faceShaded);
    faceMap.colorSpace = THREE.SRGBColorSpace;
    faceMap.anisotropy = 8;
    const faceNormalTex = new THREE.CanvasTexture(faceNormal);
    const s = STONES[def.stone];
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceMap, normalMap: faceNormalTex, roughness: s.rough, metalness: s.metal ?? 0,
      normalScale: new THREE.Vector2(1.4, 1.4),
    });
    const side = stoneMaterial(def.stone, { repeat: 1, seed: SIDE_SEED });
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth),
      [side, side, side, side, faceMat, side]);
    body.castShadow = false;
    body.receiveShadow = true;
    this.group.add(body);
    this.body = body;

    this.lines = def.lines.map((ld, i) => {
      const cy = totalH / 2 - lh * (i + 0.5);
      const lw = width - margin * 2;
      const rect = {
        w: lw, h: lh * 0.92, cx: 0, cy,
        px: Math.round((width / 2 - lw / 2) * ppm),
        py: Math.round((height / 2 - cy - lh * 0.46) * ppm),
      };
      const line = new CarvedLine(this, i, ld, rect);
      this.group.add(line.mesh);
      return line;
    });
    this.faceColor = null;   // lines have copied their stone; free the big canvas

    // raking light from above: low-angle light makes carved relief legible,
    // which is why Egyptologists photograph inscriptions with a torch held to one side
    if (light) {
      // the lamp itself comes from a shared pool (see LampPool in world.js); this is its spec
      this.lamp = {
        local: new THREE.Vector3(0, height / 2 + 0.35, depth / 2 + 0.34),
        localTarget: new THREE.Vector3(0, -height * 0.45, depth / 2),
        color: lightColor, intensity: lightIntensity, distance: 4 + height * 1.5,
        angle: Math.PI / 3.6, penumbra: 0.8, decay: 1.0,
      };
      // a little brass lamp housing
      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.06, 0.12, 16),
        new THREE.MeshStandardMaterial({ color: 0x9a7431, metalness: 1, roughness: 0.35, emissive: 0x331a00 }),
      );
      lamp.position.copy(this.lamp.local);
      lamp.rotation.x = 0.7;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x5b4520, metalness: 1, roughness: 0.4 }));
      arm.position.set(0, height / 2 + 0.43, depth / 2 + 0.13);
      this.group.add(lamp, arm);
    }
  }

  update(dt, sparkles) {
    for (const l of this.lines) l.update(dt, sparkles);
  }
}
