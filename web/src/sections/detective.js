import * as d3 from 'd3';
import { CONDITIONS, CONDITION_COLOR, CONDITION_LABEL, MODEL_COLORS, MODEL_LABELS } from '../data/constants.js';
import * as tooltip from '../components/tooltip.js';

export function init(data) {
  const container = document.getElementById('detective-viz');
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; gap:48px; justify-content:center; flex-wrap:wrap; max-width:1100px; margin:0 auto;';
  container.appendChild(wrapper);

  buildAccuracyChart(wrapper, data);
  buildHedgingChart(wrapper, data);
}

function buildAccuracyChart(wrapper, data) {
  const detective = data.conversations.filter(d => d.condition === 'ai_ai_detective');
  const byModel = d3.group(detective, d => d.model_a);
  let stats = [];
  for (const [model, rows] of byModel) {
    const correct = rows.filter(r => r.detective_correct_bool).length;
    stats.push({
      model, label: MODEL_LABELS[model] || model, color: MODEL_COLORS[model] || '#888',
      accuracy: (correct / rows.length) * 100, n: rows.length,
    });
  }
  stats.sort((a, b) => a.accuracy - b.accuracy);

  const div = document.createElement('div');
  div.style.cssText = 'flex:1; min-width:440px;';
  div.innerHTML = '<div style="font-family:Inter,sans-serif;font-size:16px;font-weight:600;margin-bottom:4px;color:#d0d7de;">Detection Accuracy</div><div style="font-family:Inter,sans-serif;font-size:13px;color:#8B949E;margin-bottom:20px;">% correct identifications by interrogator model</div>';
  wrapper.appendChild(div);

  const margin = { top: 28, right: 70, bottom: 32, left: 160 };
  const width = 520 - margin.left - margin.right;
  const height = 280 - margin.top - margin.bottom;

  const svg = d3.select(div).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const y = d3.scaleBand().domain(stats.map(d => d.model)).range([0, height]).padding(0.3);
  const x = d3.scaleLinear().domain([0, 105]).range([0, width]);

  svg.selectAll('.y-label').data(stats).join('text')
    .attr('x', -10).attr('y', d => y(d.model) + y.bandwidth() / 2)
    .attr('dy', '0.35em').attr('text-anchor', 'end')
    .attr('fill', '#c9d1d9').attr('font-size', '13px').attr('font-family', 'Inter, sans-serif')
    .text(d => `${d.label} (n=${d.n})`);

  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + '%').tickSize(-height))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#21262D'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '11px').attr('font-family', 'JetBrains Mono, monospace'));

  // 50% chance line
  svg.append('line').attr('x1', x(50)).attr('x2', x(50)).attr('y1', -10).attr('y2', height)
    .attr('stroke', '#E74C3C').attr('stroke-width', 1.5).attr('stroke-dasharray', '6,4');
  svg.append('text').attr('x', x(50)).attr('y', -16).attr('text-anchor', 'middle')
    .attr('fill', '#E74C3C').attr('font-size', '11px').attr('font-weight', '600').attr('font-family', 'Inter, sans-serif')
    .text('random chance');

  // Bars
  svg.selectAll('.bar').data(stats).join('rect')
    .attr('y', d => y(d.model)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 4)
    .on('mouseover', (event, d) => tooltip.show(`<strong>${d.label}</strong><br>Accuracy: <span class="val">${d.accuracy.toFixed(0)}%</span><br>n = ${d.n}`, event))
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', () => tooltip.hide())
    .transition().duration(800).delay((d, i) => i * 80)
    .attr('width', d => x(d.accuracy));

  // Value labels
  svg.selectAll('.val-label').data(stats).join('text')
    .attr('y', d => y(d.model) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('fill', '#f0f3f6').attr('font-size', '14px').attr('font-weight', '700')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('x', 0).attr('opacity', 0).text(d => `${d.accuracy.toFixed(0)}%`)
    .transition().duration(800).delay((d, i) => i * 80)
    .attr('x', d => x(d.accuracy) + 8).attr('opacity', 1);

  // Annotation arrow pointing to Claude's bar
  const claudeRow = stats.find(d => d.model === 'claude-sonnet-4');
  if (claudeRow) {
    const annotG = svg.append('g').attr('opacity', 0);

    // Arrow line
    const barEnd = x(claudeRow.accuracy);
    const arrowStartX = barEnd + 60;
    const arrowStartY = y(claudeRow.model) - 8;
    const arrowEndX = barEnd + 10;
    const arrowEndY = y(claudeRow.model) + y.bandwidth() / 2;

    annotG.append('line')
      .attr('x1', arrowStartX).attr('y1', arrowStartY)
      .attr('x2', arrowEndX).attr('y2', arrowEndY)
      .attr('stroke', '#F39C12').attr('stroke-width', 1.5);

    // Arrowhead
    annotG.append('polygon')
      .attr('points', `${arrowEndX},${arrowEndY} ${arrowEndX+6},${arrowEndY-4} ${arrowEndX+6},${arrowEndY+4}`)
      .attr('fill', '#F39C12');

    // Annotation text
    annotG.append('text')
      .attr('x', arrowStartX + 4).attr('y', arrowStartY - 4)
      .attr('fill', '#F39C12').attr('font-size', '12px').attr('font-weight', '600')
      .attr('font-family', 'Inter, sans-serif')
      .text('Trusted the hedging');

    annotG.transition().duration(600).delay(1200).attr('opacity', 1);
  }
}

