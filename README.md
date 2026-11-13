# RIFT RUNNER (RR)

Браузерный arena survivor-roguelite в сеттинге разлома. Vite + TypeScript, Canvas 2D, без движка.

**Статус:** обновление 2.0 «Прорыв» (план и решения: `docs/PLAN-v2.md`):
- ребаланс по реальному DPS в бою, ближний бой стал полноценным стилем;
- аптечек меньше;
- после Стража — «Разлом открыт»: толпы до 600 врагов и орды;
- 8 новых врагов и 2 мини-босса, 24 оружия (было 14), 61 модуль, оператор Мясник;
- анимации врагов, рендер ускорен для толпы.

Ранее, 1.1 по отзывам игроков: честные телеграфы босса, открытая арена, ранние модули стоят своих денег (видна дельта DPS), карточки оружия, прокачка рывка и импульса, понятные мины и брифинги о новых врагах, тихая музыка (по умолчанию выключена). Этап 7 — публикация на GitHub Pages и PWA (установка на телефон, офлайн). Этап 6 — полировка: баланс-прогоны ботом, оптимизация (сим −50%), мобильная раскладка, навигация геймпадом. Этап 5 — сохранение забега между волнами, уровни Угрозы, настройки, английский язык, процедурная музыка. Ранее: операторы, 14 видов оружия, синергии, боссы, магазин и модули. План в `docs/PLAN.md`, правила в `DESIGN.md`.

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
npm run balance    # баланс-прогон ботом по 20 волнам → docs/balance-report.md (несколько минут)
```

```bash
npm run perf       # замер шага сима на стресс-сцене → perf-results.txt
```

```bash
npm run build      # typecheck + сборка в dist/
npm run build:single  # один самодостаточный файл dist-single/rift-runner.html (открывается без сервера)
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
  i18n/          словари ru/en (en типизирован как полный Record — пропуск ключа не соберётся), t(key, params), fmtNum
  save/          meta (схема v4, миграции) и run (сохранение забега между волнами)
tests/           vitest: коллизии, RNG, spatial hash, поле потоков, детерминизм сима, сохранения
legacy/RR.html   исходный прототип (не трогаем)
docs/            исследование, аудит прототипа, план, скриншоты
```

**Поток данных:** `Input` → `TickInput` → `step(state)` → `SimEvent[]` → (`Fx`, `playSfx`, UI). Сим не знает про DOM, Canvas и звук.

## Управление

WASD — движение · оружие стреляет само · **зажать ЛКМ** — ручной огонь в курсор · Пробел — рывок · Q — ударная волна · Esc — пауза · M — звук · **F1** — dev-панель. Геймпад: левый стик — движение, правый — ручной огонь, A/RB — рывок, X/RT — волна, Start — пауза. В меню: крестовина/стик — фокус, A — выбрать, B — назад.

## Как добавить оружие

1. Добавь запись в `WEAPONS` (`src/content/weapons.ts`): `kind` (`bullet` / `swing` / `chain` / `trap` / `artillery` / `turret` / `orbit` / `beam`), теги, урон, кулдаун, дальность, цвет, звук, силуэт `look`.
2. Добавь ключи `w.<id>.name` и `w.<id>.desc` в `src/i18n/ru.ts`. Если нужен новый звук, добавь `SfxId` в `src/sim/events.ts` и патч в `src/audio/bank.ts`.
3. Проверь DPS тира I по скиллу `game-balance` (55–80 по одиночной цели, AoE ниже). `npm test` проверяет коридор.
4. Допиши строку в таблицу оружия в `DESIGN.md`.

## Как добавить оператора

Запись в `OPERATORS` (`src/content/operators.ts`): стартовое оружие, модификаторы, правила `rule` (флаги в `OperatorRules`), условие открытия `unlock`. Тексты — ключи `op.<id>*` в словаре. Новое правило — флаг в `OperatorRules` и его обработка в симе (поиск: `operatorById(s.operator).rule`).

## Графика (спрайты «детальный неон»)

Все объекты рисуются кодом один раз в offscreen-холсты (`src/render/sprites.ts`): `ENEMY_ART` по типам врагов, `WEAPON_ART` по оружию, `paintPlayer`, турель, мины, скрап, подборы. Свечение вшито в картинку (в качестве «экономия» — без него). Чтобы заменить любой спрайт рисованным артом, загрузите картинку и вызовите `renderer.sprites.put(ключ, картинка, половина_размера)` — ключи: `e:<тип>`, `w:<оружие>`, `player`, `turret`, `mine`, `scrap:<размер>`, `pickup:<heal|energy>`. Спрайты смотрят вдоль оси +x.

## Как добавить врага

Запись в `ENEMIES` (`src/content/enemies.ts`) + строка в `WAVE_TABLE` (`src/content/waves.ts`) + рисунок в `ENEMY_ART` (`src/render/sprites.ts`) + особое поведение (если есть) в `src/sim/enemies.ts`.

## Как добавить модуль

1. Запись в `MODULES` (`src/content/modules.ts`): `m(id, rarity, [модификаторы], эффект?, теги?, max?)`. Модификатор: `{ stat, flat }` или `{ stat, pct }`.
2. Имя: ключ `m.<id>` в `src/i18n/ru.ts`. Описание генерируется само.
3. Новый тип эффекта: вариант в `EffectDef`, агрегация в `aggregate()` и триггер в `src/sim/effects.ts`, шаблон текста `fx.<kind>` в словаре и в `effectText()` (`src/ui/shop.ts`).
4. Проверь по чек-листу магазина в скилле `game-balance` («цена за эффект», компромиссы, ICD).

## Как добавить язык

1. Новый файл `src/i18n/<код>.ts` с типом `Record<I18nKey, string>`: компилятор потребует все ключи.
2. Зарегистрировать в `dicts` и `LANGS` (`src/i18n/index.ts`), добавить код в тип `Lang` и `Settings.lang` (`src/save/meta.ts`).
3. Тест `tests/stage5.test.ts` проверит, что параметры `{...}` совпадают с русским словарём.

## Публикация (GitHub Pages) и PWA

- Workflow `.github/workflows/deploy.yml`: на каждый push в `main` или рабочую ветку — `npm ci` → `npm test` → `npm run build` → выкладка `dist/` на Pages. Можно запустить вручную (Actions → Deploy to GitHub Pages → Run workflow).
- **Один раз нужно включить Pages:** Settings → Pages → Source: **GitHub Actions**. Адрес будет `https://<владелец>.github.io/rift-runner/`.
- PWA: `public/manifest.webmanifest` (полноэкранный режим, иконки в `public/icons/`, генерируются `node scripts/make-icons.cjs`), service worker собирается из `src/sw-template.js` плагином в `vite.config.ts`: уникальная версия кеша на каждую сборку и полный список файлов — игра работает офлайн с первого запуска, обновление подхватывается при следующем открытии.
- Установка на телефон: открыть адрес в Chrome (Android) → меню → «Установить приложение»; в Safari (iOS) → «Поделиться» → «На экран Домой».
