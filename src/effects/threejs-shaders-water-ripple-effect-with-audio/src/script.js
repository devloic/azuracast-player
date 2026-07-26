import * as THREE from "https://esm.sh/three@0.177.0";
import { Pane } from "https://cdn.skypack.dev/tweakpane@4.0.4";
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
const renderer = new THREE.WebGLRenderer({
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById("container").appendChild(renderer.domElement);
let isPlaying = false;
let audioContext = null;
let analyser = null;
let dataArray = null;
let source = null;
let panelVisible = false;
let audioLevels = {
  bassLevel: 0,
  midLevel: 0,
  trebleLevel: 0,
  overallLevel: 0
};
let bassMonitor, midMonitor, trebleMonitor, overallMonitor;
const audio = new Audio();
audio.src = "https://assets.codepen.io/7558/xor-is-epic-1446.mp3";
audio.preload = "auto";
audio.volume = 1.0;
audio.crossOrigin = "anonymous";
audio.addEventListener("ended", () => {
  if (isPlaying) {
    audio.currentTime = 0;
    audio.play();
  }
});
audio.load();

function initAudioAnalysis() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      console.log("Web Audio API initialized successfully");
    }
  } catch (e) {
    console.warn("Web Audio API failed to initialize:", e);
    analyser = null;
    dataArray = null;
  }
}
const waterSettings = {
  resolution: 256,
  damping: 0.913,
  tension: 0.02,
  rippleStrength: 0.2,
  mouseIntensity: 1.2,
  clickIntensity: 3.0,
  rippleRadius: 8,
  splatForce: 50000,
  splatThickness: 0.1,
  vorticityInfluence: 0.2,
  swirlIntensity: 0.2,
  pressure: 0.3,
  velocityDissipation: 0.08,
  densityDissipation: 1.0,
  displacementScale: 0.01
};
const resolution = waterSettings.resolution;
let waterBuffers = {
  current: new Float32Array(resolution * resolution),
  previous: new Float32Array(resolution * resolution),
  velocity: new Float32Array(resolution * resolution * 2),
  vorticity: new Float32Array(resolution * resolution),
  pressure: new Float32Array(resolution * resolution)
};
for (let i = 0; i < resolution * resolution; i++) {
  waterBuffers.current[i] = 0.0;
  waterBuffers.previous[i] = 0.0;
  waterBuffers.velocity[i * 2] = 0.0;
  waterBuffers.velocity[i * 2 + 1] = 0.0;
  waterBuffers.vorticity[i] = 0.0;
  waterBuffers.pressure[i] = 0.0;
}
const waterTexture = new THREE.DataTexture(
  waterBuffers.current,
  waterSettings.resolution,
  waterSettings.resolution,
  THREE.RedFormat,
  THREE.FloatType
);
waterTexture.minFilter = THREE.LinearFilter;
waterTexture.magFilter = THREE.LinearFilter;
waterTexture.needsUpdate = true;

