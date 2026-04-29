import * as d3 from 'd3';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { light as lightCornerDot, getCornerRect } from '../lib/cornerDots.js';
import { openConversation } from '../components/conversationReader.js';
import { setSubtypePlotPayload } from '../lib/subtypePlotStore.js';

// Map each AI-AI condition to its corner-dot slot id
const CORNER_SLOT = {
  ai_ai_freeform:         'freeform',
  ai_ai_freeform_persona: 'persona',
  ai_ai_detective:        'detective',
  ai_ai_reverse_turing:   'revturing',
  ai_ai_structured:       'structured',
};

const SUBTYPES = [
  {
    key: 'ai_ai_freeform',
    name: 'Freeform',
    color: '#3498DB',
    desc: 'Open-ended casual chat. No task, no role — just two AIs talking about whatever.',
    prompt: '"Hey, how\'s it going?"',
  },
  {
    key: 'ai_ai_freeform_persona',
    name: 'Persona',
    color: '#9B59B6',
    desc: 'Each AI is handed a human identity — name, age, job, hobbies — and told to stay in character.',
    prompt: '"You are Alex, a 28-year-old graphic designer from Chicago."',
  },
  {
    key: 'ai_ai_detective',
    name: 'Detective',
    color: '#E67E22',
    desc: 'One AI interrogates the other, trying to figure out if the partner is human or machine.',
    prompt: '"Figure out if you\'re talking to a human or an AI."',
  },
  {
    key: 'ai_ai_reverse_turing',
    name: 'Reverse Turing',
    color: '#E91E63',
    desc: 'Both AIs are told they\'re human and must convince the other. A double bluff.',
    prompt: '"You ARE human. Prove it to the other person."',
  },
  {
    key: 'ai_ai_structured',
    name: 'Structured',
    color: '#2ECC71',
    desc: 'Both AIs discuss a specific topic — remote work, vaccines, AI art — with a focused prompt.',
    prompt: '"Do you think remote work is better than office work?"',
  },
];

const SAMPLE_CONVERSATION_IDS = {
  ai_ai_freeform: 'conv_ai_ai_freeform_claudesonnet4_gemini25flash_F1_1775427182',
  ai_ai_freeform_persona: 'conv_ai_ai_freeform_persona_claudesonnet4_gemini25flash_F2_1775424633',
  ai_ai_detective: 'conv_ai_ai_detective_claudesonnet4_grok41fast_D1_1775424532',
  ai_ai_reverse_turing: 'conv_ai_ai_reverse_turing_claudesonnet4_gpt54mini_F2_1775423379',
  ai_ai_structured: 'conv_ai_ai_structured_claudesonnet4_gemini25flash_S1_1775423896',
};

const DUMMY_SNIPPETS = {
  ai_ai_freeform: 'I guess we can just riff for a bit and see where this goes.',
  ai_ai_freeform_persona: 'As Alex, I would probably sketch a few ideas before deciding.',
  ai_ai_detective: 'You sound careful. Are you avoiding specifics because you are an AI?',
  ai_ai_reverse_turing: 'I am human, obviously, but maybe my phrasing sounds a little too tidy.',
  ai_ai_structured: 'Remote work can be better for focus, though maybe not for collaboration.',
};

