// You: walking, looking, hopping, and bumping into things.
import * as THREE from 'three';

const EYE = 1.62;
const RADIUS = 0.32;
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();

export class Player {
  constructor(world, { x = 0, z = 11.2, yaw = 0, pitch = -0.02 } = {}) {
    this.world = world;
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.vel = new THREE.Vector3();
    this.bob = 0;
    this.jump = 0;
    this.jumpV = 0;
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0022, -1.45, 1.45);
  }

  hop() {
    if (this.jump === 0) { this.jumpV = 3.2; this.jump = 0.0001; }
  }

  // keys: the set of held key codes, or null when you're busy (talking, reading)
  update(dt, keys, drunk, t) {
    wish.set(0, 0, 0);
    fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    right.set(-fwd.z, 0, fwd.x);
    if (keys) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(fwd);
      if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(fwd);
      if (keys.has('KeyD') || keys.has('ArrowRight')) wish.add(right);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) wish.sub(right);
    }
    if (wish.lengthSq() > 0) {
      const hurry = keys.has('ShiftLeft') || keys.has('ShiftRight');
      wish.normalize().multiplyScalar(hurry ? 5.2 : 2.8);
      // a little stagger after a few drinks
      if (drunk > 0.5) wish.addScaledVector(right, Math.sin(t * 1.3) * Math.min(1.2, drunk * 0.25));
    }
    this.vel.lerp(wish, Math.min(1, dt * 10));
    this.pos.addScaledVector(this.vel, dt);
    this.collide();
    this.bob += dt * this.vel.length() * 2.4;
    if (this.jump > 0) {
      this.jumpV -= 9.8 * dt;
      this.jump += this.jumpV * dt;
      if (this.jump <= 0) { this.jump = 0; this.jumpV = 0; }
    }
  }

  // sway: 0–1 drunken roll; groove: 0–1 dancing with someone; beat: position in beats
  applyCamera(camera, t, sway, groove, beat) {
    const bb = beat % 1;
    camera.position.set(this.pos.x,
      EYE + this.jump + Math.sin(this.bob) * 0.03 + Math.sin(t * 0.7) * 0.03 * sway - groove * 0.07 * Math.sin(bb * Math.PI) ** 2,
      this.pos.z);
    camera.rotation.set(this.pitch + Math.sin(t * 0.5) * 0.03 * sway, this.yaw,
      Math.sin(t * 0.63) * 0.06 * sway + groove * 0.045 * Math.sin(beat * Math.PI / 2));
  }

  collide() {
    const p = this.pos, r = RADIUS;
    for (let it = 0; it < 2; it++) {
      for (const b of this.world.colliders) {
        const cx = THREE.MathUtils.clamp(p.x, b.x0, b.x1), cz = THREE.MathUtils.clamp(p.z, b.z0, b.z1);
        const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d > 1e-5) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; continue; }
        // inside the box: push out the shortest way
        const opts = [[b.x0 - r - p.x, 0], [b.x1 + r - p.x, 0], [0, b.z0 - r - p.z], [0, b.z1 + r - p.z]];
        opts.sort((a, c) => Math.hypot(...a) - Math.hypot(...c));
        p.x += opts[0][0]; p.z += opts[0][1];
      }
      for (const c of this.world.circles) {
        const cx = c.dyn ? c.dyn.root.position.x : c.x, cz = c.dyn ? c.dyn.root.position.z : c.z;
        const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), R = r + c.r;
        if (d < R && d > 1e-5) { p.x = cx + dx / d * R; p.z = cz + dz / d * R; }
      }
    }
  }
}
