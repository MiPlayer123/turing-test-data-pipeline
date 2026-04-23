// Reusable chat-transcript component.
// - renderInlineSnippet(conversation, { maxTurns }) -> HTMLElement (tooltip-sized)
// - openTranscriptPanel(conversation) -> fills and opens the existing .side-panel
// - closeTranscriptPanel()
//
// Schema note (verified against /data/raw/*.json):
//   conversation.turns[] = { turn_number, speaker: 'model_a'|'model_b', model, content }
//   conversation.{conversation_id, condition, model_a, model_b}

import { loadConversation } from '../data/loader.js';
import { CONDITION_LABEL, MODEL_LABELS } from '../data/constants.js';

const MAX_CHARS = 120;

function truncate(text, max = MAX_CHARS) {
  if (!text) return '';
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function turnText(turn) {
  return turn?.content ?? turn?.message ?? '';
}

function speakerClass(speaker) {
  return speaker === 'model_b' ? 'speaker-b' : 'speaker-a';
}

function speakerName(conv, turn) {
  const model = turn?.model;
  if (model && MODEL_LABELS[model]) return MODEL_LABELS[model];
  if (model) return model;
  // Fallback to conv-level model A/B labels
  if (turn?.speaker === 'model_b' && conv?.model_b) return MODEL_LABELS[conv.model_b] || conv.model_b;
  if (conv?.model_a) return MODEL_LABELS[conv.model_a] || conv.model_a;
  return turn?.speaker || '';
}

// Pick representative turns — prefer the middle of the conversation where the
// exchange has settled (openings are often system-prompt-ish). Fall back to start.
function pickRepresentativeTurns(turns, maxTurns) {
  if (!Array.isArray(turns) || !turns.length) return [];
  const n = turns.length;
  if (n <= maxTurns) return turns.slice();
  const start = Math.max(1, Math.floor(n / 2) - Math.floor(maxTurns / 2));
  return turns.slice(start, start + maxTurns);
}

/**
 * Inline snippet — a small DOM element safe to drop into the document for
 * hover tooltips. Positioned absolutely in the document; caller places it.
 */
export function renderInlineSnippet(conversation, { maxTurns = 3 } = {}) {
  const el = document.createElement('div');
  el.className = 'chat-snippet';

  if (!conversation) {
    el.textContent = 'No conversation.';
    return el;
  }

  const header = document.createElement('div');
  header.className = 'chat-snippet-header';
  const cond = CONDITION_LABEL[conversation.condition] || conversation.condition || '';
  const a = MODEL_LABELS[conversation.model_a] || conversation.model_a || 'A';
  const b = MODEL_LABELS[conversation.model_b] || conversation.model_b || 'B';
  header.textContent = cond ? `${cond} · ${a} ↔ ${b}` : `${a} ↔ ${b}`;
  el.appendChild(header);

  const turns = pickRepresentativeTurns(conversation.turns || [], maxTurns);
  turns.forEach(t => {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-mini ${speakerClass(t.speaker)}`;
    const name = document.createElement('div');
    name.className = 'chat-speaker';
    name.textContent = speakerName(conversation, t);
    bubble.appendChild(name);
    bubble.appendChild(document.createTextNode(truncate(turnText(t))));
    el.appendChild(bubble);
  });

  return el;
}

// ---------------- Transcript side panel ----------------

let panelRefs = null;

function ensurePanel() {
  if (panelRefs && document.body.contains(panelRefs.panel)) return panelRefs;

  let panel     = document.getElementById('conversation-panel');
  let overlay   = document.getElementById('panel-overlay');
  let titleEl   = document.getElementById('panel-title');
  let subEl     = document.getElementById('panel-subtitle');
  let metricsEl = document.getElementById('panel-metrics');
  let chatEl    = document.getElementById('panel-chat');
  let closeBtn  = document.getElementById('panel-close');

  // Inject if not already in the markup
  if (!panel) {
    overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.id = 'panel-overlay';
    document.body.appendChild(overlay);

    panel = document.createElement('div');
    panel.className = 'side-panel';
    panel.id = 'conversation-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <h3 id="panel-title" style="font-family:'Inter',sans-serif; font-size:15px; font-weight:600;">Conversation</h3>
          <p class="text-muted" id="panel-subtitle" style="font-size:12px; margin-top:4px;"></p>
        </div>
        <button class="panel-close" id="panel-close">&times;</button>
      </div>
      <div class="panel-metrics" id="panel-metrics"></div>
      <div class="panel-chat" id="panel-chat"></div>
    `;
    document.body.appendChild(panel);

    titleEl   = panel.querySelector('#panel-title');
    subEl     = panel.querySelector('#panel-subtitle');
    metricsEl = panel.querySelector('#panel-metrics');
    chatEl    = panel.querySelector('#panel-chat');
    closeBtn  = panel.querySelector('#panel-close');
  }

  closeBtn.addEventListener('click', closeTranscriptPanel);
  overlay.addEventListener('click', closeTranscriptPanel);

  panelRefs = { panel, overlay, titleEl, subEl, metricsEl, chatEl, closeBtn };
  return panelRefs;
}

function fmt(v, digits = 3) {
  if (v === undefined || v === null || Number.isNaN(+v)) return '—';
  return (+v).toFixed(digits);
}

function renderMetrics(metricsEl, conv) {
  const rows = [
    { label: 'hedging',    value: fmt(conv.hedging, 3) },
    { label: 'repetitive', value: fmt(conv.repetitiveness, 4) },
    { label: 'coherence',  value: fmt(conv.coherence, 3) },
  ];
  metricsEl.innerHTML = rows.map(m => `
    <div class="panel-metric">
      <span class="pm-value">${m.value}</span>
      <span class="pm-label">${m.label}</span>
    </div>
  `).join('');
}

function renderAllTurns(chatEl, conv) {
  const turns = conv.turns || [];
  chatEl.innerHTML = turns.map(t => {
    const cls = speakerClass(t.speaker);
    const name = speakerName(conv, t);
    // Preserve author-entered newlines, escape HTML via textContent by building nodes
    return `
      <div class="chat-bubble ${cls}">
        <div class="chat-speaker">${escapeHtml(name)}</div>
        <div class="chat-body">${escapeHtml(turnText(t))}</div>
        <div class="chat-turn-num">Turn ${t.turn_number ?? ''}</div>
      </div>
    `;
  }).join('');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Open the side panel for a given conversation. Accepts either a fully-loaded
 * conversation object (with .turns) or a summary row with at least an id/
 * conversation_id — in which case the full transcript is fetched on demand.
 */
export async function openTranscriptPanel(conversation) {
  const refs = ensurePanel();
  const { panel, overlay, titleEl, subEl, metricsEl, chatEl } = refs;

  panel.classList.add('open');
  overlay.classList.add('visible');

  const id = conversation?.conversation_id || conversation?.id;
  const condLabel = CONDITION_LABEL[conversation?.condition] || conversation?.condition || 'Conversation';
  const a = MODEL_LABELS[conversation?.model_a] || conversation?.model_a || '';
  const b = MODEL_LABELS[conversation?.model_b] || conversation?.model_b || '';
  titleEl.textContent = condLabel;
  subEl.textContent = a && b ? `${a} ↔ ${b}` : '';

  // If metrics are on the passed object, render them immediately
  renderMetrics(metricsEl, conversation || {});

  // If we already have turns, render directly. Otherwise load.
  if (Array.isArray(conversation?.turns) && conversation.turns.length) {
    renderAllTurns(chatEl, conversation);
    return;
  }

  if (!id) {
    chatEl.innerHTML = `<p style="text-align:center; color:#E74C3C; padding:40px;">No conversation id.</p>`;
    return;
  }

  chatEl.innerHTML = `<p style="text-align:center; color:#8B949E; padding:40px;">Loading…</p>`;
  try {
    const conv = await loadConversation(id);
    // Prefer metrics from the summary row if present, otherwise whatever the raw file has.
    renderMetrics(metricsEl, {
      hedging:        conversation?.hedging        ?? conv.hedging,
      repetitiveness: conversation?.repetitiveness ?? conv.repetitiveness,
      coherence:      conversation?.coherence      ?? conv.coherence,
    });
    renderAllTurns(chatEl, { ...conv, model_a: conv.model_a || conversation?.model_a, model_b: conv.model_b || conversation?.model_b });
  } catch (err) {
    console.warn('openTranscriptPanel: failed to load', id, err);
    chatEl.innerHTML = `<p style="text-align:center; color:#E74C3C; padding:40px;">Failed to load transcript.</p>`;
  }
}

export function closeTranscriptPanel() {
  const refs = panelRefs;
  if (!refs) return;
  refs.panel.classList.remove('open');
  refs.overlay.classList.remove('visible');
}
