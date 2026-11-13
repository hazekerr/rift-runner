import { WEAPONS, MAX_WEAPONS } from '../content/weapons';
import { ENEMIES, type EnemyType } from '../content/enemies';
import { MAX_ALIVE, RUN_WAVES } from '../content/balance';
import { t, type I18nKey } from '../i18n';
import { spawnEnemyNow } from '../sim/combat';
import type { EventSink } from '../sim/events';
import { endWave, gainScrap, startWave } from '../sim/waves';
import { xpToNext } from '../content/balance';
import { refreshStats, type SimState } from '../sim/state';
import { $, h } from './dom';

export interface DevHooks {
  sim(): SimState | null;
  events: EventSink;
  cursorWorld(): { x: number; y: number };
  flush(): void;
  /** Флаги отображения. */
  view: { hitboxes: boolean };
}

/** Dev-панель (F1): спавн, скрап, оружие, переход к волне, god mode, хитбоксы, перф. */
export class DevPanel {
  readonly el = $('devpanel');
  private perf = h('div', 'perf');
  visible = false;
  /** Стресс-режим: держать 300 врагов и 1000 снарядов (600 наших с обычным пробитием, 400 вражеских). */
  stress = false;

  constructor(private readonly hooks: DevHooks) {
    const btn = (label: string, fn: () => void): HTMLButtonElement => {
      const b = h('button', '', label);
      b.addEventListener('click', () => { const s = hooks.sim(); if (s) s.dev = true; fn(); hooks.flush(); });
      return b;
    };
    const withSim = (fn: (s: SimState) => void) => () => { const s = hooks.sim(); if (s) fn(s); };
    const weaponSel = h('select');
    for (const w of WEAPONS) weaponSel.append(new Option(t(w.name), w.id));
    const enemySel = h('select');
    for (const k of Object.keys(ENEMIES) as EnemyType[]) enemySel.append(new Option(t(ENEMIES[k].name), k));
    const eliteChk = h('input');
    eliteChk.type = 'checkbox';
    const waveInput = h('input');
    waveInput.type = 'number';
    waveInput.min = '1';
    waveInput.max = String(RUN_WAVES + 10);
    waveInput.value = '10';
    waveInput.style.width = '56px';
    const godChk = h('input');
    godChk.type = 'checkbox';
    godChk.addEventListener('change', withSim((s) => { s.god = godChk.checked; s.dev = true; }));
    const hbChk = h('input');
    hbChk.type = 'checkbox';
    hbChk.addEventListener('change', () => { hooks.view.hitboxes = hbChk.checked; });

    this.el.append(
      h('b', '', t('dev.title' as I18nKey)),
      h('div', 'row', btn(t('dev.scrap'), withSim((s) => gainScrap(s, 100, hooks.events, false))),
        btn(t('dev.level'), withSim((s) => gainScrap(s, xpToNext(s.level) - s.xp, hooks.events, false)))),
      btn(t('dev.endWave'), withSim((s) => { if (s.phase === 'play') { s.waveLeft = 0; endWave(s, hooks.events); } })),
      h('div', 'row', waveInput, btn(t('dev.wave'), withSim((s) => {
        const w = Math.max(1, Number(waveInput.value) | 0);
        s.enemies.length = 0; s.spawns.length = 0; s.bullets.length = 0; s.mines.length = 0;
        s.wave = w - 1;
        startWave(s, hooks.events);
        hooks.events.push({ t: 'phase' });
      }))),
      h('div', 'row', weaponSel, btn(t('dev.weapon'), withSim((s) => {
        if (s.p.weapons.length < MAX_WEAPONS) s.p.weapons.push({ uid: s.nextId++, id: weaponSel.value, tier: 1, cd: 0.2, aim: 0, flash: 0, x: s.p.x, y: s.p.y });
        refreshStats(s.p);
      }))),
      h('div', 'row', enemySel, h('label', '', eliteChk, t('dev.elite'))),
      btn(t('dev.spawn'), withSim((s) => {
        const c = hooks.cursorWorld();
        spawnEnemyNow(s, enemySel.value as EnemyType, c.x, c.y, eliteChk.checked ? 'shield' : null);
      })),
      btn(t('dev.stress'), withSim((s) => {
        this.stress = !this.stress;
        if (!this.stress) return;
        s.god = true;
        s.waveLeft = 1e9;
        s.spawnAcc = -1e9;
        s.burstsDone = 99;
      })),
      h('label', 'row', godChk, t('dev.god')),
      h('label', 'row', hbChk, t('dev.hitbox')),
      this.perf,
    );
  }

  /** Долить стресс-сцену до целевых чисел (вызывается каждый тик). */
  topUpStress(s: SimState): void {
    if (!this.stress) return;
    for (let i = s.enemies.length; i < MAX_ALIVE; i++) {
      const e = spawnEnemyNow(s, i % 4 ? 'drone' : 'gunner', 60 + (i * 37) % 1780, 60 + ((i * 53) % 1130), null);
      e.hp = e.maxHp = 1e9;
    }
    let own = 0;
    for (const b of s.bullets) if (b.friendly) own++;
    const foe = s.bullets.length - own;
    const add = (friendly: boolean, n: number): void => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const x = friendly ? s.p.x : 60 + Math.random() * 1780;
        const y = friendly ? s.p.y : 60 + Math.random() * 1130;
        s.bullets.push({ x, y, px: x, py: y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 2, damage: 1, crit: false, color: friendly ? '#75f5df' : '#d79aff', friendly, r: friendly ? 3 : 6, pierce: 1, hit: [], weapon: 'dev', source: 'gunner', explodeR: 0, burnChance: 0, slowPct: 0 });
      }
    };
    add(true, Math.max(0, 600 - own));
    add(false, Math.max(0, 400 - foe));
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
  }

  setPerf(simMs: number, renderMs: number, s: SimState | null, fps: number): void {
    if (!this.visible) return;
    this.perf.textContent = `${fps.toFixed(0)} FPS\n${t('dev.perf', {
      s: simMs.toFixed(2), r: renderMs.toFixed(2), e: s?.enemies.length ?? 0, b: s?.bullets.length ?? 0,
    })}`;
  }
}
