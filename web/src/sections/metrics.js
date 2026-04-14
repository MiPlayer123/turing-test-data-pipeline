import * as d3 from 'd3';
import { CONDITIONS, CONDITION_COLOR, METRICS } from '../data/constants.js';
import * as tooltip from '../components/tooltip.js';

export function init(data) {
  const container = document.getElementById('metric-cards');
  const grouped = d3.group(data.conversations, d => d.condition);
  const cards = [];

  METRICS.forEach(metric => {
    const stats = CONDITIONS.map(c => {
      const rows = grouped.get(c.key) || [];
      return {
        condition: c.key, label: c.label, color: c.color, n: rows.length,
        value: d3.mean(rows, r => r[metric.key]),
      };
    });

    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">${metric.label}</span>
        <span class="card-expand">+</span>
      </div>
      <div class="card-description">${metric.description}</div>
      <div class="card-chart"></div>
    `;

    const chartDiv = card.querySelector('.card-chart');
    let chartBuilt = false;

    const cardState = { card, chartDiv, expanded: false, metric, stats, chartBuilt: false };
    cards.push(cardState);

    card.addEventListener('click', (e) => {
      e.stopPropagation();

      // Close all other cards
      cards.forEach(c => {
        if (c !== cardState && c.expanded) {
          c.expanded = false;
          c.card.querySelector('.card-expand').textContent = '+';
          c.chartDiv.style.maxHeight = '0';
        }
      });

      // Toggle this card
      cardState.expanded = !cardState.expanded;
      card.querySelector('.card-expand').textContent = cardState.expanded ? '\u2212' : '+';

      if (cardState.expanded) {
        if (!cardState.chartBuilt) {
          buildBarChart(chartDiv, stats, metric);
          cardState.chartBuilt = true;
        }
        chartDiv.style.maxHeight = '300px';
      } else {
        chartDiv.style.maxHeight = '0';
      }
    });

    container.appendChild(card);
  });
}

function buildBarChart(container, stats, metric) {
  const margin = { top: 8, right: 45, bottom: 20, left: 100 };
  const width = 270 - margin.left - margin.right;
  const height = 250 - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .style('margin-top', '8px')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const maxVal = d3.max(stats, d => d.value) * 1.15;
  const y = d3.scaleBand().domain(stats.map(d => d.condition)).range([0, height]).padding(0.25);
  const x = d3.scaleLinear().domain([0, maxVal]).range([0, width]);

  svg.selectAll('.y-label').data(stats).join('text')
    .attr('x', -8).attr('y', d => y(d.condition) + y.bandwidth() / 2)
    .attr('dy', '0.35em').attr('text-anchor', 'end')
    .attr('fill', '#c9d1d9').attr('font-size', '12px').attr('font-family', 'Inter, sans-serif')
    .text(d => `${d.label} (n=${d.n})`);

  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(4).tickSize(-height).tickFormat(d3.format('.3f')))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#21262D'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

  svg.selectAll('.bar').data(stats).join('rect')
    .attr('y', d => y(d.condition)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 3)
    .on('mouseover', (event, d) => tooltip.show(`<strong>${d.label}</strong><br>${metric.label}: <span class="val">${d.value.toFixed(4)}</span><br>n = ${d.n}`, event))
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', () => tooltip.hide())
    .transition().duration(500).delay((d, i) => i * 50)
    .attr('width', d => x(d.value));

  svg.selectAll('.val-label').data(stats).join('text')
    .attr('y', d => y(d.condition) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('fill', '#d0d7de').attr('font-size', '12px').attr('font-weight', '600')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('x', 0).attr('opacity', 0).text(d => d.value.toFixed(3))
    .transition().duration(500).delay((d, i) => i * 50)
    .attr('x', d => x(d.value) + 6).attr('opacity', 1);
}
