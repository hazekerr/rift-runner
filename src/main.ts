import './ui/theme.css';
import { PRODUCT } from './config';
import { startLoop } from './core/loop';
import { Input } from './core/input';
import { applyDom, t } from './i18n';
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
import { loadMeta, saveMeta, storage } from './save/meta';
import { $ } from './ui/dom';
import { Hud } from './ui/hud';
import { renderEnd, renderLevelUp } from './ui/screens';
import { ShopView } from './ui/shop';
import { renderStats } from './ui/statspanel';
import type { StatId } from './content/stats';
import { DevPanel } from './ui/devpanel';

type AppState = 'menu' | 'play' | 'paused' | 'levelup' | 'shop' | 'over';

const kv = storage();
const meta = loadMeta(kv);
const canvas = $<HTMLCanvasElement>('game');
const renderer = new Renderer(canvas);
const camera = new Camera();
const fx = new Fx();
const audio = new AudioEngine();
const input = new Input();
const events: SimEvent[] = [];
const view: ViewState = { crosshair: false, mouseX: 0, mouseY: 0, hitboxes: false, manual: false };

let app: AppState = 'menu';
let sim: SimState | null = null;
let previousBest = meta.best;
let toastTime = 0;
let hitstop = 0;
let hitstopCd = 0;

// ---------- статичные тексты ----------
document.title = t('app.title');
applyDom();
$('brand-a').textContent = PRODUCT.short.slice(0, -1);
$('brand-b').textContent = PRODUCT.short.slice(-1);
$('title-a').textContent = PRODUCT.titleParts[0];
$('title-b').textContent = PRODUCT.titleParts[1];
$('menubest').textContent = t('menu.best', { n: meta.best });
audio.muted = meta.muted;
const updateSoundLabel = (): void => {
  $('sound').textContent = t(audio.muted ? 'hud.sound.off' : 'hud.sound.on');
};
updateSoundLabel();

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

// ---------- переходы ----------
function show(id: string, on: boolean): void {
  $(id).classList.toggle('hidden', !on);
}

function start(): void {
  audio.init();
  previousBest = meta.best;
  input.reset();
  fx.clear();
  events.length = 0;
  sim = startRun((Math.random() * 2 ** 32) >>> 0, events);
  camera.snap(sim.p.x, sim.p.y);
  for (const id of ['menu', 'gameover', 'pausemenu', 'upgrades', 'shop']) show(id, false);
  for (const id of ['hud', 'utility', 'touchcontrols']) show(id, true);
  app = 'play';
  drainEvents();
  hud.update(sim, meta.best);
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
    app = 'levelup';
    input.mouse.down = false;
    renderLevelUp(s, (i) => { chooseLevel(s, i, events); drainEvents(); }, () => { rerollLevel(s, events); drainEvents(); });
  } else if (s.phase === 'shop') {
    app = 'shop';
    input.mouse.down = false;
    shopView.render(s);
  } else if (s.phase === 'over' || s.phase === 'victory') {
    app = 'over';
    input.mouse.down = false;
    if (s.score > meta.best) {
      meta.best = s.score;
      saveMeta(kv, meta);
    }
    $('menubest').textContent = t('menu.best', { n: meta.best });
    renderEnd(s, meta.best, previousBest);
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
      case 'toast': notify(t(e.key, e.params), t(e.sub, e.params), e.duration); break;
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
    $('hurt').style.opacity = String(fx.flash);
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
  if (app === 'menu' || app === 'over') start();
  else pause();
};
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1'].includes(e.code)) e.preventDefault();
  input.keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'F1') { dev.toggle(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { pause(); return; }
  if (e.code === 'KeyM') { toggleSound(); return; }
  if (app === 'menu' && e.code === 'Enter') { start(); return; }
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

$('start').addEventListener('click', start);
$('restart').addEventListener('click', start);
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
  chooseLevel: (i: number) => { if (sim) { chooseLevel(sim, i, events); drainEvents(); } },
  buy: (i: number) => { if (sim) { buyOffer(sim, i, events); drainEvents(); } },
  leaveShop: () => { if (sim) { leaveShop(sim, events); drainEvents(); } },
};
