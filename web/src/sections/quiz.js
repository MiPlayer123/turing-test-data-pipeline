const QUIZ_LINES = [
  { side: 'left', text: "Do you ever feel like you're just going through the motions?" },
  { side: 'right', text: "Yeah, honestly? Sometimes I do. Like, I'll be in the middle of something and suddenly wonder if I'm actually present or just... performing presence, you know?" },
  { side: 'left', text: "That's a really specific way to put it. Performing presence." },
  { side: 'right', text: "I mean... I guess I'd say I'm pretty sure I'm human? Like, I can feel the chair I'm sitting on right now." },
];

export function init() {
  const chatEl = document.getElementById('quiz-chat');
  const promptArea = document.getElementById('quiz-prompt-area');
  const resultEl = document.getElementById('quiz-result');
  const buttonsEl = document.getElementById('quiz-buttons');

  // Animate bubbles in one by one
  QUIZ_LINES.forEach((line, i) => {
    const bubble = document.createElement('div');
    bubble.className = `hook-bubble ${line.side}`;
    bubble.textContent = line.text;
    chatEl.appendChild(bubble);
  });

  // After last bubble animates in, show the prompt
  const totalDelay = QUIZ_LINES.length * 500 + 800;
  setTimeout(() => {
    promptArea.classList.remove('hidden');
    promptArea.style.opacity = '0';
    promptArea.style.transform = 'translateY(12px)';
    requestAnimationFrame(() => {
      promptArea.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      promptArea.style.opacity = '1';
      promptArea.style.transform = 'translateY(0)';
    });
  }, totalDelay);

  // Button click handler
  buttonsEl.querySelectorAll('.quiz-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const userAnswer = btn.dataset.answer;
      const correct = userAnswer === 'ai';

      buttonsEl.querySelectorAll('.quiz-btn').forEach(b => {
        b.disabled = true;
        if (b.dataset.answer === 'ai') b.classList.add('correct');
        else if (b === btn && !correct) b.classList.add('wrong');
      });

      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <h3 style="color:${correct ? '#2ECC71' : '#E74C3C'}; font-size:28px;">${correct ? 'Correct!' : 'Not quite.'}</h3>
        <p>This was <strong style="color:#D97706;">Claude Sonnet 4</strong>, pretending to be human in a Reverse Turing conversation.</p>
        <p style="font-size:13px; color:#484F58; margin-top:16px;">How others answered:</p>
        <div class="quiz-result-bar">
          <div class="bar-segment" style="width:0%; background:#2ECC71;" data-target="34">34% AI &#10003;</div>
          <div class="bar-segment" style="width:0%; background:#E74C3C;" data-target="66">66% Human &#10007;</div>
        </div>
        <p style="font-size:12px; color:#484F58; margin-top:10px;">Most people guessed wrong. So did Claude — 50% accuracy as a detective.</p>
      `;

      setTimeout(() => {
        resultEl.querySelectorAll('.bar-segment').forEach(seg => {
          seg.style.width = seg.dataset.target + '%';
        });
      }, 100);
    });
  });
}
