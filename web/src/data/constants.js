// Canonical color tokens. Every chart imports from here — never define hex
// values inline. Three layers:
//   1. CONCEPT — the two metric concepts (hedging, repetition). Always.
//   2. GROUP   — the three high-level conversation groupings used in the grid scene.
//   3. CONDITION — the seven dataset conditions used in legends and the explorer.
// If a chart needs a color, it picks the layer that matches its semantic role.

export const CONCEPT = {
  hedging:    "#E74C3C",
  repetition: "#F1C40F",
};

export const GROUP = {
  human_human: "#1ABC9C",
  human_ai:    "#F1C40F",
  ai_ai:       "#E74C3C",
  ai_ai_combined: "#FF4D6D",
};

export const CONDITIONS = [
  { key: "human_human",            label: "Human-Human",       color: "#1ABC9C" },
  { key: "human_ai",               label: "Human-AI",          color: "#95A5A6" },
  { key: "ai_ai_detective",        label: "AI Detective",      color: "#FF7438" },
  { key: "ai_ai_freeform",         label: "AI Freeform",       color: "#FF4D6D" },
  { key: "ai_ai_freeform_persona", label: "AI Persona",        color: "#C9184A" },
  { key: "ai_ai_reverse_turing",   label: "AI Reverse Turing", color: "#FF006E" },
  { key: "ai_ai_structured",       label: "AI Structured",     color: "#FFAA00" },
];

export const CONDITION_COLOR = Object.fromEntries(CONDITIONS.map(c => [c.key, c.color]));
export const CONDITION_LABEL = Object.fromEntries(CONDITIONS.map(c => [c.key, c.label]));

// UI roles. LINK is *only* for interactive hover/link states — never as a
// semantic category color (use GROUP / CONDITION / CONCEPT for that).
export const UI = {
  link:         "#58A6FF",
  text_primary: "#f0f3f6",
  text_body:    "#c9d1d9",
  text_muted:   "#8B949E",
  text_faint:   "#6a7380",
  text_dim:     "#484F58",
  bg_page:      "#0D1117",
  bg_card:      "#0f1419",
  bg_card_alt:  "#161B22",
  border_card:  "#22272e",
  border_strong:"#30363D",
  axis_line:    "#1a1f27",
};

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
