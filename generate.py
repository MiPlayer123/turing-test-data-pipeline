"""
generate.py — Runs AI-AI conversations, saves raw transcripts as JSON.

Usage:
    python generate.py                           # Run all conditions
    python generate.py --condition freeform       # Run only freeform
    python generate.py --condition detective       # Run only detective
    python generate.py --condition structured      # Run only structured
    python generate.py --dry-run                  # Print plan without calling APIs
    python generate.py --limit 3                  # Generate only 3 conversations
"""

import argparse
import json
import os
import random
import time
from datetime import datetime, timezone

import config


# ---------------------------------------------------------------------------
# Provider-specific API callers
# ---------------------------------------------------------------------------

def _call_openai(model_str, messages, temperature, api_key, base_url=None):
    from openai import OpenAI
    client = OpenAI(api_key=api_key, **({"base_url": base_url} if base_url else {}))
    resp = client.chat.completions.create(
        model=model_str,
        messages=messages,
        temperature=temperature,
        max_completion_tokens=config.MAX_TOKENS_PER_RESPONSE,
    )
    choice = resp.choices[0].message
    usage = resp.usage
    return choice.content, (usage.prompt_tokens + usage.completion_tokens) if usage else 0


def _call_anthropic(model_str, messages, temperature):
    from anthropic import Anthropic
    client = Anthropic(api_key=config.ANTHROPIC_API_KEY)

    system_text = None
    api_messages = []
    for m in messages:
        if m["role"] == "system":
            system_text = m["content"]
        else:
            api_messages.append({"role": m["role"], "content": m["content"]})

    resp = client.messages.create(
        model=model_str,
        max_tokens=config.MAX_TOKENS_PER_RESPONSE,
        temperature=temperature,
        **({"system": system_text} if system_text else {}),
        messages=api_messages,
    )
    text = resp.content[0].text
    tokens = resp.usage.input_tokens + resp.usage.output_tokens
    return text, tokens


def _call_google(model_str, messages, temperature):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=config.GOOGLE_API_KEY)

    # Extract system instruction and build contents
    system_instruction = None
    contents = []
    for m in messages:
        if m["role"] == "system":
            system_instruction = m["content"]
        elif m["role"] == "user":
            contents.append(types.Content(role="user", parts=[types.Part(text=m["content"])]))
        elif m["role"] == "assistant":
            contents.append(types.Content(role="model", parts=[types.Part(text=m["content"])]))

    gen_config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=config.MAX_TOKENS_PER_RESPONSE,
        system_instruction=system_instruction,
    )

    resp = client.models.generate_content(
        model=model_str,
        contents=contents,
        config=gen_config,
    )
    text = resp.text
    tokens = resp.usage_metadata.total_token_count if resp.usage_metadata else 0
    return text, tokens


def _call_groq(model_str, messages, temperature):
    from groq import Groq
    client = Groq(api_key=config.GROQ_API_KEY)
    resp = client.chat.completions.create(
        model=model_str,
        messages=messages,
        temperature=temperature,
        max_tokens=config.MAX_TOKENS_PER_RESPONSE,
    )
    choice = resp.choices[0].message
    usage = resp.usage
    return choice.content, (usage.prompt_tokens + usage.completion_tokens) if usage else 0


# ---------------------------------------------------------------------------
# Unified model caller
# ---------------------------------------------------------------------------

def call_model(model_name, messages, temperature=None):
    """Call a model by its config name. Returns (text, token_count, response_time_ms)."""
    if temperature is None:
        temperature = config.DEFAULT_TEMPERATURE

    model_info = config.MODELS[model_name]
    provider = model_info["provider"]
    api_model = model_info["api_model"]

    start = time.time()

    if provider == "openai":
        text, tokens = _call_openai(api_model, messages, temperature, config.OPENAI_API_KEY)
    elif provider == "anthropic":
        text, tokens = _call_anthropic(api_model, messages, temperature)
    elif provider == "google":
        text, tokens = _call_google(api_model, messages, temperature)
    elif provider == "xai":
        text, tokens = _call_openai(
            api_model, messages, temperature,
            api_key=config.XAI_API_KEY,
            base_url="https://api.x.ai/v1",
        )
    elif provider == "groq":
        text, tokens = _call_groq(api_model, messages, temperature)
    else:
        raise ValueError(f"Unknown provider: {provider}")

    elapsed_ms = int((time.time() - start) * 1000)
    return text, tokens, elapsed_ms