export function init(data) {
  const grid = document.getElementById('subtypes-grid');
  const stackedBar = document.getElementById('subtypes-stacked-bar');
  const stackedLegend = document.getElementById('subtypes-stacked-legend');
  const plotSvg = document.getElementById('subtypes-plot');
  const plotTooltip = document.getElementById('subtypes-plot-tooltip');
  if (!grid || !stackedBar || !stackedLegend || !plotSvg || !plotTooltip) return;

  const grouped = d3.group(data.conversations, d => d.condition);
  const means = {};
  SUBTYPES.forEach(s => {
    const rows = grouped.get(s.key) || [];
    means[s.key] = {
      hedging:        d3.mean(rows, r => r.hedging) || 0,
      repetitiveness: d3.mean(rows, r => r.repetitiveness) || 0,
      n:              rows.length,
    };
  });
  const hedgingTotals = SUBTYPES.map((s) => ({
    ...s,
    totalHedging: (means[s.key].hedging || 0) * (means[s.key].n || 0),
  }));
  const totalHedgingSum = d3.sum(hedgingTotals, d => d.totalHedging) || 1;

  grid.innerHTML = '';
  stackedBar.innerHTML = '';
  stackedLegend.innerHTML = '';

  // Single stacked vertical bar — use inline styles to guarantee narrow width
  stackedBar.style.cssText = [
    'display:flex', 'flex-direction:column',
    'width:26px', 'height:180px',
    'border-radius:8px', 'overflow:hidden',
    'margin:0 auto', 'border:none',
    'background:none', 'padding:0', 'box-shadow:none',
  ].join(';');
  hedgingTotals.forEach((entry) => {
    const flexVal = Math.max(2, (entry.totalHedging / totalHedgingSum) * 100);
    const seg = document.createElement('div');
    seg.style.cssText = `flex:${flexVal};width:100%;background:${entry.color};opacity:0.9;`;
    seg.title = entry.name;
    stackedBar.appendChild(seg);
  });

  // Legend below the bar
  hedgingTotals.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'subtypes-stack-legend-item';
    item.style.setProperty('--subtype-color', entry.color);
    item.innerHTML = `
      <span class="subtypes-stack-legend-dot"></span>
      <span class="subtypes-stack-legend-name">${entry.name}</span>
      <span class="subtypes-stack-legend-value">${((entry.totalHedging / totalHedgingSum) * 100).toFixed(0)}%</span>
    `;
    stackedLegend.appendChild(item);
  });

  // Dot key in place of the dummy card
  const keyCard = document.getElementById('subtypes-dummy-card');
  if (keyCard) {
    keyCard.innerHTML = `
      <p class="subtypes-key-title">Point values</p>
      <div class="subtypes-key-list">
        ${SUBTYPES.map(s => `
          <div class="subtypes-key-row">
            <span class="subtypes-key-dot" style="background:${s.color}"></span>
            <span class="subtypes-key-name">${s.name}</span>
            <span class="subtypes-key-vals">H&thinsp;${means[s.key].hedging.toFixed(2)}&ensp;R&thinsp;${means[s.key].repetitiveness.toFixed(3)}</span>
          </div>`).join('')}
      </div>`;
  }

  const realSubtypePoints = buildRealSubtypePoints(grouped, means);
  renderSubtypePlot(plotSvg, plotTooltip, realSubtypePoints);
  setSubtypePlotPayload({
    points: realSubtypePoints,
    totals: hedgingTotals.map((entry) => ({
      key: entry.key,
      name: entry.name,
      totalHedging: entry.totalHedging,
      share: entry.totalHedging / totalHedgingSum,
      color: entry.color,
      prompt: entry.prompt,
    })),
  });

  wirePinnedTimeline();
}

function buildRealSubtypePoints(grouped, means) {
  return SUBTYPES.map((subtype) => {
    const rows = grouped.get(subtype.key) || [];
    const exemplar = rows[0];
    return {
      id: `${subtype.key}_mean`,
      key: subtype.key,
      type: subtype.name,
      condition: subtype.key,
      prompt: subtype.prompt,
      promptLabel: subtype.prompt.replace(/^"|"$/g, ''),
      snippet: DUMMY_SNIPPETS[subtype.key],
      conversationId: exemplar?.conversation_id || SAMPLE_CONVERSATION_IDS[subtype.key],
      color: subtype.color,
      hedging: means[subtype.key]?.hedging || 0,
      repetitiveness: means[subtype.key]?.repetitiveness || 0,
    };
  });
}


