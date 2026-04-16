import * as d3 from 'd3';
import { CONDITIONS, CONDITION_COLOR } from '../data/constants.js';
import { createFilterChips } from '../components/filterChips.js';
import * as tooltip from '../components/tooltip.js';

let svg, x, yScale, width, height, conditionData, groups, line, filtersEl;
let currentStep = -1;

const CONDITION_ORDER = [
  'human_human', 'human_ai',
  'ai_ai_freeform', 'ai_ai_freeform_persona', 'ai_ai_structured', 'ai_ai_detective',
  'ai_ai_reverse_turing',
];

export function init(data) {
  const container = document.getElementById('trajectory-viz');
  container.innerHTML = '';
  container.style.textAlign = 'center';

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

  // Filters (hidden until step 4)
  filtersEl = document.createElement('div');
  filtersEl.className = 'filter-chips';
  filtersEl.style.cssText = 'max-width:800px; margin:0 auto 12px; opacity:0; transition:opacity 0.4s;';
  container.appendChild(filtersEl);

  const chartDiv = document.createElement('div');
  chartDiv.style.display = 'inline-block';
  container.appendChild(chartDiv);

  const margin = { top: 20, right: 100, bottom: 48, left: 56 };
  width = 880 - margin.left - margin.right;
  height = 400 - margin.top - margin.bottom;

  svg = d3.select(chartDiv).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  x = d3.scaleLinear().domain([2, 20]).range([0, width]);
  const allMeans = conditionData.flatMap(c => c.points.map(p => p.mean));
  yScale = d3.scaleLinear().domain([0, d3.max(allMeans) * 1.15]).range([height, 0]);

  // Grid
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

  svg.append('text').attr('x', width / 2).attr('y', height + 38)
    .attr('text-anchor', 'middle').attr('fill', '#484F58').attr('font-size', '12px')
    .attr('font-family', 'Inter, sans-serif').text('Turn Number');
  svg.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -40)
    .attr('text-anchor', 'middle').attr('fill', '#484F58').attr('font-size', '12px')
    .attr('font-family', 'Inter, sans-serif').text('Hedging (per 100 words)');

  line = d3.line().x(d => x(d.turn)).y(d => yScale(d.mean)).curve(d3.curveMonotoneX);

  // Create all line groups, hidden initially
  groups = {};
  conditionData.forEach(cond => {
    if (cond.points.length < 2) return;
    const g = svg.append('g').attr('class', `line-${cond.key}`).attr('opacity', 0);
    groups[cond.key] = g;

    const path = g.append('path')
      .datum(cond.points).attr('fill', 'none')
      .attr('stroke', cond.color).attr('stroke-width', 2.5).attr('d', line);

    // Store total length for animation
    const totalLength = path.node().getTotalLength();
    path.attr('data-length', totalLength)
      .attr('stroke-dasharray', totalLength).attr('stroke-dashoffset', totalLength);

    g.selectAll('circle').data(cond.points).join('circle')
      .attr('cx', d => x(d.turn)).attr('cy', d => yScale(d.mean))
      .attr('r', 0).attr('fill', cond.color).attr('stroke', '#0D1117').attr('stroke-width', 1.5)
      .on('mouseover', (event, d) => tooltip.show(`<strong>${cond.label}</strong> — Turn ${d.turn}<br>Hedging: <span class="val">${d.mean.toFixed(3)}</span>`, event))
      .on('mousemove', e => tooltip.move(e))
      .on('mouseout', () => tooltip.hide());

    // End label
    const last = cond.points[cond.points.length - 1];
    g.append('text')
      .attr('x', x(last.turn) + 8).attr('y', yScale(last.mean) + 4)
      .attr('fill', cond.color).attr('font-size', '11px').attr('font-weight', '600')
      .attr('font-family', 'Inter, sans-serif')
      .text(cond.label.replace('AI ', ''));
  });

  // Filter chips (activated on step 4)
  createFilterChips(filtersEl, {
    onToggle(active) {
      Object.entries(groups).forEach(([key, g]) => {
        g.transition().duration(300).attr('opacity', active.has(key) ? 1 : 0.05);
      });
    },
  });
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;

  if (step === 0) {
    // Hide everything
    Object.values(groups).forEach(g => g.attr('opacity', 0));
    filtersEl.style.opacity = '0';
  } else if (step === 1) {
    // Show only human-human
    showConditions(['human_human']);
    filtersEl.style.opacity = '0';
  } else if (step === 2) {
    // Add AI freeform, structured, persona
    showConditions(['human_human', 'ai_ai_freeform', 'ai_ai_structured', 'ai_ai_freeform_persona']);
    filtersEl.style.opacity = '0';
  } else if (step === 3) {
    // Add reverse turing with emphasis
    showConditions(['human_human', 'ai_ai_freeform', 'ai_ai_structured', 'ai_ai_freeform_persona', 'ai_ai_reverse_turing']);
    // Dim others, highlight reverse turing
    Object.entries(groups).forEach(([key, g]) => {
      g.transition().duration(400).attr('opacity', key === 'ai_ai_reverse_turing' ? 1 : 0.2);
    });
    addReverseAnnotation();
    filtersEl.style.opacity = '0';
  } else if (step === 4) {
    // Show all, full opacity, show filters
    showConditions(Object.keys(groups));
    Object.values(groups).forEach(g => g.transition().duration(400).attr('opacity', 1));
    svg.selectAll('.rt-annotation').remove();
    filtersEl.style.opacity = '1';
  }
}