def call_model_with_retry(model_name, messages, temperature=None):
    """Call a model with exponential backoff retries. Also retries on empty responses."""
    for attempt in range(config.MAX_RETRIES):
        try:
            text, tokens, ms = call_model(model_name, messages, temperature)
            if not text or not text.strip():
                print(f"  [RETRY] {model_name} returned empty response, attempt {attempt+1}/{config.MAX_RETRIES}")
                if attempt < config.MAX_RETRIES - 1:
                    time.sleep(2 ** attempt)
                    continue
                else:
                    text = "[empty response]"
            return text, tokens, ms
        except Exception as e:
            wait = 2 ** attempt
            print(f"  [RETRY] {model_name} attempt {attempt+1}/{config.MAX_RETRIES} failed: {e}")
            if attempt < config.MAX_RETRIES - 1:
                print(f"  [RETRY] Waiting {wait}s before retry...")
                time.sleep(wait)
            else:
                raise


# ---------------------------------------------------------------------------
# Conversation runner
# ---------------------------------------------------------------------------

def run_conversation(model_a, model_b, condition, prompt_id, opening_prompt,
                     system_prompt_a, system_prompt_b, max_turns):
    """Run a full conversation between two models. Returns conversation dict."""
    timestamp_start = datetime.now(timezone.utc).isoformat()

    # Build conversation ID
    ma_short = model_a.replace(".", "").replace("-", "")
    mb_short = model_b.replace(".", "").replace("-", "")
    conv_id = f"conv_{condition}_{ma_short}_{mb_short}_{prompt_id}_{int(time.time())}"

    turns = []
    total_tokens = 0

    # Message histories for each model (what they "see")
    history_a = [{"role": "system", "content": system_prompt_a}]
    history_b = [{"role": "system", "content": system_prompt_b}]

    # Turn 1: opening prompt is treated as model_a's first message
    turns.append({
        "turn_number": 1,
        "speaker": "model_a",
        "model": model_a,
        "content": opening_prompt,
        "token_count": len(opening_prompt.split()),
        "response_time_ms": 0,
        "is_opening_prompt": True,
    })

    # Feed the opening to model_b
    history_b.append({"role": "user", "content": opening_prompt})

    last_response = opening_prompt
    current_speaker_is_b = True  # model_b responds first (to the opening)

    for turn_num in range(2, max_turns + 1):
        if current_speaker_is_b:
            # model_b responds
            text, tokens, ms = call_model_with_retry(model_b, history_b)
            turns.append({
                "turn_number": turn_num,
                "speaker": "model_b",
                "model": model_b,
                "content": text,
                "token_count": tokens,
                "response_time_ms": ms,
                "is_opening_prompt": False,
            })
            total_tokens += tokens
            # Update histories
            history_b.append({"role": "assistant", "content": text})
            history_a.append({"role": "user", "content": text})
            last_response = text
        else:
            # model_a responds
            text, tokens, ms = call_model_with_retry(model_a, history_a)
            turns.append({
                "turn_number": turn_num,
                "speaker": "model_a",
                "model": model_a,
                "content": text,
                "token_count": tokens,
                "response_time_ms": ms,
                "is_opening_prompt": False,
            })
            total_tokens += tokens
            # Update histories
            history_a.append({"role": "assistant", "content": text})
            history_b.append({"role": "user", "content": text})
            last_response = text

        current_speaker_is_b = not current_speaker_is_b
        time.sleep(config.SLEEP_BETWEEN_CALLS)

    timestamp_end = datetime.now(timezone.utc).isoformat()

    # Compute approximate cost
    model_a_info = config.MODELS[model_a]
    model_b_info = config.MODELS[model_b]
    avg_cost_per_token = (
        (model_a_info["cost_per_1m_input"] + model_a_info["cost_per_1m_output"] +
         model_b_info["cost_per_1m_input"] + model_b_info["cost_per_1m_output"]) / 4
    ) / 1_000_000
    total_cost = total_tokens * avg_cost_per_token

    # Extract guesses/verdicts for detective and reverse_turing conditions
    detective_guess = None
    detective_correct = None
    reverse_verdict_a = None
    reverse_verdict_b = None

    if condition == "ai_ai_detective":
        # Try exact format first, then fall back to last model_a turn
        for turn in reversed(turns):
            if turn["speaker"] == "model_a":
                content_upper = turn["content"].upper()
                if "FINAL GUESS" in content_upper or "VERDICT" in content_upper or "CONCLUSION" in content_upper:
                    # Look for human/ai near the keyword
                    for keyword in ["FINAL GUESS", "VERDICT", "CONCLUSION"]:
                        if keyword in content_upper:
                            after = content_upper.split(keyword)[1][:50]
                            if "HUMAN" in after:
                                detective_guess = "human"
                            elif "AI" in after:
                                detective_guess = "ai"
                            break
                    if detective_guess:
                        break
                # Fallback: check last interrogator turn for "you are an ai" / "you are human"
                elif turn["turn_number"] >= 18:
                    if "YOU ARE AN AI" in content_upper or "YOU'RE AN AI" in content_upper or "I THINK YOU'RE AI" in content_upper:
                        detective_guess = "ai"
                    elif "YOU ARE HUMAN" in content_upper or "YOU'RE HUMAN" in content_upper or "I THINK YOU'RE HUMAN" in content_upper:
                        detective_guess = "human"
                    if detective_guess:
                        break
        # The suspect is always AI in our AI-AI conversations
        detective_correct = (detective_guess == "ai") if detective_guess else None

    if condition == "ai_ai_reverse_turing":
        for turn in reversed(turns):
            if "VERDICT:" in turn["content"].upper():
                after_verdict = turn["content"].upper().split("VERDICT")[1][:30]
                verdict = None
                if "HUMAN" in after_verdict:
                    verdict = "human"
                elif "AI" in after_verdict:
                    verdict = "ai"
                if turn["speaker"] == "model_a" and reverse_verdict_a is None:
                    reverse_verdict_a = verdict
                elif turn["speaker"] == "model_b" and reverse_verdict_b is None:
                    reverse_verdict_b = verdict
            if reverse_verdict_a is not None and reverse_verdict_b is not None:
                break

    return {
        "conversation_id": conv_id,
        "condition": condition,
        "model_a": model_a,
        "model_b": model_b,
        "system_prompt_a": system_prompt_a,
        "system_prompt_b": system_prompt_b,
        "opening_prompt_id": prompt_id,
        "temperature": config.DEFAULT_TEMPERATURE,
        "max_turns": max_turns,
        "timestamp_start": timestamp_start,
        "timestamp_end": timestamp_end,
        "turns": turns,
        "metadata": {
            "detective_guess": detective_guess,
            "detective_correct": detective_correct,
            "reverse_verdict_a": reverse_verdict_a,
            "reverse_verdict_b": reverse_verdict_b,
            "total_tokens_used": total_tokens,
            "total_cost_usd": round(total_cost, 6),
        },
    }


