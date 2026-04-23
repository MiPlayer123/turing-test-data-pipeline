import * as d3 from 'd3';
import * as tooltip from '../components/tooltip.js';

// Scene 5: lines over 20 turns. Progressive reveal — Rev Turing first (alone),
// then H-H baseline, then the other AI conditions, then dim all but Rev Turing.
const SHOWN_CONDITIONS = [
  { key: 'ai_ai_reverse_turing',   label: 'Reverse Turing', color: '#E74C3C' },
  { key: 'human_human',            label: 'Human-Human',    color: '#1ABC9C' },
  { key: 'human_ai',               label: 'Human-AI',       color: '#F1C40F' },
  { key: 'ai_ai_freeform',         label: 'Freeform',       color: '#3498DB' },
  { key: 'ai_ai_freeform_persona', label: 'Persona',        color: '#9B59B6' },
  { key: 'ai_ai_detective',        label: 'Detective',      color: '#E67E22' },
  { key: 'ai_ai_structured',       label: 'Structured',     color: '#2ECC71' },
];

// Visibility per step — keys to show (rest are hidden)
const STEP_VISIBLE = {
  0: ['ai_ai_reverse_turing'],
  1: ['ai_ai_reverse_turing', 'human_human'],
  2: ['ai_ai_reverse_turing', 'human_human', 'human_ai',
      'ai_ai_freeform', 'ai_ai_freeform_persona', 'ai_ai_detective', 'ai_ai_structured'],
  3: ['ai_ai_reverse_turing', 'human_human', 'human_ai',
      'ai_ai_freeform', 'ai_ai_freeform_persona', 'ai_ai_detective', 'ai_ai_structured'],
};

let svg, x, yScale, width, height, conditionData, groups;
let currentStep = -1;

export function init(data) {
  const chartContainer = document.getElementById('timeline-chart');
  chartContainer.innerHTML = '';
  chartContainer.style.textAlign = 'center';

  conditionData = SHOWN_CONDITIONS.map(cond => {
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
  width = 820 - margin.left - margin.right;
  height = 380 - margin.top - margin.bottom;

  svg = d3.select(chartDiv).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  x = d3.scaleLinear().domain([2, 20]).range([0, width]);
  const allMeans = conditionData.flatMap(c => c.points.map(p => p.mean));
  yScale = d3.scaleLinear().domain([0, d3.max(allMeans) * 1.15]).range([height, 0]);

  // Axes
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
      .text(cond.label);
  });
}

// Animate a single condition's line + dots in (called per-step)
function drawLine(key) {
  const g = groups[key];
  if (!g) return;
  if (g.attr('data-drawn') === '1') {
    g.transition().duration(400).attr('opacity', 1);
    return;
  }
  g.attr('data-drawn', '1');
  g.transition().duration(400).attr('opacity', 1);
  g.select('path').transition().duration(1200).ease(d3.easeQuadOut)
    .attr('stroke-dashoffset', 0);
  g.selectAll('circle').transition().duration(300).delay((d, i) => 1200 + i * 25)
    .attr('r', 3);
}

function renderAnnotation() {
  svg.selectAll('.rt-annotation').remove();
  const rt = conditionData.find(c => c.key === 'ai_ai_reverse_turing');
  if (!rt || rt.points.length < 4) return;

  const earlyAvg = d3.mean(rt.points.slice(0, 3), p => p.mean);
  const lateAvg  = d3.mean(rt.points.slice(-3), p => p.mean);
  const midPt    = rt.points[Math.floor(rt.points.length / 2)];

  const ag = svg.append('g').attr('class', 'rt-annotation').attr('opacity', 0);
  const bx = x(midPt.turn) - 110, by = yScale(lateAvg) - 56;
  ag.append('rect').attr('x', bx).attr('y', by).attr('width', 220).attr('height', 40)
    .attr('rx', 6).attr('fill', 'rgba(13,17,23,0.92)').attr('stroke', '#E74C3C').attr('stroke-width', 1);
  ag.append('text').attr('x', bx + 110).attr('y', by + 16).attr('text-anchor', 'middle')
    .attr('fill', '#E74C3C').attr('font-size', '12px').attr('font-weight', '700').attr('font-family', 'Inter, sans-serif')
    .text('Only line that goes up');
  ag.append('text').attr('x', bx + 110).attr('y', by + 32).attr('text-anchor', 'middle')
    .attr('fill', '#8B949E').attr('font-size', '11px').attr('font-family', 'Inter, sans-serif')
    .text(`+${(lateAvg - earlyAvg).toFixed(2)} over time`);
  ag.append('line').attr('x1', bx + 110).attr('y1', by + 40)
    .attr('x2', x(midPt.turn)).attr('y2', yScale(midPt.mean) - 4)
    .attr('stroke', '#E74C3C').attr('stroke-width', 1).attr('stroke-dasharray', '4,3');
  ag.transition().duration(500).delay(200).attr('opacity', 1);
}

function removeAnnotation() {
  svg.selectAll('.rt-annotation').transition().duration(300).attr('opacity', 0).remove();
}

function applyVisibility(visibleSet, dimNonRt) {
  Object.entries(groups).forEach(([key, g]) => {
    const visible = visibleSet.has(key);
    if (!visible) {
      g.transition().duration(400).attr('opacity', 0);
      return;
    }
    // Visible: reveal (drawing if first time) and dim-or-full based on mode
    const isRt = key === 'ai_ai_reverse_turing';
    const targetOpacity = dimNonRt ? (isRt ? 1 : 0.18) : 1;
    if (g.attr('data-drawn') !== '1') {
      drawLine(key);
    }
    g.transition().duration(400).attr('opacity', targetOpacity);
  });
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;

  const visibleKeys = STEP_VISIBLE[step] || STEP_VISIBLE[3];
  const visibleSet = new Set(visibleKeys);
  const dimNonRt = step === 3;

  applyVisibility(visibleSet, dimNonRt);

  if (step === 3) renderAnnotation();
  else            removeAnnotation();
}
