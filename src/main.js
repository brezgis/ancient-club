import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { Q } from './quality.js';
import { loadFonts } from './glyphs.js';
import { World, HALL, BATH, DOOR, DANCE } from './world.js';
import { Sparkles } from './fx.js';
import { ClubAudio } from './audio.js';
import { SCRIPT_LABEL } from './slab.js';
import { loadManifest, loadStatue, standInStatue, Dancer } from './statues.js';
import { NEFERTITI, MENU, makeBartender, makeDancer, makeBathGirl, makeDJ } from './characters.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const state = {
  deben: 12, track: null, drinks: 0, drunk: 0, learned: new Set(),
  journal: new Map(), tried: new Set(),
};

// ---------------------------------------------------------------------------
await loadFonts();

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(params.has('lowres') ? Math.min(Q.pixelRatio, 0.75) : Q.pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = Q.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05040a);
scene.fog = new THREE.FogExp2(0x0b0714, 0.028);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.12;

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 120);
camera.rotation.order = 'YXZ';
const player = { pos: new THREE.Vector3(0, 0, 11.2), yaw: 0, pitch: -0.02, vel: new THREE.Vector3(), bob: 0, jump: 0, jumpV: 0 };
if (params.has('pos')) {
  const [x, z, yaw, pitch] = params.get('pos').split(',').map(Number);
  player.pos.set(x, 0, z); player.yaw = yaw ?? 0; player.pitch = pitch ?? 0;
}
const EYE = 1.62;
let resumed = null;
try { resumed = JSON.parse(sessionStorage.getItem('club-resume') ?? 'null'); sessionStorage.removeItem('club-resume'); } catch {}
if (resumed) { player.pos.set(resumed.x, 0, resumed.z); player.yaw = resumed.yaw; state.deben = resumed.deben ?? state.deben; }

const world = new World(scene);
const sparkles = new Sparkles();
scene.add(sparkles.points);
const audio = new ClubAudio();

// the bathroom mirror only renders while you're in the bathroom
const ms = world.mirrorSpec;
const mirror = new Reflector(new THREE.PlaneGeometry(ms.w, ms.h), {
  textureWidth: Q.mirrorRes, textureHeight: Q.mirrorRes / 2, color: 0xe6ebef,
});
mirror.position.set(ms.x + 0.035, ms.y, ms.z);
mirror.rotation.y = Math.PI / 2;
mirror.visible = false;
scene.add(mirror);
const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.02, ms.h + 0.14, ms.w + 0.14),
  new THREE.MeshStandardMaterial({ color: 0xd4a040, metalness: 1, roughness: 0.3 }));
mirrorFrame.position.set(ms.x + 0.01, ms.y, ms.z);
scene.add(mirrorFrame);

// ---------------------------------------------------------------------------
// post-processing: bloom for the disco, and a wobble for the wine
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = min(c, vec4(64.0));
    }`,
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth * Q.bloomScale, innerHeight * Q.bloomScale), 0.55, 0.6, 0.82);
composer.addPass(bloom);
// the composer resizes every pass to full resolution; bloom only needs a fraction of it
const sizeBloom = () => bloom.setSize(innerWidth * Q.bloomScale, innerHeight * Q.bloomScale);
sizeBloom();
const drunkPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uDrunk: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uDrunk; uniform float uTime; varying vec2 vUv;
    void main(){
      vec2 uv = vUv;
      float d = uDrunk;
      uv += d * 0.006 * vec2(sin(uv.y * 9.0 + uTime * 1.3), cos(uv.x * 7.0 + uTime * 1.1));
      vec2 off = d * 0.004 * vec2(sin(uTime * 0.9), cos(uTime * 0.7));
      vec4 c = texture2D(tDiffuse, uv);
      vec4 g1 = texture2D(tDiffuse, uv + off * 3.0);
      c.r = mix(c.r, texture2D(tDiffuse, uv + off).r, min(1.0, d));
      c.b = mix(c.b, texture2D(tDiffuse, uv - off).b, min(1.0, d));
      c = mix(c, (c + g1) * 0.5, min(0.5, d * 0.25));
      float vig = smoothstep(0.95, 0.35, length(vUv - 0.5));
      c.rgb *= mix(1.0, vig, 0.35 + min(0.4, d * 0.1));
      gl_FragColor = c;
    }`,
});
composer.addPass(drunkPass);
composer.addPass(new OutputPass());

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (innerWidth < 16 || innerHeight < 16) return;   // minimised / covered: keep the last good size
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    sizeBloom();
  }, 120);
});

// If the GPU drops our context (it can happen on laptops when other apps grab the GPU),
// save where you were and reload instead of leaving a black canvas.
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  try { sessionStorage.setItem('club-resume', JSON.stringify({ x: player.pos.x, z: player.pos.z, yaw: player.yaw, deben: state.deben })); } catch {}
  $('lost').classList.add('show');
});
renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());

// ---------------------------------------------------------------------------
// statues
const dancers = [];
const people = [];          // interactive statues: {dancer, character}
const infoObjects = [];     // non-dancing scans with a label

