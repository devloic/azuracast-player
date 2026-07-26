/**
 * ThreeJS icosahedron visualizer object with Perlin noise displacement
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export default {
  mesh: null,
  uniforms: null,
  clock: null,
  composer: null,
  bloomPass: null,
  camera: null,
  mouseX: 0,
  mouseY: 0,
  touch: false,
  listener: null,
  sound: null,
  analyser: null,
  scene: null,
  subdivisions: 30,

  // create and add icosahedron to scene
  create(box, scene, renderer, camera) {
    this.clock = new THREE.Clock();
    this.camera = camera;
    this.scene = scene;

    // Set renderer color space for icosahedron
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Set camera position for icosahedron (with custom zoom)
    this.camera.position.set(2, -2, 7.0);
    this.camera.lookAt(2, 0, 0);

    // Create uniforms for shader
    this.uniforms = {
      u_time: { type: 'f', value: 0.0 },
      u_frequency: { type: 'f', value: 0.0 },
      u_intensity: { type: 'f', value: 1.0 },
      u_red: { type: 'f', value: 0.48 },
      u_green: { type: 'f', value: 0.12 },
      u_blue: { type: 'f', value: 0.16 }
    };

    // Vertex shader with Perlin noise
    const vertexShader = `
uniform float u_time;
uniform float u_frequency;
uniform float u_intensity;

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise, periodic variant
float pnoise(vec3 P, vec3 rep) {
  vec3 Pi0 = mod(floor(P), rep);
  vec3 Pi1 = mod(Pi0 + vec3(1.0), rep);
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

void main() {
    float noise = 3.0 * pnoise(position + u_time, vec3(10.0));
    float displacement = (u_frequency / 30.) * (noise / 10.) * u_intensity;
    vec3 newPosition = position + normal * displacement;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
    `;

    // Fragment shader
    const fragmentShader = `
uniform float u_red;
uniform float u_green;
uniform float u_blue;

void main() {
    gl_FragColor = vec4(vec3(u_red, u_green, u_blue), 1.0);
}
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });

    const geo = new THREE.IcosahedronGeometry(4, 30);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.material.wireframe = true;

    this.touch = (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);
    this.mesh.position.set(2, 0, 0);
    scene.add(this.mesh);

    // Setup THREE.AudioListener (like original)
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    this.sound = new THREE.Audio(this.listener);
    // AudioAnalyser will be created after connecting to audio element

    // Setup bloom post-processing
    if (renderer && camera) {
      this.composer = new EffectComposer(renderer);

      const renderPass = new RenderPass(scene, camera);
      this.composer.addPass(renderPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(box.width, box.height),
        1.32,    // strength
        0.18,    // radius
        0.19     // threshold
      );
      this.composer.addPass(this.bloomPass);

      // Add OutputPass (like original)
      const outputPass = new OutputPass();
      this.composer.addPass(outputPass);
    }
  },

  // animate icosahedron on frame loop
  update(box, mouse, freq) {
    if (!this.mesh) return;

    // Mouse movement disabled - camera position controlled by zoom slider only

    // Update shader uniforms
    this.uniforms.u_time.value = this.clock.getElapsedTime();

    // Use THREE.AudioAnalyser like original (fallback to passed freq if not available)
    if (this.analyser) {
      this.uniforms.u_frequency.value = this.analyser.getAverageFrequency();
    } else {
      this.uniforms.u_frequency.value = freq;
    }
  },

  // set colors
  setColors(colors) {
    if (!this.uniforms) return;
    this.uniforms.u_red.value = colors.red;
    this.uniforms.u_green.value = colors.green;
    this.uniforms.u_blue.value = colors.blue;
  },

  // set bloom parameters
  setBloom(bloom) {
    if (!this.bloomPass) return;
    this.bloomPass.threshold = bloom.threshold;
    this.bloomPass.strength = bloom.strength;
    this.bloomPass.radius = bloom.radius;
  },

  // set wireframe mode
  setWireframe(wireframe) {
    if (!this.mesh) return;
    this.mesh.material.wireframe = wireframe;
  },

  // set zoom level (camera z position)
  setZoom(zoom) {
    if (!this.camera) return;
    this.camera.position.z = zoom;
  },

  // connect to existing Web Audio API analyser node
  connectAnalyser(analyserNode) {
    if (!analyserNode) return;

    try {
      // Wrap the existing analyser in THREE.AudioAnalyser-like interface
      this.analyser = {
        analyser: analyserNode,
        data: new Uint8Array(analyserNode.frequencyBinCount),

        getAverageFrequency() {
          this.analyser.getByteFrequencyData(this.data);

          let sum = 0;
          for (let i = 0; i < this.data.length; i++) {
            sum += this.data[i];
          }
          return sum / this.data.length;
        }
      };

      console.log('THREE.AudioAnalyser-like wrapper created for icosahedron');
    } catch (error) {
      console.warn('Could not create audio analyser wrapper:', error);
    }
  },

  // update smooth level by recreating geometry
  setSmooth(subdivisions) {
    if (!this.mesh || !this.scene) return;

    this.subdivisions = Math.max(0, Math.min(50, subdivisions));

    // Store current material
    const material = this.mesh.material;

    // Remove old mesh
    this.scene.remove(this.mesh);

    // Create new geometry with updated subdivisions
    const geo = new THREE.IcosahedronGeometry(4, this.subdivisions);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.position.set(2, 0, 0);

    // Add back to scene
    this.scene.add(this.mesh);
  },

  // set spike intensity (displacement multiplier)
  setIntensity(intensity) {
    if (!this.uniforms) return;
    this.uniforms.u_intensity.value = Math.max(0, Math.min(5, intensity));
  },
}
