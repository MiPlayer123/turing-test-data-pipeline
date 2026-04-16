import { loadConversation } from '../data/loader.js';
import { CONDITION_LABEL, MODEL_LABELS } from '../data/constants.js';

const panel = document.getElementById('conversation-panel');
const overlay = document.getElementById('panel-overlay');
const titleEl = document.getElementById('panel-title');
const subtitleEl = document.getElementById('panel-subtitle');
const metricsEl = document.getElementById('panel-metrics');
const chatEl = document.getElementById('panel-chat');
const closeBtn = document.getElementById('panel-close');

closeBtn.addEventListener('click', close);
overlay.addEventListener('click', close);

export function close() {
  panel.classList.remove('open');
  overlay.classList.remove('visible');
}

export async function openConversation(conversationId, metrics) {
  panel.classList.add('open');
  overlay.classList.add('visible');

  chatEl.innerHTML = '<p style="text-align:center; color:#8B949E; padding:40px;">Loading...</p>';

  if (metrics) {
    titleEl.textContent = `${CONDITION_LABEL[metrics.condition] || metrics.condition}`;
    subtitleEl.textContent = `${MODEL_LABELS[metrics.model_a] || metrics.model_a} ↔ ${MODEL_LABELS[metrics.model_b] || metrics.model_b}`;
    metricsEl.innerHTML = [
      { label: 'hedging', value: (+metrics.hedging).toFixed(3) },
      { label: 'coherence', value: (+metrics.coherence).toFixed(3) },
      { label: 'repetitive', value: (+metrics.repetitiveness).toFixed(4) },
    ].map(m => `
      <div class="panel-metric">
        <span class="pm-value">${m.value}</span>
        <span class="pm-label">${m.label}</span>
      </div>
    `).join('');
  }

  try {
    const conv = await loadConversation(conversationId);
    chatEl.innerHTML = conv.turns.map(t => {
      const cls = t.speaker === 'model_a' ? 'speaker-a' : 'speaker-b';
      const name = MODEL_LABELS[t.model] || t.model;
      return `
        <div class="chat-bubble ${cls}">
          <div class="chat-speaker">${name}</div>
          ${t.content}
          <div class="chat-turn-num">Turn ${t.turn_number}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    chatEl.innerHTML = `<p style="text-align:center; color:#E74C3C; padding:40px;">Failed to load conversation</p>`;
  }
}