function short(t) { return (t ?? '').split(/[,(:;]/)[0].trim(); }

// Who plays whom. Each scan is cast by slug; anything missing falls back to a stand-in.
// Materials follow what the scan actually is: the SMK scans are plaster casts, so they're white.
const CAST = {
  dancers: [
    { slug: 'kaaper', name: 'Kaaper, “the Village Headman”', h: 2.1, kind: 'plaster', moves: ['hop', 'lean', 'spin', 'wobble'] },
    { slug: 'khonsu', name: 'Khonsu, the Moon God', h: 2.3, kind: 'granodiorite', moves: ['lean', 'shuffle', 'hop', 'spin'] },
    { slug: 'khafre', name: 'King Khafre', h: 2.0, kind: 'plaster', moves: ['wobble', 'spin', 'shuffle', 'lean'] },
    { slug: 'ramesses_ii_mahg', name: 'Ramesses II', h: 2.1, kind: 'granodiorite', moves: ['spin', 'hop', 'wobble', 'shuffle'] },
    { slug: 'standing_man_mahg', name: 'A Very Small Wooden Man (Enlarged)', h: 1.8, kind: 'sandstone', moves: ['hop', 'shuffle', 'hop', 'spin'] },
    { slug: 'thutmose_iii', name: 'Thutmose III', h: 1.95, kind: 'granodiorite', moves: ['lean', 'wobble', 'spin', 'hop'] },
    { slug: 'bekenkhons', name: 'Bakenkhons, in a Block', h: 1.7, kind: 'plaster', moves: ['hop', 'hop', 'spin', 'wobble'] },
  ],
  dj: { slug: 'hapi_scribe', h: 1.25, kind: 'limestone' },
  bar: { slug: 'woman_grinding_grain', h: 1.2, kind: 'plaster' },
  bath: [
    { slug: 'aphrodite_dolphin', h: 1.75, kind: 'marble', at: 0, facing: Math.PI / 2 + 0.5 },
    { slug: 'sekhmet_mahg', h: 1.9, kind: 'granodiorite', at: 2, facing: Math.PI * 1.1, name: 'Sekhmet, Off Duty' },
    { slug: 'amarna_princess', h: 0.42, kind: 'plaster', counter: 5.0, facing: -Math.PI / 2 + 0.9, name: 'An Amarna Princess' },
    { slug: 'amarna_princess_2', h: 0.46, kind: 'plaster', counter: 7.0, facing: Math.PI / 2 + 0.9, name: 'Her Sister, Also an Amarna Princess' },
  ],
  display: [
    { slug: 'taharqa_stela', h: 1.9, kind: 'plaster', p: [5, 13.3], ry: Math.PI },
    { slug: 'ramesside_queen_relief', h: 2.1, kind: 'plaster', p: [-12.7, -12.7], ry: Math.PI / 4 },
  ],
  // regulars propping up the bar (busts and half-figures, so they sit on stools)
  patrons: [
    { slug: 'royal_couple_mahg', name: 'King Ay & Queen Tey, on a Date', h: 0.95, kind: 'limestone' },
    { slug: 'young_queen_nefertiti', name: 'Young Nefertiti (Just the Head)', h: 0.6, kind: 'plaster' },
    { slug: 'priest_hor_mahg', name: 'Hor the Priest, and His Plus-One (Osiris)', h: 1.0, kind: 'granodiorite' },
  ],
  // they start against the walls, but everyone gets pulled onto the floor eventually
  wallflowers: [
    { slug: 'nemtynakht_mahg', name: 'Nemtynakht, Wallflower', h: 1.5, kind: 'sandstone', moves: ['hop', 'lean', 'wobble', 'spin'] },
    { slug: 'princess_mahg', name: 'A Middle Kingdom Princess', h: 1.6, kind: 'limestone', moves: ['lean', 'spin', 'hop', 'wobble'] },
    { slug: 'aphrodite_mahg', name: 'Aphrodite (Lost Her Head on the Dance Floor)', h: 1.7, kind: 'marble', moves: ['wobble', 'lean', 'spin', 'shuffle'] },
  ],
};

// --- where statues can be: the floor, against the walls, at the bar, on a stool --------
function buildSpots() {
  const spots = [];
  const face = (x, z) => Math.atan2(DANCE.x - x, DANCE.z - z);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.4;
    const r = i % 2 ? 3.4 : 2.9;
    spots.push({ kind: 'floor', pos: new THREE.Vector3(DANCE.x + Math.cos(a) * r, 0.04, DANCE.z + Math.sin(a) * r), facing: Math.atan2(Math.cos(a), Math.sin(a)) });
  }
  for (const [x, z] of [[-12.6, -5.3], [10.6, -12.6], [-12.4, 12.4], [12.5, -12.3], [-12.6, 8.2], [9.3, 12.7], [-10.8, -12.6], [12.6, 11.9], [-9.4, 12.7]]) {
    spots.push({ kind: 'wall', pos: new THREE.Vector3(x, 0, z), facing: face(x, z) });
  }
  const cols = [...Array(8)].map((_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return [DANCE.x + Math.cos(a) * 8.6, DANCE.z + Math.sin(a) * 8.6]; });
  for (const z of [-4.6, -3.4, -2.2, -0.6, 0.6, 2.2, 3.4, 4.6]) {
    const x = 7.75;
    const nearStool = world.stoolZ.some(sz => Math.abs(sz - z) < 0.55);
    const nearCol = cols.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 1.25);
    if (!nearStool && !nearCol) spots.push({ kind: 'bar', pos: new THREE.Vector3(x, 0, z), facing: Math.PI / 2 });
  }
  world.stoolZ.forEach((z, i) => spots.push({ kind: 'stool', pos: new THREE.Vector3(world.stoolX, 0.8, z), facing: i % 2 ? Math.PI / 2 : -Math.PI / 2 + 0.5 }));
  return spots;
}
let SPOTS = [];
const mobile = [];   // statues the social director may send around the room

function place(d, spot) {
  spot.occupant = d;
  d.spot = spot;
  d.anchor.copy(spot.pos);
  d.root.position.copy(spot.pos);
  d.facing = d.homeFacing = spot.facing;
}
function freeSpot(kind) {
  const free = SPOTS.filter(s => s.kind === kind && !s.occupant);
  return free[Math.floor(Math.random() * free.length)];
}

