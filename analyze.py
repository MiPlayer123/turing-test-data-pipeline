"""
analyze.py — Reads JSON transcripts, computes metrics, exports CSV.

Usage:
    python analyze.py                          # Compute all metrics, export CSV
    python analyze.py --metrics primary        # Only primary metrics
    python analyze.py --output path/to/out.csv # Custom output path
"""

import argparse
import csv
import glob
import json
import math
import os
import re
from collections import Counter

import config


# ---------------------------------------------------------------------------
# Load conversations
# ---------------------------------------------------------------------------

def load_conversations():
    """Load all JSON conversation files from data/raw/."""
    pattern = os.path.join(config.DATA_RAW_DIR, "*.json")
    files = sorted(glob.glob(pattern))
    conversations = []
    for f in files:
        with open(f) as fp:
            conversations.append(json.load(fp))
    print(f"Loaded {len(conversations)} conversations from {config.DATA_RAW_DIR}")
    return conversations


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def tokenize(text):
    """Simple whitespace + punctuation tokenizer, lowercased."""
    return re.findall(r"[a-z']+", text.lower())


def get_ngrams(tokens, n):
    """Return list of n-grams as tuples."""
    return [tuple(tokens[i:i+n]) for i in range(len(tokens) - n + 1)]


def get_speaker_turns(turns, speaker):
    """Get all turns for a given speaker."""
    return [t for t in turns if t["speaker"] == speaker]


# ---------------------------------------------------------------------------
# Primary Metrics
# ---------------------------------------------------------------------------

def repetitiveness(turns):
    """3-gram overlap between consecutive same-speaker turns, averaged.

    For each speaker, compare consecutive pairs of their turns.
    Overlap = |intersection of 3-grams| / |union of 3-grams|.
    Returns average across all such pairs, for both speakers combined.
    """
    overlaps = []
    for speaker in ["model_a", "model_b"]:
        speaker_turns = get_speaker_turns(turns, speaker)
        for i in range(len(speaker_turns) - 1):
            tokens_a = tokenize(speaker_turns[i]["content"])
            tokens_b = tokenize(speaker_turns[i + 1]["content"])
            ngrams_a = set(get_ngrams(tokens_a, 3))
            ngrams_b = set(get_ngrams(tokens_b, 3))
            if not ngrams_a and not ngrams_b:
                continue
            union = ngrams_a | ngrams_b
            if len(union) == 0:
                continue
            overlap = len(ngrams_a & ngrams_b) / len(union)
            overlaps.append(overlap)
    return sum(overlaps) / len(overlaps) if overlaps else 0.0


def coherence(turns):
    """Jaccard word overlap between consecutive turns (any speaker), averaged."""
    overlaps = []
    for i in range(len(turns) - 1):
        words_a = set(tokenize(turns[i]["content"]))
        words_b = set(tokenize(turns[i + 1]["content"]))
        if not words_a and not words_b:
            continue
        union = words_a | words_b
        if len(union) == 0:
            continue
        overlap = len(words_a & words_b) / len(union)
        overlaps.append(overlap)
    return sum(overlaps) / len(overlaps) if overlaps else 0.0


def hedging_frequency(turns):
    """Count of hedge phrases per 100 words, across all turns."""
    total_words = 0
    total_hedges = 0
    for turn in turns:
        text_lower = turn["content"].lower()
        words = tokenize(text_lower)
        total_words += len(words)
        for hedge in config.HEDGE_WORDS:
            total_hedges += text_lower.count(hedge)
    if total_words == 0:
        return 0.0
    return (total_hedges / total_words) * 100

def hedging_frequency_for_text(text):
    """Hedge phrases per 100 words for one text span."""
    text_lower = text.lower()
    words = tokenize(text_lower)
    total_words = len(words)
    if total_words == 0:
        return 0.0
    total_hedges = 0
    for hedge in config.HEDGE_WORDS:
        total_hedges += text_lower.count(hedge)
    return (total_hedges / total_words) * 100


# ---------------------------------------------------------------------------
# Secondary Metrics
# ---------------------------------------------------------------------------

