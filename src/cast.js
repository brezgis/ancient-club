// Who's in the club tonight: casting the scans, placing them, and moving them around the room.
import * as THREE from 'three';
import { DANCE, BATH } from './world.js';
import { loadStatue, standInStatue, Dancer } from './statues.js';
import { NEFERTITI, makeBartender, makeDancer, makeBathGirl, makeDJ } from './characters.js';
import { Q } from './quality.js';

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
  // they start against the walls, but everyone gets pulled onto the floor eventually
  wallflowers: [
    { slug: 'nemtynakht_mahg', name: 'Nemtynakht, Wallflower', h: 1.5, kind: 'sandstone', moves: ['hop', 'lean', 'wobble', 'spin'] },
    { slug: 'princess_mahg', name: 'A Middle Kingdom Princess', h: 1.6, kind: 'limestone', moves: ['lean', 'spin', 'hop', 'wobble'] },
    { slug: 'aphrodite_mahg', name: 'Aphrodite (Lost Her Head on the Dance Floor)', h: 1.7, kind: 'marble', moves: ['wobble', 'lean', 'spin', 'shuffle'] },
  ],
  // regulars propping up the bar (busts and half-figures, so they sit on stools)
  patrons: [
    { slug: 'royal_couple_mahg', name: 'King Ay & Queen Tey, on a Date', h: 0.95, kind: 'limestone' },
    { slug: 'young_queen_nefertiti', name: 'Young Nefertiti (Just the Head)', h: 0.6, kind: 'plaster' },
    { slug: 'priest_hor_mahg', name: 'Hor the Priest, and His Plus-One (Osiris)', h: 1.0, kind: 'granodiorite' },
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
};

