// Persistent narrative-thread corner dots.
// Dots are born in specific scenes and stay lit for the rest of the scroll.

const RED = '#corner-dot-red';
const YELLOW = '#corner-dot-yellow';

function get(sel) { return document.querySelector(sel); }

export function getCornerRect(which) {
  const el = get(which === 'yellow' ? YELLOW : RED);
  return el ? el.getBoundingClientRect() : null;
}

export function light(which) {
  const el = get(which === 'yellow' ? YELLOW : RED);
  if (el) el.classList.add('is-lit');
}

export function unlight(which) {
  const el = get(which === 'yellow' ? YELLOW : RED);
  if (el) el.classList.remove('is-lit');
}

export function isLit(which) {
  const el = get(which === 'yellow' ? YELLOW : RED);
  return !!(el && el.classList.contains('is-lit'));
}
