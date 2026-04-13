import * as d3 from 'd3';
import { METRICS } from './constants.js';

const NUMERIC_COLS = [
  'num_turns', 'repetitiveness', 'coherence', 'hedging',
  'response_length_trend', 'vocab_diversity', 'question_freq',
  'formality', 'sentiment_drift', 'turn_length_variance',
];

export async function loadData() {
  const [conversations, turnMetrics, trajectories] = await Promise.all([
    d3.csv('/data/conversations.csv', row => {
      NUMERIC_COLS.forEach(col => { row[col] = +row[col]; });
      row.detective_correct_bool = row.detective_correct === 'True';
      return row;
    }),
    d3.csv('/data/turn_metrics.csv', row => {
      row.turn_number = +row.turn_number;
      row.hedging = +row.hedging;
      row.word_count = +row.word_count;
      return row;
    }),
    fetch('/data/trajectories.json').then(r => r.json()),
  ]);

  return { conversations, turnMetrics, trajectories };
}

export async function loadConversation(conversationId) {
  const resp = await fetch(`/data/raw/${conversationId}.json`);
  if (!resp.ok) throw new Error(`Failed to load ${conversationId}`);
  return resp.json();
}
