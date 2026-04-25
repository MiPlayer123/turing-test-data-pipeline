import * as d3 from 'd3';
import { loadConversation } from '../data/loader.js';

const SHOWN_CONDITIONS = [
  { key: 'human_human',            label: 'Human-Human',    color: '#F1C40F' },
  { key: 'ai_ai_combined',         label: 'AI-AI (combined)', color: '#FF4D6D' },
  { key: 'ai_ai_freeform',         label: 'Freeform',       color: '#FF4D6D' },
  { key: 'ai_ai_freeform_persona', label: 'Persona',        color: '#C9184A' },
  { key: 'ai_ai_detective',        label: 'Detective',      color: '#FF7438' },
  { key: 'ai_ai_reverse_turing',   label: 'Reverse Turing', color: '#FF006E' },
  { key: 'ai_ai_structured',       label: 'Structured',     color: '#FFAA00' },
];

const AI_AI_KEYS = [
  'ai_ai_freeform',
  'ai_ai_freeform_persona',
  'ai_ai_detective',
  'ai_ai_reverse_turing',
  'ai_ai_structured',
];

// Fixed narrative exemplar for timeline HH hover snippet (same for every viewer/session).
const TIMELINE_HH_EXAMPLE_ID = 'conv_human_human_personachat_0079';

const HEDGE_TERMS = [
  'i think', 'i guess', 'maybe', 'perhaps', 'probably', 'possibly',
  'kind of', 'sort of', 'might', 'honestly',
];

const ACT_COPY = {
  0: {
    title: 'This is what human conversation looks like.',
    sub: "The longer humans talk, the more they hedge. Hedging isn't nervousness. It's comfort. As conversations warm up, people stop choosing their words carefully — and start talking like themselves.",
  },
  1: {
    title: 'AIs do the opposite.',
    sub: "When two AIs talk, hedging drops over time. They don't get comfortable. They get precise.",
  },
  2: {
    title: 'Every AI type converges the same way.',
    sub: 'Freeform, Persona, Detective, Structured — all trend downward. More turns, less hedging. More efficient, less human.',
  },
  3: {
    title: 'Except one.',
    sub: 'Reverse Turing is the only AI condition where hedging climbs — tracing the same arc as humans. The only AI that sounds more human over time is the one pretending to be one.',
  },
  4: {
    title: 'Repetitiveness shows a similar split.',
    sub: 'Human-Human vs AI-AI, plus any standout AI-AI subtype.',
  },
};

const EASE_IN_OUT = d3.easeCubicInOut;
const EASE_OUT = d3.easeCubicOut;

let svg, x, yScale, width, height, conditionData, groups, lineGen;
let xAxisG, yAxisG, yAxisLabel, hedgingYMax = 1;
let currentStep = -1;
let fullData = null;
let titleEl = null;
let subEl = null;
let stepCards = [];
let annotationTimer = null;
let act3Trend = null;
let act4Trend = null;
let act3AnimationDone = false;
let act3AnimToken = 0;
let act0EntranceTimer = null;
let subtextTimer = null;

// Inline snippet state (shared across all timeline points)
let tlActiveSnippet = null;
const tlSnippetCache = new Map();     // condKey -> conv
const tlSnippetLoading = new Set();   // condKey
let hhRepresentativePromise = null;
let hhRepresentativeConv = null;

function tlPickId(condKey) {
  if (!fullData || !fullData.conversations) return null;
  const row = fullData.conversations.find(c => c.condition === condKey);
  return row?.conversation_id || null;
}

function tlShowSnippet(condKey, turnNumber, event) {
  if (condKey === 'human_human') {
    if (hhRepresentativeConv) {
      tlRender(hhRepresentativeConv, turnNumber, event);
      return;
    }
    if (hhRepresentativePromise) {
      hhRepresentativePromise.then((conv) => { if (conv) tlRender(conv, turnNumber, event); });
      return;
    }
  }
  const cached = tlSnippetCache.get(condKey);
  if (cached) { tlRender(cached, turnNumber, event); return; }
  if (tlSnippetLoading.has(condKey)) return;
  const id = tlPickId(condKey);
  if (!id) return;
  tlSnippetLoading.add(condKey);
  loadConversation(id)
    .then(conv => { tlSnippetCache.set(condKey, conv); tlRender(conv, turnNumber, event); })
    .catch(err => console.warn('timeline snippet load failed', id, err))
    .finally(() => tlSnippetLoading.delete(condKey));
}

function tlRender(conv, turnNumber, event) {
  tlHideSnippet();
  const el = renderTimelineSnippet(conv, turnNumber);
  document.body.appendChild(el);
  tlActiveSnippet = el;
  tlMoveSnippet(event);
  requestAnimationFrame(() => el.classList.add('visible'));
}

function tlMoveSnippet(event) {
  if (!tlActiveSnippet) return;
  const pad = 14;
  const w = tlActiveSnippet.offsetWidth || 280;
  const h = tlActiveSnippet.offsetHeight || 120;
  let left = event.clientX + pad;
  let top  = event.clientY + pad;
  if (left + w + 8 > window.innerWidth)  left = event.clientX - w - pad;
  if (top  + h + 8 > window.innerHeight) top  = event.clientY - h - pad;
  tlActiveSnippet.style.left = `${Math.max(8, left)}px`;
  tlActiveSnippet.style.top  = `${Math.max(8, top)}px`;
}

function tlHideSnippet() {
  if (!tlActiveSnippet) return;
  const el = tlActiveSnippet;
  tlActiveSnippet = null;
  el.remove();
}