// Every so often someone leaves the floor for a drink or a lean on the wall, and someone comes back.
let directorTimer = 12;
function socialDirector(dt) {
  directorTimer -= dt;
  if (directorTimer > 0 || !mobile.length) return;
  directorTimer = 7 + Math.random() * 8;
  const onFloor = mobile.filter(d => d.spot?.kind === 'floor').length;
  const candidates = mobile.filter(d => !d.talking && !d.partner && !d.travel);
  const d = candidates[Math.floor(Math.random() * candidates.length)];
  if (!d) return;
  let kind;
  if (d.spot?.kind === 'floor') kind = onFloor <= 5 ? null : (Math.random() < 0.55 ? 'bar' : 'wall');
  else kind = onFloor < 7 || Math.random() < 0.7 ? 'floor' : (d.spot?.kind === 'bar' ? 'wall' : 'bar');
  if (!kind) return;
  const to = freeSpot(kind);
  if (!to) return;
  if (d.spot) d.spot.occupant = null;
  to.occupant = d;
  d.moveTo(to);
}

async function placeStatues() {
  const manifest = await loadManifest();
  SPOTS = buildSpots();
  const bySlug = Object.fromEntries(manifest.map(m => [m.slug, m]));
  const load = async (info, h, kind, female) => {
    if (!info) return standInStatue(h, kind, female);
    try { return await loadStatue(info, h, kind); }
    catch (e) { console.warn('failed to load', info.file, e); return standInStatue(h, kind, female); }
  };
  let n = 0;
  const total = manifest.length || 1;
  const tick = (name) => { $('loading').textContent = `Waking the statues… ${++n}/${total} ${name ?? ''}`; };
  const jobs = [];

  // Nefertiti, hovering in the middle of the floor (the museum's own scan, in colour)
  jobs.push((async () => {
    const obj = await load(bySlug.nefertiti, 1.0, 'limestone', true);
    tick('Nefertiti');
    const d = new Dancer(obj, new THREE.Vector3(DANCE.x, 0.72, DANCE.z), { moves: ['headslide', 'nod', 'headslide', 'spin'], bust: true, facing: 0 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.14, 32),
      new THREE.MeshStandardMaterial({ color: 0x1b3fa0, roughness: 0.3, metalness: 0.3, emissive: 0x0a1a60, emissiveIntensity: 0.8 }));
    plinth.position.y = -0.08;
    d.body.add(plinth);
    if (Q.tier === 'high') {
      const glow = new THREE.PointLight(0xffe0b0, 3, 3, 1.5);
      glow.position.set(0, 1.4, 0.8);
      d.root.add(glow);
    }
    addPerson(d, NEFERTITI);
    world.nefertiti = d;
  })());

  // the dancers, in a ring around her, facing out so you meet their faces
  CAST.dancers.forEach((c, i, arr) => {
    const info = bySlug[c.slug];
    jobs.push((async () => {
      const obj = await load(info, c.h, c.kind, false);
      tick(short(info?.title));
      const spot = SPOTS.filter(s => s.kind === 'floor')[[0, 1, 3, 4, 6, 7, 9][i] ?? i];
      const d = new Dancer(obj, spot.pos, { moves: c.moves, phase: i * 0.37, energy: 0.8 + (i % 3) * 0.15 });
      place(d, spot);
      mobile.push(d);
      addPerson(d, makeDancer(info && { ...info, displayName: c.name ?? short(info.title) }, i));
    })());
  });

  // wallflowers (mobile, full figures)
  CAST.wallflowers.forEach((c, i) => {
    const info = bySlug[c.slug];
    if (!info) return;
    jobs.push((async () => {
      const obj = await load(info, c.h, c.kind, false);
      tick(short(info.title));
      const spot = SPOTS.filter(s => s.kind === 'wall')[i * 3];
      const d = new Dancer(obj, spot.pos, { moves: c.moves, phase: i * 0.71, energy: 0.85 });
      d.moveTo(spot); d.travel = false; place(d, spot);
      mobile.push(d);
      addPerson(d, makeDancer({ ...info, displayName: c.name }, i + 7));
    })());
  });

  // bar regulars on the stools
  CAST.patrons.forEach((c, i) => {
    const info = bySlug[c.slug];
    const spot = SPOTS.filter(s => s.kind === 'stool')[i];
    if (!info || !spot) return;
    jobs.push((async () => {
      const obj = await load(info, c.h, c.kind, false);
      tick(short(info.title));
      const d = new Dancer(obj, spot.pos, { moves: ['nod'], phase: i * 0.5, energy: 0.45, bust: true });
      d.moveTo(spot); d.travel = false; place(d, spot);
      addPerson(d, makeDancer({ ...info, displayName: c.name }, i + 3));
    })());
  });

  // the scribe on the decks
  jobs.push((async () => {
    const info = bySlug[CAST.dj.slug];
    const obj = await load(info, CAST.dj.h, CAST.dj.kind, false);
    tick('the DJ');
    const d = new Dancer(obj, world.djAnchor.clone().setY(0.75), { moves: ['nod', 'nod', 'lean', 'nod'], facing: 0, energy: 0.6, bust: true });
    addPerson(d, makeDJ(info));
    world.dj = d;
  })());

  // the barkeep: a servant who grinds the grain that becomes bread and beer
  jobs.push((async () => {
    const info = bySlug[CAST.bar.slug];
    const obj = await load(info, CAST.bar.h, CAST.bar.kind, true);
    tick('the barkeep');
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.9), new THREE.MeshStandardMaterial({ color: 0x4a2e16, roughness: 0.8 }));
    crate.position.copy(world.barAnchor).setY(0.375);
    scene.add(crate);
    const anchor = world.barAnchor.clone().setY(0.75);
    const d = new Dancer(obj, anchor, { moves: ['nod', 'lean', 'nod', 'wobble'], facing: -Math.PI / 2, energy: 0.5, bust: true });
    addPerson(d, makeBartender(info && { ...info, displayName: 'Nebet, the Barkeep', who: 'a servant statue from an Old Kingdom tomb, grinding grain for eternity’s bread and beer' }));
    world.bartender = d;
  })());

  // the girls in the bathroom
  CAST.bath.forEach((c, i) => {
    const info = bySlug[c.slug];
    jobs.push((async () => {
      const obj = await load(info, c.h, c.kind, true);
      tick(short(info?.title));
      const anchor = c.counter != null
        ? new THREE.Vector3(BATH.x0 + 0.38, 0.9, c.counter)
        : world.bathAnchors[c.at];
      const d = new Dancer(obj, anchor, { moves: ['tipsy', 'lean', 'tipsy', 'wobble'], facing: c.facing, energy: 0.35, bust: true, phase: i * 1.3 });
      addPerson(d, makeBathGirl(info && { ...info, displayName: c.name ?? short(info.title) }, i));
    })());
  });

  // a real Greek wine cup on the bar
  if (bySlug.kylix) {
    jobs.push((async () => {
      const cup = await load(bySlug.kylix, 0.1, 'sandstone');
      for (const z of [-2.2, 1.4, 3.6]) {
        const obj = cup.clone();
        obj.position.set(9.5, world.barCounterTop, z);
        obj.rotation.y = z;
        scene.add(obj);
        registerInfo(obj, bySlug.kylix, 0.3);
      }
      tick('a kylix');
    })());
  }

  // museum pieces on display, each with its own lamp
  for (const c of CAST.display) {
    const info = bySlug[c.slug];
    if (!info) continue;
    jobs.push((async () => {
      const obj = await load(info, c.h, c.kind);
      tick(short(info.title));
      const [x, z] = c.p;
      const base = c.plinth ? 0.9 : 0;
      if (c.plinth) {
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), world.slabs[0].body.material[0]);
        plinth.position.set(x, 0.45, z);
        scene.add(plinth);
      }
      obj.position.set(x, base, z);
      obj.rotation.y = c.ry;
      scene.add(obj);
      world.circles.push({ x, z, r: c.plinth ? 0.6 : 0.8 });
      world.addLamp({
        pos: new THREE.Vector3(x + Math.sin(c.ry) * 1.6, base + c.h + 1.6, z + Math.cos(c.ry) * 1.6),
        target: new THREE.Vector3(x, base + c.h * 0.5, z),
        color: 0xffd8a0, intensity: 18, distance: 7, angle: Math.PI / 6, penumbra: 0.6, decay: 1.3,
      });
      registerInfo(obj, info, 0.7);
    })());
  }

  await Promise.all(jobs);
  $('loading').textContent = '';
  window.__manifest = manifest;
  renderCredits(manifest);
}

