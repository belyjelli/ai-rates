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
 * DefiLlama's REAL score балл REAL от DefiLlama (after it: по образцу), reserves резервы, wallets
 * кошельки (tracked on-chain: отслеживаемые ончейн), clean чистые (без собственного токена биржи),
 * collateral залог (protocol collateral: залог протокола), pillar составляющая, breadth широта,
 * "{n} points" (a pillar's weight) баллов: {n}, n/a н/д, breakdown расшифровка, CEX / DEX stay
 * Latin, "#{rank} of {of} CEXs" №{rank} из {of} CEX.
 */
export const exchanges: Catalog = {
  // the grade's breakdown card
  Reserves: "Резервы",
  Execution: "Исполнение",
  Activity: "Активность",
  Liquidity: "Ликвидность",
  "not measured": "не измерено",
  "no wallets published": "кошельки не опубликованы",
  "collateral not identified: the DEXes' median": "залог не определён: медиана DEX",
  "{clean} clean of {total} in tracked wallets":
    "чистыми {clean} из {total} в отслеживаемых кошельках",
  "{usd} protocol collateral": "залог протокола: {usd}",
  "{cost} to trade $10k, {slip} slippage at $100k":
    "затраты на $10k: {cost}, проскальзывание на $100k: {slip}",
  "{volume} volume; no open interest published": "объём: {volume}; открытый интерес не публикуется",
  "{oi} open interest, {volume} volume": "открытый интерес: {oi}, объём: {volume}",
  "{usd} credited within 0.1%; {n} of {total} markets hold $100k":
    "засчитано в пределах 0.1%: {usd}; рынков с глубиной от $100k: {n} из {total}",
  "#{rank} of {of} CEXs": "№{rank} из {of} CEX",
  "#{rank} of {of} DEXs": "№{rank} из {of} DEX",
  "n/a": "н/д",
  "Built from this site's own reading of the order books and DefiLlama's reserves. n/a never counts as zero; its weight goes to the others. S from 85, A 70, B 55, C 40, else D.":
    "Оценка строится по стаканам, которые читает сам сайт, и по резервам из DefiLlama. Составляющая с «н/д» никогда не считается нулём: её вес переходит к остальным. S — от 85, A — от 70, B — от 55, C — от 40, иначе D.",
  "Grade {grade}, score {score}: the breakdown": "Оценка {grade}, балл {score}: расшифровка",
  // the grade in the table
  "fee {fee}{mark}": "комиссия {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "Стаканов корзины, где заявка на $100k обычно не исполнялась: {n}; каждый считается за {bps} bps",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, 2% of the exchange's daily volume or 5% of its clean reserves is not counted":
    "Оценка засчитывает из неё {usd}: глубина сверх десятой части открытого интереса рынка, 2% дневного объёма биржи или 5% её чистых резервов не учитывается",
  "{n} of {total} assets": "активов: {n} из {total}",
  "Not measured: its order book is not read yet": "Не измерено: стакан биржи пока не читается",
  "clean, of {total} in wallets": "чистыми, из {total} в кошельках",
  collateral: "залог",
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
  "This site's grade after DefiLlama's REAL score: reserves, execution, activity and liquidity. A grade opens its breakdown":
    "Оценка сайта по образцу балла REAL от DefiLlama: резервы, исполнение, активность и ликвидность. По нажатию на оценку открывается её расшифровка",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain without its own token, a DEX's protocol collateral":
    "Что держит биржа, по данным DefiLlama: у CEX — кошельки, отслеживаемые ончейн, без её собственного токена, у DEX — залог протокола",
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
  // the page's help panel
  "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.":
    "Все биржи бессрочных фьючерсов, которые собирает сайт, ранжированы по стоимости торговли на них. Затраты берутся из публичного стакана каждой биржи, который читается каждые десять минут по двенадцати крупнейшим активам (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); каждая цифра — медиана за последние семь дней.",
  "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.":
    "Затраты на $10k — это рыночная заявка на $10k со всеми расходами: опубликованная стандартная тейкер-комиссия биржи (VIP-уровни, токены для оплаты комиссий и ребейты её снижают) плюс то, что стакан заставляет заявку доплатить сверх середины спреда, включая половину спреда. Проскальзывание — только эта вторая часть, на $10k и $100k. Вес каждого актива — его открытый интерес по всем биржам, поэтому все биржи оцениваются на одной и той же корзине.",
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that.":
    "Глубина — это объём в долларах, выставленный в пределах 0.1% и 1% от середины спреда, как его показывает публичный стакан каждой биржи. Биржи публикуют ограниченное число уровней (у Binance они доходят примерно до 0.15% вокруг BTC), поэтому цифра для 1% — нижняя граница, а в оценке используется цифра для 0.1%, до которой доходит каждый измеренный стакан. Отдельный уровень больше 5% открытого интереса рынка учитывается только до этой величины.",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade follows DefiLlama's REAL score: reserves 30, execution 30, activity 20, liquidity 20. A grade opens its breakdown; how each pillar is built is under the table.":
    "Это обещания стаканов, а не исполнения: сделки не измеряются, поэтому маркауты (куда идёт цена после исполнения) не показаны. Оценка следует баллу REAL от DefiLlama: резервы 30, исполнение 30, активность 20, ликвидность 20. По нажатию на оценку открывается её расшифровка; как строится каждая составляющая — под таблицей.",
  "Every perpetual futures exchange tracked by airrates, graded on reserves, trading cost, activity and liquidity: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "Все биржи бессрочных фьючерсов, которые отслеживает airrates, с оценкой по резервам, торговым затратам, активности и ликвидности: тейкер-комиссия и проскальзывание на $10k и $100k, глубина, открытый интерес и объём.",
  // the notes under the table
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "Стаканы измеряются с {date}; цифры — медианы за последние семь дней.",
  "Order books are not measured yet.": "Стаканы пока не измерены.",
  "Reserves: DefiLlama, read every six hours.": "Резервы: DefiLlama, читаются каждые шесть часов.",
  "Reserves are not available right now; the grade goes on without them.":
    "Резервы сейчас недоступны; оценка строится без них.",
  "* No published taker fee found for {venues}: the site's default of {bps} bp is used.":
    "* Для {venues} опубликованная тейкер-комиссия не найдена: используется значение сайта по умолчанию, {bps} bps.",
  "Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.":
    "Без оценки: биржи, чей стакан пока не читается. Пока не собираются: {venues}.",
  // how the grade is built
  "How the grade is built": "Как строится оценка",
  "{n} points": "баллов: {n}",
  "After DefiLlama's REAL score: a weighted mean of four pillars, each 0 to 100. Sizes are on a log scale, so an exchange a tenth the size of the leader still scores about 70. A pillar this site cannot measure for an exchange hands its weight to the others and never counts as zero. CEXes and DEXes are scored together and ranked within their own kind. Fixed bands, so a new exchange does not reshuffle the rest: S from 85, A from 70, B from 55, C from 40, D below.":
    "По образцу балла REAL от DefiLlama: взвешенное среднее четырёх составляющих, каждая от 0 до 100. Размеры берутся в логарифмической шкале, поэтому биржа в десять раз меньше лидера всё равно получает около 70. Составляющая, которую сайт не может измерить для биржи, передаёт свой вес остальным и никогда не считается нулём. CEX и DEX оцениваются вместе, а места распределяются внутри каждого типа. Границы фиксированы, поэтому новая биржа не перетасовывает остальные: S — от 85, A — от 70, B — от 55, C — от 40, D — ниже.",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain, without its own token; a DEX's protocol collateral, a floor, since market makers' money can sit elsewhere. Two thirds is size against the largest; one third is whether its open interest, a day's volume and the book it shows within 1% are sizes it could back, and how much of it is its own token. A CEX publishing no wallets scores 0; a DEX whose collateral is not identified scores the DEXes' median.":
    "Что держит биржа, по данным DefiLlama: у CEX — кошельки, отслеживаемые ончейн, без её собственного токена; у DEX — залог протокола, и это нижняя граница, так как средства маркет-мейкеров могут лежать в другом месте. Две трети — размер относительно крупнейшей биржи; треть — хватает ли резервов, чтобы покрыть её открытый интерес, дневной объём и стакан, который она показывает в пределах 1%, и какая их доля приходится на её собственный токен. CEX, не публикующая кошельки, получает 0; DEX с неопределённым залогом получает медиану по DEX.",
  "What a market order costs, from each exchange's book every ten minutes over seven days: $10k all in (the published standard taker fee and the walk through the book), and what $10k and $100k pay beyond the mid, each against the cheapest exchange. DefiLlama also scores markouts and fills against the quote; those need trades, which this site does not record, so their weight goes to cost and slippage.":
    "Сколько стоит рыночная заявка — по стакану каждой биржи каждые десять минут за семь дней: $10k со всеми расходами (опубликованная стандартная тейкер-комиссия и проход по стакану) и то, сколько $10k и $100k доплачивают сверх середины спреда, — всё относительно самой дешёвой биржи. DefiLlama также оценивает маркауты и исполнение относительно котировки; для них нужны сделки, которые сайт не записывает, поэтому их вес переходит к затратам и проскальзыванию.",
  "Open interest, credited up to three times clean reserves, and a day's volume, credited up to five times open interest, each against the leader. An exchange that publishes no open interest is scored on volume alone, credited up to three times clean reserves.":
    "Открытый интерес, засчитанный не больше трёхкратных чистых резервов, и дневной объём, засчитанный не больше пятикратного открытого интереса, — оба относительно лидера. Биржа, не публикующая открытый интерес, оценивается только по объёму, засчитанному не больше трёхкратных чистых резервов.",
  "Depth within 0.1% of the mid across the twelve majors, credited up to a tenth of each market's open interest, 2% of the exchange's daily volume and 5% of its clean reserves; and breadth, how many of the twelve hold $100k within 0.1%. Halved for a CEX publishing no reserves.":
    "Глубина в пределах 0.1% от середины спреда по двенадцати крупнейшим активам, засчитанная не больше десятой части открытого интереса каждого рынка, 2% дневного объёма биржи и 5% её чистых резервов; и широта — у скольких из двенадцати глубина в пределах 0.1% достигает $100k. Для CEX, не публикующей резервы, составляющая делится пополам.",
  "These are this site's grades by DefiLlama's method, not DefiLlama's scores. What exchanges report about themselves counts only as far as it can be checked: open interest up to three times reserves, volume up to five times open interest. Reputation, age, brand and listings count not at all.":
    "Это оценки сайта по методике DefiLlama, а не баллы DefiLlama. То, что биржи сообщают о себе сами, учитывается лишь в той мере, в какой это можно проверить: открытый интерес — не больше трёхкратных резервов, объём — не больше пятикратного открытого интереса. Репутация, возраст, бренд и листинги не учитываются вовсе.",
  // one exchange's own page
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
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. Reserves are DefiLlama's.":
    "Медианы за последние семь дней по снимкам публичного стакана {venue} каждые десять минут; затраты — по стакану, а не по исполнениям. Резервы — по данным DefiLlama.",
  "Quarantined: left out of the default rankings. {evidence}":
    "В карантине: не входит в рейтинги по умолчанию. {evidence}",
  Quarantined: "В карантине",
  "Quarantined: {venues}. Their numbers failed the venue review's checks (funding copied from another exchange, or volume and open interest far beyond what their reserves could back), so they are still collected and shown here but left out of the default Screener and Arbitrage rankings; tick them in the exchange picker to rank them.":
    "В карантине: {venues}. Их данные не прошли проверку бирж (ставка финансирования скопирована с другой биржи или объём и открытый интерес намного больше, чем могут обеспечить их резервы), поэтому они по-прежнему собираются и показаны здесь, но не входят в рейтинги скринера и арбитража по умолчанию; чтобы включить их в рейтинг, отметьте их в выборе бирж.",
};