function bindPointHover(selection, cond) {
  selection
    .style('cursor', 'pointer')
    .on('mouseover', (event, d) => {
      if (currentStep === 0 && cond.key !== 'human_human') return;
      tlShowSnippet(cond.key, d.turn, event);
    })
    .on('mousemove', (e) => {
      if (currentStep === 0 && cond.key !== 'human_human') return;
      tlMoveSnippet(e);
    })
    .on('mouseout', () => { tlHideSnippet(); });
}

function trimTrailingSparse(points, minCount = 5) {
  if (!Array.isArray(points) || !points.length) return points || [];
  let end = points.length;
  while (end > 0 && (points[end - 1].count || 0) < minCount) end -= 1;
  return points.slice(0, Math.max(end, 1));
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hedgingRegex() {
  const sorted = [...HEDGE_TERMS].sort((a, b) => b.length - a.length);
  const alt = sorted.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\b(${alt})\\b`, 'gi');
}

function highlightHedging(text) {
  const rx = hedgingRegex();
  const out = [];
  let last = 0;
  let m;
  while ((m = rx.exec(text)) !== null) {
    out.push(escapeHtml(text.slice(last, m.index)));
    out.push(`<span style="color:#f0f6fc; font-weight:700;">${escapeHtml(m[0])}</span>`);
    last = m.index + m[0].length;
  }
  out.push(escapeHtml(text.slice(last)));
  return out.join('');
}

function snippetTurnsForHoveredTurn(conv, hoveredTurn) {
  const turns = (conv?.turns || []).slice().sort((a, b) => (+a.turn_number) - (+b.turn_number));
  if (!turns.length) return [];
  const current = turns.find((t) => +t.turn_number === +hoveredTurn) || turns[Math.max(0, Math.min(turns.length - 1, (+hoveredTurn || 1) - 1))];
  if (!current) return [turns[0]];
  const prev = turns.find((t) => +t.turn_number === (+current.turn_number - 1));
  return prev ? [prev, current] : [current];
}

function renderTimelineSnippet(conv, hoveredTurn) {
  const el = document.createElement('div');
  el.className = 'chat-snippet';
  const header = document.createElement('div');
  header.className = 'chat-snippet-header';
  const condText = String(conv?.condition || 'conversation').replaceAll('_', '-').toUpperCase();
  header.textContent = condText;
  el.appendChild(header);

  const turns = snippetTurnsForHoveredTurn(conv, hoveredTurn);
  turns.forEach((t) => {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-mini ${t.speaker === 'model_b' ? 'speaker-b' : 'speaker-a'}`;
    const body = document.createElement('span');
    body.innerHTML = highlightHedging(t.content || t.message || '');
    bubble.appendChild(body);
    el.appendChild(bubble);
  });
  return el;
}

function countHedgingTurns(conv) {
  const rx = hedgingRegex();
  let c = 0;
  (conv?.turns || []).forEach((t) => {
    const text = (t.content || t.message || '');
    if (rx.test(text)) c += 1;
    rx.lastIndex = 0;
  });
  return c;
}

function computeHHSlopeInfo(turnRows) {
  const rows = turnRows.filter((r) => +r.turn_number >= 2);
  const byTurn = d3.group(rows, (r) => +r.turn_number);
  const points = Array.from(byTurn, ([turn, vals]) => ({ turn: +turn, mean: d3.mean(vals, (v) => +v.hedging) }))
    .sort((a, b) => a.turn - b.turn);
  if (points.length < 8) return { valid: false, slope: -Infinity, delta: -Infinity };
  const first = points.filter((p) => p.turn >= 2 && p.turn <= 7);
  const second = points.filter((p) => p.turn >= 8);
  const firstAvg = d3.mean(first, (p) => p.mean) || 0;
  const secondAvg = d3.mean(second, (p) => p.mean) || 0;
  const positive = secondAvg > firstAvg;
  const n = points.length;
  const sx = d3.sum(points, (p) => p.turn);
  const sy = d3.sum(points, (p) => p.mean);
  const sxx = d3.sum(points, (p) => p.turn * p.turn);
  const sxy = d3.sum(points, (p) => p.turn * p.mean);
  const d = n * sxx - sx * sx;
  const slope = Math.abs(d) < 1e-9 ? 0 : (n * sxy - sx * sy) / d;
  return { valid: positive, slope, delta: secondAvg - firstAvg };
}

function selectRepresentativeHumanHumanConversation() {
  const convRows = (fullData?.conversations || []).filter((c) => c.condition === 'human_human' && (+c.num_turns >= 15));
  const byConv = d3.group((fullData?.turnMetrics || []).filter((r) => r.condition === 'human_human'), (r) => r.conversation_id);
  const slopeQualified = convRows
    .map((row) => ({ id: row.conversation_id, ...computeHHSlopeInfo(byConv.get(row.conversation_id) || []) }))
    .filter((x) => x.valid);
  if (!slopeQualified.length) return Promise.resolve(null);

  return Promise.all(slopeQualified.map(async (s) => {
    try {
      const conv = await loadConversation(s.id);
      const hedgedTurns = countHedgingTurns(conv);
      return { ...s, hedgedTurns, conv };
    } catch {
      return null;
    }
  })).then(async (rows) => {
    const valid = rows.filter(Boolean).filter((r) => r.hedgedTurns >= 4);
    valid.sort((a, b) =>
      (b.hedgedTurns - a.hedgedTurns)
      || (b.delta - a.delta)
      || (b.slope - a.slope),
    );
    if (valid[0]?.conv) return valid[0].conv;

    // Fallback: still choose one consistent HH conversation with strong hedge-term coverage.
    const fallbackRows = convRows.map((row) => ({ id: row.conversation_id, ...computeHHSlopeInfo(byConv.get(row.conversation_id) || []) }));
    const loaded = await Promise.all(fallbackRows.map(async (r) => {
      try {
        const conv = await loadConversation(r.id);
        return { ...r, hedgedTurns: countHedgingTurns(conv), conv };
      } catch {
        return null;
      }
    }));
    const ranked = loaded.filter(Boolean).sort((a, b) =>
      (b.hedgedTurns - a.hedgedTurns)
      || (b.delta - a.delta)
      || (b.slope - a.slope),
    );
    return ranked[0]?.conv || null;
  });
}

