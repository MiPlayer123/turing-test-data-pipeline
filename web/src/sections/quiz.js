import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadConversation } from '../data/loader.js';
import { HOOK_CONVERSATION_IDS, HOOK_NUM_BUBBLES } from '../data/constants.js';
// (corner-dot helpers removed — quiz now hands the red dot off to #s-grid instead)

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

  // Scroll-lock helpers: hold the page in place until the viewer picks an answer.
  const preventScroll = (e) => e.preventDefault();
  let scrollLocked = false;
  function lockScroll() {
    if (scrollLocked) return;
    scrollLocked = true;
    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('keydown', blockScrollKeys, { passive: false });
  }
  function unlockScroll() {
    if (!scrollLocked) return;
    scrollLocked = false;
    window.removeEventListener('wheel', preventScroll);
    window.removeEventListener('touchmove', preventScroll);
    window.removeEventListener('keydown', blockScrollKeys);
  }
  function blockScrollKeys(e) {
    const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Space', ' '];
    if (keys.includes(e.key)) e.preventDefault();
  }

  ScrollTrigger.create({
    trigger: '#s-quiz',
    start: 'center center',
    onEnter: () => {
      gsap.to(promptArea, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
      // Lock scroll once the prompt is visible — viewer must answer to continue
      lockScroll();
    },
  });

  // Click handling on the underlined words
  let answered = false;
  promptArea.querySelectorAll('.quiz-word').forEach(word => {
    word.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      unlockScroll();
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
      // Time-based "blop": bubbles converge into a red dot at chat centre.
      // Triggered once the user has answered — NOT scroll-driven. The dot
      // then parks here until #s-grid animates it onto the axes.
      playBlopIntoDot();
    });
  });

  // ----- Click-triggered collapse: bubbles shrink INTO a red dot that blops
  //       into existence at the chat centre. Dot is owned here; #s-grid finds
  //       it by id (#story-red-dot). -----
  let armed = false;
  function playBlopIntoDot() {
    if (armed) return;
    armed = true;

    // Persistent red story-dot shared with #s-grid
    let flyDot = document.getElementById('story-red-dot');
    if (!flyDot) {
      flyDot = document.createElement('div');
      flyDot.id = 'story-red-dot';
      flyDot.className = 'fly-dot fly-dot-red';
      document.body.appendChild(flyDot);
    }

    const chatRect = chatEl.getBoundingClientRect();
    const cx = chatRect.left + chatRect.width  / 2 - 8;
    const cy = chatRect.top  + chatRect.height / 2 - 8;

    // Pre-position the dot at centre, hidden, scale 0 so the blop is dramatic
    gsap.set(flyDot, {
      left: cx, top: cy,
      opacity: 0, scale: 0,
      transformOrigin: '50% 50%',
    });

    // Give the viewer ~1.6s to read the verdict + watch the bars fill
    const tl = gsap.timeline({ delay: 1.6 });

    // Each bubble flies to the chat centre, shrinks, fades — staggered for rhythm
    bubbles.forEach((b, i) => {
      const r = b.getBoundingClientRect();
      const dx = (chatRect.left + chatRect.width  / 2) - (r.left + r.width  / 2);
      const dy = (chatRect.top  + chatRect.height / 2) - (r.top  + r.height / 2);
      tl.to(b, {
        x: dx, y: dy,
        scale: 0.05,
        opacity: 0,
        duration: 0.75,
        ease: 'power2.in',
      }, i * 0.04);
    });

    // Prompt line + "how others answered" fade up and out as bubbles converge
    tl.to([promptArea, resultEl], {
      opacity: 0, y: -12,
      duration: 0.55,
      ease: 'power2.in',
    }, 0.15);

    // BLOP — dot pops into existence at the impact point with a squash-and-settle
    tl.set(flyDot, { opacity: 1 }, 0.72);
    tl.to(flyDot, {
      scale: 1.6,
      duration: 0.18,
      ease: 'power2.out',
    }, 0.72);
    tl.to(flyDot, {
      scale: 1,
      duration: 0.5,
      ease: 'elastic.out(1, 0.55)',
    }, 0.9);
  }
}
