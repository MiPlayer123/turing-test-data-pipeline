/**
 * Compute a composite "humanness" score for each conversation.
 *
 * humanness = 0.4 * norm(hedging)
 *           + 0.3 * (1 - norm(repetitiveness))
 *           + 0.3 * norm(vocab_diversity)
 *
 * norm() = min-max normalization across all conversations.
 * Higher score = more human-like patterns.
 */

function minMax(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return v => (v - min) / range;
}

export function computeHumanness(conversations) {
  const normHedge = minMax(conversations.map(c => c.hedging));
  const normRep = minMax(conversations.map(c => c.repetitiveness));
  const normVocab = minMax(conversations.map(c => c.vocab_diversity));

  return conversations.map(c => ({
    ...c,
    humanness: (
      0.4 * normHedge(c.hedging) +
      0.3 * (1 - normRep(c.repetitiveness)) +
      0.3 * normVocab(c.vocab_diversity)
    ),
  }));
}

export const HUMANNESS_FORMULA = 'humanness = 0.4 × hedging + 0.3 × (1 − repetitiveness) + 0.3 × vocab diversity';