export function init(data) {
  fullData = data;
  titleEl = document.querySelector('.timeline-title');
  subEl = document.querySelector('.timeline-sub');
  stepCards = Array.from(document.querySelectorAll('#s-timeline .step .step-card'));
  currentStep = -1;

  const chartContainer = document.getElementById('timeline-chart');
  chartContainer.innerHTML = '';
  chartContainer.style.textAlign = 'center';

  conditionData = SHOWN_CONDITIONS.map(cond => {
    // Combined AI-AI line for Act 2: average across all 5 AI-AI subtypes per turn.
    if (cond.key === 'ai_ai_combined') {
      const aiRows = data.turnMetrics.filter(d => AI_AI_KEYS.includes(d.condition));
      const byTurn = d3.group(aiRows, d => d.turn_number);
      const points = [];
      const pointsRep = [];
      for (const [turn, rows] of byTurn) {
        points.push({ turn: +turn, mean: d3.mean(rows, r => r.hedging), count: rows.length });
        pointsRep.push({ turn: +turn, mean: d3.mean(rows, r => +r.repetitiveness), count: rows.length });
      }
      points.sort((a, b) => a.turn - b.turn);
      pointsRep.sort((a, b) => a.turn - b.turn);
      return { ...cond, points, pointsRep };
    }
    const condRows = data.turnMetrics.filter(d => d.condition === cond.key);
    const byTurn = d3.group(condRows, d => d.turn_number);
    const points = [];
    const pointsRep = [];
    for (const [turn, rows] of byTurn) {
      points.push({ turn: +turn, mean: d3.mean(rows, r => r.hedging), count: rows.length });
      pointsRep.push({ turn: +turn, mean: d3.mean(rows, r => +r.repetitiveness), count: rows.length });
    }
    points.sort((a, b) => a.turn - b.turn);
    pointsRep.sort((a, b) => a.turn - b.turn);
    if (cond.key === 'human_human') {
      return { ...cond, points: trimTrailingSparse(points), pointsRep: trimTrailingSparse(pointsRep) };
    }
    return { ...cond, points, pointsRep };
  });

  const chartDiv = document.createElement('div');
  chartDiv.style.display = 'inline-block';
  chartContainer.appendChild(chartDiv);

  const margin = { top: 20, right: 130, bottom: 48, left: 64 };
  width = 980 - margin.left - margin.right;
  height = 500 - margin.top - margin.bottom;

  svg = d3.select(chartDiv).append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  x = d3.scaleLinear().domain([2, 20]).range([0, width]);
  const allMeans = conditionData.flatMap(c => c.points.map(p => p.mean));
  hedgingYMax = Math.max(d3.max(allMeans) || 1, 0.1) * 1.15;
  yScale = d3.scaleLinear().domain([0, hedgingYMax]).range([height, 0]);

  // Axes
  xAxisG = svg.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(18).tickSize(-height).tickFormat(d => d))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#1a1f27'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

  yAxisG = svg.append('g')
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-width).tickFormat(d3.format('.1f')))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#1a1f27'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));

  svg.append('text').attr('x', width / 2).attr('y', height + 36).attr('text-anchor', 'middle')
    .attr('fill', '#484F58').attr('font-size', '12px').attr('font-family', 'Inter, sans-serif').text('Turn Number');
  yAxisLabel = svg.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -36)
    .attr('text-anchor', 'middle').attr('fill', '#484F58').attr('font-size', '12px').attr('font-family', 'Inter, sans-serif').text('Hedging');

  lineGen = d3.line().x(d => x(d.turn)).y(d => yScale(d.mean)).curve(d3.curveMonotoneX);

  groups = {};
  conditionData.forEach(cond => {
    if (cond.points.length < 2) return;
    const g = svg.append('g').attr('opacity', 0).attr('data-key', cond.key);
    const path = g.append('path').datum(cond.points).attr('fill', 'none')
      .attr('stroke', cond.color)
      .attr('stroke-width', cond.key === 'ai_ai_reverse_turing' ? 3 : 1.5)
      .attr('d', lineGen(cond.points))
      .each(function() {
        const len = this.getTotalLength();
        d3.select(this).attr('stroke-dasharray', len).attr('stroke-dashoffset', len);
      });

    const circles = g.selectAll('circle').data(cond.points).join('circle')
      .attr('cx', d => x(d.turn)).attr('cy', d => yScale(d.mean))
      .attr('r', 0).attr('fill', cond.color).attr('stroke', '#0D1117').attr('stroke-width', 1.5)
      .style('pointer-events', 'none');

    // Larger invisible hit-area so hover works around each dot (not only exact pixel hit).
    const hitTargets = g.selectAll('circle.hit-target').data(cond.points).join('circle')
      .attr('class', 'hit-target')
      .attr('cx', d => x(d.turn))
      .attr('cy', d => yScale(d.mean))
      .attr('r', 10)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');
    bindPointHover(hitTargets, cond);

    const last = cond.points[cond.points.length - 1];
    const label = g.append('text').attr('x', x(last.turn) + 8).attr('y', yScale(last.mean) + 4)
      .attr('fill', cond.color).attr('font-size', '11px').attr('font-weight', '600')
      .attr('font-family', 'Inter, sans-serif')
      .text(cond.label);

    groups[cond.key] = { g, path, circles, hitTargets, label, cond, drawn: false };
  });

  act3Trend = createAct3TrendOverlay();
  act4Trend = createAct4TrendOverlay();
  act3AnimationDone = false;
  act3AnimToken += 1;
  hhRepresentativePromise = loadConversation(TIMELINE_HH_EXAMPLE_ID)
    .then((conv) => {
      hhRepresentativeConv = conv;
      if (conv) tlSnippetCache.set('human_human', conv);
      return conv;
    })
    .catch((err) => {
      console.warn('timeline hh fixed exemplar load failed, falling back to runtime selection', err);
      return selectRepresentativeHumanHumanConversation().then((conv) => {
        hhRepresentativeConv = conv;
        if (conv) tlSnippetCache.set('human_human', conv);
        return conv;
      });
    });
  logTimelineCategoryRegressionStats();
  // Timeline layout rule: heading above chart, subtext in left panel only.
  if (subEl) subEl.style.display = 'none';
  stepCards.forEach((card, i) => {
    const h3 = card.querySelector('h3');
    const p = card.querySelector('p');
    if (h3) h3.textContent = '';
    if (p) p.textContent = '';
  });

  setActCopy(0, true);
}

