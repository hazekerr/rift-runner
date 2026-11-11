import { iconImg, weaponIconUrl } from './icons';
import { RUN_WAVES, xpToNext } from '../content/balance';
import { MAX_WEAPONS, weaponById } from '../content/weapons';
import { RARITY_PIPS } from '../content/levelups';
import { t } from '../i18n';
import { isBoss } from '../content/enemies';
import { maxHpOf, type SimState } from '../sim/state';
import { $, DirtyStyle, DirtyText, h } from './dom';

/** HUD. Пишет в DOM только изменившиеся значения. */
export class Hud {
  private hpText = new DirtyText($('hptext'));
  private hpBar = new DirtyStyle($('hpbar'), 'width');
  private hpColor = new DirtyStyle($('hpbar'), 'background');
  private lvl = new DirtyText($('lvltext'));
  private xpText = new DirtyText($('xptext'));
  private xpBar = new DirtyStyle($('xpbar'), 'width');
  private score = new DirtyText($('score'));
  private best = new DirtyText($('best'));
  private wave = new DirtyText($('wave'));
  private timer = new DirtyText($('timer'));
  private scrap = new DirtyText($('scrap'));
  private bonus = new DirtyText($('bonus'));
  private dash = new DirtyStyle($('dashbar'), 'width');
  private pulse = new DirtyStyle($('pulsebar'), 'width');
  private bossFill = new DirtyStyle($('bossfill'), 'width');
  private bossName = new DirtyText($('bossname'));
  private charges = new DirtyText($('dashcharges'));
  private weaponsKey = '';
  private timerClass = '';
  private lastBoss: boolean | null = null;

  /** Сбросить кеши (смена языка): следующий update перерисует всё. */
  reset(): void {
    this.weaponsKey = '';
    this.lastBoss = null;
  }

  update(s: SimState, best: number): void {
    const p = s.p;
    const max = maxHpOf(p);
    this.hpText.set(`${Math.ceil(p.hp)} / ${max}`);
    this.hpBar.set(`${(p.hp / max) * 100}%`);
    this.hpColor.set(p.hp < max * 0.3 ? '#ff6d65' : '#62ecd2');
    const need = xpToNext(s.level);
    this.lvl.set(t('hud.level', { n: s.level }));
    this.xpText.set(`${s.xp} / ${need}`);
    this.xpBar.set(`${Math.min(100, (s.xp / need) * 100)}%`);
    this.score.set(String(s.score).padStart(6, '0'));
    this.best.set(t('hud.best', { n: Math.max(best, s.score) }));
    this.wave.set(`${t('hud.wave', { n: String(s.wave).padStart(2, '0') })} / ${RUN_WAVES}${s.threat ? ` · ${t('hud.threat', { n: s.threat })}` : ''}`);
    const left = Math.max(0, Math.ceil(s.waveLeft));
    this.timer.set(s.overtime ? t('hud.overtime') : t('hud.timer', { n: left }));
    const cls = s.overtime ? 'ot' : left <= 5 ? 'low' : '';
    if (cls !== this.timerClass) {
      this.timerClass = cls;
      $('timer').className = cls;
    }
    this.scrap.set(String(s.scrap));
    this.bonus.set(s.bonusPool > 0 ? t('hud.bonus', { n: s.bonusPool }) : '');
    this.dash.set(`${p.dashCharges >= p.dashMaxCharges ? 100 : (1 - p.dashCd / p.dashMax) * 100}%`);
    this.charges.set(p.dashMaxCharges > 1 ? ` ${t('hud.dashCharges', { n: p.dashCharges })}` : '');
    this.pulse.set(`${p.energy}%`);

    const key = p.weapons.map((w) => `${w.id}:${w.tier}`).join(',');
    if (key !== this.weaponsKey) {
      this.weaponsKey = key;
      const wrap = $('weapons');
      wrap.replaceChildren();
      for (let i = 0; i < MAX_WEAPONS; i++) {
        const w = p.weapons[i];
        if (w) {
          const def = weaponById(w.id);
          const b = h('div', 'weapon active', iconImg(weaponIconUrl(w.id, w.tier), 26, 'hud-wicon'), h('div', '', h('b', '', t(def.name)), h('small', 'pips', RARITY_PIPS[w.tier - 1]!)));
          b.style.borderColor = def.color;
          b.style.boxShadow = `inset 0 -2px ${def.color}`;
          wrap.append(b);
        } else wrap.append(h('div', 'weapon', h('b', '', '—'), h('small', '', ' ')));
      }
    }

    const boss = s.enemies.find((e) => isBoss(e.type));
    if (!!boss !== this.lastBoss) {
      this.lastBoss = !!boss;
      $('bossbar').classList.toggle('hidden', !boss);
    }
    if (boss) {
      this.bossName.set(t(boss.type === 'heart' ? 'hud.bossFinal' : 'hud.boss'));
      this.bossFill.set(`${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`);
    }
  }
}
