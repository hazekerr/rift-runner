import './ui/theme.css';
import { PRODUCT } from './config';
import { startLoop } from './core/loop';
import { Input } from './core/input';
import { applyDom, fmtNum, setLang, t, type I18nKey } from './i18n';
import { AudioEngine } from './audio/engine';
import { playSfx } from './audio/bank';
import { Renderer, type ViewState } from './render/renderer';
import { Camera } from './render/camera';
import { Fx } from './render/fx';
import { startRun, step } from './sim/step';
import { chooseLevel, leaveShop, rerollLevel } from './sim/waves';
import { buyOffer, mergeWeapon, rerollShop, sellWeapon, toggleLock } from './sim/shop';
import type { SimEvent } from './sim/events';
import type { SimState } from './sim/state';
import { loadMeta, recordRun, saveMeta, storage, type Settings } from './save/meta';
import { clearRun, loadRun, saveRun } from './save/run';
import { renderSettings } from './ui/settings';
import { Ambient } from './audio/music';
import { isBoss } from './content/enemies';
import { renderOperatorSelect, renderThreat } from './ui/opselect';
import { operatorById } from './content/operators';
import { $ } from './ui/dom';
import { Hud } from './ui/hud';
import { renderEnd, renderEndExtra, renderLevelUp } from './ui/screens';
import { ShopView } from './ui/shop';
import { renderStats } from './ui/statspanel';
import type { StatId } from './content/stats';
import { DevPanel } from './ui/devpanel';

type AppState = 'menu' | 'opselect' | 'play' | 'paused' | 'levelup' | 'shop' | 'over';

const kv = storage();
const meta = loadMeta(kv);
const canvas = $<HTMLCanvasElement>('game');
const renderer = new Renderer(canvas);
const camera = new Camera();
const fx = new Fx();
const audio = new AudioEngine();
const input = new Input();
const events: SimEvent[] = [];
const view: ViewState = { crosshair: false, mouseX: 0, mouseY: 0, hitboxes: false, manual: false, flashes: true };
const ambient = new Ambient();
audio.onReady = (e) => ambient.start(e);

let app: AppState = 'menu';
let sim: SimState | null = null;
let previousBest = meta.best;
let toastTime = 0;
let hitstop = 0;
let hitstopCd = 0;

// ---------- настройки и тексты ----------
/** Применить настройки ко всем системам. */
function applySettings(st: Settings): void {
  setLang(st.lang);
  document.documentElement.lang = st.lang;
  audio.setVolumes(st.music, st.sfx);
  fx.shakeScale = st.shake;
  fx.damageNumbers = st.numbers;
  view.flashes = st.flashes;
  if (renderer.lowQuality !== (st.quality === 'low')) {
    renderer.lowQuality = st.quality === 'low';
    renderer.resize();
  }
  renderer.invalidate();
  refreshTexts();
}

/** Перерисовать все тексты (при смене языка). */
function refreshTexts(): void {
  document.title = t('app.title');
  applyDom();
  $('menubest').textContent = t('menu.best', { n: fmtNum(meta.best) });
  updateContinue();
  if (typeof updateSoundLabel === 'function') updateSoundLabel();
  hud.reset();
  if (sim) hud.update(sim, meta.best);
  if (sim && app === 'shop') shopView.render(sim);
}

function updateContinue(): void {
  const saved = loadRun(kv);
  show('continue', !!saved);
  if (saved) $('continueinfo').textContent = t('menu.continueInfo', { op: t(operatorById(saved.operator).name), n: saved.wave });
}

$('brand-a').textContent = PRODUCT.short.slice(0, -1);
$('brand-b').textContent = PRODUCT.short.slice(-1);
$('title-a').textContent = PRODUCT.titleParts[0];
$('title-b').textContent = PRODUCT.titleParts[1];
audio.muted = meta.muted;
function updateSoundLabel(): void {
  $('sound').textContent = t(audio.muted ? 'hud.sound.off' : 'hud.sound.on');
}
const hud = new Hud();
const pauseOpen = new Set<StatId>();
const withSim = (fn: (s: SimState) => void) => (): void => { if (sim) { fn(sim); drainEvents(); } };
const shopView = new ShopView({
  buy: (i) => withSim((s) => buyOffer(s, i, events))(),
  lock: (i) => withSim((s) => toggleLock(s, i, events))(),
  reroll: withSim((s) => rerollShop(s, events)),
  sell: (uid) => withSim((s) => sellWeapon(s, uid, events))(),
  merge: (uid) => withSim((s) => mergeWeapon(s, uid, events))(),
  go: withSim((s) => leaveShop(s, events)),
});
addEventListener('resize', () => renderer.resize());

