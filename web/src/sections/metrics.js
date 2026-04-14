import * as d3 from 'd3';
import { CONDITIONS, CONDITION_COLOR, METRICS } from '../data/constants.js';
import * as tooltip from '../components/tooltip.js';

let svg, x, y, width, height, stats, margin;
let currentStep = -1;

export function init(data) {
  const container = document.getElementById('metrics-viz');
  container.innerHTML = '';

  const grouped = d3.group(data.conversations, d => d.condition);

  // Precompute all stats
  stats = {};
  METRICS.forEach(m => {
    stats[m.key] = CONDITIONS.map(c => {
      const rows = grouped.get(c.key) || [];
      return {
        condition: c.key, label: c.label, color: c.color, n: rows.length,
        value: d3.mean(rows, r => r[m.key]),
      };
    });
  });

  // Build the SVG — starts empty, bars added per step
  margin = { top: 32, right: 60, bottom: 32, left: 150 };
  width = 700 - margin.left - margin.right;
  height = 400 - margin.top - margin.bottom;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';
  container.appendChild(wrapper);

  // Title that changes per step
  const titleDiv = document.createElement('div');
  titleDiv.id = 'metrics-title';
  titleDiv.style.cssText = 'font-family:Inter,sans-serif; font-size:14px; color:#8B949E; margin-bottom:12px; text-align:center; min-height:20px;';
  wrapper.appendChild(titleDiv);

  svg = d3.select(wrapper).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Y scale — always 7 conditions
  y = d3.scaleBand().domain(CONDITIONS.map(c => c.key)).range([0, height]).padding(0.25);

  // Y labels (always visible)
  svg.selectAll('.y-label').data(CONDITIONS).join('text')
    .attr('x', -10).attr('y', d => y(d.key) + y.bandwidth() / 2)
    .attr('dy', '0.35em').attr('text-anchor', 'end')
    .attr('fill', '#8B949E').attr('font-size', '12px').attr('font-family', 'Inter, sans-serif')
    .text(d => d.label);
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;

  const titleEl = document.getElementById('metrics-title');

  if (step === 0) {
    // Clear chart
    svg.selectAll('.bar-group').remove();
    svg.selectAll('.x-axis').remove();
    titleEl.textContent = '';
  } else if (step >= 1 && step <= 3) {
    // Show one metric at a time
    const metricIndex = step - 1;
    const metric = METRICS[metricIndex];
    const metricStats = stats[metric.key];
    showMetric(metricStats, metric);
    titleEl.textContent = `${metric.label} — ${metric.description.split('.')[0]}`;
  } else if (step === 4) {
    // Show all three as small multiples
    showAllMetrics();
    titleEl.textContent = 'All three signals side by side';
  }
}

function showMetric(metricStats, metric) {
  svg.selectAll('.bar-group').remove();
  svg.selectAll('.x-axis').remove();
  svg.selectAll('.small-mult').remove();

  const maxVal = d3.max(metricStats, d => d.value) * 1.2;
  x = d3.scaleLinear().domain([0, maxVal]).range([0, width]);

  // X axis
  svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-height).tickFormat(d3.format('.3f')))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#21262D'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

  const g = svg.append('g').attr('class', 'bar-group');

  // Bars
  g.selectAll('rect').data(metricStats).join('rect')
    .attr('y', d => y(d.condition)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 4)
    .on('mouseover', (event, d) => tooltip.show(`<strong>${d.label}</strong><br>${metric.label}: <span class="val">${d.value.toFixed(4)}</span><br>n = ${d.n}`, event))
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', () => tooltip.hide())
    .transition().duration(600).delay((d, i) => i * 40)
    .attr('width', d => x(d.value));

  // Value labels
  g.selectAll('text').data(metricStats).join('text')
    .attr('y', d => y(d.condition) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('fill', '#d0d7de').attr('font-size', '12px').attr('font-weight', '600')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('x', 0).attr('opacity', 0).text(d => d.value.toFixed(3))
    .transition().duration(600).delay((d, i) => i * 40)
    .attr('x', d => x(d.value) + 8).attr('opacity', 1);
}

function showAllMetrics() {
  svg.selectAll('.bar-group').remove();
  svg.selectAll('.x-axis').remove();

  const panelWidth = (width - 40) / 3;

  METRICS.forEach((metric, mi) => {
    const metricStats = stats[metric.key];
    const offsetX = mi * (panelWidth + 20);
    const maxVal = d3.max(metricStats, d => d.value) * 1.2;
    const xScale = d3.scaleLinear().domain([0, maxVal]).range([0, panelWidth]);

    const g = svg.append('g').attr('class', 'bar-group small-mult')
      .attr('transform', `translate(${offsetX},0)`);

    // Panel title
    g.append('text').attr('x', panelWidth / 2).attr('y', -8)
      .attr('text-anchor', 'middle').attr('fill', '#d0d7de')
      .attr('font-size', '13px').attr('font-weight', '600').attr('font-family', 'Inter, sans-serif')
      .text(metric.label);

    // Bars
    g.selectAll('rect').data(metricStats).join('rect')
      .attr('y', d => y(d.condition)).attr('height', y.bandwidth())
      .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 3)
      .transition().duration(500).delay((d, i) => mi * 100 + i * 30)
      .attr('width', d => xScale(d.value));

    // Value labels
    g.selectAll('.val').data(metricStats).join('text')
      .attr('class', 'val')
      .attr('y', d => y(d.condition) + y.bandwidth() / 2).attr('dy', '0.35em')
      .attr('fill', '#8B949E').attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('x', 0).attr('opacity', 0).text(d => d.value.toFixed(3))
      .transition().duration(500).delay((d, i) => mi * 100 + i * 30)
      .attr('x', d => xScale(d.value) + 4).attr('opacity', 1);
  });
}
