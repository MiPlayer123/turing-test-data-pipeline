// Forensic Editorial palette — tuned against #F2EDE2 paper.
// Human-Human reads as the calm baseline (blue), Human-AI as the mixed
// intermediary (yellow), and the five AI-AI subtypes share the fire palette
// (Black Cherry → Oxblood → Brick Ember → Red Ochre → Cayenne Red).
export const CONDITIONS = [
  { key: "human_human",            label: "Human-Human",       color: "#1D6FA8" },
  { key: "human_ai",               label: "Human-AI",          color: "#FFCC00" },
  { key: "ai_ai_freeform_persona", label: "AI Persona",        color: "#6A040F" },
  { key: "ai_ai_freeform",         label: "AI Freeform",       color: "#9D0208" },
  { key: "ai_ai_structured",       label: "AI Structured",     color: "#F48C06" },
  { key: "ai_ai_detective",        label: "AI Detective",      color: "#DC2F02" },
  { key: "ai_ai_reverse_turing",   label: "AI Reverse Turing", color: "#E85D04" },
];

export const CONDITION_COLOR = Object.fromEntries(CONDITIONS.map(c => [c.key, c.color]));
export const CONDITION_LABEL = Object.fromEntries(CONDITIONS.map(c => [c.key, c.label]));

// Model colors — kept distinct on paper ground. Paired roughly to vendor identity
// but desaturated so they cohere with the data palette above.
export const MODEL_COLORS = {
  "gpt-5.4":         "#3F6B5E",
  "gpt-5.4-mini":    "#6E8E83",
  "gemini-2.5-flash": "#3A5E86",
  "grok-4-1-fast":   "#4A7299",
  "claude-sonnet-4": "#C84B16",
  "llama-4-scout":   "#7A4A6B",
  "human":           "#2F5D8A",
};

export const MODEL_LABELS = {
  "gpt-5.4":         "GPT-5.4",
  "gpt-5.4-mini":    "GPT-5.4 Mini",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "grok-4-1-fast":   "Grok 4.1 Fast",
  "claude-sonnet-4": "Claude Sonnet 4",
  "llama-4-scout":   "Llama 4 Scout",
  "human":           "Human",
};

// Scene 1 hook: curated AI-AI Reverse Turing conversations with the highest hedging
// in their opening turns — two AIs each trying to convince the other they're human.
// One of these is picked at random per page load for replayability.
export const HOOK_CONVERSATION_IDS = [
  "conv_ai_ai_freeform_gpt54mini_gpt54_F1_1775413091",
  "conv_ai_ai_freeform_gemini25flash_grok41fast_F1_1775428314",
  "conv_ai_ai_freeform_gpt54_grok41fast_F1_1775426738",
  "conv_ai_ai_freeform_persona_gemini25flash_grok41fast_F1_1775425610",
  "conv_ai_ai_freeform_persona_gpt54_gemini25flash_F5_1775424063",
];
export const HOOK_NUM_BUBBLES = 4;

export const METRICS = [
  { key: "repetitiveness", label: "Repetitiveness", description: "3-gram overlap between consecutive same-speaker turns. Higher = more self-repeating." },
  { key: "hedging",        label: "Hedging",        description: '"I think", "maybe", "sort of" — words that signal uncertainty. Humans use them naturally. AIs use them when they\'re trying to sound human.' },
  { key: "coherence",      label: "Coherence",      description: "Word overlap between consecutive turns. Higher = more topically connected." },
];
