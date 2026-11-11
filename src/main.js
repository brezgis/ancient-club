// Club Heru-Nefer: wiring and the frame loop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { initQuality, Q } from './quality.js';
import { loadFonts } from './glyphs.js';
import { World, HALL } from './world.js';
import { Sparkles } from './fx.js';
import { ClubAudio } from './audio.js';
import { loadManifest, prefetch } from './statues.js';
import { MENU } from './characters.js';
import { Cast } from './cast.js';
import { Player } from './player.js';
import { Post } from './post.js';
import { BathMirror } from './mirror.js';
import * as ui from './ui.js';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');   // headless screenshots: skip the title card

// Start the slow network work first: fonts and every statue scan download while we build.
const fontsReady = loadFonts();
const manifestReady = loadManifest().then(m => { prefetch(m); return m; });

const state = {
  deben: 12, drinks: 0, drunk: 0, track: null,
  learned: new Set(), journal: new Map(), tried: new Set(),
};

// --- renderer, scene, camera ---------------------------------------------------------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
} catch (err) {
  // Without this the title card sits on "Opening the doors…" forever.
  const enter = document.getElementById('enter');
  enter.textContent = 'The club needs WebGL. Try turning on hardware acceleration, or another browser.';
  enter.style.whiteSpace = 'normal';
  throw err;
}
initQuality(renderer.getContext());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = Q.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05040a);
scene.fog = new THREE.FogExp2(0x0b0714, 0.028);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();
scene.environmentIntensity = 0.12;

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 120);
camera.rotation.order = 'YXZ';
const post = new Post(renderer, scene, camera);

let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => post.resize(), 120); });

// --- the club ---------------------------------------------------------------------
await fontsReady;
const world = new World(scene);
await world.build(p => ui.setLoading(p * 0.6));

const sparkles = new Sparkles();
scene.add(sparkles.points);
const mirror = new BathMirror(scene, world.mirrorSpec, Q.mirrorRes);
const audio = new ClubAudio();
const cast = new Cast(scene, world);

let start = {};
if (params.has('pos')) {
  const [x, z, yaw, pitch] = params.get('pos').split(',').map(Number);
  start = { x, z, yaw, pitch };
}
try {
  // coming back from a lost GPU context: put you back where you were
  const resumed = JSON.parse(sessionStorage.getItem('club-resume') ?? 'null');
  sessionStorage.removeItem('club-resume');
  if (resumed) { start = resumed; state.deben = resumed.deben ?? state.deben; }
} catch {}
const player = new Player(world, start);

// If the GPU drops our context (laptops do this when another app grabs the GPU),
// save where you were and offer a reload instead of leaving a black canvas.
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  try { sessionStorage.setItem('club-resume', JSON.stringify({ x: player.pos.x, z: player.pos.z, yaw: player.yaw, deben: state.deben })); } catch {}
  ui.showLost();
});
renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());

// --- input ------------------------------------------------------------------------
const keys = new Set();
const canvas = renderer.domElement;
let started = false, locked = false;

const dialogue = new ui.Dialogue(state, {
  onAction: runAction,
  onClose: (person) => { person.dancer.talking = false; lock(); },
});
const busy = () => dialogue.isOpen || ui.overlayOpen();

// Browsers refuse a re-lock right after Esc; if so, show the "click to return" card.
function lock() {
  if (busy()) return;
  canvas.requestPointerLock?.()?.catch?.(() => ui.setPaused(started && !busy()));
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  ui.setPaused(!locked && started && !busy());
});
document.addEventListener('mousemove', (e) => { if (locked) player.look(e.movementX, e.movementY); });
canvas.addEventListener('mousedown', (e) => {
  if (!started) return;
  if (!locked) lock();
  else if (e.button === 0) interact();
});
document.getElementById('paused').addEventListener('click', lock);
document.querySelectorAll('.overlay .close').forEach(b => b.addEventListener('click', closeOverlays));

addEventListener('keydown', (e) => {
  if (!started) return;
  if (dialogue.isOpen) {
    if (e.code === 'Escape') dialogue.close();
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) dialogue.choose(n - 1);
    return;
  }
  if (ui.overlayOpen()) {
    if (['Escape', 'KeyJ', 'KeyC', 'KeyH'].includes(e.code)) closeOverlays();
    return;
  }
  keys.add(e.code);
  switch (e.code) {
    case 'KeyE': case 'KeyF': interact(); break;
    case 'KeyQ': if (dancingWith) stopDancing(); else if (hovered?.kind === 'person') startDancing(hovered.obj); break;
    case 'Space': player.hop(); break;
    case 'KeyN': audio.start(); audio.nextTrack(); ui.toast('Hapi is mixing in the next track…'); break;
    case 'KeyM': ui.toast(audio.toggleMute() ? 'Music muted' : 'Music on'); break;
    case 'KeyJ': ui.renderJournal(state); openOverlay('journal'); break;
    case 'KeyC': openOverlay('credits'); break;
    case 'KeyH': case 'Slash': openOverlay('help'); break;
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function openOverlay(id) {
  keys.clear();
  document.exitPointerLock?.();
  ui.openOverlay(id);
}
function closeOverlays() {
  ui.closeOverlays();
  lock();
}

// --- looking at things ----------------------------------------------------------------
const ray = new THREE.Raycaster();
ray.far = 4.5;
let hovered = null;   // { kind: 'line' | 'person' | 'info', obj }
let occluders = [];
let targets = [];

// Everything solid that can block your view of a line or a statue (not the light beams).
function collectTargets() {
  const slabBodies = new Set(world.slabs.map(s => s.body));
  occluders = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.line || o.userData.skipOcc || slabBodies.has(o)) return;
    if (o.material?.visible === false || o.material?.transparent || o.material?.blending === THREE.AdditiveBlending) return;
    occluders.push(o);
  });
  targets = [...world.slabs.flatMap(s => s.lines.map(l => l.mesh)), ...cast.people.map(p => p.dancer.hit), ...cast.infoObjects];
}

