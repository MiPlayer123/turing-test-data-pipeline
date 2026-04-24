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

  // Axis colours — NOT in the dot series (red/yellow/blue/purple/orange/green)
  const COL_X = '#22D3EE';   // cyan  → Repetitiveness
  const COL_Y = '#F472B6';   // pink  → Hedging

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

  // ── Grid lines — blue like the 3D scatter ─────────────────────────────────
  const TICKS = 5;
  const gridEls = [];
  for (let i = 0; i <= TICKS; i++) {
    const x = (i / TICKS) * W;
    const y = (i / TICKS) * H;
    const vl = el('line', { x1: x, y1: 0, x2: x, y2: H, stroke: '#1e3a5f', 'stroke-width': 1 });
    const hl = el('line', { x1: 0, y1: y, x2: W, y2: y, stroke: '#1e3a5f', 'stroke-width': 1 });
    gsap.set([vl, hl], { opacity: 0 });
    root.appendChild(vl);
    root.appendChild(hl);
    gridEls.push(vl, hl);
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

  // Helper: SVG viewBox coords → screen coords for the DOM fly-dot
  const svgToScreen = (vx, vy) => {
    const r = svg.getBoundingClientRect();
    const sx = r.width  / VW;
    const sy = r.height / VH;
    return {
      left: r.left + (M.left + vx) * sx - 8,
      top:  r.top  + (M.top  + vy) * sy - 8,
    };
  };

  // ── DOM refs — phase 1 ────────────────────────────────────────────────────
  const headbar1  = document.getElementById('grid-headbar-1');
  const headbar2  = document.getElementById('grid-headbar-2');
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

  // Initial hidden states — phase 1
  gsap.set(headbar1, { opacity: 0, y: 10 });
  gsap.set([hedgeCard, repCard],   { opacity: 0, y: 16 });
  gsap.set([hedgeDesc, hedgeEx, repDesc, repEx], { opacity: 0, y: 8 });
  gsap.set([hedgeTitle, repTitle], { opacity: 0, y: 6 });

  // Initial hidden states — phase 2
  gsap.set(headbar2,    { opacity: 0, y: 10 });
  gsap.set(convoLegend, { opacity: 0 });
  if (convoChips.length) gsap.set(convoChips, { opacity: 0, y: 8 });

  // ── Scrubbed master timeline ──────────────────────────────────────────────
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#s-grid',
      start: 'top top',
      end:   'bottom bottom',
      scrub: true,
    },
  });

  // ── PHASE 1: dot lands → grid draws → axes reveal → metric cards ─────────

  // 0 — ensure dot visible (handles skipped-quiz path)
  tl.set(flyDot, { opacity: 1 }, 0);

  // 0→3 — fly-dot arcs from chat centre onto the grid
  tl.to(flyDot, {
    left: () => svgToScreen(DOT_X, DOT_Y).left,
    top:  () => svgToScreen(DOT_X, DOT_Y).top,
    duration: 3,
    ease: 'power2.inOut',
  }, 0);

  // 3 — SVG dot materialises, fly-dot disappears
  tl.to(svgDotRed, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.4)' }, 3);
  tl.to(flyDot,    { opacity: 0, duration: 0.4 }, 3.2);

  // 3.5 — grid lines draw in
  tl.to(gridEls, { opacity: 1, duration: 0.8, stagger: 0.03, ease: 'power1.out' }, 3.5);

  // 4 — X axis + label (cyan, Repetitiveness)
  tl.to([xAxis, xArrow], { opacity: 1, duration: 0.5 }, 4);
  tl.to(xLabel,          { opacity: 1, duration: 0.6 }, 4.4);
  if (repTitle) tl.to(repTitle, { opacity: 1, y: 0, duration: 0.5 }, 4.5);

  // 5 — Y axis + label (pink, Hedging)
  tl.to([yAxis, yArrow], { opacity: 1, duration: 0.5 }, 5);
  tl.to(yLabel,          { opacity: 1, duration: 0.6 }, 5.4);
  if (hedgeTitle) tl.to(hedgeTitle, { opacity: 1, y: 0, duration: 0.5 }, 5.5);

  // 6 — phase-1 headline
  tl.to(headbar1, { opacity: 1, y: 0, duration: 0.8 }, 6);

  // 7 — metric card shells
  tl.to([hedgeCard, repCard], { opacity: 1, y: 0, duration: 0.6, stagger: 0.15 }, 7);

  // 8 — descriptions
  tl.to([hedgeDesc, repDesc], { opacity: 1, y: 0, duration: 0.6, stagger: 0.15 }, 8);

  // 9 — examples
  tl.to([hedgeEx, repEx], { opacity: 1, y: 0, duration: 0.7, stagger: 0.15 }, 9);

  // ── PHASE 2: three conversation types ────────────────────────────────────

  // 10.5 — headline cross-fade: phase-1 out, phase-2 in
  tl.to(headbar1, { opacity: 0, y: -8, duration: 0.5 }, 10.5);
  tl.to(headbar2, { opacity: 1, y: 0,  duration: 0.6 }, 10.8);

  // 10.5 — metric cards slide out
  tl.to([hedgeCard, repCard], { opacity: 0, y: 10, duration: 0.5 }, 10.5);

  // 11 — AI-Human yellow dot blops in
  tl.to(svgDotYellow, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 11);

  // 11.6 — Human-Human blue dot blops in
  tl.to(svgDotBlue, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 11.6);

  // 12 — legend appears, chips stagger in
  tl.to(convoLegend, { opacity: 1, duration: 0.4 }, 12);
  if (convoChips.length) {
    tl.to(convoChips, { opacity: 1, y: 0, duration: 0.5, stagger: 0.2, ease: 'power2.out' }, 12.2);
  }
}
