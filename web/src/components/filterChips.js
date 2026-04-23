import { CONDITIONS } from '../data/constants.js';

export function createFilterChips(container, { onToggle, initialActive = null }) {
  const active = new Set(initialActive || CONDITIONS.map(c => c.key));

  container.innerHTML = '';
  CONDITIONS.forEach(c => {
    const chip = document.createElement('span');
    chip.className = `chip ${active.has(c.key) ? 'active' : 'inactive'}`;
    chip.style.borderColor = c.color;
    chip.style.color = c.color;
    chip.style.background = active.has(c.key) ? c.color + '1A' : 'transparent';
    chip.textContent = c.label;
    chip.addEventListener('click', () => {
      if (active.has(c.key)) {
        active.delete(c.key);
        chip.classList.replace('active', 'inactive');
        chip.style.background = 'transparent';
      } else {
        active.add(c.key);
        chip.classList.replace('inactive', 'active');
        chip.style.background = c.color + '1A';
      }
      onToggle(active);
    });
    container.appendChild(chip);
  });

  return active;
}
