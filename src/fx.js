// Sparkles: a pooled, additive particle system.
import * as THREE from 'three';

export class Sparkles {
  constructor(capacity = 6000) {
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);   // remaining life, 0 = dead
    this.max = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.head = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('amax', new THREE.BufferAttribute(this.max, 1));
    g.setAttribute('asize', new THREE.BufferAttribute(this.size, 1));
    this.geometry = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: /* glsl */`
        attribute float alife; attribute float amax; attribute float asize;
        varying vec3 vColor; varying float vA;
        uniform float uScale;
        void main() {
          vColor = color;
          float k = amax > 0.0 ? alife / amax : 0.0;
          vA = k;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = alife > 0.0 ? asize * uScale * (0.4 + 0.6 * k) / -mv.z : 0.0;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vColor; varying float vA;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float core = smoothstep(0.5, 0.0, d);
          float star = max(0.0, 1.0 - abs(p.x) * 14.0) * max(0.0, 1.0 - abs(p.y) * 2.2)
                     + max(0.0, 1.0 - abs(p.y) * 14.0) * max(0.0, 1.0 - abs(p.x) * 2.2);
          float a = (core * core + star * 0.6) * vA;
          gl_FragColor = vec4(vColor * a * 2.0, a);
        }`,
      vertexColors: true,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this._c = new THREE.Color();
  }

  emit(p, v, color = 0xffd27a, life = 0.6 + Math.random() * 0.9, size = 0.018 + Math.random() * 0.03) {
    const i = this.head;
    this.head = (this.head + 1) % this.cap;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this._c.set(color);
    this.col.set([this._c.r, this._c.g, this._c.b], i * 3);
    this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.dirty = true;
  }

  update(dt) {
    const { pos, vel, life } = this;
    const drag = Math.exp(-dt * 2.2);
    for (let i = 0; i < this.cap; i++) {
      if (life[i] <= 0) continue;
      life[i] = Math.max(0, life[i] - dt);
      const j = i * 3;
      vel[j] *= drag; vel[j + 1] = vel[j + 1] * drag + dt * 0.25; vel[j + 2] *= drag;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
    }
    const a = this.geometry.attributes;
    a.position.needsUpdate = true; a.alife.needsUpdate = true;
    if (this.dirty) { a.color.needsUpdate = true; a.amax.needsUpdate = true; a.asize.needsUpdate = true; this.dirty = false; }
  }
}
