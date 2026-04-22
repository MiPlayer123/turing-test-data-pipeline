import * as d3 from 'd3';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Order + metadata for each AI-AI variant
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

  // Compute per-subtype means for hedging + repetitiveness
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

  // Global scale so bars are comparable across cards
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

  // Scroll-reveal: each card reveals when it enters view, reverses when scrolled back up past it.
  const cards = grid.querySelectorAll('.subtype-card');
  gsap.set(cards, { opacity: 0, y: 32 });
  cards.forEach((card) => {
    const fills = card.querySelectorAll('.mini-fill');
    const showTween = () => {
      gsap.to(card, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
      fills.forEach(fill => {
        gsap.to(fill, { width: `${fill.dataset.pct}%`, duration: 0.8, delay: 0.2, ease: 'power2.out' });
      });
    };
    const hideTween = () => {
      gsap.to(card, { opacity: 0, y: 32, duration: 0.35, ease: 'power2.in' });
      fills.forEach(fill => gsap.to(fill, { width: '0%', duration: 0.3 }));
    };

    ScrollTrigger.create({
      trigger: card,
      start: 'top 78%',
      end:   'bottom 20%',
      onEnter:     () => showTween(),
      onEnterBack: () => showTween(),
      onLeaveBack: () => hideTween(),
    });
  });
}
