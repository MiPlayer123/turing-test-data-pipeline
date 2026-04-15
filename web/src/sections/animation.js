import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as d3 from 'd3';
import { getAiAiBarPosition } from './comparison.js';

gsap.registerPlugin(ScrollTrigger);

export function init(data) {
  const aiRows = data.conversations.filter(d => d.condition.startsWith('ai_ai_'));
  const statsEl = document.getElementById('anim-card-stats');
  statsEl.textContent = `${aiRows.length} conversations`;

  const pin = document.getElementById('anim-pin');
  const aiCard = document.getElementById('anim-ai-card');
  const subtypes = document.getElementById('anim-subtypes');
  const subtypeCards = document.querySelectorAll('.anim-subtype');

  const rtCard = [...subtypeCards].find(c =>
    c.querySelector('.anim-sub-name')?.textContent === 'Reverse Turing'
  );

  // Position the AI-AI card at the bar's location initially
  // We'll update this when the ScrollTrigger fires
  ScrollTrigger.create({
    trigger: '#s-animation',
    start: 'top bottom',
    once: true,
    onEnter: () => {
      // Get the AI-AI bar position from the comparison chart
      const barRect = getAiAiBarPosition();
      const pinRect = pin.getBoundingClientRect();

      // Position the card where the bar label is
      aiCard.style.left = (barRect.left - pinRect.left + barRect.width / 2) + 'px';
      aiCard.style.top = (barRect.top - pinRect.top) + 'px';
      aiCard.style.transform = 'translate(-50%, -50%)';
    },
  });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#s-animation',
      start: 'top top',
      end: '+=100%',
      scrub: 0.5,
      pin: '#anim-pin',
      anticipatePin: 1,
      onEnter: () => {
        // Fade out the comparison chart as we enter
        gsap.to('#comparison-viz', { opacity: 0, duration: 0.3 });
      },
      onLeaveBack: () => {
        // Restore comparison chart if scrolling back
        gsap.to('#comparison-viz', { opacity: 1, duration: 0.3 });
      },
    },
  });

  // 0-12%: Card appears (starting from bar position) and moves to center
  tl.to(aiCard, {
    opacity: 1,
    left: '50%',
    top: '42%',
    scale: 1,
    duration: 0.12,
    ease: 'power2.out',
  }, 0);

  // 12-20%: Card moves up to top area
  tl.to(aiCard, {
    top: '10%',
    duration: 0.08,
    ease: 'power2.inOut',
  }, 0.12);

  // 20-22%: Subtypes container visible
  tl.to(subtypes, { opacity: 1, duration: 0.02 }, 0.20);

  // 22-38%: Cards stagger in from below
  tl.to(subtypeCards, {
    opacity: 1,
    y: 0,
    stagger: 0.03,
    duration: 0.03,
    ease: 'power2.out',
  }, 0.22);

  // 38-55%: Hold for reading

  // 55-63%: Non-RT cards + parent card fade out
  subtypeCards.forEach(card => {
    if (card !== rtCard) {
      tl.to(card, { opacity: 0, y: -10, duration: 0.06 }, 0.55);
    }
  });
  tl.to(aiCard, { opacity: 0, duration: 0.06 }, 0.55);

  // 63-80%: RT card moves to center-top of screen
  if (rtCard) {
    tl.to(rtCard, {
      x: 0,
      y: () => {
        const pinRect = pin.getBoundingClientRect();
        const cardRect = rtCard.getBoundingClientRect();
        // Move to ~15% from top, centered
        return (pinRect.height * 0.12) - (cardRect.top - pinRect.top);
      },
      duration: 0.17,
      ease: 'power2.inOut',
    }, 0.63);
  }

  // 80-100%: RT card fades out — timeline takes over
  if (rtCard) {
    tl.to(rtCard, { opacity: 0, duration: 0.10 }, 0.82);
  }
  tl.to(subtypes, { opacity: 0, duration: 0.10 }, 0.82);
}
