# Turing Test Visualization —  AI-AI Data Pipeline

Generates AI-AI conversations across multiple LLM providers, computes behavioral metrics on the transcripts, and exports a CSV for 3D visualization of "conversation behavioral space."

## Pipeline

1. **`config.py`** — Models, prompts, settings
2. **`generate.py`** — Runs conversations between LLM pairs, saves JSON transcripts to `data/raw/`
3. **`analyze.py`** — Computes metrics (repetitiveness, coherence, hedging, etc.), exports CSV to `data/processed/`

## Quick Start

```bash
pip install -r requirements.txt
cp .env.example .env   # Fill in API keys
python generate.py --dry-run          # Preview the plan
python generate.py --limit 1          # Test with 1 conversation
python analyze.py                     # Compute metrics → CSV
```

## Conditions

- **AI-AI Freeform** — Two models chat casually (20 turns)
- **AI-AI Detective** — One model tries to detect if the other is AI (20 turns)
- **AI-AI Structured** — Both discuss a specific topic (15 turns)
- **Human-AI / Human-Human** — Collected manually by teammates