const toWorld = (sx: number, sy: number): { x: number; y: number } => ({
  x: sx - renderer.W / 2 + camera.x,
  y: sy - renderer.H / 2 + camera.y,
});

const dev = new DevPanel({
  sim: () => sim,
  events,
  cursorWorld: () => toWorld(input.mouse.x, input.mouse.y),
  flush: () => drainEvents(),
  view,
});

applySettings(meta.settings);

// ---------- переходы ----------
function show(id: string, on: boolean): void {
  $(id).classList.toggle('hidden', !on);
}

let selectedOp = meta.lastOperator;
let selectedThreat = meta.lastThreat;

/** Экран выбора оператора (из меню и после забега). */
function openOperatorSelect(): void {
  audio.init();
  app = 'opselect';
  for (const id of ['menu', 'gameover', 'hud', 'utility', 'touchcontrols']) show(id, false);
  if (!meta.unlocked.includes(selectedOp)) selectedOp = 'operator';
  if (selectedThreat > meta.maxThreat) selectedThreat = meta.maxThreat;
  const rerender = (): void => {
    renderOperatorSelect(meta, selectedOp, (id) => { selectedOp = id; rerender(); });
    renderThreat(meta, selectedThreat, (n) => { selectedThreat = n; rerender(); });
  };
  rerender();
  show('opselect', true);
}

function toMenu(): void {
  app = 'menu';
  sim = null;
  for (const id of ['gameover', 'opselect', 'hud', 'utility', 'touchcontrols', 'upgrades', 'shop', 'pausemenu']) show(id, false);
  updateContinue();
  show('menu', true);
}

function start(): void {
  meta.lastOperator = selectedOp;
  meta.lastThreat = selectedThreat;
  saveMeta(kv, meta);
  clearRun(kv);
  enterRun(startRun((Math.random() * 2 ** 32) >>> 0, events, selectedOp, selectedThreat));
}

/** Продолжить сохранённый забег (с экрана уровня или магазина). */
function resumeRun(): void {
  const saved = loadRun(kv);
  if (!saved) { updateContinue(); return; }
  enterRun(saved);
  events.push({ t: 'toast', key: 'save.resumed', sub: 'save.resumed.sub', params: { n: saved.wave }, duration: 2.2 });
  events.push({ t: 'phase' });
  drainEvents();
}

function enterRun(s: SimState): void {
  audio.init();
  previousBest = meta.best;
  input.reset();
  fx.clear();
  sim = s;
  camera.snap(s.p.x, s.p.y);
  for (const id of ['menu', 'gameover', 'pausemenu', 'upgrades', 'shop', 'opselect']) show(id, false);
  $('touchfire').classList.toggle('hidden', !operatorById(s.operator).rule.manualOnly);
  for (const id of ['hud', 'utility', 'touchcontrols']) show(id, true);
  app = 'play';
  drainEvents();
  hud.update(s, meta.best);
}

function openSettings(): void {
  renderSettings(meta.settings, (next) => {
    meta.settings = next;
    saveMeta(kv, meta);
    applySettings(next);
  });
  show('settings', true);
}

function pause(): void {
  if (app === 'play') {
    app = 'paused';
    input.reset();
    $('knob').style.transform = '';
    show('pausemenu', true);
    if (sim) renderStats($('pausestats'), sim.p, pauseOpen, null);
    $('toast').style.opacity = '0';
  } else if (app === 'paused') {
    app = 'play';
    show('pausemenu', false);
  }
}

function toggleSound(): void {
  audio.setMuted(!audio.muted);
  meta.muted = audio.muted;
  saveMeta(kv, meta);
  updateSoundLabel();
}