function showConditions(keys) {
  const keySet = new Set(keys);
  Object.entries(groups).forEach(([key, g]) => {
    if (keySet.has(key)) {
      g.transition().duration(600).attr('opacity', 1);
      // Animate line drawing
      g.select('path').transition().duration(1200).ease(d3.easeQuadOut).attr('stroke-dashoffset', 0);
      // Show dots
      g.selectAll('circle').transition().duration(400).delay((d, i) => i * 30).attr('r', 3);
    } else {
      g.transition().duration(400).attr('opacity', 0);
    }
  });
}

function addReverseAnnotation() {
  svg.selectAll('.rt-annotation').remove();
  const rtData = conditionData.find(c => c.key === 'ai_ai_reverse_turing');
  if (!rtData || rtData.points.length < 4) return;

  const earlyAvg = d3.mean(rtData.points.slice(0, 3), p => p.mean);
  const lateAvg = d3.mean(rtData.points.slice(-3), p => p.mean);
  const midPt = rtData.points[Math.floor(rtData.points.length / 2)];

  const g = svg.append('g').attr('class', 'rt-annotation').attr('opacity', 0);

  const boxX = x(midPt.turn) - 110;
  const boxY = yScale(lateAvg) - 55;

  g.append('rect').attr('x', boxX).attr('y', boxY).attr('width', 220).attr('height', 38)
    .attr('rx', 6).attr('fill', 'rgba(13,17,23,0.92)').attr('stroke', '#F39C12').attr('stroke-width', 1);

  g.append('text').attr('x', boxX + 110).attr('y', boxY + 15).attr('text-anchor', 'middle')
    .attr('fill', '#F39C12').attr('font-size', '13px').attr('font-weight', '700').attr('font-family', 'Inter, sans-serif')
    .text('The only line that goes up');

  g.append('text').attr('x', boxX + 110).attr('y', boxY + 30).attr('text-anchor', 'middle')
    .attr('fill', '#8B949E').attr('font-size', '11px').attr('font-family', 'Inter, sans-serif')
    .text(`+${(lateAvg - earlyAvg).toFixed(2)} hedging over time`);

  g.append('line').attr('x1', boxX + 110).attr('y1', boxY + 38)
    .attr('x2', x(midPt.turn)).attr('y2', yScale(midPt.mean) - 6)
    .attr('stroke', '#F39C12').attr('stroke-width', 1).attr('stroke-dasharray', '4,3');

  g.transition().duration(600).delay(400).attr('opacity', 1);
}
