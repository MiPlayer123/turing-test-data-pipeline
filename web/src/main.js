import './styles/base.css';
import './styles/sections.css';
import './styles/components.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadData } from './data/loader.js';

gsap.registerPlugin(ScrollTrigger);
import * as quiz from './sections/quiz.js';
import * as comparison from './sections/comparison.js';
import * as subtypes from './sections/subtypes.js';
import * as timeline from './sections/timeline.js';
import * as timelineMorph from './sections/timelineMorph.js';
import * as gridReveal from './sections/gridReveal.js';
import * as detective from './sections/detective.js';
import * as detectiveMorph from './sections/detectiveMorph.js';
import * as cornerDots from './lib/cornerDots.js';
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

async function main() {
  const data = await loadData();
  console.log(`Loaded ${data.conversations.length} conversations`);

  // Default conversation IDs for corner-dot transcript shortcuts.
  // The red dot's id is set later by quiz.js to the actual conversation that was shown.
  cornerDots.setConversationId('yellow',     'conv_human_ai_wildchat_0000');
  cornerDots.setConversationId('freeform',   'conv_ai_ai_freeform_claudesonnet4_gemini25flash_F1_1775427182');
  cornerDots.setConversationId('persona',    'conv_ai_ai_freeform_persona_claudesonnet4_gemini25flash_F2_1775424633');
  cornerDots.setConversationId('detective',  'conv_ai_ai_detective_claudesonnet4_grok41fast_D1_1775424532');
  cornerDots.setConversationId('revturing',  'conv_ai_ai_reverse_turing_claudesonnet4_gpt54mini_F2_1775423379');
  cornerDots.setConversationId('structured', 'conv_ai_ai_structured_claudesonnet4_gemini25flash_S1_1775423896');
  cornerDots.initClickHandlers();

  // S1: Quiz
  quiz.init(data);

  // S4: Comparison bars (H-H / H-AI / AI-AI)
  comparison.init(data);
  initScrolly('s-comparison', (step) => comparison.onStep(step));

  // S4.5: AI-AI subtype breakdown
  subtypes.init(data);

  // S1.5: Grid reveal — red dot lands on 2-D Repetitiveness × Hedging axes.
  // Initialize after subtypes so placeholder subtype plot points are available.
  gridReveal.init();

  // S6: Timeline (Reverse Turing-focused line chart)
  timeline.init(data);
  initScrolly('s-timeline', (step) => timeline.onStep(step));
  timelineMorph.init();

  // S7: Detective — per-model report card
  detective.init(data);
  initScrolly('s-detective', (step) => detective.onStep(step));
  detectiveMorph.init();

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
