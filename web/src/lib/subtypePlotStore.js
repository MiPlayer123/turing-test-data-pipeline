let subtypePlotPayload = null;

export function setSubtypePlotPayload(payload) {
  subtypePlotPayload = payload;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('subtypes:plot-data', { detail: payload }));
  }
}

export function getSubtypePlotPayload() {
  return subtypePlotPayload;
}
