import './styles/base.css';
import './styles/sections.css';
import './styles/components.css';

import scrollama from 'scrollama';
import { loadData } from './data/loader.js';
import * as quiz from './sections/quiz.js';
import * as comparison from './sections/comparison.js';
import * as animation from './sections/animation.js';
import * as timeline from './sections/timeline.js';
import * as detective from './sections/detective.js';
// explorer is dynamically imported when needed (Three.js is ~624KB)

function initScrolly(sectionId, onStep) {
  const steps = document.querySelectorAll(`#${sectionId} .step`);
  if (!steps.length) return;
  const scroller = scrollama();
  scroller.setup({ step: `#${sectionId} .step`, offset: 0.5 })
    .onStepEnter(response => onStep(+response.element.dataset.step));
  window.addEventListener('resize', () => scroller.resize());
}

function initCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = +el.dataset.count;
      let start = null;
      function tick(now) {
        if (!start) start = now;
        const t = Math.min((now - start) / 1000, 1);
        el.textContent = Math.round((1 - Math.pow(1 - t, 3)) * target);
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-box .number').forEach(el => observer.observe(el));
}

async function main() {
  const data = await loadData();
  console.log(`Loaded ${data.conversations.length} conversations`);

  // S1: Quiz
  quiz.init(data);

  // S2: Thesis counters
  initCounters();

  // S3: Comparison bars with metric intro (Scrollama)
  comparison.init(data);
  initScrolly('s-comparison', (step) => comparison.onStep(step));

  // S5: GSAP animation (card → center → subtypes → RT slides)
  animation.init(data);

  // S6: Timeline (Scrollama)
  timeline.init(data);
  initScrolly('s-timeline', (step) => timeline.onStep(step));

  // S7: Detective (Scrollama)
  detective.init(data);
  initScrolly('s-detective', (step) => detective.onStep(step));

  // S8: 3D Explorer (lazy — dynamic import keeps Three.js out of main bundle)
  const explorerObs = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting) {
      const explorer = await import('./sections/explorer.js');
      explorer.init(data);
      explorerObs.disconnect();
    }
  }, { threshold: 0.1 });
  explorerObs.observe(document.getElementById('s-explorer'));
}

main().catch(err => console.error('Init failed:', err));
