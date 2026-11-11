import { OPERATORS } from '../content/operators';
import { weaponById } from '../content/weapons';
import { t, type I18nKey } from '../i18n';
import { unlockProgress, type Meta } from '../save/meta';
import { $, h } from './dom';

/** Экран выбора оператора: карточки с правилами, заблокированные показывают условие и прогресс. */
export function renderOperatorSelect(meta: Meta, selected: string, onSelect: (id: string) => void): void {
  const root = $('oplist');
  root.replaceChildren();
  for (const op of OPERATORS) {
    const open = meta.unlocked.includes(op.id);
    const card = h('div', `op${open ? '' : ' locked'}${op.id === selected ? ' sel' : ''}`);
    card.style.setProperty('--opc', op.color);
    card.append(h('span', 'glyph', open ? op.glyph : '⊘'), h('b', '', t(op.name)), h('span', 'role', t(op.role)));
    if (open) {
      card.append(h('ul', '', ...op.rules.map((r) => h('li', '', t(r)))));
      card.append(h('div', 'start', t('ops.weapon', { n: op.startWeapons.map((w) => t(weaponById(w).name)).join(', ') })));
      card.tabIndex = 0;
      card.dataset.nav = '1';
      card.addEventListener('click', () => onSelect(op.id));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(op.id); });
    } else {
      const [cur, need] = unlockProgress(op, meta.life);
      const bar = h('div', 'bar', h('i'));
      (bar.firstElementChild as HTMLElement).style.width = `${(cur / need) * 100}%`;
      card.append(h('div', 'lockline', `${t('ops.locked')} · ${t(`unlock.${op.unlock.kind}` as I18nKey, { n: 'n' in op.unlock ? op.unlock.n : 0 })}`), bar, h('div', 'start', t('unlock.progress', { n: cur, m: need })));
    }
    root.append(card);
  }
}

/** Выбор уровня Угрозы (виден после первой победы). */
export function renderThreat(meta: Meta, selected: number, onSelect: (n: number) => void): void {
  const root = $('threatbox');
  root.replaceChildren();
  if (meta.maxThreat <= 0) {
    root.append(h('div', 'desc', t('threat.locked')));
    return;
  }
  const seg = h('div', 'seg');
  for (let i = 0; i <= meta.maxThreat; i++) {
    const b = h('button', i === selected ? 'on' : '', ['0', 'I', 'II', 'III', 'IV'][i]!);
    b.setAttribute('aria-pressed', String(i === selected));
    b.addEventListener('click', () => onSelect(i));
    seg.append(b);
  }
  const lines = [h('b', '', `${t('threat.label')} ${['0', 'I', 'II', 'III', 'IV'][selected]} · ${t('threat.score', { n: 1 + 0.25 * selected })}`)];
  for (let i = 1; i <= selected; i++) lines.push(h('div', '', `+ ${t(`threat.${i}` as I18nKey)}`));
  if (selected === 0) lines.push(h('div', '', t('threat.0')));
  root.append(h('div', '', t('threat.label')), seg, h('div', 'desc', ...lines, h('div', 'muted', t('threat.inherit'))));
}
