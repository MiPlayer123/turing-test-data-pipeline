import * as d3 from 'd3';
import { CONDITIONS, CONDITION_COLOR } from '../data/constants.js';
import { createFilterChips } from '../components/filterChips.js';
import * as tooltip from '../components/tooltip.js';

export function init(data) {
  const container = document.getElementById('trajectory-viz');
  container.innerHTML = '';
  container.style.textAlign = 'center';

  // Filter chips above chart
  const chipsDiv = document.createElement('div');
  chipsDiv.className = 'filter-chips';
  chipsDiv.style.maxWidth = '900px';
  chipsDiv.style.margin = '0 auto 16px';
  container.appendChild(chipsDiv);

  // Chart wrapper for centering
  const chartDiv = document.createElement('div');
  chartDiv.style.display = 'inline-block';
  container.appendChild(chartDiv);

  // Compute per-condition, per-turn averages
  const conditionData = CONDITIONS.map(cond => {
    const condRows = data.turnMetrics.filter(d => d.condition === cond.key);
    const byTurn = d3.group(condRows, d => d.turn_number);
    const points = [];
    for (const [turn, rows] of byTurn) {
      points.push({
        turn: +turn,
        mean: d3.mean(rows, r => r.hedging),
        count: rows.length,
      });
    }
    points.sort((a, b) => a.turn - b.turn);
    return { ...cond, points };
  });

  const margin = { top: 24, right: 110, bottom: 50, left: 60 };
  const width = 960 - margin.left - margin.right;
  const height = 420 - margin.top - margin.bottom;

  const svg = d3.select(chartDiv).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([2, 20]).range([0, width]);
  const allMeans = conditionData.flatMap(c => c.points.map(p => p.mean));
  const y = d3.scaleLinear().domain([0, d3.max(allMeans) * 1.15]).range([height, 0]);

  // Grid
  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(18).tickSize(-height).tickFormat(d => d))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#21262D'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '11px').attr('font-family', 'JetBrains Mono, monospace'));

  svg.append('g')
    .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(d3.format('.2f')))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#21262D'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '11px').attr('font-family', 'JetBrains Mono, monospace'));

  // Axis labels
  svg.append('text').attr('x', width / 2).attr('y', height + 40)
    .attr('text-anchor', 'middle').attr('fill', '#8B949E').attr('font-size', '13px')
    .attr('font-family', 'Inter, sans-serif')
    .text('Turn Number');
  svg.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -44)
    .attr('text-anchor', 'middle').attr('fill', '#8B949E').attr('font-size', '13px')
    .attr('font-family', 'Inter, sans-serif')
    .text('Hedging Frequency (per 100 words)');

  // Lines + dots
  const line = d3.line().x(d => x(d.turn)).y(d => y(d.mean)).curve(d3.curveMonotoneX);
  const groups = {};

  conditionData.forEach(cond => {
    if (cond.points.length < 2) return;
    const g = svg.append('g').attr('class', `cond-${cond.key}`);
    groups[cond.key] = g;

    const path = g.append('path')
      .datum(cond.points).attr('fill', 'none')
      .attr('stroke', cond.color).attr('stroke-width', 2.5).attr('d', line);

    const totalLength = path.node().getTotalLength();
    path.attr('stroke-dasharray', totalLength).attr('stroke-dashoffset', totalLength)
      .transition().duration(1500).ease(d3.easeQuadOut).attr('stroke-dashoffset', 0);

    g.selectAll('circle').data(cond.points).join('circle')
      .attr('cx', d => x(d.turn)).attr('cy', d => y(d.mean))
      .attr('r', 0).attr('fill', cond.color).attr('stroke', '#0D1117').attr('stroke-width', 1.5)
      .on('mouseover', (event, d) => {
        tooltip.show(`<strong>${cond.label}</strong> — Turn ${d.turn}<br>Hedging: <span class="val">${d.mean.toFixed(3)}</span><br>n = ${d.count}`, event);
      })
      .on('mousemove', e => tooltip.move(e))
      .on('mouseout', () => tooltip.hide())
      .transition().duration(500).delay((d, i) => 800 + i * 40).attr('r', 3.5);

    // End label
    const pts = cond.points;
    if (pts.length >= 2) {
      const last = pts[pts.length - 1];
      g.append('text')
        .attr('x', x(last.turn) + 8).attr('y', y(last.mean) + 4)
        .attr('fill', cond.color).attr('font-size', '11px').attr('font-weight', '600')
        .attr('font-family', 'Inter, sans-serif')
        .attr('opacity', 0).text(cond.label.replace('AI ', ''))
        .transition().duration(500).delay(1800).attr('opacity', 0.85);
    }
  });

  // Key annotation: arrow pointing to Reverse Turing's upward trend
  const rtData = conditionData.find(c => c.key === 'ai_ai_reverse_turing');
  if (rtData && rtData.points.length >= 4) {
    const earlyAvg = d3.mean(rtData.points.slice(0, 3), p => p.mean);
    const lateAvg = d3.mean(rtData.points.slice(-3), p => p.mean);
    const midPt = rtData.points[Math.floor(rtData.points.length / 2)];

    const annotG = svg.append('g').attr('opacity', 0);

    // Annotation box
    const boxX = x(midPt.turn) - 100;
    const boxY = y(lateAvg) - 60;

    annotG.append('rect')
      .attr('x', boxX).attr('y', boxY)
      .attr('width', 200).attr('height', 40)
      .attr('rx', 6).attr('fill', 'rgba(13,17,23,0.9)')
      .attr('stroke', '#F39C12').attr('stroke-width', 1);

    annotG.append('text')
      .attr('x', boxX + 100).attr('y', boxY + 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#F39C12').attr('font-size', '12px').attr('font-weight', '700')
      .attr('font-family', 'Inter, sans-serif')
      .text('Only condition that rises');

    annotG.append('text')
      .attr('x', boxX + 100).attr('y', boxY + 32)
      .attr('text-anchor', 'middle')
      .attr('fill', '#8B949E').attr('font-size', '11px')
      .attr('font-family', 'Inter, sans-serif')
      .text(`+${(lateAvg - earlyAvg).toFixed(2)} hedging over time`);

    // Arrow from box to line
    annotG.append('line')
      .attr('x1', boxX + 100).attr('y1', boxY + 40)
      .attr('x2', x(midPt.turn)).attr('y2', y(midPt.mean) - 4)
      .attr('stroke', '#F39C12').attr('stroke-width', 1).attr('stroke-dasharray', '4,3');

    annotG.transition().duration(600).delay(2200).attr('opacity', 1);
  }

  // Filter chips
  createFilterChips(chipsDiv, {
    onToggle(active) {
      Object.entries(groups).forEach(([key, g]) => {
        g.transition().duration(300).attr('opacity', active.has(key) ? 1 : 0.06);
      });
    },
  });
}