function addPerson(d, character) {
  scene.add(d.root);
  d.root.traverse(o => { o.userData.skipOcc = true; });
  dancers.push(d);
  people.push({ dancer: d, character });
  d.hit.userData.person = people[people.length - 1];
  world.circles.push({ dyn: d, r: d.radius });
}

function registerInfo(obj, info, r) {
  obj.traverse(o => { o.userData.skipOcc = true; });
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.copy(box.getCenter(new THREE.Vector3()));
  hit.userData.info = info;
  scene.add(hit);
  infoObjects.push(hit);
}

// ---------------------------------------------------------------------------
// input
const keys = new Set();
let locked = false, dialogueOpen = false, overlayOpen = false;
const canvas = renderer.domElement;

function lock() { if (!dialogueOpen && !overlayOpen) canvas.requestPointerLock?.(); }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  document.body.classList.toggle('locked', locked);
  if (!locked && !dialogueOpen && !overlayOpen && started) $('paused').classList.add('show');
  else $('paused').classList.remove('show');
});
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * 0.0022, -1.45, 1.45);
});
canvas.addEventListener('mousedown', (e) => {
  if (!started) return;
  if (!locked) { lock(); return; }
  if (e.button === 0) interact();
});
addEventListener('keydown', (e) => {
  if (!started) return;
  if (e.code === 'KeyL') { cycleScript(); return; }
  if (dialogueOpen) {
    if (e.code === 'Escape') closeDialogue();
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) $('options').children[n - 1]?.click();
    return;
  }
  if (overlayOpen) {
    if (['Escape', 'KeyJ', 'KeyC'].includes(e.code)) closeOverlays();
    return;
  }
  keys.add(e.code);
  if (e.code === 'KeyE' || e.code === 'KeyF') interact();
  if (e.code === 'KeyJ') openOverlay('journal');
  if (e.code === 'KeyC') openOverlay('credits');
  if (e.code === 'KeyM') toast(audio.toggleMute() ? 'Music muted' : 'Music on');
  if (e.code === 'KeyN') { audio.start(); audio.nextTrack(); toast('Hapi is mixing in the next track…'); }
  if (e.code === 'KeyQ') {
    if (dancingWith) stopDancing();
    else if (hovered?.kind === 'person') startDancing(hovered.obj);
  }
  if (e.code === 'Space' && player.jump === 0) { player.jumpV = 3.2; player.jump = 0.0001; }
  if (e.code === 'Tab') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// ---------------------------------------------------------------------------
// movement and collisions
function collide(p, r) {
  for (let it = 0; it < 2; it++) {
    for (const b of world.colliders) {
      const cx = THREE.MathUtils.clamp(p.x, b.x0, b.x1), cz = THREE.MathUtils.clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-5) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
        else {
          // inside the box: push out the shortest way
          const opts = [[b.x0 - r - p.x, 0], [b.x1 + r - p.x, 0], [0, b.z0 - r - p.z], [0, b.z1 + r - p.z]];
          opts.sort((a, c) => Math.hypot(...a) - Math.hypot(...c));
          p.x += opts[0][0]; p.z += opts[0][1];
        }
      }
    }
    for (const c of world.circles) {
      const cx = c.dyn ? c.dyn.root.position.x : c.x, cz = c.dyn ? c.dyn.root.position.z : c.z;
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), R = r + c.r;
      if (d < R && d > 1e-5) { p.x = cx + dx / d * R; p.z = cz + dz / d * R; }
    }
  }
}

