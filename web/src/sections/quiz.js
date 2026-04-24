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

  // Rebuild the prompt area as plain text with clickable underlined words (above the thread)
  promptArea.classList.remove('hidden');
  promptArea.innerHTML = `
    <p class="quiz-prompt-line">
      Is this <span class="quiz-word" data-answer="human">human</span> or <span class="quiz-word" data-answer="ai">AI</span>?
    </p>
  `;
  gsap.set(promptArea, { opacity: 0, y: 16 });

  const humanWord = promptArea.querySelector('.quiz-word[data-answer="human"]');
  const aiWord = promptArea.querySelector('.quiz-word[data-answer="ai"]');
  let wordHintTl;
  let answered = false;

  // All bubbles hidden until after the question fades in on the same scrub timeline
  const bubbles = chatEl.querySelectorAll('.hook-bubble');
  gsap.set(bubbles, { opacity: 0, y: 32 });

  // Question leads, then bubbles (scroll-scrub). Do not lock scroll or treat choices as live
  // until the reveal is ~finished — otherwise the viewer cannot scroll to read the thread.
  let choicesArmed = false;
  let revealTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#s-quiz',
      start: 'top top',
      end: 'center center',
      scrub: 0.95,
      onUpdate(self) {
        if (answered) return;
        const p = self.progress;
        if (p >= 0.992 && !choicesArmed) {
          choicesArmed = true;
          promptArea.classList.add('choice-ready');
          lockScroll();
          startWordChoiceHint();
        } else if (p < 0.82 && choicesArmed) {
          choicesArmed = false;
          promptArea.classList.remove('choice-ready');
          unlockScroll();
          stopWordChoiceHint();
        }
      },
      onLeaveBack() {
        stopWordChoiceHint();
        if (!answered) {
          choicesArmed = false;
          promptArea.classList.remove('choice-ready');
          unlockScroll();
        }
      },
    },
  });
  revealTl.to(promptArea, { opacity: 1, y: 0, duration: 0.42 }, 0);
  bubbles.forEach((b, i) => {
    revealTl.to(b, { opacity: 1, y: 0, duration: 0.78 }, 0.52 + i * 0.58);
  });
  function startWordChoiceHint() {
    if (!humanWord || !aiWord || answered) return;
    stopWordChoiceHint();
    wordHintTl = gsap.timeline({ repeat: -1 });
    wordHintTl.to(
      humanWord,
      { y: -5, duration: 0.48, ease: 'sine.inOut', yoyo: true, repeat: 1 },
      0,
    );
    wordHintTl.to(
      aiWord,
      { y: 5, duration: 0.48, ease: 'sine.inOut', yoyo: true, repeat: 1 },
      0.1,
    );
  }
  function stopWordChoiceHint() {
    if (wordHintTl) wordHintTl.kill();
    wordHintTl = null;
    if (humanWord && aiWord) gsap.set([humanWord, aiWord], { clearProps: 'transform' });
  }

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

  // Click handling on the underlined words
  promptArea.querySelectorAll('.quiz-word').forEach(word => {
    word.addEventListener('click', () => {
      if (answered) return;
      if (!promptArea.classList.contains('choice-ready')) return;
      answered = true;
      stopWordChoiceHint();
      unlockScroll();
      const answer = word.dataset.answer;
      const correct = answer === 'ai';
      promptArea.querySelectorAll('.quiz-word').forEach(w => {
        w.classList.add('answered');
        if (w.dataset.answer === answer) w.classList.add(correct ? 'correct' : 'wrong');
        if (w.dataset.answer === 'ai') w.classList.add('is-truth');
      });
      resultEl.classList.remove('hidden');
      const summary = correct
        ? 'You chose <strong>AI</strong>. This thread is model-generated — that matches the dataset label.'
        : 'You chose <strong>Human</strong>. The label for this thread is <strong>AI</strong> — it is model-generated.';
      resultEl.innerHTML = `
        <p class="quiz-result-badge" aria-hidden="true">Answer</p>
        <p class="quiz-result-truth">AI</p>
        <p class="quiz-result-verdict">${correct ? 'Nice — you got it.' : 'Not quite this time.'}</p>
        <p class="quiz-result-summary">${summary}</p>
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
      // Collapse only after explicit “continue” intent (scroll or wheel), not immediately.
      const scrollYAtAnswer = window.scrollY;
      const scrollThreshold = () => Math.max(90, Math.min(160, window.innerHeight * 0.14));
      const wheelThreshold = () => Math.max(120, Math.min(220, window.innerHeight * 0.2));

      let collapseArmed = false;
      function disarmContinueListeners() {
        window.removeEventListener('scroll', onScrollContinue, { passive: true });
        window.removeEventListener('wheel', onWheelContinue, { passive: false });
      }

      function triggerCollapseFromContinue() {
        if (collapseArmed) return;
        collapseArmed = true;
        disarmContinueListeners();
        // Undo the small scroll that fired the trigger so motion reads as “squeeze”, not “page drift”.
        if (Math.abs(window.scrollY - scrollYAtAnswer) > 2) {
          window.scrollTo({ top: scrollYAtAnswer, behavior: 'instant' });
        }
        // Bubble scrub fights transforms during collapse — kill it first.
        revealTl.kill();
        gsap.set(bubbles, { clearProps: 'transform' });
        gsap.set(bubbles, { opacity: 1, y: 0 });
        requestAnimationFrame(() => playBlopIntoDot());
      }

      function onScrollContinue() {
        if (window.scrollY > scrollYAtAnswer + scrollThreshold()) {
          triggerCollapseFromContinue();
        }
      }

      let wheelAcc = 0;
      function onWheelContinue(e) {
        wheelAcc += Math.abs(e.deltaY);
        if (wheelAcc >= wheelThreshold()) {
          e.preventDefault();
          triggerCollapseFromContinue();
        }
      }

      window.addEventListener('scroll', onScrollContinue, { passive: true });
      window.addEventListener('wheel', onWheelContinue, { passive: false });
    });
  });

  // ----- Click-triggered collapse: whole quiz stack (chat + question + results/bars)
  //       converges into one red dot. Dot is owned here; #s-grid finds #story-red-dot.
  let armed = false;
  function playBlopIntoDot() {
    if (armed) return;

    const container = document.querySelector('#s-quiz .quiz-container');
    if (!container) return;

    armed = true;

    // Persistent red story-dot shared with #s-grid
    let flyDot = document.getElementById('story-red-dot');
    if (!flyDot) {
      flyDot = document.createElement('div');
      flyDot.id = 'story-red-dot';
      flyDot.className = 'fly-dot fly-dot-red';
      document.body.appendChild(flyDot);
    }

    lockScroll();

    const cRect = container.getBoundingClientRect();
    const targetX = cRect.left + cRect.width / 2;
    const targetY = cRect.top + cRect.height / 2;
    const cx = targetX - 8;
    const cy = targetY - 8;

    // Stack squeeze reads as one object: whole container scales into the impact point.
    const originX = ((targetX - cRect.left) / Math.max(cRect.width, 1)) * 100;
    const originY = ((targetY - cRect.top) / Math.max(cRect.height, 1)) * 100;
    gsap.set(container, {
      transformOrigin: `${originX}% ${originY}%`,
      x: 0,
      y: 0,
      scale: 1,
    });
    gsap.set([promptArea, resultEl], { transformOrigin: '50% 50%', x: 0, y: 0, scale: 1 });
    gsap.set(bubbles, { transformOrigin: '50% 50%' });

    // Pre-position the dot at impact centre (hidden until stack nearly vanishes)
    gsap.set(flyDot, {
      left: cx, top: cy,
      opacity: 0, scale: 0, y: 0,
      transformOrigin: '50% 50%',
    });

    const squeezeDur = 0.92;
    const easeSqueeze = 'power4.in';

    const tl = gsap.timeline({
      delay: 0.06,
      onStart: () => {
        container.classList.add('is-collapsing');
      },
      onComplete: () => {
        container.classList.remove('is-collapsing');
        unlockScroll();
      },
    });

    // Micro “gather” so motion reads before the hard squeeze
    tl.to(bubbles, {
      scale: 0.92,
      duration: 0.12,
      stagger: 0.02,
      ease: 'power1.out',
    }, 0);
    tl.to([promptArea, resultEl], { scale: 0.96, duration: 0.12, ease: 'power1.out' }, 0.02);

    // Whole stack collapses into one point (dominant read)
    tl.to(container, {
      scale: 0.028,
      duration: squeezeDur,
      ease: easeSqueeze,
    }, 0.14);
    tl.to([promptArea, resultEl], {
      opacity: 0,
      duration: squeezeDur * 0.55,
      ease: easeSqueeze,
    }, 0.22);
    tl.to(bubbles, {
      opacity: 0,
      scale: 0.35,
      duration: squeezeDur * 0.65,
      stagger: 0.015,
      ease: easeSqueeze,
    }, 0.18);

    const impactT = 0.14 + squeezeDur * 0.82;
    tl.set(flyDot, { opacity: 1, scale: 0.12, y: 0 }, impactT);
    tl.to(flyDot, {
      scale: 2.05,
      duration: 0.14,
      ease: 'power3.out',
    }, impactT);
    tl.to(flyDot, {
      scale: 1,
      duration: 0.52,
      ease: 'elastic.out(1.15, 0.48)',
    }, impactT + 0.14);
    tl.to(flyDot, { y: -16, duration: 0.2, ease: 'power2.out' }, impactT + 0.56);
    tl.to(flyDot, { y: 0, duration: 0.55, ease: 'bounce.out(1.35)' }, impactT + 0.76);
    tl.to(flyDot, { y: -6, duration: 0.14, ease: 'power2.out' }, impactT + 1.33);
    tl.to(flyDot, { y: 0, scale: 1, duration: 0.32, ease: 'power2.inOut' }, impactT + 1.47);
    tl.set(container, { opacity: 0, pointerEvents: 'none' }, impactT + 0.05);
  }
}
