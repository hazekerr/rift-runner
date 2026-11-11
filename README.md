# RIFT RUNNER (RR)

Браузерный arena survivor-roguelite в сеттинге разлома. Vite + TypeScript, Canvas 2D, без движка.

**Статус:** этап 1, паритет с прототипом `legacy/RR.html` на новой архитектуре. План в `docs/PLAN.md`.

## Запуск

```bash
npm install
```

```bash
npm run dev        # http://localhost:5173
```

```bash
npm test           # vitest
```

```bash
npm run build      # typecheck + сборка в dist/
```

## Структура

```
src/
  config.ts      имя продукта и версия (единственное место)
  core/          цикл 60 Гц + интерполяция, RNG (sfc32), ввод → действия, пул, spatial hash
  sim/           детерминированная логика: state (plain JSON), step, коллизии, поле потоков, события
  content/       данные: оружие, враги, перки, арена, палитра
  render/        Canvas 2D (DPR), камера, эффекты на пулах
  audio/         WebAudio: engine (синтез) + bank (SfxId → патч, подменяется сэмплами)
  ui/            DOM-оверлеи и HUD (dirty-check), theme.css
  i18n/          словари, t(key, params); строк в коде нет
  save/          meta-сохранение с версией и миграцией
tests/           vitest: коллизии, RNG, spatial hash, поле потоков, детерминизм сима, сохранения
legacy/RR.html   исходный прототип (не трогаем)
docs/            исследование, аудит прототипа, план, скриншоты
```

**Поток данных:** `Input` → `TickInput` → `step(state)` → `SimEvent[]` → (`Fx`, `playSfx`, UI). Сим не знает про DOM, Canvas и звук.

## Как добавить оружие или модуль

Описание появится на этапах 2–3, когда будут оружейная система и магазин. Пока оружие прототипа задаётся в `src/content/weapons.ts`, тексты — ключами в `src/i18n/ru.ts`.
