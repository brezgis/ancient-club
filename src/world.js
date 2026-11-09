// The club's architecture: hall, dance floor, DJ booth, bar, bathroom, and the lights.
import * as THREE from 'three';
import { stoneMaterial } from './stone.js';
import { signChar, HIERO_FONT } from './glyphs.js';
import { InscribedSlab } from './slab.js';
import { SLABS } from './texts.js';
import { Q } from './quality.js';

export const HALL = { x0: -14, x1: 14, z0: -14, z1: 14, h: 7 };
export const BATH = { x0: -22, x1: -14.4, z0: 1, z1: 11, h: 3.4 };
export const DOOR = { z0: 5.2, z1: 6.8 };
export const DANCE = { x: 0, z: -1, r: 5.2 };

// Egyptian jewellery colours: lapis, turquoise, carnelian, gold
export const PALETTE = [0x2448ff, 0x18d4c4, 0xff3a2a, 0xffb020, 0xc040ff];

// Let the browser paint and handle input between long chunks of work. Unlike setTimeout,
// this isn't throttled to once a second when the tab is in the background.
const yieldToBrowser = () => globalThis.scheduler?.yield?.()
  ?? new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];      // axis-aligned boxes {x0,x1,z0,z1}
    this.circles = [];        // {x,z,r}
    this.slabs = [];
    this.animated = [];       // objects with update(dt, t, beat)
    this.discoLights = [];
    this.lamps = [];          // lamp specs, lit by the shared LampPool
    this.hallLights = 1;      // 0–1: the disco rig dims while you are in the bathroom
  }

  box(x0, x1, z0, z1) { this.colliders.push({ x0, x1, z0, z1 }); }

  // Carving the inscriptions is the slow part, so build yields between slabs and reports progress (0–1).
  async build(onProgress = () => {}) {
    const s = this.scene;
    this.buildHall();
    this.buildDanceFloor();
    this.buildColumns();
    this.buildCeiling();
    this.buildDJ();
    this.buildBar();
    this.buildBathroom();
    await this.placeSlabs(onProgress);
    this.buildLights();
    this.buildMirrorBall();
    this.pool = new LampPool(this.scene, Q.lampPool);
    s.add(new THREE.HemisphereLight(0x3a3060, 0x100808, 0.35));
  }

  // --- hall -------------------------------------------------------------------
  buildHall() {
    const { x0, x1, z0, z1, h } = HALL;
    const floorMat = stoneMaterial('basalt', { repeat: 8, seed: 4 }).clone();
    floorMat.roughness = 0.28;
    floorMat.metalness = 0.1;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallMat = stoneMaterial('sandstone', { repeat: 3, seed: 6, color: 0x6a5a4a });
    const T = 0.4;
    const wall = (w, hgt, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, T), wallMat);
      m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true;
      this.scene.add(m);
    };
    wall(x1 - x0 + T * 2, h, 0, h / 2, z0 - T / 2);                 // north
    wall(x1 - x0 + T * 2, h, 0, h / 2, z1 + T / 2);                 // south
    wall(z1 - z0, h, x1 + T / 2, h / 2, 0, Math.PI / 2);            // east
    // west wall with the bathroom door
    const wz = (a, b) => wall(b - a, h, x0 - T / 2, h / 2, (a + b) / 2, Math.PI / 2);
    wz(z0, DOOR.z0); wz(DOOR.z1, z1);
    wall(DOOR.z1 - DOOR.z0, h - 2.6, x0 - T / 2, 2.6 + (h - 2.6) / 2, (DOOR.z0 + DOOR.z1) / 2, Math.PI / 2);
    this.box(x0 - 1, x1 + 1, z0 - 1, z0);
    this.box(x0 - 1, x1 + 1, z1, z1 + 1);
    this.box(x1, x1 + 1, z0, z1);
    this.box(x0 - T, x0, z0, DOOR.z0);
    this.box(x0 - T, x0, DOOR.z1, z1);

    // painted frieze: the ankh–was–neb pattern ("all life and dominion") that runs along temple walls
    const fc = document.createElement('canvas');
    fc.width = 1024; fc.height = 128;
    const f = fc.getContext('2d');
    f.fillStyle = '#0d1a3a'; f.fillRect(0, 0, 1024, 128);
    f.fillStyle = '#b8322a'; f.fillRect(0, 0, 1024, 10); f.fillRect(0, 118, 1024, 10);
    f.fillStyle = '#d9a441'; f.fillRect(0, 12, 1024, 4); f.fillRect(0, 112, 1024, 4);
    f.font = `84px ${HIERO_FONT}`;
    f.textBaseline = 'middle';
    f.fillStyle = '#e8b64c';
    const seq = ['S34', 'S40', 'V30'];
    for (let i = 0; i < 12; i++) f.fillText(signChar(seq[i % 3]), 10 + i * 85, 66);
    const ftex = new THREE.CanvasTexture(fc);
    ftex.colorSpace = THREE.SRGBColorSpace;
    ftex.wrapS = THREE.RepeatWrapping;
    const frieze = (len, x, z, ry) => {
      const t = ftex.clone();
      t.repeat.set(len / 5, 1);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.62),
        new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.06 }));
      m.position.set(x, h - 0.6, z); m.rotation.y = ry;
      this.scene.add(m);
    };
    frieze(28, 0, z0 + 0.01, 0);
    frieze(28, 0, z1 - 0.01, Math.PI);
    frieze(28, x1 - 0.01, 0, -Math.PI / 2);
    frieze(28, x0 + 0.01, 0, Math.PI / 2);

    // entrance doors (closed: you're already in)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.6, metalness: 0.2 });
    const studMat = new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 1, roughness: 0.3 });
    for (const sx of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4, 0.15), doorMat);
      d.position.set(sx * 0.82, 2, z1 - 0.05);
      this.scene.add(d);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
        const st = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), studMat);
        st.position.set(sx * 0.82 + (j - 1) * 0.45, 0.6 + i * 0.75, z1 - 0.14);
        this.scene.add(st);
      }
    }

    // the (out of order) men's room door
    const md = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 1.4), doorMat);
    md.position.set(x0 + 0.06, 1.2, 10.5);
    this.scene.add(md);
    const tape = new THREE.MeshStandardMaterial({ color: 0xe6c200, emissive: 0x332800, roughness: 0.6 });
    for (const [y, r] of [[1.0, 0.5], [1.5, -0.5]]) {
      const tp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 1.7), tape);
      tp.position.set(x0 + 0.14, y, 10.5); tp.rotation.x = r;
      this.scene.add(tp);
    }
  }

  // --- dance floor: glowing tiles ----------------------------------------------
  buildDanceFloor() {
    const tiles = [];
    const S = 0.8;
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
      const x = i * S, z = j * S;
      if (Math.hypot(x, z) < DANCE.r - 0.2) tiles.push([x, z]);
    }
    const geo = new THREE.BoxGeometry(S * 0.94, 0.04, S * 0.94);
    const mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.15, metalness: 0.3, emissive: 0xffffff, emissiveIntensity: 1 });
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');
    };
    const im = new THREE.InstancedMesh(geo, mat, tiles.length);
    const m4 = new THREE.Matrix4();
    tiles.forEach(([x, z], k) => {
      m4.makeTranslation(DANCE.x + x, 0.02, DANCE.z + z);
      im.setMatrixAt(k, m4);
      im.setColorAt(k, new THREE.Color(0));
    });
    im.receiveShadow = true;
    this.scene.add(im);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(DANCE.r, 0.06, 8, 96),
      new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 1, roughness: 0.25, emissive: 0x442200 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(DANCE.x, 0.03, DANCE.z);
    this.scene.add(ring);

    const col = new THREE.Color();
    this.animated.push({
      update: (dt, t, beat) => {
        const phase = beat.position; // in beats
        const bar = Math.floor(phase / 16) % 4;
        tiles.forEach(([x, z], k) => {
          const r = Math.hypot(x, z), a = Math.atan2(z, x);
          let v, ci;
          if (bar === 0) { v = Math.max(0, 1 - Math.abs(((phase % 1) * 5.5) - r) * 1.3); ci = Math.floor(phase) % PALETTE.length; }
          else if (bar === 1) { v = 0.5 + 0.5 * Math.sin(a * 3 + phase * Math.PI); ci = (Math.floor(a * 3 / Math.PI + 3) + Math.floor(phase / 2)) % PALETTE.length; }
          else if (bar === 2) { v = ((Math.round(x / S) + Math.round(z / S) + Math.floor(phase)) & 1) ? 1 : 0.05; ci = Math.floor(phase / 4) % PALETTE.length; }
          else { const h = Math.sin(k * 91.7 + Math.floor(phase * 2) * 13.1); v = h > 0.55 ? 1 : 0.04; ci = (k + Math.floor(phase)) % PALETTE.length; }
          col.set(PALETTE[ci]).multiplyScalar(v * (0.3 + 0.7 * beat.pulse) * 0.9);
          im.setColorAt(k, col);
        });
        im.instanceColor.needsUpdate = true;
      },
    });
  }

  // --- papyrus-bundle columns --------------------------------------------------
  buildColumns() {
    const pts = [];
    const H = HALL.h;
    pts.push(new THREE.Vector2(0, 0), new THREE.Vector2(0.85, 0), new THREE.Vector2(0.85, 0.25), new THREE.Vector2(0.62, 0.3));
    for (let i = 0; i <= 20; i++) {
      const y = 0.3 + (i / 20) * (H * 0.72);
      const bulge = i < 4 ? 0.5 + i * 0.03 : 0.62 - (i / 20) * 0.14;
      pts.push(new THREE.Vector2(bulge, y));
    }
    const cy = 0.3 + H * 0.72;
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      pts.push(new THREE.Vector2(0.48 + Math.sin(k * Math.PI * 0.5) * 0.55 * k, cy + k * (H * 0.2)));
    }
    pts.push(new THREE.Vector2(0.9, H - 0.25), new THREE.Vector2(0.7, H - 0.2), new THREE.Vector2(0.7, H), new THREE.Vector2(0, H));
    const geo = new THREE.LatheGeometry(pts, 64);
    // flute it into a bundle of papyrus stems
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
      if (y < 0.3 || y > H - 0.3) continue;
      const a = Math.atan2(z, x);
      const k = 1 + 0.07 * Math.abs(Math.cos(a * 4));
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    geo.computeVertexNormals();
    const mat = stoneMaterial('sandstone', { repeat: 2, seed: 9 });
    const band = new THREE.MeshStandardMaterial({ color: 0x1b3fa0, roughness: 0.5, emissive: 0x050a20 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a040, metalness: 1, roughness: 0.3 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = DANCE.x + Math.cos(a) * 8.6, z = DANCE.z + Math.sin(a) * 8.6;
      const c = new THREE.Mesh(geo, mat);
      c.position.set(x, 0, z);
      c.castShadow = true; c.receiveShadow = true;
      this.scene.add(c);
      for (const [y, m] of [[cy - 0.35, band], [cy - 0.2, gold], [cy - 0.05, band]]) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 48), m);
        t.rotation.x = Math.PI / 2; t.position.set(x, y, z);
        this.scene.add(t);
      }
      this.circles.push({ x, z, r: 0.75 });
    }
  }

  // --- the sky-goddess ceiling: yellow stars on blue, as in royal tombs --------
  buildCeiling() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#0a1238'; g.fillRect(0, 0, 512, 512);
    g.font = `70px ${HIERO_FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f0c040';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.fillText(signChar('N14'), 64 + i * 128 + (j % 2) * 64, 64 + j * 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 14);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x1 - HALL.x0, HALL.z1 - HALL.z0),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.9 }));
    m.rotation.x = Math.PI / 2;
    m.position.y = HALL.h;
    this.scene.add(m);
    this.ceilingTex = tex;
  }

  // --- DJ booth + winged sun ----------------------------------------------------
  buildDJ() {
    const z = HALL.z0 + 2.2;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 3.6), stoneMaterial('basalt', { repeat: 2, seed: 8 }));
    plat.position.set(0, 0.3, HALL.z0 + 1.8);
    plat.receiveShadow = true;
    this.scene.add(plat);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 0.9), stoneMaterial('granodiorite', { repeat: 1, seed: 3 }));
    desk.position.set(0, 0.6 + 0.35, z + 0.6);
    this.scene.add(desk);
    this.box(-3.5, 3.5, HALL.z0, HALL.z0 + 3.6);
    this.djAnchor = new THREE.Vector3(0, 0.6, z - 0.3);

    // two turntables with spinning lapis platters
    this.platters = [];
    for (const sx of [-0.9, 0.9]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 48),
        new THREE.MeshStandardMaterial({ color: 0x14163a, roughness: 0.3, metalness: 0.4, emissive: 0x1030a0, emissiveIntensity: 0.6 }));
      p.position.set(sx, 1.32, z + 0.6);
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.032, 24),
        new THREE.MeshStandardMaterial({ color: 0xd4a040, metalness: 1, roughness: 0.3 }));
      label.position.x = 0.12;
      p.add(label);
      this.scene.add(p);
      this.platters.push(p);
    }
    const djLight = new THREE.PointLight(0x7a5cff, 6, 5, 1.6);
    djLight.position.set(0, 2.6, z + 1.6);
    this.scene.add(djLight);

    // winged sun disk (the Behdetite, Horus of Edfu) above the booth
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    g.translate(512, 128);
    for (const dir of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        const colr = ['#d9a441', '#2a5fd0', '#c43a2a'][row];
        for (let k = 0; k < 22; k++) {
          const x = dir * (70 + k * 19);
          const len = 36 + row * 18 - k * (row === 2 ? 1.2 : 0.6);
          g.fillStyle = colr;
          g.beginPath();
          g.roundRect(x - 8, -40 + row * 22 - k * 1.8, 17, Math.max(18, len), 6);
          g.fill();
        }
      }
    }
    const grad = g.createRadialGradient(0, -8, 5, 0, -8, 62);
    grad.addColorStop(0, '#ff8a50'); grad.addColorStop(1, '#c42a14');
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, -8, 58, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d9a441';
    for (const dir of [-1, 1]) { g.beginPath(); g.ellipse(dir * 68, 30, 12, 34, dir * 0.25, 0, Math.PI * 2); g.fill(); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0xffffff }));
    sun.position.set(0, 5.2, HALL.z0 + 0.03);
    this.scene.add(sun);
    this.sun = sun;
  }

  // --- bar -----------------------------------------------------------------------
  buildBar() {
    const bx = 9.6;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 10), stoneMaterial('granodiorite', { repeat: 2, seed: 12 }));
    counter.position.set(bx, 0.55, 0);
    counter.castShadow = true; counter.receiveShadow = true;
    this.scene.add(counter);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 10.2),
      new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 1, roughness: 0.25 }));
    top.position.set(bx, 1.13, 0);
    this.scene.add(top);
    // glowing turquoise under-strip
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 10),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0x18d4c4).multiplyScalar(3) }));
    strip.position.set(bx - 0.52, 0.12, 0);
    this.scene.add(strip);
    this.box(bx - 0.6, bx + 0.6, -5.1, 5.1);
    this.box(bx - 0.6, HALL.x1, 5.0, 5.3);
    this.box(bx - 0.6, HALL.x1, -5.3, -5.0);
    this.barAnchor = new THREE.Vector3(11.8, 0, 0);
    this.barCounterTop = 1.16;

    const colXZ = [...Array(8)].map((_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return [DANCE.x + Math.cos(a) * 8.6, DANCE.z + Math.sin(a) * 8.6];
    });
    const stoolZ = [];
    for (let z = -4.4; z <= 4.4; z += 0.2) {
      const clear = colXZ.every(([cx, cz]) => Math.hypot(bx - 1.2 - cx, z - cz) > 1.35);
      if (clear && (!stoolZ.length || z - stoolZ[stoolZ.length - 1] >= 1.2)) stoolZ.push(z);
    }
    this.stoolZ = stoolZ;
    this.stoolX = bx - 1.2;
    for (const z of stoolZ) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.8, 20),
        stoneMaterial('limestone', { repeat: 1, seed: 5 }));
      st.position.set(bx - 1.2, 0.4, z);
      this.scene.add(st);
      this.circles.push({ x: bx - 1.2, z, r: 0.25 });
    }

    // shelves of jars, back-lit
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0e, roughness: 0.7 });
    const jarPts = [];
    for (let i = 0; i <= 16; i++) {
      const k = i / 16;
      const r = 0.02 + Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.13 * (k < 0.85 ? 1 : 0.4) + (k > 0.9 ? 0.03 : 0);
      jarPts.push(new THREE.Vector2(Math.max(0.015, r), k * 0.55));
    }
    const jarGeo = new THREE.LatheGeometry(jarPts, 20);
    const jarMats = [0xa0522d, 0x8b4a2b, 0xb86b3a, 0x6e3b1f].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    for (const y of [1.3, 2.2, 3.1]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 9.6), shelfMat);
      sh.position.set(HALL.x1 - 0.3, y, 0);
      this.scene.add(sh);
      for (let z = -4.4; z <= 4.4; z += 0.55) {
        const j = new THREE.Mesh(jarGeo, jarMats[Math.floor(Math.abs(z * 7 + y * 3)) % 4]);
        j.position.set(HALL.x1 - 0.3, y + 0.025, z);
        j.rotation.y = z * 3;
        j.scale.setScalar(0.85 + ((z * 13 + y) % 0.3));
        this.scene.add(j);
      }
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a2a).multiplyScalar(0.55) }));
    back.position.set(HALL.x1 - 0.02, 2.2, 0);
    back.rotation.y = -Math.PI / 2;
    this.scene.add(back);
    const barLight = new THREE.PointLight(0xffa050, 10, 8, 1.4);
    barLight.position.set(10.4, 3.2, 0);
    this.scene.add(barLight);

    this.jarGeo = jarGeo;
  }

  // --- the girls' bathroom -----------------------------------------------------
  buildBathroom() {
    const { x0, x1, z0, z1, h } = BATH;
    // white tiles
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#c9ccd0'; g.lineWidth = 4;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
    const tile = new THREE.CanvasTexture(c);
    tile.colorSpace = THREE.SRGBColorSpace;
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
    const tileMat = (rx, ry) => {
      const t = tile.clone(); t.repeat.set(rx, ry); t.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.25 });
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), tileMat((x1 - x0) / 1.2, (z1 - z0) / 1.2));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((x0 + x1) / 2, 0.005, (z0 + z1) / 2);
    this.scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set((x0 + x1) / 2, h, (z0 + z1) / 2);
    this.scene.add(ceil);
    const T = 0.2;
    const wall = (w, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, T), tileMat(w / 1.2, h / 1.2));
      m.position.set(x, h / 2, z); m.rotation.y = ry;
      this.scene.add(m);
    };
    wall(x1 - x0, (x0 + x1) / 2, z0 - T / 2, 0);
    wall(x1 - x0, (x0 + x1) / 2, z1 + T / 2, 0);
    wall(z1 - z0, x0 - T / 2, (z0 + z1) / 2, Math.PI / 2);
    // inner face of the shared wall
    const seg = (a, b) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a, h), tileMat((b - a) / 1.2, h / 1.2));
      m.position.set(x1 - 0.001, h / 2, (a + b) / 2); m.rotation.y = -Math.PI / 2;
      this.scene.add(m);
    };
    seg(z0, DOOR.z0); seg(DOOR.z1, z1);
    this.box(x0 - 1, x1, z0 - 1, z0);
    this.box(x0 - 1, x1, z1, z1 + 1);
    this.box(x0 - 1, x0, z0, z1);
    // doorway frame reaches through the thick hall wall
    this.box(x1, HALL.x0, z0, DOOR.z0);
    this.box(x1, HALL.x0, DOOR.z1, z1);
    const jambMat = stoneMaterial('limestone', { repeat: 1, seed: 11 });
    const passFloor = new THREE.Mesh(new THREE.PlaneGeometry(0.4, DOOR.z1 - DOOR.z0), jambMat);
    passFloor.rotation.x = -Math.PI / 2;
    passFloor.position.set(-14.2, 0.004, (DOOR.z0 + DOOR.z1) / 2);
    this.scene.add(passFloor);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, DOOR.z1 - DOOR.z0 + 0.6), jambMat);
    lintel.position.set(-14.2, 2.6, (DOOR.z0 + DOOR.z1) / 2);
    this.scene.add(lintel);

    // sinks and a long mirror on the west wall
    const sinkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 6), stoneMaterial('marble', { repeat: 2, seed: 2 }));
    counter.position.set(x0 + 0.35, 0.45, 6);
    this.scene.add(counter);
    this.box(x0, x0 + 0.7, 3, 9);
    for (const z of [4, 6, 8]) {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.12, 24), sinkMat);
      basin.position.set(x0 + 0.38, 0.93, z);
      this.scene.add(basin);
      const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8),
        new THREE.MeshStandardMaterial({ color: 0xd4a040, metalness: 1, roughness: 0.2 }));
      tap.position.set(x0 + 0.1, 1.05, z);
      this.scene.add(tap);
    }
    this.mirrorSpec = { x: x0 + 0.02, y: 1.9, z: 6, w: 5.6, h: 1.5 };

    // stalls along the north wall
    const stallMat = new THREE.MeshStandardMaterial({ color: 0xe9d6dc, roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const x = x0 + 2.6 + i * 1.5;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, 1.5), stallMat);
      p.position.set(x, 1.15, z1 - 0.75);
      this.scene.add(p);
      this.box(x - 0.05, x + 0.05, z1 - 1.5, z1);
    }
    for (let i = 0; i < 3; i++) {
      const x = x0 + 3.35 + i * 1.5;
      const d = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 0.04), stallMat);
      d.position.set(x - 0.02, 1.1, z1 - 1.5);
      d.rotation.y = i === 1 ? 0.5 : 0;
      this.scene.add(d);
      if (i !== 1) this.box(x - 0.7, x + 0.7, z1 - 1.55, z1 - 1.45);
    }

    // hard white light
    for (const [x, z] of [[-18.2, 3.8], [-18.2, 8.2]]) {
      const l = new THREE.PointLight(0xfff6ee, 2.6, 11, 1.3);
      l.position.set(x, h - 0.6, z);   // a little below the ceiling, so it doesn't hot-spot
      this.scene.add(l);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      panel.position.set(x, h - 0.02, z);
      this.scene.add(panel);
    }
    // Hollywood vanity bulbs around the mirror
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1dc).multiplyScalar(1.6) });
    const bulbGeo = new THREE.SphereGeometry(0.045, 12, 8);
    const ms = this.mirrorSpec;
    for (let k = 0; k < 13; k++) {
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      b.position.set(x0 + 0.08, ms.y + ms.h / 2 + 0.14, ms.z - ms.w / 2 + (k / 12) * ms.w);
      this.scene.add(b);
    }
    this.bathAnchors = [
      new THREE.Vector3(x0 + 1.25, 0, 4.6),
      new THREE.Vector3(x0 + 1.3, 0, 7.4),
      new THREE.Vector3(x1 - 1.6, 0, 9),
      new THREE.Vector3(x1 - 2.2, 0, 2.3),
    ];
  }

  // --- inscriptions ---------------------------------------------------------------
  async placeSlabs(onProgress) {
    const queue = [];
    const put = (...args) => queue.push(args);
    const carve = (key, opts, x, y, z, ry) => {
      const s = new InscribedSlab(SLABS[key], opts);
      s.key = key;
      s.group.position.set(x, y, z);
      s.group.rotation.y = ry;
      this.scene.add(s.group);
      this.slabs.push(s);
      if (s.lamp) {
        s.group.updateMatrixWorld(true);
        this.addLamp({ ...s.lamp, pos: s.group.localToWorld(s.lamp.local.clone()), target: s.group.localToWorld(s.lamp.localTarget.clone()) });
      }
      return s;
    };
    const { x0, x1, z0, z1 } = HALL;
    const d = 0.11;
    put('rosetta', { width: 1.5, height: 2.1 }, -5, 1.45, z1 - d, Math.PI);
    put('harper', { width: 1.6, height: 1.7 }, x0 + d, 1.55, -8, Math.PI / 2);
    put('glossary', { width: 1.6, height: 2.1 }, x0 + d, 1.45, -2.5, Math.PI / 2);
    put('offering', { width: 1.8, height: 1.7 }, -8, 1.55, z0 + d, 0);
    put('seikilos', { width: 1.1, height: 2.0, lightColor: 0xd8c8ff }, 6.5, 1.5, z0 + d, 0);
    put('hathor', { width: 1.6, height: 1.5 }, x1 - d, 1.6, -8.5, -Math.PI / 2);
    put('alcaeus', { width: 1.7, height: 2.1, lineHeight: 0.4 }, x1 - d, 1.45, 8.5, -Math.PI / 2);
    put('clubSign', { width: 3.6, height: 1.0, depth: 0.12, lightColor: 0xffe0a0, lightIntensity: 1.5, ppm: 340 }, x1 - 0.08, 4.35, 0, -Math.PI / 2);
    put('doorWomen', { width: 0.9, height: 0.55, depth: 0.08, light: false }, x0 + 0.05, 3.15, (DOOR.z0 + DOOR.z1) / 2, Math.PI / 2);
    put('doorMen', { width: 1.3, height: 0.55, depth: 0.08, light: false }, x0 + 0.05, 2.75, 10.5, Math.PI / 2);
    // bathroom
    const B = BATH;
    put('mirror', { width: 1.4, height: 1.1, depth: 0.08, lightColor: 0xffffff, lightIntensity: 0.9 }, (B.x0 + B.x1) / 2 + 1.5, 1.65, B.z0 + 0.05, 0);
    put('sappho', { width: 1.8, height: 1.9, depth: 0.08, lightColor: 0xffe8f0, lineHeight: 0.36, lightIntensity: 1.6 }, B.x1 - 0.06, 1.55, 3.2, -Math.PI / 2);
    put('lovesong', { width: 1.5, height: 0.8, depth: 0.08, lightColor: 0xffffff, lightIntensity: 0.9 }, (B.x0 + B.x1) / 2 - 1.5, 1.8, B.z0 + 0.05, 0);
    for (const [i, args] of queue.entries()) {
      await yieldToBrowser();
      carve(...args);
      onProgress((i + 1) / queue.length);
    }
    // door sign lamp
    this.addLamp({ pos: new THREE.Vector3(x0 + 0.7, 3.9, (DOOR.z0 + DOOR.z1) / 2), target: new THREE.Vector3(x0, 2.9, (DOOR.z0 + DOOR.z1) / 2),
      color: 0xffc98a, intensity: 4, distance: 4, angle: Math.PI / 4, penumbra: 0.7, decay: 1.2 });
  }

  // --- disco rig ------------------------------------------------------------------
  buildLights() {
    const beamMat = (color) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: 0.3 } },
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0);
        vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uI; varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ float edge = pow(abs(dot(vN, vV)), 1.5); float a = pow(vY, 1.6) * edge * uI;
        gl_FragColor = vec4(uColor * a, a); }`,
    });
    const rig = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.08, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.9, roughness: 0.4 }));
    rig.rotation.x = Math.PI / 2;
    rig.position.set(DANCE.x, 6.3, DANCE.z);
    this.scene.add(rig);

    const N = Q.disco;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const color = PALETTE[i % PALETTE.length];
      // even lamps work the dance floor; odd lamps sweep the whole room
      const roams = i % 2 === 1;
      const spot = new THREE.SpotLight(color, 60, roams ? 24 : 16, roams ? Math.PI / 9 : Math.PI / 11, 0.45, 1.3);
      spot.position.set(DANCE.x + Math.cos(a) * 4.2, 6.2, DANCE.z + Math.sin(a) * 4.2);
      if (Q.shadows && i < 2) {
        spot.castShadow = true;
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0005;
      }
      this.scene.add(spot, spot.target);
      const len = 7;
      const beamGeo = new THREE.CylinderGeometry(0.06, Math.tan(Math.PI / 11) * len, len, 24, 1, true);
      beamGeo.translate(0, -len / 2, 0);
      beamGeo.rotateX(-Math.PI / 2); // point along -z... we orient with lookAt below
      const beam = new THREE.Mesh(beamGeo, beamMat(color));
      // uv.y is 1 at the top of the cylinder, so the beam is brightest at the lamp
      beam.position.copy(spot.position);
      this.scene.add(beam);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.3, emissive: color, emissiveIntensity: 0.4 }));
      head.position.copy(spot.position);
      this.scene.add(head);
      this.discoLights.push({ spot, beam, head, a, color, i, roams });
    }

    // low rim lights that graze the statues' contours
    this.rims = [];
    for (const [x, z, color] of [[-7.2, -6.5, 0xff2a8a], [7.2, -6.5, 0x2ad4ff], [0, 6.8, 0xffa020]].slice(0, Q.rims)) {
      const r = new THREE.SpotLight(color, 60, 14, Math.PI / 6, 0.7, 1.4);
      r.position.set(x, 0.4, z);
      r.target.position.set(DANCE.x, 1.4, DANCE.z);
      this.scene.add(r, r.target);
      this.rims.push(r);
    }

    this.animated.push({
      update: (dt, t, beat) => {
        for (const d of this.discoLights) {
          const k = t * (0.35 + d.i * 0.05) + d.a;
          if (d.roams) {
            // slow sweeps across the walls, the bar and the crowd
            const kk = t * 0.22 + d.a;
            const rr = 7 + 5 * (0.5 + 0.5 * Math.sin(t * 0.17 + d.i));
            d.spot.target.position.set(DANCE.x + Math.cos(kk) * rr, 1.2 + Math.sin(t * 0.5 + d.i), DANCE.z + Math.sin(kk) * rr);
          } else {
            const rr = 1.5 + 2.8 * (0.5 + 0.5 * Math.sin(t * 0.23 + d.i));
            d.spot.target.position.set(DANCE.x + Math.cos(k) * rr, 0, DANCE.z + Math.sin(k * 1.3) * rr);
          }
          const e = beat.energy ?? 0.7;
          const flash = (beat.bar % 4 === 3 && e > 0.8 ? (beat.pulse > 0.5 ? 1 : 0.15) : 0.35 + 0.65 * beat.pulse) * (0.35 + 0.65 * e);
          // walls don't stop unshadowed light, so the rig fades out while you're in the bathroom
          d.spot.intensity = 70 * flash * this.hallLights;
          d.beam.material.uniforms.uI.value = 0.22 * flash;
          d.beam.lookAt(d.spot.target.position);
          d.head.lookAt(d.spot.target.position);
          d.head.rotateX(Math.PI / 2);
          const ci = PALETTE[(d.i + Math.floor(beat.position / 8)) % PALETTE.length];
          d.spot.color.set(ci);
          d.beam.material.uniforms.uColor.value.set(ci);
          d.head.material.emissive.set(ci);
        }
        for (const [i, r] of this.rims.entries()) {
          r.intensity = 22 + 22 * Math.max(0, Math.sin(beat.position * Math.PI / 2 + i * 2.1));
        }
        for (const p of this.platters) p.rotation.y -= dt * 3.5;
        this.ceilingTex.offset.x += dt * 0.004;
      },
    });
  }

  // --- the mirror ball: specks of light swept across the room, and ceiling lasers ---------
  buildMirrorBall() {
    const c = new THREE.Vector3(DANCE.x, 5.4, DANCE.z);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 3),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.08, flatShading: true, emissive: 0x222222 }));
    ball.position.copy(c);
    this.scene.add(ball);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, HALL.h - c.y), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    rod.position.set(c.x, (HALL.h + c.y) / 2, c.z);
    this.scene.add(rod);

    // each speck is a ray from the ball; we intersect it with the hall's box analytically
    const N = Q.tier === 'high' ? 420 : 260;
    const dirs = [];
    for (let i = 0; i < N; i++) {
      const y = -0.15 - Math.random() * 0.85;      // mostly downwards and sideways
      const r = Math.sqrt(1 - y * y), a = Math.random() * Math.PI * 2;
      dirs.push(new THREE.Vector3(Math.cos(a) * r, y * (Math.random() < 0.25 ? -0.6 : 1), Math.sin(a) * r).normalize());
    }
    const geo = new THREE.PlaneGeometry(1, 1);
    const tex = (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(cv);
    })();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff,
      polygonOffset: true, polygonOffsetFactor: -4 });
    const specks = new THREE.InstancedMesh(geo, mat, N);
    specks.frustumCulled = false;
    this.scene.add(specks);
    const colors = dirs.map((_, i) => new THREE.Color(i % 5 === 0 ? PALETTE[i % PALETTE.length] : 0xfff4e0));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    const rot = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
    const up = new THREE.Vector3(0, 0, 1), tint = new THREE.Color();
    const planes = [
      { n: new THREE.Vector3(0, 1, 0), k: 'y', v: 0.03 }, { n: new THREE.Vector3(0, -1, 0), k: 'y', v: HALL.h - 0.02 },
      { n: new THREE.Vector3(1, 0, 0), k: 'x', v: HALL.x0 + 0.02 }, { n: new THREE.Vector3(-1, 0, 0), k: 'x', v: HALL.x1 - 0.02 },
      { n: new THREE.Vector3(0, 0, 1), k: 'z', v: HALL.z0 + 0.02 }, { n: new THREE.Vector3(0, 0, -1), k: 'z', v: HALL.z1 - 0.02 },
    ];
    let angle = 0;

    // lasers: thin additive beams from the ceiling, only really visible in the drops
    const lasers = [];
    const laserMat = (col) => new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const g = new THREE.CylinderGeometry(0.006, 0.006, 14, 4, 1, true);
      g.translate(0, -7, 0);
      const L = new THREE.Mesh(g, laserMat(i % 2 ? 0x30ff70 : 0xff2a50));
      const a = (i / 8) * Math.PI * 2;
      L.position.set(DANCE.x + Math.cos(a) * 6.5, HALL.h - 0.05, DANCE.z + Math.sin(a) * 6.5);
      this.scene.add(L);
      lasers.push({ L, a, i });
    }

    this.animated.push({
      update: (dt, t, beat) => {
        angle += dt * 0.35;
        ball.rotation.y = angle;
        rot.setFromAxisAngle(yAxis, angle);
        const energy = beat.energy ?? 0.7;
        mat.opacity = 0.35 + 0.5 * energy;
        for (let i = 0; i < N; i++) {
          d.copy(dirs[i]).applyQuaternion(rot);
          // nearest hit with the hall's six planes
          let best = Infinity, bp = null;
          for (const pl of planes) {
            const dc = d[pl.k];
            if (Math.abs(dc) < 1e-4) continue;
            const tt = (pl.v - c[pl.k]) / dc;
            if (tt > 0 && tt < best) { best = tt; bp = pl; }
          }
          pos.copy(c).addScaledVector(d, best);
          q.setFromUnitVectors(up, bp.n);
          // specks stretch as they hit surfaces at a glancing angle, like the real thing
          const size = 0.05 + best * 0.012;
          const graze = 1 / Math.max(0.25, Math.abs(d.dot(bp.n)));
          sc.set(size, size * Math.min(3, graze), 1);
          m4.compose(pos, q, sc);
          specks.setMatrixAt(i, m4);
          const tw = 0.6 + 0.4 * Math.sin(t * 3 + i * 1.7);
          specks.setColorAt(i, tint.setRGB(colors[i].r * tw, colors[i].g * tw, colors[i].b * tw));
        }
        specks.instanceMatrix.needsUpdate = true;
        specks.instanceColor.needsUpdate = true;

        const laserOn = energy > 0.9 ? 1 : 0;
        for (const l of lasers) {
          const sweep = t * 0.8 + l.a;
          l.L.rotation.set(0.5 * Math.sin(sweep) - 0.2, 0, 0.6 * Math.cos(sweep * 0.7) , 'YXZ');
          l.L.rotation.y = l.a;
          const strobe = beat.position % 1 < 0.5 ? 1 : 0.4;
          l.L.material.opacity += ((laserOn * strobe * 0.8) - l.L.material.opacity) * Math.min(1, dt * 8);
          l.L.visible = l.L.material.opacity > 0.01;
        }
      },
    });
  }

  addLamp(spec) {
    spec.bath = spec.pos.x < HALL.x0;
    this.lamps.push(spec);
  }

  update(dt, t, beat, sparkles, playerPos) {
    this.hallLights = THREE.MathUtils.clamp((playerPos.x - (HALL.x0 - 1.2)) / 1.2, 0, 1);
    this.pool.update(dt, this.lamps, playerPos, playerPos.x < HALL.x0);
    for (const a of this.animated) a.update(dt, t, beat);
    for (const s of this.slabs) s.update(dt, sparkles);
  }
}