function createTextTexture() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.textRenderingOptimization = "optimizeQuality";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const scale = Math.max(0.4, Math.min(1.2, width / 1920));
  const paragraphSize = Math.max(16, Math.min(28, 22 * scale));
  const paragraphText =
    "Love is the one thing we're capable of perceiving that transcends\ndimensions of time and space. Through the tesseract, we glimpse\nthe fourth dimension where past, present, and future converge.\nWe are not bound by linear time—we are its architects.";
  ctx.font = `400 ${paragraphSize}px "GT Standard", Arial, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const paragraphLines = paragraphText.split("\n");
  const lineHeight = paragraphSize * 1.3;
  const totalTextHeight = paragraphLines.length * lineHeight;
  const startY = height / 2 - totalTextHeight / 2 + lineHeight / 2;
  paragraphLines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    ctx.fillText(line, width / 2, y);
  });
  return canvas;
}
const colorPresets = {
  "Electric Blue": {
    color1: [0.0, 0.5, 1.0],
    color2: [0.0, 0.8, 1.0],
    color3: [0.2, 0.3, 1.0],
    background: [0.0, 0.05, 0.1]
  },
  "Neon Pink": {
    color1: [1.0, 0.0, 0.5],
    color2: [1.0, 0.3, 0.7],
    color3: [0.9, 0.1, 0.6],
    background: [0.1, 0.0, 0.05]
  },
  "Cyber Green": {
    color1: [0.0, 1.0, 0.3],
    color2: [0.2, 0.9, 0.1],
    color3: [0.0, 0.8, 0.2],
    background: [0.0, 0.1, 0.02]
  },
  "Golden Hour": {
    color1: [1.0, 0.7, 0.2],
    color2: [1.0, 0.9, 0.3],
    color3: [0.9, 0.6, 0.1],
    background: [0.1, 0.05, 0.0]
  },
  "Deep Purple": {
    color1: [0.6, 0.2, 1.0],
    color2: [0.8, 0.4, 0.9],
    color3: [0.4, 0.1, 0.7],
    background: [0.05, 0.0, 0.1]
  },
  "Ice White": {
    color1: [1.0, 1.0, 1.0],
    color2: [0.9, 0.95, 1.0],
    color3: [0.8, 0.9, 1.0],
    background: [0.02, 0.02, 0.05]
  },
  "Pure Monochrome": {
    color1: [1.0, 1.0, 1.0],
    color2: [1.0, 1.0, 1.0],
    color3: [1.0, 1.0, 1.0],
    background: [0.0, 0.0, 0.0]
  }
};
const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
const fragmentShader = `
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
      uniform vec3 u_background;
      uniform float u_speed;
      uniform sampler2D u_waterTexture;
      uniform float u_waterStrength;
      uniform float u_ripple_time;
      uniform vec2 u_ripple_position;
      uniform float u_ripple_strength;
      uniform sampler2D u_textTexture;
      uniform bool u_showText;
      uniform bool u_isMonochrome;
      uniform float u_audioLow;
      uniform float u_audioMid;
      uniform float u_audioHigh;
      uniform float u_audioOverall;
      uniform float u_audioReactivity;
      
      varying vec2 vUv;

      void main() {
        vec2 r = u_resolution;
        vec2 FC = gl_FragCoord.xy;
        vec2 uv = vec2(FC.x / r.x, 1.0 - FC.y / r.y);
        vec2 screenP = (FC.xy * 2.0 - r) / r.y;
        
        vec2 wCoord = vec2(FC.x / r.x, FC.y / r.y);
        float waterHeight = texture2D(u_waterTexture, wCoord).r;
        float waterInfluence = clamp(waterHeight * u_waterStrength, -0.5, 0.5);
        
        float baseRadius = 0.9;
        float audioPulse = u_audioOverall * u_audioReactivity * 0.1;
        float waterPulse = waterInfluence * 0.3;
        float circleRadius = baseRadius + audioPulse + waterPulse;
        
        float distFromCenter = length(screenP);
        float inCircle = smoothstep(circleRadius + 0.1, circleRadius - 0.1, distFromCenter);
        
        vec4 o = vec4(0.0);
        
        if (inCircle > 0.0) {
          vec2 p = screenP * 1.1;
          
          float rippleTime = u_time - u_ripple_time;
          vec2 ripplePos = u_ripple_position * r;
          float rippleDist = distance(FC.xy, ripplePos);
          
          float clickRipple = 0.0;
          if (rippleTime < 3.0 && rippleTime > 0.0) {
            float rippleRadius = rippleTime * 150.0;
            float rippleWidth = 30.0;
            float rippleDecay = 1.0 - rippleTime / 3.0;
            clickRipple = exp(-abs(rippleDist - rippleRadius) / rippleWidth) * rippleDecay * u_ripple_strength;
          }
          
          float totalWaterInfluence = clamp((waterInfluence + clickRipple * 0.1) * u_waterStrength, -0.8, 0.8);
          float audioInfluence = (u_audioLow * 0.3 + u_audioMid * 0.4 + u_audioHigh * 0.3) * u_audioReactivity;
          
          float angle = length(p) * 4.0 + audioInfluence * 2.0;
          mat2 R = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
          p *= R;
          
          float l = length(p) - 0.7 + totalWaterInfluence * 0.5 + audioInfluence * 0.2;
          float t = u_time * u_speed + totalWaterInfluence * 2.0 + audioInfluence * 1.5;
          float enhancedY = p.y + totalWaterInfluence * 0.3 + audioInfluence * 0.2;
          
          float pattern1 = 0.5 + 0.5 * tanh(0.1 / max(l / 0.1, -l) - sin(l + enhancedY * max(1.0, -l / 0.1) + t));
          float pattern2 = 0.5 + 0.5 * tanh(0.1 / max(l / 0.1, -l) - sin(l + enhancedY * max(1.0, -l / 0.1) + t + 1.0));
          float pattern3 = 0.5 + 0.5 * tanh(0.1 / max(l / 0.1, -l) - sin(l + enhancedY * max(1.0, -l / 0.1) + t + 2.0));
          
          float intensity = 1.0 + totalWaterInfluence * 0.5 + audioInfluence * 0.3;
          
          if (u_isMonochrome) {
            float mono = (pattern1 + pattern2 + pattern3) / 3.0 * intensity;
            o = vec4(mono, mono, mono, inCircle);
          } else {
            o.r = pattern1 * u_color1.r * intensity;
            o.g = pattern2 * u_color2.g * intensity;
            o.b = pattern3 * u_color3.b * intensity;
            o.a = inCircle;
          }
        }
        
        vec3 bgColor = u_isMonochrome ? vec3(0.0) : u_background;
        vec3 finalColor = bgColor;
        
        finalColor = mix(finalColor, o.rgb, o.a);
        
        if (u_showText) {
          vec2 waterCoords = vec2(FC.x / r.x, FC.y / r.y);
          float step = 1.0 / r.x;
          vec2 waterGrad = clamp(vec2(
            texture2D(u_waterTexture, vec2(waterCoords.x + step, waterCoords.y)).r - 
            texture2D(u_waterTexture, vec2(waterCoords.x - step, waterCoords.y)).r,
            texture2D(u_waterTexture, vec2(waterCoords.x, waterCoords.y + step)).r - 
            texture2D(u_waterTexture, vec2(waterCoords.x, waterCoords.y - step)).r
          ) * u_waterStrength, -0.1, 0.1);
          
          vec2 textDistortedUV = uv + waterGrad * 0.15;
          vec4 textColor = texture2D(u_textTexture, textDistortedUV);
          
          if (u_isMonochrome) {
            float textLum = dot(textColor.rgb, vec3(0.299, 0.587, 0.114));
            textColor = vec4(textLum, textLum, textLum, textColor.a);
          }
          
          finalColor = mix(finalColor, textColor.rgb, textColor.a);
        }
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    u_time: {
      value: 0.0
    },
    u_resolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight)
    },
    u_speed: {
      value: 1.3
    },
    u_color1: {
      value: new THREE.Vector3(1.0, 1.0, 1.0)
    },
    u_color2: {
      value: new THREE.Vector3(0.9, 0.95, 1.0)
    },
    u_color3: {
      value: new THREE.Vector3(0.8, 0.9, 1.0)
    },
    u_background: {
      value: new THREE.Vector3(0.02, 0.02, 0.05)
    },
    u_waterTexture: {
      value: waterTexture
    },
    u_waterStrength: {
      value: 0.55
    },
    u_ripple_time: {
      value: -10.0
    },
    u_ripple_position: {
      value: new THREE.Vector2(0.5, 0.5)
    },
    u_ripple_strength: {
      value: 0.5
    },
    u_textTexture: {
      value: null
    },
    u_showText: {
      value: true
    },
    u_isMonochrome: {
      value: false
    },
    u_audioLow: {
      value: 0.0
    },
    u_audioMid: {
      value: 0.0
    },
    u_audioHigh: {
      value: 0.0
    },
    u_audioOverall: {
      value: 0.0
    },
    u_audioReactivity: {
      value: 1.0
    }
  }
});
const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
camera.position.z = 1;
const settings = {
  preset: "Ice White",
  animationSpeed: 1.3,
  waterStrength: 0.55,
  mouseIntensity: 1.2,
  clickIntensity: 3.0,
  rippleStrength: 0.5,
  damping: 0.913,
  showText: true,
  audioVolume: 1.0,
  impactForce: 50000,
  rippleSize: 0.1,
  swirlingMotion: 0.2,
  spiralIntensity: 0.2,
  fluidPressure: 0.3,
  motionDecay: 0.08,
  rippleDecay: 1.0,
  waveHeight: 0.01,
  audioReactivity: 1.0,
  bassResponse: 1.0,
  midResponse: 1.0,
  trebleResponse: 1.0
};