function setActCopy(step, immediate = false) {
  const copy = ACT_COPY[step] || ACT_COPY[3];
  if (!titleEl) return;
  const dur = immediate ? 0 : 240;
  titleEl.style.transition = `opacity ${dur}ms ease`;
  titleEl.style.opacity = '0';
  const apply = () => {
    titleEl.textContent = copy.title;
    titleEl.style.opacity = '1';
    // Side panel text is revealed on a separate beat after line motion starts.
    stepCards.forEach((card, i) => {
      const h3 = card.querySelector('h3');
      const p = card.querySelector('p');
      if (h3) h3.textContent = '';
      if (p) p.textContent = '';
    });
  };
  if (immediate) apply();
  else window.setTimeout(apply, 140);
}

function revealStepSubtext(step, delay = 0) {
  if (subtextTimer) {
    window.clearTimeout(subtextTimer);
    subtextTimer = null;
  }
  const copy = ACT_COPY[step] || ACT_COPY[3];
  subtextTimer = window.setTimeout(() => {
    stepCards.forEach((card, i) => {
      const p = card.querySelector('p');
      if (p) p.textContent = i === step ? copy.sub : '';
    });
  }, delay);
}

function clearLineTransitions() {
  Object.values(groups).forEach((entry) => {
    entry.g.interrupt();
    entry.path.interrupt();
    entry.circles.interrupt();
    entry.hitTargets?.interrupt();
    entry.label.interrupt();
  });
  if (act3Trend) {
    act3Trend.g.interrupt();
    act3Trend.aiPath.interrupt();
    act3Trend.hhPath.interrupt();
    act3Trend.aiLabel.interrupt();
    act3Trend.hhLabel.interrupt();
  }
  if (act4Trend) {
    act4Trend.g.interrupt();
    act4Trend.path.interrupt();
    act4Trend.label.interrupt();
  }
}

function resetLineStyle(entry) {
  const { g, path, circles, label, cond } = entry;
  g.style('filter', null);
  path
    .attr('stroke', cond.color)
    .attr('stroke-width', cond.key === 'ai_ai_reverse_turing' ? 3 : 1.5);
  circles.attr('fill', cond.color);
  label.attr('fill', cond.color);
}

function setVisibility(key, targetOpacity, duration = 450) {
  const entry = groups[key];
  if (!entry) return;
  entry.g.transition().duration(duration).ease(EASE_IN_OUT).attr('opacity', targetOpacity);
}

function setYAxisForMetric(mode = 'hedging', duration = 450) {
  if (!yAxisG || !yAxisLabel) return;
  if (mode === 'repetitiveness') {
    const repMax = d3.max(conditionData.flatMap((c) => (c.pointsRep || []).map((p) => p.mean))) || 0.2;
    yScale.domain([0, Math.max(repMax * 1.15, 0.15)]);
    yAxisLabel.text('Repetitiveness');
  } else {
    yScale.domain([0, hedgingYMax]);
    yAxisLabel.text('Hedging');
  }
  yAxisG.transition().duration(duration).ease(EASE_IN_OUT)
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-width).tickFormat(d3.format('.1f')))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke', '#1a1f27'))
    .call(g => g.selectAll('.tick text').attr('fill', '#8B949E').attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace'));
}

function materializeLinePoints(key, points, { duration = 500, opacity = 1, strokeWidth = null } = {}) {
  const entry = groups[key];
  if (!entry || !points?.length) return;
  const { g, path, circles, hitTargets, cond } = entry;
  resetLineStyle(entry);
  const sw = strokeWidth ?? (cond.key === 'ai_ai_reverse_turing' ? 3 : 1.5);
  path.attr('d', lineGen(points))
    .transition().duration(duration).ease(EASE_IN_OUT)
    .attr('stroke-dasharray', null).attr('stroke-dashoffset', null).attr('stroke-width', sw);
  circles.transition().duration(duration).ease(EASE_IN_OUT)
    .attr('cx', d => x(d.turn)).attr('cy', d => {
      const p = points.find((pt) => pt.turn === d.turn);
      return yScale((p && Number.isFinite(p.mean)) ? p.mean : points[0].mean);
    }).attr('r', 2.6);
  hitTargets?.transition().duration(duration).ease(EASE_IN_OUT)
    .attr('cx', d => x(d.turn)).attr('cy', d => {
      const p = points.find((pt) => pt.turn === d.turn);
      return yScale((p && Number.isFinite(p.mean)) ? p.mean : points[0].mean);
    });
  g.transition().duration(duration).ease(EASE_IN_OUT).attr('opacity', opacity);
}

