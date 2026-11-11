import type { NavCmd } from '../core/input';

/**
 * Пространственная навигация по меню для геймпада: фокус переходит к ближайшему элементу
 * в нужном направлении, A нажимает, ползунки двигаются влево/вправо.
 */
const SELECTOR = 'button:not(:disabled), input[type=range], [data-nav]';

function activeLayer(): HTMLElement | null {
  const open = [...document.querySelectorAll<HTMLElement>('.overlay:not(.hidden)')];
  if (!open.length) return null;
  // самый верхний по z-index (настройки поверх паузы/меню)
  return open.sort((a, b) => Number(getComputedStyle(b).zIndex || 0) - Number(getComputedStyle(a).zIndex || 0))[0]!;
}

function candidates(layer: HTMLElement): HTMLElement[] {
  return [...layer.querySelectorAll<HTMLElement>(SELECTOR)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
}

const center = (el: Element): { x: number; y: number } => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export function padNavigate(cmd: NavCmd, onBack: () => void): void {
  const layer = activeLayer();
  if (!layer) return;
  const list = candidates(layer);
  if (!list.length) return;
  const cur = document.activeElement instanceof HTMLElement && list.includes(document.activeElement) ? document.activeElement : null;
  if (cmd === 'back') { onBack(); return; }
  if (!cur) {
    (list.find((el) => el.classList.contains('primary')) ?? list[0]!).focus();
    return;
  }
  if (cmd === 'ok') {
    cur.click();
    return;
  }
  if (cur instanceof HTMLInputElement && cur.type === 'range' && (cmd === 'left' || cmd === 'right')) {
    const step = Number(cur.step || 1) * (cmd === 'left' ? -1 : 1);
    cur.value = String(Math.min(Number(cur.max), Math.max(Number(cur.min), Number(cur.value) + step)));
    cur.dispatchEvent(new Event('input'));
    cur.dispatchEvent(new Event('change'));
    return;
  }
  const from = center(cur);
  const dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[cmd as 'up'];
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const c = center(el);
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    const along = dx * dir[0]! + dy * dir[1]!;
    if (along <= 4) continue;
    const across = Math.abs(dx * dir[1]! - dy * dir[0]!);
    const score = along + across * 2.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  best?.focus();
  best?.scrollIntoView({ block: 'nearest' });
}
