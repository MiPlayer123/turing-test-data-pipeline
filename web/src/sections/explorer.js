import * as d3 from 'd3';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';
import { CONDITIONS, CONDITION_COLOR } from '../data/constants.js';
import { createFilterChips } from '../components/filterChips.js';
import * as tooltip from '../components/tooltip.js';
import { openTranscriptPanel } from '../components/chatSnippet.js';

function gaussianKDE(points, gridX, gridY, bandwidth) {
  const nx = gridX.length, ny = gridY.length;
  const grid = new Float64Array(nx * ny);
  const bw2 = bandwidth * bandwidth;
  const norm = 1 / (2 * Math.PI * bw2 * points.length);
  const cutoff = 9 * bw2;
  for (const [px, py] of points) {
    for (let ix = 0; ix < nx; ix++) {
      const dx = gridX[ix] - px;
      const dx2 = dx * dx;
      if (dx2 > cutoff) continue;
      for (let iy = 0; iy < ny; iy++) {
        const dy = gridY[iy] - py;
        const r2 = dx2 + dy * dy;
        if (r2 < cutoff) grid[ix * ny + iy] += norm * Math.exp(-r2 / (2 * bw2));
      }
    }
  }
  return grid;
}

// Topographic paper ramp: low density reads as warm grey contour, peaks
// pull strongly toward the accent rust. Skewed so the mid + high band has
// most of the visual weight — keeps the mesh legible against paper instead
// of fading into it.
function heightColor(t) {
  const stops = [
    [0.847, 0.820, 0.780], // #D8D1C7 — warm beige
    [0.600, 0.576, 0.545], // #99938B — warm mid-grey
    [0.373, 0.353, 0.329], // #5F5A54 — dark warm grey
    [0.200, 0.188, 0.176], // #33302D — near-black warm
    [0.118, 0.110, 0.102], // #1E1C1A — almost black at peaks
  ];
  const k = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
  const i = Math.floor(k);
  const f = k - i;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  return new THREE.Color(
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  );
}