function pickRepetitivenessStandoutKey() {
  const subtypes = conditionData.filter((c) => AI_AI_KEYS.includes(c.key) && c.pointsRep?.length);
  if (subtypes.length < 2) return null;
  const means = subtypes.map((c) => ({ key: c.key, mean: d3.mean(c.pointsRep, (p) => p.mean) || 0 }));
  const globalMean = d3.mean(means, (m) => m.mean) || 0;
  const ranked = means
    .map((m) => ({ ...m, delta: Math.abs(m.mean - globalMean) }))
    .sort((a, b) => b.delta - a.delta);
  return ranked[0] && ranked[0].delta > 0.02 ? ranked[0].key : null;
}

function drawLine(key, { duration = 800 } = {}) {
  const entry = groups[key];
  if (!entry) return;
  const { g, path, circles, hitTargets, cond } = entry;
  resetLineStyle(entry);
  g.attr('opacity', 1);
  path.attr('stroke-width', cond.key === 'ai_ai_reverse_turing' ? 3 : 1.5);
  const len = path.node().getTotalLength();
  path.attr('stroke-dasharray', len).attr('stroke-dashoffset', len)
    .transition().duration(duration).ease(EASE_OUT)
    .attr('stroke-dashoffset', 0);
  circles
    .attr('r', 0)
    .transition().duration(260).delay(duration * 0.75)
    .attr('r', 2.6);
  hitTargets?.attr('cx', d => x(d.turn)).attr('cy', d => yScale(d.mean));
  entry.drawn = true;
}

function materializeLine(key, { duration = 500, opacity = 1, strokeWidth = null } = {}) {
  const entry = groups[key];
  if (!entry) return;
  const { g, path, circles, hitTargets, cond } = entry;
  resetLineStyle(entry);
  const sw = strokeWidth ?? (cond.key === 'ai_ai_reverse_turing' ? 3 : 1.5);
  path.attr('d', lineGen(cond.points))
    .transition().duration(duration).ease(EASE_IN_OUT)
    .attr('stroke-dasharray', null).attr('stroke-dashoffset', null).attr('stroke-width', sw);
  circles.transition().duration(duration).ease(EASE_IN_OUT)
    .attr('cx', d => x(d.turn)).attr('cy', d => yScale(d.mean)).attr('r', 2.6);
  hitTargets?.transition().duration(duration).ease(EASE_IN_OUT)
    .attr('cx', d => x(d.turn)).attr('cy', d => yScale(d.mean));
  g.transition().duration(duration).ease(EASE_IN_OUT).attr('opacity', opacity);
  entry.drawn = true;
}

function fanOutFromOrigin(key, order) {
  const entry = groups[key];
  if (!entry) return;
  const { g, path, circles, hitTargets, cond } = entry;
  resetLineStyle(entry);

  const sharedOriginMean = d3.mean(
    AI_AI_KEYS
      .map((k) => conditionData.find((c) => c.key === k))
      .filter(Boolean)
      .map((c) => c.points[0]?.mean ?? 0),
  );
  const fromPoints = cond.points.map(() => ({ turn: 2, mean: sharedOriginMean }));

  path
    .attr('stroke-dasharray', null)
    .attr('stroke-dashoffset', null)
    .attr('stroke-width', cond.key === 'ai_ai_reverse_turing' ? 3 : 1.5)
    .attr('d', lineGen(fromPoints))
    .transition()
    .delay(order * 100)
    .duration(600)
    .ease(EASE_OUT)
    .attrTween('d', () => {
      const interp = d3.interpolateArray(fromPoints, cond.points);
      return (t) => lineGen(interp(t));
    });

  circles
    .attr('cx', x(2))
    .attr('cy', yScale(sharedOriginMean))
    .attr('r', 0)
    .transition()
    .delay(order * 100 + 220)
    .duration(600)
    .ease(EASE_OUT)
    .attr('cx', d => x(d.turn))
    .attr('cy', d => yScale(d.mean))
    .attr('r', 2.6);
  hitTargets?.attr('cx', x(2))
    .attr('cy', yScale(sharedOriginMean))
    .transition()
    .delay(order * 100 + 220)
    .duration(600)
    .ease(EASE_OUT)
    .attr('cx', d => x(d.turn))
    .attr('cy', d => yScale(d.mean));

  g.attr('opacity', 0)
    .transition()
    .delay(order * 100)
    .duration(220)
    .attr('opacity', 1);
  entry.drawn = true;
}

function fanOutFromCombined(key, order) {
  const entry = groups[key];
  const combined = groups.ai_ai_combined;
  if (!entry || !combined) return;
  const { g, path, circles, hitTargets, cond } = entry;
  resetLineStyle(entry);

  const comboPts = combined.cond.points;
  if (!comboPts || !comboPts.length || !cond.points.length) return;
  const comboByTurn = new Map(comboPts.map((p) => [p.turn, p.mean]));
  const fromPoints = cond.points.map((p) => ({ turn: p.turn, mean: comboByTurn.get(p.turn) ?? comboPts[0].mean }));

  path
    .attr('stroke-dasharray', null)
    .attr('stroke-dashoffset', null)
    .attr('stroke-width', cond.key === 'ai_ai_reverse_turing' ? 3 : 1.5)
    .attr('d', lineGen(fromPoints))
    .transition()
    .delay(order * 100)
    .duration(600)
    .ease(EASE_OUT)
    .attrTween('d', () => {
      const interp = d3.interpolateArray(fromPoints, cond.points);
      return (t) => lineGen(interp(t));
    });

  circles
    .attr('cx', d => x(d.turn))
    .attr('cy', d => yScale(comboByTurn.get(d.turn) ?? comboPts[0].mean))
    .attr('r', 0)
    .transition()
    .delay(order * 100 + 220)
    .duration(600)
    .ease(EASE_OUT)
    .attr('cx', d => x(d.turn))
    .attr('cy', d => yScale(d.mean))
    .attr('r', 2.6);
  hitTargets?.attr('cx', d => x(d.turn))
    .attr('cy', d => yScale(comboByTurn.get(d.turn) ?? comboPts[0].mean))
    .transition()
    .delay(order * 100 + 220)
    .duration(600)
    .ease(EASE_OUT)
    .attr('cx', d => x(d.turn))
    .attr('cy', d => yScale(d.mean));

  g.attr('opacity', 0)
    .transition()
    .delay(order * 100)
    .duration(220)
    .attr('opacity', 1);
  entry.drawn = true;
}

