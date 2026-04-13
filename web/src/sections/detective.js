import * as d3 from 'd3';
import { CONDITIONS, CONDITION_COLOR, CONDITION_LABEL, MODEL_COLORS, MODEL_LABELS } from '../data/constants.js';
import * as tooltip from '../components/tooltip.js';

export function init(data) {
  const container = document.getElementById('detective-viz');
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; gap:60px; justify-content:center; flex-wrap:wrap; max-width:1300px; margin:0 auto;';
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
  div.style.cssText = 'flex:1; min-width:460px;';
  div.innerHTML = '<div style="font-size:18px;font-weight:600;text-align:center;margin-bottom:4px;color:#C9D1D9;">Detective Accuracy by Interrogator</div><div style="font-size:13px;color:#8B949E;text-align:center;margin-bottom:16px;">% of correct AI detections (27 conversations)</div>';
  wrapper.appendChild(div);

  const margin = { top: 24, right: 80, bottom: 36, left: 180 };
  const width = 560 - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;

  const svg = d3.select(div).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const y = d3.scaleBand().domain(stats.map(d => d.model)).range([0, height]).padding(0.3);
  const x = d3.scaleLinear().domain([0, 105]).range([0, width]);

  svg.selectAll('.y-label').data(stats).join('text')
    .attr('x', -10).attr('y', d => y(d.model) + y.bandwidth() / 2)
    .attr('dy', '0.35em').attr('text-anchor', 'end')
    .attr('fill', '#C9D1D9').attr('font-size', '13px')
    .text(d => `${d.label} (n=${d.n})`);

  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + '%').tickSize(-height))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#21262D'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '11px'));

  // 50% chance line
  svg.append('line').attr('x1', x(50)).attr('x2', x(50)).attr('y1', -10).attr('y2', height)
    .attr('stroke', '#E74C3C').attr('stroke-width', 2).attr('stroke-dasharray', '8,5');
  svg.append('text').attr('x', x(50)).attr('y', -14).attr('text-anchor', 'middle')
    .attr('fill', '#E74C3C').attr('font-size', '11px').attr('font-weight', '600').text('chance (50%)');

  svg.selectAll('.bar').data(stats).join('rect')
    .attr('y', d => y(d.model)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 4)
    .on('mouseover', (event, d) => tooltip.show(`<strong>${d.label}</strong><br>Accuracy: <span class="val">${d.accuracy.toFixed(0)}%</span><br>n = ${d.n}`, event))
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', () => tooltip.hide())
    .transition().duration(800).delay((d, i) => i * 100)
    .attr('width', d => x(d.accuracy));

  svg.selectAll('.val-label').data(stats).join('text')
    .attr('y', d => y(d.model) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('fill', '#E6EDF3').attr('font-size', '14px').attr('font-weight', '700')
    .attr('x', 0).attr('opacity', 0).text(d => `${d.accuracy.toFixed(0)}%`)
    .transition().duration(800).delay((d, i) => i * 100)
    .attr('x', d => x(d.accuracy) + 8).attr('opacity', 1);
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
  div.style.cssText = 'flex:1; min-width:460px;';
  div.innerHTML = `<div style="font-size:18px;font-weight:600;text-align:center;margin-bottom:4px;color:#C9D1D9;">The 'Trying to Sound Human' Effect</div><div style="font-size:13px;color:#8B949E;text-align:center;margin-bottom:16px;">Mean hedging frequency per 100 words</div>`;
  wrapper.appendChild(div);

  const margin = { top: 24, right: 120, bottom: 36, left: 160 };
  const width = 560 - margin.left - margin.right;
  const height = 380 - margin.top - margin.bottom;

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
    .attr('fill', '#C9D1D9').attr('font-size', '13px')
    .text(d => `${d.label} (n=${d.n})`);

  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('.2f')).tickSize(-height))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#21262D'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '11px'));

  svg.selectAll('.bar').data(stats).join('rect')
    .attr('y', d => y(d.condition)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 4)
    .on('mouseover', (event, d) => tooltip.show(`<strong>${d.label}</strong><br>Hedging: <span class="val">${d.hedging.toFixed(4)}</span><br>n = ${d.n}`, event))
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', () => tooltip.hide())
    .transition().duration(800).delay((d, i) => i * 100)
    .attr('width', d => x(d.hedging));

  svg.selectAll('.val-label').data(stats).join('text')
    .attr('y', d => y(d.condition) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('fill', '#E6EDF3').attr('font-size', '13px').attr('font-weight', '700')
    .attr('x', 0).attr('opacity', 0).text(d => d.hedging.toFixed(3))
    .transition().duration(800).delay((d, i) => i * 100)
    .attr('x', d => x(d.hedging) + 8).attr('opacity', 1);

  // Annotation
  const rtRow = stats.find(d => d.condition === 'ai_ai_reverse_turing');
  if (rtRow) {
    svg.append('text')
      .attr('x', x(rtRow.hedging) + 8).attr('y', y(rtRow.condition) + y.bandwidth() / 2 + 20)
      .attr('fill', '#F39C12').attr('font-size', '12px').attr('font-weight', '700')
      .attr('opacity', 0).text(`+${pctIncrease}% vs Structured`)
      .transition().duration(800).delay(600).attr('opacity', 1);
  }
}
