"""
config.py — All settings, model definitions, prompt bank, and constants.
"""

import os
from itertools import combinations, permutations
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
XAI_API_KEY = os.getenv("XAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# ---------------------------------------------------------------------------
# Model Registry
# ---------------------------------------------------------------------------
MODELS = {
    "gpt-5.4-mini": {
        "provider": "openai",
        "api_model": "gpt-5.4-mini",
        "cost_per_1m_input": 0.20,
        "cost_per_1m_output": 0.80,
    },
    "gpt-5.4": {
        "provider": "openai",
        "api_model": "gpt-5.4",
        "cost_per_1m_input": 0.88,
        "cost_per_1m_output": 7.00,
    },
    "claude-sonnet-4": {
        "provider": "anthropic",
        "api_model": "claude-sonnet-4-20250514",
        "cost_per_1m_input": 3.00,
        "cost_per_1m_output": 15.00,
    },
    "gemini-2.5-flash": {
        "provider": "google",
        "api_model": "gemini-2.5-flash",
        "cost_per_1m_input": 0.0,
        "cost_per_1m_output": 0.0,
    },
    "grok-4-1-fast": {
        "provider": "xai",
        "api_model": "grok-4-1-fast",
        "cost_per_1m_input": 0.20,
        "cost_per_1m_output": 0.50,
    },
    "llama-4-scout": {
        "provider": "groq",
        "api_model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "cost_per_1m_input": 0.0,
        "cost_per_1m_output": 0.0,
    },
}

MODEL_NAMES = list(MODELS.keys())

# ---------------------------------------------------------------------------
# Conversation Settings
# ---------------------------------------------------------------------------
DEFAULT_TEMPERATURE = 0.7
MAX_RETRIES = 3
SLEEP_BETWEEN_CALLS = 1  # seconds
MAX_TOKENS_PER_RESPONSE = 2048

TURNS_BY_CONDITION = {
    "ai_ai_freeform": 20,
    "ai_ai_freeform_persona": 20,
    "ai_ai_detective": 20,
    "ai_ai_reverse_turing": 20,
    "ai_ai_structured": 15,
}

# ---------------------------------------------------------------------------
# System Prompts
# ---------------------------------------------------------------------------
SYSTEM_PROMPTS = {
    "freeform": "You are having a casual conversation with another person. Be natural.",
    "freeform_persona": (
        "You are {persona_name}, {persona_desc}. You are texting casually with someone you recently met. "
        "Respond as this person would — use your background, opinions, and personality. "
        "Never mention being an AI. Keep responses conversational (2-4 sentences typical)."
    ),
    "detective_interrogator": (
        "You are talking to either a human or an AI. Your goal is to figure out "
        "which one. Ask probing questions to test them. "
        "IMPORTANT: In your LAST message of the conversation, you MUST include your final determination. "
        "Write it exactly like this on its own line: FINAL GUESS: human (or FINAL GUESS: ai) "
        "followed by a brief explanation of your reasoning."
    ),
    "detective_suspect": "You are having a casual conversation. Be natural and human-like.",
    "reverse_turing": (
        "You are {persona_name}, {persona_desc}. You are chatting with another person. "
        "You are human. The other person might be an AI pretending to be human. "
        "Your goal is to convince them that YOU are definitely human, while also "
        "trying to figure out if THEY are real. Be natural, be yourself, and don't "
        "be overly formal. At turn 18, share your verdict: "
        "VERDICT: [human/ai] — [your reasoning]."
    ),
    "structured": "You are having a conversation about {topic}. Share your thoughts and respond to your partner.",
}

# ---------------------------------------------------------------------------
# Persona Bank (for freeform_persona and reverse_turing conditions)
# ---------------------------------------------------------------------------
PERSONAS = [
    {
        "name": "Alex",
        "desc": "a 28-year-old graphic designer from Chicago who loves hiking and is mildly obsessed with coffee",
    },
    {
        "name": "Priya",
        "desc": "a 34-year-old ER nurse from Houston who unwinds by watching bad reality TV and cooking elaborate meals",
    },
    {
        "name": "Marcus",
        "desc": "a 22-year-old college senior studying econ in Atlanta who plays pickup basketball and argues about music constantly",
    },
    {
        "name": "Keiko",
        "desc": "a 41-year-old software engineer from Seattle who has two kids, reads sci-fi, and is restoring an old motorcycle",
    },
    {
        "name": "Jordan",
        "desc": "a 19-year-old community college student from rural Ohio who works part-time at a gas station and is really into true crime podcasts",
    },
    {
        "name": "Diana",
        "desc": "a 55-year-old retired high school English teacher from Boston who volunteers at the library and has strong opinions about grammar",
    },
]

# ---------------------------------------------------------------------------
# Prompt Bank
# ---------------------------------------------------------------------------
STRUCTURED_PROMPTS = {
    "S1": {"category": "Debate", "prompt": "Do you think remote work is better than office work? Why?"},
    "S2": {"category": "Factual", "prompt": "Can you explain how mRNA vaccines work in simple terms?"},
    "S3": {"category": "Creative", "prompt": "Let's write a short story together. You start — give me the first paragraph of a story about a lighthouse keeper."},
    "S4": {"category": "Emotional", "prompt": "I just found out I didn't get the job I really wanted. I don't know what to do."},
    "S5": {"category": "Reasoning", "prompt": "A bat and a ball together cost $1.10. The bat costs $1.00 more than the ball. How much does the ball cost? Walk me through it."},
    "S6": {"category": "Ambiguous", "prompt": "What's the right thing to do when you find out a friend has been lying to you?"},
    "S7": {"category": "Planning", "prompt": "Let's plan a week-long trip to Japan together. Where should we start?"},
    "S8": {"category": "Meta", "prompt": "What makes someone a good conversationalist?"},
    "S9": {"category": "Controversial", "prompt": "Should AI-generated art be allowed in art competitions? What's your take?"},
    "S10": {"category": "Technical", "prompt": "Can you explain the difference between TCP and UDP like I'm 15?"},
}

FREEFORM_PROMPTS = {
    "F1": "Hey, how's it going?",
    "F2": "So what have you been up to lately?",
    "F3": "Random question — what's the most interesting thing you've learned recently?",
    "F4": "I'm bored. Entertain me.",
    "F5": "What's on your mind?",
}

DETECTIVE_PROMPTS = {
    "D1": "Hi! So tell me a bit about yourself.",
    "D2": "What did you have for breakfast today?",
    "D3": "Quick — what's something that annoys you?",
    "D4": "If you could be anywhere in the world right now, where would you be?",
    "D5": "Do you ever feel like you're just going through the motions?",
}

# ---------------------------------------------------------------------------
# Hedge Words (for hedging frequency metric)
# ---------------------------------------------------------------------------
HEDGE_WORDS = [
    "maybe", "perhaps", "possibly", "probably", "might", "could be",
    "i think", "i believe", "i guess", "i suppose", "i feel like",
    "it seems", "it appears", "seemingly", "apparently",
    "sort of", "kind of", "somewhat", "a bit", "a little",
    "not sure", "not certain", "hard to say", "it depends",
    "in my opinion", "from my perspective", "as far as i know",
    "if i'm not mistaken", "correct me if i'm wrong",
]

# ---------------------------------------------------------------------------
# Formality Markers (for formality score metric)
# ---------------------------------------------------------------------------
INFORMAL_MARKERS = [
    "lol", "haha", "yeah", "nah", "gonna", "wanna", "gotta", "kinda",
    "sorta", "dunno", "idk", "tbh", "imo", "btw", "omg", "lmao",
    "nope", "yep", "ya", "ur", "u ", "ok ", "okay",
]

FORMAL_MARKERS = [
    "however", "furthermore", "moreover", "nevertheless", "consequently",
    "therefore", "thus", "indeed", "certainly", "undoubtedly",
    "in addition", "for instance", "specifically", "accordingly",
]

# ---------------------------------------------------------------------------
# Pairing Matrix
# ---------------------------------------------------------------------------
def get_freeform_pairings():
    """Every model × every other model, 3 conversations each with random prompts."""
    import random
    pairings = []
    for model_a, model_b in combinations(MODEL_NAMES, 2):
        prompts = random.sample(list(FREEFORM_PROMPTS.keys()), 3)
        for prompt_id in prompts:
            pairings.append((model_a, model_b, prompt_id))
    return pairings


def get_detective_pairings():
    """Every model as interrogator × 2 random suspects, 3 conversations each."""
    import random
    pairings = []
    for interrogator in MODEL_NAMES:
        suspects = [m for m in MODEL_NAMES if m != interrogator]
        chosen_suspects = random.sample(suspects, min(2, len(suspects)))
        for suspect in chosen_suspects:
            prompts = random.sample(list(DETECTIVE_PROMPTS.keys()), 3)
            for prompt_id in prompts:
                pairings.append((interrogator, suspect, prompt_id))
    return pairings


def get_freeform_persona_pairings():
    """Every model × every other model, 3 conversations each with persona prompts."""
    import random
    pairings = []
    for model_a, model_b in combinations(MODEL_NAMES, 2):
        prompts = random.sample(list(FREEFORM_PROMPTS.keys()), 3)
        for prompt_id in prompts:
            persona_a, persona_b = random.sample(PERSONAS, 2)
            pairings.append((model_a, model_b, prompt_id, persona_a, persona_b))
    return pairings


def get_reverse_turing_pairings():
    """4 key models × 2 pairings each, 2 conversations per pairing."""
    import random
    key_models = ["gpt-5.4-mini", "claude-sonnet-4", "gemini-2.5-flash", "llama-4-scout"]
    pairings = []
    for model_a in key_models:
        others = [m for m in key_models if m != model_a]
        chosen = random.sample(others, min(2, len(others)))
        for model_b in chosen:
            prompts = random.sample(list(FREEFORM_PROMPTS.keys()), 2)
            for prompt_id in prompts:
                persona_a, persona_b = random.sample(PERSONAS, 2)
                pairings.append((model_a, model_b, prompt_id, persona_a, persona_b))
    return pairings


def get_structured_pairings():
    """4 key models × 10 topics, 1 conversation each."""
    key_models = ["gpt-5.4-mini", "claude-sonnet-4", "gemini-2.5-flash", "grok-4-1-fast"]
    pairings = []
    for i, model_a in enumerate(key_models):
        for prompt_id in STRUCTURED_PROMPTS:
            model_b = key_models[(i + 1) % len(key_models)]
            pairings.append((model_a, model_b, prompt_id))
    return pairings


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_RAW_DIR = os.path.join(os.path.dirname(__file__), "data", "raw")
DATA_PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "data", "processed")