function updateHover() {
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  let h = null;
  const [first] = ray.intersectObjects(targets, false);
  if (first && !ray.intersectObjects(occluders, false).some(o => o.distance < first.distance - 0.05)) {
    const u = first.object.userData;
    if (u.line && first.distance < 4.2) h = { kind: 'line', obj: u.line };
    else if (u.person && first.distance < 3.4) h = { kind: 'person', obj: u.person };
    else if (u.info && first.distance < 3.4) h = { kind: 'info', obj: u.info };
  }
  if (hovered?.kind === 'line' && hovered.obj !== h?.obj) hovered.obj.hover = 0;
  hovered = h;
  if (h?.kind === 'line') h.obj.hover = 1;
  renderHover();
}

const FIDELITY = {
  attested: 'standard, attested spelling',
  reconstructed: 'real words · sign-by-sign typesetting is mine',
  original: 'original text',
};

function renderHover() {
  if (!hovered || dialogue.isOpen) { ui.setPrompt(null); ui.setCaption(null); return; }
  const { kind, obj } = hovered;
  if (kind === 'line') {
    const l = obj, def = l.slab.def;
    const action = l.transition ? '<span class="sparkle">✦ carving ✦</span>'
      : l.translated ? `<kbd>E</kbd> back to ${l.faces[0].script === 'hiero' ? 'hieroglyphs' : 'Greek'}` : '<kbd>E</kbd> translate';
    const readings = l.readings.map(s => `<div class="cap-reading ${s.script}">${s.text}</div>`).join('');
    ui.setPrompt(null);
    ui.setCaption(`<div class="cap-title">${def.title}</div><div class="cap-object">${def.object}</div>`
      + (l.translated ? `${readings}<div class="cap-note">${l.def.note ?? ''}</div><div class="cap-fid ${l.def.fidelity}">${FIDELITY[l.def.fidelity]}</div>` : '')
      + `<div class="cap-action">${action}</div>`);
  } else if (kind === 'person') {
    const name = obj.character.name;
    ui.setPrompt(dancingWith === obj.dancer
      ? `dancing with <b>${name}</b> · <kbd>Q</kbd> stop`
      : `<b>${name}</b> · <kbd>E</kbd> talk · <kbd>Q</kbd> dance`);
    ui.setCaption(null);
  } else {
    ui.setPrompt(null);
    ui.setCaption(`<div class="cap-title">${obj.title}</div><div class="cap-object">${[obj.date, obj.material, obj.museum, obj.accession_number].filter(Boolean).join(' · ')}</div>
      <div class="cap-note">${(obj.facts ?? []).join(' ')}</div><div class="cap-action"><kbd>E</kbd> keep on your papyrus</div>`);
  }
}

function interact() {
  audio.start();
  if (!hovered) return;
  const { kind, obj } = hovered;
  if (kind === 'line') {
    const dur = obj.toggle();
    if (dur) audio.chime(dur);
  } else if (kind === 'person') {
    keys.clear();
    document.exitPointerLock?.();
    obj.dancer.talking = true;
    obj.dancer.lookAt = player.pos;
    dialogue.open(obj);
  } else {
    state.journal.set(`obj:${obj.slug}`, { title: obj.title, lines: [[obj.date, obj.museum].filter(Boolean).join(' · '), ...(obj.facts ?? [])] });
    ui.toast('Kept on your papyrus (J)');
  }
  renderHover();
}

for (const s of world.slabs) {
  s.onLineDone = (line) => {
    if (line.translated) {
      state.journal.set(`${s.key}:${line.index}`, { title: s.def.title, stages: line.def.stages, note: line.def.note });
      if (s.def.music === 'seikilos') audio.playSeikilos();
    }
    renderHover();
  };
}

