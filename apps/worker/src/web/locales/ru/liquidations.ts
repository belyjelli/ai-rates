/**
 * Russian for web/liquidations.ts: the /liquidations map, the priced grid and the longs-vs-shorts
 * chart. Glossary and style: ./index.ts.
 *
 * Window codes ("24h", "7d") are left as written, as interval figures are elsewhere on the site: they
 * are units in a control strip and in its URLs, not words.
 *
 * Terms: force-close принудительное закрытие (a closed long ликвидация лонга, longs closed ликвидации
 * лонгов), pending (modeled) ожидаемые, mark маркировка (the glossary's цена маркировки where a
 * sentence has room), collector сборщик, window период, band диапазон, odds шансы, theory гипотеза,
 * whale map карта китов, isolated / cross margin изолир. / кросс. Months are genitive abbreviations,
 * after the day ("15 окт").
 */

import type { Catalog } from "../../i18n";

export const liquidations: Catalog = {
  // Axis dates.
  Jan: "янв",
  Feb: "фев",
  Mar: "мар",
  Apr: "апр",
  May: "мая",
  Jun: "июн",
  Jul: "июл",
  Aug: "авг",
  Sep: "сен",
  Oct: "окт",
  Nov: "ноя",
  Dec: "дек",
  "{month} {day}": "{day} {month}",

  // Controls and legend.
  Window: "Период",
  Venue: "Биржа",
  all: "все",
  Cell: "Ячейка",
  "longs closed": "ликвидации лонгов",
  "shorts closed": "ликвидации шортов",
  "Band width": "Ширина диапазона",
  Asset: "Актив",
  fit: "авто",

  // The map tab.
  "{usd} across {count} liquidation — {long} long, {short} short":
    "{usd}, ликвидаций: {count} — лонги {long}, шорты {short}",
  "{usd} across {count} liquidations — {long} long, {short} short":
    "{usd}, ликвидаций: {count} — лонги {long}, шорты {short}",
  "This column is still filling": "Этот столбец ещё заполняется",
  "<b>{usd}</b> · {events} liquidations · {markets} markets":
    "<b>{usd}</b> · ликвидаций: {events} · рынков: {markets}",
  "no liquidations in this window": "за этот период ликвидаций нет",
  "other markets": "другие рынки",
  total: "итого",
  "No liquidations recorded in the last {window}. Only the venues that publish a feed the collector reads appear here, so a quiet window is not a quiet market.":
    "За последние {window} ликвидаций не зафиксировано. Здесь видны только биржи, публикующие поток, который читает наш сборщик, поэтому тихий период — ещё не тихий рынок.",
  "Columns are {hours}-hour buckets in {zone}, newest on the right; the last one is still filling.":
    "Столбцы — интервалы по {hours} ч ({zone}), новые справа; последний ещё заполняется.",
  "Newest liquidation {age}.": "Последняя ликвидация: {age}.",
  "Rows are the {count} busiest assets by notional across every feed, and the rest are summed into “other markets”, so the totals below the grid are real totals and add up.":
    "Строки — активы с наибольшим объёмом ликвидаций по всем потокам (всего: {count}), остальные сложены в «другие рынки», поэтому итоги под таблицей — настоящие итоги, и они сходятся.",
  "Any row opens that asset at the price it died at.":
    "Любая строка открывает этот актив с разбивкой по ценам, на которых закрывались позиции.",

  // The priced tab.
  "<b>{usd}</b> · {events} liquidations · {long} long / {short} short":
    "<b>{usd}</b> · ликвидаций: {events} · лонги {long} / шорты {short}",
  "nothing force-closed here in this window": "за этот период здесь ничего не ликвидировано",
  "Fill price": "Цена исполнения",
  "No live market for {asset} is publishing a mark, so there is no price to band liquidations against.":
    "Ни один активный рынок {asset} не публикует цену маркировки, поэтому не от чего строить ценовые диапазоны ликвидаций.",
  "No liquidations recorded for {asset} in the last {window}. Only the venues publishing a feed the collector reads appear here.":
    "За последние {window} ликвидаций по {asset} не зафиксировано. Здесь видны только биржи, публикующие поток, который читает наш сборщик.",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark; the outer rows hold everything further out.":
    "Актив <b>{asset}</b>: диапазоны по {pct}% вокруг цены маркировки; крайние строки собирают всё, что дальше.",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark, fitted to where this asset's closes actually landed; the outer rows hold everything further out.":
    "Актив <b>{asset}</b>: диапазоны по {pct}% вокруг цены маркировки, подобранные по тому, где на самом деле закрывались позиции; крайние строки собирают всё, что дальше.",
  "Banded from <b>{mark}</b>, the deepest market's mark — the same anchor the arbitrage guard uses, so both venues share rows.":
    "Диапазоны отсчитываются от <b>{mark}</b> — цены маркировки самого глубокого рынка; от неё же считает проверка арбитража, поэтому строки общие для обеих бирж.",

  // The longs-vs-shorts tab and its chart.
  "Last {window}": "За {window}",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Longs took the beating.":
    "Ликвидации {asset} за {window}: лонгов закрыто на {long}, шортов — на {short}, событий: {events}. Больше досталось лонгам.",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Shorts took the beating.":
    "Ликвидации {asset} за {window}: лонгов закрыто на {long}, шортов — на {short}, событий: {events}. Больше досталось шортам.",
  "{asset} longs vs shorts over time · {hours}-hour bars, {zone}":
    "{asset}: лонги и шорты во времени · бары по {hours} ч, {zone}",
  "{asset} longs vs shorts over time · {minutes}-minute bars, {zone}":
    "{asset}: лонги и шорты во времени · бары по {minutes} мин, {zone}",
  "Longs closed": "Ликвидации лонгов",
  "Shorts closed": "Ликвидации шортов",
  "Longs at risk, modeled · price falls <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "Лонги под угрозой (модель) · цена падает на <b>{pct}</b> до {range} · ликвидируется около <b>{usd}</b>",
  "Shorts at risk, modeled · price rises <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "Шорты под угрозой (модель) · цена растёт на <b>{pct}</b> до {range} · ликвидируется около <b>{usd}</b>",
  "Shorts at risk above": "Шорты под угрозой выше",
  "Longs at risk below": "Лонги под угрозой ниже",
  "Modeled pending liquidations between {low} and {high}, around {mark}: about {shorts} of shorts above and {longs} of longs below":
    "Ожидаемые ликвидации (модель) от {low} до {high} вокруг {mark}: около {shorts} шортов выше и {longs} лонгов ниже",
  "Pending range": "Диапазон ожидаемых",
  "Zoom in": "Приблизить",
  "Columns are time, in your time zone ({zone}; click the clock at the top for UTC). Each is a {hours}-hour block named by its start hour. Where the day changes, the column shows date/hour (7/00 = the 7th at 00:00). The yellow column is the block in progress and still filling.":
    "Столбцы — время в вашем часовом поясе ({zone}; нажмите на часы вверху, чтобы перейти на UTC). Каждый — блок в {hours} ч, подписанный часом начала. Где меняется день, столбец показывает число/час (7/00 = 7-е число, 00:00). Жёлтый столбец — текущий блок, он ещё заполняется.",
  "'All' is that price row's total over the whole window.":
    "«Все» — итог этой ценовой строки за весь период.",
  "{range}, still filling": "{range}, ещё заполняется",
  "This tab did not load.": "Вкладка не загрузилась.",
  "Try again": "Повторить",
  "Loading…": "Загрузка…",
  "Open this tab": "Открыть вкладку",
  "This tab has nothing to show right now.": "На этой вкладке пока нечего показать.",
  "Zoom out": "Отдалить",
  "shorts liquidate if price rises": "шорты ликвидируются при росте цены",
  "longs liquidate if price falls": "лонги ликвидируются при падении цены",
  "pending is modeled": "ожидаемые — по модели",
  "pending by price band": "ожидаемые по ценовым диапазонам",
  "Modeled from 30 days of open interest and price on each market and its leverage limits, not reported by venues.":
    "Модель по открытому интересу и цене каждого рынка за 30 дней и его пределам плеча; биржи этого не публикуют.",
  Pending: "Ожидаемые",
  "Pending on": "Ожидаемые: вкл",
  "Pending off": "Ожидаемые: выкл",
  "hover or tap a bar to read it": "наведите или нажмите на бар, чтобы увидеть значение",
  "{asset} bars; arrow keys read one at a time": "Бары {asset}; стрелки читают по одному",
  "{asset} longs closed above zero and shorts closed below, over the last {window}":
    "{asset}: ликвидации лонгов выше нуля, шортов — ниже, за {window}",
  "Longs closed above the line, shorts closed below, on the same linear scale. Hover a bar to read it beside the cursor; on a phone, tap and it reads in the line above the chart. The last bar is still filling.":
    "Ликвидации лонгов — выше линии, шортов — ниже, в одной линейной шкале. Наведите на бар, чтобы увидеть значение рядом с курсором; на телефоне нажмите — значение появится в строке над графиком. Последний бар ещё заполняется.",
  "{usd} of longs closed between {band}": "Ликвидировано лонгов на {usd} в диапазоне {band}",
  "{usd} of shorts closed between {band}": "Ликвидировано шортов на {usd} в диапазоне {band}",
  "Longs closed <b>{usd}</b> · {share}%": "Ликвидации лонгов <b>{usd}</b> · {share}%",
  "Shorts closed <b>{usd}</b> · {share}%": "Ликвидации шортов <b>{usd}</b> · {share}%",
  All: "Все",
  "Nothing was force-closed in {asset} in the last {window}, on either side.":
    "За {window} по {asset} не было принудительных закрытий ни с одной стороны.",
  "Showing <b>{asset}</b>, every exchange added together — the split by exchange is one tab along. Rows are the same {pct}% price bands, banded from <b>{mark}</b>. A long close is a forced SELL and a short close a forced BUY, so the heavier side is the one the move ran against. Any asset outside this list opens from a row on the map tab.":
    "Актив <b>{asset}</b>, все биржи вместе — разбивка по биржам на соседней вкладке. Строки — те же ценовые диапазоны по {pct}% от <b>{mark}</b>. Ликвидация лонга — это принудительная ПРОДАЖА, а шорта — принудительная ПОКУПКА, поэтому перевешивает та сторона, против которой пошла цена. Актив не из этого списка открывается из строки на вкладке карты.",

  // The page.
  "Nothing has been force-closed in this window, so there is no asset to price.":
    "За этот период ничего не ликвидировано, поэтому нет актива для разбивки по ценам.",
  "Nothing has been force-closed in this window, so there is no asset to split.":
    "За этот период ничего не ликвидировано, поэтому нет актива для разбивки на лонги и шорты.",
  "{first} and {last}": "{first} и {last}",
  ", ": ", ",
  Liquidations: "Ликвидации",
  "Where positions were force-closed: by venue, asset and hour, and by the price level they died at.":
    "Где позиции закрывались принудительно: по биржам, активам и часам, а также по ценам, на которых они закрылись.",
  "Where positions were force-closed, by exchange. Colour is the side that was closed — {longs}, {shorts} — and intensity is the money, on a log scale.":
    "Принудительные закрытия по биржам. Цвет — закрытая сторона: {longs}, {shorts}; насыщенность — сумма, в логарифмической шкале.",
  "blue for longs": "синий — лонги",
  "red for shorts": "красный — шорты",
  "No venue has reported a liquidation in this window.":
    "За этот период ни одна биржа не сообщила о ликвидациях.",
  "This is {venues}, the one venue whose liquidation feed the collector reads — not the whole market.":
    "Это {venues} — единственная биржа, чей поток ликвидаций читает сборщик, а не весь рынок.",
  "This is {venues}, the {count} venues whose liquidation feed the collector reads — not the whole market.":
    "Это {venues} — биржи, чьи потоки ликвидаций читает сборщик (всего: {count}), а не весь рынок.",
  "By asset and hour": "По активам и часам",
  Assets: "Активы",
  "Longs vs shorts": "Лонги и шорты",
  "{asset} longs vs shorts": "{asset}: лонги и шорты",
  Sides: "Стороны",
  "By price level": "По ценам",
  "{asset} price levels": "{asset}: уровни цен",
  Prices: "Цены",
  "Updated {ago}.": "Обновлено {ago}.",

  // The odds tab.
  Odds: "Шансы",
  "{asset} odds": "{asset}: шансы",
  "Nothing has been force-closed in this window, so there is no asset to size.":
    "За этот период ничего не ликвидировано, поэтому нет актива для оценки движения.",
  "4 hours": "4 часа",
  "6 hours": "6 часов",
  "1 day": "1 день",
  "1 week": "1 неделя",
  Within: "Горизонт",
  "Typical move (1 sigma)": "Типичное движение (1 сигма)",
  "Closes higher than now": "Закрытие выше текущей цены",
  "Reaches the heaviest forced-close level": "Дойдёт до уровня с наибольшими ликвидациями",
  "Whichever of those two it reaches first": "Какой из двух уровней будет первым",
  "The upper one first": "Сначала верхний",
  "The lower one first": "Сначала нижний",
  Neither: "Ни один",
  "Reaches a move of": "Пройдёт движение в",
  "{price} ({where}) · {usd} closed, {share} of the window":
    "{price} ({where}) · закрыто {usd}, {share} за период",
  Theory: "Гипотеза",
  "Reading now": "Сейчас",
  Leans: "Уклон",
  "Moves the odds?": "Влияет на шансы?",
  up: "вверх",
  down: "вниз",
  "Forced-close burst fades": "Всплеск ликвидаций затухает",
  "Funding crowding fades": "Перекос фандинга рассасывается",
  "Stretch from the 50-hour average fades": "Отклонение от 50-часовой средней возвращается",
  "Initiative vs absorption": "Инициатива против поглощения",
  "Fear and greed": "Страх и жадность",
  "Liquidation magnet": "Магнит ликвидаций",
  "Needs open positions by price level. The collector keeps closed ones only, so this cannot be read yet.":
    "Нужны открытые позиции по уровням цен. Сборщик хранит только закрытые, поэтому пока это не посчитать.",
  "Fewer than 5 forced closes in the last 4 hours: too thin to call a burst.":
    "Меньше 5 принудительных закрытий за 4 часа: слишком мало, чтобы назвать это всплеском.",
  "Not enough data.": "Недостаточно данных.",
  "{longs} of the last 4 hours' forced closes were longs ({usd} in all)":
    "Доля лонгов среди принудительных закрытий за 4 часа: {longs} (всего {usd})",
  "{apr} a year funding, weighted by open interest":
    "фандинг {apr} годовых, взвешенный по открытому интересу",
  "{sigma} bar-sigmas above its 50-hour average": "на {sigma} σ (по барам) выше 50-часовой средней",
  "{sigma} bar-sigmas below its 50-hour average": "на {sigma} σ (по барам) ниже 50-часовой средней",
  "takers net buying {pct} of volume": "тейкеры в чистых покупках: {pct} объёма",
  "takers net selling {pct} of volume": "тейкеры в чистых продажах: {pct} объёма",
  "{flow}, price {change} over 4 hours": "{flow}, цена {change} за 4 часа",
  "{score} out of 100": "{score} из 100",
  "No. Not yet tested, so it carries no weight.": "Нет. Ещё не проверена, поэтому веса не имеет.",
  "No. Context only: its claim never leans.":
    "Нет. Только для контекста: направления не указывает.",
  "No. Cannot be computed.": "Нет. Невозможно рассчитать.",
  "There is not yet enough price history for {asset} to size its moves, or no live market is publishing a mark. The odds need at least 12 hours of closes.":
    "Для {asset} пока недостаточно истории цен, чтобы оценить движения, или ни один активный рынок не публикует цену маркировки. Для шансов нужно минимум 12 часов закрытий.",
  "These are the odds that <b>{asset}</b> reaches a price within each horizon, worked out from how far it has actually been moving: about {hourly} an hour over the last {hours} hours. They are not a forecast of direction.":
    "Это шансы, что <b>{asset}</b> дойдёт до цены в пределах каждого горизонта, рассчитанные по фактической волатильности: около {hourly} в час за последние {hours} ч. Это не прогноз направления.",
  "The levels are where the most dollars were force-closed in the last {window}. Those positions are gone, so a heavy level is somewhere price has been, not fuel waiting for it. The collector does not keep open positions by price, so the resting map a liquidation magnet needs cannot be built yet.":
    "Уровни — это места, где за {window} принудительно закрыли больше всего долларов. Этих позиций уже нет, так что «тяжёлый» уровень — это место, где цена уже была, а не топливо, которое её ждёт. Сборщик не хранит открытые позиции по ценам, поэтому карту ожидающих позиций, нужную для магнита ликвидаций, пока не построить.",
  "Real prices have fatter tails than this model assumes, so the far levels are reached more often than shown. Volatility is measured over the recent past and held constant.":
    "У реальных цен хвосты толще, чем предполагает эта модель, поэтому дальние уровни достигаются чаще, чем показано. Волатильность измеряется по недавнему прошлому и считается постоянной.",
  "Odds of reaching a level, from {asset}'s own volatility. They say how far it can go, not which way. The chance of closing higher stays at 50% until a theory below passes a test set in advance, after costs.":
    "Шансы достичь уровня по собственной волатильности {asset}. Они говорят, как далеко может зайти цена, но не куда. Вероятность закрыться выше остаётся 50%, пока одна из гипотез ниже не пройдёт заранее заданную проверку с учётом издержек.",
  "Levels closer than the 4-hour typical move ({pct}) are left out, because price is already standing in them.":
    "Уровни ближе типичного 4-часового движения ({pct}) не показаны: цена и так в них находится.",
  "No forced-close level lies beyond the 4-hour typical move":
    "За пределами типичного 4-часового движения нет уровней ликвидаций",
  "What the liquidation theories read now": "Что сейчас показывают гипотезы о ликвидациях",
  "A reading that leans one way is a hypothesis, not a signal: none of these has been shown to beat the base rate. The first three are measured against a fade, the way their test was written down in advance, and a flat reading leans nowhere.":
    "Показание с уклоном в одну сторону — это гипотеза, а не сигнал: ни одна из них пока не обыграла базовую вероятность. Первые три оцениваются как затухание (возврат) — так их проверка была записана заранее, — а нейтральное показание никуда не клонит.",
  // web/liquidations.ts: the whale map tab.
  "Nothing has been force-closed in this window, so there is no asset to map.":
    "За этот период ничего не ликвидировано, поэтому нет актива для карты.",
  "Position size": "Размер позиции",
  "Price range": "Диапазон цен",
  "Whale map": "Карта китов",
  "{asset} whale map": "{asset}: карта китов",
  Whales: "Киты",

  // web/whale-map.ts
  "mark {price}": "маркировка {price}",
  "{n} positions of {floor} or more · {longs} of longs, {shorts} of shorts · hover or tap a bar to read it":
    "позиций от {floor}: {n} · лонги {longs}, шорты {shorts} · наведите или нажмите на бар, чтобы увидеть значение",
  "Beyond ±{pct} of the mark, off the chart: {longs} of longs and {shorts} of shorts.":
    "Дальше ±{pct} от маркировки, за пределами графика: лонги {longs}, шорты {shorts}.",
  "{asset} · whale positions by liquidation price · {venues}":
    "{asset} · позиции китов по цене ликвидации · {venues}",
  "Longs liquidate": "Ликвидация лонгов",
  "Shorts liquidate": "Ликвидация шортов",
  "Total to the mark": "Сумма до маркировки",
  "{asset} price bands; arrow keys read one at a time":
    "Ценовые диапазоны {asset}; стрелки читают по одному",
  "{asset} whale positions by the price they liquidate at":
    "Позиции китов {asset} по цене ликвидации",
  "Every position here is one an exchange publishes for a named account: reported, not modeled. Only Hyperliquid, Lighter and dYdX publish every account's positions, and together they hold about a tenth of the open interest; Binance, OKX and the other centralized exchanges publish none, so they are not in this map.":
    "Каждая позиция здесь опубликована биржей для конкретного аккаунта: это отчётные данные, а не модель. Только Hyperliquid, Lighter и dYdX публикуют позиции всех аккаунтов, и вместе на них приходится около десятой части открытого интереса; Binance, OKX и другие централизованные биржи не публикуют ничего, поэтому их на карте нет.",
  "Hyperliquid and Lighter report each position's liquidation price. dYdX does not, so its are computed from the account's own balance and positions with dYdX's maintenance margins, holding its other prices where they are; they are marked * in the table.":
    "Hyperliquid и Lighter сообщают цену ликвидации каждой позиции. dYdX — нет, поэтому для его позиций она рассчитывается по балансу и позициям самого аккаунта с поддерживающей маржой dYdX при неизменных прочих ценах; в таблице такие отмечены *.",
  "On Hyperliquid the collector watches the leaderboard's accounts worth $100k or more and any account it sees in a large trade, re-reading each every few minutes while it holds $1M or more and hourly while it holds $100k. On Lighter it follows the leaderboard's owners with $100k in the account or a $100k position, whose changes arrive as they happen. On dYdX it reads every account on the chain every five minutes. So the map covers the largest traders, not every account.":
    "На Hyperliquid сборщик следит за аккаунтами из рейтинга с капиталом от $100k и за любым аккаунтом, замеченным в крупной сделке; каждый перечитывается раз в несколько минут, пока у него позиции от $1M, и раз в час — от $100k. На Lighter он следит за участниками рейтинга с $100k на счёте или позицией в $100k; их изменения приходят сразу. На dYdX он читает все аккаунты сети каждые пять минут. Так что карта охватывает крупнейших трейдеров, а не все аккаунты.",
  "A cross-margin position's liquidation price moves with the rest of its account: its other positions' profit and loss, deposits and withdrawals. Each one is as of its account's last read, shown in the table. Bars are the money that liquidates in each price band, longs below the mark and shorts above; the lines add up everything between the mark and that price.":
    "Цена ликвидации позиции с кросс-маржой меняется вместе с остальным счётом: прибылью и убытком других позиций, депозитами и выводами. Каждая показана на момент последнего чтения аккаунта (время — в таблице). Бары — сумма, ликвидируемая в каждом ценовом диапазоне: лонги ниже маркировки, шорты выше; линии суммируют всё между маркировкой и этой ценой.",
  "The whale positions could not be read right now.": "Сейчас не удалось прочитать позиции китов.",
  "No position of {floor} or more in {asset} among the accounts watched.":
    "Среди отслеживаемых аккаунтов нет позиций по {asset} от {floor}.",
  "There are {n} of $100k or more: switch to $100k+.":
    "Позиций от $100k: {n} — переключитесь на $100k+.",
  "nearest at {price} ({pct})": "ближайшая: {price} ({pct})",
  "none with a liquidation price": "ни у одной нет цены ликвидации",
  "Whale longs": "Лонги китов",
  "{n} positions": "позиций: {n}",
  "Whale shorts": "Шорты китов",
  "Within 5% of the mark": "В пределах 5% от маркировки",
  "longs below / shorts above": "лонги ниже / шорты выше",
  Accounts: "Аккаунты",
  "read a median {age}": "медиана чтения: {age}",
  "No live mark for {asset}, so the positions cannot be placed on a price axis.":
    "Для {asset} нет актуальной цены маркировки, поэтому позиции нельзя разместить на ценовой оси.",
  long: "лонг",
  short: "шорт",
  "No liquidation price: the account's margin covers any move":
    "Нет цены ликвидации: маржа аккаунта покрывает любое движение",
  "dYdX publishes no liquidation price: computed from the account's balance and positions with dYdX's maintenance margins":
    "dYdX не публикует цену ликвидации: рассчитана по балансу и позициям аккаунта с поддерживающей маржой dYdX",
  "By venue:": "По биржам:",
  none: "нет",
  "{leverage}× isolated": "{leverage}× изолир.",
  // Cross margin, not the chart cursor's crosshair (charts.ts's "cross").
  "{leverage}× cross": "{leverage}× кросс",
  "The {n} nearest to liquidation of {total}.": "Ближайшие к ликвидации: {n} из {total}.",
  "Positions by distance to liquidation": "Позиции по расстоянию до ликвидации",
  Trader: "Трейдер",
  Value: "Стоимость",
  Entry: "Вход",
  "Liquidates at": "Ликвидация",
  "From the market's mark to the liquidation price": "От цены маркировки рынка до цены ликвидации",
  Leverage: "Плечо",
  Unrealized: "Нереал. PnL",
  "The whole account's value on its venue": "Стоимость всего аккаунта на его бирже",
  Account: "Аккаунт",
  Read: "Прочитано",
  // Before a link to the member login, inside the sentence below.
  "Log in": "Войдите",
  "Refreshes every 30 s. {login} to refresh every 10 s, with the nearest accounts re-read about every minute.":
    "Обновляется каждые 30 с. {login}, чтобы обновлять каждые 10 с, а ближайшие к ликвидации счета перечитывать примерно раз в минуту.",
  "Live for members: refreshes every 10 s, and the nearest accounts are re-read about every minute.":
    "Онлайн для участников: обновление каждые 10 с, ближайшие к ликвидации счета перечитываются примерно раз в минуту.",
  Indexes: "Индексы",
  "Other stocks": "Другие акции",
  "Energy and other commodities": "Энергоносители и другие товары",
  FX: "Валюты",
  "{long} long · {short} short": "лонги {long} · шорты {short}",
  "Pick an asset": "Выбрать актив",
  "Filter assets": "Фильтр активов",
  Liquidated: "Ликвидировано",
  "Longs / shorts": "Лонги / шорты",
  Events: "Событий",
};
