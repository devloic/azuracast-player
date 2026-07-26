/**
 * ThreeJS scene handler
 */
import * as THREE from 'three';
import Sphere from './sphere';
import Icosahedron from './icosahedron';
import Audio from './audio';

export default {
  _wrap: null,
  _canvas: null,
  _renderer: null,
  _scene: null,
  _camera: null,
  _box: null,
  _mouse: { x: 0, y: 0 },
  _objects: [],
  _currentVisualizer: 'sphere', // 'sphere' or 'icosahedron'
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
    this.updateMouse();
    this.updateSize();
  },

  // create the currently selected visualizer
  _createCurrentVisualizer() {
    const visualizer = this._currentVisualizer === 'sphere' ? Sphere : Icosahedron;
    if (this._currentVisualizer === 'icosahedron') {
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
    const oldVisualizer = this._currentVisualizer === 'sphere' ? Sphere : Icosahedron;
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

  // update custom objects in 3d scene
  updateObjects(freq, avgFreq) {
    // Only update the current visualizer
    const visualizer = this._currentVisualizer === 'sphere' ? Sphere : Icosahedron;

    // Use average frequency for icosahedron (more responsive), normalized freq for sphere
    const freqValue = this._currentVisualizer === 'icosahedron' ? avgFreq : freq;
    visualizer.update(this._box, this._mouse, freqValue);

    // Render: use composer for icosahedron (with bloom), regular renderer for sphere
    if (this._currentVisualizer === 'icosahedron' && Icosahedron.composer) {
      Icosahedron.composer.render();
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
