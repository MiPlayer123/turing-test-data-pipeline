const el = document.getElementById('tooltip');

export function show(html, event) {
  el.innerHTML = html;
  el.style.opacity = '1';
  move(event);
}

export function move(event) {
  const x = event.clientX + 14;
  const y = event.clientY - 14;
  const maxX = window.innerWidth - el.offsetWidth - 20;
  const maxY = window.innerHeight - el.offsetHeight - 20;
  el.style.left = Math.min(x, maxX) + 'px';
  el.style.top = Math.min(y, maxY) + 'px';
}

export function hide() {
  el.style.opacity = '0';
}
