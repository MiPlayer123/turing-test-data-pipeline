# Turing Test Visualization

Scrollytelling data visualization exploring how LLMs communicate with humans and other LLMs. Thesis: **"The harder an AI tries to seem human, the more it gives itself away."**

## Structure

```
web/           → Scrollytelling visualization (Vite + D3 + Three.js)
data/          → 362 conversation transcripts + computed metrics
viz/           → Standalone EDA charts (legacy, now integrated into web/)
config.py      → Model definitions, prompts, settings
generate.py    → AI-AI conversation generation via LLM APIs
analyze.py     → Metric computation (repetitiveness, coherence, hedging)
ingest_human_data.py → Human-human (PersonaChat) + Human-AI (WildChat) ingestion
```

## Data Pipeline

1. `generate.py` — Runs conversations between LLM pairs (GPT-5.4, Claude Sonnet 4, Gemini 2.5 Flash, Grok 4.1 Fast, Llama 4 Scout)
2. `ingest_human_data.py` — Pulls human-human and human-AI conversations from HuggingFace
3. `analyze.py` — Computes metrics, exports CSV to `data/processed/`

## Visualization

```bash
cd web && npm install && npm run dev
```

Scrollytelling page with 6 sections: hero, metric explainer, detective accuracy, turn-by-turn trajectory, 3D explorer, and interactive guessing game.

## Conditions

- **Human-Human** — PersonaChat crowdsourced conversations
- **Human-AI** — WildChat real user-LLM conversations
- **AI-AI Freeform / Persona / Detective / Reverse Turing / Structured** — Generated via API
