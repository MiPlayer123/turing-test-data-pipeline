import * as d3 from 'd3';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MODEL_COLORS, MODEL_LABELS, CONDITION_COLOR } from '../data/constants.js';
import * as tooltip from '../components/tooltip.js';

let svg, stats, x, y, width, height;
let currentStep = -1;
const revealed = new Set();
let collapseArmed = false;

export function init(data) {
  const container = document.getElementById('detective-viz');
  container.innerHTML = '';
  container.style.textAlign = 'center';

  const detective = data.conversations.filter(d => d.condition === 'ai_ai_detective');
  const byModel = d3.group(detective, d => d.model_a);
  stats = [];
  for (const [model, rows] of byModel) {
    const correct = rows.filter(r => r.detective_correct_bool).length;
    stats.push({
      model, label: MODEL_LABELS[model] || model, color: MODEL_COLORS[model] || '#888',
      accuracy: (correct / rows.length) * 100, n: rows.length,
    });
  }
  // Human baseline: lifted from the quiz "How others answered" — 74% of viewers correctly
  // labelled the AI thread as AI. Colored with the human-human condition color so the bar
  // visually ties to the H-H baseline reused throughout the rest of the story.
  stats.push({
    model: 'human',
    label: MODEL_LABELS.human || 'Human',
    color: CONDITION_COLOR.human_human,
    accuracy: 74,
    n: 'quiz',
  });
  stats.sort((a, b) => b.accuracy - a.accuracy);

  const wrapper = document.createElement('div');
  wrapper.style.display = 'inline-block';
  container.appendChild(wrapper);

  const margin = { top: 32, right: 80, bottom: 36, left: 170 };
  width = 600 - margin.left - margin.right;
  height = 280 - margin.top - margin.bottom;

  const svgRoot = d3.select(wrapper).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom);

  // Human baseline reads as "you" via bold weight on its label, not a glow.
  svg = svgRoot.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  y = d3.scaleBand().domain(stats.map(d => d.model)).range([0, height]).padding(0.3);
  x = d3.scaleLinear().domain([0, 105]).range([0, width]);

  svg.selectAll('.y-label').data(stats).join('text')
    .attr('x', -10).attr('y', d => y(d.model) + y.bandwidth() / 2)
    .attr('dy', '0.35em').attr('text-anchor', 'end')
    .attr('fill', d => d.model === 'human' ? '#14110C' : '#6E6557')
    .attr('font-size', '13px')
    .attr('font-family', 'Inter Tight, sans-serif')
    .attr('font-weight', d => d.model === 'human' ? 700 : 400)
    .text(d => d.model === 'human' ? `${d.label} (you & co.)` : `${d.label} (n=${d.n})`);

  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + '%').tickSize(-height))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#D9D0BD'))
    .call(g => g.selectAll('.tick text').attr('fill', '#6E6557').attr('font-size', '11px').attr('font-family', 'JetBrains Mono, monospace'));

  // 50% marker — shown later via onStep
  svg.append('text').attr('class', 'fifty-label').attr('x', x(50)).attr('y', height + 28).attr('text-anchor', 'middle')
    .attr('fill', '#9A8F7C').attr('font-size', '11px').attr('font-family', 'JetBrains Mono, monospace')
    .text('50%').attr('opacity', 0);
  svg.append('rect').attr('class', 'fifty-shade').attr('x', 0).attr('y', 0).attr('width', x(50)).attr('height', height)
    .attr('fill', '#B43A2A').attr('opacity', 0);

  // Bars: AI bars start hidden (width 0, faded), human bar starts already drawn so the
  // viewer enters the section seeing the baseline they just answered against in the quiz.
  svg.selectAll('.bar').data(stats).join('rect').attr('class', 'bar')
    .attr('y', d => y(d.model)).attr('height', y.bandwidth())
    .attr('x', 0)
    .attr('width', d => d.model === 'human' ? x(d.accuracy) : 0)
    .attr('fill', d => d.color).attr('rx', 4)
    .attr('opacity', d => d.model === 'human' ? 1 : 0.15);

  svg.selectAll('.val-label').data(stats).join('text').attr('class', 'val-label')
    .attr('y', d => y(d.model) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('fill', '#14110C').attr('font-size', '14px').attr('font-weight', '700')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('x', d => d.model === 'human' ? x(d.accuracy) + 8 : 8)
    .attr('opacity', d => d.model === 'human' ? 1 : 0)
    .text(d => `${d.accuracy.toFixed(0)}%`);

  // Human is permanently revealed so reveal sweeps don't have to opt it in each step.
  revealed.add('human');

  // Restore the chart if the viewer scrolls back up after the collapse fired,
  // so they can re-read the section.
  ScrollTrigger.create({
    trigger: '#s-detective',
    start: 'top 60%',
    end:   'bottom 40%',
    onEnterBack: () => {
      if (!collapseArmed) return;
      const stack = document.querySelector('#s-detective .detective-stack');
      const titleEl = document.querySelector('#s-detective .detective-chart-title');
      const subtitleEl = document.querySelector('#s-detective .detective-chart-subtitle');
      const frame = document.getElementById('detective-collapse-frame');
      const flyDot = document.getElementById('story-red-dot');
      gsap.killTweensOf([stack, titleEl, subtitleEl, frame, flyDot].filter(Boolean));
      if (frame) gsap.set(frame, { opacity: 0, display: 'none' });
      if (flyDot) gsap.set(flyDot, { opacity: 0, scale: 0, y: 0 });
      if (stack) gsap.set(stack, { opacity: 1, scale: 1, clearProps: 'transform' });
      if (titleEl) gsap.set(titleEl, { opacity: 1 });
      if (subtitleEl) gsap.set(subtitleEl, { opacity: 1 });
      collapseArmed = false;
    },
  });
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;
  svg.selectAll('.annotation').remove();

  if (step === 0) {
    revealModels(['gpt-5.4', 'gpt-5.4-mini', 'gemini-2.5-flash']);
  } else if (step === 1) {
    revealModels(['gpt-5.4', 'gpt-5.4-mini', 'gemini-2.5-flash', 'grok-4-1-fast', 'claude-sonnet-4']);
    // Show 50% marker now that all bars are in
    svg.select('.fifty-label').transition().duration(400).attr('opacity', 1);
    svg.select('.fifty-shade').transition().duration(400).attr('opacity', 0.03);
  } else if (step === 2) {
    playCollapseIntoDot();
  }
}

