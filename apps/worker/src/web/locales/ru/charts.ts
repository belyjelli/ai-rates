/**
 * Russian for the chart pages and their readouts: web/cvd.ts, web/kchart.ts, web/sentiment.ts,
 * web/funding-chart.ts and web/slot-chart.ts (web/rail.ts has no words of its own). Glossary and
 * style: ./index.ts.
 *
 * Terms: cumulative volume delta кумулятивная дельта объёма (CVD left as written), taker flow поток
 * тейкеров, net нетто, bar бар, candle свеча, divergence дивергенция, crosshair перекрестие, window
 * окно. Dates put the day first, as Russian does ("16 окт"), with short genitive month names.
 *
 * Keys shared with the liquidations part (months, dates, "Window", the hover hints) carry the same
 * translation there, which i18n.test.ts holds.
 */

import type { Catalog } from "../../i18n";

export const charts: Catalog = {
  // Dates on the axes and in the hover readouts; the month names are marked in web/slot-chart.ts.
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
  "{month} {day} {time} {zone}": "{day} {month} {time} {zone}",

  // web/slot-chart.ts: the hover readouts of the CVD and longs-vs-shorts charts.
  "{low} – {high} ({pct} from the mark)": "{low} – {high} ({pct} от цены маркировки)",
  "longs liquidate here: {usd} ({n})": "здесь ликвидируются лонги: {usd} ({n})",
  "shorts liquidate here: {usd} ({n})": "здесь ликвидируются шорты: {usd} ({n})",
  "{n} position": "{n} позиция",
  "no whale liquidates here": "здесь не ликвидируется ни один кит",
  "{usd} of longs liquidate between here and the mark":
    "между этим уровнем и ценой маркировки ликвидируется лонгов на {usd}",
  "{usd} of shorts liquidate between the mark and here":
    "между ценой маркировки и этим уровнем ликвидируется шортов на {usd}",
  Cursor: "Курсор",
  cursor: "курсор",
  bar: "бар",
  cross: "кросс",
  "Light up the bar under the pointer": "Подсвечивать бар под указателем",
  "Dashed crosshair at the pointer, with the value there on each axis":
    "Пунктирное перекрестие у указателя со значениями на обеих осях",
  "no flow recorded": "поток не записан",
  "close {price}": "закрытие {price}",
  "close {price} ({pct} since start)": "закрытие {price} ({pct} с начала окна)",
  "bought {usd}": "куплено {usd}",
  "sold {usd}": "продано {usd}",
  "net {net}": "нетто {net}",
  "net {net} ({pct} of volume)": "нетто {net} ({pct} объёма)",
  "nothing force-closed": "принудительных закрытий нет",
  "longs closed {usd}": "ликвидации лонгов {usd}",
  "shorts closed {usd}": "ликвидации шортов {usd}",
  "longs − shorts {diff}": "лонги − шорты {diff}",
  even: "поровну",
  "longs heavier, {pct}%": "перевес лонгов, {pct}%",
  "shorts heavier, {pct}%": "перевес шортов, {pct}%",
  "{n} liquidation": "{n} ликвидация",
  "{n} liquidations": "ликвидаций: {n}",
  "{when} (still filling)": "{when} (ещё набирается)",

  // web/cvd.ts: the chart.
  "{asset} · cumulative volume delta · {n}-hour bars, {zone}":
    "{asset} · кумулятивная дельта объёма · бары по {n} ч, {zone}",
  "{asset} · cumulative volume delta · {n}-minute bars, {zone}":
    "{asset} · кумулятивная дельта объёма · бары по {n} мин, {zone}",
  "{asset} futures taker CVD, last {window}: {cvd}. Market buyers {bought} vs sellers {sold}.":
    "CVD тейкеров фьючерсов по {asset} за {window}: {cvd}. Рыночные покупатели {bought}, продавцы {sold}.",
  "{asset}, last {window}: futures CVD {futures}, Binance spot CVD {spot}, delta {delta}.":
    "{asset} за {window}: CVD фьючерсов {futures}, CVD спота Binance {spot}, дельта {delta}.",
  "Last {window}": "За {window}",
  "Loading {interval} bars…": "Загрузка баров {interval}…",
  "Loading {asset}…": "Загрузка {asset}…",
  "Not available yet: there is not enough history for {interval} bars":
    "Пока недоступно: истории не хватает для баров {interval}",
  "Not available yet": "Пока недоступно",
  Price: "Цена",
  "Net buy": "Нетто-покупки",
  "Net sell": "Нетто-продажи",
  "hover or tap a bar to read it": "наведите или нажмите на бар, чтобы увидеть значение",
  "{asset} bars; arrow keys read one at a time": "Бары {asset}; стрелки читают по одному",
  "{asset} price and cumulative volume delta over the last {window}":
    "Цена {asset} и кумулятивная дельта объёма за {window}",
  "{asset} net taker flow per bar": "Нетто-поток тейкеров {asset} по барам",

  // web/cvd.ts: tiles, controls and the screener table.
  Volume: "Объём",
  CVD: "CVD",
  "CVD / volume": "CVD / объём",
  Change: "Изменение",
  "CVD breadth": "Ширина CVD",
  "of {n} assets with net taker buying": "активов с нетто-покупками тейкеров (всего: {n})",
  "Bullish divergences": "Бычьи дивергенции",
  "price down ≥{price}%, takers net buying ≥{flow}% of volume":
    "цена упала на ≥{price}%, нетто-покупки тейкеров ≥{flow}% объёма",
  "Bearish divergences": "Медвежьи дивергенции",
  "price up ≥{price}%, takers net selling ≥{flow}% of volume":
    "цена выросла на ≥{price}%, нетто-продажи тейкеров ≥{flow}% объёма",
  "Top CVD flows": "Крупнейшие потоки CVD",
  "largest net buy / net sell": "крупнейшие нетто-покупки / нетто-продажи",
  Window: "Период",
  "bullish div": "бычья див.",
  "bearish div": "медвежья див.",
  "Search symbol": "Поиск тикера",
  Find: "Найти",
  "Pick an asset to chart": "Выберите актив для графика",
  "{n} assets": "активов: {n}",
  "No asset matches.": "Нет подходящих активов.",
  "No taker flow has been collected in the last {window}. Collection polls each venue every five minutes; a new deployment backfills about a week within its first hour.":
    "За {window} поток тейкеров не собран. Сборщик опрашивает каждую биржу раз в пять минут; новое развёртывание за первый час догружает около недели истории.",
  Asset: "Актив",
  "Reference market's first close to last close in the window":
    "От первого до последнего закрытия опорного рынка в окне",
  "Taker buys less taker sells, in dollars, summed over the polled venues":
    "Покупки тейкеров минус продажи тейкеров в долларах, сумма по опрашиваемым биржам",
  "CVD as a share of the window's taker volume": "CVD как доля объёма тейкеров за окно",
  "Taker buys plus taker sells, in dollars": "Покупки плюс продажи тейкеров в долларах",
  "Polled venues with flow for this asset": "Опрашиваемые биржи с потоком по этому активу",
  Venues: "Биржи",
  "Price and flow disagreeing by more than the divergence thresholds in the tiles":
    "Цена и поток расходятся сильнее порогов дивергенции, указанных в плашках",
  Signal: "Сигнал",
  "No live market lists {asset}, so there is no flow to chart.":
    "Ни один действующий рынок не торгует {asset}, поэтому потока для графика нет.",
  "Newest bucket {age}.": "Последний интервал — {age}.",
  "Venues publish each 5-minute bucket after it closes, so the right edge runs a few minutes behind.":
    "Биржи публикуют каждый 5-минутный интервал после его закрытия, поэтому правый край графика отстаёт на несколько минут.",

  // web/cvd.ts: the page.
  "taker buys": "покупки тейкеров",
  "taker sells": "продажи тейкеров",
  "The asset button beside the intervals opens the screener: every polled asset's taker flow over the window. Pick one to chart it, find a ticker in its box, or sort by a heading. Change is the busiest polled market's first to last close in the window. History is uneven by venue: Binance and Gate publish weeks of it and OKX five days, so the oldest bars of a new 7-day window sum fewer venues.":
    "Кнопка актива рядом с интервалами открывает скринер: поток тейкеров за окно по каждому опрашиваемому активу. Выберите актив, чтобы построить его график, найдите тикер в поле поиска или отсортируйте по заголовку. Изменение — от первого до последнего закрытия самого активного из опрашиваемых рынков в окне. Глубина истории у бирж разная: Binance и Gate публикуют её за несколько недель, OKX — за пять дней, поэтому самые старые бары нового 7-дневного окна суммируют меньше бирж.",

  // web/funding-chart.ts
  "The funding chart is unavailable right now. The backtest below is unaffected.":
    "График фандинга сейчас недоступен. Бэктест ниже работает как обычно.",
  "No stored funding for this window yet.": "Для этого окна сохранённого фандинга пока нет.",
  Spread: "Спред",
  "Funding by exchange, annualized · hourly": "Фандинг по биржам, годовых · по часам",
  "Funding by exchange, annualized · daily": "Фандинг по биржам, годовых · по дням",
  "Funding APR by exchange over the window": "Фандинг (APR) по биржам за окно",
  "Hover the chart to read every visible line at one moment.":
    "Наведите на график, чтобы прочитать все видимые линии в один момент.",
  "Signed log scale, so ordinary rates keep room beside extreme ones. Each line holds a rate until that exchange's next settlement; a break is time with no recorded funding, not a zero.":
    "Логарифмическая шкала со знаком, чтобы обычным ставкам хватало места рядом с экстремальными. Каждая линия держит ставку до следующей выплаты на своей бирже; разрыв — время без записанного фандинга, а не ноль.",

  // web/sentiment.ts
  "No readings yet in this window.": "В этом окне пока нет показаний.",
  "Fear & greed: {score}, {label}": "Страх и жадность: {score}, {label}",
  "Fear and greed score reaches {score} ({label})":
    "Индекс страха и жадности достигает {score} ({label})",
  "{n} readings, every 30 minutes · {age} to now":
    "показаний: {n}, раз в 30 минут · первое — {age}",
  "no data in window": "нет данных в окне",
  "Fear &amp; greed · updated {ago}": "Страх и жадность · обновлено {ago}",
  "Fear &amp; greed": "Страх и жадность",
  component: "компонент",
  reading: "значение",
  "percentile (30d, greed direction)": "перцентиль (30 д, в сторону жадности)",
  "funding (OI-weighted APR)": "фандинг (APR, взвешенный по OI)",
  "open interest": "открытый интерес",
  "liquidation skew (24h)": "перекос ликвидаций (24 ч)",
  "{pct} long-heavy": "{pct} с перевесом лонгов",
  "taker flow (24h)": "поток тейкеров (24 ч)",
  "{pct} net buy": "{pct} нетто-покупки",
  "Score is the mean of four components, each a percentile rank against this book's own trailing 30-day history — not a fixed scale, so the same raw number reads differently in a quiet stretch than a volatile one. <b>Funding</b> and <b>open interest</b> run high-is-greedy (crowded, levered longs paying to hold). <b>Liquidation skew</b> is inverted before averaging: a book where longs are being forced out is fear, however unusual that reading looks against its own history. <b>Taker flow</b> is net aggressive buying over aggressive selling, last 24h. Computed every 30 minutes by the collector (belyjelli/profitlock-worker, <code>collector rank-eval</code>'s sibling <code>market sentiment</code> job); coverage for liquidations and taker flow is not venue-complete, so this is a proxy, not a market-wide guarantee.":
    "Индекс — среднее четырёх компонентов, каждый из которых — перцентильный ранг относительно собственной истории этого рынка за последние 30 дней. Это не фиксированная шкала, поэтому одно и то же исходное число в спокойный период читается иначе, чем в волатильный. Для <b>фандинга</b> и <b>открытого интереса</b> чем выше, тем больше жадности (скученные лонги с плечом платят за удержание позиции). <b>Перекос ликвидаций</b> перед усреднением инвертируется: рынок, где лонги принудительно выбивает, — это страх, как бы необычно ни выглядело это значение на фоне собственной истории. <b>Поток тейкеров</b> — перевес агрессивных покупок над агрессивными продажами за последние 24 ч. Считается сборщиком каждые 30 минут (belyjelli/profitlock-worker, задача <code>market sentiment</code>, соседняя с <code>collector rank-eval</code>); ликвидации и поток тейкеров собираются не со всех бирж, поэтому это приближённый показатель, а не гарантия по всему рынку.",
  "Fear & Greed": "Страх и жадность",
  "A funding-market fear and greed score: OI-weighted funding, open interest, liquidation skew and taker flow, each ranked against its own 30-day history.":
    "Индекс страха и жадности рынка фандинга: фандинг, взвешенный по OI, открытый интерес, перекос ликвидаций и поток тейкеров, каждый ранжирован относительно своей истории за 30 дней.",
  "{month} {day} {time}–{end} {zone}": "{day} {month} {time}–{end} {zone}",
  "close, {market}": "закрытие, {market}",
  "open {open} · high {high} · low {low} · close {close}":
    "откр. {open} · макс. {high} · мин. {low} · закр. {close}",
  "volume {usd}": "объём {usd}",
  "large taker buys {usd} ({n})": "крупные покупки тейкеров {usd} ({n})",
  "large taker sells {usd} ({n})": "крупные продажи тейкеров {usd} ({n})",
  "no candle": "нет свечи",
  "{month} {day} {hours} {zone}": "{day} {month} {hours} {zone}",
  "{hours} {zone}": "{hours} {zone}",

  // web/kchart.ts: the trading chart on /cvd.
  "Loading older bars…": "Загрузка более ранних баров…",
  "Nothing older: taker flow is kept for {days} days.":
    "Раньше ничего нет: поток тейкеров хранится {days} дн.",
  "Older bars did not load. Drag again to retry.":
    "Более ранние бары не загрузились. Потяните ещё раз, чтобы повторить.",
  "drag to look back · wheel or pinch to zoom · hover a candle to read it":
    "тяните, чтобы смотреть назад · колесо или щипок — масштаб · наведите на свечу, чтобы прочитать",
  "Futures CVD": "CVD фьючерсов",
  "Spot CVD": "CVD спота",
  "Delta buy": "Дельта: покупки",
  "Delta sell": "Дельта: продажи",
  "{asset} delta per bar, spot and futures net taker flow summed":
    "Дельта {asset} по барам: сумма нетто-потоков тейкеров спота и фьючерсов",
  "No taker flow for {asset} in the last {window}. Only the ~500 assets deepest on {venues} are polled; pick one from the asset list above.":
    "За {window} потока тейкеров по {asset} нет. Опрашиваются только ~500 самых ликвидных активов на {venues}; выберите актив из списка выше.",
  "Price with cumulative volume delta under it: spot and futures taker buying against taker selling, their combined delta per bar, and where price and order flow disagree.":
    "Цена и под ней кумулятивная дельта объёма: покупки тейкеров против продаж на споте и фьючерсах, их общая дельта по барам и места, где цена и поток ордеров расходятся.",
  "Price, with cumulative volume delta (CVD) under it: {buys} less {sells}, in dollars. Futures CVD is the exchanges' own 5-minute taker statistics for their perpetuals from <b>{venues}</b>, summed, for the ~500 assets deepest on them and every commodity, index and currency pair they list — not every venue, and nothing finer than five minutes. A divergence marks a window where price and flow pointed opposite ways; it describes what happened, not what happens next.":
    "Цена, а под ней кумулятивная дельта объёма (CVD): {buys} минус {sells}, в долларах. CVD фьючерсов — собственная 5-минутная статистика тейкеров по бессрочным фьючерсам бирж <b>{venues}</b>, просуммированная по ~500 самым ликвидным на них активам и всем товарам, индексам и валютным парам, которые там торгуются, — не все биржи и ничего детальнее пяти минут. Дивергенция отмечает окно, в котором цена и поток шли в разные стороны; она описывает то, что произошло, а не то, что будет дальше.",
  "Spot CVD is Binance's USDT spot book alone, for the crypto assets it lists; stocks, commodities and indices have no spot book on a crypto exchange and show futures only. Spot and futures each have a pane, because their sizes differ by an order of magnitude on most assets. The histogram under them is the delta: each bar's spot and futures net summed.":
    "CVD спота — только спотовая книга USDT на Binance, для криптоактивов, которые там торгуются; у акций, товаров и индексов нет спотовой книги на криптобирже, и для них показаны только фьючерсы. У спота и фьючерсов по отдельной панели, потому что на большинстве активов их объёмы различаются на порядок. Гистограмма под ними — дельта: сумма нетто спота и фьючерсов за каждый бар.",
  "Price is the busiest polled market's own candle. Each pane has its own scale, so where lines cross means nothing. Drag to look back, wheel or pinch to zoom, and hover a candle to read it in the line above the chart; on a phone, tap.":
    "Цена — собственные свечи самого активного из опрашиваемых рынков. У каждой панели своя шкала, поэтому пересечение линий ничего не значит. Перетащите, чтобы заглянуть в прошлое, колесом или щипком меняйте масштаб, наведите на свечу, чтобы прочитать её в строке над графиком; на телефоне нажмите.",
  "futures net {net}": "нетто фьючерсов {net}",
  "spot net {net}": "нетто спота {net}",
  "delta {net}": "дельта {net}",
  "delta {net} ({pct} of volume)": "дельта {net} ({pct} объёма)",
  "CVD futures {futures}, spot {spot}": "CVD: фьючерсы {futures}, спот {spot}",
  Open: "Открытие",
  High: "Максимум",
  Low: "Минимум",
  Futures: "Фьючерсы",
  "Spot (Binance)": "Спот (Binance)",
};
