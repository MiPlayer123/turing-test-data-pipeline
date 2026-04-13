export function init() {
  // Count-up animation for stat numbers
  document.querySelectorAll('.stat-box .number').forEach(el => {
    const target = +el.dataset.count;
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      el.textContent = Math.round(ease * target);
      if (t < 1) requestAnimationFrame(tick);
    }
    // Start when hero is visible (it's the first section, so immediately)
    requestAnimationFrame(tick);
  });
}