function updateAudioAnalysis() {
  if (analyser && dataArray && isPlaying) {
    analyser.getByteFrequencyData(dataArray);
    const bassEnd = Math.floor(dataArray.length * 0.1);
    const midEnd = Math.floor(dataArray.length * 0.5);
    let bass = 0,
      mid = 0,
      treble = 0;
    for (let i = 0; i < bassEnd; i++) bass += dataArray[i];
    bass = (bass / bassEnd / 255) * settings.bassResponse;
    for (let i = bassEnd; i < midEnd; i++) mid += dataArray[i];
    mid = (mid / (midEnd - bassEnd) / 255) * settings.midResponse;
    for (let i = midEnd; i < dataArray.length; i++) treble += dataArray[i];
    treble =
      (treble / (dataArray.length - midEnd) / 255) * settings.trebleResponse;
    const overall = (bass + mid + treble) / 3;
    // Update live audio level monitors
    audioLevels.bassLevel = bass;
    audioLevels.midLevel = mid;
    audioLevels.trebleLevel = treble;
    audioLevels.overallLevel = overall;
    if (bassMonitor) {
      bassMonitor.refresh();
      midMonitor.refresh();
      trebleMonitor.refresh();
      overallMonitor.refresh();
    }
    const smoothing = 0.8;
    material.uniforms.u_audioLow.value =
      material.uniforms.u_audioLow.value * smoothing + bass * (1 - smoothing);
    material.uniforms.u_audioMid.value =
      material.uniforms.u_audioMid.value * smoothing + mid * (1 - smoothing);
    material.uniforms.u_audioHigh.value =
      material.uniforms.u_audioHigh.value * smoothing +
      treble * (1 - smoothing);
    material.uniforms.u_audioOverall.value =
      material.uniforms.u_audioOverall.value * smoothing +
      overall * (1 - smoothing);
  }
}

