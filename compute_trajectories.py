"""
compute_trajectories.py — Compute per-turn cumulative metrics for 3D trajectory visualization.

For each conversation, at every turn t, computes:
  - cumulative repetitiveness (running avg of 3-gram Jaccard, same-speaker consecutive pairs)
  - cumulative coherence (running avg of word-set Jaccard, all consecutive pairs)
  - cumulative hedging (total hedge phrases / total words * 100)

Post-processing:
  - All three metrics are normalized to [0, 1] using global min-max across all conversations.
  - The three top-level categories (human_human, human_ai, ai_ai) are balanced so each
    contributes equally to density: human_human and human_ai are oversampled (with
    replacement) to match the total ai_ai count. All ai_ai conversations are kept.

Outputs:
  data/processed/trajectories.json   — trajectory coordinates per conversation
  data/processed/conversation_texts.json — turn text for side panel (lazy-loaded)

Usage:
    python compute_trajectories.py
"""

import json
import os
import random
from datetime import datetime, timezone

import config
from analyze import load_conversations, tokenize, get_ngrams


def compute_trajectory(conv):
    """Compute per-turn cumulative [repetitiveness, coherence, hedging] for a conversation.

    Returns list of [x, y, z] triplets, one per turn (plus [0,0,0] at the start).
    """
    turns = conv["turns"]
    trajectory = [[0, 0, 0]]  # origin

    # --- Running state for repetitiveness ---
    # Track last turn per speaker for same-speaker consecutive pairs
    last_turn_by_speaker = {}  # speaker -> content string
    rep_sum = 0.0
    rep_count = 0

    # --- Running state for coherence ---
    prev_content = None
    coh_sum = 0.0
    coh_count = 0

    # --- Running state for hedging ---
    total_words = 0
    total_hedges = 0

    for turn in turns:
        content = turn["content"]
        speaker = turn["speaker"]
        text_lower = content.lower()
        tokens = tokenize(content)

        # --- Repetitiveness: same-speaker consecutive 3-gram overlap ---
        if speaker in last_turn_by_speaker:
            prev_tokens = tokenize(last_turn_by_speaker[speaker])
            ngrams_prev = set(get_ngrams(prev_tokens, 3))
            ngrams_curr = set(get_ngrams(tokens, 3))
            if ngrams_prev or ngrams_curr:
                union = ngrams_prev | ngrams_curr
                if len(union) > 0:
                    overlap = len(ngrams_prev & ngrams_curr) / len(union)
                    rep_sum += overlap
                    rep_count += 1
        last_turn_by_speaker[speaker] = content

        # --- Coherence: all consecutive turn pairs ---
        if prev_content is not None:
            words_prev = set(tokenize(prev_content))
            words_curr = set(tokens)
            if words_prev or words_curr:
                union = words_prev | words_curr
                if len(union) > 0:
                    overlap = len(words_prev & words_curr) / len(union)
                    coh_sum += overlap
                    coh_count += 1
        prev_content = content

        # --- Hedging: cumulative hedge phrases per 100 words ---
        total_words += len(tokens)
        for hedge in config.HEDGE_WORDS:
            total_hedges += text_lower.count(hedge)

        # Compute cumulative values
        cum_rep = rep_sum / rep_count if rep_count > 0 else 0.0
        cum_coh = coh_sum / coh_count if coh_count > 0 else 0.0
        cum_hedge = (total_hedges / total_words) * 100 if total_words > 0 else 0.0

        trajectory.append([round(cum_rep, 6), round(cum_coh, 6), round(cum_hedge, 6)])

    return trajectory


def _top_level_category(condition: str) -> str:
    """Map a condition key to one of three top-level categories."""
    if condition == "human_human":
        return "human_human"
    if condition == "human_ai":
        return "human_ai"
    return "ai_ai"


def normalize_trajectories(records: list[dict]) -> list[dict]:
    """Transform, center, and scale each metric to [-1, 1].

    Pipeline per metric:
      1. Apply a power transform (x^exponent) to reduce right-skew.  Each
         metric gets its own exponent tuned to its distribution:
           - repetitiveness: ^0.30  (near cube-root; extremely right-skewed)
           - coherence:      ^0.50  (sqrt; already reasonably symmetric)
           - hedging:        ^0.40  (between sqrt & cube-root; moderate skew)
      2. Center by subtracting the global mean of the transformed values.
      3. Scale by max(|centered|) so the range is exactly [-1, 1].

    This places the bulk of the density at the origin and produces rounded,
    dome-shaped surfaces instead of sharp spikes.
    """
    EXPONENTS = [0.30, 0.50, 0.40]  # rep, coh, hedge

    # Step 1: power-transform every trajectory point in-place
    for rec in records:
        rec["trajectory"] = [
            [round(v ** EXPONENTS[i], 6) for i, v in enumerate(point)]
            for point in rec["trajectory"]
        ]

    # Step 2 & 3: mean-center then scale to [-1, 1]
    all_vals: list[list[float]] = [[], [], []]
    for rec in records:
        for point in rec["trajectory"]:
            for i, v in enumerate(point):
                all_vals[i].append(v)

    means   = [sum(vs) / len(vs) for vs in all_vals]
    abs_maxs = [max(abs(v - means[i]) for v in all_vals[i]) or 1.0 for i in range(3)]

    def scale(v, i):
        return round((v - means[i]) / abs_maxs[i], 6)

    for rec in records:
        rec["trajectory"] = [[scale(p[i], i) for i in range(3)] for p in rec["trajectory"]]
        rec["final"] = rec["trajectory"][-1]

    for i, (name, exp) in enumerate(zip(["rep", "coh", "hedge"], EXPONENTS)):
        raw_mn, raw_mx = min(all_vals[i]), max(all_vals[i])
        print(f"  {name} (^{exp}): transformed=[{raw_mn:.4f},{raw_mx:.4f}]  "
              f"mean={means[i]:.4f}  abs_max={abs_maxs[i]:.4f}")
    return records


