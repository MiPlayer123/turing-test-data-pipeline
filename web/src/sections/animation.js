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
  const bridge = document.getElementById('anim-bridge');

  const rtCard = [...subtypeCards].find(c =>
    c.querySelector('.anim-sub-name')?.textContent === 'Reverse Turing'
  );

  // Position the AI-AI card at the bar's location initially
  ScrollTrigger.create({
    trigger: '#s-animation',
    start: 'top bottom',
    once: true,
    onEnter: () => {
      const barRect = getAiAiBarPosition();
      const pinRect = pin.getBoundingClientRect();
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
        gsap.to('#comparison-viz', { opacity: 0, duration: 0.3 });
      },
      onLeaveBack: () => {
        gsap.to('#comparison-viz', { opacity: 1, duration: 0.3 });
      },
    },
  });

  // 0-12%: Card appears and moves to center
  tl.to(aiCard, {
    opacity: 1,
    left: '50%',
    top: '42%',
    scale: 1,
    duration: 0.12,
    ease: 'power2.out',
  }, 0);

  // 12-18%: Card moves up to top area
  tl.to(aiCard, {
    top: '10%',
    duration: 0.06,
    ease: 'power2.inOut',
  }, 0.12);

  // 18-20%: Subtypes container visible
  tl.to(subtypes, { opacity: 1, duration: 0.02 }, 0.18);

  // 20-34%: Cards stagger in
  tl.to(subtypeCards, {
    opacity: 1,
    y: 0,
    stagger: 0.03,
    duration: 0.03,
    ease: 'power2.out',
  }, 0.20);

  // 34-48%: Hold for reading

  // 48-55%: Non-RT cards + parent card fade out
  subtypeCards.forEach(card => {
    if (card !== rtCard) {
      tl.to(card, { opacity: 0, y: -10, duration: 0.06 }, 0.48);
    }
  });
  tl.to(aiCard, { opacity: 0, duration: 0.06 }, 0.48);

  // 55-68%: RT card moves to center
  if (rtCard) {
    tl.to(rtCard, {
      x: 0,
      y: () => {
        const pinRect = pin.getBoundingClientRect();
        const cardRect = rtCard.getBoundingClientRect();
        return (pinRect.height * 0.38) - (cardRect.top - pinRect.top);
      },
      duration: 0.13,
      ease: 'power2.inOut',
    }, 0.55);
  }

  // 68-78%: Bridge text fades in below RT card
  tl.to(bridge, {
    opacity: 1,
    duration: 0.10,
    ease: 'power2.out',
  }, 0.68);

  // 78-80%: Hold bridge + RT visible

  // 80-92%: RT card + bridge text fade out together
  if (rtCard) {
    tl.to(rtCard, { opacity: 0, duration: 0.10 }, 0.80);
  }
  tl.to(bridge, { opacity: 0, duration: 0.10 }, 0.80);
  tl.to(subtypes, { opacity: 0, duration: 0.10 }, 0.80);
}
