import './styles/base.css';
import './styles/sections.css';
import './styles/components.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadData } from './data/loader.js';

gsap.registerPlugin(ScrollTrigger);
import * as quiz from './sections/quiz.js';
import * as metricsIntro from './sections/metricsIntro.js';
import * as comparison from './sections/comparison.js';
import * as subtypes from './sections/subtypes.js';
import * as timeline from './sections/timeline.js';
import * as timelineMorph from './sections/timelineMorph.js';
import * as detective from './sections/detective.js';
// explorer is dynamically imported when needed (Three.js is ~624KB)

function initScrolly(sectionId, onStep) {
  const steps = document.querySelectorAll(`#${sectionId} .step`);
  if (!steps.length) return;
  steps.forEach(step => {
    ScrollTrigger.create({
      trigger: step,
      start: 'top 50%',
      end: 'bottom 50%',
      onEnter: () => onStep(+step.dataset.step),
      onEnterBack: () => onStep(+step.dataset.step),
    });
  });
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

  // S3.5: Metrics intro (definition cards + yellow dot birth)
  metricsIntro.init();

  // S4: Comparison bars (H-H / H-AI / AI-AI)
  comparison.init(data);
  initScrolly('s-comparison', (step) => comparison.onStep(step));

  // S4.5: AI-AI subtype breakdown
  subtypes.init(data);

  // S6: Timeline (Reverse Turing-focused line chart)
  timeline.init(data);
  initScrolly('s-timeline', (step) => timeline.onStep(step));
  timelineMorph.init();

  // S7: Detective — per-model report card
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
