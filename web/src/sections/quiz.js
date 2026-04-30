import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadConversation } from '../data/loader.js';
import { HOOK_CONVERSATION_IDS, HOOK_NUM_BUBBLES } from '../data/constants.js';

function pickHookId() {
  return HOOK_CONVERSATION_IDS[Math.floor(Math.random() * HOOK_CONVERSATION_IDS.length)];
}

export async function init() {
  const chatEl = document.getElementById('quiz-chat');
  const promptArea = document.getElementById('quiz-prompt-area');
  const resultEl = document.getElementById('quiz-result');

  const hookId = pickHookId();
  let conv;
  try {
    conv = await loadConversation(hookId);
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

  // Prompt line with Human / AI as boxed buttons (above the thread)
  promptArea.classList.remove('hidden');
  /* Use a div (not p): buttons inside <p> are invalid HTML — parsers close <p> early and styling breaks. */
  promptArea.innerHTML = `
    <p class="quiz-prompt-overline">read the thread, then choose</p>
    <div class="quiz-prompt-line" role="group" aria-label="Is this human or AI?">
      <span class="quiz-prompt-plain">Is this</span>
      <button type="button" class="quiz-word quiz-choice-btn" data-answer="human" aria-label="Answer: Human">Human</button>
      <span class="quiz-prompt-plain">or</span>
      <button type="button" class="quiz-word quiz-choice-btn" data-answer="ai" aria-label="Answer: AI">AI</button>
      <span class="quiz-prompt-plain">?</span>
    </div>
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
  // Two layers of defence:
  //   1. wheel preventDefault — blocks new gesture events immediately.
  //   2. scroll clamp — snaps back any scroll that slips through mid-flight on
  //      macOS trackpads, where the browser ignores preventDefault() for a
  //      gesture that was already in progress when the listener was added.
  const preventScroll = (e) => e.preventDefault();
  let scrollLocked = false;
  let lockedScrollY = 0;
  const clampScroll = () => {
    if (window.scrollY !== lockedScrollY) {
      window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
    }
  };
  function lockScroll() {
    if (scrollLocked) return;
    scrollLocked = true;
    lockedScrollY = window.scrollY;
    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('keydown', blockScrollKeys, { passive: false });
    window.addEventListener('scroll', clampScroll, { passive: true });
  }
  function unlockScroll() {
    if (!scrollLocked) return;
    scrollLocked = false;
    window.removeEventListener('wheel', preventScroll);
    window.removeEventListener('touchmove', preventScroll);
    window.removeEventListener('keydown', blockScrollKeys);
    window.removeEventListener('scroll', clampScroll);
  }
  function blockScrollKeys(e) {
    const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Space', ' '];
    if (keys.includes(e.key)) e.preventDefault();
  }

  // Click handling on the Human / AI choice buttons
  promptArea.querySelectorAll('.quiz-word').forEach(word => {
    word.addEventListener('click', () => {
      if (answered) return;
      if (!promptArea.classList.contains('choice-ready')) return;
      answered = true;
      stopWordChoiceHint();
      unlockScroll();
      const answer = word.dataset.answer;
      const correct = answer === 'ai';
      promptArea.classList.add('quiz-prompt-answered');
      promptArea.querySelectorAll('.quiz-word').forEach((w) => {
        w.classList.add('answered');
        w.disabled = true;
      });
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <p class="quiz-result-line">
          You chose <strong>${correct ? 'AI' : 'Human'}</strong>${correct ? '' : ' — the label for this thread is <strong>AI</strong>'}.
        </p>
      `;
      gsap.fromTo(resultEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5 });
      // Collapse only after explicit “continue” intent (scroll or wheel), not immediately.
      const scrollYAtAnswer = window.scrollY;
      // Lower thresholds so "continue" triggers with less extra scrolling.
      const scrollThreshold = () => Math.max(30, Math.min(64, window.innerHeight * 0.065));
      const wheelThreshold = () => Math.max(48, Math.min(96, window.innerHeight * 0.09));

      let collapseArmed = false;
      function disarmContinueListeners() {
        window.removeEventListener('scroll', onScrollContinue, { passive: true });
        window.removeEventListener('wheel', onWheelContinue, { passive: false });
      }

      function triggerCollapseFromContinue() {
        if (collapseArmed) return;
        collapseArmed = true;
        disarmContinueListeners();
        gsap.to(resultEl, { opacity: 0, y: -12, duration: 0.26, ease: 'power1.out' });
        // Undo the small scroll that fired the trigger so motion reads as “squeeze”, not “page drift”.
        if (Math.abs(window.scrollY - scrollYAtAnswer) > 2) {
          window.scrollTo({ top: scrollYAtAnswer, behavior: 'instant' });
        }
        // Bubble scrub fights transforms during collapse — kill it first.
        revealTl.kill();
        gsap.set(bubbles, { clearProps: 'transform' });
        gsap.set(bubbles, { opacity: 1, y: 0 });
        requestAnimationFrame(() => playCollapseIntoChart());
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

  // ----- Continue-triggered collapse: chat frame morphs into the size/aspect of the
  //       detective chart that lives in the next section. The frame stays on-screen
  //       (not chasing the offscreen detective container) and fades out as we scroll
  //       the page into the detective section, so the chart appears to "open out" of
  //       the same rectangle the chat just shrank into.
  let armed = false;
  function playCollapseIntoChart() {
    if (armed) return;

    const section = document.getElementById('s-quiz');
    if (!section) return;

    armed = true;

    const chatRect = chatEl.getBoundingClientRect();
    const framePad = 12;
    const frameRect = {
      left: chatRect.left - framePad,
      top: chatRect.top - framePad,
      width: Math.max(40, chatRect.width + framePad * 2),
      height: Math.max(40, chatRect.height + framePad * 2),
    };

    // Target dimensions: match the detective chart svg (its natural rendered size).
    // Fall back to the SVG's intrinsic 600×280 viewBox if it hasn't laid out yet.
    const detectiveSvg = document.querySelector('#detective-viz svg');
    let targetW = 600, targetH = 280;
    if (detectiveSvg) {
      const r = detectiveSvg.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        targetW = r.width;
        targetH = r.height;
      }
    }
    // Center the target rect on screen at the chat's current vertical centre so the
    // morph reads as in-place reshape rather than a flying box.
    const chatCenterX = chatRect.left + chatRect.width / 2;
    const chatCenterY = chatRect.top + chatRect.height / 2;
    const targetRect = {
      left: chatCenterX - targetW / 2,
      top:  chatCenterY - targetH / 2,
      width:  targetW,
      height: targetH,
    };

    lockScroll();

    let collapseFrame = document.getElementById('quiz-collapse-frame');
    if (!collapseFrame) {
      collapseFrame = document.createElement('div');
      collapseFrame.id = 'quiz-collapse-frame';
      collapseFrame.className = 'quiz-collapse-frame';
      document.body.appendChild(collapseFrame);
    }
    gsap.set(collapseFrame, {
      left: frameRect.left,
      top: frameRect.top,
      width: frameRect.width,
      height: frameRect.height,
      opacity: 0,
      scale: 1,
      transformOrigin: '50% 50%',
    });
    gsap.set(chatEl, { transformOrigin: '50% 50%', x: 0, y: 0, scale: 1 });
    gsap.set(bubbles, { transformOrigin: '50% 50%', clearProps: 'filter' });

    const squeezeDur = 0.78;
    const easeSqueeze = 'power3.inOut';

    const tl = gsap.timeline({
      delay: 0.06,
      onComplete: () => {
        unlockScroll();
        // Hand off to the detective section. The frame fades as the page begins
        // scrolling so the chart appears to emerge from where the rectangle was.
        const detectiveSection = document.getElementById('s-detective');
        if (detectiveSection) detectiveSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        gsap.to(collapseFrame, {
          opacity: 0,
          duration: 0.55,
          delay: 0.25,
          ease: 'power1.out',
          onComplete: () => gsap.set(collapseFrame, { display: 'none' }),
        });
      },
    });

    tl.to(collapseFrame, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 0);

    // Micro “gather” so motion reads before the morph
    tl.to(bubbles, {
      scale: 0.92,
      duration: 0.12,
      stagger: 0.02,
      ease: 'power1.out',
    }, 0);

    // Frame morphs from chat rect → detective chart rect (in place, on-screen)
    tl.to(collapseFrame, {
      left: targetRect.left,
      top:  targetRect.top,
      width:  targetRect.width,
      height: targetRect.height,
      duration: squeezeDur,
      ease: easeSqueeze,
    }, 0.14);

    tl.to(bubbles, {
      opacity: 0,
      scale: 0.6,
      duration: squeezeDur * 0.55,
      stagger: 0.015,
      ease: easeSqueeze,
    }, 0.18);
    tl.to(chatEl, {
      opacity: 0,
      duration: squeezeDur * 0.55,
      ease: easeSqueeze,
    }, 0.2);
    tl.set(chatEl, { pointerEvents: 'none' }, 0.25);
  }

  // Restore the chat when the viewer scrolls back up into the quiz section
  // after the collapse has fired, so the conversation can be re-read.
  ScrollTrigger.create({
    trigger: '#s-quiz',
    start: 'top 60%',
    end:   'bottom 40%',
    onEnterBack: () => {
      if (!armed) return;
      const collapseFrame = document.getElementById('quiz-collapse-frame');
      gsap.killTweensOf([chatEl, ...bubbles, collapseFrame].filter(Boolean));
      if (collapseFrame) gsap.set(collapseFrame, { opacity: 0, display: 'none' });
      gsap.set(chatEl, { opacity: 1, pointerEvents: 'auto', x: 0, y: 0, scale: 1 });
      gsap.set(bubbles, { opacity: 1, y: 0, scale: 1, clearProps: 'transform,filter' });
      if (resultEl) gsap.set(resultEl, { opacity: 1, y: 0 });
    },
  });
}