function createAct3TrendOverlay() {
  const aiPoints = computeRegressionPoints((row) => AI_AI_KEYS.includes(row.condition));
  const hhPoints = computeRegressionPoints((row) => row.condition === 'human_human');
  const g = svg.append('g').attr('class', 'act3-trendline').attr('opacity', 0);

  const aiPath = g.append('path')
    .attr('fill', 'none')
    .attr('stroke', '#FF4D6D')
    .attr('stroke-width', 2)
    .attr('d', lineGen(aiPoints));
  const hhPath = g.append('path')
    .attr('fill', 'none')
    .attr('stroke', '#F1C40F')
    .attr('stroke-width', 2)
    .attr('d', lineGen(hhPoints));

  const aiLast = aiPoints[aiPoints.length - 1];
  const hhLast = hhPoints[hhPoints.length - 1];
  const aiLabel = g.append('text')
    .attr('x', x(aiLast.turn) + 10)
    .attr('y', yScale(aiLast.mean) - 10)
    .attr('fill', '#FF4D6D')
    .attr('font-size', '11px')
    .attr('font-family', 'Inter, sans-serif')
    .text('All trending down')
    .attr('opacity', 0);
  const hhLabel = g.append('text')
    .attr('x', x(hhLast.turn) + 10)
    .attr('y', yScale(hhLast.mean) + 14)
    .attr('fill', '#F1C40F')
    .attr('font-size', '11px')
    .attr('font-family', 'Inter, sans-serif')
    .text('Human-Human trend')
    .attr('opacity', 0);

  return { g, aiPath, hhPath, aiLabel, hhLabel, aiPoints, hhPoints };
}

function buildMeanPoints(rowFilter) {
  const filtered = (fullData?.turnMetrics || []).filter((row) =>
    rowFilter(row) && row.turn_number >= 2 && row.turn_number <= 20,
  );
  const byTurn = d3.group(filtered, (row) => row.turn_number);
  return Array.from(byTurn, ([turn, rows]) => ({
    turn: +turn,
    mean: d3.mean(rows, (r) => r.hedging),
    count: rows.length,
  })).sort((a, b) => a.turn - b.turn);
}

function fitWeightedRegression(meanPoints) {
  // Weighted least squares with per-turn row counts as weights.
  const points = meanPoints.filter((p) => Number.isFinite(p.mean) && p.count > 0);
  if (!points.length) return { slope: 0, intercept: 0 };
  const sw = d3.sum(points, (p) => p.count);
  const swx = d3.sum(points, (p) => p.count * p.turn);
  const swy = d3.sum(points, (p) => p.count * p.mean);
  const swxx = d3.sum(points, (p) => p.count * p.turn * p.turn);
  const swxy = d3.sum(points, (p) => p.count * p.turn * p.mean);
  const denom = sw * swxx - swx * swx;
  const slope = Math.abs(denom) < 1e-9 ? 0 : (sw * swxy - swx * swy) / denom;
  const intercept = (swy - slope * swx) / Math.max(sw, 1e-9);
  return { slope, intercept };
}

function computeRegressionPoints(rowFilter) {
  const meanPoints = buildMeanPoints(rowFilter);
  const { slope, intercept } = fitWeightedRegression(meanPoints);
  // Draw only over observed turns for this condition to avoid noisy extrapolation.
  return meanPoints.map((p) => ({ turn: p.turn, mean: intercept + slope * p.turn }));
}

function computeRegressionStats(meanPoints) {
  const { slope, intercept } = fitWeightedRegression(meanPoints);
  return {
    slope,
    startTurn2: intercept + slope * 2,
    endTurn20: intercept + slope * 20,
  };
}

function logTimelineCategoryRegressionStats() {
  const rows = fullData?.turnMetrics || [];
  const categories = [
    { name: 'Human-Human', filter: (r) => r.condition === 'human_human' },
    { name: 'AI-AI (combined)', filter: (r) => AI_AI_KEYS.includes(r.condition) },
    { name: 'AI-AI Freeform', filter: (r) => r.condition === 'ai_ai_freeform' },
    { name: 'AI-AI Persona', filter: (r) => r.condition === 'ai_ai_freeform_persona' },
    { name: 'AI-AI Detective', filter: (r) => r.condition === 'ai_ai_detective' },
    { name: 'AI-AI Reverse Turing', filter: (r) => r.condition === 'ai_ai_reverse_turing' },
    { name: 'AI-AI Structured', filter: (r) => r.condition === 'ai_ai_structured' },
  ];

  categories.forEach(({ name, filter }) => {
    const meanPoints = buildMeanPoints(filter);

    const stats = computeRegressionStats(meanPoints);
    console.log(
      `[timeline] ${name} | slope(2-20): ${stats.slope.toFixed(6)} | start(t2): ${stats.startTurn2.toFixed(4)} | end(t20): ${stats.endTurn20.toFixed(4)}`,
    );
  });
}

function resetAct3TrendOverlay() {
  if (!act3Trend) return;
  act3Trend.g.attr('opacity', 0);
  act3Trend.aiLabel.attr('opacity', 0);
  act3Trend.hhLabel.attr('opacity', 0);
  act3Trend.aiPath
    .attr('stroke', '#FF4D6D')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', null)
    .attr('stroke-dashoffset', null)
    .attr('d', lineGen(act3Trend.aiPoints));
  act3Trend.hhPath
    .attr('stroke', '#F1C40F')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', null)
    .attr('stroke-dashoffset', null)
    .attr('d', lineGen(act3Trend.hhPoints));
}

