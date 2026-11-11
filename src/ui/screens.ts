import { MAX_WEAPONS, weaponById, WEAPONS } from '../content/weapons';
import { RARITY_COLOR, RARITY_PIPS } from '../content/levelups';
import { STATS } from '../content/stats';
import { ENEMIES } from '../content/enemies';
import { rerollCost, TIER_MULT } from '../content/balance';
import { t, type I18nKey } from '../i18n';
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
    const sym = h('span', 'symbol', meta.glyph);
    sym.style.color = color;
    const card = h('button', 'card', rar, sym, h('b', '', t(meta.name)), h('span', 'val', fmtStat(o.stat, o.value)));
    card.style.borderColor = o.rarity ? color : '';
    card.addEventListener('click', () => onPick(i));
    cards.append(card);
  });
  const cost = rerollCost(s.wave, s.levelRerolls);
  const rr = $<HTMLButtonElement>('reroll');
  rr.textContent = t('lvl.reroll', { n: cost });
  rr.disabled = s.scrap < cost;
  rr.onclick = onReroll;
}

/** Временный экран снабжения: выбор оружия (до магазина этапа 3). */
export function renderSupply(s: SimState, onPick: (id: string | null) => void): void {
  $('supplyinfo').textContent = t('sup.eyebrow', { n: s.p.weapons.length, m: MAX_WEAPONS });
  const cards = $('supplycards');
  cards.replaceChildren();
  for (const id of s.supplyOffer) {
    const def = weaponById(id);
    const dps = Math.round(((def.damage * TIER_MULT[0]! * (def.pellets ?? 1)) / def.cooldown) * (def.kind === 'chain' ? 1 : 1));
    const sym = h('span', 'symbol', '▮');
    sym.style.color = def.color;
    const tags = h('div', 'tags', ...def.tags.map((tag) => h('span', '', t(`tag.${tag}` as I18nKey))));
    const card = h('button', 'card', sym, h('b', '', t(def.name)), h('p', '', t(def.desc)), h('p', '', t('sup.dps', { n: dps })), tags);
    card.addEventListener('click', () => onPick(id));
    cards.append(card);
  }
  $('supplyskip').onclick = () => onPick(null);
}

/** Поражение или победа со статистикой забега. */
export function renderEnd(s: SimState, best: number, previousBest: number): void {
  const win = s.phase === 'victory';
  $('overeyebrow').textContent = t(win ? 'win.eyebrow' : 'over.eyebrow');
  $('overtitle').textContent = t(win ? 'win.title' : 'over.title');
  $('recordmsg').textContent = s.score > previousBest ? t('over.record') : win ? t('win.text') : t('over.normal', { n: best.toLocaleString('ru-RU') });
  $('finalscore').textContent = s.score.toLocaleString('ru-RU');
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
  if (top && def) lines.push(t('over.topWeapon', { n: t(def.name), m: Math.round(top[1]).toLocaleString('ru-RU') }));
  $('overdetail').textContent = lines.join('\n');
}