const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();
function movePlayer(dt) {
  if (dialogueOpen || overlayOpen) { player.vel.multiplyScalar(0.8); }
  wish.set(0, 0, 0);
  if (!dialogueOpen && !overlayOpen) {
    fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    right.set(-fwd.z, 0, fwd.x);
    if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(fwd);
    if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(fwd);
    if (keys.has('KeyD') || keys.has('ArrowRight')) wish.add(right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) wish.sub(right);
  }
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5.2 : 2.8;
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
  // a little stagger after a few drinks
  if (state.drunk > 0.5 && wish.lengthSq() > 0) {
    const t = performance.now() / 1000;
    wish.addScaledVector(right, Math.sin(t * 1.3) * Math.min(1.2, state.drunk * 0.25));
  }
  player.vel.lerp(wish, Math.min(1, dt * 10));
  player.pos.addScaledVector(player.vel, dt);
  collide(player.pos, 0.32);
  const moving = player.vel.length();
  player.bob += dt * moving * 2.4;
  if (player.jump > 0) {
    player.jumpV -= 9.8 * dt;
    player.jump += player.jumpV * dt;
    if (player.jump <= 0) { player.jump = 0; player.jumpV = 0; }
  }
}

// ---------------------------------------------------------------------------
// looking at things
const ray = new THREE.Raycaster();
ray.far = 4.5;
let hovered = null;         // {kind:'line'|'person'|'info', obj, dist}
let occluders = [];

function collectOccluders() {
  occluders = [];
  scene.traverse((o) => {
    if (o.isMesh && !o.userData.line && o !== mirror && o.geometry && !o.isInstancedMesh && o.material?.visible !== false) {
      if (o.userData.skipOcc) return;
      if (o.material?.blending === THREE.AdditiveBlending || o.material?.transparent) return;  // light beams, lasers
      occluders.push(o);
    }
  });
}

function updateHover() {
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  const targets = [];
  for (const s of world.slabs) for (const l of s.lines) targets.push(l.mesh);
  for (const p of people) targets.push(p.dancer.hit);
  targets.push(...infoObjects);
  const hits = ray.intersectObjects(targets, false);
  let h = null;
  if (hits.length) {
    const first = hits[0];
    const occ = ray.intersectObjects(occluders, false).find(o => o.distance < first.distance - 0.05 && !isInsideSlab(o.object));
    if (!occ) {
      const u = first.object.userData;
      if (u.line && first.distance < 4.2) h = { kind: 'line', obj: u.line, dist: first.distance };
      else if (u.person && first.distance < 3.4) h = { kind: 'person', obj: u.person, dist: first.distance };
      else if (u.info && first.distance < 3.4) h = { kind: 'info', obj: u.info, dist: first.distance };
    }
  }
  if (hovered?.kind === 'line' && hovered.obj !== h?.obj) hovered.obj.hover = 0;
  hovered = h;
  if (h?.kind === 'line') h.obj.hover = 1;
  renderHoverUI();
}
function isInsideSlab(o) { return world.slabs.some(s => s.body === o); }

function renderHoverUIRaw() {
  const prompt = $('prompt');
  const cap = $('caption');
  if (!hovered || dialogueOpen) {
    prompt.classList.remove('show');
    cap.classList.remove('show');
    return;
  }
  prompt.classList.add('show');
  if (hovered.kind === 'line') {
    const l = hovered.obj, def = l.slab.def;
    const cur = l.current, nxt = l.next;
    prompt.innerHTML = l.transition ? '<span class="sparkle">✦ carving… ✦</span>'
      : `<kbd>E</kbd> ${nxt === l.def.stages[0] ? 'turn back into' : 'translate into'} <b>${SCRIPT_LABEL[nxt.script]}</b>`;
    cap.classList.add('show');
    const chips = l.def.stages.map((s, i) => `<span class="chip ${i === l.stage ? 'on' : ''}">${SCRIPT_LABEL[s.script]}</span>`).join('<span class="arrow">→</span>');
    const fid = { attested: 'standard, attested spelling', reconstructed: 'real words · my sign-by-sign typesetting', original: 'original text' }[l.def.fidelity];
    cap.innerHTML = `<div class="cap-title">${def.title}</div><div class="cap-object">${def.object}</div>
      <div class="chips">${chips}</div>
      ${l.translatedOnce || l.stage > 0 ? `<div class="cap-note">${l.def.note ?? ''}</div>` : '<div class="cap-hint">Press E to translate, and the note appears here.</div>'}
      <div class="cap-fid ${l.def.fidelity}">${fid}</div>`;
  } else if (hovered.kind === 'person') {
    cap.classList.remove('show');
    prompt.innerHTML = dancingWith === hovered.obj.dancer
      ? `dancing with <b>${hovered.obj.character.name}</b> · <kbd>Q</kbd> stop · <kbd>Space</kbd> hop`
      : `<kbd>E</kbd> talk · <kbd>Q</kbd> dance with <b>${hovered.obj.character.name}</b>`;
  } else {
    const i = hovered.obj;
    prompt.innerHTML = `<kbd>E</kbd> read the label`;
    cap.classList.add('show');
    cap.innerHTML = `<div class="cap-title">${i.title}</div><div class="cap-object">${[i.date, i.material, i.museum, i.accession_number].filter(Boolean).join(' · ')}</div>
      <div class="cap-note">${(i.facts ?? []).join(' ')}</div><div class="cap-fid original">3D scan · ${i.license ?? 'license: see credits'}</div>`;
  }
}

