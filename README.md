# RIFT RUNNER (RR)

Браузерный arena survivor-roguelite в сеттинге разлома. Vite + TypeScript, Canvas 2D, без движка.

**Статус:** этап 2 — таймерные волны, скрап, магнит, уровни, автоматическое мультиоружие, 9 типов врагов и элиты. План в `docs/PLAN.md`, правила в `DESIGN.md`.

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
  sim/           детерминированная логика: state (plain JSON), step, waves, weapons, enemies, combat, stats, коллизии, поле потоков
  content/       данные: balance (формулы), stats, weapons, enemies, waves, levelups, operators, арена, палитра
  render/        Canvas 2D (DPR), камера, эффекты на пулах
  audio/         WebAudio: engine (синтез) + bank (SfxId → патч, подменяется сэмплами)
  ui/            DOM-оверлеи, HUD (dirty-check), экраны уровня/снабжения/итогов, dev-панель (F1)
  i18n/          словари, t(key, params); строк в коде нет
  save/          meta-сохранение с версией и миграцией
tests/           vitest: коллизии, RNG, spatial hash, поле потоков, детерминизм сима, сохранения
legacy/RR.html   исходный прототип (не трогаем)
docs/            исследование, аудит прототипа, план, скриншоты
```

**Поток данных:** `Input` → `TickInput` → `step(state)` → `SimEvent[]` → (`Fx`, `playSfx`, UI). Сим не знает про DOM, Canvas и звук.

## Управление

WASD — движение · оружие стреляет само · **зажать ЛКМ** — ручной огонь в курсор · Пробел — рывок · Q — ударная волна · Esc — пауза · M — звук · **F1** — dev-панель. Геймпад: левый стик — движение, правый — ручной огонь, A/RB — рывок, X/RT — волна, Start — пауза.

## Как добавить оружие

1. Добавь запись в `WEAPONS` (`src/content/weapons.ts`): `kind` (`bullet` / `swing` / `chain`), урон, кулдаун, дальность, цвет, звук, силуэт `look`.
2. Добавь ключи `w.<id>.name` и `w.<id>.desc` в `src/i18n/ru.ts`. Если нужен новый звук, добавь `SfxId` в `src/sim/events.ts` и патч в `src/audio/bank.ts`.
3. Проверь DPS тира I по скиллу `game-balance` (55–80 по одиночной цели, AoE ниже). `npm test` проверяет коридор.
4. Допиши строку в таблицу оружия в `DESIGN.md`.

## Как добавить врага

Запись в `ENEMIES` (`src/content/enemies.ts`) + строка в `WAVE_TABLE` (`src/content/waves.ts`) + особое поведение (если есть) в `src/sim/enemies.ts`.

Модули появятся на этапе 3.
