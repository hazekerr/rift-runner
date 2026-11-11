import { iconImg, statIconUrl } from './icons';
import { statDesc } from './explain';
import { STATS, STAT_IDS, type StatId } from '../content/stats';
import { moduleById } from '../content/modules';
import { t } from '../i18n';
import { armorMult, atkSpeedEff, breakdown, dodgeChance, type Modifier, type Stats } from '../sim/stats';
import type { Player } from '../sim/state';
import { h } from './dom';

const round = (v: number): number => Math.round(v * 10) / 10;

export function fmtStatValue(stat: StatId, v: number): string {
  const unit = STATS[stat].unit;
  return `${round(v)}${unit}`;
}

function note(stat: StatId, v: number): string {
  if (stat === 'armor' && v !== 0) return t('stats.armorNote', { n: Math.round((1 - armorMult(v)) * 100) });
  if (stat === 'dodge' && dodgeChance(v) !== v) return t('stats.dodgeNote', { n: round(dodgeChance(v)) });
  if (stat === 'atkSpeed' && atkSpeedEff(v) !== v) return t('stats.atkNote', { n: round(atkSpeedEff(v)) });
  return '';
}

function sourceName(src: Modifier['source'], p: Player): string {
  switch (src.kind) {
    case 'base': return t('src.base');
    case 'level': return t('src.level', { n: src.id });
    case 'module': {
      const cnt = p.modules.find((m) => m.id === src.id)?.count ?? 1;
      return `${t('src.module', { n: t(moduleById(src.id).name) })}${cnt > 1 ? ` ×${cnt}` : ''}`;
    }
    case 'operator': return t('src.operator');
    case 'dev': return t('src.dev');
    default: return t('src.weapon', { n: src.id });
  }
}

/**
 * Список статов с раскрываемой расшифровкой. preview — статы «если купить» для дельт.
 * Дельта показывается стрелкой ▲/▼ и знаком, не только цветом.
 */
export function renderStats(root: HTMLElement, p: Player, open: Set<StatId>, preview: Stats | null): void {
  root.replaceChildren();
  for (const id of STAT_IDS) {
    const meta = STATS[id];
    const v = p.stats[id];
    const row = h('button', 'stat-row');
    const val = h('span', 'stat-val', fmtStatValue(id, v));
    const extra = h('span', 'stat-note', note(id, v));
    row.append(iconImg(statIconUrl(id), 16, 'stat-icon'), h('span', 'stat-name', t(meta.name)), extra, val);
    row.title = statDesc(id);
    if (preview) {
      const d = round(preview[id] - v);
      if (d !== 0) {
        const delta = h('span', d > 0 ? 'delta up' : 'delta down', `${d > 0 ? '▲ +' : '▼ '}${d}${meta.unit}`);
        row.append(delta);
        row.classList.add('changed');
      }
    }
    if (v !== meta.base) row.classList.add('mod');
    row.addEventListener('click', () => {
      if (open.has(id)) open.delete(id);
      else open.add(id);
      renderStats(root, p, open, preview);
    });
    root.append(row);
    if (open.has(id)) {
      const box = h('div', 'stat-breakdown');
      box.append(h('p', 'stat-desc', statDesc(id)));
      for (const line of breakdown(p.mods, id)) {
        const parts: string[] = [];
        if (line.flat) parts.push(`${line.flat > 0 && line.source.kind !== 'base' ? '+' : ''}${round(line.flat)}`);
        if (line.pct) parts.push(`${line.pct > 0 ? '+' : ''}${round(line.pct)}%`);
        box.append(h('div', '', h('span', '', sourceName(line.source, p)), h('b', '', parts.join(' ') || '0')));
      }
      root.append(box);
    }
  }
}
