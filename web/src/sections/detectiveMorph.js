import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function init() {
  const section = document.getElementById('s-detective');
  const titleEl = document.querySelector('.detective-chart-title');
  if (!section || !titleEl) return;

  gsap.set(titleEl, { opacity: 0 });

  ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    end:   'top 20%',
    scrub: true,
    onUpdate: (self) => {
      gsap.set(titleEl, { opacity: Math.min(1, self.progress / 0.4) });
    },
    onLeave:     () => gsap.set(titleEl, { opacity: 1 }),
    onLeaveBack: () => gsap.set(titleEl, { opacity: 0 }),
  });
}
