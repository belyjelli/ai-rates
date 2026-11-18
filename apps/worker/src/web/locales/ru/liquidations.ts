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
  "axis squeezed above {usd}": "шкала сжата выше {usd}",
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
  "Asset Timeline": "Хронология активов",
  Timeline: "Хронология",
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
  "{asset} liquidations": "Ликвидации {asset}",
  "{asset} liquidations across exchanges: longs against shorts by the hour, the price levels positions were closed at, and where large open positions would be liquidated.":
    "Ликвидации {asset} на всех биржах: лонги против шортов по часам, уровни цены, на которых закрывались позиции, и где будут ликвидированы крупные открытые позиции.",
  "All assets": "Все активы",
  "{n} exchange": "бирж: {n}",
  "{n} asset": "активов: {n}",
  "In the last 7 days": "За последние 7 дней",
  "In the last 48 hours": "За последние 48 часов",
  "In the last 24 hours": "За последние 24 часа",
  "{share} of it longs": "{share} из них — лонги",
  "{share} of it shorts": "{share} из них — шорты",
  "{window}, no {asset} position was force-closed on the exchanges whose liquidation feeds the collector reads.":
    "{window} на биржах, чьи ленты ликвидаций читает коллектор, ни одна позиция {asset} не была принудительно закрыта.",
  "{window}, {total} of {asset} positions were force-closed in {events} on {venues}, {sides}.":
    "{window} принудительно закрыто позиций {asset} на {total} ({events}, {venues}), {sides}.",
  "The largest single one was a {usd} long on {venue} at {price}, {ago}.":
    "Крупнейшая — лонг на {usd} на {venue} по {price}, {ago}.",
  "The largest single one was a {usd} short on {venue} at {price}, {ago}.":
    "Крупнейшая — шорт на {usd} на {venue} по {price}, {ago}.",
  "Of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX, {longs} of longs would be liquidated within 5% below the price and {shorts} of shorts within 5% above.":
    "Из отслеживаемых позиций китов от $1M на Hyperliquid, Lighter и dYdX в пределах 5% ниже цены ликвидировались бы лонги на {longs}, а в пределах 5% выше — шорты на {shorts}.",
  "{window}, {total} of positions were force-closed across {assets} on {venues}, {sides}.":
    "{window} принудительно закрыто позиций на {total} ({assets}, {venues}), {sides}.",
  "The most liquidated: {list}.": "Больше всего ликвидаций: {list}.",
  "The largest single liquidation was a {usd} {asset} long on {venue} at {price} ({when} UTC).":
    "Крупнейшая ликвидация — лонг {asset} на {usd} на {venue} по {price} ({when} UTC).",
  "The largest single liquidation was a {usd} {asset} short on {venue} at {price} ({when} UTC).":
    "Крупнейшая ликвидация — шорт {asset} на {usd} на {venue} по {price} ({when} UTC).",
  Order: "Порядок",
  "Largest first": "Сначала крупные",
  "Newest first": "Сначала новые",
  "Smallest close": "Минимальный размер",
  "The largest liquidations could not be read right now.":
    "Крупнейшие ликвидации сейчас не удалось прочитать.",
  "No single liquidation of {floor} or more in this window.":
    "За этот период нет ни одной ликвидации от {floor}.",
  "Nothing has been force-closed in this window.":
    "За этот период ничего не было принудительно закрыто.",
  "The {n} newest liquidations of {floor} or more in this window.":
    "{n} последних ликвидаций от {floor} за этот период.",
  "Every liquidation of {floor} or more in this window.":
    "Все ликвидации от {floor} за этот период.",
  "The {n} largest single liquidations in this window.":
    "{n} крупнейших ликвидаций за этот период.",
  "Every liquidation in this window, largest first.":
    "Все ликвидации за этот период, начиная с крупнейших.",
  "The position's value at the fill price": "Стоимость позиции по цене исполнения",
  "Each row is one forced close as its exchange reported it: the side is the position that was closed, the size its value at the fill price. Times are in {zone}.":
    "Каждая строка — одно принудительное закрытие, как его сообщила биржа: сторона — это закрытая позиция, размер — её стоимость по цене исполнения. Время в {zone}.",
  "{asset} largest liquidations": "Крупнейшие ликвидации {asset}",
  "Largest liquidations": "Крупнейшие ликвидации",
  Largest: "Крупнейшие",
  "None of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX would be liquidated within 5% of the price.":
    "Ни одна из отслеживаемых позиций китов от $1M на Hyperliquid, Lighter и dYdX не была бы ликвидирована в пределах 5% от цены.",
  later: "позже",
  "A cascade is a burst in which one asset's liquidations piled up within minutes: consecutive minutes each running at {pace} times its 7-day average pace or more, with no more than {gap} quiet minutes between them, and at least an hour's worth of that average pace, and {floor}, in all. Every exchange whose liquidation feed the collector reads is counted; the venue choices on the other tabs do not narrow it.":
    "Каскад — это всплеск, когда ликвидации одного актива скопились за несколько минут: подряд идущие минуты, в каждой из которых темп ликвидаций в {pace} раз или больше выше среднего за 7 дней, с паузами не дольше {gap} минут, и в сумме не меньше часового объёма при среднем темпе и не меньше {floor}. Учитываются все биржи, чьи ленты ликвидаций читает коллектор; выбор бирж на других вкладках их не сужает.",
  "Prices are the asset's busiest market in 5-minute candles. Into it is the move from the last close before the cascade to the furthest the price went inside it: the low when mostly longs were closed, the high when mostly shorts were. 1h and 4h after run from the close at its end to the close an hour and four hours later, and say later until that candle has closed.":
    "Цены — самый активный рынок актива в 5-минутных свечах. «В ходе» — движение от последнего закрытия перед каскадом до самой дальней точки цены внутри него: минимум, когда закрывались в основном лонги, максимум, когда шорты. «Через 1 ч» и «через 4 ч» — от закрытия в конце каскада до закрытия через час и четыре часа; до закрытия этой свечи стоит «позже».",
  "The cascades could not be read right now.": "Каскады сейчас не удалось прочитать.",
  "No cascade in {asset} in this window: no burst reached {pace} times its usual pace with an hour's worth of it. Its usual pace is {usd} a minute, the 7-day average.":
    "За этот период каскадов в {asset} не было: ни один всплеск не достиг темпа в {pace} раз выше обычного с часовым объёмом. Обычный темп — {usd} в минуту, среднее за 7 дней.",
  "none in this window": "за этот период нет",
  "none an hour old yet": "пока нет прошедших часа",
  "higher in {up} of {n}": "выше в {up} из {n}",
  Cascades: "Каскады",
  "{usd} longs": "лонги {usd}",
  "{usd} shorts": "шорты {usd}",
  "An hour after long cascades": "Через час после каскадов лонгов",
  "An hour after short cascades": "Через час после каскадов шортов",
  "Usual pace": "Обычный темп",
  "a minute, the 7-day average": "в минуту, среднее за 7 дней",
  "{n} min": "{n} мин",
  "longs {share}": "лонги {share}",
  "shorts {share}": "шорты {share}",
  "Prices: {market} on {venue}, in 5-minute candles.":
    "Цены: {market} на {venue}, 5-минутные свечи.",
  "No price history for {asset}, so the moves are blank.":
    "Нет истории цен для {asset}, поэтому движения пусты.",
  Start: "Начало",
  Length: "Длительность",
  "Exchanges with a liquidation in it": "Биржи, где в нём были ликвидации",
  "The last close before the cascade began": "Последнее закрытие перед началом каскада",
  "Price before": "Цена до",
  "From the price before to the furthest it went inside the cascade":
    "От цены до каскада до самой дальней точки внутри него",
  "Into it": "В ходе",
  "From the close at its end to the close an hour later":
    "От закрытия в конце до закрытия через час",
  "1h after": "Через 1 ч",
  "From the close at its end to the close four hours later":
    "От закрытия в конце до закрытия через четыре часа",
  "4h after": "Через 4 ч",
  "Newest first.": "Сначала новые.",
  "Times are in {zone}.": "Время в {zone}.",
  "Nothing has been force-closed in this window, so there is no asset to read.":
    "За этот период ничего не было принудительно закрыто, поэтому нет актива для чтения.",
  "{asset} cascades": "Каскады {asset}",
  "{asset} longs vs shorts by day · UTC days": "{asset}: лонги и шорты по дням · дни UTC",
  "30- and 90-day history": "История за 30 и 90 дней",
  "{asset} over 30 and 90 days": "{asset} за 30 и 90 дней",
  "Every day's longs and shorts liquidated over the last 30 or 90 days, each day as a share of the open interest on the same exchanges, and the heaviest days ranked.":
    "Ликвидации лонгов и шортов по дням за последние 30 или 90 дней, каждый день как доля открытого интереса на тех же биржах, и самые тяжёлые дни.",
  "Liquidations against open interest": "Ликвидации против открытого интереса",
  "Which markets were really flushed rather than just big: every asset's liquidations in the window as a share of its open interest, and the same for crypto, stocks, commodities and indices.":
    "Какие рынки действительно вычистило, а не просто большие: ликвидации каждого актива за период как доля его открытого интереса, и то же для крипто, акций, сырья и индексов.",
  "For members": "Для участников",
  "Create a free account": "Создать бесплатный аккаунт",
  "Loading the member view…": "Загружаем вид для участников…",
  "The history could not be read right now.": "Историю сейчас не удалось прочитать.",
  "Nothing was force-closed in {asset} over this span.":
    "За этот период позиции {asset} принудительно не закрывались.",
  "Liquidated over {span} days": "Ликвидировано за {span} дней",
  "A typical day": "Обычный день",
  "of open interest, on average": "от открытого интереса, в среднем",
  "The heaviest day": "Самый тяжёлый день",
  "Days with data": "Дней с данными",
  "from {date}": "с {date}",
  "The heaviest days, as a share of open interest": "Самые тяжёлые дни как доля открытого интереса",
  "Day (UTC)": "День (UTC)",
  "Exchanges that reported a liquidation that day": "Биржи, сообщившие о ликвидации в этот день",
  "Open interest is the day's average on the exchanges whose liquidation feeds reported {asset}, so the share compares like with like.":
    "Открытый интерес — среднее за день на биржах, чьи ленты ликвидаций сообщали о {asset}, поэтому доля сравнивает сопоставимое.",
  "Liquidation feeds were added over time: from {least} to {most} exchanges a day here, so early days undercount.":
    "Ленты ликвидаций добавлялись постепенно: здесь от {least} до {most} бирж в день, поэтому ранние дни занижены.",
  Commodities: "Сырьё",
  Indices: "Индексы",
  "The open interest could not be read right now.": "Открытый интерес сейчас не удалось прочитать.",
  "{liq} of {oi} open": "{liq} из {oi} открытых",
  "The markets most flushed for their size": "Рынки, сильнее всего вычищенные относительно размера",
  "No market with $1M of open interest had a liquidation in this window.":
    "За этот период не было ликвидаций на рынках с открытым интересом от $1M.",
  Class: "Класс",
  "Liquidations over the last {window} against the open interest now, both on the {feeds} exchanges whose liquidation feeds reported closes in that window. Markets under $1M of open interest are left out of the ranking.":
    "Ликвидации за последние {window} против текущего открытого интереса, и то и другое на {feeds} биржах, чьи ленты сообщали о ликвидациях в этот период. Рынки с открытым интересом меньше $1M в рейтинг не входят.",
  Span: "Период",
  History: "История",
  "{asset} history": "История {asset}",
  "Liquidations vs open interest": "Ликвидации против открытого интереса",
  "vs OI": "к OI",
  "Every cascade, in every asset": "Каждый каскад по всем активам",
  "Every liquidation cascade in every asset, found each minute as it happens, with the price an hour and four hours after. Members can also have them sent to Telegram the moment they start.":
    "Каждый каскад ликвидаций по всем активам, найденный поминутно по ходу дела, с ценой через час и через четыре часа. Участники могут получать их в Telegram в момент начала.",
  "No cascade in any asset in the last {window}.":
    "За последние {window} каскадов не было ни в одном активе.",
  "in {n} assets": "в {n} активах",
  "Longs and shorts": "Лонги и шорты",
  "{longs} long cascades, {shorts} short": "каскадов лонгов: {longs}, шортов: {shorts}",
  "The deepest market's mark when the watch first saw it, a minute or two in":
    "Марк-цена самого глубокого рынка, когда наблюдение впервые заметило каскад, через минуту-две после начала",
  "Price when seen": "Цена при обнаружении",
  "From the price when seen to the mark an hour after the cascade ended":
    "От цены при обнаружении до марк-цены через час после конца каскада",
  "From the price when seen to the mark four hours after the cascade ended":
    "От цены при обнаружении до марк-цены через четыре часа после конца каскада",
  "Every asset, found each minute as it happens, by the rule of each asset's Cascades tab. Prices are the asset's deepest market's mark when the watch saw it and an hour and four hours after it ended. Members can have them sent to Telegram from {alerts}.":
    "Все активы, поминутно по ходу дела, по правилу вкладки «Каскады» каждого актива. Цены — марк-цена самого глубокого рынка актива при обнаружении и через час и четыре часа после конца. Участники могут настроить отправку в Telegram на {alerts}.",
  "the alerts page": "странице оповещений",
  "All cascades": "Все каскады",
  // The member Top traders tab (web/trader.ts), 2026-11-15.
  "24h": "24ч",
  "30d": "30д",
  "All time": "Всё время",
  "over the last day": "за последние сутки",
  "over the last week": "за последнюю неделю",
  "over the last month": "за последний месяц",
  "over all time": "за всё время",
  "Long {coin}": "Лонг {coin}",
  "Short {coin}": "Шорт {coin}",
  "Rank by profit over": "Рейтинг по прибыли за",
  "Hyperliquid's leaderboard could not be read right now. Try again in a minute.":
    "Сейчас не удалось прочитать лидерборд Hyperliquid. Попробуйте через минуту.",
  "+{n} more": "ещё {n}",
  "nothing over $100k": "ничего больше $100k",
  Profit: "Прибыль",
  "Profit over the account's value, as Hyperliquid's leaderboard computes it":
    "Прибыль, делённая на стоимость счёта, как её считает лидерборд Hyperliquid",
  Return: "Доходность",
  "Account value": "Стоимость счёта",
  "Holding now": "Держит сейчас",
  "Hyperliquid's own leaderboard, every one of its {ranked} accounts ranked by profit {window}, read {ago}. Hyperliquid is the large perp exchange where every account is public, so any of them opens on its positions, fills and orders. Holdings are the whale tracker's: positions of $100k and up, read within three hours.":
    "Собственный лидерборд Hyperliquid: все его {ranked} счетов, ранжированные по прибыли {window}, прочитано {ago}. Hyperliquid — крупная биржа бессрочных контрактов, где каждый счёт публичен, поэтому любой из них открывается с позициями, исполнениями и ордерами. Позиции взяты из трекера китов: от $100k, прочитаны в пределах трёх часов.",
  "Too little history in this window to draw.":
    "Слишком мало истории в этом окне, чтобы построить график.",
  "Open long": "Открытие лонга",
  "Close long": "Закрытие лонга",
  "Open short": "Открытие шорта",
  "Close short": "Закрытие шорта",
  "Long to short": "Лонг в шорт",
  "Short to long": "Шорт в лонг",
  Buy: "Покупка",
  Sell: "Продажа",
  Limit: "Лимитный",
  "Stop market": "Стоп-маркет",
  "Stop limit": "Стоп-лимит",
  "Take profit market": "Тейк-профит маркет",
  "Take profit limit": "Тейк-профит лимит",
  "reduce only": "только сокращение",
  "position TP/SL": "TP/SL позиции",
  Filled: "Исполнен",
  Canceled: "Отменён",
  Triggered: "Сработал",
  Rejected: "Отклонён",
  "Canceled: margin": "Отменён: маржа",
  "All top traders": "Все топ-трейдеры",
  "#{place} on Hyperliquid's leaderboard by profit {window}.":
    "№{place} в лидерборде Hyperliquid по прибыли {window}.",
  "Hyperliquid is answering too many requests right now. Try again in a minute.":
    "Hyperliquid сейчас получает слишком много запросов. Попробуйте через минуту.",
  "Hyperliquid did not answer for this account right now. Try again in a minute.":
    "Hyperliquid сейчас не ответил по этому счёту. Попробуйте через минуту.",
  "{usd} free to withdraw": "{usd} доступно к выводу",
  "Profit {window}": "Прибыль {window}",
  "{usd} traded": "оборот {usd}",
  "Open positions": "Открытые позиции",
  "{lev}x the account's value": "{lev}x от стоимости счёта",
  "on the open positions": "по открытым позициям",
  "Profit chart window": "Окно графика прибыли",
  "Profit and loss {window}": "Прибыль и убыток {window}",
  "The profit history could not be read right now.": "Сейчас не удалось прочитать историю прибыли.",
  "No open positions.": "Открытых позиций нет.",
  Coin: "Монета",
  "Unrealized profit over the margin the position holds":
    "Нереализованная прибыль, делённая на маржу позиции",
  ROE: "ROE",
  "Liq. price": "Цена ликв.",
  "Funding the position has paid since it opened; a minus is funding received":
    "Фандинг, уплаченный позицией с открытия; минус — полученный фандинг",
  isolated: "изолированная",
  "The positions could not be read right now.": "Сейчас не удалось прочитать позиции.",
  "Resting orders": "Ордера в стакане",
  Placed: "Размещён",
  Trigger: "Триггер",
  "The fills could not be read right now.": "Сейчас не удалось прочитать исполнения.",
  "No fills on record.": "Исполнений нет.",
  "This account was liquidated in this fill": "Этот счёт был ликвидирован в этом исполнении",
  liquidated: "ликвидация",
  "Results by coin": "Результаты по монетам",
  "Orders that filled": "Исполненные ордера",
  Trades: "Сделки",
  "Profit realized by closing, before fees": "Прибыль, реализованная закрытием, до комиссий",
  "Closed P&amp;L": "Реализ. P&amp;L",
  Fees: "Комиссии",
  Direction: "Направление",
  "Size-weighted over the order's fills": "Средневзвешенная по объёму исполнений ордера",
  Fee: "Комиссия",
  "Fills the order took": "Число исполнений ордера",
  "No trades in {coin} among these fills.": "Среди этих исполнений нет сделок по {coin}.",
  "Hyperliquid answers an account's last {n} fills, here from {date}; results by coin are over those fills only. Each trade is one order's fills taken together.":
    "Hyperliquid отдаёт последние {n} исполнений счёта, здесь с {date}; результаты по монетам — только по ним. Каждая сделка — это все исполнения одного ордера вместе.",
  "The order history could not be read right now.": "Сейчас не удалось прочитать историю ордеров.",
  market: "по рынку",
  "No orders on record.": "Ордеров нет.",
  "Hyperliquid answers an account's last {n} orders, each shown once at its latest status.":
    "Hyperliquid отдаёт последние {n} ордеров счёта, каждый показан один раз в последнем статусе.",
  "Hyperliquid throttled part of this read; what is missing says so. Try again in a minute.":
    "Hyperliquid ограничил часть этого запроса; недостающее помечено. Попробуйте через минуту.",
  Positions: "Позиции",
  "Order history": "История ордеров",
  "Read from Hyperliquid {ago}.": "Прочитано из Hyperliquid {ago}.",
  "Top traders, and every order they place": "Топ-трейдеры и каждый их ордер",
  "Hyperliquid's biggest winners over a day, a week, a month or all time, with what they hold now. Open any of them for their positions and liquidation prices, profit over time, and their recent trades and orders, coin by coin.":
    "Самые прибыльные трейдеры Hyperliquid за сутки, неделю, месяц или всё время и то, что они держат сейчас. Откройте любого — позиции и цены ликвидации, прибыль во времени, последние сделки и ордера по каждой монете.",
  "Top traders": "Топ-трейдеры",
  Winners: "Победители",
  "Longs near liquidation": "Лонги у ликвидации",
  "Longs closest to their liquidation price": "Лонги ближе всего к цене ликвидации",
  "Closest first: how far the price has to fall to liquidate each one.":
    "Ближайшие первыми: насколько должна упасть цена, чтобы ликвидировать каждую.",
  "Shorts near liquidation": "Шорты у ликвидации",
  "Shorts closest to their liquidation price": "Шорты ближе всего к цене ликвидации",
  "Closest first: how far the price has to rise to liquidate each one.":
    "Ближайшие первыми: насколько должна вырасти цена, чтобы ликвидировать каждую.",
  "Largest longs": "Крупнейшие лонги",
  "Largest longs that can be liquidated": "Крупнейшие лонги, которые можно ликвидировать",
  "Biggest first, each with the price that would liquidate it.":
    "Крупнейшие первыми, с ценой, которая ликвидирует каждую.",
  "Largest shorts": "Крупнейшие шорты",
  "Largest shorts that can be liquidated": "Крупнейшие шорты, которые можно ликвидировать",
  "The {n} largest of {total}.": "Крупнейшие: {n} из {total}.",
  "Position list": "Список позиций",
  "No long position here has a liquidation price.": "Здесь нет лонгов с ценой ликвидации.",
  "No short position here has a liquidation price.": "Здесь нет шортов с ценой ликвидации.",
  "The odds of reaching each price": "Вероятность достичь каждой цены",
  "{asset}: the odds of reaching each price": "{asset}: вероятность достичь каждой цены",
  "How far the price can plausibly get in 4 hours, 6 hours, a day and a week: the chance it touches each level, sized from its own measured volatility, beside the levels where positions were liquidated and what each liquidation theory reads.":
    "Как далеко цена может зайти за 4 часа, 6 часов, сутки и неделю: вероятность коснуться каждого уровня по её собственной измеренной волатильности, рядом с уровнями, где ликвидировали позиции, и показаниями каждой теории ликвидаций.",
  "Clicked bar": "Выбранный столбец",
  "Positions that liquidate in a bar": "Позиции, ликвидируемые в столбце",
  "Every position in the bar you clicked, longs and shorts, largest first.":
    "Все позиции выбранного столбца, лонги и шорты, по убыванию размера.",
  "No tracked position liquidates in this bar.":
    "Ни одна отслеживаемая позиция не ликвидируется в этом столбце.",
  "Click a bar on the map above to list every position that liquidates in it.":
    "Нажмите столбец на карте выше, чтобы увидеть все позиции, которые ликвидируются в его диапазоне.",
  "Positions that liquidate between {low} and {high}": "Позиции с ликвидацией от {low} до {high}",
  "click one to list its positions below": "нажмите столбец, чтобы увидеть его позиции ниже",
  // The Longs vs shorts tab's positioning strip.
  "{low}% to {high}%": "от {low}% до {high}%",
  "{venue}: share of all accounts net long": "{venue}: доля всех счетов в чистом лонге",
  "{venue}: share of the top traders' position size held long":
    "{venue}: доля объёма позиций топ-трейдеров в лонге",
  "{venue}: share of the top traders' accounts net long":
    "{venue}: доля счетов топ-трейдеров в чистом лонге",
  "{venue}: share of the last hour's taker volume that bought, on average":
    "{venue}: средняя доля тейкерского объёма за последний час, пришедшаяся на покупки",
  "{asset} positioning": "Позиционирование {asset}",
  "{asset} positioning: the share long on each exchange":
    "Позиционирование {asset}: доля лонгов на каждой бирже",
  "newest {time}": "данные на {time}",
  "All accounts": "Все счета",
  "Top traders' positions": "Позиции топ-трейдеров",
  "Top traders' accounts": "Счета топ-трейдеров",
  "Taker buys": "Покупки тейкеров",
  "all accounts": "все счета",
  "top positions": "топ-позиции",
  "Each exchange's own published statistics, read every 15 minutes. All accounts counts every account once, so it reads the crowd. Top traders are each exchange's own group (Binance: the top 20% by margin), by position size and by accounts. Taker buys is the share of taker volume that bought, averaged over the last hour. A dash is a figure the exchange does not publish.":
    "Собственная опубликованная статистика каждой биржи, читается каждые 15 минут. «Все счета» считает каждый счёт один раз и поэтому показывает толпу. Топ-трейдеры — группа, которую определяет сама биржа (Binance: верхние 20% по марже), по объёму позиций и по счетам. «Покупки тейкеров» — средняя доля тейкерского объёма за последний час, пришедшаяся на покупки. Прочерк — показатель, который биржа не публикует.",
};