function buildHedgingChart(wrapper, data) {
  const byCondition = d3.group(data.conversations, d => d.condition);
  let stats = [];
  for (const [cond, rows] of byCondition) {
    stats.push({
      condition: cond, label: CONDITION_LABEL[cond] || cond,
      color: CONDITION_COLOR[cond] || '#888',
      hedging: d3.mean(rows, r => r.hedging), n: rows.length,
    });
  }
  stats.sort((a, b) => a.hedging - b.hedging);

  const structuredVal = stats.find(d => d.condition === 'ai_ai_structured')?.hedging || 1;
  const reverseVal = stats.find(d => d.condition === 'ai_ai_reverse_turing')?.hedging || 1;
  const pctIncrease = ((reverseVal - structuredVal) / structuredVal * 100).toFixed(0);

  const div = document.createElement('div');
  div.style.cssText = 'flex:1; min-width:440px;';
  div.innerHTML = `<div style="font-family:Inter,sans-serif;font-size:16px;font-weight:600;margin-bottom:4px;color:#d0d7de;">Hedging Frequency</div><div style="font-family:Inter,sans-serif;font-size:13px;color:#8B949E;margin-bottom:20px;">Uncertainty words per 100 words — the "trying too hard" signal</div>`;
  wrapper.appendChild(div);

  const margin = { top: 28, right: 100, bottom: 32, left: 140 };
  const width = 520 - margin.left - margin.right;
  const height = 340 - margin.top - margin.bottom;

  const svg = d3.select(div).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const maxVal = d3.max(stats, d => d.hedging) * 1.2;
  const y = d3.scaleBand().domain(stats.map(d => d.condition)).range([0, height]).padding(0.3);
  const x = d3.scaleLinear().domain([0, maxVal]).range([0, width]);

  svg.selectAll('.y-label').data(stats).join('text')
    .attr('x', -10).attr('y', d => y(d.condition) + y.bandwidth() / 2)
    .attr('dy', '0.35em').attr('text-anchor', 'end')
    .attr('fill', '#c9d1d9').attr('font-size', '13px').attr('font-family', 'Inter, sans-serif')
    .text(d => `${d.label} (n=${d.n})`);

  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('.2f')).tickSize(-height))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#21262D'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '11px').attr('font-family', 'JetBrains Mono, monospace'));

  svg.selectAll('.bar').data(stats).join('rect')
    .attr('y', d => y(d.condition)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 4)
    .on('mouseover', (event, d) => tooltip.show(`<strong>${d.label}</strong><br>Hedging: <span class="val">${d.hedging.toFixed(3)}</span><br>n = ${d.n}`, event))
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', () => tooltip.hide())
    .transition().duration(800).delay((d, i) => i * 80)
    .attr('width', d => x(d.hedging));

  svg.selectAll('.val-label').data(stats).join('text')
    .attr('y', d => y(d.condition) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('fill', '#f0f3f6').attr('font-size', '13px').attr('font-weight', '700')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('x', 0).attr('opacity', 0).text(d => d.hedging.toFixed(3))
    .transition().duration(800).delay((d, i) => i * 80)
    .attr('x', d => x(d.hedging) + 8).attr('opacity', 1);

  // Annotation on Reverse Turing with arrow
  const rtRow = stats.find(d => d.condition === 'ai_ai_reverse_turing');
  if (rtRow) {
    const annotG = svg.append('g').attr('opacity', 0);

    annotG.append('text')
      .attr('x', x(rtRow.hedging) + 8).attr('y', y(rtRow.condition) + y.bandwidth() / 2 + 22)
      .attr('fill', '#F39C12').attr('font-size', '12px').attr('font-weight', '700')
      .attr('font-family', 'Inter, sans-serif')
      .text(`+${pctIncrease}% vs Structured`);

    // Small arrow pointing up to the bar
    const arrowX = x(rtRow.hedging) + 12;
    const arrowBot = y(rtRow.condition) + y.bandwidth() / 2 + 12;
    const arrowTop = y(rtRow.condition) + y.bandwidth();
    annotG.append('line')
      .attr('x1', arrowX).attr('y1', arrowBot)
      .attr('x2', arrowX).attr('y2', arrowTop)
      .attr('stroke', '#F39C12').attr('stroke-width', 1);

    annotG.transition().duration(600).delay(1400).attr('opacity', 1);
  }

  // Annotation on Human-AI (lowest hedging)
  const haiRow = stats.find(d => d.condition === 'human_ai');
  if (haiRow) {
    svg.append('text')
      .attr('x', x(haiRow.hedging) + 50).attr('y', y(haiRow.condition) + y.bandwidth() / 2 + 1)
      .attr('fill', '#8B949E').attr('font-size', '11px').attr('font-style', 'italic')
      .attr('font-family', 'Inter, sans-serif')
      .attr('opacity', 0)
      .text('most direct')
      .transition().duration(600).delay(1600).attr('opacity', 0.7);
  }
}
