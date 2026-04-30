import * as d3 from 'd3';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as tooltip from '../components/tooltip.js';
import { CONDITIONS } from '../data/constants.js';
import { renderInlineSnippet } from '../components/chatSnippet.js';
import { loadConversation } from '../data/loader.js';

// Scene 4 keeps the chart simple: three rows. The 5 AI-AI variants are averaged into
// one "AI-AI" bar; the subtype breakdown happens in scene 4.5.
const SHORT_LABEL = {
  human_human: 'H-H',
  human_ai:    'H-AI',
  ai_ai:       'AI-AI',
};

const ORDER = ['human_human', 'human_ai', 'ai_ai'];

const AI_AI_KEYS = [
  'ai_ai_detective',
  'ai_ai_freeform',
  'ai_ai_freeform_persona',
  'ai_ai_reverse_turing',
  'ai_ai_structured',
];

const METRICS = [
  { key: 'repetitiveness', label: 'Repetitiveness' },
  { key: 'hedging',        label: 'Hedging' },
];

let container, data;
let currentStep = -1;
let cachedMeans = null;

export function init(rawData) {
  data = rawData;
  container = document.getElementById('comparison-viz');
  container.innerHTML = '';
  buildChart();
  onStep(0);
}

function computeMeans() {
  if (cachedMeans) return cachedMeans;
  const grouped = d3.group(data.conversations, d => d.condition);
  cachedMeans = {};
  ['human_human', 'human_ai'].forEach(key => {
    const rows = grouped.get(key) || [];
    cachedMeans[key] = {
      hedging:        d3.mean(rows, r => r.hedging) || 0,
      repetitiveness: d3.mean(rows, r => r.repetitiveness) || 0,
      n:              rows.length,
    };
  });
  // ai_ai: combined mean across all 5 AI-AI conditions
  const aiRows = AI_AI_KEYS.flatMap(k => grouped.get(k) || []);
  cachedMeans.ai_ai = {
    hedging:        d3.mean(aiRows, r => r.hedging) || 0,
    repetitiveness: d3.mean(aiRows, r => r.repetitiveness) || 0,
    n:              aiRows.length,
  };
  return cachedMeans;
}

function buildChart() {
  const means = computeMeans();

  const shell = document.createElement('div');
  shell.className = 'cmp-shell';
  shell.innerHTML = `
    <div class="cmp-title">Hedging and repetitiveness</div>
    <div class="cmp-sub">Human–Human, Human–AI, and AI–AI — dataset means</div>
    <div class="cmp-charts"></div>
  `;
  container.appendChild(shell);

  const chartsEl = shell.querySelector('.cmp-charts');

  METRICS.forEach(metric => {
    const col = document.createElement('div');
    col.className = 'cmp-col';
    col.dataset.metric = metric.key;
    col.innerHTML = `<h4 class="cmp-col-title">${metric.label}</h4>`;
    chartsEl.appendChild(col);

    const rowsWrap = document.createElement('div');
    rowsWrap.className = 'cmp-rows';
    col.appendChild(rowsWrap);

    // Normalize bar widths using max across all conditions for this metric
    const maxVal = d3.max(ORDER, k => means[k][metric.key]) || 1;

    ORDER.forEach(key => {
      const row = document.createElement('div');
      row.className = 'cmp-row';
      row.dataset.cond = key;
      row.dataset.metric = metric.key;
      const val = means[key][metric.key];
      const pct = (val / maxVal) * 100;
      row.innerHTML = `
        <span class="cmp-row-label">${SHORT_LABEL[key]}</span>
        <div class="cmp-row-track">
          <div class="cmp-row-fill" data-target="${pct.toFixed(2)}"></div>
        </div>
        <span class="cmp-row-val">${val.toFixed(3)}</span>
      `;
      rowsWrap.appendChild(row);

      row.addEventListener('mouseenter', (e) => {
        const cond = CONDITIONS.find(c => c.key === key);
        tooltip.show(
          `<strong>${cond?.label || key}</strong><br>${metric.label}: <span class="val">${val.toFixed(4)}</span><br>n = ${means[key].n}`,
          e
        );
        showBarSnippet(key, e);
      });
      row.addEventListener('mousemove', e => { tooltip.move(e); moveBarSnippet(e); });
      row.addEventListener('mouseleave', () => { tooltip.hide(); hideBarSnippet(); });
    });
  });
}

function buildLegend() {
  const legendEl = container.querySelector('#cmp-legend');
  if (!legendEl) return;
  legendEl.innerHTML = '';
  CONDITIONS.forEach(c => {
    const chip = document.createElement('span');
    chip.className = 'cmp-legend-chip';
    chip.dataset.cond = c.key;
    chip.innerHTML = `<span class="cmp-legend-dot" style="background:${c.color}"></span><span class="cmp-legend-label">${c.label}</span>`;
    legendEl.appendChild(chip);
  });
}