function createAct4TrendOverlay() {
  const rtPoints = computeRegressionPoints((row) => row.condition === 'ai_ai_reverse_turing');
  const g = svg.append('g').attr('class', 'act4-trendline').attr('opacity', 0);
  const path = g.append('path')
    .attr('fill', 'none')
    .attr('stroke', '#FF006E')
    .attr('stroke-width', 2)
    .attr('d', lineGen(rtPoints));
  const last = rtPoints[rtPoints.length - 1];
  const label = g.append('text')
    .attr('x', x(last.turn) + 10)
    .attr('y', yScale(last.mean) - 10)
    .attr('fill', '#FF006E')
    .attr('font-size', '11px')
    .attr('font-family', 'Inter, sans-serif')
    .text('Reverse Turing trend')
    .attr('opacity', 0);
  return { g, path, label, points: rtPoints };
}

function resetAct4TrendOverlay() {
  if (!act4Trend) return;
  act4Trend.g.attr('opacity', 0);
  act4Trend.label.attr('opacity', 0);
  act4Trend.path
    .attr('stroke', '#FF006E')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', null)
    .attr('stroke-dashoffset', null)
    .attr('d', lineGen(act4Trend.points));
}

function runAct3TrendSequence() {
  if (!act3Trend) return;
  act3AnimToken += 1;
  const token = act3AnimToken;
  act3AnimationDone = false;
  resetAct3TrendOverlay();

  // Phase 1 — dim AI-AI subtype lines, keep Human-Human as-is.
  AI_AI_KEYS.forEach((key) => {
    const entry = groups[key];
    if (!entry) return;
    entry.g.transition().duration(600).ease(EASE_IN_OUT).attr('opacity', 0.2);
  });

  // Phase 2 — draw trendline.
  const aiLen = act3Trend.aiPath.node().getTotalLength();
  const hhLen = act3Trend.hhPath.node().getTotalLength();
  act3Trend.g.attr('opacity', 1);
  act3Trend.aiPath
    .attr('stroke-dasharray', aiLen)
    .attr('stroke-dashoffset', aiLen)
    .transition()
    .delay(600)
    .duration(800)
    .ease(EASE_IN_OUT)
    .attr('stroke-dashoffset', 0);
  act3Trend.hhPath
    .attr('stroke-dasharray', hhLen)
    .attr('stroke-dashoffset', hhLen)
    .transition()
    .delay(600)
    .duration(800)
    .ease(EASE_IN_OUT)
    .attr('stroke-dashoffset', 0);

  // Phase 3 — fade annotation.
  act3Trend.aiLabel
    .transition()
    .delay(1400)
    .duration(400)
    .ease(EASE_IN_OUT)
    .attr('opacity', 1);
  act3Trend.hhLabel
    .transition()
    .delay(1400)
    .duration(400)
    .ease(EASE_IN_OUT)
    .attr('opacity', 1)
    .on('end', () => {
      if (token !== act3AnimToken) return;
      act3AnimationDone = true;
    });
}

function removeRevealAnnotations() {
  if (annotationTimer) {
    window.clearTimeout(annotationTimer);
    annotationTimer = null;
  }
  svg.selectAll('.rt-reveal-annotation').interrupt().transition().duration(220).attr('opacity', 0).remove();
}

function renderRevealAnnotations() {
  removeRevealAnnotations();
  const rt = conditionData.find(c => c.key === 'ai_ai_reverse_turing');
  if (!rt || rt.points.length < 16) return;

  const earlyAvg = d3.mean(rt.points.slice(0, 3), p => p.mean);
  const lateAvg = d3.mean(rt.points.slice(-3), p => p.mean);
  const point14 = rt.points.find((p) => p.turn >= 14) || rt.points[rt.points.length - 1];
  const point11 = rt.points.find((p) => p.turn >= 11) || rt.points[Math.floor(rt.points.length / 2)];

  const labelX = x(point14.turn) + 12;
  const labelY = yScale(point14.mean) - 20;
  const tooltipX = x(point11.turn) - 118;
  const tooltipY = yScale(point11.mean) - 88;

  const ag = svg.append('g').attr('class', 'rt-reveal-annotation').attr('opacity', 0);

  ag.append('text')
    .attr('x', labelX)
    .attr('y', labelY)
    .attr('fill', '#FF006E')
    .attr('font-size', '12px')
    .attr('font-weight', '700')
    .attr('font-family', 'Inter, sans-serif')
    .text('Still climbing at turn 20');
  ag.append('polygon')
    .attr('points', `${labelX + 152},${labelY - 10} ${labelX + 164},${labelY - 10} ${labelX + 158},${labelY - 18}`)
    .attr('fill', '#FF006E');

  ag.append('rect')
    .attr('x', tooltipX)
    .attr('y', tooltipY)
    .attr('width', 236)
    .attr('height', 46)
    .attr('rx', 6)
    .attr('fill', 'rgba(13,17,23,0.92)')
    .attr('stroke', '#FF006E')
    .attr('stroke-width', 1);
  ag.append('text')
    .attr('x', tooltipX + 12)
    .attr('y', tooltipY + 18)
    .attr('fill', '#FF006E')
    .attr('font-size', '11px')
    .attr('font-weight', '700')
    .attr('font-family', 'Inter, sans-serif')
    .text('Only line that goes up');
  ag.append('text')
    .attr('x', tooltipX + 12)
    .attr('y', tooltipY + 34)
    .attr('fill', '#8B949E')
    .attr('font-size', '11px')
    .attr('font-family', 'Inter, sans-serif')
    .text(`+${(lateAvg - earlyAvg).toFixed(2)} over time`);
  ag.append('line')
    .attr('x1', tooltipX + 236)
    .attr('y1', tooltipY + 24)
    .attr('x2', x(point11.turn))
    .attr('y2', yScale(point11.mean) - 4)
    .attr('stroke', '#FF006E')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3');

  ag.transition().duration(380).ease(EASE_OUT).attr('opacity', 1);
}

