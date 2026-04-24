import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

export function init() {
  const section = document.getElementById('s-grid');
  if (!section) return;

  const svg = document.getElementById('grid-svg');
  if (!svg) return;

  // ── Layout (matches viewBox 0 0 640 520) ─────────────────────────────────
  const VW = 640, VH = 520;
  const M = { top: 48, right: 48, bottom: 64, left: 64 };
  const W = VW - M.left - M.right;
  const H = VH - M.top  - M.bottom;

  // Neutral axis colours for metric explanation phase
  const COL_X = '#e6edf3';   // off-white → Repetitiveness
  const COL_Y = '#e6edf3';   // off-white → Hedging

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

  makeGlow('gridRedGlow',    '#E74C3C');
  makeGlow('gridYellowGlow', '#F1C40F');
  makeGlow('gridBlueGlow',   '#58A6FF');
  svg.appendChild(defs);

  const root = el('g', { transform: `translate(${M.left},${M.top})` });
  svg.appendChild(root);

  // ── Grid lines — blue like the 3D scatter (one <g> fade = smoother than 22 staggered lines)
  const TICKS = 5;
  const gridLinesG = el('g', { class: 'grid-lines-layer' });
  gsap.set(gridLinesG, { opacity: 0 });
  root.appendChild(gridLinesG);
  for (let i = 0; i <= TICKS; i++) {
    const x = (i / TICKS) * W;
    const y = (i / TICKS) * H;
    const vl = el('line', { x1: x, y1: 0, x2: x, y2: H, stroke: '#1e3a5f', 'stroke-width': 1 });
    const hl = el('line', { x1: 0, y1: y, x2: W, y2: y, stroke: '#1e3a5f', 'stroke-width': 1 });
    gridLinesG.appendChild(vl);
    gridLinesG.appendChild(hl);
  }

  // ── Axes + arrows + labels ────────────────────────────────────────────────
  const xAxis  = el('line', { x1: 0, y1: H, x2: W, y2: H, stroke: COL_X, 'stroke-width': 2.5 });
  const xArrow = el('polygon', { points: `${W},${H - 6} ${W + 12},${H} ${W},${H + 6}`, fill: COL_X });
  const xLabel = el('text', {
    x: W / 2, y: H + 52, 'text-anchor': 'middle', fill: COL_X,
    'font-size': 15, 'font-family': 'Inter, sans-serif',
    'font-weight': 600, 'letter-spacing': '0.05em',
  });
  xLabel.textContent = 'REPETITIVENESS';

  const yAxis  = el('line', { x1: 0, y1: H, x2: 0, y2: 0, stroke: COL_Y, 'stroke-width': 2.5 });
  const yArrow = el('polygon', { points: `-6,0 0,-12 6,0`, fill: COL_Y });
  const yLabel = el('text', {
    x: -H / 2, y: -46, 'text-anchor': 'middle', fill: COL_Y,
    'font-size': 15, 'font-family': 'Inter, sans-serif',
    'font-weight': 600, 'letter-spacing': '0.05em',
    transform: 'rotate(-90)',
  });
  yLabel.textContent = 'HEDGING';

  [xAxis, xArrow, xLabel, yAxis, yArrow, yLabel].forEach(n => {
    gsap.set(n, { opacity: 0 });
    root.appendChild(n);
  });

  // ── Phase-1 dot: AI-AI (red) — high hedging, low repetition ──────────────
  const DOT_X = W * 0.28;
  const DOT_Y = H * 0.22;
  const svgDotRed = el('circle', {
    cx: DOT_X, cy: DOT_Y, r: 9, fill: '#E74C3C', filter: 'url(#gridRedGlow)',
  });
  gsap.set(svgDotRed, { opacity: 0, scale: 0, transformOrigin: `${DOT_X}px ${DOT_Y}px` });
  root.appendChild(svgDotRed);

  // ── Phase-2 dots: AI-Human (yellow) and Human-Human (blue) ───────────────
  const YEL_X = W * 0.42, YEL_Y = H * 0.52;
  const BLU_X = W * 0.15, BLU_Y = H * 0.82;

  const svgDotYellow = el('circle', {
    cx: YEL_X, cy: YEL_Y, r: 9, fill: '#F1C40F', filter: 'url(#gridYellowGlow)',
  });
  gsap.set(svgDotYellow, { opacity: 0, scale: 0, transformOrigin: `${YEL_X}px ${YEL_Y}px` });
  root.appendChild(svgDotYellow);

  const svgDotBlue = el('circle', {
    cx: BLU_X, cy: BLU_Y, r: 9, fill: '#58A6FF', filter: 'url(#gridBlueGlow)',
  });
  gsap.set(svgDotBlue, { opacity: 0, scale: 0, transformOrigin: `${BLU_X}px ${BLU_Y}px` });
  root.appendChild(svgDotBlue);

  // ── Pick up the story-red-dot handed off by quiz.js ────────────────────────
  // If the user scrolled past the quiz without answering, create one HIDDEN
  // at viewport centre — the timeline below will make it visible.
  let flyDot = document.getElementById('story-red-dot');
  if (!flyDot) {
    flyDot = document.createElement('div');
    flyDot.id = 'story-red-dot';
    flyDot.className = 'fly-dot fly-dot-red';
    document.body.appendChild(flyDot);
    gsap.set(flyDot, {
      left: window.innerWidth / 2 - 8,
      top:  window.innerHeight / 2 - 8,
      opacity: 0, scale: 1,
    });
  }

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

  // Always-visible phase-2 tooltips positioned beside each dot.
  const tooltipLayer = document.createElement('div');
  tooltipLayer.className = 'grid-tooltips';
  const tooltipData = [
    { key: 'ai-ai', x: DOT_X, y: DOT_Y, dx: 22,  dy: -86, title: 'AI ↔ AI', body: 'Generated AI-only conversations between models.' },
    { key: 'ai-human', x: YEL_X, y: YEL_Y, dx: 22, dy: -24, title: 'AI ↔ Human', body: 'Conversations between a model and a human participant.' },
    { key: 'human-human', x: BLU_X, y: BLU_Y, dx: 22, dy: -62, title: 'Human ↔ Human', body: 'Real human-to-human conversations from the dataset.' },
  ];
  const tooltips = tooltipData.map((d) => {
    const tip = document.createElement('div');
    tip.className = 'grid-tooltip';
    tip.dataset.type = d.key;
    tip.innerHTML = `<h4>${d.title}</h4><p>${d.body}</p>`;
    tooltipLayer.appendChild(tip);
    return { ...d, node: tip };
  });
  if (canvasWrap) canvasWrap.appendChild(tooltipLayer);

  // Initial hidden states — phase 1
  gsap.set(headbar1, { opacity: 0, y: 10 });
  gsap.set([hedgeCard, repCard],   { opacity: 0, y: 16 });
  gsap.set([hedgeDesc, hedgeEx, repDesc, repEx], { opacity: 0, y: 8 });
  gsap.set([hedgeTitle, repTitle], { opacity: 0, y: 6 });

  // Initial hidden states — phase 2
  gsap.set(headbar2,    { opacity: 0, y: 10 });
  gsap.set(convoLegend, { opacity: 0, display: 'none' });
  if (convoChips.length) gsap.set(convoChips, { opacity: 0, y: 8 });
  gsap.set(tooltips.map((t) => t.node), { opacity: 0, y: 8 });

  /** Hero: oversized chart placed *below the fold* (viewport-based), then one tween brings it into the final slot */
  const HERO_SCALE = 2.48;
  /** Positive px: chart starts mostly below the sticky viewport (“below the fold”), then tweens to y:0 */
  const heroBelowFoldY = () =>
    Math.min(820, Math.round(window.innerHeight * 0.58 + 200));
  const heroMaxPx = () => Math.min(Math.round(window.innerWidth * 0.98), 1180);
  if (gridBody) gsap.set(gridBody, { gridTemplateColumns: '1fr', gap: 12 });
  if (gridSideLeft) gsap.set(gridSideLeft, { autoAlpha: 0 });
  if (gridBottom) gsap.set(gridBottom, { autoAlpha: 0 });
  if (motionWrap) {
    gsap.set(motionWrap, {
      scale: HERO_SCALE,
      y: heroBelowFoldY(),
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

  function positionTooltips() {
    if (!canvasWrap) return;
    const wrapRect = canvasWrap.getBoundingClientRect();
    tooltips.forEach((t) => {
      const p = svgToScreen(t.x, t.y);
      t.node.style.left = `${p.left - wrapRect.left + t.dx}px`;
      t.node.style.top = `${p.top - wrapRect.top + t.dy}px`;
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
      scrub: 1.05,
      onUpdate: () => positionTooltips(),
      onLeaveBack: () => {
        // Fully rewind scene state when user scrolls above this section.
        gsap.killTweensOf(flyDot);
        gsap.set(flyLerp, { u: 0, _sl: NaN, _st: NaN });
        gsap.set(flyDot, { opacity: 0, y: 0, scale: 1 });
        gsap.set(gridLinesG, { opacity: 0 });
        if (headbar1) gsap.set(headbar1, { opacity: 0, y: 10 });
        gsap.set(svgDotRed, { opacity: 0, scale: 0 });
        gsap.set(svgDotYellow, { opacity: 0, scale: 0 });
        gsap.set(svgDotBlue, { opacity: 0, scale: 0 });
        gsap.set(tooltips.map((t) => t.node), { opacity: 0, y: 8 });
        if (gridBody) gsap.set(gridBody, { gridTemplateColumns: '1fr', gap: 12 });
        if (gridSideLeft) gsap.set(gridSideLeft, { autoAlpha: 0 });
        if (gridBottom) gsap.set(gridBottom, { autoAlpha: 0 });
        if (motionWrap) {
          gsap.set(motionWrap, {
            scale: HERO_SCALE,
            y: heroBelowFoldY(),
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
  const motionDur = 0.72;

  if (motionWrap) {
    tl.to(
      motionWrap,
      {
        scale: 1,
        y: 0,
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
        maxWidth: 620,
        duration: motionDur,
        ease: 'power2.inOut',
        onUpdate: positionTooltips,
      },
      motionStart,
    );
  }
  // Land in the same two-column slot the chart uses once explanations appear (not centred 1fr first)
  if (gridBody) {
    tl.to(
      gridBody,
      {
        gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)',
        gap: 28,
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
  tl.to(flyDot, { opacity: 0, duration: 0.12, ease: 'power1.out' }, handoffT);

  // Title only after chart + red dot are in final slot
  const titleT = handoffT + 0.14;
  tl.to(headbar1, { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out' }, titleT);

  // First axis (Y / Hedging) + hedging explainer
  const yBeat = titleT + 0.48;
  tl.to([yAxis, yArrow], { opacity: 1, duration: 0.3, ease: 'power2.out' }, yBeat);
  tl.to(yLabel, { opacity: 1, duration: 0.32, ease: 'power2.out' }, yBeat + 0.1);
  const g0 = yBeat + 0.28;
  if (gridSideLeft) tl.set(gridSideLeft, { autoAlpha: 1 }, g0);
  if (hedgeTitle) tl.to(hedgeTitle, { opacity: 1, y: 0, duration: 0.34 }, g0 + 0.06);
  if (hedgeCard) tl.to(hedgeCard, { opacity: 1, y: 0, duration: 0.4 }, g0 + 0.14);
  if (hedgeDesc) tl.to(hedgeDesc, { opacity: 1, y: 0, duration: 0.34 }, g0 + 0.36);
  if (hedgeEx) tl.to(hedgeEx, { opacity: 1, y: 0, duration: 0.42 }, g0 + 0.56);

  // Second axis (X / Repetitiveness) + repetition explainer
  const rep0 = g0 + 0.95;
  if (gridBottom) tl.set(gridBottom, { autoAlpha: 1 }, rep0 - 0.04);
  tl.to([xAxis, xArrow], { opacity: 1, duration: 0.32, ease: 'power2.out' }, rep0);
  tl.to(xLabel, { opacity: 1, duration: 0.34, ease: 'power2.out' }, rep0 + 0.12);
  if (repTitle) tl.to(repTitle, { opacity: 1, y: 0, duration: 0.32 }, rep0 + 0.18);
  if (repCard) tl.to(repCard, { opacity: 1, y: 0, duration: 0.4 }, rep0 + 0.26);
  if (repDesc) tl.to(repDesc, { opacity: 1, y: 0, duration: 0.34 }, rep0 + 0.48);
  if (repEx) tl.to(repEx, { opacity: 1, y: 0, duration: 0.42 }, rep0 + 0.66);

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
  if (gridBottom) {
    tl.to(gridBottom, { opacity: 0, y: 30, duration: 1.0, ease: 'power2.inOut' }, 5.9);
  }
  if (gridBody) {
    tl.to(gridBody, {
      gridTemplateColumns: '0fr minmax(0, 1fr)',
      gap: 0,
      duration: 1.1,
      ease: 'power2.inOut',
    }, 5.93);
  }
  if (canvasWrap) {
    tl.to(canvasWrap, {
      maxWidth: 860,
      duration: 1.1,
      ease: 'power2.inOut',
      onUpdate: positionTooltips,
    }, 5.97);
  }

  // 6.35 — red type context appears first (dot is already present; tooltip arrives now)
  const redTooltip = tooltips.find((t) => t.key === 'ai-ai')?.node;
  if (redTooltip) {
    tl.to(redTooltip, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 6.35);
  }

  // 7.05 — AI-Human yellow dot appears a bit later
  tl.to(svgDotYellow, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 7.05);
  const yellowTooltip = tooltips.find((t) => t.key === 'ai-human')?.node;
  if (yellowTooltip) {
    tl.to(yellowTooltip, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 7.35);
  }

  // 7.6 — Human-Human blue dot and tooltip follow
  tl.to(svgDotBlue, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 7.6);
  const blueTooltip = tooltips.find((t) => t.key === 'human-human')?.node;
  if (blueTooltip) {
    tl.to(blueTooltip, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 7.9);
  }

  // Keep refs used so lint doesn't strip while preserving future extensibility.
  void gridShell;
}