function setupTextTexture() {
  const waitForFonts = () => {
    Promise.all([
      document.fonts.load('bold 80px "GT Standard"'),
      document.fonts.load('400 24px "GT Standard"')
    ])
      .then(() => {
        setTimeout(() => {
          const textCanvas = createTextTexture();
          const textTexture = new THREE.CanvasTexture(textCanvas);
          textTexture.flipY = false;
          textTexture.generateMipmaps = false;
          textTexture.minFilter = THREE.LinearFilter;
          textTexture.magFilter = THREE.LinearFilter;
          material.uniforms.u_textTexture.value = textTexture;
        }, 100);
      })
      .catch(() => {
        setTimeout(() => {
          const textCanvas = createTextTexture();
          const textTexture = new THREE.CanvasTexture(textCanvas);
          textTexture.flipY = false;
          textTexture.generateMipmaps = false;
          textTexture.minFilter = THREE.LinearFilter;
          textTexture.magFilter = THREE.LinearFilter;
          material.uniforms.u_textTexture.value = textTexture;
        }, 1000);
      });
  };
  waitForFonts();
}

function updateWaterSimulation() {
  const { current, previous, velocity, vorticity } = waterBuffers;
  const { damping, resolution } = waterSettings;
  const safeTension = Math.min(waterSettings.tension, 0.05);
  const velocityDissipation = settings.motionDecay;
  const densityDissipation = settings.rippleDecay;
  const vorticityInfluence = Math.min(
    Math.max(settings.swirlingMotion, 0.0),
    0.5
  );
  // Apply velocity dissipation
  for (let i = 0; i < resolution * resolution * 2; i++) {
    velocity[i] *= 1.0 - velocityDissipation;
  }
  // Calculate vorticity with proper edge handling
  for (let i = 1; i < resolution - 1; i++) {
    for (let j = 1; j < resolution - 1; j++) {
      const index = i * resolution + j;
      const left = velocity[(index - 1) * 2 + 1];
      const right = velocity[(index + 1) * 2 + 1];
      const bottom = velocity[(index - resolution) * 2];
      const top = velocity[(index + resolution) * 2];
      vorticity[index] = (right - left - (top - bottom)) * 0.5;
    }
  }
  // Apply vorticity forces
  if (vorticityInfluence > 0.001) {
    for (let i = 1; i < resolution - 1; i++) {
      for (let j = 1; j < resolution - 1; j++) {
        const index = i * resolution + j;
        const velIndex = index * 2;
        const left = Math.abs(vorticity[index - 1]);
        const right = Math.abs(vorticity[index + 1]);
        const bottom = Math.abs(vorticity[index - resolution]);
        const top = Math.abs(vorticity[index + resolution]);
        const gradX = (right - left) * 0.5;
        const gradY = (top - bottom) * 0.5;
        const length = Math.sqrt(gradX * gradX + gradY * gradY) + 1e-5;
        const safeVorticity = Math.max(-1.0, Math.min(1.0, vorticity[index]));
        const forceX =
          (gradY / length) * safeVorticity * vorticityInfluence * 0.1;
        const forceY =
          (-gradX / length) * safeVorticity * vorticityInfluence * 0.1;
        velocity[velIndex] += Math.max(-0.1, Math.min(0.1, forceX));
        velocity[velIndex + 1] += Math.max(-0.1, Math.min(0.1, forceY));
      }
    }
  }
  // Water simulation with proper edge boundaries (no wrapping)
  for (let i = 1; i < resolution - 1; i++) {
    for (let j = 1; j < resolution - 1; j++) {
      const index = i * resolution + j;
      const velIndex = index * 2;
      const top = previous[index - resolution];
      const bottom = previous[index + resolution];
      const left = previous[index - 1];
      const right = previous[index + 1];
      current[index] = (top + bottom + left + right) / 2 - current[index];
      current[index] =
        current[index] * damping + previous[index] * (1 - damping);
      current[index] += (0 - previous[index]) * safeTension;
      const velMagnitude = Math.sqrt(
        velocity[velIndex] * velocity[velIndex] +
          velocity[velIndex + 1] * velocity[velIndex + 1]
      );
      const safeVelInfluence = Math.min(
        velMagnitude * settings.waveHeight,
        0.1
      );
      current[index] += safeVelInfluence;
      current[index] *= 1.0 - densityDissipation * 0.01;
      current[index] = Math.max(-2.0, Math.min(2.0, current[index]));
    }
  }
  // Apply zero boundary conditions to prevent edge wrapping
  for (let i = 0; i < resolution; i++) {
    // Top and bottom edges
    current[i] = 0;
    current[(resolution - 1) * resolution + i] = 0;
    velocity[i * 2] = 0;
    velocity[i * 2 + 1] = 0;
    velocity[((resolution - 1) * resolution + i) * 2] = 0;
    velocity[((resolution - 1) * resolution + i) * 2 + 1] = 0;
    // Left and right edges
    current[i * resolution] = 0;
    current[i * resolution + (resolution - 1)] = 0;
    velocity[i * resolution * 2] = 0;
    velocity[i * resolution * 2 + 1] = 0;
    velocity[(i * resolution + (resolution - 1)) * 2] = 0;
    velocity[(i * resolution + (resolution - 1)) * 2 + 1] = 0;
  }
  [waterBuffers.current, waterBuffers.previous] = [
    waterBuffers.previous,
    waterBuffers.current
  ];
  waterTexture.image.data = waterBuffers.current;
  waterTexture.needsUpdate = true;
}

