/**
 * ThreeJS scene handler
 */
import * as THREE from 'three';
import Sphere from './sphere';
import Icosahedron from './icosahedron';
import Tunnel from './tunnel';
import Audio from './audio';

export default {
  _wrap: null,
  _canvas: null,
  _renderer: null,
  _scene: null,
  _camera: null,
  _box: null,
  _mouse: { x: 0, y: 0 },
  // Drag-to-rotate. _dragDelta accumulates between frames and is applied as an
  // ADDITIVE offset in updateObjects(), never as an absolute rotation: the sphere
  // spins itself (rotation.y -= 0.003 every frame) and setting rotation outright
  // would freeze that.
  _drag: { active: false, x: 0, y: 0 },
  _dragDelta: { x: 0, y: 0 },
  _dragSpeed: 0.005,
  // Wheel zoom. The two visualisers live at very different camera distances —
  // the icosahedron slider runs 5..50 (default 7), the sphere sits at 300 — so
  // the clamp is per-shape and the step is multiplicative, which feels the same
  // at both scales.
  _zoomStep: 1.1,
  _zoomRanges: {
    icosahedron: { min: 5, max: 50 },
    sphere: { min: 80, max: 900 },
    tunnel: { min: 10, max: 220 },
  },
  // Single registry, so a new shape is one entry here instead of editing every
  // `=== 'sphere' ? Sphere : Icosahedron` ternary.
  _visualizers: { sphere: Sphere, icosahedron: Icosahedron, tunnel: Tunnel },
  // These build their own EffectComposer and need the renderer + camera.
  _needsRenderer: ['icosahedron', 'tunnel'],
  _objects: [],
  _currentVisualizer: 'icosahedron', // 'sphere' or 'icosahedron'
  _sphereCameraPos: { x: 0, y: 0, z: 300 }, // Store sphere camera position

  // setup animation canvas
  setupCanvas() {
    this._wrap   = document.querySelector('#player-wrap');
    this._canvas = document.querySelector('#player-canvas');
    this._box    = this._wrap.getBoundingClientRect();

    // setup scene and renderer
    this._scene = new THREE.Scene();
    this._renderer = new THREE.WebGLRenderer({ canvas: this._canvas, alpha: true, antialias: true, precision: 'lowp' });
    this._renderer.setClearColor(0x000000, 0);
    this._renderer.setPixelRatio(window.devicePixelRatio);

    // setup camera
    this._camera = new THREE.PerspectiveCamera(60, (this._box.width / this._box.height), 0.1, 20000);
    this._camera.lookAt(this._scene.position);
    this._camera.position.set(0, 0, 300);
    this._camera.rotation.set(0, 0, 0);

    // add visualizers but create only the current one
    this._objects = [Sphere, Icosahedron];
    this._createCurrentVisualizer();

    // setup events
    window.addEventListener('mousemove', this.updateMouse.bind(this));
    window.addEventListener('resize', this.updateSize.bind(this));

    // Pointer events (mouse + touch + pen) on the wrapper rather than the canvas:
    // .player-layout sits above the canvas at z-index 3, so the canvas never sees
    // them. Drags starting on interactive UI are ignored so buttons, sliders and
    // the track list keep working.
    this._wrap.addEventListener('pointerdown', this.onDragStart.bind(this));
    // passive:false so preventDefault() can stop the page scrolling while zooming.
    this._wrap.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    window.addEventListener('pointermove', this.onDragMove.bind(this));
    window.addEventListener('pointerup', this.onDragEnd.bind(this));
    window.addEventListener('pointercancel', this.onDragEnd.bind(this));
    this.updateMouse();
    this.updateSize();
  },

  // the active visualizer object
  current() {
    return this._visualizers[this._currentVisualizer] || Sphere;
  },

  // create the currently selected visualizer
  _createCurrentVisualizer() {
    const visualizer = this.current();
    if (this._needsRenderer.includes(this._currentVisualizer)) {
      visualizer.create(this._box, this._scene, this._renderer, this._camera);

      // Connect Web Audio API analyser to icosahedron (THREE.AudioAnalyser-like)
      const analyser = Audio.getAnalyser();
      if (analyser) {
        visualizer.connectAnalyser(analyser);
      }
    } else {
      visualizer.create(this._box, this._scene);
    }
  },

  // switch between visualizers
  switchVisualizer(type) {
    if (type === this._currentVisualizer) return;

    // Save camera position if leaving sphere
    if (this._currentVisualizer === 'sphere') {
      this._sphereCameraPos.x = this._camera.position.x;
      this._sphereCameraPos.y = this._camera.position.y;
      this._sphereCameraPos.z = this._camera.position.z;
    }

    // Remove old visualizer objects from scene
    const oldVisualizer = this.current();
    if (typeof oldVisualizer.dispose === 'function') oldVisualizer.dispose();
    if (oldVisualizer.group) {
      this._scene.remove(oldVisualizer.group);
      oldVisualizer.group = null;
    }
    if (oldVisualizer.mesh) {
      this._scene.remove(oldVisualizer.mesh);
      oldVisualizer.mesh = null;
    }

    // Switch to new visualizer
    this._currentVisualizer = type;

    // Restore camera position if switching to sphere
    if (type === 'sphere') {
      this._camera.position.set(this._sphereCameraPos.x, this._sphereCameraPos.y, this._sphereCameraPos.z);
      this._camera.lookAt(this._scene.position);
    }

    this._createCurrentVisualizer();
  },

  // zoom with the wheel, unless the pointer is over scrollable/interactive UI
  onWheel(e) {
    // .player-content is the scroll container, so let the track list scroll
    // normally and only zoom over the open background.
    if (e.target.closest('a, button, input, select, textarea, label, .card, .player-tracklist')) return;
    if (!this._camera) return;

    e.preventDefault();

    const range = this._zoomRanges[this._currentVisualizer] || this._zoomRanges.sphere;
    const factor = (e.deltaY > 0) ? this._zoomStep : (1 / this._zoomStep);
    const z = Math.min(range.max, Math.max(range.min, this._camera.position.z * factor));

    this._camera.position.z = z;

    // Keep the saved sphere position in step, or switching away and back would
    // discard the zoom.
    if (this._currentVisualizer === 'sphere') this._sphereCameraPos.z = z;

    // Let the UI mirror it, so the icosahedron zoom slider does not jump the
    // next time it is touched.
    window.dispatchEvent(new CustomEvent('visualizer-zoom', {
      detail: { visualizer: this._currentVisualizer, zoom: z },
    }));
  },

  // start a drag, unless it began on something interactive
  onDragStart(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('a, button, input, select, textarea, label, .card, .player-tracklist')) return;

    this._drag.active = true;
    this._drag.x = e.clientX;
    this._drag.y = e.clientY;
    this._wrap.classList.add('is-dragging');
  },

  // accumulate movement; applied on the next frame
  onDragMove(e) {
    if (!this._drag.active) return;

    this._dragDelta.y += (e.clientX - this._drag.x) * this._dragSpeed;
    this._dragDelta.x += (e.clientY - this._drag.y) * this._dragSpeed;
    this._drag.x = e.clientX;
    this._drag.y = e.clientY;
  },

  onDragEnd() {
    if (!this._drag.active) return;
    this._drag.active = false;
    this._wrap.classList.remove('is-dragging');
  },

  // update custom objects in 3d scene
  updateObjects(freq, avgFreq, playing) {
    // Only update the current visualizer
    const visualizer = this.current();

    // Icosahedron wants the raw 0-255 average (more responsive); sphere and tunnel
    // take the normalised 0-1 value.
    const freqValue = this._currentVisualizer === 'icosahedron' ? avgFreq : freq;
    visualizer.update(this._box, this._mouse, freqValue, playing);

    // Apply and consume the drag delta. Additive, so it layers on top of whatever
    // the visualizer just did to its own rotation.
    if (this._dragDelta.x || this._dragDelta.y) {
      const obj = visualizer.mesh || visualizer.group;
      if (obj) {
        obj.rotation.x += this._dragDelta.x;
        obj.rotation.y += this._dragDelta.y;
      }
      this._dragDelta.x = 0;
      this._dragDelta.y = 0;
    }

    // Render through the visualizer's own composer when it has one (bloom), else
    // straight through the renderer.
    if (visualizer.composer) {
      visualizer.composer.render();
    } else {
      this._renderer.render(this._scene, this._camera);
    }
  },

  // update canvas size
  updateSize() {
    if (!this._wrap || !this._canvas) return;
    this._box = this._wrap.getBoundingClientRect();
    this._canvas.width = this._box.width;
    this._canvas.height = this._box.height;
    this._camera.aspect = (this._box.width / this._box.height);
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(this._box.width, this._box.height);

    // Update composer size if icosahedron is active
    if (this._currentVisualizer === 'icosahedron' && Icosahedron.composer) {
      Icosahedron.composer.setSize(this._box.width, this._box.height);
    }
  },

  // update mouse position from center of canvas
  updateMouse(e) {
    if (!this._box) return;
    const centerX = this._box.left + (this._box.width / 2);
    const centerY = this._box.top + (this._box.height / 2);

    if (e) {
      this._mouse.x = Math.max(0, e.pageX || e.clientX || 0) - centerX;
      this._mouse.y = Math.max(0, e.pageY || e.clientY || 0) - centerY;
    } else {
      this._mouse.x = centerX;
      this._mouse.y = centerY;
    }
  },

  // update icosahedron colors
  updateIcoColors(colors) {
    if (this._currentVisualizer === 'icosahedron') {
      Icosahedron.setColors(colors);
    }
  },

  // update icosahedron bloom
  updateIcoBloom(bloom) {
    if (this._currentVisualizer === 'icosahedron') {
      Icosahedron.setBloom(bloom);
    }
  },

  // update icosahedron settings
  updateIcoSettings(settings) {
    if (this._currentVisualizer === 'icosahedron') {
      Icosahedron.setWireframe(settings.wireframe);
    }
  },

  // update icosahedron zoom
  updateIcoZoom(zoom) {
    if (this._currentVisualizer === 'icosahedron') {
      Icosahedron.setZoom(zoom);
    }
  },

  // update icosahedron smooth level
  updateIcoSmooth(subdivisions) {
    if (this._currentVisualizer === 'icosahedron') {
      Icosahedron.setSmooth(subdivisions);
    }
  },

  // update icosahedron spike intensity
  updateIcoIntensity(intensity) {
    if (this._currentVisualizer === 'icosahedron') {
      Icosahedron.setIntensity(intensity);
    }
  },
}
