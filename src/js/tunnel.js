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
import Audio from './audio';

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
  baseSpeed: 26,           // units/sec while playing, before audio adds to it
  audioSpeed: 90,          // extra units/sec at full frequency
  twist: 0.25,             // radians/sec the whole tunnel rolls

  // colour — a neon palette rather than a full rainbow. The full wheel put muddy
  // greens and yellows in the tunnel; keeping it inside cyan -> blue -> violet ->
  // magenta -> pink is what reads as "light tunnel".
  hueBase: 0.52,           // cyan
  hueSpan: 0.45,           // ...through to pink (0.97)
  hueDrift: 0.03,          // hue cycles/sec

  // bounce — rings pulse with the music, and the pulse travels down the tunnel
  // rather than every ring breathing in unison.
  bounceAmp: 0.16,         // steady-state wobble scaled by level
  kickAmp: 0.30,           // extra kick on a transient
  wavePhase: 0.06,         // radians per unit of z — spacing of the travelling wave
  waveSpeed: 4.0,          // radians/sec the wave moves
  _smooth: 0,              // running average of level, for transient detection
  _kick: 0,                // decaying beat impulse

  // road — a spectrogram laid flat along the floor of the tunnel. Each frame the
  // current spectrum becomes a new row at the far end; older rows scroll toward
  // the camera, so the surface is a rolling history of the music.
  road: null,
  roadCols: 48,            // samples across the width
  roadRows: 110,           // rows of history along Z
  roadWidth: 44,
  roadHeight: 9,           // vertical scale of the peaks
  roadDrop: 15,            // how far below centre the road sits
  roadRowRate: 34,         // rows pushed per second
  _roadHistory: null,      // Float32Array(roadRows * roadCols), newest at _roadHead
  _roadHead: 0,
  _roadAccum: 0,
  _roadSpectrum: null,     // smoothed spectrum, so rows do not jitter
  _roadLut: null,          // amplitude -> rgb lookup, see _renderRoad()
  roadLutSteps: 48,

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

    this._buildRoad();
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
      color: new THREE.Color().setHSL(this.hueBase + t * this.hueSpan, 1.0, 0.6),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const line = new THREE.LineSegments(geo, mat);
    line.userData.radius = radius;
    line.userData.hue = t * this.hueSpan;
    return line;
  },

  /**
   * The road: a plane laid flat under the tunnel whose vertex heights are a
   * scrolling spectrogram. Wireframe, vertex-coloured, additive — so it glows
   * through the bloom pass like the rings do.
   */
  _buildRoad() {
    const cols = this.roadCols;
    const rows = this.roadRows;
    const depth = this.ringCount * this.ringSpacing;

    const geo = new THREE.PlaneGeometry(this.roadWidth, depth, cols - 1, rows - 1);
    geo.rotateX(-Math.PI / 2);   // lie flat
    geo.translate(0, -this.roadDrop, -depth / 2 + 20);

    const count = geo.attributes.position.count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.road = new THREE.Mesh(geo, mat);
    this.group.add(this.road);

    this._roadHistory = new Float32Array(rows * cols);
    this._roadSpectrum = new Float32Array(cols);
    this._roadHead = 0;
    this._roadAccum = 0;
  },

  /**
   * Push one row of spectrum into the history ring buffer.
   * Mirrored about the centre so the road reads as a symmetrical channel, and
   * smoothed across neighbours plus tapered at the edges so it is rounded rather
   * than a row of hard bars.
   */
  _pushRoadRow(level) {
    const cols = this.roadCols;
    const bins = Audio.getFrequencies();
    const half = Math.ceil(cols / 2);

    for (let i = 0; i < half; i++) {
      let v = 0;
      if (bins && bins.length) {
        // Spread the usable part of the spectrum over half the width; the top
        // bins are mostly empty on a 128-point FFT so they are skipped.
        const b = Math.floor((i / half) * bins.length * 0.7);
        v = (bins[b] || 0) / 255;
      } else {
        v = level;
      }
      // Temporal smoothing: rows ease toward the new value instead of snapping.
      const target = Math.pow(v, 1.4);              // tame the noise floor
      this._roadSpectrum[i] += (target - this._roadSpectrum[i]) * 0.45;
    }

    const row = this._roadHead * cols;
    for (let i = 0; i < cols; i++) {
      // mirror the right half back over the left
      const src = (i < half) ? i : (cols - 1 - i);
      // 3-tap blur across the width
      const a = this._roadSpectrum[Math.max(0, src - 1)];
      const b = this._roadSpectrum[src];
      const c = this._roadSpectrum[Math.min(half - 1, src + 1)];
      let v = (a + 2 * b + c) / 4;

      // taper to zero at the road edges so it does not end in a cliff
      const edge = Math.sin((i / (cols - 1)) * Math.PI);
      this._roadHistory[row + i] = v * edge;
    }
  },

  // write the history buffer into the mesh's vertices and colours
  _renderRoad(level) {
    if (!this.road) return;

    const cols = this.roadCols;
    const rows = this.roadRows;
    const pos = this.road.geometry.attributes.position;
    const col = this.road.geometry.attributes.color;

    // Colour through a lookup table rather than setHSL per vertex: this runs for
    // every vertex of a 48x110 grid on every frame, and HSL conversion there costs
    // ~300k calls/sec. The table is built once and quantises amplitude instead.
    if (!this._roadLut) {
      const steps = this.roadLutSteps;
      this._roadLut = new Float32Array(steps * 3);
      const tmp = new THREE.Color();
      for (let i = 0; i < steps; i++) {
        const v = i / (steps - 1);
        tmp.setHSL(this.hueBase + (1 - v) * this.hueSpan * 0.8, 1.0, 0.12 + 0.55 * v);
        this._roadLut[i * 3] = tmp.r;
        this._roadLut[i * 3 + 1] = tmp.g;
        this._roadLut[i * 3 + 2] = tmp.b;
      }
    }
    const lut = this._roadLut;
    const maxStep = this.roadLutSteps - 1;

    for (let r = 0; r < rows; r++) {
      // row 0 of the mesh is the far end; walk back through history from the head
      const h = (this._roadHead - r + rows * 2) % rows;
      for (let i = 0; i < cols; i++) {
        const v = this._roadHistory[h * cols + i];
        const idx = r * cols + i;

        pos.setY(idx, -this.roadDrop + v * this.roadHeight);

        // Same neon band as the rings, brightness by amplitude.
        const k = Math.min(maxStep, Math.max(0, Math.round(v * maxStep))) * 3;
        col.setXYZ(idx, lut[k], lut[k + 1], lut[k + 2]);
      }
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.road.geometry.computeBoundingSphere();
  },

  /**
   * @param box   bounding box of the canvas
   * @param mouse { x, y } pointer position, used to steer the tunnel slightly
   * @param freq    0..1 audio level from scene.js
   * @param playing  when false the tunnel is frozen — no travel, no roll, no bounce
   */
  update(box, mouse, freq, playing) {
    if (!this.group || !this.clock) return;

    const dt = Math.min(this.clock.getDelta(), 0.1); // clamp after a tab switch
    const elapsed = this.clock.getElapsedTime();

    // Nothing plays, nothing moves. getFreqData() decays its fallback counter
    // toward zero when paused, but that still crept the tunnel forward, so the
    // level is forced to zero rather than trusted.
    const level = playing ? Math.max(0, Math.min(1, freq || 0)) : 0;

    // Transient detection: compare the level against its own running average and
    // convert the overshoot into a kick that decays fast. This is what makes the
    // rings snap on a beat instead of swelling smoothly.
    this._smooth += (level - this._smooth) * 0.08;
    const transient = Math.max(0, level - this._smooth - 0.03);
    this._kick = Math.max(this._kick * Math.pow(0.0015, dt), transient * 5);

    const speed = playing ? (this.baseSpeed + this.audioSpeed * level) : 0;
    const depth = this.ringCount * this.ringSpacing;
    const recycleAt = (this.camera ? this.camera.position.z : 30) + this.ringSpacing;

    for (const ring of this.rings) {
      if (speed) ring.position.z += speed * dt;

      // Past the camera: send it to the far end with a new look.
      if (ring.position.z > recycleAt) {
        ring.position.z -= depth;
        ring.rotation.z = Math.random() * Math.PI * 2;
      }

      // Fade in from the far end so rings do not pop into existence.
      const dist = recycleAt - ring.position.z;
      ring.material.opacity = 0.15 + 0.75 * (1 - Math.min(1, dist / depth));

      // Hue stays inside the neon band as it drifts.
      const hue = this.hueBase + ((ring.userData.hue + elapsed * this.hueDrift) % this.hueSpan);
      ring.material.color.setHSL(hue, 1.0, 0.5 + 0.22 * level);

      // Bounce. The phase comes from the ring's own z, so the pulse travels along
      // the tunnel instead of every ring scaling together.
      const phase = ring.position.z * this.wavePhase + elapsed * this.waveSpeed;
      const amount = this.bounceAmp * level + this.kickAmp * this._kick;
      const scale = 1 + amount * Math.sin(phase);
      ring.scale.set(scale, scale, 1);
    }

    // Road: advance the spectrogram at a fixed row rate so its scroll speed is
    // independent of frame rate, and only while something is playing.
    if (playing) {
      this._roadAccum += dt * this.roadRowRate;
      while (this._roadAccum >= 1) {
        this._roadAccum -= 1;
        this._roadHead = (this._roadHead + 1) % this.roadRows;
        this._pushRoadRow(level);
      }
    }
    this._renderRoad(level);

    // Slow roll, plus a gentle lean toward the pointer so it feels alive.
    // The road rolls with the tunnel because it is a child of the same group.
    if (playing) this.group.rotation.z += this.twist * dt;

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

    if (this.road) {
      this.road.geometry.dispose();
      this.road.material.dispose();
      this.road = null;
    }
    this._roadHistory = null;
    this._roadSpectrum = null;
    this._roadLut = null;

    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }
    this.group = null;
    this.composer = null;
    this.bloomPass = null;
  },
};