function addRipple(x, y, strength = 1.0) {
  const { resolution, rippleRadius } = waterSettings;
  const normalizedX = x / window.innerWidth;
  const normalizedY = 1.0 - y / window.innerHeight;
  const texX = Math.floor(normalizedX * resolution);
  const texY = Math.floor(normalizedY * resolution);
  const radius = Math.max(
    rippleRadius,
    Math.floor(settings.rippleSize * resolution)
  );
  const rippleStrength = strength * (settings.impactForce / 100000);
  const radiusSquared = radius * radius;
  for (let i = -radius; i <= radius; i++) {
    for (let j = -radius; j <= radius; j++) {
      const distanceSquared = i * i + j * j;
      if (distanceSquared <= radiusSquared) {
        const posX = texX + i;
        const posY = texY + j;
        if (posX >= 0 && posX < resolution && posY >= 0 && posY < resolution) {
          const index = posY * resolution + posX;
          const velIndex = index * 2;
          const distance = Math.sqrt(distanceSquared);
          const falloff = 1.0 - distance / radius;
          const rippleValue =
            Math.cos((distance / radius) * Math.PI * 0.5) *
            rippleStrength *
            falloff;
          waterBuffers.previous[index] += rippleValue;
          const angle = Math.atan2(j, i);
          const velocityStrength = rippleValue * settings.spiralIntensity;
          waterBuffers.velocity[velIndex] += Math.cos(angle) * velocityStrength;
          waterBuffers.velocity[velIndex + 1] +=
            Math.sin(angle) * velocityStrength;
          const swirlAngle = angle + Math.PI * 0.5;
          const swirlStrength = Math.min(velocityStrength * 0.3, 0.1);
          waterBuffers.velocity[velIndex] +=
            Math.cos(swirlAngle) * swirlStrength;
          waterBuffers.velocity[velIndex + 1] +=
            Math.sin(swirlAngle) * swirlStrength;
        }
      }
    }
  }
}
const pane = new Pane({
  title: "Audio-Reactive Water Shader"
});

