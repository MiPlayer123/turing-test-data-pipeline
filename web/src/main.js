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
  // Show loading state
  hero.init();

  // Load all data
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
  document.getElementById('app').innerHTML += `
    <div style="position:fixed;bottom:20px;left:20px;right:20px;background:#E74C3C;color:white;padding:16px;border-radius:8px;z-index:9999;font-size:14px;">
      Failed to load data: ${err.message}
    </div>
  `;
});