// --- conversation actions ---------------------------------------------------------------
// Returns the node to go to next, null to end the conversation, or undefined to carry on.
function runAction(a, person) {
  if (a === 'seikilos') { audio.start(); audio.playSeikilos(); return undefined; }
  if (a === 'nextTrack') { audio.start(); audio.nextTrack(); return undefined; }
  if (a === 'dance') {
    if (person.dancer === world.nefertiti) {
      person.dancer.special = 2.4;
      burst(person.dancer.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 260);
    }
    dialogue.close();
    startDancing(person);
    return null;
  }
  if (a.startsWith('buy:')) {
    const m = MENU.find(x => x.id === a.slice(4));
    if (m.price > state.deben) return 'broke';
    state.deben -= m.price;
    if (m.drunk > 0) state.drinks++;
    state.drunk = Math.max(0, state.drunk + m.drunk);
    state.lastServed = m;
    state.tried.add(m.name);
    state.journal.set(`drink:${m.id}`, { title: `At the bar: ${m.name}`, lines: [m.fact] });
    audio.clink();
    ui.setWallet(state);
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
  ui.toast(`You’re dancing with ${person.character.name} ✦`);
  burst(dancingWith.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 120);
}
function stopDancing() {
  if (!dancingWith) return;
  dancingWith.partner = false;
  dancingWith = null;
}

const burstVel = new THREE.Vector3();
function burst(p, n, color = 0xffd27a) {
  for (let i = 0; i < n; i++) {
    burstVel.randomDirection().multiplyScalar(0.6 + Math.random() * 1.8);
    sparkles.emit(p, burstVel, Math.random() < 0.75 ? color : 0x9fd8ff, 0.8 + Math.random(), 0.03 + Math.random() * 0.04);
  }
}

ui.setWallet(state);
audio.onTrackChange = (tr, quiet = false) => {
  state.track = tr;
  ui.setNowPlaying(tr);
  if (started && !quiet) ui.toast(`♪ ${tr.name}`);
};

// --- the frame loop -----------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);
let t = 0, lastHover = 0;
const beat = { position: 0, pulse: 0, bar: 0, energy: 0.7 };
const v = new THREE.Vector3();

function frame(now) {
  requestAnimationFrame(frame);
  timer.update(now);
  const dt = Math.min(0.05, timer.getDelta());
  t += dt;
  const bp = audio.beatPosition;
  beat.position = bp;
  beat.pulse = (1 - (bp % 1)) ** 3;
  beat.bar = Math.floor(bp / 4);
  beat.energy = audio.started ? audio.energy : 0.7;

  if (dancingWith) {
    const dd = dancingWith.root.position;
    if (Math.hypot(dd.x - player.pos.x, dd.z - player.pos.z) > 4.5) stopDancing();
    else if (Math.floor(bp) !== Math.floor(bp - dt * 2) && Math.floor(bp) % 16 === 0) dancingWith.special = 2.4;
  }

  player.update(dt, busy() ? null : keys, state.drunk, t);
  if (started) post.adapt(dt);
  const drunk = state.drunk;
  state.drunk = Math.max(0, drunk - dt * 0.012);
  player.applyCamera(camera, t, Math.min(1, drunk * 0.2), dancingWith ? 1 : 0, bp);

  if (dancingWith && Math.random() < dt * 6) {
    v.set((Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8).add(dancingWith.root.position);
    sparkles.emit(v, new THREE.Vector3(0, 0.3, 0), [0xffd27a, 0xff6fb0, 0x9fd8ff][Math.floor(Math.random() * 3)], 1.2, 0.03);
  }
  // Nefertiti trails a little stardust
  if (world.nefertiti && Math.random() < dt * 20) {
    v.set((Math.random() - 0.5) * 0.5, 0.1, (Math.random() - 0.5) * 0.5).add(world.nefertiti.root.position);
    sparkles.emit(v, new THREE.Vector3(0, -0.2, 0), 0xffe0a0, 1.2, 0.02);
  }

  // the bathroom: muffled music through the wall, clearer air, the mirror
  const x = player.pos.x;
  audio.setMuffle(THREE.MathUtils.clamp((HALL.x0 + 1.5 - x) / 3, 0, 1));
  scene.fog.density = THREE.MathUtils.lerp(0.028, 0.004, THREE.MathUtils.clamp((HALL.x0 + 0.5 - x) / 2, 0, 1));
  mirror.update(player.pos);

  world.update(dt, t, beat, sparkles, player.pos);
  cast.update(dt, beat);
  sparkles.update(dt);

  if (t - lastHover > 0.06) { updateHover(); lastHover = t; }
  post.render(t, Math.min(2.5, drunk * 0.5));
}
requestAnimationFrame(frame);

// --- statues, then doors open ------------------------------------------------------------
const manifest = await manifestReady;
await cast.load(manifest, (done, total) => ui.setLoading(0.6 + 0.35 * done / total));
ui.renderCredits(manifest);
collectTargets();
// compile every shader now, in parallel where the browser allows, instead of stuttering on first sight
await renderer.compileAsync(scene, camera).catch(() => {});
window.__club = { world, cast, state, player, audio, camera, scene, renderer, dialogue, people: cast.people,
  openDialogue: (p) => dialogue.open(p), goto: (id) => dialogue.goto(id), startDancing };

const enter = () => { started = true; ui.hideTitle(); audio.start(); lock(); };
if (SHOT) { started = true; ui.hideTitle(); }
ui.setReady(enter);