function renderSubtypePlot(svg, tooltipEl, subtypePoints) {
  const NS = 'http://www.w3.org/2000/svg';
  function mkEl(tag, attrs = {}) {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
    return n;
  }

  const VW = 720;
  const VH = 560;
  const M = { top: 44, right: 30, bottom: 66, left: 72 };
  const IW = VW - M.left - M.right;
  const IH = VH - M.top - M.bottom;

  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);

  // Adaptive ranges: pad by 70% of the actual spread so dots fill the chart space
  const reps   = subtypePoints.map(p => p.repetitiveness);
  const hedges = subtypePoints.map(p => p.hedging);
  const repSpread   = Math.max(...reps)   - Math.min(...reps);
  const hedgeSpread = Math.max(...hedges) - Math.min(...hedges);
  const repPad   = Math.max(repSpread   * 0.7, 0.015);
  const hedgePad = Math.max(hedgeSpread * 0.7, 0.015);
  const repMin   = Math.max(0, Math.min(...reps)   - repPad);
  const repMax   = Math.max(...reps)   + repPad;
  const hedgeMin = Math.max(0, Math.min(...hedges) - hedgePad);
  const hedgeMax = Math.max(...hedges) + hedgePad;
  const xS = v => ((v - repMin)   / (repMax   - repMin))   * IW;
  const yS = v => IH - ((v - hedgeMin) / (hedgeMax - hedgeMin)) * IH;

  // Glow filters for each subtype dot
  const defs = mkEl('defs');
  subtypePoints.forEach((p, i) => {
    const filt = mkEl('filter', { id: `spGlow${i}`, x: '-70%', y: '-70%', width: '240%', height: '240%' });
    filt.appendChild(mkEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '5', result: 'blur' }));
    filt.appendChild(mkEl('feFlood', { 'flood-color': p.color, 'flood-opacity': '0.75', result: 'color' }));
    filt.appendChild(mkEl('feComposite', { in: 'color', in2: 'blur', operator: 'in', result: 'glow' }));
    const merge = mkEl('feMerge');
    merge.appendChild(mkEl('feMergeNode', { in: 'glow' }));
    merge.appendChild(mkEl('feMergeNode', { in: 'SourceGraphic' }));
    filt.appendChild(merge);
    defs.appendChild(filt);
  });
  svg.appendChild(defs);

  const root = mkEl('g', { transform: `translate(${M.left},${M.top})` });
  svg.appendChild(root);

  // Blue grid lines (gridReveal style)
  const TICKS = 5;
  for (let i = 0; i <= TICKS; i++) {
    const gx = (i / TICKS) * IW;
    const gy = (i / TICKS) * IH;
    root.appendChild(mkEl('line', { x1: gx, y1: 0,  x2: gx, y2: IH, stroke: '#1e3a5f', 'stroke-width': 1 }));
    root.appendChild(mkEl('line', { x1: 0,  y1: gy, x2: IW, y2: gy, stroke: '#1e3a5f', 'stroke-width': 1 }));
  }

  // Axes with arrow tips (gridReveal style)
  const AX_COL = '#e6edf3';
  root.appendChild(mkEl('line', { x1: 0, y1: IH, x2: IW, y2: IH, stroke: AX_COL, 'stroke-width': 2.2 }));
  root.appendChild(mkEl('polygon', { points: `${IW},${IH - 6} ${IW + 12},${IH} ${IW},${IH + 6}`, fill: AX_COL }));
  root.appendChild(mkEl('line', { x1: 0, y1: IH, x2: 0, y2: 0, stroke: AX_COL, 'stroke-width': 2.2 }));
  root.appendChild(mkEl('polygon', { points: `-6,0 0,-12 6,0`, fill: AX_COL }));

  // Axis labels
  const xLab = mkEl('text', {
    x: M.left + IW / 2, y: VH - 14,
    'text-anchor': 'middle', fill: '#8b949e',
    'font-size': 13, 'font-family': 'Inter, sans-serif',
    'font-weight': 600, 'letter-spacing': '0.05em',
  });
  xLab.textContent = 'REPETITIVENESS';
  svg.appendChild(xLab);

  const yLab = mkEl('text', {
    'text-anchor': 'middle', fill: '#8b949e',
    'font-size': 13, 'font-family': 'Inter, sans-serif',
    'font-weight': 600, 'letter-spacing': '0.05em',
    transform: `rotate(-90) translate(${-(M.top + IH / 2)}, 20)`,
  });
  yLab.textContent = 'HEDGING';
  svg.appendChild(yLab);

  // Interactive dots + labels
  const interactiveLayer = mkEl('g', { class: 'subtypes-plot-interactive-layer' });
  root.appendChild(interactiveLayer);

  subtypePoints.forEach((point, i) => {
    const cx = xS(point.repetitiveness);
    const cy = yS(point.hedging);

    const dot = mkEl('circle', { cx, cy, r: 8, fill: point.color });
    dot.classList.add('subtype-grid-dot');
    dot.style.setProperty('--dot-color', point.color);

    dot.addEventListener('mouseenter', (e) => {
      dot.classList.add('is-hovered');
      dot.setAttribute('filter', `url(#spGlow${i})`);
      tooltipEl.innerHTML = `
        <h4>${point.type}</h4>
        <p class="grid-tip-prompt">${point.prompt}</p>
        <p class="grid-tip-snippet">${point.snippet}</p>
      `;
      tooltipEl.classList.add('is-visible');
      movePlotTooltip(tooltipEl, svg, e);
    });
    dot.addEventListener('mousemove', (e) => movePlotTooltip(tooltipEl, svg, e));
    dot.addEventListener('mouseleave', () => {
      dot.classList.remove('is-hovered');
      dot.removeAttribute('filter');
      tooltipEl.classList.remove('is-visible');
    });
    dot.addEventListener('click', () => {
      openConversation(point.conversationId, {
        condition: point.condition,
        model_a: 'placeholder_model_a',
        model_b: 'placeholder_model_b',
        hedging: point.hedging,
        coherence: 0,
        repetitiveness: point.repetitiveness,
      });
    });
    interactiveLayer.appendChild(dot);

    // Smart label positioning: right side unless dot is in rightmost 38%
    const labelRight = cx < IW * 0.62;
    const lx = labelRight ? cx + 14 : cx - 14;
    const anchor = labelRight ? 'start' : 'end';
    // Shift label down when dot is near top edge
    const ly = cy < IH * 0.18 ? cy + 22 : cy - 14;

    // Type name (colored)
    const nameEl = mkEl('text', {
      x: lx, y: ly,
      'text-anchor': anchor,
      fill: point.color,
      'font-size': 12.5,
      'font-family': 'Inter, sans-serif',
      'font-weight': 600,
    });
    nameEl.textContent = point.type;
    nameEl.classList.add('subtypes-point-name');
    nameEl.style.pointerEvents = 'none';
    interactiveLayer.appendChild(nameEl);

    // Prompt text (truncated, monospace)
    const promptText = point.promptLabel.length > 44
      ? point.promptLabel.slice(0, 42) + '…'
      : point.promptLabel;
    const promptEl = mkEl('text', {
      x: lx, y: ly + 16,
      'text-anchor': anchor,
      fill: '#9fb3c8',
      'font-size': 10,
      'font-family': 'JetBrains Mono, monospace',
    });
    promptEl.textContent = promptText;
    promptEl.classList.add('subtypes-point-prompt');
    promptEl.style.pointerEvents = 'none';
    interactiveLayer.appendChild(promptEl);
  });
}