def response_length_trend(turns):
    """Linear regression slope of word count over turns (excluding opening prompt)."""
    non_opening = [t for t in turns if not t.get("is_opening_prompt", False)]
    if len(non_opening) < 2:
        return 0.0

    xs = list(range(len(non_opening)))
    ys = [len(tokenize(t["content"])) for t in non_opening]

    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denominator = sum((x - mean_x) ** 2 for x in xs)
    if denominator == 0:
        return 0.0
    return numerator / denominator


def vocab_diversity(turns):
    """Type-token ratio: unique words / total words."""
    all_tokens = []
    for turn in turns:
        all_tokens.extend(tokenize(turn["content"]))
    if not all_tokens:
        return 0.0
    return len(set(all_tokens)) / len(all_tokens)


def question_frequency(turns):
    """Average number of question marks per turn."""
    if not turns:
        return 0.0
    counts = [turn["content"].count("?") for turn in turns]
    return sum(counts) / len(counts)


def formality_score(turns):
    """Ratio of formal markers to (formal + informal markers). 1 = very formal, 0 = very informal."""
    formal_count = 0
    informal_count = 0
    for turn in turns:
        text_lower = turn["content"].lower()
        for marker in config.FORMAL_MARKERS:
            formal_count += text_lower.count(marker)
        for marker in config.INFORMAL_MARKERS:
            informal_count += text_lower.count(marker)
    total = formal_count + informal_count
    if total == 0:
        return 0.5  # neutral
    return formal_count / total


def sentiment_drift(turns):
    """Change in sentiment polarity over conversation. Uses TextBlob if available, else 0."""
    try:
        from textblob import TextBlob
    except ImportError:
        return 0.0

    if len(turns) < 2:
        return 0.0

    # Split turns into first half and second half
    mid = len(turns) // 2
    first_half = " ".join(t["content"] for t in turns[:mid])
    second_half = " ".join(t["content"] for t in turns[mid:])

    polarity_first = TextBlob(first_half).sentiment.polarity
    polarity_second = TextBlob(second_half).sentiment.polarity
    return polarity_second - polarity_first


def turn_length_variance(turns):
    """Standard deviation of word count across turns."""
    non_opening = [t for t in turns if not t.get("is_opening_prompt", False)]
    if len(non_opening) < 2:
        return 0.0
    lengths = [len(tokenize(t["content"])) for t in non_opening]
    mean = sum(lengths) / len(lengths)
    variance = sum((l - mean) ** 2 for l in lengths) / len(lengths)
    return math.sqrt(variance)


# ---------------------------------------------------------------------------
# Compute all metrics for one conversation
# ---------------------------------------------------------------------------

def compute_metrics(conv, include_secondary=True):
    """Compute all metrics for a conversation. Returns dict."""
    turns = conv["turns"]

    metrics = {
        "conversation_id": conv["conversation_id"],
        "condition": conv["condition"],
        "model_a": conv["model_a"],
        "model_b": conv["model_b"],
        "prompt_id": conv["opening_prompt_id"],
        "num_turns": len(turns),
        "repetitiveness": round(repetitiveness(turns), 4),
        "coherence": round(coherence(turns), 4),
        "hedging": round(hedging_frequency(turns), 4),
    }

    if include_secondary:
        metrics["response_length_trend"] = round(response_length_trend(turns), 4)
        metrics["vocab_diversity"] = round(vocab_diversity(turns), 4)
        metrics["question_freq"] = round(question_frequency(turns), 4)
        metrics["formality"] = round(formality_score(turns), 4)
        metrics["sentiment_drift"] = round(sentiment_drift(turns), 4)
        metrics["turn_length_variance"] = round(turn_length_variance(turns), 4)

    # Detective-specific
    metadata = conv.get("metadata", {})
    metrics["detective_guess"] = metadata.get("detective_guess", "")
    metrics["detective_correct"] = metadata.get("detective_correct", "")

    return metrics

