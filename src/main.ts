import './ui/theme.css';
import { PRODUCT } from './config';
import { startLoop } from './core/loop';
import { Input } from './core/input';
import { applyDom, t } from './i18n';
import { PERKS } from './content/perks';
import { AudioEngine } from './audio/engine';
import { playSfx } from './audio/bank';
import { Renderer } from './render/renderer';
import { Camera } from './render/camera';
import { Fx } from './render/fx';
import { applyPerk, startRun, step } from './sim/step';
import type { SimEvent } from './sim/events';
import type { SimState } from './sim/state';
import { loadMeta, saveMeta, storage } from './save/meta';
import { $, h } from './ui/dom';
import { Hud } from './ui/hud';

type AppState = 'menu' | 'play' | 'paused' | 'upgrade' | 'over';

const kv = storage();
const meta = loadMeta(kv);
const canvas = $<HTMLCanvasElement>('game');
const renderer = new Renderer(canvas);
const camera = new Camera();
const fx = new Fx();
const audio = new AudioEngine();
const input = new Input();
const events: SimEvent[] = [];

let app: AppState = 'menu';
let sim: SimState | null = null;
let previousBest = meta.best;
let toastTime = 0;

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

const hud = new Hud((i) => {
  if (app === 'play') input.selectWeapon(i);
});

addEventListener('resize', () => renderer.resize());

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
  for (const id of ['menu', 'gameover', 'pausemenu', 'upgrades']) show(id, false);
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

function openUpgrades(s: SimState): void {
  app = 'upgrade';
  input.mouse.down = false;
  $('cleared').textContent = t('upg.cleared', { n: String(s.wave).padStart(2, '0') });
  const cards = $('cards');
  cards.replaceChildren();
  for (const id of s.offer) {
    const perk = PERKS.find((x) => x.id === id)!;
    const button = h('button', 'card', h('span', 'symbol', perk.icon), h('b', '', t(perk.name)), h('p', '', t(perk.desc)));
    button.addEventListener('click', () => {
      if (app !== 'upgrade' || !sim) return;
      applyPerk(sim, id, events);
      show('upgrades', false);
      app = 'play';
      drainEvents();
    });
    cards.append(button);
  }
  show('upgrades', true);
}

function gameOver(s: SimState): void {
  app = 'over';
  input.mouse.down = false;
  if (s.score > meta.best) {
    meta.best = s.score;
    saveMeta(kv, meta);
  }
  $('menubest').textContent = t('menu.best', { n: meta.best });
  $('finalscore').textContent = s.score.toLocaleString('ru-RU');
  $('finalwave').textContent = String(s.wave);
  $('finalkills').textContent = String(s.kills);
  $('finaltime').textContent = `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`;
  $('recordmsg').textContent = s.score > previousBest ? t('over.record') : t('over.normal', { n: meta.best.toLocaleString('ru-RU') });
  show('gameover', true);
}

function notify(a: string, b: string, duration: number): void {
  const el = $('toast');
  (el.firstElementChild as HTMLElement).textContent = a;
  (el.lastElementChild as HTMLElement).textContent = b;
  toastTime = duration;
  el.style.opacity = '1';
}

function drainEvents(): void {
  for (const e of events) {
    switch (e.t) {
      case 'sfx': playSfx(audio, e.id, e.v); break;
      case 'toast': notify(t(e.key, e.params), t(e.sub, e.params), e.duration); break;
      case 'gameover': if (sim) gameOver(sim); break;
      case 'upgrade': if (sim) openUpgrades(sim); break;
      default: fx.consume(e);
    }
  }
  events.length = 0;
}

// ---------- цикл ----------
const toWorld = (sx: number, sy: number): { x: number; y: number } => ({
  x: sx - renderer.W / 2 + camera.x,
  y: sy - renderer.H / 2 + camera.y,
});

startLoop({
  shouldTick: () => app === 'play' && sim !== null,
  tick(dt) {
    const s = sim!;
    step(s, input.consume(toWorld), dt, events);
    camera.tick(s.p.x, s.p.y, dt);
    drainEvents();
    if (app === 'play') hud.update(s, meta.best);
  },
  render(alpha, frameDt) {
    if (app !== 'paused' && app !== 'upgrade') {
      fx.update(frameDt);
      toastTime -= frameDt;
      if (toastTime <= 0) $('toast').style.opacity = '0';
    }
    $('hurt').style.opacity = String(fx.flash);
    renderer.draw(sim, alpha, fx, camera, {
      crosshair: app === 'play' && !input.touchMode,
      mouseX: input.mouse.x,
      mouseY: input.mouse.y,
    });
  },
});

// ---------- ввод ----------
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  input.keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { pause(); return; }
  if (e.code === 'KeyM') { toggleSound(); return; }
  if (app === 'menu' && e.code === 'Enter') { start(); return; }
  if (app !== 'play') return;
  if (e.code === 'Space') input.press('dash');
  if (e.code === 'KeyQ') input.press('pulse');
  if (e.code === 'KeyR') input.press('reload');
  if (e.code === 'Digit1') input.selectWeapon(0);
  if (e.code === 'Digit2') input.selectWeapon(1);
  if (e.code === 'Digit3') input.selectWeapon(2);
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
canvas.addEventListener('wheel', (e) => {
  if (app === 'play') {
    e.preventDefault();
    input.cycleWeapon(e.deltaY > 0 ? 1 : -1);
  }
}, { passive: false });

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

// Хук для автотестов и dev-инструментов (только чтение)
(window as unknown as { __rr: unknown }).__rr = { get sim() { return sim; }, get app() { return app; } };
