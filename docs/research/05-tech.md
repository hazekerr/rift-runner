# 05. Техника: цикл, паттерны, производительность Canvas 2D

## Источники

- Glenn Fiedler, «Fix Your Timestep!»: https://gafferongames.com/post/fix_your_timestep/
- Обсуждение «spiral of death» (gamedev.net): https://www.gamedev.net/blogs/entry/2262574-thoughts-on-fix-your-timestep-and-the-spiral-of-death
- Ввод при фиксированном шаге (Jakub Tomšů): https://jakubtomsu.github.io/posts/input_in_fixed_timestep
- Tyler Glaiel, «How to make your game run at 60fps»: https://medium.com/@tglaiel/how-to-make-your-game-run-at-60fps-24c61210fe75
- Robert Nystrom, Game Programming Patterns: оглавление https://gameprogrammingpatterns.com/contents.html , Game Loop https://gameprogrammingpatterns.com/game-loop.html , Object Pool https://gameprogrammingpatterns.com/object-pool.html , Spatial Partition https://www.gameprogrammingpatterns.com/spatial-partition.html , Component (в разделе Decoupling Patterns)
- MDN, Optimizing canvas: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- web.dev, Improving HTML5 Canvas performance: https://web.dev/articles/canvas-performance/

## Цикл с фиксированным шагом (Fiedler)

```
acc += min(frameTime, 0.25)        // кламп: защита от spiral of death
while (acc >= DT && steps < 5) { prev = curr; sim.step(DT); acc -= DT; steps++ }
alpha = acc / DT
render(lerp(prev, curr, alpha))     // alpha→1 = ближе к current, не перепутать lerp
```

- **Spiral of death:** сим отстаёт → считает больше шагов → отстаёт сильнее. Лечится клампом frameTime (0.25 с) и лимитом подшагов.
- Интерпозиция: храним `px, py` (предыдущая позиция) у сущностей. Рендер рисует `lerp(px, x, alpha)`.
- **Ввод при фиксированном шаге:** нажатия накапливаются между тиками («было нажато хотя бы раз»), чтобы короткий тап не потерялся при нескольких кадрах рендера на один тик или нескольких тиках на кадр.
- Glaiel: на мониторах 120/144 Гц фиксированный 60-Гц сим с интерполяцией выглядит гладко, переменный dt даёт недетерминизм.

## Паттерны (Nystrom)

- **Game Loop:** отделить update от render, фиксированный шаг.
- **Object Pool:** пул нужного размера (не огромный). Объекты переиспользуются флагом `alive`, без `splice` и `filter` в горячем цикле. Для пуль, частиц, скрапа, всплывающих чисел. В TS это массивы структур фиксированной ёмкости плюс free-list либо swap-remove.
- **Spatial Partition:** структура по позиции, обновляется при движении. Для однородных объектов подходит **spatial hash** с ячейкой примерно 2× типичного радиуса (64 px). Перестраиваем каждый тик (300 врагов — дёшево), запросы на круг или отрезок.
- **Component:** для MVP не полный ECS. Данные-сущности (plain objects) плюс системы-функции. Оружие и модули — data + хуки-эффекты по событиям (onHit, onKill, onDash…). Сериализуемость важна для сохранений.

## Детерминизм

- Сидовый RNG (sfc32 или mulberry32), раздельные потоки: `spawn`, `loot`, `shop`, `combat`. Визуальный шум (частицы, тряска) идёт в отдельном потоке и на сим не влияет.
- Сим не читает `Math.random`, `Date.now` и `performance.now`. Время — только счётчик тиков.
- Состояние сима — plain JSON-сериализуемые данные (ссылки по id, а не по объекту). Это сразу даёт сохранение между волнами.

## Производительность Canvas 2D

- **shadowBlur дорогой**: MDN прямо советует избегать. В прототипе он стоит на каждой пуле и враге. Решение: заранее отрендерить glow-спрайты на offscreen canvas (по цвету и радиусу) и рисовать их `drawImage`, а shadowBlur оставить только для единичных объектов (босс, игрок).
- **Батчинг:** один path на много одинаковых примитивов (сетка уже так нарисована в прототипе). Пули одного цвета рисуем одним `beginPath` и одним `stroke`.
- **Меньше смен состояния:** группировка по fillStyle и strokeStyle. `globalAlpha` выставлять пакетами.
- **Offscreen pre-render** статичной арены (пол, сетка, надписи, тени неразрушаемых препятствий) в один canvas с перерисовкой только при изменении.
- Без `save/restore` на каждую сущность там, где хватает `setTransform`.
- Целевой бюджет кадра 16.7 мс: сим ≤ 5 мс при 300 врагах и 1000 пуль, рендер ≤ 8 мс.
- DOM-HUD: писать в DOM только при изменении значения (dirty-check), не каждый кадр (в прототипе `querySelectorAll` идёт каждый кадр).
- Mobile: DPR ограничен 2 (как в прототипе), опция «качество» снижает DPR до 1 и отключает glow.

## Что берём в RR

- `core/loop.ts`: 60 Гц, кламп 0.25 с, максимум 5 подшагов, alpha-интерполяция.
- `sim/` полностью детерминирован, сидовый RNG по потокам, состояние сериализуемо.
- Пулы: пули (2048), частицы (2048), скрап (1024), числа урона (256).
- Spatial hash, ячейка 64 px, перестройка каждый тик. Запросы: круг, отрезок (для пробивающих пуль).
- Glow через кешированные спрайты, статичная арена в offscreen-слое.
- Профилирование: dev-оверлей с мс сима и рендера и счётчиками сущностей, стресс-сцена «300 врагов / 1000 пуль».