function renderHoverUI() {
  renderHoverUIRaw();
  if (state.script !== 'english') {
    $('prompt').innerHTML = scriptify($('prompt').innerHTML);
    $('caption').innerHTML = scriptify($('caption').innerHTML);
  }
}

function interact() {
  audio.start();
  if (!hovered) return;
  if (hovered.kind === 'line') {
    const l = hovered.obj;
    if (l.advance()) audio.chime(l.transition.dur);
    renderHoverUI();
  } else if (hovered.kind === 'person') {
    openDialogue(hovered.obj);
  } else if (hovered.kind === 'info') {
    const i = hovered.obj;
    state.journal.set(`obj:${i.slug}`, { title: i.title, lines: [[i.date, i.museum].filter(Boolean).join(' · '), ...(i.facts ?? [])] });
    toast('Added to your papyrus (J)');
  }
}

function onLineDone(line) {
  const def = line.slab.def;
  const key = `${line.slab.key}:${line.index}`;
  state.journal.set(key, {
    title: def.title,
    lines: line.def.stages.map(s => `<span class="jl-${s.script}">${s.script === 'hiero' ? '𓂋' : ''}${s.script === 'hiero' ? '' : s.text}</span>`),
    stages: line.def.stages, note: line.def.note,
  });
  if (def.music === 'seikilos') audio.playSeikilos();
  renderHoverUI();
}
for (const s of world.slabs) s.onLineDone = onLineDone;

// ---------------------------------------------------------------------------
// dialogue
let talk = null;  // {person, node}
function openDialogue(person) {
  dialogueOpen = true;
  document.exitPointerLock?.();
  talk = { person };
  person.dancer.talking = true;
  person.dancer.lookAt = player.pos;
  $('dialogue').classList.add('show');
  setHTML($('dname'), person.character.name);
  setHTML($('dsub'), person.character.subtitle);
  goto(person.character.start);
}