function togglePanel() {
  panelVisible = !panelVisible;
  const paneElement = document.querySelector(".tp-dfwv");
  const helpHint = document.getElementById("helpHint");
  if (panelVisible) {
    paneElement.classList.add("visible");
    helpHint.classList.add("hidden");
  } else {
    paneElement.classList.remove("visible");
    helpHint.classList.remove("hidden");
  }
}
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "h") {
    togglePanel();
  }
});
const presetBinding = pane.addBinding(settings, "preset", {
  options: Object.keys(colorPresets).reduce((acc, key) => {
    acc[key] = key;
    return acc;
  }, {})
});
presetBinding.on("change", (ev) => {
  const preset = colorPresets[ev.value];
  material.uniforms.u_color1.value.fromArray(preset.color1);
  material.uniforms.u_color2.value.fromArray(preset.color2);
  material.uniforms.u_color3.value.fromArray(preset.color3);
  material.uniforms.u_background.value.fromArray(preset.background);
  const isMonochrome = ev.value === "Pure Monochrome";
  material.uniforms.u_isMonochrome.value = isMonochrome;
});
const animFolder = pane.addFolder({
  title: "Animation"
});
animFolder
  .addBinding(settings, "animationSpeed", {
    min: 0.1,
    max: 3.0,
    step: 0.1
  })
  .on("change", (ev) => (material.uniforms.u_speed.value = ev.value));
