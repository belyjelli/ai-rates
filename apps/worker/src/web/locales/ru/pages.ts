/**
 * Russian for web/pages.ts (every page but the /status body, which stays English) and
 * web/venues.ts. Glossary and style: ./index.ts.
 *
 * Terms: replay воспроизведение (replayed воспроизведено), price gap ценовой разрыв, good for (the
 * size a gap holds) доступно, resting size выставленный объём, best bid / ask лучший бид / аск, mark
 * маркировка, top of book вершина стакана, fill исполнение, momentum's flat флэт, a window's span
 * сутки or "{n} дн." (so "за последние {span}" reads right for any length).
 */

import type { Catalog } from "../../i18n";

export const pages: Catalog = {
  // shared helpers
  flat: "флэт",
  crypto: "крипто",
  equity: "акция",
  commodity: "сырьё",
  fx: "валюта",
  index: "индекс",
  "{days} charging days in the last 30": "дней с выплатами за последние 30: {days}",
  Asset: "Актив",
  "7d settled": "Выплачено за 7 д",
  Stability: "Стабильность",
  "Long on {venue}": "Лонг на {venue}",
  "Short on {venue}": "Шорт на {venue}",
  day: "сутки",
  "{n} days": "{n} дн.",
  Any: "Любой",
  Reset: "Сбросить",

  // home: verified ranking and hero
  "No replay yet: the nightly run needs a week of settled funding on both legs of a pair.":
    "Воспроизведения пока нет: ночному прогону нужна неделя выплаченного фандинга по обеим ногам пары.",
  "Replayed, not forecast: {asset} long {long} / short {short} settled {net} on {size} a leg over 7 days. {apr} annualized, {win}% of days positive.":
    "Воспроизведено, не прогноз: {asset} лонг {long} / шорт {short} — выплачено {net} при {size} на ногу за 7 дней. {apr} годовых, {win}% дней в плюсе.",
  "Open interest on the thinner of the two legs. A big figure earned on a shallow market is not a trade you can size into":
    "Открытый интерес более тонкой из двух ног. Большая цифра на мелком рынке — не сделка, в которую можно зайти объёмом",
  "The more extreme leg's funding, absolute. Rates past a few hundred percent usually mean a delisting or a distressed listing rather than carry":
    "Фандинг более экстремальной ноги по модулю. Ставки выше нескольких сотен процентов обычно означают делистинг или проблемный листинг, а не керри",
  "Funding both legs actually settled over the last 7 days, per $10,000 of notional on each leg":
    "Фандинг, фактически выплаченный по обеим ногам за последние 7 дней, на $10,000 номинала на каждой ноге",
  Annualized: "Годовых",
  "Long leg": "Лонговая нога",
  "Short leg": "Шортовая нога",
  "Days the pair was net positive, as a share of days that settled at all":
    "Доля дней, когда пара была в чистом плюсе, среди всех дней с выплатами",
  "Win rate": "Винрейт",
  "Thinner leg OI": "OI тонкой ноги",
  "Worst leg APR": "APR худшей ноги",
  "How often the weaker leg held its funding direction over 30 days":
    "Как часто слабая нога сохраняла направление фандинга за 30 дней",
  "Widest funding spread right now": "Самый широкий спред фандинга сейчас",
  "No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.":
    "За последние пять минут ни одна биржа не прислала данные, поэтому составить пары не из чего. Проверьте через минуту.",
  "Funding spreads across perp exchanges": "Спреды фандинга между биржами бессрочных фьючерсов",
  "Live funding rate spreads between perpetual futures exchanges, refreshed every minute.":
    "Спреды ставок финансирования между биржами бессрочных фьючерсов в реальном времени, обновление каждую минуту.",
  "Widest spreads": "Самые широкие спреды",
  "Open the screener": "Открыть скринер",
  "No pairs yet: an asset needs live markets on at least two venues.":
    "Пар пока нет: активу нужны активные рынки минимум на двух биржах.",
  "What actually paid, last 7 days": "Фактические выплаты за последние 7 дней",
  "replayed {date}": "воспроизведено {date}",
  "Not a forecast: both legs replayed at their own settlement times from stored funding, on $10,000 per leg. Ranked by what settled, with nothing filtered out — so check the thinner leg's depth and the worse leg's rate before reading a big number as a trade.":
    "Не прогноз: обе ноги воспроизведены по их собственному времени выплат из сохранённого фандинга, по $10,000 на ногу. Ранжировано по выплаченному, без какой-либо фильтрации — поэтому проверьте глубину тонкой ноги и ставку худшей ноги, прежде чем считать большую цифру сделкой.",
  "{asset} carry, long {long} / short {short}: {funding} of funding settled on {size} a leg over the last {span}. {net} after retail fees. Price risk hedged, not guessed.":
    "Керри {asset}, лонг {long} / шорт {short}: за последние {span} выплачено {funding} фандинга при {size} на ногу. {net} после розничных комиссий. Ценовой риск захеджирован, а не угадан.",
  "Best verified carry, last {span}": "Лучший подтверждённый керри за последние {span}",
  "funding settled on {size} per leg": "фандинг, выплаченный при {size} на ногу",
  "after retail fees {value}": "после розничных комиссий {value}",
  "annualized {value} before fees": "{value} годовых до комиссий",
  "win rate {value} of days": "винрейт {value} по дням",
  "thinner leg {value} open interest": "открытый интерес тонкой ноги {value}",
  "stability {value}": "стабильность {value}",
  "Open this backtest": "Открыть этот бэктест",
  "Settled, not forecast: both legs replayed at their own settlement times. This is the best pair in the newest nightly run with at least {oi} of open interest on its thinner leg, neither leg past {apr}% a year, stability of {stability} or better and no missed settlements. Retail fees are {bps} bps on each of {fills} fills, opening and closing both legs. Last week's funding is not a promise about next week's.":
    "Выплачено, не прогноз: обе ноги воспроизведены по их собственному времени выплат. Это лучшая пара последнего ночного прогона, у которой открытый интерес тонкой ноги не меньше {oi}, ни одна нога не превышает {apr}% годовых, стабильность {stability} или лучше и нет пропущенных выплат. Розничные комиссии — {bps} bps на каждое из исполнений (всего {fills}): открытие и закрытие обеих ног. Фандинг прошлой недели — не обещание на следующую.",
  "Widest funding spread across perp exchanges right now: {asset} at {spread} a year. Long {long} at {longApr}, short {short} at {shortApr}.":
    "Самый широкий спред фандинга между биржами бессрочных фьючерсов сейчас: {asset}, {spread} годовых. Лонг {long} ({longApr}), шорт {short} ({shortApr}).",
  "funding spread, per year": "спред фандинга, годовых",
  "{symbol} at {apr}": "{symbol}: {apr}",
  "Holding equal size on both legs cancels the price exposure; the gap between the two funding rates is what the pair collects over a year, before trading fees and before either rate moves.":
    "Равный объём на обеих ногах гасит ценовой риск; разница между двумя ставками финансирования — это то, что пара собирает за год, до торговых комиссий и до любого изменения ставок.",

  // screener
  "Funding spread screener": "Скринер спредов фандинга",
  "Filter live cross-exchange funding spreads by open interest, volume and exchange type.":
    "Фильтруйте межбиржевые спреды фандинга в реальном времени по открытому интересу, объёму и типу биржи.",
  "For each asset, the cheapest market to hold long and the richest to hold short, on different exchanges. Each leg must pass the filters.":
    "Для каждого актива — самый дешёвый рынок для лонга и самый доходный для шорта на разных биржах. Каждая нога должна пройти фильтры.",
  "No pairs match these filters. Lower the minimum open interest or include more exchange types.":
    "Нет пар под эти фильтры. Снизьте минимальный открытый интерес или добавьте типы бирж.",
  "Min open interest, each leg": "Мин. открытый интерес, каждая нога",
  "Min 24h volume, each leg": "Мин. объём за 24 ч, каждая нога",
  "A USDT leg against a USDC leg carries the basis between the two stablecoins and needs collateral in both. Ticked, each asset is paired only within one quote currency":
    "Нога в USDT против ноги в USDC несёт базис между двумя стейблкоинами и требует залога в обоих. Если отмечено, пары для каждого актива строятся только внутри одной котируемой валюты",
  "Same quote currency on both legs": "Одна котируемая валюта на обеих ногах",
  "Delisting and distressed listings can pay beyond ±2000% APR and crowd out tradeable spreads":
    "Делистинг и проблемные листинги могут платить свыше ±2000% годовых и вытесняют торгуемые спреды",
  "Include beyond ±1000% APR": "Включить свыше ±1000% годовых",
  Rows: "Строк",
  Spread: "Спред",
  Venues: "Биржи",
  "Neither leg has settled funding to score yet": "Ни у одной ноги пока нет выплат для оценки",
  "The long leg has no settled funding to score yet": "У лонговой ноги пока нет выплат для оценки",
  "The short leg has no settled funding to score yet": "У шортовой ноги пока нет выплат для оценки",
  "Weaker leg held its direction on {days} of its charging days in the last 30":
    "Слабая нога сохраняла направление в {days} из своих дней с выплатами за последние 30",
  "This exchange does not say what the leg settles in, so it cannot be shown to match the other leg":
    "Биржа не указывает, в чём рассчитывается эта нога, поэтому нельзя подтвердить, что она совпадает с другой",
  "Settles in {quote} while the other leg settles in {other}: the pair carries the basis between them":
    "Расчёт в {quote}, а у другой ноги — в {other}: пара несёт базис между ними",
  "an undeclared currency": "неуказанной валюте",
  "quote ?": "валюта ?",
  OI: "OI",
  "{asset} pays {spread} a year to hold both sides: long {long} at {longApr}, short {short} at {shortApr}. Same coin, two exchanges, price exposure cancelled.":
    "{asset} платит {spread} годовых за удержание обеих сторон: лонг {long} ({longApr}), шорт {short} ({shortApr}). Одна монета, две биржи, ценовой риск погашен.",
  "Signed log scale, so ordinary rates keep room next to extreme ones":
    "Логарифмическая шкала со знаком, чтобы обычным ставкам хватало места рядом с экстремальными",
  "Long − short, log scale": "Лонг − шорт, лог. шкала",
  "Exchanges with a live market for this asset": "Биржи с активным рынком по этому активу",
  "How often the weaker leg held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "Как часто слабая нога сохраняла направление фандинга за 30 дней. 0.50 — подбрасывание монеты; 0.88 — максимум за полный месяц",

  // exchanges and one exchange
  Exchanges: "Биржи",
  "No exchange has reported in the last five minutes.":
    "За последние пять минут ни одна биржа не прислала данные.",
  Exchange: "Биржа",
  Type: "Тип",
  "Open interest": "Открытый интерес",
  "24h volume": "Объём за 24 ч",
  Updated: "Обновлено",
  "{venue}: {count} live perp markets, {oi} open interest. Richest funding {richest} at {richestApr} a year; cheapest {cheapest} at {cheapestApr}.":
    "{venue}: активных бессрочных рынков — {count}, открытый интерес {oi}. Самый высокий фандинг — {richest}, {richestApr} годовых; самый низкий — {cheapest}, {cheapestApr}.",
  "{venue} funding rates": "Ставки финансирования {venue}",
  "Live funding rates, open interest and volume for every {venue} perpetual market.":
    "Ставки финансирования, открытый интерес и объём в реальном времени по всем бессрочным рынкам {venue}.",
  "No live markets from {venue}: it isn't collected yet, or its last update is more than five minutes old.":
    "Нет активных рынков {venue}: биржа ещё не собирается или последнее обновление старше пяти минут.",
  "{count} live markets": "активных рынков: {count}",
  "{value} open interest": "открытый интерес {value}",
  "updated {value}": "обновлено {value}",
  Market: "Рынок",
  "Funding APR": "APR фандинга",
  "Rate, log scale": "Ставка, лог. шкала",
  Interval: "Интервал",
  "Next funding": "След. выплата",
  "Mark price": "Цена маркировки",
  "Centralized exchange": "Централизованная биржа",
  "Onchain perp exchange": "Ончейн-биржа бессрочных фьючерсов",
  "Hyperliquid HIP-3 dex": "Hyperliquid HIP-3 DEX",

  // rates
  now: "сейчас",
  asset: "актив",
  "open interest": "открытый интерес",
  spread: "спред",
  "{asset} funding runs from {low} on {lowVenue} to {high} on {highVenue}: {gap} a year apart across {count} exchanges.":
    "Фандинг {asset} — от {low} на {lowVenue} до {high} на {highVenue}: разница {gap} годовых, бирж: {count}.",
  previous: "предыдущие",
  "assets {from}–{to}": "активы {from}–{to}",
  next: "следующие",
  "No asset has live markets on two or more venues right now.":
    "Сейчас ни у одного актива нет активных рынков на двух и более биржах.",
  Rates: "Ставки",
  "Funding APR for every asset across every perpetual exchange, in one grid.":
    "APR фандинга по каждому активу на каждой бирже бессрочных фьючерсов в одной таблице.",
  "Every exchange's funding for the deepest assets at once. Positive means longs pay, so a short collects; an empty cell means that exchange has no market for the asset, not that funding is flat.":
    "Фандинг всех бирж по самым ликвидным активам сразу. Положительное значение — платят лонги, шорт получает; пустая ячейка значит, что у биржи нет рынка по активу, а не что фандинг нулевой.",

  // price gaps
  "{asset}: buy on {buyVenue} at {buyPrice}, sell on {sellVenue} at {sellPrice}. A {gap} bps gap at the top of the book.":
    "{asset}: покупка на {buyVenue} по {buyPrice}, продажа на {sellVenue} по {sellPrice}. Разрыв {gap} bps на вершине стакана.",
  "Quotes seen {quoted}; the older leg's funding row fetched {fetched}":
    "Котировки получены {quoted}; данные фандинга более старой ноги — {fetched}",
  "No asset quotes a gap this wide right now. The median comparable asset sits near 1.6 bps, so try a lower floor.":
    "Сейчас ни один актив не показывает такой широкий разрыв. Медиана по сопоставимым активам — около 1.6 bps, попробуйте порог пониже.",
  "Highest bid against lowest ask, across two different exchanges":
    "Самый высокий бид против самого низкого аска на двух разных биржах",
  "Gap, bps": "Разрыв, bps",
  "The sell price less the buy price, in the asset's own price units":
    "Цена продажи минус цена покупки, в ценовых единицах актива",
  Basis: "Базис",
  "The smaller of the two resting sizes: what the gap is actually good for":
    "Меньший из двух выставленных объёмов: сколько реально можно взять на этом разрыве",
  "Good for": "Доступно",
  "Buy price": "Цена покупки",
  "Buy at": "Купить на",
  "Ask size": "Объём аска",
  "Sell price": "Цена продажи",
  "Sell at": "Продать на",
  "Bid size": "Объём бида",
  "Exchanges quoting this asset that survived the mark-agreement check":
    "Биржи с котировками актива, прошедшие проверку согласованности маркировки",
  Quoted: "Котировка",
  "Price gaps across exchanges": "Ценовые разрывы между биржами",
  "Where one exchange's bid sits above another's ask.": "Где бид одной биржи выше аска другой.",
  "Price gaps": "Ценовые разрывы",
  "For each asset, the cheapest exchange to buy and the dearest to sell, at the top of each book. These are <b>quotable gaps</b>, not fillable trades: nothing here reflects the book below level 1, the taker fees, or the two transfers a real position needs. The widest gaps sit on the thinnest books — when this was measured, 395 of 721 assets showed any gap at a median of 1.6 bps, while the leaders were good for as little as $3 of resting size.":
    "Для каждого актива — самая дешёвая биржа для покупки и самая дорогая для продажи на вершине каждого стакана. Это <b>котируемые разрывы</b>, а не исполнимые сделки: здесь не учтены стакан ниже первого уровня, тейкер-комиссии и два перевода, которые нужны реальной позиции. Самые широкие разрывы — на самых тонких стаканах: на момент замера разрыв был у 395 из 721 актива с медианой 1.6 bps, а у лидеров выставленный объём составлял всего $3.",
  "Min gap, bps": "Мин. разрыв, bps",
  "Any, including 0.0": "Любой, включая 0.0",
  "Min resting size": "Мин. выставленный объём",
  Apply: "Применить",
  "This venue's mark disagrees with the rest, so it is excluded from the gap":
    "Маркировка этой биржи расходится с остальными, поэтому она исключена из разрыва",
  "Marked {ratio}× above this asset's deepest market, so it is a different instrument, not a price gap":
    "Маркировка выше самого глубокого рынка актива ({ratio}×): это другой инструмент, а не ценовой разрыв",
  "Marked {ratio}× below this asset's deepest market, so it is a different instrument, not a price gap":
    "Маркировка ниже самого глубокого рынка актива ({ratio}×): это другой инструмент, а не ценовой разрыв",
  best: "лучший",
  "This venue's own bid-ask spread, which a taker crosses on entry and again on exit":
    "Собственный спред бид-аск биржи, который тейкер пересекает при входе и ещё раз при выходе",
  "This venue's funding row has not been refreshed within the freshness window, so its mark is withheld rather than shown stale — the quote beside it is live":
    "Данные фандинга этой биржи не обновились в пределах окна свежести, поэтому её маркировка скрыта, а не показана устаревшей — котировка рядом актуальна",
  "Quote seen {quoted}; funding row fetched {fetched}":
    "Котировка получена {quoted}; данные фандинга — {fetched}",
  "Every pair": "Все пары",
  "One row per direction: buy at the first exchange, sell at the second. The widest gap is often not the one to take — a narrower pair can rest far more size behind it, and most directions lose outright.":
    "Одна строка на направление: покупка на первой бирже, продажа на второй. Самый широкий разрыв часто не лучший — за более узкой парой может стоять гораздо больший объём, а большинство направлений просто убыточны.",
  "The smaller of the buying side's ask size and the selling side's bid size — what this direction is good for":
    "Меньшее из объёма аска на стороне покупки и объёма бида на стороне продажи — сколько можно взять в этом направлении",
  "No two exchanges quote {asset} in a way that can be compared right now.":
    "Сейчас нет двух бирж с сопоставимыми котировками {asset}.",
  "Buying on {buy} and selling on {sell} quotes {gap}, though one side's resting size is unknown.":
    "Покупка на {buy} и продажа на {sell} дают разрыв {gap}, но объём на одной из сторон неизвестен.",
  "Buying on {buy} and selling on {sell} quotes {gap}, good for about {size}.":
    "Покупка на {buy} и продажа на {sell} дают разрыв {gap} на объём около {size}.",
  "That is a quote at the size shown, not a fillable trade: it is before fees, before the book below level 1, and before the transfer between two exchanges.":
    "Это котировка на показанный объём, а не исполнимая сделка: без комиссий, без стакана ниже первого уровня и без перевода между двумя биржами.",
  Status: "Статус",
  "{count} venue is shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "Приглушены и исключены из разрыва (бирж: {count}): {venues}. Их маркировка расходится более чем на 10% с самым глубоким по открытому интересу рынком актива — это инструмент другого размера или с другим названием, а не разница в цене. Именно эта проверка не даёт опубликовать несовпадение в 1375× как возможность на 13,660,780 bps. Причина для каждой указана на странице {status}.",
  "{count} venues are shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "Приглушены и исключены из разрыва (бирж: {count}): {venues}. Их маркировка расходится более чем на 10% с самым глубоким по открытому интересу рынком актива — это инструмент другого размера или с другим названием, а не разница в цене. Именно эта проверка не даёт опубликовать несовпадение в 1375× как возможность на 13,660,780 bps. Причина для каждой указана на странице {status}.",
  "{asset} price gaps by exchange": "Ценовые разрывы {asset} по биржам",
  "{asset} best bid and ask on every exchange that quotes it, with the size resting at each.":
    "Лучшие бид и аск {asset} на каждой бирже с котировками и выставленный на каждой объём.",
  "Every exchange": "Все биржи",
  "Best bid": "Лучший бид",
  "Best ask": "Лучший аск",
  "The venue's own bid-ask spread in basis points":
    "Собственный спред бид-аск биржи в базисных пунктах",
  "Own spread": "Свой спред",
  Mark: "Маркировка",
  "Sizes are the money resting at the very top of each book, converted to USD because the three venues that publish depth count it differently — Gate in contracts, OKX in contracts against <code>ctVal</code>, Bybit in base coin. Reading those raw, side by side, is a 10,000× error.":
    "Объёмы — это деньги, выставленные на самой вершине каждого стакана, переведённые в USD, потому что три биржи, публикующие глубину, считают её по-разному: Gate — в контрактах, OKX — в контрактах с учётом <code>ctVal</code>, Bybit — в базовой монете. Сравнивать сырые цифры рядом — ошибка в 10,000×.",

  // one asset
  "Best pair: long on {long} at {longApr}, short on {short} at {shortApr}, a {spread} spread per year.":
    "Лучшая пара: лонг на {long} ({longApr}), шорт на {short} ({shortApr}), спред {spread} годовых.",
  "Only markets with at least {minOi} open interest are paired.":
    "В пары попадают только рынки с открытым интересом не менее {minOi}.",
  "Funding only, before trading fees: none were entered.":
    "Только фандинг, без торговых комиссий: они не указаны.",
  "Only one exchange lists it right now, so there's no cross-exchange pair.":
    "Сейчас его листит только одна биржа, поэтому межбиржевой пары нет.",
  "No two exchanges have at least {minOi} open interest in it, so there's no pair to show.":
    "Нет двух бирж с открытым интересом по нему не менее {minOi}, поэтому показать пару нельзя.",
  "{asset} funding rates by exchange": "Ставки финансирования {asset} по биржам",
  "{asset} perpetual funding rates across {count} exchanges, with the widest long/short spread.":
    "Ставки финансирования бессрочных фьючерсов {asset} по биржам (всего {count}) и самый широкий спред лонг/шорт.",
  "Funding by exchange": "Фандинг по биржам",
  "{markets} live markets on {venues} exchanges.": "Активных рынков: {markets}, бирж: {venues}.",
  "{asset} funding across {count} exchanges: long {long} at {longApr}, short {short} at {shortApr}. A {spread} spread a year on one coin.":
    "Фандинг {asset} по биржам (всего {count}): лонг {long} ({longApr}), шорт {short} ({shortApr}). Спред {spread} годовых на одной монете.",
  "Backtest this pair": "Бэктест этой пары",
  "long {long} · short {short} · {spread} a year, replayed on settled funding":
    "лонг {long} · шорт {short} · {spread} годовых, воспроизведено на выплаченном фандинге",
  "24h settled": "Выплачено за 24 ч",
  "How often this market held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "Как часто этот рынок сохранял направление фандинга за 30 дней. 0.50 — подбрасывание монеты; 0.88 — максимум за полный месяц",
  "Last 7 charging days against the days before them, in APR points. Up means funding is widening in the direction it already had":
    "Последние 7 дней с выплатами против предыдущих, в пунктах APR. Вверх — фандинг расширяется в прежнем направлении",
  "30d trend": "Тренд 30 д",

  // pair backtest
  "capital {amount} — {venue} will not open a position above {max} on {symbol}":
    "капитал {amount} — {venue} не откроет позицию больше {max} по {symbol}",
  "capital {amount} across both legs at {leverage}":
    "капитал {amount} на обе ноги, плечо {leverage}",
  "capital {amount} across both legs, unleveraged": "капитал {amount} на обе ноги, без плеча",
  "capital at least {amount} across both legs — {leverage} is the small-size maximum":
    "капитал от {amount} на обе ноги: {leverage} — максимальное плечо для малого объёма",
  "capital {amount} across both legs at {leverage} (small size)":
    "капитал {amount} на обе ноги, плечо {leverage} (малый объём)",
  "Cumulative funding reaches {amount} after {days} days":
    "Накопленный фандинг достигает {amount} за {days} дн.",
  "Cumulative funding on {size} per leg · {from} to {to}":
    "Накопленный фандинг при {size} на ногу · {from} – {to}",
  "Taker fee in basis points, per fill. Both legs must be filled in before costs are charged.":
    "Тейкер-комиссия в базисных пунктах за исполнение. Затраты учитываются, только когда заполнены обе ноги.",
  "blank = ignore": "пусто = не учитывать",
  Window: "Период",
  "Long on": "Лонг на",
  "Short on": "Шорт на",
  "Size per leg": "Объём на ногу",
  "Long taker fee": "Тейкер-комиссия лонга",
  "Short taker fee": "Тейкер-комиссия шорта",
  "Run backtest": "Запустить бэктест",
  "swap legs": "поменять ноги",
  "What entering and exiting would cost at each exchange's top of book":
    "Сколько стоили бы вход и выход по вершине стакана каждой биржи",
  "price gap": "ценовой разрыв",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, before fees. Replayed from settled funding:":
    "Фандинг-керри {asset}, лонг {long} / шорт {short}: {net} при {size} на ногу за последние {span}, до комиссий. Воспроизведено по выплаченному фандингу:",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, after fees. Replayed from settled funding:":
    "Фандинг-керри {asset}, лонг {long} / шорт {short}: {net} при {size} на ногу за последние {span}, после комиссий. Воспроизведено по выплаченному фандингу:",
  "Share on X": "Поделиться в X",
  "opens a post with this result and a link back to it":
    "открывает пост с этим результатом и ссылкой на него",
  "after costs {net} on {fees} of fees": "после затрат {net} при комиссиях {fees}",
  "never repays the fees at this rate": "при такой ставке комиссии не окупятся",
  "fees repay in {days}": "окупаемость комиссий: {days}",
  "under a day": "менее суток",
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
  "best day {amount} {date}": "лучший день {amount}, {date}",
  "worst day {amount} {date}": "худший день {amount}, {date}",
  "The largest fall in cumulative funding from a previous high, before costs":
    "Наибольшее падение накопленного фандинга от предыдущего максимума, до затрат",
  "max drawdown {amount}": "макс. просадка {amount}",
  "{days}d avg {apr}": "среднее за {days} д: {apr}",
  "now {apr}, {average}, every {interval}": "сейчас {apr}, {average}, интервал {interval}",
  "now {apr}, every {interval}": "сейчас {apr}, интервал {interval}",
  "net funding over the last {span} · {apr} annualized":
    "чистый фандинг за последние {span} · {apr} годовых",
  "Long {venue}": "Лонг {venue}",
  "{n} settlements": "выплат: {n}",
  "Short {venue}": "Шорт {venue}",
  "win rate {value} of {days} days": "винрейт {value} за {days} дн.",
  "average {value} a day": "в среднем {value} в день",
  "Missed settlements: {long} on {longVenue}, {short} on {shortVenue}. A gap is reported rather than counted as zero, so this total covers only the settlements actually recorded.":
    "Пропущенные выплаты: {longVenue} — {long}, {shortVenue} — {short}. Пропуск показывается, а не считается нулём, поэтому итог охватывает только реально записанные выплаты.",
  "Only {have} of the {asked} days asked for have stored settlements. The annualized figure still divides by the whole window, so it reads low. The daily rollup keeps 70 days, and history is still filling on some venues.":
    "Сохранённые выплаты есть только для части запрошенных дней: {have} из {asked}. Годовая цифра всё равно делится на всё окно, поэтому занижена. Дневная сводка хранит 70 дней, а история по некоторым биржам ещё заполняется.",
  "Funding only, on a position kept at {size} per leg. Trading fees are excluded because none were given: taker fees depend on your own volume tier and discounts, so fill in both legs' fees above to see this net of costs. Price moves between settlements aren't modelled either, because venue funding history gives a rate and a time, and almost never a mark price.":
    "Только фандинг, при позиции {size} на ногу. Торговые комиссии не учтены, потому что не указаны: тейкер-комиссии зависят от вашего уровня объёма и скидок, поэтому заполните комиссии обеих ног выше, чтобы увидеть итог за вычетом затрат. Движение цены между выплатами тоже не моделируется: история фандинга бирж даёт ставку и время и почти никогда — цену маркировки.",
  "Net of the fees you entered, on a position kept at {size} per leg: {long} bps long and {short} bps short, charged on four fills — entry and exit on both legs. Opening and closing once is assumed; rolling the position would cost this again each time. Price moves between settlements still aren't modelled, because venue funding history gives a rate and a time, and almost never a mark price.":
    "За вычетом указанных вами комиссий, при позиции {size} на ногу: {long} bps на лонге и {short} bps на шорте, за четыре исполнения — вход и выход на обеих ногах. Предполагаются одно открытие и одно закрытие; каждый перенос позиции обойдётся в эту сумму снова. Движение цены между выплатами по-прежнему не моделируется: история фандинга бирж даёт ставку и время и почти никогда — цену маркировки.",
  "Only one exchange lists {asset} right now, so there's no pair to hold.":
    "Сейчас {asset} листит только одна биржа, поэтому держать пару не на чем.",
  "Pick two exchanges to hold against each other.":
    "Выберите две биржи, чтобы держать позиции друг против друга.",
  "{asset} funding carry backtest": "Бэктест фандинг-керри {asset}",
  "What holding {asset} long on one exchange and short on another would have paid in funding.":
    "Сколько фандинга принёс бы лонг {asset} на одной бирже и шорт на другой.",
  backtest: "бэктест",
  "{asset} carry": "Керри {asset}",
  "Every exchange's funding over one window, and what the two legs you pick actually settled, summed per UTC day. Windows are whole calendar days ending today, and the figures refresh hourly.":
    "Фандинг всех бирж за одно окно и то, что реально выплатили две выбранные вами ноги, с суммированием по дням UTC. Окна — целые календарные дни по сегодняшний включительно, цифры обновляются ежечасно.",

  // errors
  "Too many requests": "Слишком много запросов",
  "Too many backtests from this address.": "Слишком много бэктестов с этого адреса.",
  "That is more backtests than one address may run in a minute. Wait a moment and try again. Results already computed are served from the cache and are never limited, so a combination someone has run before still loads immediately.":
    "Это больше бэктестов, чем один адрес может запустить за минуту. Подождите немного и попробуйте снова. Уже рассчитанные результаты отдаются из кэша без ограничений, поэтому комбинация, которую кто-то уже запускал, загрузится сразу.",
  "Back to the screener": "Вернуться в скринер",
  "Not found": "Не найдено",
  "Page not found.": "Страница не найдена.",
  "Nothing lives at {path}.": "По адресу {path} ничего нет.",
  "See today's widest spreads": "Самые широкие спреды сегодня",
  "A runner sprinting": "Бегущий спринтер",
  "Data center busy": "Дата-центр перегружен",
  "The data center is too busy and a runner is on it. Try again later.":
    "Дата-центр перегружен, и бегун уже в пути. Попробуйте позже.",
  "The data center is getting too busy and is currently sprinting in circles":
    "Дата-центр перегружен и сейчас бегает по кругу",
  "Every server is screaming, the funding rates are on fire, and one intern is running the whole thing on foot. Go touch grass and try again later.":
    "Все серверы кричат, ставки финансирования горят, а один стажёр тащит всё это на своих двоих. Сходите потрогать траву и попробуйте позже.",
  "Try again": "Повторить",
  // pages.ts invertedMark: an FX leg quoted the other way round (migration 041).
  "short this contract": "шорт этого контракта",
  "long this contract": "лонг этого контракта",
  "sell this contract": "продать этот контракт",
  "buy this contract": "купить этот контракт",
  "{symbol} quotes this pair the other way round, so this side of the pair is the opposite side of that contract. Its price is shown inverted and its funding with the sign flipped, in the pair's terms.":
    "{symbol} котирует эту пару в обратную сторону, поэтому эта сторона пары — противоположная сторона контракта. Цена показана обратной, а ставка финансирования — с обратным знаком, в терминах пары.",
  Now: "Сейчас",
  "Payback, days": "Окупаемость, дн.",
  Long: "Лонг",
  Short: "Шорт",
  "7d {apr}": "7 д {apr}",
  "Where to hold the long side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "Где держать лонг: биржа и её фандинг сейчас; ниже контракт, интервал, открытый интерес и фандинг за 7 дней",
  "Where to hold the short side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "Где держать шорт: биржа и её фандинг сейчас; ниже контракт, интервал, открытый интерес и фандинг за 7 дней",
  "Days of the {days}-day spread it takes to repay {bps} bps of fees: a taker fill in and out of both legs, at public retail rates":
    "Сколько дней разрыва за {days} д нужно, чтобы окупить {bps} б.п. комиссий: по одной тейкерской сделке на вход и выход в обеих ногах, по публичным розничным ставкам",
  "No {days} days of settlements yet, so this is from the spread now: days to repay {bps} bps of fees, a taker fill in and out of both legs, at public retail rates":
    "Выплат за {days} д ещё нет, поэтому по текущему разрыву: сколько дней нужно, чтобы окупить {bps} б.п. комиссий, по одной тейкерской сделке на вход и выход в обеих ногах, по публичным розничным ставкам",
  "per {unit}": "за {unit}",
  "Days of funding it takes to repay the fees of opening and closing both legs, at public retail taker rates. From the {days}-day spread; dimmed where there is only the spread now":
    "Сколько дней фандинга нужно, чтобы окупить комиссии за открытие и закрытие обеих ног по публичным розничным тейкерским ставкам. По разрыву за {days} д; бледным, где есть только текущий разрыв",
  "The funding spread now: short leg's rate minus long leg's":
    "Разрыв фандинга сейчас: ставка шортовой ноги минус ставка лонговой",
  "The same two markets' spread, averaged over the settlements of the last {days} days":
    "Разрыв тех же двух рынков, средний по выплатам за последние {days} д",
  "dollars, or 250k, 1.5m": "доллары, или 250k, 1.5m",
  "Delete preset": "Удалить набор",
  "No presets yet.": "Наборов пока нет.",
  Presets: "Наборы",
  "Preset name": "Название набора",
  "Preset name…": "Название набора…",
  Save: "Сохранить",
  "Clear all": "Снять все",
  "Select all": "Выбрать все",
  "{n} selected": "Выбрано: {n}",
  Filters: "Фильтры",
  "Asset class": "Класс активов",
  TradFi: "Традиционные",
  "Spread now (APR %)": "Разрыв сейчас (APR %)",
  "Both legs settle at this interval": "Обе ноги расчётные с этим интервалом",
  "Funding interval": "Интервал фандинга",
  "No USDT leg against a USDC one": "Без ноги в USDT против ноги в USDC",
  "Distressed and delisting markets": "Проблемные и делистинговые рынки",
  "Reset all": "Сбросить всё",
  Steadiness: "Устойчивость",
  "Funding steadiness": "Устойчивость фандинга",
  "How often a leg's funding kept its direction over the last 30 days: the dot beside each exchange in the Long and Short columns. The Stability column is the weaker leg's score.":
    "Как часто фандинг ноги сохранял направление за последние 30 дней: точка перед каждой биржей в колонках лонга и шорта. Колонка стабильности — оценка более слабой ноги.",
  "Holds its direction almost every day. Income you can plan on.":
    "Почти каждый день сохраняет направление. Доход, на который можно рассчитывать.",
  "Flips now and then. Usable for a carry, but size for the days it pays the other way.":
    "Иногда разворачивается. Годится для керри, но размер позиции учитывайте с поправкой на дни обратных выплат.",
  "Flips often. Today's rate says little about next week's, and a backtest of it says less.":
    "Часто разворачивается. Сегодняшняя ставка мало говорит о следующей неделе, а её бэктест — ещё меньше.",
  "Scored by direction, not by the coefficient of variation: that explodes whenever the average rate sits near zero. 0.50 is a coin flip; 0.88 is the most a full month can score.":
    "Оценка по направлению, а не по коэффициенту вариации: он взрывается, когда средняя ставка близка к нулю. 0.50 — подбрасывание монеты; 0.88 — максимум за полный месяц.",
  "Search asset": "Поиск актива",
  "Search asset…": "Поиск актива…",
  Period: "Период",
  "Rate unit": "Единица ставки",
  Day: "День",
  "No settled funding to score yet": "Пока нет выплаченного фандинга для оценки",
  "Funding held its direction on {days} of its charging days in the last 30: {band}":
    "Фандинг сохранял направление в {days} из дней начислений за последние 30: {band}",
  erratic: "неустойчивый",
  mixed: "средний",
  steady: "устойчивый",
  Chart: "График",
  "Running the backtest…": "Идёт бэктест…",
  "pick one": "выберите",
};
