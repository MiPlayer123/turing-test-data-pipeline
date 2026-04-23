// Persistent narrative-thread corner dots.
// Each slot is born in a specific scene and stays lit until explicitly unlit.

const SLOTS = {
  red:        '#corner-dot-red',
  yellow:     '#corner-dot-yellow',
  freeform:   '#corner-dot-freeform',
  persona:    '#corner-dot-persona',
  detective:  '#corner-dot-detective',
  revturing:  '#corner-dot-revturing',
  structured: '#corner-dot-structured',
};

function get(which) {
  return document.querySelector(SLOTS[which] || SLOTS.red);
}

export function getCornerRect(which) {
  const el = get(which);
  return el ? el.getBoundingClientRect() : null;
}

export function light(which) {
  const el = get(which);
  if (el) el.classList.add('is-lit');
}

export function unlight(which) {
  const el = get(which);
  if (el) el.classList.remove('is-lit');
}

export function isLit(which) {
  const el = get(which);
  return !!(el && el.classList.contains('is-lit'));
}
