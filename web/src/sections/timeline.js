import * as d3 from 'd3';
import { CONDITIONS, CONDITION_COLOR } from '../data/constants.js';
import { createFilterChips } from '../components/filterChips.js';
import * as tooltip from '../components/tooltip.js';

let svg, x, yScale, width, height, conditionData, groups;
let currentStep = -1;

export function init(data) {
  const chartContainer = document.getElementById('timeline-chart');
  chartContainer.innerHTML = '';
  chartContainer.style.textAlign = 'center';

  // RT label removed — animation section handles the transition

  conditionData = CONDITIONS.map(cond => {
    const condRows = data.turnMetrics.filter(d => d.condition === cond.key);
    const byTurn = d3.group(condRows, d => d.turn_number);
    const points = [];
    for (const [turn, rows] of byTurn) {
      points.push({ turn: +turn, mean: d3.mean(rows, r => r.hedging), count: rows.length });
    }
    points.sort((a, b) => a.turn - b.turn);
    return { ...cond, points };
  });

  const chartDiv = document.createElement('div');
  chartDiv.style.display = 'inline-block';
  chartContainer.appendChild(chartDiv);

  const margin = { top: 20, right: 120, bottom: 44, left: 60 };
  width = 960 - margin.left - margin.right;
  height = 420 - margin.top - margin.bottom;

  svg = d3.select(chartDiv).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  x = d3.scaleLinear().domain([2, 20]).range([0, width]);
  const allMeans = conditionData.flatMap(c => c.points.map(p => p.mean));
  yScale = d3.scaleLinear().domain([0, d3.max(allMeans) * 1.15]).range([height, 0]);

  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(18).tickSize(-height).tickFormat(d => d))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#1a1f27'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-width).tickFormat(d3.format('.1f')))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#1a1f27'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

  svg.append('text').attr('x', width / 2).attr('y', height + 36).attr('text-anchor', 'middle')
    .attr('fill', '#484F58').attr('font-size', '12px').attr('font-family', 'Inter, sans-serif').text('Turn Number');
  svg.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -36)
    .attr('text-anchor', 'middle').attr('fill', '#484F58').attr('font-size', '12px').attr('font-family', 'Inter, sans-serif').text('Hedging');

  const line = d3.line().x(d => x(d.turn)).y(d => yScale(d.mean)).curve(d3.curveMonotoneX);

  groups = {};
  conditionData.forEach(cond => {
    if (cond.points.length < 2) return;
    const g = svg.append('g').attr('opacity', 0);
    groups[cond.key] = g;

    g.append('path').datum(cond.points).attr('fill', 'none')
      .attr('stroke', cond.color).attr('stroke-width', 2.5).attr('d', line)
      .each(function() {
        const len = this.getTotalLength();
        d3.select(this).attr('stroke-dasharray', len).attr('stroke-dashoffset', len);
      });

    g.selectAll('circle').data(cond.points).join('circle')
      .attr('cx', d => x(d.turn)).attr('cy', d => yScale(d.mean))
      .attr('r', 0).attr('fill', cond.color).attr('stroke', '#0D1117').attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => tooltip.show(`<strong>${cond.label}</strong> — Turn ${d.turn}<br>Hedging: <span class="val">${d.mean.toFixed(3)}</span><br>n = ${d.count}`, event))
      .on('mousemove', e => tooltip.move(e))
      .on('mouseout', () => tooltip.hide());

    const last = cond.points[cond.points.length - 1];
    g.append('text').attr('x', x(last.turn) + 8).attr('y', yScale(last.mean) + 4)
      .attr('fill', cond.color).attr('font-size', '11px').attr('font-weight', '600')
      .attr('font-family', 'Inter, sans-serif')
      .text(cond.label.replace('AI ', ''));
  });
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;

  let visibleKeys;
  let highlightKey = null;
  if (step === 0) visibleKeys = [];
  else if (step === 1) visibleKeys = ['human_human'];
  else if (step === 2) visibleKeys = ['human_human', 'ai_ai_freeform', 'ai_ai_structured', 'ai_ai_freeform_persona'];
  else if (step === 3) {
    visibleKeys = ['human_human', 'ai_ai_freeform', 'ai_ai_structured', 'ai_ai_freeform_persona', 'ai_ai_reverse_turing'];
    highlightKey = 'ai_ai_reverse_turing';
  } else {
    visibleKeys = CONDITIONS.map(c => c.key);
  }

  const visibleSet = new Set(visibleKeys);

  Object.entries(groups).forEach(([key, g]) => {
    const visible = visibleSet.has(key);
    const dimmed = highlightKey && key !== highlightKey && key !== 'human_human';
    const targetOpacity = !visible ? 0 : (dimmed ? 0.15 : 1);

    g.transition().duration(500).attr('opacity', targetOpacity);

    if (visible) {
      // Draw line
      g.select('path').transition().duration(1200).ease(d3.easeQuadOut).attr('stroke-dashoffset', 0);
      // Dots appear AFTER line
      g.selectAll('circle').transition().duration(400).delay((d, i) => 1200 + i * 30).attr('r', 3);
    } else {
      // Reset line
      g.select('path').each(function() {
        const len = this.getTotalLength();
        d3.select(this).attr('stroke-dashoffset', len);
      });
      g.selectAll('circle').attr('r', 0);
    }
  });

  // Annotation for RT
  svg.selectAll('.rt-annotation').remove();
  if (highlightKey) {
    const rtData = conditionData.find(c => c.key === highlightKey);
    if (rtData && rtData.points.length >= 4) {
      const earlyAvg = d3.mean(rtData.points.slice(0, 3), p => p.mean);
      const lateAvg = d3.mean(rtData.points.slice(-3), p => p.mean);
      const midPt = rtData.points[Math.floor(rtData.points.length / 2)];

      const ag = svg.append('g').attr('class', 'rt-annotation').attr('opacity', 0);
      const bx = x(midPt.turn) - 100, by = yScale(lateAvg) - 50;
      ag.append('rect').attr('x', bx).attr('y', by).attr('width', 200).attr('height', 36)
        .attr('rx', 6).attr('fill', 'rgba(13,17,23,0.92)').attr('stroke', '#F39C12').attr('stroke-width', 1);
      ag.append('text').attr('x', bx + 100).attr('y', by + 14).attr('text-anchor', 'middle')
        .attr('fill', '#F39C12').attr('font-size', '12px').attr('font-weight', '700').attr('font-family', 'Inter, sans-serif')
        .text('Only line that goes up');
      ag.append('text').attr('x', bx + 100).attr('y', by + 28).attr('text-anchor', 'middle')
        .attr('fill', '#8B949E').attr('font-size', '11px').attr('font-family', 'Inter, sans-serif')
        .text(`+${(lateAvg - earlyAvg).toFixed(2)} over time`);
      ag.append('line').attr('x1', bx + 100).attr('y1', by + 36)
        .attr('x2', x(midPt.turn)).attr('y2', yScale(midPt.mean) - 4)
        .attr('stroke', '#F39C12').attr('stroke-width', 1).attr('stroke-dasharray', '4,3');
      ag.transition().duration(500).delay(600).attr('opacity', 1);
    }
  }
}
