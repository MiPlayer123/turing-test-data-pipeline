import * as d3 from 'd3';
import { CONDITIONS, CONDITION_COLOR, CONDITION_LABEL } from '../data/constants.js';
import { createFilterChips } from '../components/filterChips.js';
import { openConversation } from '../components/conversationReader.js';
import * as tooltip from '../components/tooltip.js';

const AI_SUBTYPES = [
  { key: 'ai_ai_freeform', label: 'AI Freeform', color: '#3498DB' },
  { key: 'ai_ai_freeform_persona', label: 'AI Persona', color: '#9B59B6' },
  { key: 'ai_ai_detective', label: 'AI Detective', color: '#E74C3C' },
  { key: 'ai_ai_reverse_turing', label: 'AI Reverse Turing', color: '#F39C12' },
  { key: 'ai_ai_structured', label: 'AI Structured', color: '#2ECC71' },
];

let container, data;
let currentStep = -1;

export function init(rawData) {
  data = rawData;
  container = document.getElementById('main-flow-viz');
  container.innerHTML = '';
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;

  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.flexDirection = 'column';

  if (step <= 2) {
    drawComparisonBars(step);
  } else if (step === 3 || step === 4) {
    drawSubTypeCards(step);
  } else if (step >= 5) {
    drawTimeline(step);
  }
}

function drawComparisonBars(step) {
  const grouped = d3.group(data.conversations, d => d.condition);
  const metrics = ['hedging', 'repetitiveness'];

  let items;
  if (step === 0) {
    items = [{ key: 'human_human', label: 'Human-Human', color: '#1ABC9C' }];
  } else if (step === 1) {
    items = [
      { key: 'human_human', label: 'Human-Human', color: '#1ABC9C' },
      { key: 'human_ai', label: 'Human-AI', color: '#F1C40F' },
    ];
  } else {
    const aiRows = data.conversations.filter(d => d.condition.startsWith('ai_ai_'));
    items = [
      { key: 'human_human', label: 'Human-Human', color: '#1ABC9C' },
      { key: 'human_ai', label: 'Human-AI', color: '#F1C40F' },
      { key: 'ai_ai_combined', label: 'AI-AI', color: '#E74C3C', rows: aiRows },
    ];
  }

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; gap:48px; justify-content:center;';
  container.appendChild(wrapper);

  metrics.forEach(metric => {
    const rows = items.map(item => {
      const convs = item.rows || (grouped.get(item.key) || []);
      return { ...item, value: d3.mean(convs, r => r[metric]) || 0, n: convs.length };
    });

    const div = document.createElement('div');
    wrapper.appendChild(div);

    const margin = { top: 32, right: 60, bottom: 28, left: 130 };
    const w = 400 - margin.left - margin.right;
    const h = Math.max(100, items.length * 48);

    const svg = d3.select(div).append('svg')
      .attr('width', w + margin.left + margin.right)
      .attr('height', h + margin.top + margin.bottom)
      .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const maxVal = d3.max(rows, d => d.value) * 1.3 || 1;
    const y = d3.scaleBand().domain(rows.map(d => d.key)).range([0, h]).padding(0.3);
    const x = d3.scaleLinear().domain([0, maxVal]).range([0, w]);

    // Title
    svg.append('text').attr('x', w / 2).attr('y', -14).attr('text-anchor', 'middle')
      .attr('fill', '#d0d7de').attr('font-size', '16px').attr('font-weight', '600')
      .attr('font-family', 'Inter, sans-serif')
      .text(metric.charAt(0).toUpperCase() + metric.slice(1));

    // Y labels
    svg.selectAll('.y-label').data(rows).join('text')
      .attr('x', -10).attr('y', d => y(d.key) + y.bandwidth() / 2)
      .attr('dy', '0.35em').attr('text-anchor', 'end')
      .attr('fill', '#c9d1d9').attr('font-size', '13px').attr('font-family', 'Inter, sans-serif')
      .text(d => d.label);

    // X axis
    svg.append('g').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(3).tickSize(-h).tickFormat(d3.format('.3f')))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#1a1f27'))
      .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

    // Bars
    svg.selectAll('rect').data(rows).join('rect')
      .attr('y', d => y(d.key)).attr('height', y.bandwidth())
      .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 4)
      .on('mouseover', (event, d) => tooltip.show(`<strong>${d.label}</strong><br>${metric}: <span class="val">${d.value.toFixed(4)}</span><br>n = ${d.n}`, event))
      .on('mousemove', e => tooltip.move(e))
      .on('mouseout', () => tooltip.hide())
      .transition().duration(600).delay((d, i) => i * 60)
      .attr('width', d => x(d.value));

    // Values
    svg.selectAll('.val').data(rows).join('text').attr('class', 'val')
      .attr('y', d => y(d.key) + y.bandwidth() / 2).attr('dy', '0.35em')
      .attr('fill', '#d0d7de').attr('font-size', '12px').attr('font-weight', '600')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('x', 0).attr('opacity', 0).text(d => d.value.toFixed(4))
      .transition().duration(600).delay((d, i) => i * 60)
      .attr('x', d => x(d.value) + 8).attr('opacity', 1);
  });
}

