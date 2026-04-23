import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { light as lightCornerDot, getCornerRect, isLit } from '../lib/cornerDots.js';

export function init() {
  const section = document.getElementById('s-metrics-intro');
  if (!section) return;

  const hedgingRow    = document.getElementById('hedging-ai-ai-row');
  const repetitionRow = document.getElementById('repetition-ai-ai-row');
  if (!hedgingRow || !repetitionRow) return;

  // Build the yellow fly-dot — lazy, attached on first scroll into section
  const flyDot = document.createElement('div');
  flyDot.className = 'fly-dot fly-dot-yellow';
  document.body.appendChild(flyDot);

  // Red "satellite" dot — briefly detaches from corner to mark the hedging row, then returns
  const satDot = document.createElement('div');
  satDot.className = 'fly-dot fly-dot-red';
  document.body.appendChild(satDot);

  const rect = (el) => el.getBoundingClientRect();
  const cornerRedPos = () => {
    const c = getCornerRect('red');
    return c ? { left: c.left + c.width / 2 - 8, top: c.top + c.height / 2 - 8 } : { left: window.innerWidth - 40, top: 28 };
  };
  const cornerYellowPos = () => {
    const c = getCornerRect('yellow');
    return c ? { left: c.left + c.width / 2 - 8, top: c.top + c.height / 2 - 8 } : { left: window.innerWidth - 22, top: 28 };
  };

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#s-metrics-intro',
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
    },
  });

  // === Red satellite: detach from corner, hover over hedging AI-AI row, then return ===
  tl.call(() => {
    const p = cornerRedPos();
    gsap.set(satDot, { left: p.left, top: p.top, opacity: 0, scale: 1 });
  }, null, 0);
  tl.to(satDot, { opacity: 1, duration: 0.3 }, 0);
  tl.to(satDot, {
    left: () => {
      const r = rect(hedgingRow);
      return r.right - 18;
    },
    top: () => {
      const r = rect(hedgingRow);
      return r.top + r.height / 2 - 8;
    },
    duration: 2,
    ease: 'power2.inOut',
  }, 0.3);
  // brief hover pulse (tiny scale bump)
  tl.to(satDot, { scale: 1.4, duration: 0.5, ease: 'power2.out' }, 2.4);
  tl.to(satDot, { scale: 1,   duration: 0.4, ease: 'power2.inOut' }, 2.9);
  // return to corner
  tl.to(satDot, {
    left: () => cornerRedPos().left,
    top:  () => cornerRedPos().top,
    duration: 1.5,
    ease: 'power2.inOut',
  }, 3.4);
  tl.to(satDot, { opacity: 0, duration: 0.3 }, 4.8);

  // === Yellow born from repetition AI-AI row, flies arcing up right side, lands in corner ===
  tl.call(() => {
    const r = rect(repetitionRow);
    gsap.set(flyDot, {
      left: r.left + r.width / 2 - 8,
      top:  r.top  + r.height / 2 - 8,
      opacity: 0,
      scale: 0.3,
    });
  }, null, 5);
  tl.to(flyDot, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 5.1);
  // arc up the right side
  tl.to(flyDot, {
    left: () => window.innerWidth - 72,
    top:  () => window.innerHeight * 0.45,
    duration: 1.4,
    ease: 'power1.inOut',
  }, 6);
  // settle into corner yellow slot
  tl.to(flyDot, {
    left: () => cornerYellowPos().left,
    top:  () => cornerYellowPos().top,
    duration: 1.4,
    ease: 'power2.inOut',
  }, 7.4);
  tl.call(() => lightCornerDot('yellow'), null, 8.8);
  tl.to(flyDot, { opacity: 0, duration: 0.4 }, 8.9);
}
