import type { Catalog } from "../../i18n";

/**
 * /whales (web/whales.ts), its route's 404 (app/app.ts) and its nav and hotkey label.
 *
 * Terms: whale orders заявки китов, wall плотность (the glossary's word; bid wall плотность бид,
 * ask wall плотность аск), bid / ask бид / аск, resting стоит (в стакане), filled исполнена, pulled
 * снята, lost track след потерян, price bucket диапазон. A taker burst (the circles) is всплеск
 * тейкеров: taker buy покупка тейкера, taker sell продажа тейкера, as exchanges label the aggressor
 * side. Statuses are feminine, agreeing with плотность.
 */
export const whales: Catalog = {
  "{asset} is not one of the markets tracked on {venue}.":
    "{asset} нет среди отслеживаемых рынков на {venue}.",
  whales: "киты",
  bid: "бид",
  ask: "аск",
  resting: "стоит",
  filled: "исполнена",
  pulled: "снята",
  "lost track": "след потерян",
  "{n}m": "{n} мин",
  "{d}d {h}h": "{d} д {h} ч",
  "{side} wall {price} · {size} · {status} · {lived}":
    "{side}: плотность {price} · {size} · {status} · {lived}",
  "{asset} · {venue} perp · {n}-hour candles, {zone}":
    "{asset} · бессрочный {venue} · свечи {n} ч, {zone}",
  "{asset} · {venue} perp · {n}-minute candles, {zone}":
    "{asset} · бессрочный {venue} · свечи {n} мин, {zone}",
  "bid wall (buy orders)": "плотность бид (заявки на покупку)",
  "ask wall (sell orders)": "плотность аск (заявки на продажу)",
  "faded: filled or pulled": "бледные: исполнены или сняты",
  "last price": "последняя цена",
  Markets: "Рынки",
  "hide pulled walls": "скрыть снятые плотности",
  "show pulled walls": "показать снятые плотности",
  "Bid walls resting": "Плотности бид в стакане",
  "{n} buy walls below the price": "плотностей на покупку ниже цены: {n}",
  "Ask walls resting": "Плотности аск в стакане",
  "{n} sell walls above the price": "плотностей на продажу выше цены: {n}",
  "Largest wall": "Крупнейшая плотность",
  "{side} at {price}": "{side} на {price}",
  "none resting": "в стакане нет",
  "Pulled in {window}": "Снято за {window}",
  "cancelled before the price reached them; {n} filled": "отменены до подхода цены; исполнено: {n}",
  "No candles for {asset} yet. The collector backfills three days within a minute of a market joining the set.":
    "Свечей по {asset} пока нет. Сборщик подгружает три дня истории в течение минуты после добавления рынка.",
  Side: "Сторона",
  "From the last price": "От последней цены",
  Distance: "Расстояние",
  Size: "Размер",
  "The most it has held": "Наибольший объём за всё время",
  Peak: "Пик",
  "Since the collector first saw it": "С момента, когда сборщик впервые её увидел",
  "Resting since": "Стоит с",
  "No wall is resting in {asset}'s book right now.": "Сейчас в стакане {asset} нет плотностей.",
  Lived: "Прожила",
  Ended: "Конец",
  How: "Как",
  "No wall ended in the last {window}.": "За {window} ни одна плотность не исчезла.",
  "Large resting limit orders in Binance's USD-M book for {asset}: one price level holding at least {floor} for at least a minute. A {bid} is buy orders below the price, an {ask} sell orders above it. Each line runs from when the collector first saw the wall to when it went, and is thicker the bigger it is.":
    "Крупные лимитные заявки в стакане USD-M фьючерсов Binance по {asset}: на одном ценовом уровне не меньше {floor} в течение минимум минуты. Заявки на покупку ниже цены — это {bid}, на продажу выше — {ask}. Каждая линия идёт от момента, когда сборщик впервые увидел плотность, до её исчезновения и тем толще, чем плотность крупнее.",
  "bid wall": "плотность бид",
  "ask wall": "плотность аск",
  "A wall that ends is filled if the price reached it and pulled if it was cancelled first. Pulled walls are hidden by default: most are spoofs or quotes moving with the price. Walls are a snapshot of visible liquidity, not a floor or a ceiling, and not a forecast; any of them can be gone the moment the price gets near.":
    "Исчезнувшая плотность считается исполненной, если цена до неё дошла, и снятой, если её отменили раньше. Снятые плотности по умолчанию скрыты: в основном это спуфинг или котировки, которые двигаются за ценой. Плотности — снимок видимой ликвидности, а не пол или потолок и не прогноз; любая может исчезнуть, как только цена подойдёт.",
  "The forty markets are the top forty by open interest summed across every exchange we collect, read on Binance. The floor scales with that open interest. After every collector restart the book relearns levels far from the price as they change, so the oldest far walls can take an hour or two to reappear.":
    "Сорок рынков — это сорок крупнейших по открытому интересу, суммированному по всем биржам, которые мы собираем; стакан читается на Binance. Порог масштабируется по этому открытому интересу. После каждого перезапуска сборщика стакан заново узнаёт дальние от цены уровни по мере их изменения, поэтому самые старые дальние плотности могут появиться снова лишь через час-два.",
  "Whale orders": "Заявки китов",
  "whale orders": "заявки китов",
  "Large resting limit orders and large market orders on Binance and Hyperliquid futures, drawn over the price: where the walls sit, how big, whether they were filled or pulled, and who hit them.":
    "Крупные лимитные и крупные рыночные заявки на фьючерсах Binance и Hyperliquid поверх графика цены: где стоят плотности, какого они размера, исполнены они или сняты и кто в них ударил.",
  "The whale-order feed has not ranked its markets yet. It does so within a few minutes of starting.":
    "Поток заявок китов ещё не отранжировал рынки. Это происходит в первые минуты после запуска.",
  "Resting now": "Стоят сейчас",
  "Orders and trades": "Заявки и сделки",
  "{n} resting": "в стакане: {n}",
  "Every wall in the book right now, largest first. Distance is from the last price; size is what the level holds now, peak the most it has held.":
    "Все плотности в стакане сейчас, от крупнейшей. Расстояние — от последней цены; размер — сколько стоит на уровне сейчас, пик — максимум за всё время.",
  "Ended in the last {window}": "Исчезли за {window}",
  "taker buy": "покупка тейкера",
  "taker sell": "продажа тейкера",
  "one fill": "1 исполнение",
  "{n} fills": "исполнений: {n}",
  "{side} {size} at {price} · {fills} · {time}": "{side} {size} по {price} · {fills} · {time}",
  "large taker buy": "крупная покупка тейкера",
  "large taker sell": "крупная продажа тейкера",
  "Large buys in {window}": "Крупные покупки за {window}",
  "Large sells in {window}": "Крупные продажи за {window}",
  "{n} taker bursts of {floor} or more": "всплесков тейкеров от {floor}: {n}",
  "Aggregate trades in the burst: roughly the price levels it took":
    "Агрегированных сделок во всплеске: примерно столько ценовых уровней он снял",
  Fills: "Исполнения",
  When: "Когда",
  "No taker burst of {floor} or more in the last {window}.":
    "За {window} не было всплесков тейкеров от {floor}.",
  "Largest trades in the last {window}": "Крупнейшие сделки за {window}",
  "taker {address}": "тейкер {address}",
  "{size} in {n} orders, one at least {proven}": "{size}, заявок: {n}, одна не меньше {proven}",
  "no walls": "нет плотностей",
  "{bid} bid · {ask} ask": "бид {bid} · аск {ask}",
  "Pick a market": "Выбрать рынок",
  "{n} markets": "рынков: {n}",
  "Filter markets": "Фильтр рынков",
  "Walls resting, bid / ask": "Плотности в стакане, бид / аск",
  "Large taker buys minus sells, last 24 hours":
    "Крупные покупки тейкеров минус продажи за 24 часа",
  "Whale flow 24h": "Поток китов 24 ч",
  "No market matches.": "Нет подходящих рынков.",
  "Orders in the bucket at the last look": "Заявок в диапазоне при последней проверке",
  Orders: "Заявки",
  "The bucket's average order: its largest holds at least this":
    "Средняя заявка диапазона: крупнейшая в нём не меньше этого",
  "Largest ≥": "Крупнейшая ≥",
  Taker: "Тейкер",
  "Proven whale orders in {venue}'s book for {asset}. {venue} publishes only its 20 nearest price buckets a side, here {step} wide, each with how many orders it holds. A wall is a bucket whose average order is at least {floor}, so at least one order in it is that big; a {bid} sits below the price, an {ask} above it. It stays a wall while the bucket still holds what that order was proven to. A whale order sharing a bucket with many small ones cannot be proven, and is not drawn.":
    "Доказанные заявки китов в стакане {venue} по {asset}. {venue} публикует только 20 ближайших ценовых диапазонов с каждой стороны, здесь шириной {step}, и для каждого — число заявок в нём. Плотность — это диапазон, где средняя заявка не меньше {floor}, значит, хотя бы одна заявка в нём такого размера; {bid} стоит ниже цены, {ask} — выше. Плотность остаётся плотностью, пока в диапазоне держится объём, доказанный для этой заявки. Заявку кита в одном диапазоне со множеством мелких доказать нельзя, и она не рисуется.",
  "Each circle is one account's market order in one block, of at least the same {floor}; the table names the account. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the order. The chart draws the 200 largest in the window.":
    "Каждый кружок — рыночная заявка одного аккаунта в одном блоке, не меньше того же {floor}; аккаунт указан в таблице. Синий — тейкер покупает, красный — продаёт; чем больше кружок, тем крупнее заявка. На графике — 200 крупнейших за период.",
  "The markets are the top forty by open interest summed across every exchange we collect, among those {venue} lists, its HIP-3 markets included (gold is xyz:GOLD). The floor scales with that open interest.":
    "Рынки — сорок крупнейших по открытому интересу, суммированному по всем биржам, которые мы собираем, среди листингов {venue}, включая рынки HIP-3 (золото — xyz:GOLD). Порог масштабируется по этому открытому интересу.",
  "Each circle is a large market order: every fill on one side in the same millisecond, counted as one burst, of at least the same {floor}. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the burst. The chart draws the 200 largest in the window.":
    "Каждый кружок — крупная рыночная заявка: все исполнения одной стороны в одну миллисекунду считаются одним всплеском, не меньше того же {floor}. Синий — тейкер покупает, красный — продаёт; чем больше кружок, тем крупнее всплеск. На графике — 200 крупнейших за период.",
  "off the chart:": "за графиком:",
  "last {price}": "последняя {price}",
  "hover or tap a candle to read it": "наведите или нажмите на свечу, чтобы увидеть значения",
  "{asset} candles; arrow keys read one at a time": "Свечи {asset}; стрелки читают по одной",
  "{asset} volume per candle": "Объём {asset} по свечам",
  // web/whales.ts: the GEX switch over the chart
  off: "выкл.",
  "Hide the options book": "Скрыть опционы",
  "Each strike's call and put gamma, as bars at the right edge":
    "Гамма коллов и путов по каждому страйку — полосами у правого края",
  "Strike {strike} · calls {calls} · puts {puts} · net {net} per 1% move":
    "Страйк {strike} · коллы {calls} · путы {puts} · нетто {net} на 1% движения",
  "call wall {price}": "колл-стена {price}",
  "put wall {price}": "пут-стена {price}",
  "call gamma": "гамма коллов",
  "put gamma": "гамма путов",
  "flip {flip} · call wall {call} · put wall {put}":
    "разворот {flip} · колл-стена {call} · пут-стена {put}",
  "{source} options, all expiries, {age}": "опционы {source}, все экспирации, {age}",
  "IV move": "IV-движение",
  "The expected move a day ahead: one and two standard deviations either side of the price":
    "Ожидаемое движение на день вперёд: одно и два стандартных отклонения по обе стороны от цены",
};