function drawSubTypeCards(step) {
  const grouped = d3.group(data.conversations, d => d.condition);

  const cardsWrapper = document.createElement('div');
  cardsWrapper.style.cssText = 'display:flex; flex-wrap:wrap; gap:16px; justify-content:center; max-width:900px; padding:0 20px;';
  container.appendChild(cardsWrapper);

  if (step === 3) {
    // Show combined AI-AI card that's about to expand
    const aiRows = data.conversations.filter(d => d.condition.startsWith('ai_ai_'));
    const hedging = d3.mean(aiRows, r => r.hedging);

    const card = document.createElement('div');
    card.style.cssText = 'background:#161B22; border:1px solid #30363D; border-radius:14px; padding:32px 48px; text-align:center;';
    card.innerHTML = `
      <div style="font-family:'Playfair Display',serif; font-size:24px; color:#f0f3f6; margin-bottom:8px;">AI ↔ AI</div>
      <div style="font-family:'JetBrains Mono',monospace; font-size:14px; color:#8B949E;">${aiRows.length} conversations</div>
      <div style="font-family:'JetBrains Mono',monospace; font-size:14px; color:#8B949E; margin-top:4px;">avg hedging: ${hedging.toFixed(3)}</div>
    `;
    cardsWrapper.appendChild(card);
  } else {
    // Step 4: Show all sub-type cards
    AI_SUBTYPES.forEach((sub, i) => {
      const rows = grouped.get(sub.key) || [];
      const hedging = d3.mean(rows, r => r.hedging) || 0;
      const rep = d3.mean(rows, r => r.repetitiveness) || 0;

      const card = document.createElement('div');
      card.style.cssText = `
        background:#161B22; border:1px solid #30363D; border-radius:12px; padding:20px 24px;
        width:260px; border-left:3px solid ${sub.color};
        opacity:0; transform:translateY(16px);
        transition: opacity 0.4s ease, transform 0.4s ease;
      `;
      card.innerHTML = `
        <div style="font-family:'Inter',sans-serif; font-size:15px; font-weight:600; color:${sub.color}; margin-bottom:6px;">${sub.label.replace('AI ', '')}</div>
        <div style="font-family:'Inter',sans-serif; font-size:13px; color:#b1bac4; line-height:1.55; margin-bottom:8px;">
          ${getSubTypeDescription(sub.key)}
        </div>
        <div style="font-family:'JetBrains Mono',monospace; font-size:11px; color:#8B949E;">
          ${rows.length} conversations · hedging ${hedging.toFixed(3)}
        </div>
      `;
      cardsWrapper.appendChild(card);

      // Stagger animation
      setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 100 + i * 120);
    });
  }
}

function getSubTypeDescription(key) {
  const descs = {
    'ai_ai_freeform': 'Open-ended chat with no goal. "Hey, how\'s it going?"',
    'ai_ai_freeform_persona': 'Each AI plays a character with a name and backstory.',
    'ai_ai_detective': 'One AI interrogates the other: "Are you human or AI?"',
    'ai_ai_reverse_turing': 'Both AIs told: "You ARE human. Prove it to the other person."',
    'ai_ai_structured': 'Discuss a specific topic like remote work or mRNA vaccines.',
  };
  return descs[key] || '';
}