export function init(data) {
  const container = document.getElementById('explorer-viz');
  container.innerHTML = '';

  const convs = data.trajectories.conversations;
  // Data is pipeline-normalized: rep^0.30 → clip@p99 → mean-center → [-1,1]
  //                               hedge^0.40 → clip@p99 → mean-center → [-1,1]
  const reps   = convs.map(c => c.final[0]);
  const hedges = convs.map(c => c.final[2]);

  // Add a small seeded jitter so conversations with identical zero values
  // (77 are stacked at exactly the same point) spread into a readable cloud
  // rather than a single spike. Magnitude ~3% of the data range.
  const JITTER = 0.032;
  const seededRand = (i, salt) => {
    const x = Math.sin(i * 9301 + salt * 49297 + 233) * 10000;
    return (x - Math.floor(x) - 0.5) * 2; // uniform in [-1, 1]
  };
  const repsJ   = reps.map((v, i)   => v + seededRand(i, 0) * JITTER);
  const hedgesJ = hedges.map((v, i) => v + seededRand(i, 1) * JITTER);
  const points = convs.map((_, i) => [repsJ[i], hedgesJ[i]]);

  const pad  = 0.22;
  const xMin = d3.min(repsJ)   - pad, xMax = d3.max(repsJ)   + pad;
  const yMin = d3.min(hedgesJ) - pad, yMax = d3.max(hedgesJ) + pad;

  // KDE grid
  const gridRes = 80;
  const gridX = d3.range(gridRes).map(i => xMin + (xMax - xMin) * i / (gridRes - 1));
  const gridY = d3.range(gridRes).map(i => yMin + (yMax - yMin) * i / (gridRes - 1));
  const stdX = d3.deviation(repsJ)   || 0.01;
  const stdY = d3.deviation(hedgesJ) || 0.01;
  const bw = 0.9 * Math.min(stdX, stdY) * Math.pow(points.length, -0.2);
  const density = gaussianKDE(points, gridX, gridY, bw);
  const maxDensity = d3.max(density);

  // Three.js setup
  const W = container.clientWidth, H = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(W, H);
  renderer.setClearColor(0xF2EDE2);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 100);
  camera.position.set(1.9, 1.4, 1.9);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.target.set(0.5, 0.2, 0.5);
  controls.minDistance = 0.35;
  // Clamp zoom-out so the scene cannot shrink beyond the intended framing.
  controls.maxDistance = 2.65;
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const heightScale = 0.7;

  // Wireframe surface
  const geo = new THREE.BufferGeometry();
  const vertCount = gridRes * gridRes;
  const positions = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);

  for (let ix = 0; ix < gridRes; ix++) {
    for (let iy = 0; iy < gridRes; iy++) {
      const vi = ix * gridRes + iy;
      const t = density[vi] / maxDensity;
      positions[vi * 3] = ix / (gridRes - 1);
      positions[vi * 3 + 1] = t * heightScale;
      positions[vi * 3 + 2] = iy / (gridRes - 1);
      const col = heightColor(t);
      colors[vi * 3] = col.r; colors[vi * 3 + 1] = col.g; colors[vi * 3 + 2] = col.b;
    }
  }

  const lineIndices = [];
  for (let ix = 0; ix < gridRes; ix++)
    for (let iy = 0; iy < gridRes - 1; iy++)
      lineIndices.push(ix * gridRes + iy, ix * gridRes + iy + 1);
  for (let iy = 0; iy < gridRes; iy++)
    for (let ix = 0; ix < gridRes - 1; ix++)
      lineIndices.push(ix * gridRes + iy, (ix + 1) * gridRes + iy);

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(lineIndices);
  scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 })));

  // Floor contour lines
  const contourPixels = 256;
  const cxScale = d3.scaleLinear().domain([xMin, xMax]).range([0, contourPixels]);
  const cyScale = d3.scaleLinear().domain([yMin, yMax]).range([0, contourPixels]);
  const contourData = d3.contourDensity()
    .x(d => cxScale(d[0])).y(d => cyScale(d[1]))
    .size([contourPixels, contourPixels])
    .bandwidth(bw / (xMax - xMin) * contourPixels * 0.7)
    .thresholds(10)(points);

  contourData.forEach(contour => {
    const t = contour.value / d3.max(contourData, d => d.value);
    const col = heightColor(t);
    contour.coordinates.forEach(polygon => {
      polygon.forEach(ring => {
        const pts = ring.map(([cx, cy]) => new THREE.Vector3(cx / contourPixels, -0.002, cy / contourPixels));
        if (pts.length < 2) return;
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.7 })
        ));
      });
    });
  });

  // Floor grid
  const gridMat = new THREE.LineBasicMaterial({ color: 0x21262D, transparent: true, opacity: 0.3 });
  for (let i = 0; i <= 10; i++) {
    const v = i / 10;
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(v, -0.003, 0), new THREE.Vector3(v, -0.003, 1)]), gridMat));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.003, v), new THREE.Vector3(1, -0.003, v)]), gridMat));
  }

  // Axes
  const axisMat = new THREE.LineBasicMaterial({ color: 0x484F58 });
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(1.08,0,0)]), axisMat));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0, heightScale*1.1, 0)]), axisMat));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,1.08)]), axisMat));

  // Labels
  function makeLabel(text, position, fontSize = 0.035) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; canvas.height = 64;
    ctx.fillStyle = '#6E6557';
    ctx.font = `${Math.round(fontSize * 500)}px Inter Tight, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.position.copy(position);
    sprite.scale.set(0.28, 0.07, 1);
    return sprite;
  }

  for (let i = 0; i <= 4; i++) {
    const frac = i / 4;
    const xVal = xMin + (xMax - xMin) * frac;
    scene.add(makeLabel(xVal.toFixed(2), new THREE.Vector3(frac, -0.04, 1.06)));
  }
  scene.add(makeLabel('Repetitiveness', new THREE.Vector3(0.5, -0.07, 1.14), 0.038));
  for (let i = 0; i <= 4; i++) {
    const frac = i / 4;
    scene.add(makeLabel((yMin + (yMax - yMin) * frac).toFixed(2), new THREE.Vector3(-0.07, -0.04, frac)));
  }
  scene.add(makeLabel('Hedging', new THREE.Vector3(-0.1, -0.07, 0.5), 0.038));
  scene.add(makeLabel('Density', new THREE.Vector3(-0.07, heightScale * 0.5, -0.04), 0.038));

  // Conversations shown in the 2D plot sections — their dots get a glow ring in this plot.
  const HIGHLIGHTED_IDS = new Set([
    // gridReveal — three archetype dots
    'conv_ai_ai_freeform_claudesonnet4_gemini25flash_F1_1775427182',
    'conv_human_ai_wildchat_0116',
    'conv_human_human_personachat_0073',
    // subtypes — one per AI-AI variant
    'conv_ai_ai_freeform_gemini25flash_grok41fast_F3_1775428210',
    'conv_ai_ai_freeform_persona_claudesonnet4_gemini25flash_F5_1775424545',
    'conv_ai_ai_detective_grok41fast_claudesonnet4_D5_1775425836',
    'conv_ai_ai_reverse_turing_claudesonnet4_gpt54mini_F2_1775423379',
    'conv_ai_ai_structured_gpt54mini_claudesonnet4_S1_1775412302',
    // timeline
    // 'conv_human_human_personachat_0079',
  ]);

  // Scatter dots
  const dotPositions = [];
  const dotColors = [];
  const dotConditions = [];
  const hlIndices = []; // indices into convs[] that should glow

  convs.forEach((c, i) => {
    const nx = (repsJ[i]   - xMin) / (xMax - xMin);
    const nz = (hedgesJ[i] - yMin) / (yMax - yMin);
    const gx = Math.min(gridRes - 1, Math.max(0, Math.round(nx * (gridRes - 1))));
    const gz = Math.min(gridRes - 1, Math.max(0, Math.round(nz * (gridRes - 1))));
    const h = (density[gx * gridRes + gz] / maxDensity) * heightScale + 0.005;
    dotPositions.push(nx, h, nz);
    const col = new THREE.Color(CONDITION_COLOR[c.condition] || '#fff');
    dotColors.push(col.r, col.g, col.b);
    dotConditions.push(c.condition);
    if (HIGHLIGHTED_IDS.has(c.id)) hlIndices.push(i);
  });

  // Entrance animation: points start scattered high/wide, fly into their real positions.
  const finalPositions = Float32Array.from(dotPositions);
  const startPositions = new Float32Array(finalPositions.length);
  for (let i = 0; i < finalPositions.length; i += 3) {
    startPositions[i]     = Math.random() * 1.4 - 0.2;        // x ~ [-0.2, 1.2]
    startPositions[i + 1] = 1.0 + Math.random() * 0.8;        // y high above surface
    startPositions[i + 2] = Math.random() * 1.4 - 0.2;        // z ~ [-0.2, 1.2]
  }
  const livePositions = new Float32Array(startPositions);

  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(livePositions, 3));
  dotGeo.setAttribute('color', new THREE.Float32BufferAttribute(dotColors, 3));
  const _circleCanvas = document.createElement('canvas');
  _circleCanvas.width = _circleCanvas.height = 64;
  const _circleCtx = _circleCanvas.getContext('2d');
  _circleCtx.beginPath();
  _circleCtx.arc(32, 32, 30, 0, Math.PI * 2);
  _circleCtx.fillStyle = '#fff';
  _circleCtx.fill();
  const _circleTex = new THREE.CanvasTexture(_circleCanvas);
  _circleTex.minFilter = THREE.LinearFilter;

  const dotMat = new THREE.PointsMaterial({ size: 0.015, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0, map: _circleTex, alphaTest: 0.5 });
  const dotMesh = new THREE.Points(dotGeo, dotMat);
  dotMesh.frustumCulled = false;
  scene.add(dotMesh);

  // ── Glow layer: one ring per highlighted conversation ─────────────────────
  const hlCount = hlIndices.length;
  const hlLivePos = new Float32Array(hlCount * 3);
  const hlBaseColors = new Float32Array(hlCount * 3); // full-bright colors for reset
  const hlGeoColors  = new Float32Array(hlCount * 3);

  hlIndices.forEach((srcIdx, hi) => {
    // Start at the same scrambled position the main dot uses
    hlLivePos[hi * 3]     = startPositions[srcIdx * 3];
    hlLivePos[hi * 3 + 1] = startPositions[srcIdx * 3 + 1];
    hlLivePos[hi * 3 + 2] = startPositions[srcIdx * 3 + 2];
    const col = new THREE.Color(CONDITION_COLOR[convs[srcIdx].condition] || '#fff');
    col.toArray(hlBaseColors, hi * 3);
    col.toArray(hlGeoColors,  hi * 3);
  });

  const hlGeo = new THREE.BufferGeometry();
  hlGeo.setAttribute('position', new THREE.BufferAttribute(hlLivePos, 3));
  hlGeo.setAttribute('color',    new THREE.Float32BufferAttribute(hlGeoColors, 3));

  const hlMat = new THREE.ShaderMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uOpacity:    { value: 0 },
      uFalloff:    { value: 20.0 },
      uBrightness: { value: 3.0 },
      uWhiteMix:   { value: 0.70 },
    },
    vertexShader: `
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float screenPx = projectionMatrix[1][1] * 300.0 * 0.075 / (-mv.z);
        gl_PointSize = clamp(screenPx, 8.0, 44.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uFalloff;
      uniform float uBrightness;
      uniform float uWhiteMix;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float bloom = exp(-d * d * uFalloff) * uBrightness;
        vec3 lifted = mix(vColor, vec3(1.0), uWhiteMix);
        gl_FragColor = vec4(lifted, bloom * uOpacity);
      }
    `,
  });

  const hlMesh = new THREE.Points(hlGeo, hlMat);
  hlMesh.frustumCulled = false;
  scene.add(hlMesh);
  // ─────────────────────────────────────────────────────────────────────────


  // Drive the fly-in with a GSAP tween once Three.js has rendered the first frame.
  const entrance = { t: 0 };
  const startEntrance = () => {
    gsap.to(entrance, {
      t: 1,
      duration: 2.8,
      ease: 'power3.out',
      onUpdate: () => {
        const posAttr = dotGeo.attributes.position;
        const arr = posAttr.array;
        const k = entrance.t;
        for (let i = 0; i < finalPositions.length; i++) {
          arr[i] = startPositions[i] + (finalPositions[i] - startPositions[i]) * k;
        }
        posAttr.needsUpdate = true;
        dotMat.opacity = Math.min(1, k * 1.4);

        // Keep glow dots in sync with the entrance fly-in
        const hlArr = hlGeo.attributes.position.array;
        hlIndices.forEach((srcIdx, hi) => {
          hlArr[hi * 3]     = startPositions[srcIdx * 3]     + (finalPositions[srcIdx * 3]     - startPositions[srcIdx * 3])     * k;
          hlArr[hi * 3 + 1] = startPositions[srcIdx * 3 + 1] + (finalPositions[srcIdx * 3 + 1] - startPositions[srcIdx * 3 + 1]) * k;
          hlArr[hi * 3 + 2] = startPositions[srcIdx * 3 + 2] + (finalPositions[srcIdx * 3 + 2] - startPositions[srcIdx * 3 + 2]) * k;
        });
        hlGeo.attributes.position.needsUpdate = true;
        hlMat.uniforms.uOpacity.value = Math.min(1, k * 1.4);
      },
    });
  };
  // Kick off entrance on next frame — the surface has already rendered.
  requestAnimationFrame(() => setTimeout(startEntrance, 200));

  // Filter chips
  const filtersEl = document.getElementById('explorer-filters');
  createFilterChips(filtersEl, {
    onToggle(active) {
      const colAttr = dotGeo.attributes.color;
      const hlColAttr = hlGeo.attributes.color;
      // Warm muted grey from the paper palette (matches --ink-4) so dimmed
      // dots recede gently instead of going near-black against the cream bg.
      const fadeCol = new THREE.Color(0x9A8F7C);
      const singleSelected = active.size === 1;
      const selectedKey = singleSelected ? Array.from(active)[0] : null;
      convs.forEach((c, i) => {
        const base = new THREE.Color(CONDITION_COLOR[c.condition] || '#fff');
        const isFocus = singleSelected ? c.condition === selectedKey : active.has(c.condition);
        // Keep non-focused points visible but clearly faded.
        const col = isFocus ? base : base.clone().lerp(fadeCol, 0.78);
        colAttr.setXYZ(i, col.r, col.g, col.b);
      });
      colAttr.needsUpdate = true;

      // Sync glow layer colors with the same fade logic
      hlIndices.forEach((srcIdx, hi) => {
        const c = convs[srcIdx];
        const base = new THREE.Color(CONDITION_COLOR[c.condition] || '#fff');
        const isFocus = singleSelected ? c.condition === selectedKey : active.has(c.condition);
        const col = isFocus ? base : base.clone().lerp(fadeCol, 0.78);
        hlColAttr.setXYZ(hi, col.r, col.g, col.b);
      });
      hlColAttr.needsUpdate = true;
    },
  });

  // Click-to-open transcript panel via raycasting on the scatter points.
  // Threshold is sized to match the on-screen dot radius; tweak if hit-testing feels off.
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 0.02 };
  const ndc = new THREE.Vector2();
  let downPos = null;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    downPos = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    // Ignore if the user dragged (OrbitControls rotate) — only treat true clicks as selection
    if (!downPos) return;
    const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
    downPos = null;
    if (dx * dx + dy * dy > 16) return;

    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    ndc.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(dotMesh);
    if (!hits.length) return;
    const idx = hits[0].index;
    const conv = convs[idx];
    if (!conv) return;
    const csvRow = (data.conversations || []).find(r => r.conversation_id === conv.id);
    openTranscriptPanel({
      conversation_id: conv.id,
      condition: conv.condition,
      model_a: conv.model_a,
      model_b: conv.model_b,
      hedging:        csvRow?.hedging,
      repetitiveness: csvRow?.repetitiveness,
      coherence:      csvRow?.coherence,
    });
  });

  // Resize
  window.addEventListener('resize', () => {
    const nw = container.clientWidth, nh = container.clientHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });

  // Render loop
  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
}
