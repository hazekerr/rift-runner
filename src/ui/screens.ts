import { iconImg, statIconUrl } from './icons';
import { statDesc } from './explain';
import { WEAPONS } from '../content/weapons';
import { operatorById } from '../content/operators';
import { moduleById } from '../content/modules';
import { RARITY_COLOR, RARITY_PIPS } from '../content/levelups';
import { STATS } from '../content/stats';
import { ENEMIES } from '../content/enemies';
import { rerollCost } from '../content/balance';
import { fmtNum, t, type I18nKey } from '../i18n';
import type { SimState } from '../sim/state';
import { $, h } from './dom';

const fmtStat = (stat: keyof typeof STATS, v: number): string => `+${v}${STATS[stat].unit}`;

/** Экран выбора улучшения (1 из 4). */
export function renderLevelUp(s: SimState, onPick: (i: number) => void, onReroll: () => void): void {
  $('cleared').textContent = t('lvl.eyebrow', { w: String(s.wave).padStart(2, '0'), l: s.level });
  $('lvltextinfo').textContent = t('lvl.text', { n: s.pendingLevels });
  const cards = $('cards');
  cards.replaceChildren();
  s.levelOffer.forEach((o, i) => {
    const meta = STATS[o.stat];
    const color = RARITY_COLOR[o.rarity]!;
    const rar = h('div', 'rar', h('span', '', t(`rarity.${o.rarity}` as I18nKey)), h('span', '', RARITY_PIPS[o.rarity]!));
    rar.style.color = color;
    const icon = iconImg(statIconUrl(o.stat), 44, 'card-icon');
    const card = h('button', 'card', rar, icon, h('b', '', t(meta.name)), h('span', 'val', fmtStat(o.stat, o.value)), h('p', 'card-desc', statDesc(o.stat)));
    card.title = statDesc(o.stat);
    card.style.borderColor = o.rarity ? color : '';
    card.addEventListener('click', () => onPick(i));
    cards.append(card);
  });
  const cost = rerollCost(s.wave, s.levelRerolls);
  $('lvlscrap').textContent = fmtNum(s.scrap);
  const rr = $<HTMLButtonElement>('reroll');
  rr.textContent = t('lvl.reroll', { n: cost });
  rr.disabled = s.scrap < cost;
  rr.onclick = onReroll;
}

/** Поражение или победа со статистикой забега. */
export function renderEnd(s: SimState, best: number, previousBest: number): void {
  const win = s.phase === 'victory';
  $('overeyebrow').textContent = t(win ? 'win.eyebrow' : 'over.eyebrow');
  $('overtitle').textContent = t(win ? 'win.title' : 'over.title');
  $('recordmsg').textContent = s.score > previousBest ? t('over.record') : win ? t('win.text') : t('over.normal', { n: fmtNum(best) });
  $('finalscore').textContent = fmtNum(s.score);
  $('finalwave').textContent = String(s.wave);
  $('finalkills').textContent = String(s.stats.kills);
  $('finaltime').textContent = `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`;
  const lines: string[] = [];
  if (!win && s.stats.killedBy) {
    const by = s.stats.killedBy === 'mine' ? t('killed.mine') : t(ENEMIES[s.stats.killedBy].name);
    lines.push(t('over.killedBy', { n: by }));
  }
  const top = Object.entries(s.stats.damageByWeapon).sort((a, b) => b[1] - a[1])[0];
  const def = top && WEAPONS.find((w) => w.id === top[0]);
  if (top && def) lines.push(t('over.topWeapon', { n: t(def.name), m: fmtNum(Math.round(top[1])) }));
  $('overdetail').textContent = lines.join('\n');
}

/** Итоговая статистика забега: оператор, уровень, скрап, урон, разбивка урона по источникам, открытия. */
export function renderEndExtra(s: SimState, opened: string[]): void {
  const root = $('endextra');
  root.replaceChildren();
  const op = operatorById(s.operator);
  const cell = (v: string, k: I18nKey): HTMLElement => h('div', '', h('strong', '', v), h('small', '', t(k)));
  root.append(h('div', 'grid',
    cell(t(op.name), 'end.operator'), cell(String(s.level), 'end.level'),
    cell(String(s.stats.scrapCollected), 'end.scrap'), cell(String(Math.round(s.stats.damageTaken)), 'end.taken')));
  root.append(h('div', 'term-label', t('end.weapons')));
  const entries = Object.entries(s.stats.damageByWeapon).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = entries[0]?.[1] ?? 1;
  for (const [id, v] of entries) {
    const w = WEAPONS.find((x) => x.id === id);
    let name = id;
    let color = '#9fb2b6';
    if (w) { name = t(w.name); color = w.color; }
    else if (id === 'ability.pulse') name = t('end.src.ability');
    else if (id.startsWith('m.')) {
      try { name = t(moduleById(id.slice(2)).name); } catch { name = t('end.src.effect'); }
      color = '#d8c8ff';
    }
    const bar = h('div', 'bar', h('i'));
    const fill = bar.firstElementChild as HTMLElement;
    fill.style.width = `${(v / max) * 100}%`;
    fill.style.background = color;
    root.append(h('div', 'row', h('span', '', name), bar, h('span', '', fmtNum(Math.round(v)))));
  }
  for (const id of opened) root.append(h('div', 'unlock', `★ ${t('unlock.new', { n: t(operatorById(id).name) })}`));
}
