import './styles/base.css';
import './styles/sections.css';
import './styles/components.css';

import { loadData } from './data/loader.js';
import * as hero from './sections/hero.js';
import * as metrics from './sections/metrics.js';
import * as detective from './sections/detective.js';
import * as trajectory from './sections/trajectory.js';
import * as explorer from './sections/explorer.js';
import * as guess from './sections/guess.js';

async function main() {
  hero.init();

  // Fade-in observer for pull quotes and other elements
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

  // Load data
  const data = await loadData();
  console.log(`Loaded ${data.conversations.length} conversations, ${data.turnMetrics.length} turn metrics`);

  // Initialize sections
  metrics.init(data);
  detective.init(data);
  trajectory.init(data);
  explorer.init(data);
  guess.init();
}

main().catch(err => {
  console.error('Failed to initialize:', err);
});
