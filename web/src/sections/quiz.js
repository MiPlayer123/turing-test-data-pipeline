import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadConversation } from '../data/loader.js';
import { HOOK_CONVERSATION_IDS, HOOK_NUM_BUBBLES } from '../data/constants.js';
import { light as lightCornerDot, getCornerRect } from '../lib/cornerDots.js';

function pickHookId() {
  return HOOK_CONVERSATION_IDS[Math.floor(Math.random() * HOOK_CONVERSATION_IDS.length)];
}

export async function init() {
  const chatEl = document.getElementById('quiz-chat');
  const promptArea = document.getElementById('quiz-prompt-area');
  const resultEl = document.getElementById('quiz-result');

  let conv;
  try {
    conv = await loadConversation(pickHookId());
  } catch (err) {
    console.warn('Hook load failed, aborting quiz init:', err);
    return;
  }

  const turns = (conv.turns || []).slice(0, HOOK_NUM_BUBBLES);
  if (!turns.length) return;

  // Render bubbles (unlabeled)
  chatEl.innerHTML = '';
  turns.forEach((turn, i) => {
    const bubble = document.createElement('div');
    bubble.className = `hook-bubble ${i % 2 === 0 ? 'left' : 'right'}`;
    bubble.textContent = turn.message || turn.content || '';
    chatEl.appendChild(bubble);
  });

  // Bubble reveal: first bubble visible on load to show "something is here".
  // Remaining bubbles scroll-scrub in as user scrolls the section.
  const bubbles = chatEl.querySelectorAll('.hook-bubble');
  gsap.set(bubbles[0], { opacity: 1, y: 0 });
  const later = Array.from(bubbles).slice(1);
  gsap.set(later, { opacity: 0, y: 32 });
  const revealTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#s-quiz',
      start: 'top top',
      end: 'center center',
      scrub: 0.4,
    },
  });
  later.forEach((b, i) => {
    revealTl.to(b, { opacity: 1, y: 0, duration: 1 }, i * 1.2);
  });

  // Scroll nudge arrow at the bottom of the pinned viewport — disappears once user scrolls
  const pin = document.querySelector('#s-quiz .quiz-pin');
  const nudge = document.createElement('div');
  nudge.className = 'scroll-nudge';
  nudge.innerHTML = '<span>scroll</span><span class="arrow">&#x2193;</span>';
  pin.appendChild(nudge);
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) nudge.classList.add('gone');
  }, { passive: true });

  // Rebuild the prompt area as plain text with clickable underlined words (scene 2 mockup)
  promptArea.classList.remove('hidden');
  promptArea.innerHTML = `
    <p class="quiz-prompt-line">
      Is this <span class="quiz-word" data-answer="human">human</span> or <span class="quiz-word" data-answer="ai">AI</span>?
    </p>
    <p class="quiz-prompt-hint">click to answer</p>
  `;
  gsap.set(promptArea, { opacity: 0, y: 16 });

  ScrollTrigger.create({
    trigger: '#s-quiz',
    start: 'center center',
    onEnter: () => {
      gsap.to(promptArea, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
    },
  });

  // Click handling on the underlined words
  let answered = false;
  promptArea.querySelectorAll('.quiz-word').forEach(word => {
    word.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const answer = word.dataset.answer;
      const correct = answer === 'ai';
      promptArea.querySelectorAll('.quiz-word').forEach(w => {
        w.classList.add('answered');
        if (w.dataset.answer === answer) w.classList.add(correct ? 'correct' : 'wrong');
      });
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <p class="quiz-result-verdict">${correct ? "Correct — it's AI." : "Actually — it's AI."}</p>
        <div class="others-bar">
          <p class="others-bar-label">How others answered</p>
          <div class="others-row">
            <span class="others-row-label">AI</span>
            <div class="others-row-track"><div class="others-row-fill" data-pct="74"></div></div>
            <span class="others-row-pct">74%</span>
          </div>
          <div class="others-row">
            <span class="others-row-label">Human</span>
            <div class="others-row-track"><div class="others-row-fill" data-pct="26"></div></div>
            <span class="others-row-pct">26%</span>
          </div>
        </div>
      `;
      gsap.fromTo(resultEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5 });
      // Animate the bars filling in after verdict lands
      const fills = resultEl.querySelectorAll('.others-row-fill');
      gsap.fromTo(fills,
        { width: 0 },
        { width: (_, el) => `${el.dataset.pct}%`, duration: 0.9, ease: 'power2.out', delay: 0.5, stagger: 0.12 }
      );
      // Now arm the collapse-to-corner morph on the next scroll segment of the pinned section.
      armCollapseToCorner();
    });
  });

  // ----- Collapse morph: bubbles → red dot → corner -----
  let armed = false;
  function armCollapseToCorner() {
    if (armed) return;
    armed = true;

    // Floating dot element used for the fly-to-corner motion (position:fixed, above pin)
    const flyDot = document.createElement('div');
    flyDot.className = 'fly-dot';
    document.body.appendChild(flyDot);

    const chatRect = () => chatEl.getBoundingClientRect();

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#s-quiz',
        start: 'center center',        // start right as the prompt/bar finish settling
        end: 'bottom bottom',          // end when section scroll completes (140vh of runway)
        scrub: true,                   // tight coupling — dot moves with the scrollbar
      },
    });

    // Phase A (progress 0→3): slowly converge bubbles to chat center, shrink + fade.
    // Long internal duration so it stretches across a lot of scroll.
    tl.to(bubbles, {
      x: 0, y: 0, scale: 0.2, opacity: 0,
      duration: 3,
      ease: 'power2.in',
      stagger: 0.1,
    }, 0);

    // Phase A.5: fade the prompt + bar chart as collapse starts
    tl.to([promptArea, resultEl], { opacity: 0, y: -10, duration: 2.5 }, 0.5);

    // Phase B (progress 2→4): position fly-dot at chat center, scale in
    tl.call(() => {
      const r = chatRect();
      gsap.set(flyDot, {
        left: r.left + r.width / 2 - 8,
        top:  r.top  + r.height / 2 - 8,
        opacity: 0,
        scale: 0.4,
      });
    }, null, 2);
    tl.to(flyDot, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, 2.2);

    // Phase C (progress 4→7): arc up the right side — pass through middle-right before top-right
    tl.to(flyDot, {
      left: () => window.innerWidth - 72,           // right edge margin
      top:  () => window.innerHeight * 0.45,        // middle-right waypoint
      duration: 1.5,
      ease: 'power1.inOut',
    }, 4);
    tl.to(flyDot, {
      left: () => {
        const c = getCornerRect('red');
        return c ? c.left + c.width / 2 - 8 : window.innerWidth - 40;
      },
      top: () => {
        const c = getCornerRect('red');
        return c ? c.top + c.height / 2 - 8 : 28;
      },
      duration: 1.5,
      ease: 'power2.inOut',
    }, 5.5);

    // Phase D (progress 7→8): hand off to the persistent corner dot, dismiss fly-dot
    tl.call(() => lightCornerDot('red'), null, 7);
    tl.to(flyDot, { opacity: 0, duration: 0.5 }, 7);
  }
}
