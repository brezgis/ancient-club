// Post-processing: bloom for the disco, a wobble for the wine, and an adaptive quality ladder
// that steps down if frames get slow.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Q } from './quality.js';

const FULLSCREEN_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

// One stray NaN from a scan's normals would smear across the whole bloom; scrub them first.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: FULLSCREEN_VERT,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = min(c, vec4(64.0));
    }`,
};

const DrunkShader = {
  uniforms: { tDiffuse: { value: null }, uDrunk: { value: 0 }, uTime: { value: 0 } },
  vertexShader: FULLSCREEN_VERT,
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
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    // MSAA on the scene pass keeps statue silhouettes and slab edges clean
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Q.msaa });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.drunk = new ShaderPass(DrunkShader);
    this.composer.addPass(this.drunk);
    this.composer.addPass(new OutputPass());
    this.scene = scene;
    this.camera = camera;
    this.perf = { ema: 1 / 60, since: 0, step: 0 };
    this.setPixelRatio(Q.pixelRatio);
  }

  setPixelRatio(pr) {
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    this.resize();
  }

  resize(w = innerWidth, h = innerHeight) {
    if (w < 16 || h < 16) return;   // minimised or covered: keep the last good size
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    // the composer sizes every pass to full resolution; bloom only needs a fraction of it
    this.bloom.setSize(w * Q.bloomScale, h * Q.bloomScale);
  }

  // If frames stay slow (a laptop GPU, say), step down one rung at a time.
  adapt(dt) {
    const p = this.perf;
    p.ema += (dt - p.ema) * 0.02;
    p.since += dt;
    if (p.since < 4 || p.ema < 1 / 42) return;
    const steps = [
      () => this.setPixelRatio(Math.max(1, Q.pixelRatio * 0.75)),
      () => {
        if (!this.renderer.shadowMap.enabled) return;
        this.renderer.shadowMap.enabled = false;
        this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
      },
      () => this.setPixelRatio(0.85),
      () => { this.bloom.enabled = false; },
    ];
    if (p.step >= steps.length) return;
    steps[p.step++]();
    p.since = 0;
    console.info('quality step', p.step);
  }

  render(t, drunk) {
    this.drunk.uniforms.uDrunk.value = drunk;
    this.drunk.uniforms.uTime.value = t;
    this.composer.render();
  }
}