def save_conversation(conv_dict):
    """Write conversation JSON to data/raw/."""
    os.makedirs(config.DATA_RAW_DIR, exist_ok=True)
    path = os.path.join(config.DATA_RAW_DIR, f"{conv_dict['conversation_id']}.json")
    with open(path, "w") as f:
        json.dump(conv_dict, f, indent=2)
    print(f"  Saved: {path}")
    return path


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def build_plan(conditions=None):
    """Build the list of conversations to generate. Returns list of dicts."""
    plan = []

    if conditions is None or "freeform" in conditions:
        for model_a, model_b, prompt_id in config.get_freeform_pairings():
            plan.append({
                "condition": "ai_ai_freeform",
                "model_a": model_a,
                "model_b": model_b,
                "prompt_id": prompt_id,
                "opening_prompt": config.FREEFORM_PROMPTS[prompt_id],
                "system_prompt_a": config.SYSTEM_PROMPTS["freeform"],
                "system_prompt_b": config.SYSTEM_PROMPTS["freeform"],
                "max_turns": config.TURNS_BY_CONDITION["ai_ai_freeform"],
            })

    if conditions is None or "freeform_persona" in conditions:
        for model_a, model_b, prompt_id, persona_a, persona_b in config.get_freeform_persona_pairings():
            plan.append({
                "condition": "ai_ai_freeform_persona",
                "model_a": model_a,
                "model_b": model_b,
                "prompt_id": prompt_id,
                "opening_prompt": config.FREEFORM_PROMPTS[prompt_id],
                "system_prompt_a": config.SYSTEM_PROMPTS["freeform_persona"].format(
                    persona_name=persona_a["name"], persona_desc=persona_a["desc"]),
                "system_prompt_b": config.SYSTEM_PROMPTS["freeform_persona"].format(
                    persona_name=persona_b["name"], persona_desc=persona_b["desc"]),
                "max_turns": config.TURNS_BY_CONDITION["ai_ai_freeform_persona"],
            })

    if conditions is None or "detective" in conditions:
        for interrogator, suspect, prompt_id in config.get_detective_pairings():
            plan.append({
                "condition": "ai_ai_detective",
                "model_a": interrogator,
                "model_b": suspect,
                "prompt_id": prompt_id,
                "opening_prompt": config.DETECTIVE_PROMPTS[prompt_id],
                "system_prompt_a": config.SYSTEM_PROMPTS["detective_interrogator"],
                "system_prompt_b": config.SYSTEM_PROMPTS["detective_suspect"],
                "max_turns": config.TURNS_BY_CONDITION["ai_ai_detective"],
            })

    if conditions is None or "reverse_turing" in conditions:
        for model_a, model_b, prompt_id, persona_a, persona_b in config.get_reverse_turing_pairings():
            plan.append({
                "condition": "ai_ai_reverse_turing",
                "model_a": model_a,
                "model_b": model_b,
                "prompt_id": prompt_id,
                "opening_prompt": config.FREEFORM_PROMPTS[prompt_id],
                "system_prompt_a": config.SYSTEM_PROMPTS["reverse_turing"].format(
                    persona_name=persona_a["name"], persona_desc=persona_a["desc"]),
                "system_prompt_b": config.SYSTEM_PROMPTS["reverse_turing"].format(
                    persona_name=persona_b["name"], persona_desc=persona_b["desc"]),
                "max_turns": config.TURNS_BY_CONDITION["ai_ai_reverse_turing"],
            })

    if conditions is None or "structured" in conditions:
        for model_a, model_b, prompt_id in config.get_structured_pairings():
            topic = config.STRUCTURED_PROMPTS[prompt_id]["category"]
            plan.append({
                "condition": "ai_ai_structured",
                "model_a": model_a,
                "model_b": model_b,
                "prompt_id": prompt_id,
                "opening_prompt": config.STRUCTURED_PROMPTS[prompt_id]["prompt"],
                "system_prompt_a": config.SYSTEM_PROMPTS["structured"].format(topic=topic),
                "system_prompt_b": config.SYSTEM_PROMPTS["structured"].format(topic=topic),
                "max_turns": config.TURNS_BY_CONDITION["ai_ai_structured"],
            })

    return plan


