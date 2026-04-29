import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { light, unlight, getCornerRect } from '../lib/cornerDots.js';
import { CONDITION_COLOR } from '../data/constants.js';

// Detective dot delivers the chart title.
// Orange dot flies from its corner-dot anchor to the title position,
// the title fades in mid-flight, then the dot returns to its corner.
// Scroll-scrubbed so the motion plays in both directions.
export function init() {
  const section  = document.getElementById('s-detective');
  const titleEl  = document.querySelector('.detective-chart-title');
  if (!section || !titleEl) return;

  const dot = document.createElement('div');
  dot.className = 'fly-dot fly-dot-detective';
  dot.style.background = CONDITION_COLOR.ai_ai_detective;
  dot.style.boxShadow  = `0 0 24px ${CONDITION_COLOR.ai_ai_detective}b3`;
  document.body.appendChild(dot);

  gsap.set(titleEl, { opacity: 0 });
  gsap.set(dot, { opacity: 0, position: 'fixed', left: 0, top: 0 });

  let cached = null;
  const computePositions = () => {
    const corner = getCornerRect('detective');
    const titleRect = titleEl.getBoundingClientRect();
    if (!corner || !titleRect || titleRect.width === 0) return null;
    return {
      cornerX: corner.left + corner.width / 2,
      cornerY: corner.top  + corner.height / 2,
      titleX:  titleRect.left - 22,
      titleY:  titleRect.top + titleRect.height / 2,
    };
  };

  ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    end:   'top 20%',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      const pos = computePositions();
      if (pos) cached = pos;
      if (!cached) return;

      // Phase split: 0–0.45 deliver, 0.45–0.55 hold, 0.55–1.0 return.
      let x, y;
      if (p <= 0.45) {
        const t = p / 0.45;
        x = cached.cornerX + (cached.titleX - cached.cornerX) * t;
        y = cached.cornerY + (cached.titleY - cached.cornerY) * t;
      } else if (p <= 0.55) {
        x = cached.titleX;
        y = cached.titleY;
      } else {
        const t = (p - 0.55) / 0.45;
        x = cached.titleX + (cached.cornerX - cached.titleX) * t;
        y = cached.titleY + (cached.cornerY - cached.titleY) * t;
      }

      // Dot opacity: fade in at start, fade out near end so it visually
      // hands off into the (lit) corner dot.
      let dotOpacity;
      if (p < 0.08)      dotOpacity = p / 0.08;
      else if (p > 0.92) dotOpacity = Math.max(0, (1 - p) / 0.08);
      else               dotOpacity = 1;

      gsap.set(dot, { left: x - 8, top: y - 8, opacity: dotOpacity });

      // Title appears only after the dot has arrived.
      const titleT = gsap.utils.clamp(0, 1, (p - 0.45) / 0.10);
      gsap.set(titleEl, { opacity: titleT });

      // Corner dot lights up as the fly-dot is near home on return.
      if (p > 0.95) light('detective');
      else unlight('detective');
    },
    onLeave: () => {
      gsap.set(dot, { opacity: 0 });
      gsap.set(titleEl, { opacity: 1 });
      light('detective');
    },
    onLeaveBack: () => {
      gsap.set(dot, { opacity: 0 });
      gsap.set(titleEl, { opacity: 0 });
      unlight('detective');
    },
  });
}
