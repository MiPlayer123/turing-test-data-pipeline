import * as d3 from 'd3';
import { MODEL_LABELS } from '../data/constants.js';
import { loadConversation } from '../data/loader.js';

let chatPanel, metricsPanel, conversation, currentStep = -1;

// Pick a specific reverse turing conversation for the deep-dive
const DEEPDIVE_CONV_ID = 'conv_ai_ai_reverse_turing_gpt54mini_llama4scout_F1_1775412731';

export async function init(data) {
  const container = document.getElementById('deepdive-viz');
  container.innerHTML = '';

  // Chat panel (left side)
  chatPanel = document.createElement('div');
  chatPanel.style.cssText = 'flex:1; max-width:480px; max-height:70vh; overflow-y:auto; padding:16px;';
  container.appendChild(chatPanel);

  // Metrics panel (right side)
  metricsPanel = document.createElement('div');
  metricsPanel.style.cssText = 'width:300px; padding:16px;';
  container.appendChild(metricsPanel);

  // Load the conversation
  try {
    conversation = await loadConversation(DEEPDIVE_CONV_ID);
    renderChat(0); // Start with no turns visible
    renderMetrics(0);
  } catch (e) {
    chatPanel.innerHTML = '<p style="color:#8B949E;">Loading conversation...</p>';
    // Fallback: try to find any reverse turing conversation
    const rtConv = data.conversations.find(c => c.condition === 'ai_ai_reverse_turing');
    if (rtConv) {
      try {
        conversation = await loadConversation(rtConv.conversation_id);
        renderChat(0);
        renderMetrics(0);
      } catch (e2) {
        chatPanel.innerHTML = '<p style="color:#E74C3C;">Could not load conversation</p>';
      }
    }
  }
}

export function onStep(step) {
  if (step === currentStep || !conversation) return;
  currentStep = step;

  const totalTurns = conversation.turns.length;
  let visibleTurns;

  if (step === 0) visibleTurns = 0;
  else if (step === 1) visibleTurns = Math.min(4, totalTurns);
  else if (step === 2) visibleTurns = Math.min(10, totalTurns);
  else visibleTurns = totalTurns;

  renderChat(visibleTurns);
  renderMetrics(visibleTurns);
}

function renderChat(visibleTurns) {
  if (!conversation) return;
  const turns = conversation.turns.slice(0, visibleTurns);

  chatPanel.innerHTML = turns.length === 0
    ? '<p style="color:#484F58; text-align:center; padding:40px; font-family:Inter,sans-serif; font-size:14px;">Scroll to reveal the conversation...</p>'
    : '';

  const modelA = MODEL_LABELS[conversation.model_a] || conversation.model_a;
  const modelB = MODEL_LABELS[conversation.model_b] || conversation.model_b;

  turns.forEach((t, i) => {
    const isA = t.speaker === 'model_a';
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isA ? 'speaker-a' : 'speaker-b'}`;
    bubble.style.opacity = '0';
    bubble.style.transform = 'translateY(8px)';
    bubble.innerHTML = `
      <div class="chat-speaker">${isA ? modelA : modelB}</div>
      ${t.content.length > 300 ? t.content.slice(0, 300) + '...' : t.content}
      <div class="chat-turn-num">Turn ${t.turn_number}</div>
    `;
    chatPanel.appendChild(bubble);

    // Stagger animation
    setTimeout(() => {
      bubble.style.transition = 'opacity 0.3s, transform 0.3s';
      bubble.style.opacity = '1';
      bubble.style.transform = 'translateY(0)';
    }, i * 50);
  });

  // Scroll to bottom
  chatPanel.scrollTop = chatPanel.scrollHeight;
}

function renderMetrics(visibleTurns) {
  if (!conversation) return;

  const turns = conversation.turns.slice(0, visibleTurns);
  if (turns.length === 0) {
    metricsPanel.innerHTML = '';
    return;
  }

  // Compute running metrics
  const hedgeWords = ['maybe', 'perhaps', 'probably', 'i think', 'i believe', 'i guess',
    'sort of', 'kind of', 'it seems', 'not sure', 'i suppose', 'i feel like',
    'a bit', 'a little', 'possibly', 'apparently'];

  let totalWords = 0, totalHedges = 0;
  const allText = turns.map(t => t.content).join(' ').toLowerCase();
  totalWords = allText.split(/\s+/).length;
  hedgeWords.forEach(h => {
    const regex = new RegExp(h, 'gi');
    const matches = allText.match(regex);
    if (matches) totalHedges += matches.length;
  });

  const hedging = totalWords > 0 ? (totalHedges / totalWords * 100).toFixed(2) : '0.00';

  // Repetitiveness (simplified)
  let repScore = 0;
  const speakerTurns = {};
  turns.forEach(t => {
    if (!speakerTurns[t.speaker]) speakerTurns[t.speaker] = [];
    speakerTurns[t.speaker].push(t.content.toLowerCase());
  });
  Object.values(speakerTurns).forEach(texts => {
    for (let i = 1; i < texts.length; i++) {
      const words1 = new Set(texts[i-1].split(/\s+/));
      const words2 = new Set(texts[i].split(/\s+/));
      const intersection = [...words1].filter(w => words2.has(w)).length;
      const union = new Set([...words1, ...words2]).size;
      if (union > 0) repScore += intersection / union;
    }
  });
  const totalPairs = Object.values(speakerTurns).reduce((s, t) => s + Math.max(0, t.length - 1), 0);
  const repetitiveness = totalPairs > 0 ? (repScore / totalPairs).toFixed(4) : '0.0000';

  metricsPanel.innerHTML = `
    <div style="font-family:Inter,sans-serif; font-size:14px; font-weight:600; color:#d0d7de; margin-bottom:16px;">
      Metrics through turn ${turns[turns.length-1].turn_number}
    </div>
    <div style="margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <span style="font-family:Inter,sans-serif; font-size:13px; color:#8B949E;">Hedging</span>
        <span style="font-family:JetBrains Mono,monospace; font-size:13px; color:#f0f3f6; font-weight:600;">${hedging}</span>
      </div>
      <div style="background:#21262D; border-radius:4px; height:8px; overflow:hidden;">
        <div style="background:#F39C12; height:100%; width:${Math.min(+hedging / 2 * 100, 100)}%; border-radius:4px; transition:width 0.5s;"></div>
      </div>
    </div>
    <div style="margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <span style="font-family:Inter,sans-serif; font-size:13px; color:#8B949E;">Repetitiveness</span>
        <span style="font-family:JetBrains Mono,monospace; font-size:13px; color:#f0f3f6; font-weight:600;">${repetitiveness}</span>
      </div>
      <div style="background:#21262D; border-radius:4px; height:8px; overflow:hidden;">
        <div style="background:#E74C3C; height:100%; width:${Math.min(+repetitiveness * 500, 100)}%; border-radius:4px; transition:width 0.5s;"></div>
      </div>
    </div>
    <div style="font-family:Inter,sans-serif; font-size:12px; color:#484F58; line-height:1.5;">
      ${conversation.model_a} ↔ ${conversation.model_b}<br>
      Condition: Reverse Turing<br>
      Turns shown: ${turns.length} of ${conversation.turns.length}
    </div>
  `;
}