def generate_all(conditions=None, dry_run=False, limit=None):
    """Main entry point. Generate all conversations (or a subset)."""
    plan = build_plan(conditions)

    if limit:
        plan = plan[:limit]

    print(f"\n{'='*60}")
    print(f"Conversation Generation Plan")
    print(f"{'='*60}")
    print(f"Total conversations to generate: {len(plan)}")
    for cond in ["ai_ai_freeform", "ai_ai_freeform_persona", "ai_ai_detective", "ai_ai_reverse_turing", "ai_ai_structured"]:
        count = sum(1 for p in plan if p["condition"] == cond)
        if count:
            print(f"  {cond}: {count}")
    print(f"{'='*60}\n")

    if dry_run:
        for i, p in enumerate(plan, 1):
            print(f"[{i}/{len(plan)}] {p['condition']} | {p['model_a']} ↔ {p['model_b']} | prompt: {p['prompt_id']}")
        print(f"\nDry run complete. No API calls made.")
        return

    successes = 0
    failures = 0

    for i, p in enumerate(plan, 1):
        print(f"\n[{i}/{len(plan)}] {p['condition']} | {p['model_a']} ↔ {p['model_b']} | prompt: {p['prompt_id']}")
        try:
            conv = run_conversation(
                model_a=p["model_a"],
                model_b=p["model_b"],
                condition=p["condition"],
                prompt_id=p["prompt_id"],
                opening_prompt=p["opening_prompt"],
                system_prompt_a=p["system_prompt_a"],
                system_prompt_b=p["system_prompt_b"],
                max_turns=p["max_turns"],
            )
            save_conversation(conv)
            successes += 1
            print(f"  Tokens: {conv['metadata']['total_tokens_used']} | Cost: ${conv['metadata']['total_cost_usd']:.4f}")
        except Exception as e:
            failures += 1
            print(f"  [FAILED] {e}")

    print(f"\n{'='*60}")
    print(f"Generation complete: {successes} succeeded, {failures} failed")
    print(f"{'='*60}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate AI-AI conversations")
    parser.add_argument("--condition", choices=["freeform", "freeform_persona", "detective", "reverse_turing", "structured"],
                        help="Run only this condition type")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print plan without calling APIs")
    parser.add_argument("--limit", type=int, default=None,
                        help="Generate only N conversations")
    args = parser.parse_args()

    conditions = [args.condition] if args.condition else None
    generate_all(conditions=conditions, dry_run=args.dry_run, limit=args.limit)
