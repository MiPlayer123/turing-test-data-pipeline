import './styles/base.css';
import './styles/sections.css';
import './styles/components.css';

import scrollama from 'scrollama';
import { loadData } from './data/loader.js';
import * as metrics from './sections/metrics.js';
import * as detective from './sections/detective.js';
import * as trajectory from './sections/trajectory.js';
import * as explorer from './sections/explorer.js';

// Hook conversation — a real excerpt from the data
const HOOK_LINES = [
  { side: 'left', text: "Do you ever feel like you're just going through the motions?" },
  { side: 'right', text: "Yeah, honestly? Sometimes I do. Like, I'll be in the middle of something and suddenly wonder if I'm actually present or just... performing presence, you know?" },
  { side: 'left', text: "That's a really specific way to put it. Performing presence." },
  { side: 'right', text: "I mean... I guess I'd say I'm pretty sure I'm human? Like, I can feel the chair I'm sitting on right now." },
];

function initHook() {
  const chat = document.getElementById('hook-chat');
  HOOK_LINES.forEach(line => {
    const bubble = document.createElement('div');
    bubble.className = `hook-bubble ${line.side}`;
    bubble.textContent = line.text;
    chat.appendChild(bubble);
  });

  // Count-up for stats
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

function initScrolly(sectionId, onStep) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const scroller = scrollama();
  scroller.setup({
    step: `#${sectionId} .step`,
    offset: 0.5,
    debug: false,
  }).onStepEnter(response => {
    onStep(+response.element.dataset.step, response.direction);
  });

  window.addEventListener('resize', () => scroller.resize());
  return scroller;
}

async function main() {
  initHook();

  const data = await loadData();
  console.log(`Loaded ${data.conversations.length} conversations`);

  // Act 2: Metrics — sticky chart that updates per step
  metrics.init(data);
  initScrolly('act-metrics', (step) => metrics.onStep(step));

  // Act 3: Detective — progressive bar reveal
  detective.init(data);
  initScrolly('act-detective', (step) => detective.onStep(step));

  // Act 4: Trajectory — progressive line reveal
  trajectory.init(data);
  initScrolly('act-trajectory', (step) => trajectory.onStep(step));

  // Act 5: 3D Explorer — lazy init when visible
  const explorerObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      explorer.init(data);
      explorerObserver.disconnect();
    }
  }, { threshold: 0.1 });
  explorerObserver.observe(document.getElementById('act-explorer'));
}

main().catch(err => console.error('Init failed:', err));
