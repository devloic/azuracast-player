/**
 * Light tunnel visualizer.
 *
 * Rings of glowing line segments receding down -Z. They travel toward the camera,
 * and each one that passes behind it is recycled to the far end with a fresh hue
 * and radius, so a fixed pool of geometry gives an endless tunnel.
 *
 * Follows the same contract as icosahedron.js: create(box, scene, renderer, camera)
 * builds its own EffectComposer with a bloom pass, and scene.js renders through
 * this.composer when it exists.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export default {
  group: null,
  rings: [],
  clock: null,
  composer: null,
  bloomPass: null,
  camera: null,
  scene: null,

  // tunnel shape
  ringCount: 90,
  ringSpacing: 8,          // z distance between rings
  baseRadius: 14,
  radiusJitter: 3,
  segments: 64,            // points per ring
  gapChance: 0.35,         // fraction of a ring left dark, so it reads as segments

  // motion
  baseSpeed: 26,           // units/sec with no audio
  audioSpeed: 90,          // extra units/sec at full frequency
  twist: 0.25,             // radians/sec the whole tunnel rolls

  // colour
  hueSpread: 0.85,         // how much of the colour wheel one tunnel length covers
  hueDrift: 0.05,          // hue cycles/sec

  create(box, scene, renderer, camera) {
    this.dispose();

    this.scene = scene;
    this.camera = camera;
    this.clock = new THREE.Clock();
    this.group = new THREE.Group();
    this.rings = [];

    const depth = this.ringCount * this.ringSpacing;

    for (let i = 0; i < this.ringCount; i++) {
      const ring = this._buildRing(i / this.ringCount);
      ring.position.z = -i * this.ringSpacing;
      ring.rotation.z = Math.random() * Math.PI * 2;
      this.group.add(ring);
      this.rings.push(ring);
    }

    this.group.position.set(0, 0, 0);
    scene.add(this.group);

    // Camera looks straight down the tunnel. scene.js's wheel zoom moves this on
    // Z, which reads as travelling further in or out — no clamping needed here.
    if (camera) {
      camera.position.set(0, 0, 30);
      camera.lookAt(0, 0, -depth * 0.5);
    }

    if (renderer && camera) {
      this.composer = new EffectComposer(renderer);
      this.composer.addPass(new RenderPass(scene, camera));

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(box.width, box.height),
        1.4,   // strength — the glow is the whole point here
        0.6,   // radius
        0.15   // threshold, low so the coloured lines bloom rather than only whites
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }
  },

  /**
   * One ring: a LineSegments circle with random gaps, so the tunnel wall reads as
   * dashes of light rather than solid hoops.
   */
  _buildRing(t) {
    const radius = this.baseRadius + (Math.random() - 0.5) * 2 * this.radiusJitter;
    const positions = [];

    for (let s = 0; s < this.segments; s++) {
      if (Math.random() < this.gapChance) continue;

      const a0 = (s / this.segments) * Math.PI * 2;
      const a1 = ((s + 1) / this.segments) * Math.PI * 2;

      positions.push(Math.cos(a0) * radius, Math.sin(a0) * radius, 0);
      positions.push(Math.cos(a1) * radius, Math.sin(a1) * radius, 0);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color().setHSL(t * this.hueSpread, 1.0, 0.55),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const line = new THREE.LineSegments(geo, mat);
    line.userData.radius = radius;
    line.userData.hue = t * this.hueSpread;
    return line;
  },

  /**
   * @param box   bounding box of the canvas
   * @param mouse { x, y } pointer position, used to steer the tunnel slightly
   * @param freq  0..1 audio level from scene.js
   */
  update(box, mouse, freq) {
    if (!this.group || !this.clock) return;

    const dt = Math.min(this.clock.getDelta(), 0.1); // clamp after a tab switch
    const elapsed = this.clock.getElapsedTime();
    const level = Math.max(0, Math.min(1, freq || 0));

    const speed = this.baseSpeed + this.audioSpeed * level;
    const depth = this.ringCount * this.ringSpacing;
    const recycleAt = (this.camera ? this.camera.position.z : 30) + this.ringSpacing;

    for (const ring of this.rings) {
      ring.position.z += speed * dt;

      // Past the camera: send it to the far end with a new look.
      if (ring.position.z > recycleAt) {
        ring.position.z -= depth;
        ring.rotation.z = Math.random() * Math.PI * 2;
      }

      // Fade in from the far end so rings do not pop into existence.
      const dist = recycleAt - ring.position.z;
      ring.material.opacity = 0.15 + 0.75 * (1 - Math.min(1, dist / depth));

      // Hue cycles along the tunnel and drifts over time.
      const hue = (ring.userData.hue + elapsed * this.hueDrift) % 1;
      ring.material.color.setHSL(hue, 1.0, 0.45 + 0.25 * level);

      // Audio pushes the walls outward a little.
      const scale = 1 + 0.18 * level;
      ring.scale.set(scale, scale, 1);
    }

    // Slow roll, plus a gentle lean toward the pointer so it feels alive.
    this.group.rotation.z += this.twist * dt;

    if (mouse && box && box.width && box.height) {
      const tx = (mouse.x / box.width - 0.5) * 0.25;
      const ty = (mouse.y / box.height - 0.5) * 0.25;
      this.group.rotation.y += (tx - this.group.rotation.y) * 0.05;
      this.group.rotation.x += (-ty - this.group.rotation.x) * 0.05;
    }
  },

  // scene.js calls this when the icosahedron path connects a Web Audio analyser;
  // the tunnel is driven by the freq value passed to update(), so nothing to do.
  connectAnalyser() {},

  dispose() {
    if (this.rings && this.rings.length) {
      for (const ring of this.rings) {
        ring.geometry.dispose();
        ring.material.dispose();
      }
    }
    this.rings = [];

    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }
    this.group = null;
    this.composer = null;
    this.bloomPass = null;
  },
};
