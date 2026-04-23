import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Morph the "Reverse Turing" subtype card title into the timeline's gold heading.
// Same ghost-rect technique as the AI-AI → "Unpacking AI-AI" morph in subtypes.js.
// Fires as the viewer scrolls out of subtypes and into timeline; completes before
// the timeline's line-draw animation kicks in.
export function init() {
  const sourceTitle = document.querySelector('.subtype-card[data-key="ai_ai_reverse_turing"] .subtype-name');
  const targetTitle = document.querySelector('.timeline-title');
  const targetSub   = document.querySelector('.timeline-sub');
  const timeline    = document.getElementById('s-timeline');
  if (!sourceTitle || !targetTitle || !timeline) return;

  const ghost = document.createElement('div');
  ghost.className = 'timeline-title-ghost';
  ghost.textContent = 'Reverse Turing.';
  document.body.appendChild(ghost);
  gsap.set(ghost, { opacity: 0 });

  let cachedPositions = null;
  const computePositions = () => {
    const startRect = sourceTitle.getBoundingClientRect();
    const endRect   = targetTitle.getBoundingClientRect();
    const startSize = parseFloat(getComputedStyle(sourceTitle).fontSize);
    const endSize   = parseFloat(getComputedStyle(targetTitle).fontSize);
    return {
      startLeft: startRect.left + window.scrollX,
      startTop:  startRect.top  + window.scrollY,
      endLeft:   endRect.left + window.scrollX,
      endTop:    endRect.top  + window.scrollY,
      startSize, endSize,
    };
  };

  ScrollTrigger.create({
    trigger: timeline,
    start: 'top bottom', // timeline section enters viewport
    end:   'top 30%',    // morph completes as chart area is about to take over
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      const positions = computePositions();
      if (positions) cachedPositions = positions;
      const pos = cachedPositions;
      if (!pos) return;
      const lerp = (a, b) => a + (b - a) * p;
      gsap.set(ghost, {
        position: 'absolute',
        left: lerp(pos.startLeft, pos.endLeft),
        top:  lerp(pos.startTop,  pos.endTop),
        fontSize: `${lerp(pos.startSize, pos.endSize)}px`,
        opacity: Math.min(1, p * 4),
      });
      // Real title + subtitle hold until morph is nearly done
      const textT = Math.max(0, (p - 0.85) / 0.15);
      if (targetTitle) gsap.set(targetTitle, { opacity: textT });
      if (targetSub)   gsap.set(targetSub,   { opacity: textT });
      // Fade ghost out as real title takes over
      if (p > 0.9) gsap.set(ghost, { opacity: Math.max(0, 1 - (p - 0.9) * 10) });
    },
    onLeaveBack: () => {
      gsap.set(ghost, { opacity: 0 });
      if (targetTitle) gsap.set(targetTitle, { opacity: 0 });
      if (targetSub)   gsap.set(targetSub,   { opacity: 0 });
    },
    onLeave: () => {
      gsap.set(ghost, { opacity: 0 });
      if (targetTitle) gsap.set(targetTitle, { opacity: 1 });
      if (targetSub)   gsap.set(targetSub,   { opacity: 1 });
    },
  });
}