// Same easings/structure as the original quiz-into-dot animation, but operating
// on the detective chart's frame. Spawns #story-red-dot which gridReveal picks up.
function playCollapseIntoDot() {
  if (collapseArmed) return;
  const stack = document.querySelector('#s-detective .detective-stack');
  const titleEl = document.querySelector('#s-detective .detective-chart-title');
  const vizEl = document.getElementById('detective-viz');
  if (!stack || !vizEl) return;
  collapseArmed = true;

  const targetEl = vizEl.querySelector('svg') || vizEl;
  const rect = targetEl.getBoundingClientRect();
  const framePad = 16;
  const frameRect = {
    left: rect.left - framePad,
    top: rect.top - framePad,
    width: Math.max(40, rect.width + framePad * 2),
    height: Math.max(40, rect.height + framePad * 2),
  };
  const cx = frameRect.left + frameRect.width / 2 - 8;
  const cy = frameRect.top + frameRect.height / 2 - 8;

  let frame = document.getElementById('detective-collapse-frame');
  if (!frame) {
    frame = document.createElement('div');
    frame.id = 'detective-collapse-frame';
    frame.className = 'quiz-collapse-frame';
    document.body.appendChild(frame);
  }
  gsap.set(frame, {
    left: frameRect.left,
    top: frameRect.top,
    width: frameRect.width,
    height: frameRect.height,
    opacity: 0,
    scale: 1,
    transformOrigin: '50% 50%',
    display: 'block',
  });

  let flyDot = document.getElementById('story-red-dot');
  if (!flyDot) {
    flyDot = document.createElement('div');
    flyDot.id = 'story-red-dot';
    flyDot.className = 'fly-dot fly-dot-red';
    document.body.appendChild(flyDot);
  }
  gsap.set(flyDot, {
    left: cx, top: cy,
    opacity: 0, scale: 0, y: 0,
    transformOrigin: '50% 50%',
  });

  // Lock scroll for the duration of the collapse so the animation reads cleanly.
  const preventScroll = (e) => e.preventDefault();
  const lockedY = window.scrollY;
  const clamp = () => { if (window.scrollY !== lockedY) window.scrollTo({ top: lockedY, behavior: 'instant' }); };
  window.addEventListener('wheel', preventScroll, { passive: false });
  window.addEventListener('touchmove', preventScroll, { passive: false });
  window.addEventListener('scroll', clamp, { passive: true });
  const unlock = () => {
    window.removeEventListener('wheel', preventScroll);
    window.removeEventListener('touchmove', preventScroll);
    window.removeEventListener('scroll', clamp);
  };

  gsap.set(stack, { transformOrigin: '50% 50%' });

  const squeezeDur = 0.92;
  const easeSqueeze = 'power4.in';

  const tl = gsap.timeline({
    delay: 0.06,
    onComplete: () => {
      gsap.set(frame, { opacity: 0, display: 'none' });
      unlock();
      const gridSection = document.getElementById('s-grid');
      if (gridSection) gridSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  });

  tl.to(frame, { opacity: 1, duration: 0.12, ease: 'power1.out' }, 0);
  tl.to(stack, { scale: 0.94, duration: 0.12, ease: 'power1.out' }, 0);
  tl.to(frame, {
    scale: 0.04,
    opacity: 0.2,
    duration: squeezeDur,
    ease: easeSqueeze,
  }, 0.14);
  tl.to(stack, {
    scale: 0.35,
    opacity: 0,
    duration: squeezeDur * 0.65,
    ease: easeSqueeze,
  }, 0.18);
  if (titleEl) {
    tl.to(titleEl, { opacity: 0, duration: squeezeDur * 0.5, ease: easeSqueeze }, 0.2);
  }

  const impactT = 0.14 + squeezeDur * 0.82;
  tl.set(flyDot, { opacity: 1, scale: 0.12, y: 0 }, impactT);
  tl.to(flyDot, { scale: 2.05, duration: 0.14, ease: 'power3.out' }, impactT);
  tl.to(flyDot, { scale: 1, duration: 0.52, ease: 'elastic.out(1.15, 0.48)' }, impactT + 0.14);
  tl.to(flyDot, { y: -16, duration: 0.2, ease: 'power2.out' }, impactT + 0.56);
  tl.to(flyDot, { y: 0, scale: 1, duration: 0.55, ease: 'bounce.out(1.35)' }, impactT + 0.76);
}

function revealModels(keys) {
  keys.forEach(k => revealed.add(k));
  svg.selectAll('.bar')
    .transition().duration(600).delay((d, i) => revealed.has(d.model) ? i * 60 : 0)
    .attr('width', d => revealed.has(d.model) ? x(d.accuracy) : 0)
    .attr('opacity', d => revealed.has(d.model) ? 1 : 0.15);
  svg.selectAll('.val-label')
    .transition().duration(600).delay((d, i) => revealed.has(d.model) ? i * 60 : 0)
    .attr('x', d => revealed.has(d.model) ? x(d.accuracy) + 8 : 8)
    .attr('opacity', d => revealed.has(d.model) ? 1 : 0);
}
