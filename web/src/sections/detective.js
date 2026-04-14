import * as d3 from 'd3';
import { CONDITIONS, CONDITION_COLOR, CONDITION_LABEL, MODEL_COLORS, MODEL_LABELS } from '../data/constants.js';
import * as tooltip from '../components/tooltip.js';

let svg, stats, x, y, width, height, margin;
let currentStep = -1;

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
  stats.sort((a, b) => b.accuracy - a.accuracy); // Highest first for progressive reveal

  margin = { top: 32, right: 80, bottom: 36, left: 170 };
  width = 620 - margin.left - margin.right;
  height = 300 - margin.top - margin.bottom;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'inline-block';
  container.appendChild(wrapper);

  svg = d3.select(wrapper).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  y = d3.scaleBand().domain(stats.map(d => d.model)).range([0, height]).padding(0.3);
  x = d3.scaleLinear().domain([0, 105]).range([0, width]);

  // Y labels
  svg.selectAll('.y-label').data(stats).join('text')
    .attr('x', -10).attr('y', d => y(d.model) + y.bandwidth() / 2)
    .attr('dy', '0.35em').attr('text-anchor', 'end')
    .attr('fill', '#8B949E').attr('font-size', '13px').attr('font-family', 'Inter, sans-serif')
    .text(d => `${d.label} (n=${d.n})`);

  // X axis
  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + '%').tickSize(-height))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#21262D'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '11px').attr('font-family', 'JetBrains Mono, monospace'));

  // 50% chance line (always visible)
  svg.append('line').attr('x1', x(50)).attr('x2', x(50)).attr('y1', -10).attr('y2', height)
    .attr('stroke', '#E74C3C').attr('stroke-width', 1.5).attr('stroke-dasharray', '6,4').attr('opacity', 0.6);
  svg.append('text').attr('x', x(50)).attr('y', -16).attr('text-anchor', 'middle')
    .attr('fill', '#E74C3C').attr('font-size', '11px').attr('font-family', 'Inter, sans-serif')
    .text('random chance');

  // Create empty bars (will fill on scroll)
  svg.selectAll('.bar').data(stats).join('rect')
    .attr('class', 'bar')
    .attr('y', d => y(d.model)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 4)
    .attr('opacity', 0.15);

  // Value labels (hidden initially)
  svg.selectAll('.val-label').data(stats).join('text')
    .attr('class', 'val-label')
    .attr('y', d => y(d.model) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('fill', '#f0f3f6').attr('font-size', '14px').attr('font-weight', '700')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('x', 8).attr('opacity', 0).text(d => `${d.accuracy.toFixed(0)}%`);
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;

  if (step === 0) {
    // Show all bars dimmed
    svg.selectAll('.bar').transition().duration(400).attr('width', 0).attr('opacity', 0.15);
    svg.selectAll('.val-label').transition().duration(200).attr('opacity', 0);
    svg.selectAll('.annotation').remove();
  } else if (step === 1) {
    // Reveal GPT-5.4 (highest accuracy)
    revealModel('gpt-5.4');
  } else if (step === 2) {
    // Reveal Claude (lowest accuracy) + annotation
    revealModel('claude-sonnet-4');
    addClaudeAnnotation();
  } else if (step === 3) {
    // Reveal all remaining
    revealAll();
  }
}

function revealModel(modelKey) {
  svg.selectAll('.bar')
    .transition().duration(500)
    .attr('width', d => d.model === modelKey ? x(d.accuracy) : (isRevealed(d.model) ? x(d.accuracy) : 0))
    .attr('opacity', d => d.model === modelKey || isRevealed(d.model) ? 1 : 0.15);

  svg.selectAll('.val-label')
    .transition().duration(500)
    .attr('x', d => d.model === modelKey || isRevealed(d.model) ? x(d.accuracy) + 8 : 8)
    .attr('opacity', d => d.model === modelKey || isRevealed(d.model) ? 1 : 0);

  revealed.add(modelKey);
}

const revealed = new Set();
function isRevealed(model) { return revealed.has(model); }

function revealAll() {
  svg.selectAll('.bar')
    .transition().duration(600).delay((d, i) => i * 60)
    .attr('width', d => x(d.accuracy)).attr('opacity', 1);
  svg.selectAll('.val-label')
    .transition().duration(600).delay((d, i) => i * 60)
    .attr('x', d => x(d.accuracy) + 8).attr('opacity', 1);
  stats.forEach(s => revealed.add(s.model));
}

function addClaudeAnnotation() {
  svg.selectAll('.annotation').remove();
  const claudeRow = stats.find(d => d.model === 'claude-sonnet-4');
  if (!claudeRow) return;

  const g = svg.append('g').attr('class', 'annotation').attr('opacity', 0);
  const barEnd = x(claudeRow.accuracy);
  const barY = y(claudeRow.model) + y.bandwidth() / 2;

  // Arrow
  g.append('path')
    .attr('d', `M ${barEnd + 70} ${barY - 30} Q ${barEnd + 40} ${barY - 10} ${barEnd + 12} ${barY}`)
    .attr('fill', 'none').attr('stroke', '#F39C12').attr('stroke-width', 1.5)
    .attr('marker-end', 'none');

  g.append('text')
    .attr('x', barEnd + 72).attr('y', barY - 34)
    .attr('fill', '#F39C12').attr('font-size', '13px').attr('font-weight', '600')
    .attr('font-family', 'Inter, sans-serif')
    .text('Coin flip');

  g.transition().duration(500).delay(300).attr('opacity', 1);
}