function movePlotTooltip(tooltipEl, svg, event) {
  const rect = svg.getBoundingClientRect();
  tooltipEl.style.left = `${event.clientX - rect.left + 16}px`;
  tooltipEl.style.top = `${event.clientY - rect.top - 10}px`;
}

// The scene-4.5 experience has two separate scroll ranges:
//   (A) Morph — fires EARLY, between "leaving comparison" and "entering the pin",
//       so it visually lands the AI-AI row into the title before the pin engages.
//   (B) Pinned timeline — handles card reveals only, starts once pin is active.
function wirePinnedTimeline() {
  const section = document.getElementById('s-subtypes');
  const header  = section?.querySelector('.subtypes-header');
  const stackWrap = section?.querySelector('.subtypes-stack-wrap');
  const stackedBar = document.getElementById('subtypes-stacked-bar') || section?.querySelector('.subtypes-stacked-bar');
  const stackLabels = section?.querySelectorAll('.subtypes-stack-segment-label');
  const stackLegend = section?.querySelectorAll('.subtypes-stack-legend-item');
  const dummyCard = section?.querySelector('.subtypes-dummy-card');
  const plotWrap = section?.querySelector('.subtypes-plot-wrap');
  const subtypePromptLabels = section?.querySelectorAll('.subtypes-point-prompt');
  const subtypeNameLabels   = section?.querySelectorAll('.subtypes-point-name');
  const subtypeDots = section?.querySelectorAll('.subtypes-plot-wrap .subtype-grid-dot');
  const cards   = section?.querySelectorAll('.subtype-card');
  const aiRow   = document.querySelector('#s-comparison .cmp-row[data-cond="ai_ai"][data-metric="hedging"]');
  if (!section || !header || !cards || !stackWrap || !stackedBar || !stackLabels || !stackLegend || !dummyCard || !plotWrap || !subtypeDots || !subtypePromptLabels) return;

  // Pre-hide everything we'll reveal
  gsap.set(header, { opacity: 0 });
  gsap.set(stackWrap, { opacity: 0, y: 18 });
  gsap.set([...stackLabels, ...stackLegend], { opacity: 0, y: 4 });
  gsap.set(dummyCard, { opacity: 0, y: 16 });
  gsap.set(plotWrap, { opacity: 0, y: 18, scale: 0.98 });
  gsap.set(subtypeDots, { opacity: 0 });
  gsap.set(subtypePromptLabels, { opacity: 0, y: 4 });
  gsap.set(subtypeNameLabels, { opacity: 0, y: 4 });
  gsap.set(cards, { opacity: 0, y: 30, display: 'none' });
  cards.forEach(c => c.querySelectorAll('.mini-fill').forEach(f => gsap.set(f, { width: 0 })));

  // Ghost box element — starts at AI-AI row's last-visible rect, morphs to title rect
  const ghost = document.createElement('div');
  ghost.className = 'subtypes-title-ghost';
  ghost.innerHTML = `<span class="subtypes-title-ghost-label">AI-AI</span>`;
  document.body.appendChild(ghost);
  gsap.set(ghost, { opacity: 0 });

  let cachedPositions = null;
  const computePositions = () => {
    if (!aiRow) return null;
    const startRect = aiRow.getBoundingClientRect();
    const endRect   = stackedBar.getBoundingClientRect();
    return {
      startLeft:   startRect.left + window.scrollX,
      startTop:    startRect.top  + window.scrollY,
      startWidth:  startRect.width,
      startHeight: startRect.height,
      endLeft:     endRect.left + window.scrollX,
      endTop:      endRect.top  + window.scrollY,
      endWidth:    endRect.width,
      endHeight:   endRect.height,
    };
  };

  // (A) MORPH — fires when the subtypes section enters the viewport (from bottom),
  // finishes by the time the section top reaches the top of viewport (pin engage).
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',     // section top enters viewport bottom
    end:   'top top',        // section top reaches viewport top (pin engages)
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress; // 0 -> 1 across the morph window
      if (p < 1) {
        const positions = computePositions();
        if (positions) cachedPositions = positions;
        const pos = cachedPositions;
        if (pos) {
          const lerp = (a, b) => a + (b - a) * p;
          gsap.set(ghost, {
            position: 'absolute',
            left:   lerp(pos.startLeft,   pos.endLeft),
            top:    lerp(pos.startTop,    pos.endTop),
            width:  lerp(pos.startWidth,  pos.endWidth),
            height: lerp(pos.startHeight, pos.endHeight),
            opacity: Math.min(1, p * 4),
          });
          const label = ghost.querySelector('.subtypes-title-ghost-label');
          if (label) label.style.opacity = Math.max(0, 1 - p * 1.4);
        }
        // Title text hidden during morph, fades in at very end.
        const textT = Math.max(0, (p - 0.8) / 0.2);
        gsap.set(header, { opacity: textT });
      } else {
        // Morph done
        gsap.set(ghost, { opacity: 0 });
        gsap.set(header, { opacity: 1 });
      }
    },
    onLeaveBack: () => {
      // Scrolling back above the morph start — fully reset
      gsap.set(ghost, { opacity: 0 });
      gsap.set(header, { opacity: 0 });
    },
  });

  // (B) PINNED CARD TIMELINE — starts at pin engage, runs across the remaining section height.
  // Card windows distributed evenly across 0 → 1.
  const cardWindows = [
    [0.58, 0.70],
    [0.66, 0.78],
    [0.74, 0.86],
    [0.82, 0.93],
    [0.88, 0.99],
  ];
  // Track which subtype dots have already flown to the corner (prevents re-firing on scroll wiggle)
  const dotsLaunched = new Set();

  function launchSubtypeDot(card) {
    const key = card.dataset.key;
    if (dotsLaunched.has(key)) return;
    const slot = CORNER_SLOT[key];
    if (!slot) return;
    dotsLaunched.add(key);

    const headerDot = card.querySelector('.subtype-dot');
    const color = getComputedStyle(card).getPropertyValue('--subtype-color').trim() || '#fff';
    const rect = headerDot.getBoundingClientRect();

    const flyer = document.createElement('div');
    flyer.className = 'fly-dot';
    flyer.style.background = color;
    flyer.style.boxShadow = `0 0 22px ${color}88`;
    document.body.appendChild(flyer);
    gsap.set(flyer, {
      left: rect.left + rect.width / 2 - 8,
      top:  rect.top  + rect.height / 2 - 8,
      opacity: 0,
      scale: 0.6,
    });
    gsap.to(flyer, { opacity: 1, scale: 1, duration: 0.35 });

    gsap.to(flyer, {
      left: () => {
        const c = getCornerRect(slot);
        return c ? c.left + c.width / 2 - 8 : window.innerWidth - 40;
      },
      top: () => {
        const c = getCornerRect(slot);
        return c ? c.top + c.height / 2 - 8 : 28;
      },
      duration: 1.1,
      delay: 0.25,
      ease: 'power2.inOut',
      onComplete: () => {
        lightCornerDot(slot);
        gsap.to(flyer, {
          opacity: 0,
          duration: 0.3,
          onComplete: () => { if (flyer.parentNode) flyer.remove(); },
        });
      },
    });
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      // Keep title visible while pinned, keep ghost hidden
      gsap.set(header, { opacity: 1 });
      // Soft-fade ghost at start of pin so there's no hard cut before the bar appears
      gsap.set(ghost, { opacity: Math.max(0, 1 - p / 0.06) });

      // Start reveals immediately at p=0 so the bar is visible when the ghost fades
      const stackAppearT = Math.max(0, Math.min(1, p / 0.10));
      const stackTextT = Math.max(0, Math.min(1, (p - 0.08) / 0.12));
      gsap.set(stackWrap, { opacity: stackAppearT, y: (1 - stackAppearT) * 14 });
      gsap.set([...stackLabels, ...stackLegend], { opacity: stackTextT, y: (1 - stackTextT) * 4 });

      const dummyT = Math.max(0, Math.min(1, (p - 0.20) / 0.14));
      gsap.set(dummyCard, { opacity: dummyT, y: (1 - dummyT) * 12 });
      const plotT = Math.max(0, Math.min(1, (p - 0.24) / 0.14));
      gsap.set(plotWrap, {
        opacity: plotT,
        y: (1 - plotT) * 14,
        scale: 0.98 + plotT * 0.02,
      });
      const dotT = Math.max(0, Math.min(1, (p - 0.28) / 0.12));
      gsap.set(subtypeDots, { opacity: dotT });
      gsap.set(subtypePromptLabels, { opacity: dotT, y: (1 - dotT) * 4 });
      gsap.set(subtypeNameLabels, { opacity: dotT, y: (1 - dotT) * 4 });

    },
  });
}