/** Синхронизировать экран с фазой сима. */
function syncPhase(): void {
  const s = sim;
  if (!s) return;
  show('upgrades', s.phase === 'levelup');
  show('shop', s.phase === 'shop');
  if (s.phase === 'levelup') {
    saveRun(kv, s);
    app = 'levelup';
    input.mouse.down = false;
    renderLevelUp(s, (i) => { chooseLevel(s, i, events); drainEvents(); }, () => { rerollLevel(s, events); drainEvents(); });
  } else if (s.phase === 'shop') {
    saveRun(kv, s);
    app = 'shop';
    input.mouse.down = false;
    shopView.render(s);
  } else if (s.phase === 'over' || s.phase === 'victory') {
    app = 'over';
    input.mouse.down = false;
    // забеги с dev-панелью не идут в мета-статистику и открытия
    const opened = s.dev ? [] : recordRun(meta, {
      wave: s.wave,
      kills: s.stats.kills, scrap: s.stats.scrapCollected, guardianKills: s.stats.guardianKills,
      won: s.phase === 'victory', score: s.score, threat: s.threat,
    });
    saveMeta(kv, meta);
    clearRun(kv);
    $('menubest').textContent = t('menu.best', { n: fmtNum(meta.best) });
    renderEnd(s, meta.best, previousBest);
    renderEndExtra(s, opened);
    if (opened.length) events.push({ t: 'sfx', id: 'unlock' });
    show('gameover', true);
  } else if (s.phase === 'play' && app !== 'paused') {
    if (app !== 'play') camera.snap(s.p.x, s.p.y);
    app = 'play';
  }
  hud.update(s, meta.best);
}

function notify(a: string, b: string, duration: number): void {
  const el = $('toast');
  (el.firstElementChild as HTMLElement).textContent = a;
  (el.lastElementChild as HTMLElement).textContent = b;
  toastTime = duration;
  el.style.opacity = '1';
}

function drainEvents(): void {
  let phase = false;
  for (const e of events) {
    switch (e.t) {
      case 'sfx': playSfx(audio, e.id, e.v); break;
      case 'toast': {
        // параметры с суффиксом Key — это ключи словаря, переводим их здесь (сим не знает про язык)
        const params: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(e.params)) {
          if (k.endsWith('Key')) params[k.slice(0, -3)] = t(v as I18nKey);
          else params[k] = v;
        }
        notify(t(e.key, params), t(e.sub, params), e.duration);
        break;
      }
      case 'phase': phase = true; break;
      case 'hitstop':
        // Хитстоп только на крупных событиях, глобальный КД 250 мс (скилл game-feel)
        if (hitstopCd <= 0) { hitstop = Math.max(hitstop, e.ms / 1000); hitstopCd = 0.25; }
        break;
      default: fx.consume(e);
    }
  }
  events.length = 0;
  if (phase) syncPhase();
}

function musicIntensity(): number {
  if (!sim || app === 'menu' || app === 'opselect' || app === 'over') return 0.1;
  if (app === 'shop' || app === 'levelup') return 0.2;
  if (sim.enemies.some((e) => isBoss(e.type))) return 1;
  return 0.3 + Math.min(0.6, sim.enemies.length / 200);
}

// ---------- цикл ----------
let simMs = 0;
let renderMs = 0;
let fps = 60;

startLoop({
  shouldTick: () => app === 'play' && sim !== null && hitstop <= 0,
  tick(dt) {
    const s = sim!;
    const t0 = performance.now();
    step(s, input.consume(toWorld, s.p), dt, events);
    camera.tick(s.p.x, s.p.y, dt);
    drainEvents();
    if (app === 'play') hud.update(s, meta.best);
    simMs = simMs * 0.9 + (performance.now() - t0) * 0.1;
  },
  render(alpha, frameDt) {
    const t0 = performance.now();
    input.pollGamepad();
    hitstop = Math.max(0, hitstop - frameDt);
    hitstopCd = Math.max(0, hitstopCd - frameDt);
    if (app !== 'paused' && app !== 'levelup' && app !== 'shop') {
      fx.update(frameDt);
      toastTime -= frameDt;
      if (toastTime <= 0) $('toast').style.opacity = '0';
    }
    $('hurt').style.opacity = view.flashes ? String(fx.flash) : '0';
    ambient.setIntensity(audio, musicIntensity());
    view.crosshair = app === 'play' && !input.touchMode;
    view.mouseX = input.mouse.x;
    view.mouseY = input.mouse.y;
    view.manual = input.mouse.down;
    renderer.draw(sim, alpha, fx, camera, view);
    renderMs = renderMs * 0.9 + (performance.now() - t0) * 0.1;
    if (frameDt > 0) fps = fps * 0.95 + (1 / frameDt) * 0.05;
    dev.setPerf(simMs, renderMs, sim, fps);
  },
});

