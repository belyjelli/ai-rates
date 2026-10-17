import type { Catalog } from "../../i18n";

/**
 * The Exchanges page's trading-cost grade and one exchange's costs on its own page (web/exchanges.ts,
 * web/exchange-grade.ts). Glossary and style: ./index.ts.
 *
 * Terms: grade оценка (the letters S, A, B, C, D stay), score балл, cost to trade $10k затраты на
 * $10k, market order рыночная заявка, all in со всеми расходами, mid середина спреда, beyond the mid
 * сверх середины спреда, taker fee тейкер-комиссия, depth глубина, resting выставленный (в стакане),
 * credited засчитано, basket корзина (its mix: по весам корзины), majors крупнейшие активы, snapshot
 * снимок, samples замеры, book reach охват стакана, fill исполнение, markout маркаут, execution /
 * liquidity / activity исполнение / ликвидность / активность. bp is written bps, as "{n} bp" is.
 */
export const exchanges: Catalog = {
  "score {score}: execution {execution}, liquidity {liquidity}, activity {activity}":
    "балл {score}: исполнение {execution}, ликвидность {liquidity}, активность {activity}",
  "fee {fee}{mark}": "комиссия {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "Стаканов корзины, где заявка на $100k обычно не исполнялась: {n}; каждый считается за {bps} bps",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, or 2% of the exchange's daily volume, is not counted":
    "Оценка засчитывает из неё {usd}: глубина сверх десятой части открытого интереса рынка или 2% дневного объёма биржи не учитывается",
  "{n} of {total} assets": "активов: {n} из {total}",
  "Not measured: its order book is not read yet": "Не измерено: стакан биржи пока не читается",
  "across {n} exchanges reporting now": "бирж с актуальными данными: {n}",
  "as each exchange reports it": "по данным каждой биржи",
  "Cheapest $10k": "Минимум затрат на $10k",
  "{venue}: taker fee and slippage, the basket's mix":
    "{venue}: тейкер-комиссия и проскальзывание, по весам корзины",
  "no book measured yet": "стаканы ещё не измерены",
  "Deepest books": "Самые глубокие стаканы",
  "{venue}: credited within 0.1% of the mid, 12 majors":
    "{venue}: засчитано в пределах 0.1% от середины спреда, 12 крупнейших активов",
  Grade: "Оценка",
  "This site's grade from its own measurements: S, A, B, C, D":
    "Оценка сайта по его собственным замерам: S, A, B, C, D",
  "Cost to trade $10k": "Затраты на $10k",
  "A $10k market order all in: the published standard taker fee plus what the book makes it pay beyond the mid":
    "Рыночная заявка на $10k со всеми расходами: опубликованная стандартная тейкер-комиссия плюс то, что стакан заставляет доплатить сверх середины спреда",
  Slippage: "Проскальзывание",
  "What a $10k and a $100k market order pay beyond the mid, from the book, before fees":
    "Сколько рыночные заявки на $10k и $100k доплачивают сверх середины спреда по стакану, до комиссий",
  "The gap between the best bid and ask, basis points of the mid":
    "Разрыв между лучшим бидом и аском в базисных пунктах от середины между ними",
  Depth: "Глубина",
  "Dollars resting within 0.1% and within 1% of the mid on both sides, the basket's books added up, as each exchange's public book shows them":
    "Объём в долларах, выставленный в пределах 0.1% и 1% от середины спреда с обеих сторон, сумма по стаканам корзины — как его показывает публичный стакан каждой биржи",
  "Summed over the exchange's perpetual markets, as it reports them":
    "Сумма по бессрочным рынкам биржи, по её собственным данным",
  "Live perpetual markets": "Активные бессрочные рынки",
  "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.":
    "Все биржи бессрочных фьючерсов, которые собирает сайт, ранжированы по стоимости торговли на них. Затраты берутся из публичного стакана каждой биржи, который читается каждые десять минут по двенадцати крупнейшим активам (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); каждая цифра — медиана за последние семь дней.",
  "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.":
    "Затраты на $10k — это рыночная заявка на $10k со всеми расходами: опубликованная стандартная тейкер-комиссия биржи (VIP-уровни, токены для оплаты комиссий и ребейты её снижают) плюс то, что стакан заставляет заявку доплатить сверх середины спреда, включая половину спреда. Проскальзывание — только эта вторая часть, на $10k и $100k. Вес каждого актива — его открытый интерес по всем биржам, поэтому все биржи оцениваются на одной и той же корзине.",
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that, and the grade credits a market's depth up to a tenth of its open interest and an exchange's up to 2% of its daily volume: displayed size beyond that rarely fills.":
    "Глубина — это объём в долларах, выставленный в пределах 0.1% и 1% от середины спреда, как его показывает публичный стакан каждой биржи. Биржи публикуют ограниченное число уровней (у Binance они доходят примерно до 0.15% вокруг BTC), поэтому цифра для 1% — нижняя граница, а в оценке используется цифра для 0.1%, до которой доходит каждый измеренный стакан. Отдельный уровень больше 5% открытого интереса рынка учитывается только до этой величины, а оценка засчитывает глубину рынка не больше десятой части его открытого интереса и глубину биржи не больше 2% её дневного объёма: показанный объём сверх этого редко исполняется.",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade is this site's: half execution (cost and $100k slippage against the cheapest), three tenths liquidity (credited depth within 0.1% against the deepest), a fifth activity (open interest, and volume up to five times it). S from 85, A from 70, B from 55, C from 40, D below.":
    "Это обещания стаканов, а не исполнения: сделки не измеряются, поэтому маркауты (куда идёт цена после исполнения) не показаны. Оценка — собственная оценка сайта: половина — исполнение (затраты и проскальзывание на $100k относительно самой дешёвой биржи), три десятых — ликвидность (засчитанная глубина в пределах 0.1% относительно самой глубокой), пятая часть — активность (открытый интерес и объём, но не больше пятикратного открытого интереса). S — от 85, A — от 70, B — от 55, C — от 40, D — ниже.",
  "Every perpetual futures exchange tracked by airrates, graded on what trading there costs: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "Все биржи бессрочных фьючерсов, которые отслеживает airrates, с оценкой стоимости торговли: тейкер-комиссия и проскальзывание на $10k и $100k, глубина, открытый интерес и объём.",
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "Стаканы измеряются с {date}; цифры — медианы за последние семь дней.",
  "Order books are not measured yet.": "Стаканы пока не измерены.",
  "* No published taker fee found for {venues}: the site's default of {bps} bp is used.":
    "* Для {venues} опубликованная тейкер-комиссия не найдена: используется значение сайта по умолчанию, {bps} bps.",
  "Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.":
    "Без оценки: биржи, чей стакан пока не читается. Пока не собираются: {venues}.",
  "not listed": "нет в листинге",
  "$100k did not fill in most snapshots": "Заявка на $100k не исполнялась в большинстве снимков",
  "did not fill": "не исполнено",
  "{pct}%": "{pct}%",
  "Trading cost": "Торговые затраты",
  "{value} to trade $10k": "затраты на $10k: {value}",
  "taker fee {fee}{mark}": "тейкер-комиссия {fee}{mark}",
  "{value} slippage at $100k": "проскальзывание на $100k: {value}",
  "{value} within 0.1%": "глубина в пределах 0.1%: {value}",
  "What a $10k market order pays beyond the mid, before fees":
    "Сколько рыночная заявка на $10k доплачивает сверх середины спреда, до комиссий",
  "$10k slippage": "Проскальзывание $10k",
  "What a $100k market order pays beyond the mid, before fees":
    "Сколько рыночная заявка на $100k доплачивает сверх середины спреда, до комиссий",
  "$100k slippage": "Проскальзывание $100k",
  "Depth ±0.1%": "Глубина ±0.1%",
  "Depth ±1%": "Глубина ±1%",
  "How far from the mid the published book reached":
    "Как далеко от середины спреда доходил опубликованный стакан",
  "Book reach": "Охват стакана",
  "Snapshots in the last seven days": "Снимки за последние семь дней",
  Samples: "Замеры",
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. How the grade is built: the Exchanges page.":
    "Медианы за последние семь дней по снимкам публичного стакана {venue} каждые десять минут; затраты — по стакану, а не по исполнениям. Как строится оценка — на странице «Биржи».",
};
