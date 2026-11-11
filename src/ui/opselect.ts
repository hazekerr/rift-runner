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
      card.addEventListener('click', () => onSelect(op.id));
    } else {
      const [cur, need] = unlockProgress(op, meta.life);
      const bar = h('div', 'bar', h('i'));
      (bar.firstElementChild as HTMLElement).style.width = `${(cur / need) * 100}%`;
      card.append(h('div', 'lockline', `${t('ops.locked')} · ${t(`unlock.${op.unlock.kind}` as I18nKey, { n: 'n' in op.unlock ? op.unlock.n : 0 })}`), bar, h('div', 'start', t('unlock.progress', { n: cur, m: need })));
    }
    root.append(card);
  }
}