// ===== Timeline =====
function drawTimeline(step) {
  container.style.flexDirection = 'row';
  container.style.gap = '0';

  const conditionData = CONDITIONS.map(cond => {
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
  chartDiv.style.cssText = 'flex:1; display:flex; flex-direction:column; align-items:center;';
  container.appendChild(chartDiv);

  const margin = { top: 24, right: 100, bottom: 44, left: 56 };
  const w = 860 - margin.left - margin.right;
  const h = 380 - margin.top - margin.bottom;

  const svg = d3.select(chartDiv).append('svg')
    .attr('width', w + margin.left + margin.right)
    .attr('height', h + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([2, 20]).range([0, w]);
  const allMeans = conditionData.flatMap(c => c.points.map(p => p.mean));
  const yScale = d3.scaleLinear().domain([0, d3.max(allMeans) * 1.15]).range([h, 0]);

  // Grid
  svg.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(18).tickSize(-h).tickFormat(d => d))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#1a1f27'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-w).tickFormat(d3.format('.1f')))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#1a1f27'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

  svg.append('text').attr('x', w / 2).attr('y', h + 36).attr('text-anchor', 'middle')
    .attr('fill', '#484F58').attr('font-size', '12px').attr('font-family', 'Inter, sans-serif').text('Turn Number');
  svg.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -40)
    .attr('text-anchor', 'middle').attr('fill', '#484F58').attr('font-size', '12px').attr('font-family', 'Inter, sans-serif').text('Hedging (per 100 words)');

  const line = d3.line().x(d => x(d.turn)).y(d => yScale(d.mean)).curve(d3.curveMonotoneX);

  // Determine which conditions to show based on step
  let visibleKeys;
  let highlightKey = null;
  if (step === 5) visibleKeys = [];
  else if (step === 6) visibleKeys = ['human_human'];
  else if (step === 7) visibleKeys = ['human_human', 'ai_ai_freeform', 'ai_ai_structured', 'ai_ai_freeform_persona'];
  else if (step === 8) {
    visibleKeys = ['human_human', 'ai_ai_freeform', 'ai_ai_structured', 'ai_ai_freeform_persona', 'ai_ai_reverse_turing'];
    highlightKey = 'ai_ai_reverse_turing';
  } else {
    visibleKeys = CONDITIONS.map(c => c.key);
  }

  const visibleSet = new Set(visibleKeys);

  conditionData.forEach(cond => {
    if (cond.points.length < 2) return;
    const visible = visibleSet.has(cond.key);
    const dimmed = highlightKey && cond.key !== highlightKey && cond.key !== 'human_human';
    const opacity = !visible ? 0 : (dimmed ? 0.15 : 1);

    const g = svg.append('g').attr('opacity', 0);

    const path = g.append('path')
      .datum(cond.points).attr('fill', 'none')
      .attr('stroke', cond.color).attr('stroke-width', 2.5).attr('d', line);

    if (visible) {
      const totalLength = path.node().getTotalLength();
      path.attr('stroke-dasharray', totalLength).attr('stroke-dashoffset', totalLength);
      g.transition().duration(400).attr('opacity', opacity);
      path.transition().duration(1200).ease(d3.easeQuadOut).attr('stroke-dashoffset', 0);
    }

    // Dots with hover — appear AFTER line finishes drawing
    g.selectAll('circle').data(cond.points).join('circle')
      .attr('cx', d => x(d.turn)).attr('cy', d => yScale(d.mean))
      .attr('r', 0).attr('fill', cond.color)
      .attr('stroke', '#0D1117').attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        tooltip.show(`<strong>${cond.label}</strong> — Turn ${d.turn}<br>Hedging: <span class="val">${d.mean.toFixed(3)}</span><br>n = ${d.count}`, event);
      })
      .on('mousemove', e => tooltip.move(e))
      .on('mouseout', () => tooltip.hide());

    if (visible) {
      g.selectAll('circle').transition().duration(400).delay((d, i) => 1200 + i * 30).attr('r', 3);
    }

    // End label
    if (visible && !dimmed) {
      const last = cond.points[cond.points.length - 1];
      g.append('text').attr('x', x(last.turn) + 8).attr('y', yScale(last.mean) + 4)
        .attr('fill', cond.color).attr('font-size', '11px').attr('font-weight', '600')
        .attr('font-family', 'Inter, sans-serif')
        .text(cond.label.replace('AI ', ''));
    }
  });

  // Reverse Turing annotation
  if (highlightKey) {
    const rtData = conditionData.find(c => c.key === highlightKey);
    if (rtData && rtData.points.length >= 4) {
      const earlyAvg = d3.mean(rtData.points.slice(0, 3), p => p.mean);
      const lateAvg = d3.mean(rtData.points.slice(-3), p => p.mean);
      const midPt = rtData.points[Math.floor(rtData.points.length / 2)];

      const ag = svg.append('g').attr('opacity', 0);
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

  // Filter chips (only on step 9)
  if (step === 9) {
    const filtersDiv = document.createElement('div');
    filtersDiv.className = 'filter-chips';
    filtersDiv.style.cssText = 'max-width:800px; margin:12px auto 0;';
    chartDiv.appendChild(filtersDiv);
    createFilterChips(filtersDiv, {
      onToggle(active) {
        // Filters would need to re-render — for now just a visual indicator
      },
    });
  }
}
