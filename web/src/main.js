import './styles/base.css';
import './styles/sections.css';
import './styles/components.css';

import scrollama from 'scrollama';
import { loadData } from './data/loader.js';
import * as quiz from './sections/quiz.js';
import * as metricsExplain from './sections/metricsExplain.js';
import * as mainFlow from './sections/mainFlow.js';
import * as detective from './sections/detective.js';
import * as explorer from './sections/explorer.js';

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

  quiz.init(data);
  initCounters();
  metricsExplain.init(data);

  // Unified comparison → sub-types → timeline flow
  mainFlow.init(data);
  initScrolly('s-main-flow', (step) => mainFlow.onStep(step));

  // Detective
  detective.init(data);
  initScrolly('s-detective', (step) => detective.onStep(step));

  // 3D Explorer (lazy)
  const explorerObs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      explorer.init(data);
      explorerObs.disconnect();
    }
  }, { threshold: 0.1 });
  explorerObs.observe(document.getElementById('s-explorer'));
}

main().catch(err => console.error('Init failed:', err));
