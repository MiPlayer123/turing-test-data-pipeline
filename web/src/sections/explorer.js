import * as d3 from 'd3';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';
import { CONDITIONS, CONDITION_COLOR } from '../data/constants.js';
import { createFilterChips } from '../components/filterChips.js';
import * as tooltip from '../components/tooltip.js';
import { getCornerRect, unlight } from '../lib/cornerDots.js';
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

function heightColor(t) {
  if (t < 0.25) {
    const s = t / 0.25;
    return new THREE.Color(0.07 + s * 0.0, 0.1 + s * 0.3, 0.4 + s * 0.3);
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return new THREE.Color(0.07 + s * 0.05, 0.4 + s * 0.35, 0.7 - s * 0.05);
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return new THREE.Color(0.12 + s * 0.5, 0.75 + s * 0.15, 0.65 - s * 0.35);
  } else {
    const s = (t - 0.75) / 0.25;
    return new THREE.Color(0.62 + s * 0.38, 0.9 + s * 0.1, 0.3 - s * 0.15);
  }
}

export function init(data) {
  const container = document.getElementById('explorer-viz');
  container.innerHTML = '';

  const convs = data.trajectories.conversations;
  const sqrtReps = convs.map(c => Math.sqrt(c.final[0]));
  const cohs = convs.map(c => c.final[1]);
  const points = convs.map((c, i) => [sqrtReps[i], cohs[i]]);

  const xMin = 0, xMax = d3.max(sqrtReps) * 1.15;
  const yMin = 0, yMax = d3.max(cohs) * 1.15;

  // KDE grid
  const gridRes = 80;
  const gridX = d3.range(gridRes).map(i => xMin + (xMax - xMin) * i / (gridRes - 1));
  const gridY = d3.range(gridRes).map(i => yMin + (yMax - yMin) * i / (gridRes - 1));
  const stdX = d3.deviation(sqrtReps) || 0.01;
  const stdY = d3.deviation(cohs) || 0.01;
  const bw = 0.9 * Math.min(stdX, stdY) * Math.pow(points.length, -0.2);
  const density = gaussianKDE(points, gridX, gridY, bw);
  const maxDensity = d3.max(density);

  // Three.js setup
  const W = container.clientWidth, H = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(W, H);
  renderer.setClearColor(0x0D1117);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 100);
  camera.position.set(1.9, 1.4, 1.9);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.target.set(0.5, 0.2, 0.5);
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
  scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 })));

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
          new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.5 })
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
    ctx.fillStyle = '#8B949E';
    ctx.font = `${Math.round(fontSize * 500)}px Inter, sans-serif`;
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
    const sqrtVal = xMin + (xMax - xMin) * frac;
    scene.add(makeLabel((sqrtVal * sqrtVal).toFixed(3), new THREE.Vector3(frac, -0.04, 1.06)));
  }
  scene.add(makeLabel('Repetitiveness (sqrt)', new THREE.Vector3(0.5, -0.07, 1.14), 0.038));
  for (let i = 0; i <= 4; i++) {
    const frac = i / 4;
    scene.add(makeLabel((yMin + (yMax - yMin) * frac).toFixed(2), new THREE.Vector3(-0.07, -0.04, frac)));
  }
  scene.add(makeLabel('Coherence', new THREE.Vector3(-0.1, -0.07, 0.5), 0.038));
  scene.add(makeLabel('Density', new THREE.Vector3(-0.07, heightScale * 0.5, -0.04), 0.038));

  // Scatter dots
  const dotPositions = [];
  const dotColors = [];
  const dotConditions = [];

  convs.forEach((c, i) => {
    const nx = (sqrtReps[i] - xMin) / (xMax - xMin);
    const nz = (cohs[i] - yMin) / (yMax - yMin);
    const gx = Math.min(gridRes - 1, Math.max(0, Math.round(nx * (gridRes - 1))));
    const gz = Math.min(gridRes - 1, Math.max(0, Math.round(nz * (gridRes - 1))));
    const h = (density[gx * gridRes + gz] / maxDensity) * heightScale + 0.005;
    dotPositions.push(nx, h, nz);
    const col = new THREE.Color(CONDITION_COLOR[c.condition] || '#fff');
    dotColors.push(col.r, col.g, col.b);
    dotConditions.push(c.condition);
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
  const dotMat = new THREE.PointsMaterial({ size: 0.015, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0 });
  const dotMesh = new THREE.Points(dotGeo, dotMat);
  scene.add(dotMesh);

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
      },
      onComplete: () => findHome(),
    });
  };
  // Kick off entrance on next frame — the surface has already rendered.
  requestAnimationFrame(() => setTimeout(startEntrance, 200));

  // ----- Find-home: corner dots fly into their condition cluster centroids -----
  let didFindHome = false;
  function findHome() {
    if (didFindHome) return;
    didFindHome = true;

    const centroid = (condKey) => {
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (let i = 0; i < dotConditions.length; i++) {
        if (dotConditions[i] === condKey) {
          sx += finalPositions[i * 3];
          sy += finalPositions[i * 3 + 1];
          sz += finalPositions[i * 3 + 2];
          n++;
        }
      }
      return n ? new THREE.Vector3(sx / n, sy / n, sz / n) : null;
    };

    const projectToScreen = (v3) => {
      const p = v3.clone().project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        left: rect.left + (p.x * 0.5 + 0.5) * rect.width,
        top:  rect.top  + (1 - (p.y * 0.5 + 0.5)) * rect.height,
      };
    };

    const clusters = {
      red:    { key: 'ai_ai_reverse_turing' },
      yellow: { key: 'human_ai'              },
    };

    Object.entries(clusters).forEach(([slot, info]) => {
      const c3 = centroid(info.key);
      if (!c3) return;
      const screen = projectToScreen(c3);
      const corner = getCornerRect(slot);
      if (!corner) return;

      // Create a flying clone of the corner dot
      const flyer = document.createElement('div');
      flyer.className = `fly-dot fly-dot-${slot}`;
      flyer.style.width  = '16px';
      flyer.style.height = '16px';
      document.body.appendChild(flyer);
      gsap.set(flyer, {
        left: corner.left + corner.width / 2 - 8,
        top:  corner.top  + corner.height / 2 - 8,
        opacity: 0,
        scale: 1,
      });
      // Simultaneously dim the persistent corner dot
      gsap.to(flyer, { opacity: 1, duration: 0.3 });

      // Fly to the cluster centroid on-screen
      gsap.to(flyer, {
        left: screen.left - 8,
        top:  screen.top  - 8,
        scale: 1.3,
        duration: 1.6,
        delay: 0.2,
        ease: 'power2.inOut',
        onComplete: () => {
          // Pulse briefly so the viewer sees the "landing"
          gsap.to(flyer, { scale: 1, duration: 0.4, ease: 'sine.inOut', repeat: 3, yoyo: true });
          // Fade the persistent corner dot — it has landed in the scatter now
          unlight(slot);
          // Fade out the flyer after its pulses
          gsap.to(flyer, {
            opacity: 0,
            duration: 0.6,
            delay: 2.0,
            onComplete: () => { if (flyer.parentNode) flyer.remove(); },
          });
        },
      });
    });
  }

  // Filter chips
  const filtersEl = document.getElementById('explorer-filters');
  createFilterChips(filtersEl, {
    onToggle(active) {
      const colAttr = dotGeo.attributes.color;
      convs.forEach((c, i) => {
        const visible = active.has(c.condition);
        const col = visible ? new THREE.Color(CONDITION_COLOR[c.condition] || '#fff') : new THREE.Color(0x21262D);
        colAttr.setXYZ(i, col.r, col.g, col.b);
      });
      colAttr.needsUpdate = true;
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
    // `convs` come from trajectories.json — enrich with metrics from the CSV row if available.
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
