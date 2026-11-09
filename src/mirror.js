// The bathroom mirror. A live reflection costs a second render of the whole scene, so it only
// updates while you're in or near the bathroom. Elsewhere it keeps its last reflection, which
// from across the hall is indistinguishable from the real thing.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { HALL } from './world.js';

export class BathMirror {
  constructor(scene, { x, y, z, w, h }, resolution) {
    // match the reflection's pixel aspect to the mirror's, so the tiles in it don't shimmer
    const mirror = new Reflector(new THREE.PlaneGeometry(w, h), {
      textureWidth: resolution, textureHeight: Math.round(resolution * h / w), color: 0xe6ebef, multisample: 4,
    });
    mirror.position.set(x + 0.035, y, z);
    mirror.rotation.y = Math.PI / 2;
    scene.add(mirror);

    // Reflector re-renders in onBeforeRender; let it through when live, and once at first sight
    const reflect = mirror.onBeforeRender;
    let hasImage = false;
    mirror.onBeforeRender = (...args) => {
      if (!this.live && hasImage) return;
      reflect.apply(mirror, args);
      hasImage = true;
    };

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.02, h + 0.14, w + 0.14),
      new THREE.MeshStandardMaterial({ color: 0xd4a040, metalness: 1, roughness: 0.3 }));
    frame.position.set(x + 0.01, y, z);
    scene.add(frame);
    this.live = false;
  }

  // Go live a couple of metres before the door, and stop a bit further out, so standing in
  // the doorway can't make it flip back and forth.
  update(playerPos) {
    this.live = playerPos.x < HALL.x0 + (this.live ? 3 : 2);
  }
}
