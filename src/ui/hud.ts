import { GUNS } from '../content/weapons';
import { t } from '../i18n';
import { remainingTargets } from '../sim/step';
import type { SimState } from '../sim/state';
import { $, DirtyStyle, DirtyText, h } from './dom';

/** HUD прототипа. Пишет в DOM только изменившиеся значения. */
export class Hud {
  private hpText = new DirtyText($('hptext'));
  private hpBar = new DirtyStyle($('hpbar'), 'width');
  private hpColor = new DirtyStyle($('hpbar'), 'background');
  private score = new DirtyText($('score'));
  private best = new DirtyText($('best'));
  private wave = new DirtyText($('wave'));
  private remaining = new DirtyText($('remaining'));
  private dash = new DirtyStyle($('dashbar'), 'width');
  private pulse = new DirtyStyle($('pulsebar'), 'width');
  private bossFill = new DirtyStyle($('bossfill'), 'width');
  private ammoMain = h('span');
  private ammoSmall = h('small');
  private ammoMainT = new DirtyText(this.ammoMain);
  private ammoSmallT = new DirtyText(this.ammoSmall);
  private buttons: HTMLButtonElement[] = [];
  private lastGun = -1;
  private lastBoss: boolean | null = null;

  constructor(onWeapon: (i: number) => void) {
    const ammo = $('ammo');
    ammo.replaceChildren(this.ammoMain, ' ', this.ammoSmall);
    const wrap = $('weapons');
    GUNS.forEach((g, i) => {
      const b = h('button', 'weapon', h('b', '', `${i + 1} · ${t(g.name)}`), h('small', '', t(g.kind)));
      b.dataset.weapon = String(i);
      b.addEventListener('click', () => onWeapon(i));
      wrap.append(b);
      this.buttons.push(b);
    });
  }

  update(s: SimState, best: number): void {
    const p = s.p;
    this.hpText.set(`${Math.ceil(p.hp)} / ${p.maxHp}`);
    this.hpBar.set(`${(p.hp / p.maxHp) * 100}%`);
    this.hpColor.set(p.hp < 30 ? '#ff6d65' : '#62ecd2');
    this.score.set(String(s.score).padStart(6, '0'));
    this.best.set(t('hud.best', { n: Math.max(best, s.score) }));
    this.wave.set(t('hud.wave', { n: String(s.wave).padStart(2, '0') }));
    this.remaining.set(t('hud.remaining', { n: remainingTargets(s) }));
    this.dash.set(`${(1 - p.dashCd / p.dashMax) * 100}%`);
    this.pulse.set(`${p.energy}%`);
    const g = GUNS[p.gun]!;
    if (p.reload > 0) {
      this.ammoMainT.set(t('hud.reloading'));
      this.ammoSmallT.set(t('hud.seconds', { n: Math.ceil(p.reload * 10) / 10 }));
    } else {
      this.ammoMainT.set(String(p.ammo[p.gun]));
      this.ammoSmallT.set(`/ ${g.mag + p.magBonus}`);
    }
    if (p.gun !== this.lastGun) {
      this.lastGun = p.gun;
      this.buttons.forEach((b, i) => b.classList.toggle('active', i === p.gun));
    }
    const boss = s.enemies.find((e) => e.type === 'boss');
    if (!!boss !== this.lastBoss) {
      this.lastBoss = !!boss;
      $('bossbar').classList.toggle('hidden', !boss);
    }
    if (boss) this.bossFill.set(`${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`);
  }
}