function enterAct0() {
  removeRevealAnnotations();
  tlHideSnippet();
  act3AnimationDone = false;
  act3AnimToken += 1;
  setYAxisForMetric('hedging');
  resetAct3TrendOverlay();
  resetAct4TrendOverlay();
  Object.keys(groups).forEach((key) => {
    if (key !== 'human_human') setVisibility(key, 0, 350);
  });
  // Act 1: line starts right after title settles.
  if (act0EntranceTimer) window.clearTimeout(act0EntranceTimer);
  act0EntranceTimer = window.setTimeout(() => {
    if (currentStep === 0) drawLine('human_human', { duration: 600 });
  }, 120);
  revealStepSubtext(0, 420);
}

function enterAct1() {
  removeRevealAnnotations();
  act3AnimationDone = false;
  act3AnimToken += 1;
  setYAxisForMetric('hedging');
  resetAct3TrendOverlay();
  resetAct4TrendOverlay();
  setVisibility('human_human', 1, 360);
  materializeLine('human_human', { duration: 360, opacity: 1, strokeWidth: 1.5 });
  drawLine('ai_ai_combined', { duration: 800 });
  AI_AI_KEYS.forEach((key) => setVisibility(key, 0, 320));
  revealStepSubtext(1, 340);
}

function enterAct2() {
  removeRevealAnnotations();
  act3AnimationDone = false;
  setYAxisForMetric('hedging');
  resetAct3TrendOverlay();
  resetAct4TrendOverlay();
  materializeLine('human_human', { duration: 420, opacity: 0.35, strokeWidth: 1.5 });
  materializeLine('ai_ai_combined', { duration: 260, opacity: 0, strokeWidth: 1.5 });
  AI_AI_KEYS.forEach((key, i) => fanOutFromCombined(key, i));
  // Start Act 3 sequence after fracture fan-out has finished + short pause.
  window.setTimeout(() => {
    if (currentStep === 2) runAct3TrendSequence();
  }, 1800);
  revealStepSubtext(2, 340);
}

function enterAct3() {
  removeRevealAnnotations();
  setYAxisForMetric('hedging');
  resetAct3TrendOverlay();
  Object.entries(groups).forEach(([key, entry]) => {
    if (key === 'ai_ai_combined') {
      entry.g.style('filter', null);
      entry.g.transition().duration(350).ease(EASE_IN_OUT).attr('opacity', 0);
      return;
    }
    const isRt = key === 'ai_ai_reverse_turing';
    if (isRt) {
      entry.g.style('filter', null);
      entry.path.transition().duration(1200).ease(EASE_IN_OUT)
        .attr('stroke-width', 3)
        .attr('stroke', '#FF006E');
      entry.g.transition().duration(1200).ease(EASE_IN_OUT).attr('opacity', 1);
      return;
    }
    entry.g.transition().duration(1200).ease(EASE_IN_OUT).attr('opacity', 0.15);
    entry.path.transition().duration(1200).ease(EASE_IN_OUT).attr('stroke-width', 1);
    entry.g.style('filter', 'saturate(0.15)');
  });

  if (act4Trend) {
    const len = act4Trend.path.node().getTotalLength();
    act4Trend.g.attr('opacity', 1);
    act4Trend.path
      .attr('stroke-dasharray', len)
      .attr('stroke-dashoffset', len)
      .transition()
      .delay(1200)
      .duration(800)
      .ease(EASE_IN_OUT)
      .attr('stroke-dashoffset', 0);
    act4Trend.label
      .transition()
      .delay(2000)
      .duration(260)
      .ease(EASE_IN_OUT)
      .attr('opacity', 1);
  }

  annotationTimer = window.setTimeout(() => {
    if (currentStep === 3) renderRevealAnnotations();
  }, 2000);
  revealStepSubtext(3, 340);
}

function enterAct4() {
  removeRevealAnnotations();
  setYAxisForMetric('repetitiveness');
  resetAct3TrendOverlay();
  resetAct4TrendOverlay();

  const selected = new Set(['human_human', 'ai_ai_combined']);
  const standout = pickRepetitivenessStandoutKey();
  if (standout) selected.add(standout);

  Object.entries(groups).forEach(([key]) => {
    if (!selected.has(key)) {
      setVisibility(key, 0, 320);
      return;
    }
    const cond = conditionData.find((c) => c.key === key);
    materializeLinePoints(key, cond?.pointsRep || [], { duration: 640, opacity: key === 'human_human' ? 1 : 0.95, strokeWidth: 2 });
  });
  revealStepSubtext(4, 340);
}

export function onStep(step) {
  // Gate Act 4 until Act 3 trendline + annotation sequence has fully completed.
  if (step >= 3 && !act3AnimationDone) return;
  if (step === currentStep) return;
  if (act0EntranceTimer) {
    window.clearTimeout(act0EntranceTimer);
    act0EntranceTimer = null;
  }
  if (subtextTimer) {
    window.clearTimeout(subtextTimer);
    subtextTimer = null;
  }
  clearLineTransitions();
  removeRevealAnnotations();
  currentStep = step;
  setActCopy(step);

  if (step <= 0) {
    enterAct0();
  } else if (step === 1) {
    enterAct1();
  } else if (step === 2) {
    enterAct2();
  } else if (step === 3) {
    enterAct3();
  } else {
    enterAct4();
  }
}
