"""
ingest_human_data.py — Downloads human-human and human-AI conversations
from HuggingFace and converts them to our JSON schema.

Sources:
  - Human-Human: AlekseyKorshuk/persona-chat (crowdsourced conversations)
  - Human-AI: allenai/WildChat-1M (real user-LLM conversations)

Usage:
    python ingest_human_data.py                    # Download both
    python ingest_human_data.py --source human      # Only human-human
    python ingest_human_data.py --source ai         # Only human-AI
    python ingest_human_data.py --limit 50          # Fewer conversations
"""

import argparse
import json
import os
import random
import time
from datetime import datetime, timezone

import config


def ingest_persona_chat(limit=100):
    """Download human-human conversations from PersonaChat."""
    from datasets import load_dataset

    print(f"Loading PersonaChat (human-human)...")
    ds = load_dataset("AlekseyKorshuk/persona-chat", split="train", streaming=True)

    saved = 0
    for i, sample in enumerate(ds):
        if saved >= limit:
            break

        # Get the last utterance entry which has the full conversation history
        utterances = sample.get("utterances", [])
        if not utterances:
            continue

        last_u = utterances[-1]
        history = last_u.get("history", [])
        if len(history) < 6:
            continue  # skip very short conversations

        # Build turns
        turns = []
        for j, text in enumerate(history):
            speaker = "model_a" if j % 2 == 0 else "model_b"
            turns.append({
                "turn_number": j + 1,
                "speaker": speaker,
                "model": "human",
                "content": text.strip(),
                "token_count": len(text.split()),
                "response_time_ms": 0,
                "is_opening_prompt": j == 0,
            })

        conv_id = f"conv_human_human_personachat_{saved:04d}"

        conv = {
            "conversation_id": conv_id,
            "condition": "human_human",
            "model_a": "human",
            "model_b": "human",
            "system_prompt_a": "PersonaChat crowdsourced conversation",
            "system_prompt_b": "PersonaChat crowdsourced conversation",
            "opening_prompt_id": "PC",
            "temperature": None,
            "max_turns": len(turns),
            "timestamp_start": None,
            "timestamp_end": None,
            "turns": turns,
            "metadata": {
                "detective_guess": None,
                "detective_correct": None,
                "reverse_verdict_a": None,
                "reverse_verdict_b": None,
                "total_tokens_used": sum(t["token_count"] for t in turns),
                "total_cost_usd": 0,
                "source": "AlekseyKorshuk/persona-chat",
            },
        }

        path = os.path.join(config.DATA_RAW_DIR, f"{conv_id}.json")
        with open(path, "w") as f:
            json.dump(conv, f, indent=2)

        saved += 1
        if saved % 20 == 0:
            print(f"  Saved {saved}/{limit} human-human conversations")

    print(f"  Done: {saved} human-human conversations saved")
    return saved


def ingest_wildchat(limit=100):
    """Download human-AI conversations from WildChat."""
    from datasets import load_dataset

    print(f"Loading WildChat (human-AI)...")
    ds = load_dataset("allenai/WildChat-1M", split="train", streaming=True)

    saved = 0
    skipped = 0

    for sample in ds:
        if saved >= limit:
            break

        # Filter: English, multi-turn, not toxic
        if sample.get("language") != "English":
            continue
        if sample.get("toxic", False):
            continue

        conversation = sample.get("conversation", [])
        if len(conversation) < 8:  # at least 4 user + 4 assistant turns
            continue

        # Build turns
        turns = []
        model_name = sample.get("model", "unknown-llm")
        for j, msg in enumerate(conversation):
            role = msg.get("role", "")
            content = msg.get("content", "").strip()
            if not content:
                continue

            speaker = "model_a" if role == "user" else "model_b"
            turns.append({
                "turn_number": j + 1,
                "speaker": speaker,
                "model": "human" if role == "user" else model_name,
                "content": content,
                "token_count": len(content.split()),
                "response_time_ms": 0,
                "is_opening_prompt": j == 0,
            })

        if len(turns) < 8:
            continue

        # Cap at 20 turns to match AI-AI conversations
        turns = turns[:20]

        conv_id = f"conv_human_ai_wildchat_{saved:04d}"

        conv = {
            "conversation_id": conv_id,
            "condition": "human_ai",
            "model_a": "human",
            "model_b": model_name,
            "system_prompt_a": "Real user conversation (WildChat)",
            "system_prompt_b": f"Model: {model_name}",
            "opening_prompt_id": "WC",
            "temperature": None,
            "max_turns": len(turns),
            "timestamp_start": sample.get("timestamp", ""),
            "timestamp_end": None,
            "turns": turns,
            "metadata": {
                "detective_guess": None,
                "detective_correct": None,
                "reverse_verdict_a": None,
                "reverse_verdict_b": None,
                "total_tokens_used": sum(t["token_count"] for t in turns),
                "total_cost_usd": 0,
                "source": "allenai/WildChat-1M",
                "original_model": model_name,
            },
        }

        path = os.path.join(config.DATA_RAW_DIR, f"{conv_id}.json")
        with open(path, "w") as f:
            json.dump(conv, f, indent=2, default=str)

        saved += 1
        if saved % 20 == 0:
            print(f"  Saved {saved}/{limit} human-AI conversations")

    print(f"  Done: {saved} human-AI conversations saved")
    return saved


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest human conversation data")
    parser.add_argument("--source", choices=["human", "ai", "both"], default="both")
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()

    os.makedirs(config.DATA_RAW_DIR, exist_ok=True)

    total = 0
    if args.source in ("human", "both"):
        total += ingest_persona_chat(limit=args.limit)
    if args.source in ("ai", "both"):
        total += ingest_wildchat(limit=args.limit)

    print(f"\nTotal: {total} conversations ingested")
    print(f"Run 'python analyze.py' to recompute metrics with human data included")