function barFillEl(metric, cond) {
  return container.querySelector(`.cmp-row[data-metric="${metric}"][data-cond="${cond}"] .cmp-row-fill`);
}

function rowEl(metric, cond) {
  return container.querySelector(`.cmp-row[data-metric="${metric}"][data-cond="${cond}"]`);
}

function setMetricVisible(metric, visible) {
  const col = container.querySelector(`.cmp-col[data-metric="${metric}"]`);
  if (!col) return;
  col.classList.toggle('is-hidden', !visible);
}

function setVisible(cond, visible, visibleMetrics) {
  METRICS.forEach(m => {
    const row = rowEl(m.key, cond);
    if (!row) return;
    const shouldShow = visible && visibleMetrics.has(m.key);
    row.classList.toggle('is-hidden', !shouldShow);
    const fill = row.querySelector('.cmp-row-fill');
    if (shouldShow) {
      gsap.to(fill, { width: `${fill.dataset.target}%`, duration: 0.7, ease: 'power2.out' });
    } else {
      gsap.set(fill, { width: '0%' });
    }
  });
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;
  container.style.opacity = '1';

  // Which conditions should be visible at each step
  const visibleByStep = {
    0: ORDER,
    1: ORDER,
    2: ORDER,
    3: ORDER,
    4: ORDER,
    5: ORDER,
  };
  const metricsByStep = {
    0: ['repetitiveness'],
    1: METRICS.map(m => m.key),
    2: METRICS.map(m => m.key),
    3: METRICS.map(m => m.key),
    4: METRICS.map(m => m.key),
    5: METRICS.map(m => m.key),
  };

  const visible = new Set(visibleByStep[step] || ORDER);
  const visibleMetrics = new Set(metricsByStep[step] || METRICS.map(m => m.key));
  METRICS.forEach(metric => setMetricVisible(metric.key, visibleMetrics.has(metric.key)));
  ORDER.forEach(cond => setVisible(cond, visible.has(cond), visibleMetrics));

  // Box outline around the AI-AI row appears on the final explanatory beat.
  const aiAiRows = container.querySelectorAll('.cmp-row[data-cond="ai_ai"]');
  aiAiRows.forEach(r => r.classList.toggle('is-boxed', step >= 5));
}

// ----- Inline transcript snippet on bar hover -----
// The aggregated bars don't map to one conversation, so pick a representative
// one for each bucket and cache by key.
let activeSnippet = null;
const snippetCache = new Map();    // bar-key -> loaded conversation
const snippetLoading = new Set();  // bar-keys currently loading

function pickRepresentativeId(barKey) {
  if (!data || !data.conversations) return null;
  const matchesAiAi = (c) => AI_AI_KEYS.includes(c.condition);
  let row;
  if (barKey === 'ai_ai') row = data.conversations.find(matchesAiAi);
  else                    row = data.conversations.find(c => c.condition === barKey);
  return row?.conversation_id || null;
}

function showBarSnippet(barKey, event) {
  const cached = snippetCache.get(barKey);
  if (cached) {
    renderActiveSnippet(cached, event);
    return;
  }
  if (snippetLoading.has(barKey)) return;
  const id = pickRepresentativeId(barKey);
  if (!id) return;
  snippetLoading.add(barKey);
  loadConversation(id)
    .then(conv => {
      snippetCache.set(barKey, conv);
      // Only render if the user is still hovering this row
      const hovered = container?.querySelector(`.cmp-row[data-cond="${barKey}"]:hover`);
      if (hovered) renderActiveSnippet(conv, event);
    })
    .catch(err => console.warn('chat snippet load failed', id, err))
    .finally(() => snippetLoading.delete(barKey));
}

function renderActiveSnippet(conv, event) {
  hideBarSnippet();
  const el = renderInlineSnippet(conv, { maxTurns: 3 });
  document.body.appendChild(el);
  activeSnippet = el;
  moveBarSnippet(event);
  requestAnimationFrame(() => el.classList.add('visible'));
}

function moveBarSnippet(event) {
  if (!activeSnippet) return;
  const pad = 14;
  const w = activeSnippet.offsetWidth || 280;
  const h = activeSnippet.offsetHeight || 120;
  let left = event.clientX + pad;
  let top  = event.clientY + pad;
  if (left + w + 8 > window.innerWidth)  left = event.clientX - w - pad;
  if (top  + h + 8 > window.innerHeight) top  = event.clientY - h - pad;
  activeSnippet.style.left = `${Math.max(8, left)}px`;
  activeSnippet.style.top  = `${Math.max(8, top)}px`;
}

function hideBarSnippet() {
  if (!activeSnippet) return;
  const el = activeSnippet;
  activeSnippet = null;
  el.remove();
}

// Legacy export kept for animation.js compatibility
export function getAiAiBarPosition() {
  const el = container?.querySelector('.cmp-row[data-cond="ai_ai_reverse_turing"]');
  if (el) return el.getBoundingClientRect();
  return { left: 0, top: 0, width: 0, height: 0 };
}
