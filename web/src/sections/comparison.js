import * as d3 from 'd3';
import { CONDITIONS, CONDITION_COLOR } from '../data/constants.js';
import * as tooltip from '../components/tooltip.js';

let svg, data, margin, width, height;
let currentStep = -1;

const AI_SUBTYPES = ['ai_ai_freeform', 'ai_ai_freeform_persona', 'ai_ai_detective', 'ai_ai_reverse_turing', 'ai_ai_structured'];

export function init(rawData) {
  data = rawData;
  const container = document.getElementById('comparison-viz');
  container.innerHTML = '';
  container.style.textAlign = 'center';

  const wrapper = document.createElement('div');
  wrapper.style.display = 'inline-block';
  container.appendChild(wrapper);

  margin = { top: 40, right: 70, bottom: 32, left: 160 };
  width = 700 - margin.left - margin.right;
  height = 420 - margin.top - margin.bottom;

  svg = d3.select(wrapper).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;

  svg.selectAll('*').remove();

  const grouped = d3.group(data.conversations, d => d.condition);
  const metrics = ['hedging', 'repetitiveness'];

  if (step === 0) {
    // Just human-human
    drawBars([{ key: 'human_human', label: 'Human-Human', color: '#1ABC9C' }], grouped, metrics);
  } else if (step === 1) {
    // Human-human + human-AI
    drawBars([
      { key: 'human_human', label: 'Human-Human', color: '#1ABC9C' },
      { key: 'human_ai', label: 'Human-AI', color: '#F1C40F' },
    ], grouped, metrics);
  } else if (step === 2) {
    // Human-human + human-AI + combined AI-AI
    const aiRows = data.conversations.filter(d => d.condition.startsWith('ai_ai_'));
    drawBars([
      { key: 'human_human', label: 'Human-Human', color: '#1ABC9C' },
      { key: 'human_ai', label: 'Human-AI', color: '#F1C40F' },
      { key: 'ai_ai_combined', label: 'AI-AI (combined)', color: '#E74C3C', rows: aiRows },
    ], grouped, metrics);
  } else if (step === 3 || step === 4) {
    // All expanded — sub-types visible
    const items = [
      { key: 'human_human', label: 'Human-Human', color: '#1ABC9C' },
      { key: 'human_ai', label: 'Human-AI', color: '#F1C40F' },
      ...AI_SUBTYPES.map(k => {
        const c = CONDITIONS.find(c => c.key === k);
        return { key: k, label: c?.label || k, color: c?.color || '#888' };
      }),
    ];
    drawBars(items, grouped, metrics, null);
  } else if (step === 5) {
    // Highlight reverse turing
    const items = [
      { key: 'human_human', label: 'Human-Human', color: '#1ABC9C' },
      { key: 'human_ai', label: 'Human-AI', color: '#F1C40F' },
      ...AI_SUBTYPES.map(k => {
        const c = CONDITIONS.find(c => c.key === k);
        return { key: k, label: c?.label || k, color: c?.color || '#888' };
      }),
    ];
    drawBars(items, grouped, metrics, 'ai_ai_reverse_turing');
  }
}

function drawBars(items, grouped, metrics, highlightKey) {
  const panelWidth = (width - 30) / metrics.length;

  metrics.forEach((metric, mi) => {
    const offsetX = mi * (panelWidth + 30);

    // Compute values
    const rows = items.map(item => {
      let convs;
      if (item.rows) {
        convs = item.rows;
      } else {
        convs = grouped.get(item.key) || [];
      }
      return {
        ...item,
        value: d3.mean(convs, r => r[metric]) || 0,
        n: convs.length,
      };
    });

    const g = svg.append('g').attr('transform', `translate(${offsetX},0)`);

    const maxVal = d3.max(rows, d => d.value) * 1.25 || 1;
    const y = d3.scaleBand().domain(rows.map(d => d.key)).range([0, height]).padding(0.2);
    const x = d3.scaleLinear().domain([0, maxVal]).range([0, panelWidth]);

    // Panel title
    g.append('text').attr('x', panelWidth / 2).attr('y', -16)
      .attr('text-anchor', 'middle').attr('fill', '#d0d7de')
      .attr('font-size', '15px').attr('font-weight', '600').attr('font-family', 'Inter, sans-serif')
      .text(metric.charAt(0).toUpperCase() + metric.slice(1));

    // Y labels (only on first panel)
    if (mi === 0) {
      g.selectAll('.y-label').data(rows).join('text')
        .attr('x', -10).attr('y', d => y(d.key) + y.bandwidth() / 2)
        .attr('dy', '0.35em').attr('text-anchor', 'end')
        .attr('fill', d => d.key === highlightKey ? '#F39C12' : '#c9d1d9')
        .attr('font-size', '12px').attr('font-weight', d => d.key === highlightKey ? '700' : '400')
        .attr('font-family', 'Inter, sans-serif')
        .text(d => `${d.label} (${d.n})`);
    }

    // X axis
    g.append('g').attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(3).tickSize(-height).tickFormat(d3.format('.2f')))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('.tick line').attr('stroke', '#1a1f27'))
      .call(gg => gg.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

    // Bars
    g.selectAll('rect').data(rows).join('rect')
      .attr('y', d => y(d.key)).attr('height', y.bandwidth())
      .attr('x', 0).attr('width', 0)
      .attr('fill', d => d.color)
      .attr('opacity', d => highlightKey ? (d.key === highlightKey ? 1 : 0.3) : 1)
      .attr('rx', 4)
      .on('mouseover', (event, d) => tooltip.show(`<strong>${d.label}</strong><br>${metric}: <span class="val">${d.value.toFixed(4)}</span><br>n = ${d.n}`, event))
      .on('mousemove', e => tooltip.move(e))
      .on('mouseout', () => tooltip.hide())
      .transition().duration(600).delay((d, i) => i * 40)
      .attr('width', d => x(d.value));

    // Value labels
    g.selectAll('.val').data(rows).join('text')
      .attr('class', 'val')
      .attr('y', d => y(d.key) + y.bandwidth() / 2).attr('dy', '0.35em')
      .attr('fill', '#d0d7de').attr('font-size', '11px').attr('font-weight', '600')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('x', 0).attr('opacity', 0).text(d => d.value.toFixed(3))
      .transition().duration(600).delay((d, i) => i * 40)
      .attr('x', d => x(d.value) + 6).attr('opacity', 1);
  });

  // Highlight annotation
  if (highlightKey) {
    svg.append('text')
      .attr('x', width / 2).attr('y', height + 28)
      .attr('text-anchor', 'middle')
      .attr('fill', '#F39C12').attr('font-size', '13px').attr('font-weight', '600')
      .attr('font-family', 'Inter, sans-serif')
      .attr('opacity', 0)
      .text('Reverse Turing: the highest hedging of any condition')
      .transition().duration(500).delay(800).attr('opacity', 1);
  }
}
