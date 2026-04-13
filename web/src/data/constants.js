export const CONDITIONS = [
  { key: "human_human",            label: "Human-Human",     color: "#1ABC9C" },
  { key: "human_ai",               label: "Human-AI",        color: "#F1C40F" },
  { key: "ai_ai_detective",        label: "AI Detective",    color: "#E74C3C" },
  { key: "ai_ai_freeform",         label: "AI Freeform",     color: "#3498DB" },
  { key: "ai_ai_freeform_persona", label: "AI Persona",      color: "#9B59B6" },
  { key: "ai_ai_reverse_turing",   label: "AI Rev. Turing",  color: "#F39C12" },
  { key: "ai_ai_structured",       label: "AI Structured",   color: "#2ECC71" },
];

export const CONDITION_COLOR = Object.fromEntries(CONDITIONS.map(c => [c.key, c.color]));
export const CONDITION_LABEL = Object.fromEntries(CONDITIONS.map(c => [c.key, c.label]));

export const MODEL_COLORS = {
  "gpt-5.4":         "#10A37F",
  "gpt-5.4-mini":    "#74AA9C",
  "gemini-2.5-flash": "#4285F4",
  "grok-4-1-fast":   "#1DA1F2",
  "claude-sonnet-4": "#D97706",
  "llama-4-scout":   "#A855F7",
  "human":           "#1ABC9C",
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

export const METRICS = [
  { key: "repetitiveness", label: "Repetitiveness", description: "3-gram overlap between consecutive same-speaker turns. Higher = more self-repeating." },
  { key: "hedging",        label: "Hedging",        description: '"I think", "maybe", "sort of" — words that signal uncertainty. Humans use them naturally. AIs use them when they\'re trying to sound human.' },
  { key: "coherence",      label: "Coherence",      description: "Word overlap between consecutive turns. Higher = more topically connected." },
];
