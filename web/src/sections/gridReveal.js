import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { openConversation } from '../components/conversationReader.js';
import { CONDITION_COLOR } from '../data/constants.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function init() {
  const section = document.getElementById('s-grid');
  if (!section) return;

  const svg = document.getElementById('grid-svg');
  if (!svg) return;

  // Tuning knobs for the red-dot handoff feel:
  // - lower scrub => more immediate reaction to scroll
  // - higher duration => slower travel along the path
  const HANDOFF_SCRUB = 0.6;
  const DOT_TRAVEL_DURATION = 0.55;
  const PHASE_TWO_BLOCK_OFFSET_Y = 28;
  const PHASE_TWO_PLOT_GAP_Y = 26;
  // Layout knobs to keep JS timeline and CSS sizing in sync
  const FINAL_CHART_MAX = 550;
  const PHASE_ONE_GRID_COLUMNS = 'minmax(220px, 280px) minmax(500px, 550px) minmax(220px, 280px)';

  // ── Layout (matches viewBox 0 0 640 520) ─────────────────────────────────
  const VW = 640, VH = 520;
  const M = { top: 48, right: 48, bottom: 64, left: 64 };
  const W = VW - M.left - M.right;
  const H = VH - M.top  - M.bottom;
  const X_AXIS_MAX = 0.12;
  const repToX = (v) => (v / X_AXIS_MAX) * W;
  const hedgeToY = (v) => (1 - v) * H;

  // Neutral axis colours for metric explanation phase
  const COL_X = '#3A332A';   // off-white → Repetitiveness
  const COL_Y = '#3A332A';   // off-white → Hedging

  // ── Defs: glow filters for each dot colour ────────────────────────────────
  const defs = el('defs');

  function makeGlow(id, color) {
    const filt = el('filter', { id, x: '-60%', y: '-60%', width: '220%', height: '220%' });
    const blur  = el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '5', result: 'blur' });
    const flood = el('feFlood', { 'flood-color': color, 'flood-opacity': '0.7', result: 'color' });
    const comp  = el('feComposite', { in: 'color', in2: 'blur', operator: 'in', result: 'glow' });
    const merge = el('feMerge');
    merge.appendChild(el('feMergeNode', { in: 'glow' }));
    merge.appendChild(el('feMergeNode', { in: 'SourceGraphic' }));
    filt.appendChild(blur);
    filt.appendChild(flood);
    filt.appendChild(comp);
    filt.appendChild(merge);
    defs.appendChild(filt);
  }

  makeGlow('gridRedGlow',       '#B43A2A');
  makeGlow('gridYellowGlow',   CONDITION_COLOR.human_ai);
  makeGlow('gridBlueGlow',     CONDITION_COLOR.human_human);
  svg.appendChild(defs);

  const root = el('g', { transform: `translate(${M.left},${M.top})` });
  svg.appendChild(root);

  // Square grid cells: ticksX/ticksY chosen so W/ticksX ≈ H/ticksY
  // W=528, H=408 → 13×10 gives 40.6×40.8 ≈ square
  const TICKS_X = 13;
  const TICKS_Y = 10;
  const gridLinesG = el('g', { class: 'grid-lines-layer' });
  gsap.set(gridLinesG, { opacity: 0 });
  root.appendChild(gridLinesG);
  for (let i = 0; i <= TICKS_X; i++) {
    const x = (i / TICKS_X) * W;
    gridLinesG.appendChild(el('line', { x1: x, y1: 0, x2: x, y2: H, stroke: '#D9D0BD', 'stroke-width': 0.8 }));
  }
  for (let i = 0; i <= TICKS_Y; i++) {
    const y = (i / TICKS_Y) * H;
    gridLinesG.appendChild(el('line', { x1: 0, y1: y, x2: W, y2: y, stroke: '#D9D0BD', 'stroke-width': 0.8 }));
  }

  // ── Axes + arrows + labels ────────────────────────────────────────────────
  const xAxis  = el('line', { x1: 0, y1: H, x2: W, y2: H, stroke: '#9A8F7C', 'stroke-width': 1.2 });
  const xArrow = el('polygon', { points: `${W},${H - 6} ${W + 12},${H} ${W},${H + 6}`, fill: '#9A8F7C' });
  const xLabel = el('text', {
    x: W / 2, y: H + 52, 'text-anchor': 'middle', fill: '#6E6557',
    'font-size': 11, 'font-family': 'Inter Tight, sans-serif',
    'font-weight': 600, 'letter-spacing': '0.1em',
  });
  xLabel.textContent = 'REPETITIVENESS';

  const yAxis  = el('line', { x1: 0, y1: H, x2: 0, y2: 0, stroke: '#9A8F7C', 'stroke-width': 1.2 });
  const yArrow = el('polygon', { points: `-6,0 0,-12 6,0`, fill: '#9A8F7C' });
  const yLabel = el('text', {
    x: -H / 2, y: -46, 'text-anchor': 'middle', fill: '#6E6557',
    'font-size': 11, 'font-family': 'Inter Tight, sans-serif',
    'font-weight': 600, 'letter-spacing': '0.1em',
    transform: 'rotate(-90)',
  });
  yLabel.textContent = 'HEDGING';

  // ── Axis tick marks + number labels ──────────────────────────────────────
  const xTicksG = el('g', { class: 'axis-ticks-x' });
  const yTicksG = el('g', { class: 'axis-ticks-y' });
  const X_TICK_VALS = [0, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12];
  const X_TICK_LABELS = ['0', '0.02', '0.04', '0.06', '0.08', '0.10', '0.12'];
  const Y_TICK_VALS = [0, 0.25, 0.5, 0.75, 1.0];
  const Y_TICK_LABELS = ['0', '.25', '.50', '.75', '1'];
  X_TICK_VALS.forEach((v, i) => {
    const x = repToX(v);
    xTicksG.appendChild(el('line', { x1: x, y1: H, x2: x, y2: H + 5, stroke: '#9A8F7C', 'stroke-width': 1 }));
    const lbl = el('text', {
      x, y: H + 18, 'text-anchor': 'middle', fill: '#6E6557',
      'font-size': 9, 'font-family': 'Inter Tight, sans-serif', 'font-weight': 500,
    });
    lbl.textContent = X_TICK_LABELS[i];
    xTicksG.appendChild(lbl);
  });
  Y_TICK_VALS.forEach((v, i) => {
    const y = H - v * H;
    yTicksG.appendChild(el('line', { x1: -5, y1: y, x2: 0, y2: y, stroke: '#9A8F7C', 'stroke-width': 1 }));
    const lbl = el('text', {
      x: -10, y: y + 3.5, 'text-anchor': 'end', fill: '#6E6557',
      'font-size': 9, 'font-family': 'Inter Tight, sans-serif', 'font-weight': 500,
    });
    lbl.textContent = Y_TICK_LABELS[i];
    yTicksG.appendChild(lbl);
  });

  [xAxis, xArrow, xLabel, xTicksG, yAxis, yArrow, yLabel, yTicksG].forEach(n => {
    gsap.set(n, { opacity: 0 });
    root.appendChild(n);
  });

  // ── Phase-1 dot: AI-AI (red) — high hedging, low repetition ──────────────
  // Keep red AI-AI point close to the upper-left chart corner (high hedging, low repetition)
  const DOT_X = W * 0.14;
  const DOT_Y = H * 0.14;
  const svgDotRed = el('circle', {
    cx: DOT_X, cy: DOT_Y, r: 8.5, fill: '#B43A2A',
    class: 'subtype-grid-dot',
  });
  svgDotRed.style.setProperty('--dot-color', '#B43A2A');
  gsap.set(svgDotRed, { opacity: 0, scale: 0, transformOrigin: `${DOT_X}px ${DOT_Y}px` });
  root.appendChild(svgDotRed);

  // ── Phase-2 dots: AI-Human (yellow) and Human-Human (blue) ───────────────
  const YEL_X = W * 0.42, YEL_Y = H * 0.52;
  const BLU_X = W * 0.16, BLU_Y = H * 0.84;
  const PHASE_TWO_TARGETS = {
    blue: { x: repToX(0.003), y: hedgeToY(0.515) },   // Human-Human
    yellow: { x: repToX(0.092), y: hedgeToY(0.155) }, // Human-AI
    red: { x: repToX(0.012), y: hedgeToY(0.782) },    // AI-AI
  };

  const svgDotYellow = el('circle', {
    cx: YEL_X, cy: YEL_Y, r: 9, fill: CONDITION_COLOR.human_ai,
    class: 'subtype-grid-dot',
  });
  svgDotYellow.style.setProperty('--dot-color', CONDITION_COLOR.human_ai);
  gsap.set(svgDotYellow, { opacity: 0, scale: 0, transformOrigin: `${YEL_X}px ${YEL_Y}px` });
  root.appendChild(svgDotYellow);

  const svgDotBlue = el('circle', {
    cx: BLU_X, cy: BLU_Y, r: 9, fill: CONDITION_COLOR.human_human,
    class: 'subtype-grid-dot',
  });
  svgDotBlue.style.setProperty('--dot-color', CONDITION_COLOR.human_human);
  gsap.set(svgDotBlue, { opacity: 0, scale: 0, transformOrigin: `${BLU_X}px ${BLU_Y}px` });
  root.appendChild(svgDotBlue);

  // ── Dummy conversation data for each dot ──────────────────────────────────
  const DOT_CONVOS = {
    red: {
      id: 'conv_ai_ai_freeform_claudesonnet4_gemini25flash_F1_1775427182',
      condition: 'ai_ai_freeform',
      model_a: 'claude-sonnet-4', model_b: 'gemini-2.5-flash', coherence: 1.0246,
      hedging: 0.782, repetitiveness: 0.012,
      type: 'AI ↔ AI',
      desc: 'Generated AI-only conversations between models.',
      snippet: "Hey! I'm doing pretty good, thanks for asking. Just enjoying the day. How about you? What's new?",
    },
    yellow: {
      id: 'conv_human_ai_wildchat_0116',
      condition: 'human_ai',
      model_a: 'human', model_b: 'gpt-4-0314', coherence: 0.2714,
      hedging: 0.155, repetitiveness: 0.092,
      type: 'AI ↔ Human',
      desc: 'Conversations between a model and a human participant.',
      snippet: 'what is the impact to third parties which are neither buyers of the output nor suppliers of inputs of a clothing business that offers locally woven textiles?',
    },
    blue: {
      id: 'conv_human_human_personachat_0073',
      condition: 'human_human',
      model_a: 'human', model_b: 'human', coherence: 1.2195,
      hedging: 0.515, repetitiveness: 0.003,
      type: 'Human ↔ Human',
      desc: 'Real human-to-human conversations from the dataset.',
      snippet: 'on occasion i like to drive quickly',
    },
  };

  // ── Interactive tooltip event handlers ────────────────────────────────────
  [[svgDotRed, DOT_CONVOS.red], [svgDotYellow, DOT_CONVOS.yellow], [svgDotBlue, DOT_CONVOS.blue]].forEach(([dot, data]) => {
    dot.addEventListener('mouseenter', (e) => {
      dot.classList.add('is-hovered');
      showInteractiveTip(data, e);
    });
    dot.addEventListener('mousemove', (e) => moveInteractiveTip(e));
    dot.addEventListener('mouseleave', () => {
      dot.classList.remove('is-hovered');
      hideInteractiveTip();
    });
    dot.addEventListener('click', () => {
      openConversation(data.id, {
        condition: data.condition,
        model_a: data.model_a,
        model_b: data.model_b,
        hedging: data.hedging,
        repetitiveness: data.repetitiveness,
        coherence: data.coherence,
      });
    });
  });

  // ── Spawn the red story-dot at viewport centre ────────────────────────────
  // The quiz used to hand this off; now the dot belongs entirely to this section.
  // Created hidden — the timeline below fades it in and flies it to the chart corner.
  let flyDot = document.getElementById('story-red-dot');
  if (!flyDot) {
    flyDot = document.createElement('div');
    flyDot.id = 'story-red-dot';
    flyDot.className = 'fly-dot fly-dot-red';
    document.body.appendChild(flyDot);
  }
  gsap.set(flyDot, {
    left: window.innerWidth / 2 - 8,
    top:  window.innerHeight / 2 - 8,
    opacity: 0, scale: 1,
  });

  // Helper: SVG viewBox coords → screen coords for the DOM fly-dot (guarded: bad rects → no jump to 0,0)
  const lastGoodScreen = { left: window.innerWidth / 2 - 8, top: window.innerHeight / 2 - 8 };
  const svgToScreen = (vx, vy) => {
    const r = svg.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || !Number.isFinite(r.left)) {
      return { ...lastGoodScreen };
    }
    const sx = r.width / VW;
    const sy = r.height / VH;
    const out = {
      left: r.left + (M.left + vx) * sx - 8,
      top: r.top + (M.top + vy) * sy - 8,
    };
    if (Number.isFinite(out.left) && Number.isFinite(out.top)) {
      lastGoodScreen.left = out.left;
      lastGoodScreen.top = out.top;
    }
    return out;
  };

  // ── DOM refs — phase 1 ────────────────────────────────────────────────────
  const headbar1  = document.getElementById('grid-headbar-1');
  const headbar2  = document.getElementById('grid-headbar-2');
  const gridShell = section.querySelector('.grid-shell');
  const gridBody = section.querySelector('.grid-body');
  const gridSideLeft = section.querySelector('.grid-side-left');
  const gridSideRight = section.querySelector('.grid-side-right');
  const gridBottom = section.querySelector('.grid-bottom');
  const canvasWrap = section.querySelector('.grid-canvas-wrap');
  const motionWrap = document.getElementById('grid-motion-wrap');
  const hedgeCard = document.getElementById('mdef-hedging');
  const repCard   = document.getElementById('mdef-repetition');

  const hedgeTitle = hedgeCard?.querySelector('.mdef-title');
  const hedgeDesc  = hedgeCard?.querySelector('.mdef-desc');
  const hedgeEx    = hedgeCard?.querySelector('.mdef-examples');
  const repTitle   = repCard?.querySelector('.mdef-title');
  const repDesc    = repCard?.querySelector('.mdef-desc');
  const repEx      = repCard?.querySelector('.mdef-examples');

  // Phase-2 legend
  const convoLegend = document.querySelector('.convo-legend');
  const convoChips  = document.querySelectorAll('.convo-chip');

  // SVG labels: show just the type name beside each dot; hover reveals description + snippet.
  const labelsG = el('g', { class: 'dot-labels' });
  root.appendChild(labelsG);
  const LABEL_DEFS = [
    { cx: DOT_X, cy: DOT_Y,  text: 'AI ↔ AI',         key: 'red'    },
    { cx: YEL_X, cy: YEL_Y,  text: 'AI ↔ Human',      key: 'yellow' },
    { cx: BLU_X, cy: BLU_Y,  text: 'Human ↔ Human',   key: 'blue'   },
  ];
  const labelEls = LABEL_DEFS.map(({ cx, cy, text }) => {
    const lbl = el('text', {
      x: cx + 15, y: cy + 4,
      'text-anchor': 'start', fill: '#3A332A',
      'font-family': 'JetBrains Mono, monospace',
      'font-size': 11, 'font-weight': 500,
    });
    lbl.textContent = text;
    labelsG.appendChild(lbl);
    return lbl;
  });
  const [redLabel, yellowLabel, blueLabel] = labelEls;
  gsap.set(labelEls, { opacity: 0 });
  function syncLabelPositions() {
    const redX = Number(svgDotRed.getAttribute('cx'));
    const redY = Number(svgDotRed.getAttribute('cy'));
    const yelX = Number(svgDotYellow.getAttribute('cx'));
    const yelY = Number(svgDotYellow.getAttribute('cy'));
    const bluX = Number(svgDotBlue.getAttribute('cx'));
    const bluY = Number(svgDotBlue.getAttribute('cy'));
    redLabel.setAttribute('x', redX + 15);
    redLabel.setAttribute('y', redY + 4);
    yellowLabel.setAttribute('x', yelX + 15);
    yellowLabel.setAttribute('y', yelY + 4);
    blueLabel.setAttribute('x', bluX + 15);
    blueLabel.setAttribute('y', bluY + 4);
  }
  syncLabelPositions();

  const interactiveTip = document.createElement('article');
  interactiveTip.className = 'grid-interactive-tooltip';
  if (canvasWrap) canvasWrap.appendChild(interactiveTip);

  function moveInteractiveTip(e) {
    if (!canvasWrap) return;
    const rect = canvasWrap.getBoundingClientRect();
    const left = e.clientX - rect.left + 18;
    const top = e.clientY - rect.top - 12;
    interactiveTip.style.left = `${left}px`;
    interactiveTip.style.top = `${top}px`;
  }

  function showInteractiveTip(point, e) {
    const scoreRows = `
      <p class="grid-tip-scores">Repetitiveness: <strong>${point.repetitiveness.toFixed(3)}</strong></p>
      <p class="grid-tip-scores">Hedging: <strong>${point.hedging.toFixed(3)}</strong></p>
      `;
    interactiveTip.innerHTML = `
      <h4>${point.type}</h4>
      <p class="grid-tip-prompt">${point.desc}</p>
      ${scoreRows}
      <p class="grid-tip-snippet">${point.snippet}</p>
    `;
    moveInteractiveTip(e);
    interactiveTip.style.opacity = '1';
  }

  function hideInteractiveTip() {
    interactiveTip.style.opacity = '0';
  }

  // positionTooltips kept as no-op (SVG labels are self-positioned; called by scroll/resize handlers)
  function positionTooltips() {}



  // Initial hidden states — phase 1
  gsap.set(headbar1, { opacity: 0, y: 10 });
  gsap.set([hedgeCard, repCard],   { opacity: 0, y: 16 });
  gsap.set([hedgeDesc, hedgeEx, repDesc, repEx], { opacity: 0, y: 8 });
  gsap.set([hedgeTitle, repTitle], { opacity: 0, y: 6 });

  // Initial hidden states — phase 2
  gsap.set(headbar2,    { opacity: 0, y: 10 });
  gsap.set(convoLegend, { opacity: 0, display: 'none' });
  if (convoChips.length) gsap.set(convoChips, { opacity: 0, y: 8 });

  /** Hero: oversized chart placed *below the fold* (viewport-based), then one tween brings it into the final slot */
  const HERO_SCALE = 2.48;
  /** Positive px: chart starts mostly below the sticky viewport (“below the fold”), then tweens to y:0 */
  const heroBelowFoldY = () =>
    Math.min(820, Math.round(window.innerHeight * 0.58 + 200));
  const heroMaxPx = () => Math.min(Math.round(window.innerWidth * 0.98), 1180);
  if (gridBody) gsap.set(gridBody, { gridTemplateColumns: '1fr', gap: 12 });
  if (gridSideLeft) gsap.set(gridSideLeft, { autoAlpha: 0 });
  if (gridSideRight) gsap.set(gridSideRight, { autoAlpha: 0 });
  if (gridBottom) gsap.set(gridBottom, { autoAlpha: 0 });
  if (motionWrap) {
    gsap.set(motionWrap, {
      scale: HERO_SCALE,
      y: heroBelowFoldY(),
      opacity: 0,
      // Scale from bottom edge so the “big grid” reads as living below centre / below fold
      transformOrigin: '50% 100%',
    });
  }
  if (canvasWrap) {
    gsap.set(canvasWrap, {
      maxWidth: heroMaxPx(),
      scale: 1,
      transformOrigin: '50% 50%',
    });
  }

  positionTooltips();
  window.addEventListener('resize', positionTooltips);

  // Scrub-safe fly-dot: lerp quiz → live plot (u 0→1); anchor captured once at start of motion block.
  const flyLerp = { u: 0, _sl: NaN, _st: NaN };

  // ── Scrubbed master timeline ──────────────────────────────────────────────
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#s-grid',
      start: 'top top',
      end:   'bottom bottom',
      // Smooth scrub: playhead eases toward scroll over ~1s so fast flicks stay readable
      scrub: HANDOFF_SCRUB,
      onUpdate: () => positionTooltips(),
      onLeaveBack: () => {
        // Fully rewind scene state when user scrolls above this section.
        gsap.killTweensOf(flyDot);
        gsap.set(flyLerp, { u: 0, _sl: NaN, _st: NaN });
        gsap.set(flyDot, { opacity: 0, y: 0, scale: 1 });
        gsap.set(gridLinesG, { opacity: 0 });
        gsap.set([xTicksG, yTicksG], { opacity: 0 });
        if (headbar1) gsap.set(headbar1, { opacity: 0, y: 10 });
        if (headbar2) gsap.set(headbar2, { opacity: 0, y: 10, clearProps: 'height,paddingTop,paddingBottom,overflow' });
        gsap.set(svgDotRed, { opacity: 0, scale: 0 });
        gsap.set(svgDotYellow, { opacity: 0, scale: 0 });
        gsap.set(svgDotBlue, { opacity: 0, scale: 0 });
        svgDotRed.setAttribute('cx', DOT_X);
        svgDotRed.setAttribute('cy', DOT_Y);
        svgDotYellow.setAttribute('cx', YEL_X);
        svgDotYellow.setAttribute('cy', YEL_Y);
        svgDotBlue.setAttribute('cx', BLU_X);
        svgDotBlue.setAttribute('cy', BLU_Y);
        syncLabelPositions();
        hideInteractiveTip();
        gsap.set(labelEls, { opacity: 0 });
        if (gridBody) gsap.set(gridBody, { gridTemplateColumns: '1fr', gap: 12, marginTop: 0 });
        if (gridSideLeft) gsap.set(gridSideLeft, { autoAlpha: 0 });
        if (gridSideRight) gsap.set(gridSideRight, { autoAlpha: 0 });
        if (gridBottom) gsap.set(gridBottom, { autoAlpha: 0 });
        if (motionWrap) {
          gsap.set(motionWrap, {
            scale: HERO_SCALE,
            y: heroBelowFoldY(),
            opacity: 0,
            transformOrigin: '50% 100%',
          });
        }
        if (canvasWrap) {
          gsap.set(canvasWrap, {
            maxWidth: heroMaxPx(),
            scale: 1,
            transformOrigin: '50% 50%',
          });
        }
        if (gridShell) gsap.set(gridShell, { y: 0 });
        positionTooltips();
      },
    },
  });

  // ── PHASE 1: blue grid + red dot → final slot (direct, no mid-stop) → title → Y + hedging → X + repetition ─

  function captureFlyAnchor() {
    const b = flyDot.getBoundingClientRect();
    flyLerp._sl = b.left;
    flyLerp._st = b.top;
  }
  function updateFlyDotAlongChart(u) {
    if (!Number.isFinite(flyLerp._sl) || !Number.isFinite(flyLerp._st)) captureFlyAnchor();
    const end = svgToScreen(DOT_X, DOT_Y);
    gsap.set(flyDot, {
      left: flyLerp._sl + (end.left - flyLerp._sl) * u,
      top: flyLerp._st + (end.top - flyLerp._st) * u,
    });
    positionTooltips();
  }

  tl.set(flyLerp, { u: 0 }, 0);

  // 0 — red dot ready (survey handoff); do not move left/top until motion block
  tl.to(flyDot, { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: 'power1.out' }, 0);

  // 0 — show full blue grid on the hero chart (same beat as motion start: you see the big off-screen grid, then it goes to slot)
  tl.set(gridLinesG, { opacity: 1 }, 0);

  const motionStart = 0;
  const motionDur = DOT_TRAVEL_DURATION;

  if (motionWrap) {
    tl.to(
      motionWrap,
      {
        scale: 1,
        y: 0,
        opacity: 1,
        duration: motionDur,
        ease: 'power2.inOut',
        onUpdate: positionTooltips,
      },
      motionStart,
    );
  }
  if (canvasWrap) {
    tl.to(
      canvasWrap,
      {
        maxWidth: FINAL_CHART_MAX,
        duration: motionDur,
        ease: 'power2.inOut',
        onUpdate: positionTooltips,
      },
      motionStart,
    );
  }
  // Land in the same three-column slot used in the metric explanation phase.
  if (gridBody) {
    tl.to(
      gridBody,
      {
        gridTemplateColumns: PHASE_ONE_GRID_COLUMNS,
        gap: 24,
        duration: motionDur,
        ease: 'power2.inOut',
        onUpdate: positionTooltips,
      },
      motionStart,
    );
  }
  tl.to(
    flyLerp,
    {
      u: 1,
      duration: motionDur,
      ease: 'power2.inOut',
      onStart: captureFlyAnchor,
      onUpdate() {
        updateFlyDotAlongChart(flyLerp.u);
      },
    },
    motionStart,
  );

  const handoffT = motionStart + motionDur;
  tl.set(svgDotRed, { opacity: 1, scale: 1 }, handoffT);
  // Keep the moving dot visible through handoff to avoid any perceived disappear/reappear.
  tl.set(flyDot, {
    left: () => svgToScreen(DOT_X, DOT_Y).left,
    top: () => svgToScreen(DOT_X, DOT_Y).top,
    opacity: 1,
    scale: 1,
    y: 0,
  }, handoffT);
  // Hide the handoff DOM dot once the SVG dot owns the point.
  tl.to(flyDot, { opacity: 0, duration: 0.12, ease: 'power1.out' }, handoffT + 0.03);

  // Title only after chart + red dot are in final slot
  const titleT = handoffT + 0.14;
  tl.to(headbar1, { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out' }, titleT);
  // Show red label beside the AI↔AI dot during metric explanation phase too
  tl.to(redLabel, { opacity: 1, duration: 0.4, ease: 'power2.out' }, titleT + 0.22);

  // First axis (Y / Hedging) + hedging explainer
  const hedge0 = titleT + 0.48;
  tl.to([yAxis, yArrow], { opacity: 1, duration: 0.3, ease: 'power2.out' }, hedge0);
  tl.to([yLabel, yTicksG], { opacity: 1, duration: 0.32, ease: 'power2.out' }, hedge0 + 0.1);
  const g0 = hedge0 + 0.28;
  if (gridSideLeft) tl.set(gridSideLeft, { autoAlpha: 1 }, g0);
  if (hedgeTitle) tl.to(hedgeTitle, { opacity: 1, y: 0, duration: 0.34 }, g0 + 0.06);
  if (hedgeCard) tl.to(hedgeCard, { opacity: 1, y: 0, duration: 0.4 }, g0 + 0.14);
  if (hedgeDesc) tl.to(hedgeDesc, { opacity: 1, y: 0, duration: 0.34 }, g0 + 0.36);
  if (hedgeEx) tl.to(hedgeEx, { opacity: 1, y: 0, duration: 0.42 }, g0 + 0.56);

  // Second axis (X / Repetitiveness) + repetition explainer
  const repBeat = hedge0 + 0.95;
  if (gridBottom) tl.set(gridBottom, { autoAlpha: 1 }, repBeat - 0.04);
  tl.to([xAxis, xArrow], { opacity: 1, duration: 0.32, ease: 'power2.out' }, repBeat);
  tl.to([xLabel, xTicksG], { opacity: 1, duration: 0.34, ease: 'power2.out' }, repBeat + 0.12);
  if (repTitle) tl.to(repTitle, { opacity: 1, y: 0, duration: 0.32 }, repBeat + 0.18);
  if (repCard) tl.to(repCard, { opacity: 1, y: 0, duration: 0.4 }, repBeat + 0.26);
  if (repDesc) tl.to(repDesc, { opacity: 1, y: 0, duration: 0.34 }, repBeat + 0.48);
  if (repEx) tl.to(repEx, { opacity: 1, y: 0, duration: 0.42 }, repBeat + 0.66);

  // ── PHASE 2: three conversation types ────────────────────────────────────

  // 5.85 — title fades away before phase-2 map presentation
  tl.to(headbar1, { opacity: 0, y: -8, duration: 0.5 }, 5.85);

  // 5.85 — metric cards slide out
  tl.to([hedgeCard, repCard], { opacity: 0, y: 10, duration: 0.5 }, 5.85);

  // 5.9+ — smooth continuous morph into the "types" map:
  // fade/slide cards out while the grid recenters and expands.
  if (gridSideLeft) {
    tl.to(gridSideLeft, { opacity: 0, x: -40, duration: 1.0, ease: 'power2.inOut' }, 5.9);
  }
  if (gridSideRight) {
    tl.to(gridSideRight, { opacity: 0, x: 40, duration: 1.0, ease: 'power2.inOut' }, 5.9);
  }
  if (gridBottom) {
    tl.to(gridBottom, { opacity: 0, y: 30, duration: 1.0, ease: 'power2.inOut' }, 5.9);
  }
  if (gridBody) {
    tl.to(gridBody, {
      gridTemplateColumns: '0fr minmax(0, 1fr) 0fr',
      gap: 0,
      marginTop: PHASE_TWO_PLOT_GAP_Y,
      duration: 1.1,
      ease: 'power2.inOut',
    }, 5.93);
  }
  if (canvasWrap) {
    tl.to(canvasWrap, {
      maxWidth: FINAL_CHART_MAX,
      duration: 1.1,
      ease: 'power2.inOut',
      onUpdate: positionTooltips,
    }, 5.97);
  }
  if (gridShell) {
    tl.to(gridShell, {
      y: PHASE_TWO_BLOCK_OFFSET_Y,
      duration: 1.1,
      ease: 'power2.inOut',
      onUpdate: positionTooltips,
    }, 5.93);
  }

  // Show phase-2 heading centered above the three-type plot.
  tl.to(headbar2, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 6.12);

  // Place all three dots directly at their final coordinates for this phase.
  tl.set(svgDotRed, { attr: { cx: PHASE_TWO_TARGETS.red.x, cy: PHASE_TWO_TARGETS.red.y } }, 6.3);
  tl.set(svgDotYellow, { attr: { cx: PHASE_TWO_TARGETS.yellow.x, cy: PHASE_TWO_TARGETS.yellow.y } }, 6.3);
  tl.set(svgDotBlue, { attr: { cx: PHASE_TWO_TARGETS.blue.x, cy: PHASE_TWO_TARGETS.blue.y } }, 6.3);
  tl.call(syncLabelPositions, null, 6.3);
  tl.to([svgDotRed, svgDotYellow, svgDotBlue], { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 6.6);
  tl.to([redLabel, yellowLabel, blueLabel], { opacity: 1, duration: 0.4, ease: 'power2.out' }, 6.9);

  // Keep refs used so lint doesn't strip while preserving future extensibility.
  void gridShell;
}