const audioFolder = pane.addFolder({
  title: "Audio Reactive Settings"
});
// Add live audio level monitors
bassMonitor = audioFolder.addBinding(audioLevels, "bassLevel", {
  readonly: true,
  min: 0,
  max: 1,
  label: "Bass Level"
});
midMonitor = audioFolder.addBinding(audioLevels, "midLevel", {
  readonly: true,
  min: 0,
  max: 1,
  label: "Mid Level"
});
trebleMonitor = audioFolder.addBinding(audioLevels, "trebleLevel", {
  readonly: true,
  min: 0,
  max: 1,
  label: "Treble Level"
});
overallMonitor = audioFolder.addBinding(audioLevels, "overallLevel", {
  readonly: true,
  min: 0,
  max: 1,
  label: "Overall Level"
});
audioFolder
  .addBinding(settings, "audioReactivity", {
    min: 0.0,
    max: 3.0,
    step: 0.1
  })
  .on("change", (ev) => (material.uniforms.u_audioReactivity.value = ev.value));
audioFolder
  .addBinding(settings, "bassResponse", {
    min: 0.0,
    max: 3.0,
    step: 0.1
  })
  .on("change", (ev) => console.log("Bass response changed to:", ev.value));
audioFolder
  .addBinding(settings, "midResponse", {
    min: 0.0,
    max: 3.0,
    step: 0.1
  })
  .on("change", (ev) => console.log("Mid response changed to:", ev.value));
audioFolder
  .addBinding(settings, "trebleResponse", {
    min: 0.0,
    max: 3.0,
    step: 0.1
  })
  .on("change", (ev) => console.log("Treble response changed to:", ev.value));
const waterFolder = pane.addFolder({
  title: "Water Settings"
});
waterFolder
  .addBinding(settings, "waterStrength", {
    min: 0.0,
    max: 1.0,
    step: 0.05
  })
  .on("change", (ev) => {
    material.uniforms.u_waterStrength.value = ev.value;
    waterSettings.rippleStrength = ev.value;
  });
waterFolder
  .addBinding(settings, "rippleStrength", {
    min: 0.0,
    max: 1.0,
    step: 0.05
  })
  .on("change", (ev) => (material.uniforms.u_ripple_strength.value = ev.value));
waterFolder
  .addBinding(settings, "mouseIntensity", {
    min: 0.1,
    max: 3.0,
    step: 0.1
  })
  .on("change", (ev) => (waterSettings.mouseIntensity = ev.value));
waterFolder
  .addBinding(settings, "clickIntensity", {
    min: 0.5,
    max: 6.0,
    step: 0.1
  })
  .on("change", (ev) => (waterSettings.clickIntensity = ev.value));
const textFolder = pane.addFolder({
  title: "Text Display"
});
textFolder
  .addBinding(settings, "showText")
  .on("change", (ev) => (material.uniforms.u_showText.value = ev.value));
const audioControlFolder = pane.addFolder({
  title: "Audio"
});
audioControlFolder
  .addBinding(settings, "audioVolume", {
    min: 0.0,
    max: 1.0,
    step: 0.1
  })
  .on("change", (ev) => (audio.volume = ev.value));
// RESTORED ORIGINAL MOUSE BEHAVIOR - no click required
let lastMousePosition = {
  x: 0,
  y: 0
};
let mouseThrottleTime = 0;

function onMouseMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const now = performance.now();
  if (now - mouseThrottleTime < 8) return;
  mouseThrottleTime = now;
  const dx = x - lastMousePosition.x;
  const dy = y - lastMousePosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const velocity = distance / 8;
  if (distance > 1) {
    const velocityInfluence = Math.min(velocity / 10, 2.0);
    const baseIntensity = Math.min(distance / 20, 1.0);
    const fluidIntensity =
      baseIntensity * velocityInfluence * waterSettings.mouseIntensity;
    const variation = Math.random() * 0.3 + 0.7;
    const finalIntensity = fluidIntensity * variation;
    const jitterX = x + (Math.random() - 0.5) * 3;
    const jitterY = y + (Math.random() - 0.5) * 3;
    addRipple(jitterX, jitterY, finalIntensity);
    lastMousePosition.x = x;
    lastMousePosition.y = y;
  }
}

function onMouseClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  addRipple(x, y, waterSettings.clickIntensity);
  const clickX = x / window.innerWidth;
  const clickY = 1.0 - y / window.innerHeight;
  material.uniforms.u_ripple_position.value.set(clickX, clickY);
  material.uniforms.u_ripple_time.value = clock.getElapsedTime();
}

function onTouchMove(event) {
  event.preventDefault();
  const rect = renderer.domElement.getBoundingClientRect();
  const touch = event.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  const now = performance.now();
  if (now - mouseThrottleTime < 8) return;
  mouseThrottleTime = now;
  const dx = x - lastMousePosition.x;
  const dy = y - lastMousePosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const velocity = distance / 8;
  if (distance > 1) {
    const velocityInfluence = Math.min(velocity / 10, 2.0);
    const baseIntensity = Math.min(distance / 20, 1.0);
    const fluidIntensity =
      baseIntensity * velocityInfluence * waterSettings.mouseIntensity;
    const variation = Math.random() * 0.3 + 0.7;
    const finalIntensity = fluidIntensity * variation;
    const jitterX = x + (Math.random() - 0.5) * 3;
    const jitterY = y + (Math.random() - 0.5) * 3;
    addRipple(jitterX, jitterY, finalIntensity);
    lastMousePosition.x = x;
    lastMousePosition.y = y;
  }
}

function onTouchStart(event) {
  event.preventDefault();
  const rect = renderer.domElement.getBoundingClientRect();
  const touch = event.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  addRipple(x, y, waterSettings.clickIntensity);
  const clickX = x / window.innerWidth;
  const clickY = 1.0 - y / window.innerHeight;
  material.uniforms.u_ripple_position.value.set(clickX, clickY);
  material.uniforms.u_ripple_time.value = clock.getElapsedTime();
}
window.addEventListener("mousemove", onMouseMove);
window.addEventListener("click", onMouseClick);
window.addEventListener("touchmove", onTouchMove, {
  passive: false
});
window.addEventListener("touchstart", onTouchStart, {
  passive: false
});
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  material.uniforms.u_time.value = elapsed;
  updateAudioAnalysis();
  updateWaterSimulation();
  renderer.render(scene, camera);
}
const audioBtn = document.getElementById("audioBtn");
audioBtn.addEventListener("click", () => {
  if (!isPlaying) {
    initAudioAnalysis();
    audio
      .play()
      .then(() => {
        isPlaying = true;
        audioBtn.textContent = "[ stop ]";
        console.log("Audio started, analyser available:", !!analyser);
      })
      .catch((e) => {
        console.log("Audio play failed:", e);
        audioBtn.textContent = "[ audio failed ]";
      });
  } else {
    audio.pause();
    audio.currentTime = 0;
    isPlaying = false;
    audioBtn.textContent = "[ play ]";
    console.log("Audio stopped");
  }
});

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  material.uniforms.u_resolution.value.set(width, height);
  setupTextTexture();
}
window.addEventListener("resize", onWindowResize);
setupTextTexture();
animate();
const initialPreset = colorPresets[settings.preset];
material.uniforms.u_color1.value.fromArray(initialPreset.color1);
material.uniforms.u_color2.value.fromArray(initialPreset.color2);
material.uniforms.u_color3.value.fromArray(initialPreset.color3);
material.uniforms.u_background.value.fromArray(initialPreset.background);
material.uniforms.u_ripple_strength.value = settings.rippleStrength;
material.uniforms.u_waterStrength.value = settings.waterStrength;
material.uniforms.u_speed.value = settings.animationSpeed;
material.uniforms.u_audioReactivity.value = settings.audioReactivity;
material.uniforms.u_isMonochrome.value = false;
setTimeout(() => {
  addRipple(window.innerWidth / 2, window.innerHeight / 2, 1.5);
}, 500);