function goto(id) {
  if (id === null) return dialogueOpen && closeDialogue();
  const ch = talk.person.character;
  const node = ch.nodes[id];
  talk.node = id;
  setHTML($('dname'), ch.name);
  setHTML($('dsub'), ch.subtitle);
  node.onEnter?.(state);
  if (node.action) runAction(node.action);
  const text = typeof node.text === 'function' ? node.text(state) : node.text;
  setHTML($('dtext'), text);
  const opts = typeof node.options === 'function' ? node.options(state) : node.options;
  const box = $('options');
  box.innerHTML = '';
  box.classList.toggle('many', opts.length > 4);
  opts.forEach((o, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="num">${i + 1}</span>${scriptify(o.label)}`;
    b.disabled = !!o.disabled;
    b.onclick = () => {
      if (o.disabled) return;
      if (o.action) { const next = runAction(o.action); if (next !== undefined) return goto(next); }
      goto(o.to === undefined ? talk.node : o.to);
    };
    box.appendChild(b);
  });
  $('dtext').scrollTop = 0;
}

function runAction(a) {
  if (a === 'seikilos') { audio.start(); audio.playSeikilos(); return undefined; }
  if (a === 'nextTrack') { audio.start(); audio.nextTrack(); return undefined; }
  if (a === 'dance') {
    const person = talk.person;
    if (person.dancer === world.nefertiti) {
      person.dancer.special = 2.4;
      burst(person.dancer.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 260);
    }
    closeDialogue();
    startDancing(person);
    return null;
  }
  if (a.startsWith('buy:')) {
    const m = MENU.find(x => x.id === a.slice(4));
    if (m.price > state.deben) return 'broke';
    state.deben -= m.price;
    state.drinks += m.drunk > 0 ? 1 : 0;
    state.drunk = Math.max(0, state.drunk + m.drunk);
    state.lastServed = m;
    state.tried.add(m.name);
    state.journal.set(`drink:${m.id}`, { title: `At the bar: ${m.name}`, lines: [m.fact] });
    audio.clink();
    updateWallet();
    const b = world.bartender;
    if (b) burst(b.root.position.clone().add(new THREE.Vector3(-1.6, 1.3, 0)), 80, 0xff9a50);
    return 'served';
  }
}

let dancingWith = null;
function startDancing(person) {
  audio.start();
  if (dancingWith) dancingWith.partner = false;
  dancingWith = person.dancer;
  dancingWith.partner = true;
  dancingWith.lookAt = player.pos;
  toast(`You’re dancing with ${person.character.name} ✦`);
  burst(dancingWith.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 120);
}
function stopDancing() {
  if (!dancingWith) return;
  dancingWith.partner = false;
  dancingWith = null;
}

function closeDialogue() {
  if (talk) talk.person.dancer.talking = false;
  talk = null;
  dialogueOpen = false;
  $('dialogue').classList.remove('show');
  lock();
}

function burst(p, n, color = 0xffd27a) {
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(0.6 + Math.random() * 1.8);
    sparkles.emit(p, v, Math.random() < 0.75 ? color : 0x9fd8ff, 0.8 + Math.random(), 0.03 + Math.random() * 0.04);
  }
}

// ---------------------------------------------------------------------------
// overlays
function openOverlay(which) {
  overlayOpen = true;
  document.exitPointerLock?.();
  if (which === 'journal') renderJournal();
  $(which).classList.add('show');
}
function closeOverlays() {
  overlayOpen = false;
  $('journal').classList.remove('show');
  $('credits').classList.remove('show');
  lock();
}
document.querySelectorAll('.close').forEach(b => b.addEventListener('click', closeOverlays));

function renderJournal() {
  const entries = [...state.journal.values()];
  const body = $('journal-body');
  if (!entries.length) {
    body.innerHTML = '<p class="empty">Your papyrus is blank. Translate an inscription (look at a line and press E), talk to a statue, or buy a drink.</p>';
    return;
  }
  body.innerHTML = entries.map(e => {
    if (e.stages) {
      return `<div class="entry"><h3>${e.title}</h3>${e.stages.map(s => `<div class="st st-${s.script}"><span class="lab">${SCRIPT_LABEL[s.script]}</span> ${s.script === 'hiero' ? `<code>${s.text}</code>` : s.text}</div>`).join('')}<p class="note">${e.note ?? ''}</p></div>`;
    }
    return `<div class="entry"><h3>${e.title}</h3>${e.lines.map(l => `<p class="note">${l}</p>`).join('')}</div>`;
  }).join('') + (state.learned?.size ? `<div class="entry"><h3>Words from Nefertiti</h3><p>${[...state.learned].map(w => `<i>${w}</i>`).join(', ')}</p></div>` : '');
}

function renderCredits(manifest) {
  const rows = manifest.map(m => `<li><b>${m.title}</b>${m.museum ? `, ${m.museum}` : ''}${m.accession_number ? ` (${m.accession_number})` : ''}<br>
    <span class="lic">${m.license ?? ''}${m.attribution ? ' · ' + m.attribution : ''}</span>${m.source_url ? ` · <a href="${m.source_url}" target="_blank" rel="noopener">source</a>` : ''}</li>`).join('');
  $('credits-models').innerHTML = rows || '<li>No scans loaded yet. The statues are stand-ins.</li>';
}

// --- the script toggle: English spelled in Greek letters, or in hieroglyphic "alphabet" signs.
// Purely for laughs. Neither is real Greek or real Egyptian, and the toast says so.
const GREEK = [['th', 'θ'], ['ph', 'φ'], ['ch', 'χ'], ['ps', 'ψ'], ['ks', 'ξ'], ['ee', 'η'], ['oo', 'ου'], ['ou', 'ου'], ['sh', 'σ'],
  ['a', 'α'], ['b', 'β'], ['c', 'κ'], ['d', 'δ'], ['e', 'ε'], ['f', 'φ'], ['g', 'γ'], ['h', ''], ['i', 'ι'], ['j', 'ι'], ['k', 'κ'],
  ['l', 'λ'], ['m', 'μ'], ['n', 'ν'], ['o', 'ο'], ['p', 'π'], ['q', 'κ'], ['r', 'ρ'], ['s', 'σ'], ['t', 'τ'], ['u', 'υ'], ['v', 'β'],
  ['w', 'ου'], ['x', 'ξ'], ['y', 'υ'], ['z', 'ζ']];
const HIERO = [['sh', '𓈙'], ['ch', '𓍿'], ['kh', '𓐍'], ['a', '𓄿'], ['b', '𓃀'], ['c', '𓎡'], ['d', '𓂧'], ['e', '𓇋'], ['f', '𓆑'], ['g', '𓎼'],
  ['h', '𓉔'], ['i', '𓇋'], ['j', '𓆓'], ['k', '𓎡'], ['l', '𓃭'], ['m', '𓅓'], ['n', '𓈖'], ['o', '𓍯'], ['p', '𓊪'], ['q', '𓈎'], ['r', '𓂋'],
  ['s', '𓋴'], ['t', '𓏏'], ['u', '𓅱'], ['v', '𓆑'], ['w', '𓅱'], ['x', '𓎡𓋴'], ['y', '𓇌'], ['z', '𓊃']];
const SCRIPTS = ['english', 'greek', 'hiero'];
state.script = 'english';

function spell(word, table, greek) {
  let out = '', i = 0;
  const lower = word.toLowerCase();
  while (i < word.length) {
    const m = table.find(([k]) => lower.startsWith(k, i));
    if (!m) { out += word[i]; i++; continue; }
    let v = m[1];
    if (greek && word[i] !== lower[i]) v = v.toUpperCase();
    out += v; i += m[0].length;
  }
  if (greek) out = out.replace(/σ(?![\p{L}])/gu, 'ς');
  return out;
}
// transform the text of an HTML string, leaving tags, <kbd> keys and non-Latin text alone
function scriptify(html) {
  if (state.script === 'english' || html == null) return html;
  const table = state.script === 'greek' ? GREEK : HIERO;
  let inKbd = false;
  return String(html).split(/(<[^>]+>)/).map(part => {
    if (part.startsWith('<')) { if (/^<kbd/i.test(part)) inKbd = true; if (/^<\/kbd/i.test(part)) inKbd = false; return part; }
    if (inKbd) return part;
    return part.replace(/&[#\w]+;|[A-Za-z]+/g, w => w.startsWith('&') ? w : spell(w, table, state.script === 'greek'));
  }).join('');
}
function setHTML(el, html) { el.innerHTML = scriptify(html); }
function cycleScript() {
  state.script = SCRIPTS[(SCRIPTS.indexOf(state.script) + 1) % SCRIPTS.length];
  const msg = {
    english: 'Back to English.',
    greek: 'Everything is now English spelled in Greek letters. (It is not actually Greek!)',
    hiero: 'Everything is now English spelled with hieroglyphic “alphabet” signs, like a museum gift shop. (It is not actually Egyptian!)',
  }[state.script];
  toast(msg, true);
  setHTML($('hint'), HINT);
  if (talk) goto(talk.node);
  if (state.track) audio.onTrackChange(state.track, true);
}
const HINT = 'E translate/talk · Q dance · N next track · L script · J papyrus · C credits · M mute';
$('hint').textContent = HINT;

let toastTimer;
function toast(msg, raw = false) {
  const t = $('toast');
  t.innerHTML = raw ? msg : scriptify(msg);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function updateWallet() {
  $('wallet').innerHTML = `<span class="deben">${state.deben}</span> deben${state.drinks ? ` · ${'🍷'.repeat(Math.min(state.drinks, 6))}` : ''}`;
}
updateWallet();
audio.onTrackChange = (tr, quiet = false) => {
  state.track = tr;
  setHTML($('nowplaying'), `<span class="np-note">♪</span> <b>${tr.name}</b> <span class="np-sub">${tr.subtitle}</span>`);
  if (started && !quiet) toast(`♪ ${tr.name}`);
};

// ---------------------------------------------------------------------------
// start screen
let started = false;
$('enter').addEventListener('click', () => {
  started = true;
  $('title').classList.add('hide');
  audio.start();
  lock();
});
$('paused').addEventListener('click', () => lock());

// ---------------------------------------------------------------------------
// loop
const clock = new THREE.Clock();
let beatState = { position: 0, pulse: 0, bar: 0 };
let t = 0;
let lastHover = 0;

// adaptive quality: if frames are slow (a laptop GPU, say), step down resolution, then shadows, then bloom
const perf = { ema: 1 / 60, since: 0, level: 0 };
function adaptQuality(dt) {
  perf.ema += (dt - perf.ema) * 0.02;
  perf.since += dt;
  if (perf.since < 4 || perf.ema < 1 / 42 || perf.level >= 3) return;
  perf.since = 0;
  perf.level++;
  if (perf.level === 1) { renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1) * 0.75); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); sizeBloom(); }
  if (perf.level === 2 && Q.shadows) { renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
  if (perf.level === 3) { bloom.enabled = false; }
  console.info('quality level', perf.level);
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  const bp = audio.beatPosition;
  beatState = { position: bp, pulse: Math.pow(1 - (bp % 1), 3), bar: Math.floor(bp / 4), energy: audio.started ? audio.energy : 0.7 };
  if (dancingWith) {
    const dd = dancingWith.root.position;
    if (Math.hypot(dd.x - player.pos.x, dd.z - player.pos.z) > 4.5) stopDancing();
    else if (Math.floor(bp) !== Math.floor(bp - dt / (60 / 120)) && Math.floor(bp) % 16 === 0) dancingWith.special = 2.4;
  }
  const groove = dancingWith ? 1 : 0;

  movePlayer(dt);
  if (started) adaptQuality(dt);
  socialDirector(dt);
  const drunk = state.drunk;
  state.drunk = Math.max(0, state.drunk - dt * 0.012);
  const sway = Math.min(1, drunk * 0.2);
  const bb = bp % 1;
  camera.position.set(player.pos.x, EYE + player.jump + Math.sin(player.bob) * 0.03 + Math.sin(t * 0.7) * 0.03 * sway
    - groove * 0.07 * Math.pow(Math.sin(bb * Math.PI), 2), player.pos.z);
  camera.rotation.set(player.pitch + Math.sin(t * 0.5) * 0.03 * sway, player.yaw,
    Math.sin(t * 0.63) * 0.06 * sway + groove * 0.045 * Math.sin(bp * Math.PI / 2));
  if (dancingWith && Math.random() < dt * 6) {
    const p = dancingWith.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8));
    sparkles.emit(p, new THREE.Vector3(0, 0.3, 0), [0xffd27a, 0xff6fb0, 0x9fd8ff][Math.floor(Math.random() * 3)], 1.2, 0.03);
  }
  drunkPass.uniforms.uDrunk.value = Math.min(2.5, drunk * 0.5);
  drunkPass.uniforms.uTime.value = t;

  const inBath = player.pos.x < HALL.x0 - 0.2;
  const nearDoor = THREE.MathUtils.clamp((HALL.x0 + 1.5 - player.pos.x) / 3, 0, 1);
  audio.setMuffle(nearDoor);
  mirror.visible = inBath;
  scene.fog.density = inBath ? 0.004 : 0.028;

  world.update(dt, t, beatState, sparkles, player.pos);
  for (const d of dancers) d.update(dt, beatState);
  // Nefertiti trails a little stardust
  if (world.nefertiti && Math.random() < dt * 20) {
    const p = world.nefertiti.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.1, (Math.random() - 0.5) * 0.5));
    sparkles.emit(p, new THREE.Vector3(0, -0.2, 0), 0xffe0a0, 1.2, 0.02);
  }
  sparkles.update(dt);

  if (t - lastHover > 0.06) { updateHover(); lastHover = t; }
  composer.render();
}

placeStatues()
  .catch((e) => console.error('statues failed to load', e))
  .finally(() => { collectOccluders(); $('enter').disabled = false; $('enter').textContent = 'Enter the Good Day'; });
collectOccluders();
frame();

// debug hooks
window.__club = { world, state, player, people, audio, camera, scene, renderer, openDialogue, goto, startDancing, socialDirector, SPOTS: () => SPOTS };
if (params.has('shot')) {
  started = true; $('title').classList.add('hide');
}