def compute_turn_metrics(conv):
    """Per-turn metrics used by trajectory/timeline visualizations.

    Emits rows for non-opening turns (typically turn 2+):
    - hedging: hedge phrases per 100 words in that turn
    - word_count: token count in that turn
    - repetitiveness: 3-gram overlap with previous turn by same speaker
    """
    rows = []
    prev_ngrams_by_speaker = {}
    for turn in conv["turns"]:
        if turn.get("is_opening_prompt", False):
            continue
        speaker = turn.get("speaker")
        text = turn.get("content", "")
        tokens = tokenize(text)
        ngrams = set(get_ngrams(tokens, 3))

        prev_ngrams = prev_ngrams_by_speaker.get(speaker)
        if prev_ngrams:
            union = prev_ngrams | ngrams
            repet = (len(prev_ngrams & ngrams) / len(union)) if union else 0.0
        else:
            repet = 0.0
        prev_ngrams_by_speaker[speaker] = ngrams

        rows.append({
            "conversation_id": conv["conversation_id"],
            "condition": conv["condition"],
            "turn_number": int(turn["turn_number"]),
            "hedging": round(hedging_frequency_for_text(text), 4),
            "word_count": len(tokens),
            "repetitiveness": round(repet, 4),
        })
    return rows


# ---------------------------------------------------------------------------
# Export CSV
# ---------------------------------------------------------------------------

def export_csv(all_metrics, output_path):
    """Write metrics to CSV."""
    if not all_metrics:
        print("No metrics to export.")
        return

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    fieldnames = list(all_metrics[0].keys())
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_metrics)

    print(f"Exported {len(all_metrics)} rows to {output_path}")

def export_turn_metrics(turn_metrics_rows, output_path):
    """Write per-turn metrics to CSV."""
    if not turn_metrics_rows:
        print("No turn metrics to export.")
        return

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    fieldnames = ["conversation_id", "condition", "turn_number", "hedging", "word_count", "repetitiveness"]
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(turn_metrics_rows)
    print(f"Exported {len(turn_metrics_rows)} turn rows to {output_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Analyze conversation transcripts")
    parser.add_argument("--metrics", choices=["primary", "all"], default="all",
                        help="Which metrics to compute")
    parser.add_argument("--output", default=None,
                        help="Output CSV path")
    args = parser.parse_args()

    output_path = args.output or os.path.join(config.DATA_PROCESSED_DIR, "conversations.csv")
    include_secondary = (args.metrics == "all")

    conversations = load_conversations()
    if not conversations:
        print("No conversations found. Run generate.py first.")
        return

    all_metrics = []
    all_turn_metrics = []
    for conv in conversations:
        metrics = compute_metrics(conv, include_secondary=include_secondary)
        all_metrics.append(metrics)
        all_turn_metrics.extend(compute_turn_metrics(conv))
        print(f"  {conv['conversation_id']}: rep={metrics['repetitiveness']:.3f} "
              f"coh={metrics['coherence']:.3f} hedge={metrics['hedging']:.3f}")

    export_csv(all_metrics, output_path)
    turn_output_path = os.path.join(config.DATA_PROCESSED_DIR, "turn_metrics.csv")
    export_turn_metrics(all_turn_metrics, turn_output_path)

    # Keep web app data in sync with processed outputs.
    web_data_dir = os.path.join(os.path.dirname(__file__), "web", "public", "data")
    os.makedirs(web_data_dir, exist_ok=True)
    export_csv(all_metrics, os.path.join(web_data_dir, "conversations.csv"))
    export_turn_metrics(all_turn_metrics, os.path.join(web_data_dir, "turn_metrics.csv"))

    # Print summary stats
    print(f"\n{'='*60}")
    print("Summary Statistics")
    print(f"{'='*60}")
    for metric in ["repetitiveness", "coherence", "hedging"]:
        values = [m[metric] for m in all_metrics]
        print(f"  {metric}: min={min(values):.4f} max={max(values):.4f} "
              f"mean={sum(values)/len(values):.4f}")

    # Per-condition breakdown
    conditions = set(m["condition"] for m in all_metrics)
    for cond in sorted(conditions):
        cond_metrics = [m for m in all_metrics if m["condition"] == cond]
        print(f"\n  {cond} ({len(cond_metrics)} conversations):")
        for metric in ["repetitiveness", "coherence", "hedging"]:
            values = [m[metric] for m in cond_metrics]
            print(f"    {metric}: mean={sum(values)/len(values):.4f}")


if __name__ == "__main__":
    main()
