import * as d3 from 'd3';
import { MODEL_COLORS, MODEL_LABELS } from '../data/constants.js';
import * as tooltip from '../components/tooltip.js';

let svg, stats, x, y, width, height;
let currentStep = -1;
const revealed = new Set();

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
  stats.sort((a, b) => b.accuracy - a.accuracy);

  const wrapper = document.createElement('div');
  wrapper.style.display = 'inline-block';
  container.appendChild(wrapper);

  const margin = { top: 32, right: 80, bottom: 36, left: 170 };
  width = 600 - margin.left - margin.right;
  height = 280 - margin.top - margin.bottom;

  svg = d3.select(wrapper).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  y = d3.scaleBand().domain(stats.map(d => d.model)).range([0, height]).padding(0.3);
  x = d3.scaleLinear().domain([0, 105]).range([0, width]);

  svg.selectAll('.y-label').data(stats).join('text')
    .attr('x', -10).attr('y', d => y(d.model) + y.bandwidth() / 2)
    .attr('dy', '0.35em').attr('text-anchor', 'end')
    .attr('fill', '#8B949E').attr('font-size', '13px').attr('font-family', 'Inter, sans-serif')
    .text(d => `${d.label} (n=${d.n})`);

  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + '%').tickSize(-height))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#1a1f27'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '11px').attr('font-family', 'JetBrains Mono, monospace'));

  // 50% marker — shown later via onStep
  svg.append('text').attr('class', 'fifty-label').attr('x', x(50)).attr('y', height + 28).attr('text-anchor', 'middle')
    .attr('fill', '#484F58').attr('font-size', '11px').attr('font-family', 'JetBrains Mono, monospace')
    .text('50%').attr('opacity', 0);
  svg.append('rect').attr('class', 'fifty-shade').attr('x', 0).attr('y', 0).attr('width', x(50)).attr('height', height)
    .attr('fill', '#E74C3C').attr('opacity', 0);

  // Empty bars
  svg.selectAll('.bar').data(stats).join('rect').attr('class', 'bar')
    .attr('y', d => y(d.model)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 4).attr('opacity', 0.15);

  svg.selectAll('.val-label').data(stats).join('text').attr('class', 'val-label')
    .attr('y', d => y(d.model) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('fill', '#f0f3f6').attr('font-size', '14px').attr('font-weight', '700')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('x', 8).attr('opacity', 0).text(d => `${d.accuracy.toFixed(0)}%`);
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;
  svg.selectAll('.annotation').remove();

  if (step === 0) {
    revealed.clear();
    svg.selectAll('.bar').transition().duration(400).attr('width', 0).attr('opacity', 0.15);
    svg.selectAll('.val-label').transition().duration(200).attr('opacity', 0);
  } else if (step === 1) {
    revealModels(['gpt-5.4', 'gpt-5.4-mini', 'gemini-2.5-flash']);
  } else if (step === 2) {
    revealModels(['gpt-5.4', 'gpt-5.4-mini', 'gemini-2.5-flash', 'grok-4-1-fast', 'claude-sonnet-4']);
    // Show 50% marker now that all bars are in
    svg.select('.fifty-label').transition().duration(400).attr('opacity', 1);
    svg.select('.fifty-shade').transition().duration(400).attr('opacity', 0.03);
    // Annotation on Claude
    const claudeRow = stats.find(d => d.model === 'claude-sonnet-4');
    if (claudeRow) {
      const g = svg.append('g').attr('class', 'annotation').attr('opacity', 0);
      const barEnd = x(claudeRow.accuracy);
      const barY = y(claudeRow.model) + y.bandwidth() / 2;
      g.append('text').attr('x', barEnd + 68).attr('y', barY - 2)
        .attr('fill', '#F39C12').attr('font-size', '13px').attr('font-weight', '700')
        .attr('font-family', 'Inter, sans-serif').attr('text-anchor', 'start')
        .text('Coin flip');
      g.append('line').attr('x1', barEnd + 60).attr('y1', barY)
        .attr('x2', barEnd + 10).attr('y2', barY)
        .attr('stroke', '#F39C12').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,3');
      g.transition().duration(500).delay(500).attr('opacity', 1);
    }
  }
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
