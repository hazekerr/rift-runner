# 02. Жанр arena survivor: петля «ещё один забег» и синергии

> Первоисточники (постмортемы на GDC Vault, полные интервью) из сессии напрямую не открывались. Выводы опираются на пресс-интервью и разборы из поисковой выдачи. Где это мнение критика, а не слова разработчика, так и помечено.

## Источники

- Brotato, пресс-кит 1.0 (Blobfish / Thomas Gervraud): https://www.gamespress.com/Brotato-10-Release
- Brotato — Wikipedia: https://en.wikipedia.com/wiki/Brotato
- Vampire Survivors — GamesRadar, Luca Galante о рогалайт-формуле: https://www.gamesradar.com/games/roguelike/i-felt-like-playing-30-hours-of-story-mode-was-actually-the-tutorial-too-many-rpgs-and-jrpgs-end-after-their-combat-really-gets-good-vampire-survivors-creator-says-which-is-where-the-roguelike-formula-is-so-great
- Vampire Survivors — PC Gamer, отказ от мобильного гемблинга: https://pcgamer.com/vampire-survivors-saved-its-creator-from-working-on-mobile-gambling-games
- The Conversation / Univ. of Portsmouth, «гемблинг-психология» в VS (комментарий учёных): https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613
- «The Secret Sauce of Vampire Survivors» (мнение критика, частота наград): https://jboger.substack.com/p/the-secret-sauce-of-vampire-survivors
- Halls of Torment — интервью Chasing Carrots: https://fullcleared.com/features/inside-halls-of-torment-an-interview-with-chasing-carrots/ и https://www.w4games.com/blog/w4-games-news-1/interview-with-chasing-carrots-developer-of-halls-of-torment-120
- Halls of Torment — PC Gamer: https://pcgamer.com/games/action/halls-of-torment-feels-like-the-brilliant-lovechild-of-vampire-survivors-and-diablo-and-the-absolute-pinnacle-of-autobattlers
- 20 Minutes Till Dawn — Wikipedia: https://en.wikipedia.com/wiki/20_Minutes_Till_Dawn
- Deep Rock Galactic: Survivor — GamesRadar (Anders Leicht Rohde, Edge #407): https://gamesradar.com/games/fps/deep-rock-galactic-roguelike-dev-says-innovation-for-innovations-sake-is-too-expensive-to-survive-were-a-studio-of-50-people-with-bills-to-pay
- DRG: Survivor — How To Market A Game: https://howtomarketagame.com/2024/04/08/how-creating-a-spinoff-for-a-hot-genre-lead-to-success-for-deep-rock-galactic-survivor/
- DRG: Survivor — NME, «breaking the rules of VS»: https://www.nme.com/features/deep-rock-galactic-survivor-finds-joy-in-breaking-the-rules-of-vampire-survivors-3461649

## Наблюдения по играм

**Brotato.** Сам автор описывает игру как смесь survivor-боя и *магазинной механики автобаттлеров*. Волны идут по таймеру, примерно от 20 до 90 секунд. Материалы одновременно служат валютой и опытом. Магазин стоит между волнами. Игрок принимает решения дважды: в бою (позиционирование) и в магазине (сборка). Короткие ранние волны быстро доводят до первого магазина и первой награды.

**Vampire Survivors.** Главный аргумент разборов — **частота наград**. Критик насчитал примерно одну награду каждые 23 секунды против «раз в 2.5 минуты» в типичной игре. Сундуки и левел-апы — «дофаминовые» события. Мета-прогресс из более чем сотни разблокировок даёт долгосрочные цели. Galante: рогалайт хорош тем, что после «обучения» (короткий забег) сразу начинается интересная часть, а боевая система раскрывается многократно. Отдельный тезис: VS принципиально без монетизации-гемблинга. Механики случайности есть, эксплуатации денег нет.

**Halls of Torment.** Студия называет VS главным влиянием, а 20MTD — игрой, после которой они взялись за жанр. Забег 30 минут, врагов больше со временем, более 20 статов. Есть опции авто-прицела и авто-атаки. Ориентир: много статов допустимо, если игра их хорошо показывает.

**20 Minutes Till Dawn.** Отличие от VS: игрок управляет прицелом и стрельбой. Есть мета-прогресс между забегами. Для RR это аргумент за ручной режим как *опцию*.

**DRG: Survivor.** Rohde: «инновация ради инновации слишком дорогая». Опираться на проверенную петлю, а отличие строить на своём сеттинге и одном-двух ключевых твистах (у них разрушаемый терраин и добыча). Из блога: управление упрощали, потому что игроки перегружались, а сложность при этом подняли. Узкое место у них было не в идеях, а в **производстве контента**. Это прямое указание держать контент в данных.

## Что делает петлю «ещё один забег»

1. **Короткий забег с чёткой финишной чертой** (20 волн ≈ 15–20 минут) плюс опциональный бесконечный режим.
2. **Плотный ритм наград.** Каждая волна заканчивается магазином. Левел-ап на каждые 1–2 волны, подбор скрапа каждую секунду.
3. **Два слоя решений:** тактика (уворот, позиция, рывок) и стратегия (магазин, слияния, теги).
4. **Сборка, которая «щёлкает».** Момент, когда синергия начинает работать. Его нужно визуально подсветить (тег-бонус активирован, всплывашка).
5. **Близкий проигрыш и ясная причина смерти.** Экран поражения показывает, кто и чем убил и на какой волне. Игрок думает «в следующий раз возьму броню», а не «нечестно».
6. **Мета-цели:** открытие операторов через достижения, уровни Угрозы. Каждая неудача приближает к чему-то.
7. **Ломающие правила персонажи** (у Brotato это ядро реиграбельности). Каждый оператор заставляет собирать иначе.

## Как устроены синергии

- **Теги на предметах + пороговые бонусы** (например 2/4/6 в автобаттлерах). Порог виден заранее, игрок «копит» к нему. ТЗ задаёт 3/6.
- **Стат-синергии:** модуль усиливает стат, который масштабирует другой модуль («урон от брони», «скрап → урон»).
- **Триггер-синергии:** события (рывок, смерть врага, крит) запускают эффекты. Нужны лимиты рекурсии.
- **Анти-синергии и компромиссы** делают выбор осмысленным.

## Что берём в RR

- Петлю Brotato: таймерные волны → магазин → левел-апы. Скрап = валюта + опыт.
- Плотность наград: ранние волны по 20–25 с, первый магазин примерно через 25 секунд от старта.
- Ручной режим прицела как настройку (урок 20MTD), авто по умолчанию (урок HoT/VS).
- 5 операторов с ломающими правилами. Открываются через достижения (мета-цели VS).
- Экран поражения с причиной смерти и разбором урона по оружию.
- Контент как типизированные данные с первого дня (урок DRG:S про узкое место производства).
- Теги с порогами 3/6, явная подсветка «синергия активирована».
- Без монетизации и тёмных паттернов. Случайность прозрачна: шансы редкости видны в магазине.
