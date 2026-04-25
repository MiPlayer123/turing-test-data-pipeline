import { CONDITIONS } from '../data/constants.js';

export function createFilterChips(container, { onToggle, initialActive = null }) {
  const active = new Set(initialActive || CONDITIONS.map(c => c.key));
  const chips = new Map();

  const repaint = () => {
    CONDITIONS.forEach((c) => {
      const chip = chips.get(c.key);
      const isActive = active.has(c.key);
      chip.className = `chip ${isActive ? 'active' : 'inactive'}`;
      chip.style.background = isActive ? c.color + '1A' : 'transparent';
    });
  };

  container.innerHTML = '';
  CONDITIONS.forEach(c => {
    const chip = document.createElement('span');
    chip.className = `chip ${active.has(c.key) ? 'active' : 'inactive'}`;
    chip.style.borderColor = c.color;
    chip.style.color = c.color;
    chip.style.background = active.has(c.key) ? c.color + '1A' : 'transparent';
    chip.textContent = c.label;
    chips.set(c.key, chip);
    chip.addEventListener('click', () => {
      // Explorer behavior: click isolates one condition; clicking it again restores all.
      const alreadySolo = active.size === 1 && active.has(c.key);
      if (alreadySolo) {
        active.clear();
        CONDITIONS.forEach(({ key }) => active.add(key));
      } else {
        active.clear();
        active.add(c.key);
      }
      repaint();
      onToggle(active);
    });
    container.appendChild(chip);
  });

  return active;
}