// ---------- ввод ----------
input.onPadStart = () => {
  if (app === 'menu' || app === 'over') openOperatorSelect();
  else if (app === 'opselect') start();
  else pause();
};
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1'].includes(e.code)) e.preventDefault();
  input.keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'F1') { dev.toggle(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { pause(); return; }
  if (e.code === 'KeyM') { toggleSound(); return; }
  if (app === 'menu' && e.code === 'Enter') { openOperatorSelect(); return; }
  if (app === 'opselect' && e.code === 'Enter') { start(); return; }
  if (app !== 'play') return;
  if (e.code === 'Space') input.press('dash');
  if (e.code === 'KeyQ') input.press('pulse');
});
addEventListener('keyup', (e) => input.keys.delete(e.code));
addEventListener('blur', () => {
  input.reset();
  if (app === 'play') pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && app === 'play') pause();
});

canvas.addEventListener('pointermove', (e) => {
  input.mouse.x = e.clientX;
  input.mouse.y = e.clientY;
});
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  audio.init();
  input.mouse.x = e.clientX;
  input.mouse.y = e.clientY;
  if (app === 'play') {
    input.mouse.down = true;
    canvas.setPointerCapture(e.pointerId);
  }
});
addEventListener('pointerup', () => { input.mouse.down = false; });
addEventListener('pointercancel', () => { input.mouse.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

$('start').addEventListener('click', openOperatorSelect);
$('restart').addEventListener('click', openOperatorSelect);
$('tomenu').addEventListener('click', toMenu);
$('opgo').addEventListener('click', start);
$('opback').addEventListener('click', toMenu);
$('continue').addEventListener('click', resumeRun);
$('menusettings').addEventListener('click', openSettings);
$('pausesettings').addEventListener('click', openSettings);
$('setdone').addEventListener('click', () => show('settings', false));
$('pausequit').addEventListener('click', toMenu);
const touchFire = $('touchfire');
touchFire.addEventListener('pointerdown', (e) => { e.preventDefault(); input.touchFire = true; touchFire.setPointerCapture(e.pointerId); });
touchFire.addEventListener('pointerup', () => { input.touchFire = false; });
touchFire.addEventListener('pointercancel', () => { input.touchFire = false; });
$('resume').addEventListener('click', pause);
$('pause').addEventListener('click', pause);
$('sound').addEventListener('click', toggleSound);
$('touchdash').addEventListener('pointerdown', (e) => { e.preventDefault(); if (app === 'play') input.press('dash'); });
$('touchpulse').addEventListener('pointerdown', (e) => { e.preventDefault(); if (app === 'play') input.press('pulse'); });

let stickPointer: number | null = null;
const stickEl = $('stick');
function stickMove(e: PointerEvent): void {
  const r = stickEl.getBoundingClientRect();
  const x = e.clientX - r.left - r.width / 2;
  const y = e.clientY - r.top - r.height / 2;
  const d = Math.hypot(x, y);
  const max = 42;
  input.stick.x = x / Math.max(max, d);
  input.stick.y = y / Math.max(max, d);
  $('knob').style.transform = `translate(${input.stick.x * max}px,${input.stick.y * max}px)`;
}
function stickEnd(): void {
  stickPointer = null;
  input.stick.x = 0;
  input.stick.y = 0;
  $('knob').style.transform = '';
}
stickEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  stickPointer = e.pointerId;
  stickEl.setPointerCapture(e.pointerId);
  stickMove(e);
});
stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickPointer) stickMove(e); });
stickEl.addEventListener('pointerup', stickEnd);
stickEl.addEventListener('pointercancel', stickEnd);

// Хук для автотестов и dev-инструментов
(window as unknown as { __rr: unknown }).__rr = {
  get sim() { return sim; },
  get app() { return app; },
  get meta() { return meta; },
  start: (op: string) => { selectedOp = op; start(); },
  chooseLevel: (i: number) => { if (sim) { chooseLevel(sim, i, events); drainEvents(); } },
  buy: (i: number) => { if (sim) { buyOffer(sim, i, events); drainEvents(); } },
  leaveShop: () => { if (sim) { leaveShop(sim, events); drainEvents(); } },
};
