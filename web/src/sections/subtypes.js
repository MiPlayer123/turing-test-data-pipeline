import * as d3 from 'd3';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { light as lightCornerDot, getCornerRect } from '../lib/cornerDots.js';

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
    color: '#F1C40F',
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

export function init(data) {
  const grid = document.getElementById('subtypes-grid');
  if (!grid) return;

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
  const maxHedging = d3.max(SUBTYPES, s => means[s.key].hedging) || 1;
  const maxRep     = d3.max(SUBTYPES, s => means[s.key].repetitiveness) || 1;

  grid.innerHTML = '';
  SUBTYPES.forEach(s => {
    const m = means[s.key];
    const hedPct = (m.hedging / maxHedging) * 100;
    const repPct = (m.repetitiveness / maxRep) * 100;
    const card = document.createElement('div');
    card.className = 'subtype-card';
    card.dataset.key = s.key;
    card.style.setProperty('--subtype-color', s.color);
    card.innerHTML = `
      <div class="subtype-card-header">
        <span class="subtype-dot" style="background:${s.color}"></span>
        <h3 class="subtype-name">${s.name}</h3>
      </div>
      <p class="subtype-desc">${s.desc}</p>
      <p class="subtype-prompt">${s.prompt}</p>
      <div class="subtype-mini-bars">
        <div class="mini-row">
          <span class="mini-label">Hedging</span>
          <div class="mini-track"><div class="mini-fill" data-pct="${hedPct.toFixed(2)}"></div></div>
          <span class="mini-val">${m.hedging.toFixed(3)}</span>
        </div>
        <div class="mini-row">
          <span class="mini-label">Repetition</span>
          <div class="mini-track"><div class="mini-fill" data-pct="${repPct.toFixed(2)}"></div></div>
          <span class="mini-val">${m.repetitiveness.toFixed(3)}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  wirePinnedTimeline();
}

// The scene-4.5 experience has two separate scroll ranges:
//   (A) Morph — fires EARLY, between "leaving comparison" and "entering the pin",
//       so it visually lands the AI-AI row into the title before the pin engages.
//   (B) Pinned timeline — handles card reveals only, starts once pin is active.
function wirePinnedTimeline() {
  const section = document.getElementById('s-subtypes');
  const header  = section?.querySelector('.subtypes-header');
  const cards   = section?.querySelectorAll('.subtype-card');
  const aiRow   = document.querySelector('#s-comparison .cmp-row[data-cond="ai_ai"][data-metric="hedging"]');
  if (!section || !header || !cards) return;

  // Pre-hide everything we'll reveal
  gsap.set(header, { opacity: 0 });
  gsap.set(cards, { opacity: 0, y: 30 });
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
    const endRect   = header.getBoundingClientRect();
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
        // Title text hidden during morph, fades in at very end (0.85 -> 1.0)
        const textT = Math.max(0, (p - 0.85) / 0.15);
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
    [0.02, 0.18],
    [0.20, 0.36],
    [0.38, 0.54],
    [0.56, 0.72],
    [0.74, 0.90],
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
      gsap.set(ghost, { opacity: 0 });

      cards.forEach((card, i) => {
        const [start, end] = cardWindows[i];
        const t = Math.max(0, Math.min(1, (p - start) / (end - start)));
        gsap.set(card, { opacity: t, y: (1 - t) * 30 });
        const barT = Math.max(0, Math.min(1, (t - 0.4) / 0.6));
        card.querySelectorAll('.mini-fill').forEach(fill => {
          const pct = +fill.dataset.pct;
          gsap.set(fill, { width: `${pct * barT}%` });
        });
        // Once the card is nearly fully revealed, send its colored dot to the corner
        if (t > 0.85) launchSubtypeDot(card);
      });
    },
  });
}
