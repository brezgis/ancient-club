// Statues: load the real scans, fall back to a carved stand-in, and make them dance.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { stoneMaterial, STONES } from './stone.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

const MODELS = 'assets/models/';
const downloads = new Map();

export async function loadManifest() {
  try {
    const r = await fetch(`${MODELS}manifest.json`, { cache: 'no-cache' });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

// Start downloading every scan at once, so the network works while the CPU carves the walls.
export function prefetch(manifest) {
  for (const info of manifest) download(info);
}
function download(info) {
  if (!downloads.has(info.file)) {
    downloads.set(info.file, fetch(MODELS + info.file).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${info.file}`);
      return r.arrayBuffer();
    }));
  }
  return downloads.get(info.file);
}

// Load a model, normalise it so the base sits on y=0, centred, `height` metres tall.
export async function loadStatue(info, height, stoneKind = 'limestone') {
  const gltf = await loader.parseAsync(await download(info), MODELS);
  const obj = gltf.scene;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = height / size.y;
  const inner = new THREE.Group();
  obj.position.sub(new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2));
  inner.add(obj);
  inner.scale.setScalar(s);
  if (info.rotate_y) inner.rotation.y = info.rotate_y;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    if (!m || (!m.map && !o.geometry.attributes.color)) {
      // scans without UVs: a solid stone colour; the scanned geometry carries the detail
      const st = STONES[stoneKind];
      o.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(`rgb(${st.base.join(',')})`), roughness: Math.max(0.5, st.rough), metalness: 0,
      });
    } else {
      // keep the scan's own colour, but make it read as stone under stage lights
      m.roughness = Math.max(m.roughness ?? 0.8, 0.55);
      m.metalness = 0;
      if (o.geometry.attributes.color && !m.map) m.vertexColors = true;
    }
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    const n = o.geometry.attributes.normal;
    for (let i = 0; i < n.count; i++) {
      const x = n.getX(i), y = n.getY(i), z = n.getZ(i);
      const l = Math.hypot(x, y, z);
      if (!(l > 1e-4)) n.setXYZ(i, 0, 1, 0);
    }
    n.needsUpdate = true;
  });
  const g = new THREE.Group();
  g.add(inner);
  g.userData.size = new THREE.Vector3(size.x * s, height, size.z * s);
  return g;
}

// A stand-in striding figure in the canonical Egyptian pose, used if a scan is missing.
export function standInStatue(height = 2, kind = 'granodiorite', female = false) {
  const m = stoneMaterial(kind, { repeat: 1, seed: 3 });
  const g = new THREE.Group();
  const u = height / 2;
  const add = (geo, x, y, z, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x * u, y * u, z * u); mesh.rotation.x = rx;
    mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
  };
  add(new THREE.BoxGeometry(0.5 * u, 0.1 * u, 0.9 * u), 0, 0.05, 0.05);
  add(new THREE.CapsuleGeometry(0.075 * u, 0.7 * u, 4, 12), -0.09, 0.5, 0.12, 0.12);
  add(new THREE.CapsuleGeometry(0.075 * u, 0.7 * u, 4, 12), 0.09, 0.5, -0.04);
  if (female) add(new THREE.CylinderGeometry(0.17 * u, 0.22 * u, 0.8 * u, 16), 0, 0.5, 0.03);
  else add(new THREE.CylinderGeometry(0.2 * u, 0.2 * u, 0.2 * u, 16), 0, 0.93, 0);
  add(new THREE.CylinderGeometry(0.2 * u, 0.15 * u, 0.55 * u, 16), 0, 1.25, 0);
  add(new THREE.CapsuleGeometry(0.05 * u, 0.5 * u, 4, 8), -0.25, 1.22, 0);
  add(new THREE.CapsuleGeometry(0.05 * u, 0.5 * u, 4, 8), 0.25, 1.22, 0);
  add(new THREE.SphereGeometry(0.12 * u, 20, 16), 0, 1.68, 0);
  // nemes headcloth / wig
  const wig = add(new THREE.CylinderGeometry(0.11 * u, 0.22 * u, 0.36 * u, 16, 1, true), 0, 1.6, -0.02);
  wig.material = m;
  g.userData.size = new THREE.Vector3(0.5 * u, height, 0.9 * u);
  return g;
}

const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// Rigid-body dancing for rigid bodies. Stone can't bend, so it hops, spins, leans and wobbles.
const SPOT_MOVES = {
  floor: null,                                   // keep their own dance moves
  wall: ['tipsy', 'lean', 'tipsy', 'nod'],       // wallflowers sway shyly
  bar: ['nod', 'lean', 'nod', 'tipsy'],
  stool: ['nod', 'tipsy', 'nod', 'lean'],
};

export class Dancer {
  // send this statue to another spot in the club
  moveTo(spot) {
    this.spot = spot;
    this.anchor = spot.pos.clone();
    this.homeFacing = spot.facing;
    this.travel = true;
    this.still = spot.kind !== 'floor';
    this.moves = SPOT_MOVES[spot.kind] ?? this.floorMoves;
    this.energy = spot.kind === 'floor' ? this.floorEnergy : 0.45;
  }

  constructor(object, anchor, { moves = ['hop', 'lean', 'spin', 'wobble', 'shuffle'], phase = 0, facing = 0, energy = 1, bust = false } = {}) {
    this.root = new THREE.Group();   // position + facing
    this.body = new THREE.Group();   // dance transforms, pivoting at the base
    this.root.add(this.body);
    this.body.add(object);
    this.object = object;
    this.anchor = anchor.clone();
    this.root.position.copy(anchor);
    this.facing = facing;
    this.moves = moves;
    this.floorMoves = moves;
    this.phase = phase;
    this.energy = energy;
    this.floorEnergy = energy;
    this.bust = bust;
    this.talking = false;
    this.lookAt = null;
    this.travel = false;
    this.still = bust;          // stays put (no idle wandering) when off the dance floor
    this.special = 0;
    this.wander = Math.random() * Math.PI * 2;
    // cheap proxy for raycasting instead of the dense scan mesh
    const sz = object.userData.size ?? new THREE.Vector3(0.6, 2, 0.6);
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(sz.x, sz.z) * 0.5, Math.max(sz.x, sz.z) * 0.5, sz.y, 10),
      new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = sz.y / 2;
    this.root.add(this.hit);
    this.hit.userData.dancer = this;
    this.radius = Math.max(0.35, Math.max(sz.x, sz.z) * 0.45);
  }

  update(dt, beat) {
    const b = beat.position + this.phase;
    const bi = Math.floor(b), f = b - bi;
    const move = this.moves[Math.floor(b / 8) % this.moves.length];
    const e = this.energy;
    let y = 0, rx = 0, ry = 0, rz = 0, dx = 0, dz = 0;

    if (this.partner && this.lookAt && !this.talking) {
      const want = Math.atan2(this.lookAt.x - this.root.position.x, this.lookAt.z - this.root.position.z);
      let d = want - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 3);
    }
    if (this.talking) {
      // settle and turn to face whoever is talking
      if (this.lookAt) {
        const want = Math.atan2(this.lookAt.x - this.root.position.x, this.lookAt.z - this.root.position.z);
        let d = want - this.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * Math.min(1, dt * 4);
      }
      y = 0.02 * Math.abs(Math.sin(b * Math.PI)) * e;
      rz = 0.04 * Math.sin(b * Math.PI) * e;
    } else if (move === 'hop') {
      y = 0.22 * e * Math.pow(Math.sin(f * Math.PI), 0.7);
      ry = (bi % 2 ? 1 : -1) * 0.25 * ease(Math.min(1, f * 2));
      rx = -0.05 * Math.sin(f * Math.PI);
    } else if (move === 'lean') {
      rz = 0.2 * e * Math.sin(b * Math.PI / 2);
      y = 0.04 * Math.abs(Math.sin(b * Math.PI));
      ry = 0.3 * Math.sin(b * Math.PI / 4);
    } else if (move === 'spin') {
      ry = (bi + ease(Math.min(1, f * 1.6))) * Math.PI / 2;
      y = 0.08 * e * Math.sin(Math.min(1, f * 1.6) * Math.PI);
    } else if (move === 'wobble') {
      const a = b * Math.PI / 2;
      rx = 0.12 * e * Math.sin(a); rz = 0.12 * e * Math.cos(a);
      ry = 0.2 * Math.sin(a * 0.5);
    } else if (move === 'shuffle') {
      dx = 0.35 * Math.sin(b * Math.PI / 4);
      y = 0.05 * Math.abs(Math.sin(b * Math.PI));
      rz = -0.08 * Math.cos(b * Math.PI / 4);
      ry = 0.35 * Math.sin(b * Math.PI / 2);
    } else if (move === 'headslide') {
      // the bust special: slide the head sideways, "walk like an Egyptian" style
      dx = 0.12 * e * Math.sign(Math.sin(b * Math.PI / 2)) * Math.min(1, Math.abs(Math.sin(b * Math.PI / 2)) * 3);
      rx = 0.08 * Math.sin(b * Math.PI);
      y = 0.03 * Math.abs(Math.sin(b * Math.PI));
    } else if (move === 'nod') {
      rx = 0.14 * Math.pow(Math.abs(Math.sin(b * Math.PI)), 3);
      rz = 0.06 * Math.sin(b * Math.PI / 2);
    } else if (move === 'tipsy') {
      rz = 0.1 * Math.sin(b * Math.PI / 4) + 0.03 * Math.sin(b * 3.1);
      rx = 0.05 * Math.sin(b * Math.PI / 3);
      ry = 0.2 * Math.sin(b * 0.2);
    }

    if (this.special > 0) {
      this.special = Math.max(0, this.special - dt);
      const k = 1 - this.special / 2.4;
      ry += ease(k) * Math.PI * 4;
      y += Math.sin(k * Math.PI) * 0.4;
    }

    if (this.travel && !this.talking && !this.partner) {
      // hop-walk to the new spot: stone has no knees
      const to = this.anchor, p = this.root.position;
      const dx = to.x - p.x, dz = to.z - p.z, dist = Math.hypot(dx, dz);
      const stepLen = Math.min(dist, dt * 1.3);
      if (dist > 0.03) {
        p.x += dx / dist * stepLen; p.z += dz / dist * stepLen;
        p.y += (to.y - p.y) * Math.min(1, dt * 1.5);
        let dAng = Math.atan2(dx, dz) - this.facing;
        dAng = Math.atan2(Math.sin(dAng), Math.cos(dAng));
        this.facing += dAng * Math.min(1, dt * 5);
        y = 0.16 * Math.abs(Math.sin(b * Math.PI)); rx = 0.06; rz = 0.08 * Math.sin(b * Math.PI);
      } else {
        this.travel = false;
      }
    } else if (this.homeFacing !== undefined && !this.talking && !this.partner) {
      let dAng = this.homeFacing - this.facing;
      dAng = Math.atan2(Math.sin(dAng), Math.cos(dAng));
      this.facing += dAng * Math.min(1, dt * 2);
    }
    if (!this.talking && !this.still) {
      this.wander += dt * 0.08;
    }
    const idle = this.talking || this.still || this.travel;
    const wx = idle ? 0 : Math.cos(this.wander) * 0.4;
    const wz = idle ? 0 : Math.sin(this.wander * 1.3) * 0.4;
    const target = new THREE.Vector3(this.anchor.x + wx, this.anchor.y, this.anchor.z + wz);
    if (!this.travel) this.root.position.lerp(target, Math.min(1, dt * 2));
    else if (this.talking || this.partner) { /* paused mid-journey */ }
    this.root.rotation.y = this.facing;
    if (this.travel && !this.talking && !this.partner) { this.body.position.set(0, y, 0); this.body.rotation.set(rx, 0, rz, 'YXZ'); return; }
    this.body.position.set(dx, y, dz);
    this.body.rotation.set(rx, ry, rz, 'YXZ');
  }
}