def balance_categories(records: list[dict], texts_data: dict, rng: random.Random) -> list[dict]:
    """Oversample human_human and human_ai so all three top-level categories
    have equal representation.  All ai_ai conversations are kept unchanged.
    Duplicated entries get a synthetic id suffix so they remain distinct.
    """
    by_cat: dict[str, list[dict]] = {"human_human": [], "human_ai": [], "ai_ai": []}
    for rec in records:
        by_cat[_top_level_category(rec["condition"])].append(rec)

    target = len(by_cat["ai_ai"])
    print(f"  Category counts before balancing — "
          f"human_human:{len(by_cat['human_human'])}  "
          f"human_ai:{len(by_cat['human_ai'])}  "
          f"ai_ai:{target}")

    balanced = list(by_cat["ai_ai"])

    for cat in ("human_human", "human_ai"):
        pool = by_cat[cat]
        n_extra = target - len(pool)
        extras = rng.choices(pool, k=n_extra)
        for i, rec in enumerate(extras):
            dup = dict(rec)
            dup["id"] = f"{rec['id']}_dup{i}"
            dup["trajectory"] = [list(pt) for pt in rec["trajectory"]]
            dup["final"] = list(rec["final"])
            balanced.append(dup)
            # Mirror the texts entry under the new synthetic id
            if rec["id"] in texts_data:
                texts_data[dup["id"]] = texts_data[rec["id"]]
        balanced.extend(pool)

    rng.shuffle(balanced)
    print(f"  Total after balancing: {len(balanced)} "
          f"({target} human_human, {target} human_ai, {target} ai_ai)")
    return balanced


def main():
    conversations = load_conversations()
    if not conversations:
        print("No conversations found.")
        return

    records = []
    texts_data = {}

    for conv in conversations:
        cid = conv["conversation_id"]
        trajectory = compute_trajectory(conv)

        records.append({
            "id": cid,
            "condition": conv["condition"],
            "model_a": conv.get("model_a", "human"),
            "model_b": conv.get("model_b", "human"),
            "prompt_id": conv.get("opening_prompt_id", ""),
            "num_turns": len(conv["turns"]),
            "trajectory": trajectory,
            "final": trajectory[-1],
        })

        texts_data[cid] = {
            "condition": conv["condition"],
            "model_a": conv.get("model_a", "human"),
            "model_b": conv.get("model_b", "human"),
            "turns": [
                {
                    "turn": t["turn_number"],
                    "speaker": t["speaker"],
                    "model": t.get("model", "human"),
                    "text": t["content"],
                }
                for t in conv["turns"]
            ],
        }

        final = trajectory[-1]
        print(f"  {cid}: rep={final[0]:.4f} coh={final[1]:.4f} hedge={final[2]:.4f} ({len(trajectory)-1} turns)")

    # ── Normalize metrics to [0, 1] ──────────────────────────────────────────
    print("\nNormalizing metrics to [0, 1]...")
    records = normalize_trajectories(records)

    # ── Balance top-level categories ─────────────────────────────────────────
    print("\nBalancing categories...")
    rng = random.Random(42)
    records = balance_categories(records, texts_data, rng)

    # ── Write outputs ─────────────────────────────────────────────────────────
    os.makedirs(config.DATA_PROCESSED_DIR, exist_ok=True)

    trajectory_data = {
        "meta": {
            "generated": datetime.now(timezone.utc).isoformat(),
            "n_conversations": len(records),
            "axes": {
                "x": {"name": "repetitiveness", "description": "Cumulative 3-gram Jaccard overlap (same-speaker), normalized 0–1"},
                "y": {"name": "coherence", "description": "Cumulative word Jaccard overlap (consecutive turns), normalized 0–1"},
                "z": {"name": "hedging", "description": "Cumulative hedge phrases per 100 words, normalized 0–1"},
            },
        },
        "conversations": records,
    }

    traj_path = os.path.join(config.DATA_PROCESSED_DIR, "trajectories.json")
    with open(traj_path, "w") as f:
        json.dump(trajectory_data, f)
    print(f"\nWrote {len(records)} trajectories to {traj_path}")

    texts_path = os.path.join(config.DATA_PROCESSED_DIR, "conversation_texts.json")
    with open(texts_path, "w") as f:
        json.dump(texts_data, f)
    print(f"Wrote {len(texts_data)} conversation texts to {texts_path}")


if __name__ == "__main__":
    main()