// A handful of real spotlights shared by every lamp in the club. Each lamp is a spec;
// the nearest ones (in your room) get a real light, so the number of lights never changes
// and the GPU only pays for a few.
class LampPool {
  constructor(scene, n) {
    this.n = n;
    this.slots = [];
    for (let i = 0; i < n; i++) {
      const spot = new THREE.SpotLight(0xffffff, 0);
      scene.add(spot, spot.target);
      this.slots.push({ spot, lamp: null, level: 0 });
    }
    this.timer = 0;
  }

  update(dt, lamps, p, inBath) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.25;
      // lamps already lit get a head start, so they don't flicker on and off at the boundary
      const lit = new Set(this.slots.map(s => s.lamp));
      const want = lamps
        .map(l => [l, l.pos.distanceTo(p) + (l.bath !== inBath ? 40 : 0) - (lit.has(l) ? 2.5 : 0)])
        .sort((a, b) => a[1] - b[1]).slice(0, this.n).map(x => x[0]);
      const keep = new Set(want);
      for (const s of this.slots) if (s.lamp && !keep.has(s.lamp)) s.lamp = null;
      const assigned = new Set(this.slots.map(s => s.lamp));
      for (const l of want) {
        if (assigned.has(l)) continue;
        const s = this.slots.find(x => !x.lamp);
        s.lamp = l; s.level = 0;
        const sp = s.spot;
        sp.position.copy(l.pos); sp.target.position.copy(l.target);
        sp.color.set(l.color); sp.distance = l.distance; sp.angle = l.angle;
        sp.penumbra = l.penumbra; sp.decay = l.decay;
      }
    }
    for (const s of this.slots) {
      s.level = s.lamp ? Math.min(1, s.level + dt * 1.5) : 0;
      s.spot.intensity = s.lamp ? s.lamp.intensity * s.level : 0;
    }
  }
}
