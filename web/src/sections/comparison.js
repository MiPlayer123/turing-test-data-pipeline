import * as d3 from 'd3';
import * as tooltip from '../components/tooltip.js';

let container, data;
let currentStep = -1;
let metricIntro;

export function init(rawData) {
  data = rawData;
  container = document.getElementById('comparison-viz');
  metricIntro = document.getElementById('metric-intro');
  container.innerHTML = '';
  container.style.textAlign = 'center';
}

export function getAiAiBarPosition() {
  const label = container.querySelector('[data-key="ai_ai_combined"]');
  if (label) {
    return label.getBoundingClientRect();
  }
  const rect = container.getBoundingClientRect();
  return { left: rect.left + rect.width / 2 - 60, top: rect.top + rect.height - 80, width: 120, height: 40 };
}

export function onStep(step) {
  if (step === currentStep) return;
  currentStep = step;

  // Step 0: show metric intro, hide bars
  if (step === 0) {
    metricIntro.style.opacity = '1';
    metricIntro.style.display = '';
    container.style.opacity = '0';
    container.innerHTML = '';
    return;
  }

  // Steps 1+: hide metric intro, show bars
  metricIntro.style.opacity = '0';
  metricIntro.style.display = 'none';
  container.style.opacity = '1';

  container.innerHTML = '';

  const grouped = d3.group(data.conversations, d => d.condition);
  const metrics = ['hedging', 'repetitiveness'];

  let items;
  if (step === 1) {
    items = [{ key: 'human_human', label: 'Human-Human', color: '#1ABC9C' }];
  } else if (step === 2) {
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

  metrics.forEach((metric, mi) => {
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

    svg.append('text').attr('x', w / 2).attr('y', -14).attr('text-anchor', 'middle')
      .attr('fill', '#d0d7de').attr('font-size', '16px').attr('font-weight', '600')
      .attr('font-family', 'Inter, sans-serif')
      .text(metric.charAt(0).toUpperCase() + metric.slice(1));

    svg.selectAll('.y-label').data(rows).join('text')
      .attr('x', -10).attr('y', d => y(d.key) + y.bandwidth() / 2)
      .attr('dy', '0.35em').attr('text-anchor', 'end')
      .attr('fill', '#c9d1d9').attr('font-size', '13px').attr('font-family', 'Inter, sans-serif')
      .attr('data-key', d => d.key)
      .text(d => d.label);

    svg.append('g').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(3).tickSize(-h).tickFormat(d3.format('.3f')))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#1a1f27'))
      .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

    svg.selectAll('.bar').data(rows).join('rect')
      .attr('class', d => `bar bar-${d.key}`)
      .attr('data-key', d => d.key)
      .attr('y', d => y(d.key)).attr('height', y.bandwidth())
      .attr('x', 0).attr('width', 0).attr('fill', d => d.color).attr('rx', 4)
      .on('mouseover', (event, d) => tooltip.show(`<strong>${d.label}</strong><br>${metric}: <span class="val">${d.value.toFixed(4)}</span><br>n = ${d.n}`, event))
      .on('mousemove', e => tooltip.move(e))
      .on('mouseout', () => tooltip.hide())
      .transition().duration(600).delay((d, i) => i * 60)
      .attr('width', d => x(d.value));

    svg.selectAll('.val').data(rows).join('text').attr('class', 'val')
      .attr('y', d => y(d.key) + y.bandwidth() / 2).attr('dy', '0.35em')
      .attr('fill', '#d0d7de').attr('font-size', '12px').attr('font-weight', '600')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('x', 0).attr('opacity', 0).text(d => d.value.toFixed(4))
      .transition().duration(600).delay((d, i) => i * 60)
      .attr('x', d => x(d.value) + 8).attr('opacity', 1);
  });
}
