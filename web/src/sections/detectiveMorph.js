import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function init() {
  const section = document.getElementById('s-detective');
  const titleEl = document.querySelector('.detective-chart-title');
  const subtitleEl = document.querySelector('.detective-chart-subtitle');
  if (!section || !titleEl) return;

  const fadeTargets = [titleEl, subtitleEl].filter(Boolean);
  gsap.set(fadeTargets, { opacity: 0 });

  ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    end:   'top 20%',
    scrub: true,
    onUpdate: (self) => {
      gsap.set(fadeTargets, { opacity: Math.min(1, self.progress / 0.4) });
    },
    onLeave:     () => gsap.set(fadeTargets, { opacity: 1 }),
    onLeaveBack: () => gsap.set(fadeTargets, { opacity: 0 }),
  });
}