const short = (t) => (t ?? '').split(/[,(:;]/)[0].trim();

export class Cast {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.people = [];        // interactive statues: { dancer, character }
    this.dancers = [];       // everything that moves to the beat
    this.infoObjects = [];   // non-dancing scans with a museum label
    this.mobile = [];        // statues the social director may send around the room
    this.spots = [];
    this.directorTimer = 12;
  }

  // Load and place everyone. onProgress(done, total) ticks as each scan lands.
  async load(manifest, onProgress = () => {}) {
    const { world, scene } = this;
    this.spots = this.buildSpots();
    const bySlug = Object.fromEntries(manifest.map(m => [m.slug, m]));
    const total = manifest.length;
    let done = 0;
    const load = async (info, h, kind, female = false) => {
      let obj;
      if (!info) obj = standInStatue(h, kind, female);
      else {
        try { obj = await loadStatue(info, h, kind); }
        catch (e) { console.warn('failed to load', info.file, e); obj = standInStatue(h, kind, female); }
      }
      onProgress(++done, total);
      return obj;
    };
    const named = (info, displayName, extra) => info && { ...info, displayName: displayName ?? short(info.title), ...extra };
    const spotsOf = (kind) => this.spots.filter(s => s.kind === kind);
    const jobs = [];

    // Nefertiti, hovering in the middle of the floor (the museum's own scan, in colour)
    jobs.push(load(bySlug.nefertiti, 1.0, 'limestone', true).then(obj => {
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
      this.addPerson(d, NEFERTITI);
      world.nefertiti = d;
    }));

    // the dancers, in a ring around her, facing out so you meet their faces
    const floor = spotsOf('floor');
    CAST.dancers.forEach((c, i) => {
      const info = bySlug[c.slug];
      jobs.push(load(info, c.h, c.kind).then(obj => {
        const spot = floor[[0, 1, 3, 4, 6, 7, 9][i] ?? i];
        const d = new Dancer(obj, spot.pos, { moves: c.moves, phase: i * 0.37, energy: 0.8 + (i % 3) * 0.15 });
        this.place(d, spot);
        this.mobile.push(d);
        this.addPerson(d, makeDancer(named(info, c.name), i));
      }));
    });

    // wallflowers (mobile, full figures)
    const walls = spotsOf('wall');
    CAST.wallflowers.forEach((c, i) => {
      const info = bySlug[c.slug];
      if (!info) return;
      jobs.push(load(info, c.h, c.kind).then(obj => {
        const spot = walls[i * 3];
        const d = new Dancer(obj, spot.pos, { moves: c.moves, phase: i * 0.71, energy: 0.85 });
        this.place(d, spot, true);
        this.mobile.push(d);
        this.addPerson(d, makeDancer(named(info, c.name), i + 7));
      }));
    });

    // bar regulars on the stools
    const stools = spotsOf('stool');
    CAST.patrons.forEach((c, i) => {
      const info = bySlug[c.slug];
      if (!info || !stools[i]) return;
      jobs.push(load(info, c.h, c.kind).then(obj => {
        const d = new Dancer(obj, stools[i].pos, { moves: ['nod'], phase: i * 0.5, energy: 0.45, bust: true });
        this.place(d, stools[i], true);
        this.addPerson(d, makeDancer(named(info, c.name), i + 3));
      }));
    });

    // the scribe on the decks
    const djInfo = bySlug[CAST.dj.slug];
    jobs.push(load(djInfo, CAST.dj.h, CAST.dj.kind).then(obj => {
      const d = new Dancer(obj, world.djAnchor.clone().setY(0.75), { moves: ['nod', 'nod', 'lean', 'nod'], facing: 0, energy: 0.6, bust: true });
      this.addPerson(d, makeDJ(djInfo));
      world.dj = d;
    }));

    // the barkeep: a servant who grinds the grain that becomes bread and beer
    const barInfo = bySlug[CAST.bar.slug];
    jobs.push(load(barInfo, CAST.bar.h, CAST.bar.kind, true).then(obj => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.9), new THREE.MeshStandardMaterial({ color: 0x4a2e16, roughness: 0.8 }));
      crate.position.copy(world.barAnchor).setY(0.375);
      scene.add(crate);
      const d = new Dancer(obj, world.barAnchor.clone().setY(0.75), { moves: ['nod', 'lean', 'nod', 'wobble'], facing: -Math.PI / 2, energy: 0.5, bust: true });
      this.addPerson(d, makeBartender(named(barInfo, 'Nebet, the Barkeep',
        { who: 'a servant statue from an Old Kingdom tomb, grinding grain for eternity’s bread and beer' })));
      world.bartender = d;
    }));

    // the girls in the bathroom
    CAST.bath.forEach((c, i) => {
      const info = bySlug[c.slug];
      jobs.push(load(info, c.h, c.kind, true).then(obj => {
        const anchor = c.counter != null ? new THREE.Vector3(BATH.x0 + 0.38, 0.9, c.counter) : world.bathAnchors[c.at];
        const d = new Dancer(obj, anchor, { moves: ['tipsy', 'lean', 'tipsy', 'wobble'], facing: c.facing, energy: 0.35, bust: true, phase: i * 1.3 });
        this.addPerson(d, makeBathGirl(named(info, c.name), i));
      }));
    });

    // a real Greek wine cup on the bar, three times over
    if (bySlug.kylix) {
      jobs.push(load(bySlug.kylix, 0.1, 'sandstone').then(cup => {
        for (const z of [-2.2, 1.4, 3.6]) {
          const obj = cup.clone();
          obj.position.set(9.5, world.barCounterTop, z);
          obj.rotation.y = z;
          scene.add(obj);
          this.addLabel(obj, bySlug.kylix);
        }
      }));
    }

    // museum pieces on display, each with its own lamp
    for (const c of CAST.display) {
      const info = bySlug[c.slug];
      if (!info) continue;
      jobs.push(load(info, c.h, c.kind).then(obj => {
        const [x, z] = c.p;
        obj.position.set(x, 0, z);
        obj.rotation.y = c.ry;
        scene.add(obj);
        world.circles.push({ x, z, r: 0.8 });
        world.addLamp({
          pos: new THREE.Vector3(x + Math.sin(c.ry) * 1.6, c.h + 1.6, z + Math.cos(c.ry) * 1.6),
          target: new THREE.Vector3(x, c.h * 0.5, z),
          color: 0xffd8a0, intensity: 18, distance: 7, angle: Math.PI / 6, penumbra: 0.6, decay: 1.3,
        });
        this.addLabel(obj, info);
      }));
    }

    await Promise.all(jobs);
  }

  // --- where statues can be: the floor, against the walls, at the bar, on a stool ---
  buildSpots() {
    const { world } = this;
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

  // settle a statue onto a spot; offFloor also switches it to that spot's (calmer) moves
  place(d, spot, offFloor = false) {
    if (offFloor) { d.moveTo(spot); d.travel = false; }
    spot.occupant = d;
    d.spot = spot;
    d.anchor.copy(spot.pos);
    d.root.position.copy(spot.pos);
    d.facing = d.homeFacing = spot.facing;
  }

  addPerson(d, character) {
    this.scene.add(d.root);
    d.root.traverse(o => { o.userData.skipOcc = true; });
    const person = { dancer: d, character };
    d.hit.userData.person = person;
    this.dancers.push(d);
    this.people.push(person);
    this.world.circles.push({ dyn: d, r: d.radius });
  }

  // an invisible box to look at, carrying the piece's museum record
  addLabel(obj, info) {
    obj.traverse(o => { o.userData.skipOcc = true; });
    const box = new THREE.Box3().setFromObject(obj);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray()), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(box.getCenter(new THREE.Vector3()));
    hit.userData.info = info;
    this.scene.add(hit);
    this.infoObjects.push(hit);
  }

  update(dt, beat) {
    this.direct(dt);
    for (const d of this.dancers) d.update(dt, beat);
  }

  // Every so often someone leaves the floor for a drink or a lean on the wall, and someone comes back.
  direct(dt) {
    this.directorTimer -= dt;
    if (this.directorTimer > 0 || !this.mobile.length) return;
    this.directorTimer = 7 + Math.random() * 8;
    const onFloor = this.mobile.filter(d => d.spot?.kind === 'floor').length;
    const candidates = this.mobile.filter(d => !d.talking && !d.partner && !d.travel);
    const d = candidates[Math.floor(Math.random() * candidates.length)];
    if (!d) return;
    let kind;
    if (d.spot?.kind === 'floor') kind = onFloor <= 5 ? null : (Math.random() < 0.55 ? 'bar' : 'wall');
    else kind = onFloor < 7 || Math.random() < 0.7 ? 'floor' : (d.spot?.kind === 'bar' ? 'wall' : 'bar');
    if (!kind) return;
    const free = this.spots.filter(s => s.kind === kind && !s.occupant);
    const to = free[Math.floor(Math.random() * free.length)];
    if (!to) return;
    if (d.spot) d.spot.occupant = null;
    to.occupant = d;
    d.moveTo(to);
  }
}
