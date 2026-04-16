const METRICS = [
  {
    key: 'hedging',
    label: 'Hedging',
    description: 'Words that signal uncertainty — "I think", "maybe", "sort of", "I guess". Humans use them naturally. AIs use them more when trying to sound human.',
    example: '"I mean... I guess I\'d say I\'m pretty sure I\'m human? Like, I can feel the chair I\'m sitting on right now."',
    exampleSource: 'Claude Sonnet 4 — Reverse Turing condition',
  },
  {
    key: 'repetitiveness',
    label: 'Repetitiveness',
    description: '3-gram overlap between consecutive same-speaker turns. How much does a speaker repeat their own phrases and patterns?',
    example: '"That\'s a great question... that\'s really a great question... I think that\'s such a great question."',
    exampleSource: 'GPT-5.4 Mini — Freeform condition',
  },
];

let expandEls = [];

export function init() {
  const container = document.getElementById('metric-cards');
  container.innerHTML = '';

  METRICS.forEach(metric => {
    const card = document.createElement('div');
    card.className = 'metric-card-wide';
    card.innerHTML = `
      <div class="mcard-title">${metric.label}</div>
      <div class="mcard-desc">${metric.description}</div>
      <div class="mcard-expand">
        <div class="mcard-example">
          <blockquote>${metric.example}</blockquote>
          <cite>— ${metric.exampleSource}</cite>
        </div>
      </div>
    `;
    container.appendChild(card);
    expandEls.push(card.querySelector('.mcard-expand'));
  });

  // Auto-expand when section enters viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Expand both cards simultaneously after a short delay
        setTimeout(() => {
          expandEls.forEach(el => el.classList.add('open'));
        }, 600);
        observer.disconnect();
      }
    });
  }, { threshold: 0.4 });

  observer.observe(container);
}
