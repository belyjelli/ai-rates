import type { Catalog } from "../../i18n";

/**
 * The Rates page's Gamma Exposure tab (web/gamma.ts), its chart readout (web/slot-chart.ts) and the
 * page's two tab labels. Glossary and style: ./index.ts.
 *
 * Terms: gamma exposure гамма-экспозиция (GEX left as written), option опцион, call колл (calls
 * коллы), put пут (puts путы), strike страйк, expiry экспирация, spot спот, dealer дилер, flip точка
 * разворота (разворот in short labels), call wall / put wall колл-стена / пут-стена, hedging
 * хеджирование, long / short gamma длинная / короткая гамма, option book книга опционов, net нетто.
 * Greek names and Black-76 stay as Russian option desks write them; index, ETF and stock names
 * stay in Latin letters, as Russian financial media print them.
 */
export const gamma: Catalog = {
  "Funding rates": "Ставки финансирования",
  Funding: "Фандинг",
  "Gamma Exposure": "Гамма-экспозиция",
  Gamma: "Гамма",
  "Next: {date}": "Ближайшая: {date}",
  "Next expiry": "Ближайшая экспирация",
  "7 days": "7 дней",
  "30 days": "30 дней",
  "All expiries": "Все экспирации",
  "Option book": "Книга опционов",
  Expiries: "Экспирации",
  "spot {price}": "спот {price}",
  "net {net} per 1% move at spot {spot} · {bars} · hover or tap a strike to read it":
    "нетто {net} на 1% движения при споте {spot} · {bars} · наведите или нажмите на страйк, чтобы прочитать",
  "bars are each strike's calls and puts": "бары — коллы и путы каждого страйка",
  "bars are each strike's calls and puts added": "бары — сумма коллов и путов каждого страйка",
  "Net long": "Нетто-лонг",
  "Net short": "Нетто-шорт",
  "short gamma": "короткая гамма",
  "long gamma": "длинная гамма",
  View: "Вид",
  view: "вид",
  "calls/puts": "коллы/путы",
  "Each strike's calls above zero and its puts below":
    "Коллы каждого страйка выше нуля, путы — ниже",
  net: "нетто",
  "One bar per strike: its calls and puts added": "Один бар на страйк: сумма его коллов и путов",
  zones: "зоны",
  "Net bars, with the prices shaded where dealers would be short gamma or long it":
    "Нетто-бары с затенёнными ценами, где дилеры были бы в короткой или длинной гамме",
  "The view switch beside the cursor draws the bars three ways: calls/puts, each strike's calls above zero and its puts below; net, the two added into one bar; and zones, the net bars with the prices shaded where the line is below zero (dealers short gamma, red) or above it (long gamma, blue).":
    "Переключатель вида рядом с курсором рисует бары тремя способами: коллы/путы — коллы каждого страйка выше нуля, путы ниже; нетто — оба сложены в один бар; зоны — нетто-бары с затенёнными ценами, где линия ниже нуля (дилеры в короткой гамме, красный) или выше (длинная гамма, синий).",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of exposure, either sign.":
    "Страйки дальше ±{pct} от спота не показаны: экспозиция {usd} с любым знаком.",
  "flip {price}": "разворот {price}",
  "{currency} · {source} options · gamma exposure by strike · {scope}":
    "{currency} · опционы {source} · гамма-экспозиция по страйкам · {scope}",
  Calls: "Коллы",
  Puts: "Путы",
  "Net if the spot moved there": "Нетто, если бы спот был там",
  Spot: "Спот",
  "{currency} strike bands; arrow keys read one at a time":
    "Диапазоны страйков {currency}; стрелки читают по одному",
  "{currency} options gamma exposure by strike": "Гамма-экспозиция опционов {currency} по страйкам",
  "net gamma keeps one sign within ±30% of the spot":
    "нетто-гамма не меняет знак в пределах ±30% от спота",
  "{pct} from spot; net gamma changes sign here": "{pct} от спота; здесь нетто-гамма меняет знак",
  "Net gamma exposure": "Нетто гамма-экспозиция",
  "per 1% move · dealers long gamma: their hedging damps moves":
    "на 1% движения · дилеры в длинной гамме: их хеджирование гасит движения",
  "per 1% move · dealers short gamma: their hedging adds to moves":
    "на 1% движения · дилеры в короткой гамме: их хеджирование усиливает движения",
  "Gamma flip": "Точка разворота гаммы",
  "Call wall / put wall": "Колл-стена / пут-стена",
  "the strikes holding the most call and put gamma": "страйки с наибольшей гаммой коллов и путов",
  "calls / puts at the spot · put/call {ratio} · {options} options, {expiries} expiries":
    "коллы / путы по споту · put/call {ratio} · опционов: {options}, экспираций: {expiries}",
  "calls / puts at the spot · put/call {ratio} · {options} options, one expiry":
    "коллы / путы по споту · put/call {ratio} · опционов: {options}, одна экспирация",
  "By expiry": "По экспирациям",
  Expiry: "Экспирация",
  Left: "Осталось",
  Options: "Опционов",
  "Call OI ({unit})": "OI коллов ({unit})",
  "Put OI ({unit})": "OI путов ({unit})",
  Net: "Нетто",
  "Of the chain's exposure, either sign counted":
    "Доля всей экспозиции цепочки, с учётом обоих знаков",
  Share: "Доля",
  "Exposure in dollars per 1% move. Expiries outside the chosen range are dimmed. Every Deribit option expires at 08:00 UTC; one in its last hour is left out.":
    "Экспозиция в долларах на 1% движения. Экспирации вне выбранного диапазона приглушены. Все опционы Deribit истекают в 08:00 UTC; опцион в последний час до экспирации не учитывается.",
  "Gamma exposure is how much of the underlying the holders of its options would have to buy or sell to stay hedged for a 1% move in price: each option's gamma times its open interest, per 1% move in the currency the contract pays, added up by strike.":
    "Гамма-экспозиция — это объём базового актива, который держателям опционов пришлось бы купить или продать, чтобы оставаться в хедже при движении цены на 1%: гамма каждого опциона, умноженная на его открытый интерес, на 1% движения в валюте расчётов по контракту, просуммированная по страйкам.",
  "Calls count positive and puts negative. That is the standard reading, and an assumption: it takes dealers to be long the calls customers sold them and short the puts customers bought. No exchange publishes who holds which side, so every signed figure here rests on it; where open interest and gamma sit does not.":
    "Коллы считаются со знаком плюс, путы — со знаком минус. Это стандартное прочтение и одновременно допущение: предполагается, что дилеры в лонге по коллам, которые им продали клиенты, и в шорте по путам, которые клиенты купили. Ни одна биржа не публикует, кто на какой стороне, поэтому все значения со знаком здесь опираются на это допущение; то, где находятся открытый интерес и гамма, — нет.",
  "Positive net exposure means dealers sell into rises and buy into falls, which tends to damp moves; negative means they chase the price, which tends to add to them. The flip is where the net would change sign were the spot to move there, and the line shows the net at every such price. The walls are the strikes holding the most call and put gamma.":
    "Положительная нетто-экспозиция означает, что дилеры продают на росте и покупают на падении, что обычно гасит движения; отрицательная — что они следуют за ценой, что обычно их усиливает. Точка разворота — цена, при переходе спота к которой нетто сменило бы знак; линия показывает нетто при каждой такой цене. Стены — страйки с наибольшей гаммой коллов и путов.",
  "Crypto: Deribit's BTC and ETH books, which hold most listed crypto options; Bybit, OKX and Binance list far fewer and are not included. Open interest, mark volatility and each expiry's forward are Deribit's own; gamma is computed from them with Black-76, which reproduces Deribit's own delta and vega. Read every five minutes.":
    "Криптовалюта: книги BTC и ETH на Deribit, где сосредоточена большая часть биржевых криптоопционов; на Bybit, OKX и Binance опционов гораздо меньше, и они не учитываются. Открытый интерес, волатильность маркировки и форвард каждой экспирации — данные самой Deribit; гамма рассчитывается по ним через Black-76, что воспроизводит собственные дельту и вегу Deribit. Обновляется каждые пять минут.",
  "United States: Cboe's 15-minute delayed chains for the S&amp;P 500, Nasdaq-100 and Russell 2000 indexes and the most traded ETFs and stocks, with Cboe's own volatility and open interest, the spot taken as the forward. Read every 15 minutes through the US session; outside it the figures are the last session's.":
    "США: цепочки Cboe с задержкой 15 минут по индексам S&amp;P 500, Nasdaq-100 и Russell 2000 и самым торгуемым ETF и акциям, с собственными волатильностью и открытым интересом Cboe; спот принимается за форвард. Обновляется каждые 15 минут в американскую сессию; вне её показаны данные последней сессии.",
  "Asia-Pacific and Europe: each exchange's end-of-day file, read once after it is published -- HKEX (Hang Seng indexes), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, its three nearest months), ASX (S&amp;P/ASX 200), NSE and BSE (Nifty, Sensex) and Eurex (Euro Stoxx 50, DAX, SMI). They publish settlement prices and open interest but no volatility, so each strike's is backed out of its out-of-the-money settlement (for ASX, its closing theoretical price) with Black-76, against the forward that put-call parity or the exchange's own future gives. Their figures are in the currency the contract pays, and as of that day's close.":
    "АТР и Европа: файл каждой биржи по итогам дня, читается один раз после публикации — HKEX (индексы Hang Seng), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, три ближайших месяца), ASX (S&amp;P/ASX 200), NSE и BSE (Nifty, Sensex) и Eurex (Euro Stoxx 50, DAX, SMI). Они публикуют расчётные цены и открытый интерес, но не волатильность, поэтому волатильность каждого страйка выводится по Black-76 из расчётной цены его опциона вне денег (для ASX — из теоретической цены на закрытие), относительно форварда из паритета пут-колл или собственного фьючерса биржи. Значения — в валюте расчётов по контракту, на закрытие того дня.",
  "The options data could not be read right now.":
    "Данные по опционам сейчас не удалось прочитать.",
  "No gamma exposure has been computed for {currency} yet.":
    "Гамма-экспозиция для {currency} ещё не рассчитана.",
  "{source}'s {currency} options were last read {ago}, too long ago to show as current positioning.":
    "Опционы {currency} на {source} последний раз читались {ago} — слишком давно, чтобы показывать их как текущее позиционирование.",
  "Not updated since {ago}: the latest read of {source} failed, so these figures are that old.":
    "Последнее обновление — {ago}: последнее чтение {source} не удалось, поэтому данные такой давности.",
  "Not updated since {ago}: nothing newer has been read from {source}, a holiday or a failed read, so these figures are that old.":
    "Последнее обновление — {ago}: более свежих данных с {source} не поступало (выходной или сбой чтения), поэтому данные такой давности.",
  "No expiry in this range": "В этом диапазоне нет экспираций",
  "No {currency} option expires in this range; the nearest expires {date}.":
    "В этом диапазоне нет экспираций опционов {currency}; ближайшая — {date}.",
  "No strike has open interest in this range.":
    "В этом диапазоне ни у одного страйка нет открытого интереса.",
  "Calls positive, puts negative: dealers assumed long calls and short puts, since no exchange publishes who holds which side. {source} options, {asof}.":
    "Коллы со знаком плюс, путы — минус: предполагается, что дилеры в лонге по коллам и в шорте по путам, так как ни одна биржа не публикует, кто на какой стороне. Опционы {source}, {asof}.",
  "read {ago}": "прочитано {ago}",
  "15-minute delayed, read {ago}": "задержка 15 минут, прочитано {ago}",
  "from the end-of-day file for {date}": "из файла по итогам дня за {date}",
  expired: "истекла",
  "Call OI": "OI коллов",
  "Put OI": "OI путов",
  "Exposure in {unit} per 1% move; open interest at its value at the spot. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Экспозиция в {unit} на 1% движения; открытый интерес — по стоимости при текущем споте. Экспирации вне выбранного диапазона приглушены; опцион в последний час до экспирации не учитывается.",
  // The book picker.
  "Pick an option book": "Выберите книгу опционов",
  "{n} books": "книг: {n}",
  "Filter books": "Фильтр книг",
  Book: "Книга",
  "Net gamma": "Нетто-гамма",
  "Every expiry, per 1% move, in the currency the contract pays":
    "Все экспирации, на 1% движения, в валюте расчётов по контракту",
  "Calls / puts": "Коллы / путы",
  Flip: "Разворот",
  "Where net gamma changes sign, from the spot": "Где нетто-гамма меняет знак, относительно спота",
  "As of": "На момент",
  "No book matches.": "Нет подходящих книг.",
  "calls {calls} · puts {puts}": "коллы {calls} · путы {puts}",
  "close {date}": "закрытие {date}",
  Crypto: "Криптовалюта",
  "United States": "США",
  "Asia-Pacific": "АТР",
  Europe: "Европа",
  Other: "Другое",
  Bitcoin: "Биткоин",
  Ether: "Эфир",
  "S&P 500": "S&P 500",
  "Nasdaq-100": "Nasdaq-100",
  "Russell 2000": "Russell 2000",
  "SPDR S&P 500 ETF": "SPDR S&P 500 ETF",
  "Invesco QQQ": "Invesco QQQ",
  "iShares Russell 2000 ETF": "iShares Russell 2000 ETF",
  "SPDR Gold Shares": "SPDR Gold Shares (золото)",
  "iShares Silver Trust": "iShares Silver Trust (серебро)",
  "United States Oil Fund": "United States Oil Fund (нефть)",
  "iShares Bitcoin Trust": "iShares Bitcoin Trust (биткоин)",
  "iShares Ethereum Trust": "iShares Ethereum Trust (эфир)",
  Strategy: "Strategy (MicroStrategy)",
  Coinbase: "Coinbase",
  NVIDIA: "NVIDIA",
  Tesla: "Tesla",
  Micron: "Micron",
  "Hang Seng": "Hang Seng",
  "Hang Seng China Enterprises": "Hang Seng China Enterprises",
  "Hang Seng TECH": "Hang Seng TECH",
  "CSI 300": "CSI 300",
  "SSE 50": "SSE 50",
  "CSI 1000": "CSI 1000",
  TAIEX: "TAIEX (Тайвань)",
  "Nikkei 225": "Nikkei 225 (Япония)",
  "S&P/ASX 200": "S&P/ASX 200 (Австралия)",
  "Nifty 50": "Nifty 50",
  "Nifty Bank": "Nifty Bank",
  "BSE Sensex": "BSE Sensex",
  "Euro Stoxx 50": "Euro Stoxx 50",
  DAX: "DAX",
  "Swiss Market Index": "Швейцарский индекс SMI",
  // Chart readout (slot-chart.ts).
  "strike {strikes} ({pct} from spot)": "страйк {strikes} ({pct} от спота)",
  "{low} – {high} ({pct} from spot)": "{low} – {high} ({pct} от спота)",
  "no open interest here": "здесь нет открытого интереса",
  "calls {usd} ({oi} open)": "коллы {usd} (OI {oi})",
  "puts {usd} ({oi} open)": "путы {usd} (OI {oi})",
  "net {usd}": "нетто {usd}",
  "if the spot were here: net {usd}": "если бы спот был здесь: нетто {usd}",
  "Expected price move": "Ожидаемое движение цены",
  "1 day ahead": "1 день вперёд",
  "1 week ahead": "1 неделя вперёд",
  "30 days ahead": "30 дней вперёд",
  "to the {date} expiry": "до экспирации {date}",
  "IV {iv}": "IV {iv}",
  "ATM IV": "ATM IV",
  "Implied volatility at the expiry's forward, a year":
    "Подразумеваемая волатильность на форварде экспирации, годовая",
  "closed inside 1σ on {one} and 2σ on {two} of days since {year}":
    "с {year} года закрывался внутри 1σ в {one} дней и внутри 2σ в {two}",
  "expected move, 1σ and 2σ, {horizon}": "ожидаемое движение, 1σ и 2σ, {horizon}",
  "spot · {source} IV": "спот · IV {source}",
  "One standard deviation is the price × IV × √(days/365), from each expiry's at-the-money implied volatility (between two expiries, their total variance interpolated). The walls are one and two deviations either side of the spot. A normal distribution ends inside them 68% and 95% of the time; real prices have fatter tails, and options usually price in more movement than follows.":
    "Одно стандартное отклонение = цена × IV × √(дни/365), по подразумеваемой волатильности на деньгах для каждой экспирации (между двумя экспирациями интерполируется суммарная дисперсия). Стены стоят на одно и два отклонения по обе стороны от спота. Нормальное распределение заканчивается внутри них в 68% и 95% случаев; у реальных цен хвосты толще, а опционы обычно закладывают больше движения, чем происходит потом.",
  "The last line of a branch is how often it really did, from Deribit's 30-day volatility index (DVOL) and the perpetual's daily settlement: one 30-day IV for every horizon, and overlapping windows, so frequencies rather than independent trials.":
    "Последняя строка ветки — как часто так было на деле, по 30-дневному индексу волатильности Deribit (DVOL) и ежедневному расчёту бессрочного контракта: одна 30-дневная IV для всех горизонтов и перекрывающиеся окна, поэтому это частоты, а не независимые испытания.",
  "The expected move is the range the options have priced in: one standard deviation is the price times the at-the-money implied volatility times the square root of the days ahead over 365, and the walls sit one and two deviations either side of the spot. The chart draws them for the chosen expiries (30 days ahead for all of them); the mind map under it gives every horizon. They are not support or resistance, only the market's own estimate of how far price may travel.":
    "Ожидаемое движение — диапазон, заложенный в цены опционов: одно стандартное отклонение равно цене, умноженной на подразумеваемую волатильность на деньгах и на квадратный корень из числа дней вперёд, делённого на 365; стены стоят на одно и два отклонения по обе стороны от спота. График рисует их для выбранных экспираций (для всех — на 30 дней вперёд), а интеллект-карта под ним — для каждого горизонта. Это не поддержка и не сопротивление, а лишь собственная оценка рынка того, как далеко может уйти цена.",
  reference: "опора",
  Level: "Уровень",
  "From the reference": "От опорной цены",
  "the next session": "следующая сессия",
  "{date}, from 08:00 UTC": "{date}, с 08:00 UTC",
  "{date} session": "сессия {date}",
  "no trade yet today": "сегодня ещё нет сделок",
  "above it now": "сейчас выше",
  "below it now": "сейчас ниже",
  "reached it today and back inside": "сегодня касалась и вернулась внутрь",
  "inside all day so far": "весь день пока внутри",
  "No history is kept for this book's walls yet, so its 90% wall is the normal distribution's 1.645 standard deviations of the options' own IV, not a measured one. Its record starts with its first day below.":
    "Для стен этой книги истории пока нет, поэтому её 90%-стена — это 1,645 стандартного отклонения нормального распределения от собственной IV опционов, а не измеренная. Её запись начинается с первого дня ниже.",
  "Measured on {days} sessions since {since} {year}, against Cboe's 1-day VIX: the S&amp;P 500 closed inside one standard deviation on {inside1}, and within {k90} of them on 90%, so that is where the 90% wall sits. Cboe's free history has the index's closes only, so touches of a wall during the day are not counted here; this book's own record below counts them.":
    "Измерено на {days} сессиях с {since} {year} по однодневному VIX от Cboe: S&amp;P 500 закрывался внутри одного стандартного отклонения в {inside1} случаев, а внутри {k90} — в 90%, там и стоит 90%-стена. Бесплатная история Cboe содержит только закрытия индекса, поэтому касания стены внутри дня здесь не считаются; их считает собственная запись этой книги ниже.",
  "Measured on {days} Deribit days since {since} {year}, against the 30-day volatility index (DVOL) as each day began: the whole day stayed within {k90} standard deviations on 90% of days, so that is where the 90% wall sits. Within one, the whole day stayed on {inside1} and the close on {close1}. A touch of the 1σ wall closed back inside {rev1} of {touch1} times; a touch of the 90% wall, {rev90} of {touch90} times.":
    "Измерено на {days} днях Deribit с {since} {year} по 30-дневному индексу волатильности (DVOL) на начало каждого дня: в 90% дней весь день оставался в пределах {k90} стандартных отклонений, там и стоит 90%-стена. В пределах одного весь день оставался в {inside1} случаев, закрытие — в {close1}. Касание 1σ-стены закрывалось обратно внутри в {rev1} из {touch1} раз; касание 90%-стены — в {rev90} из {touch90}.",
  "not reached": "не достигнута",
  "reached, closed back inside": "достигнута, закрытие внутри",
  "closed beyond": "закрытие за ней",
  "above: {what}": "выше: {what}",
  "below: {what}": "ниже: {what}",
  "The IV wall is the move the options price for the day: the reference close plus and minus one standard deviation, the close times the options' implied volatility a day ahead times the square root of 1/365. The levels are fixed when the day begins (Deribit's day at 08:00 UTC, a US session at its first read) so they do not drift through the day.":
    "IV-стена — это движение, которое опционы закладывают на день: опорное закрытие плюс-минус одно стандартное отклонение, то есть закрытие × подразумеваемая волатильность опционов на день вперёд × √(1/365). Уровни фиксируются в начале дня (день Deribit — с 08:00 UTC, сессия США — при первом чтении) и не дрейфуют в течение дня.",
  "The 90% wall is where history says price stayed: the multiple of a day's standard deviation that held on 90% of past days. BTC and ETH are measured on every Deribit day since 2021 against DVOL, their whole day's range; the S&amp;P 500 on every session since 2022 against Cboe's 1-day VIX, closes only. A book with no history uses the normal distribution's 1.645.":
    "90%-стена — это то, где, по истории, оставалась цена: множитель дневного стандартного отклонения, который держался в 90% прошедших дней. BTC и ETH измерены на каждом дне Deribit с 2021 года по DVOL, по диапазону всего дня; S&amp;P 500 — на каждой сессии с 2022 года по однодневному VIX от Cboe, только по закрытиям. Книга без истории использует 1,645 нормального распределения.",
  "A wall is a probability, not a promise: a touch of the IV wall has closed back inside a little over half the time, not nine times in ten. The record under the ladder shows each day's outcome for this book.":
    "Стена — это вероятность, а не обещание: после касания IV-стены цена закрывалась обратно внутри чуть больше чем в половине случаев, а не в девяти из десяти. Запись под лестницей показывает исход каждого дня для этой книги.",
  "{currency}'s options carry no implied volatility to draw walls from yet.":
    "У опционов {currency} пока нет подразумеваемой волатильности, чтобы построить стены.",
  "1.645 standard deviations of the options' IV (normal distribution)":
    "1,645 стандартного отклонения от IV опционов (нормальное распределение)",
  "{k90} standard deviations of {method} {sigma}, measured":
    "{k90} стандартного отклонения от {method} {sigma}, измерено",
  "IV wall, 1σ": "IV-стена, 1σ",
  "±{move} (±{pct}) from IV {iv} a day ahead": "±{move} (±{pct}) при IV {iv} на день вперёд",
  "90% wall": "90%-стена",
  "The day so far": "День на сейчас",
  Reference: "Опора",
  "high {high} · low {low}": "макс. {high} · мин. {low}",
  "IV wall: {status}": "IV-стена: {status}",
  "the latest close, for the next session": "последнее закрытие, для следующей сессии",
  "Reference close": "Опорное закрытие",
  "{currency} · {source} options · IV walls · {day}":
    "{currency} · опционы {source} · IV-стены · {day}",
  "The day's range": "Диапазон дня",
  "IV wall": "IV-стена",
  "90% wall, above": "90%-стена, выше",
  "IV wall, above": "IV-стена, выше",
  "1σ of the options' IV": "1σ от IV опционов",
  "IV wall, below": "IV-стена, ниже",
  "90% wall, below": "90%-стена, ниже",
  "{currency} comes from an end-of-day file, so its walls are for the next session and are not kept day by day.":
    "{currency} берётся из файла на конец дня, поэтому его стены — для следующей сессии и по дням не ведутся.",
  "{currency}'s own record starts with today; each finished day is added here.":
    "Собственная запись {currency} начинается сегодня; каждый завершённый день добавляется сюда.",
  "{currency}'s own record, {days} finished days since {since}. IV wall: touched {reached}, closed back inside {held}. 90% wall: touched {reached90}, closed back inside {held90}.":
    "Собственная запись {currency}, {days} завершённых дней с {since}. IV-стена: касаний {reached}, закрытий внутри {held}. 90%-стена: касаний {reached90}, закрытий внутри {held90}.",
  "High / low": "Макс. / мин.",
  Close: "Закрытие",
  "At the IV wall": "У IV-стены",
  "At the 90% wall": "У 90%-стены",
  "How price has behaved at the walls": "Как цена вела себя у стен",
  "Prices in {unit}. {source} options, read {ago}.":
    "Цены в {unit}. Опционы {source}, прочитано {ago}.",
  "Two readings of where the market makers stand, side by side, for the nearest expiry. The gamma ceiling is the strike above the spot holding the most call gamma, and the gamma floor the strike below it holding the most put gamma: where hedging flows are largest.":
    "Два прочтения того, где стоят маркет-мейкеры, рядом, по ближайшей экспирации. Гамма-потолок — страйк выше спота с наибольшей колл-гаммой, гамма-пол — страйк ниже спота с наибольшей пут-гаммой: там потоки хеджирования крупнее всего.",
  "The dealer range reads every option as sold by dealers who keep the premium, as max pain does: at expiry they pay out what the options are worth, so they earn most at the max pain strike and start losing beyond the break-evens either side, the dealer ceiling and floor. No exchange publishes who sold what, so this rests on that assumption, and the Gamma Exposure tab's sign assumes the opposite for calls.":
    "Дилерский диапазон считает каждый опцион проданным дилерами, которые оставляют себе премию, как и max pain: при экспирации они выплачивают стоимость опционов, поэтому больше всего зарабатывают на страйке max pain и начинают терять за точками безубыточности по обе стороны — дилерским потолком и полом. Ни одна биржа не публикует, кто что продал, поэтому это держится на допущении, а знак на вкладке гамма-экспозиции для коллов предполагает обратное.",
  "A ceiling or floor within a quarter of the day's move of an IV wall is marked as lined up with it. Whether price turns there more often than elsewhere is what the record under the ladder is for: it starts with this tab and grows a day at a time.":
    "Потолок или пол в пределах четверти дневного движения от IV-стены отмечается как совпадающий с ней. Разворачивается ли цена там чаще, чем в других местах, покажет запись под лестницей: она начинается с этой вкладки и растёт по дню.",
  "gamma ceiling": "гамма-потолок",
  "dealer ceiling": "дилерский потолок",
  "gamma floor": "гамма-пол",
  "dealer floor": "дилерский пол",
  "Gamma ceiling / floor": "Гамма-потолок / пол",
  "the strikes holding the most call gamma above the spot and put gamma below it, expiring {expiry}":
    "страйки с наибольшей колл-гаммой выше спота и пут-гаммой ниже, экспирация {expiry}",
  "Dealer ceiling / floor": "Дилерский потолок / пол",
  "where dealers who sold every option of that expiry break even; max pain {pain}":
    "где дилеры, продавшие все опционы этой экспирации, выходят в ноль; max pain {pain}",
  "Lined up with an IV wall": "Совпадает с IV-стеной",
  "within a quarter of the day's 1σ move ({band}) of an IV wall or a 90% wall":
    "в пределах четверти дневного 1σ-движения ({band}) от IV-стены или 90%-стены",
  "max pain": "max pain",
  "{currency} · {source} options · ceiling and floor · expiring {expiry}":
    "{currency} · опционы {source} · потолок и пол · экспирация {expiry}",
  "dealer ceiling and floor": "дилерский потолок и пол",
  "lined up with a wall": "совпадает со стеной",
  "Dealer range by expiry": "Дилерский диапазон по экспирациям",
  Premium: "Премия",
  "Dealer floor": "Дилерский пол",
  "Max pain": "Max pain",
  "Dealer ceiling": "Дилерский потолок",
  "From the spot": "От спота",
  "Lined up with a wall": "Совпадает со стеной",
  "{currency} comes from an end-of-day file, so its levels are for the next session and are not kept day by day.":
    "{currency} берётся из файла на конец дня, поэтому его уровни — для следующей сессии и по дням не ведутся.",
  Days: "Дни",
  Reached: "Касания",
  "Closed back inside": "Закрытие внутри",
  "Over {days} finished days since {since}, both sides counted; a level is reached when the day's high (or low) touches it, and held when the day closes back inside it.":
    "За {days} завершённых дней с {since}, обе стороны; уровень достигнут, если его коснулся максимум (или минимум) дня, и удержан, если день закрылся внутри.",
  "How price has behaved at these levels": "Как цена вела себя у этих уровней",
  "IV Walls": "IV-стены",
  "IV walls": "IV-стены",
  "Ceiling & Floor": "Потолок и пол",
  Ceiling: "Потолок",
  "the spot now": "спот сейчас",
  "week from {date}": "неделя с {date}",
  "Levels for": "Уровни за",
  "The Day and Week switch reads the same levels for the nearest expiry or for the week's: Deribit's Friday 08:00 UTC weekly, or a US book's last expiry of the week. The week's levels are fixed by its first read, its IV walls span the time to that expiry, and its 90% wall is measured on whole past weeks where there is history.":
    "Переключатель «день / неделя» показывает те же уровни для ближайшей экспирации или для недельной: недельной Deribit в пятницу в 08:00 UTC или последней экспирации недели для книг США. Уровни недели фиксируются её первым чтением, её IV-стены охватывают время до этой экспирации, а 90%-стена измеряется на целых прошлых неделях там, где есть история.",
  "the strikes holding the most call gamma above the spot and put gamma below it, in everything expiring by {expiry}":
    "страйки с наибольшей колл-гаммой выше спота и пут-гаммой ниже среди всего, что истекает до {expiry}",
  "within a quarter of the week's 1σ move ({band}) of an IV wall or a 90% wall":
    "в пределах четверти недельного 1σ-движения ({band}) от IV-стены или 90%-стены",
  "The week so far": "Неделя на сейчас",
  "the spot now; this week's levels are fixed by its first read":
    "спот сейчас; уровни этой недели фиксируются её первым чтением",
  "{currency}'s weekly record starts with this week; each finished week is added here.":
    "Недельная запись {currency} начинается с этой недели; каждая завершённая неделя добавляется сюда.",
  Weeks: "Недели",
  "Over {weeks} finished weeks since {since}, both sides counted; a level is reached when the week's high (or low) touches it, and held when the week closes back inside it.":
    "За {weeks} завершённых недель с {since}, обе стороны; уровень достигнут, если его коснулся максимум (или минимум) недели, и удержан, если неделя закрылась внутри.",
  "{currency} · {source} options · IV walls day by day":
    "{currency} · опционы {source} · IV-стены по дням",
  "{currency} · {source} options · ceiling and floor day by day":
    "{currency} · опционы {source} · потолок и пол по дням",
  "daily candle": "дневная свеча",
  "week's expiry": "недельная экспирация",
  "Each day's candle under the walls it opened with. The walls are fixed by the day's first read, so they move only from one day to the next.":
    "Свеча каждого дня под стенами, с которыми он открылся. Стены фиксируются первым чтением дня, поэтому меняются только от одного дня к следующему.",
  "Each day's candle under the levels it opened with. They are fixed by the day's first read, so they move only from one day to the next; the dotted rule marks each week's expiry.":
    "Свеча каждого дня под уровнями, с которыми он открылся. Они фиксируются первым чтением дня, поэтому меняются только от одного дня к следующему; пунктир отмечает экспирацию каждой недели.",
  "Each day's candle under its week's levels. They are fixed by the week's first read, so they move only at a week's expiry, the dotted rule.":
    "Свеча каждого дня под уровнями его недели. Они фиксируются первым чтением недели, поэтому меняются только на недельной экспирации, у пунктира.",
  // The Delta, Vega and Theta tabs (web/greeks.ts).
  Delta: "Дельта",
  "{currency} · {source} options · delta by strike · {scope}":
    "{currency} · опционы {source} · дельта по страйкам · {scope}",
  "{currency} · {source} options · vega by strike · {scope}":
    "{currency} · опционы {source} · вега по страйкам · {scope}",
  "{currency} · {source} options · theta by strike · {scope}":
    "{currency} · опционы {source} · тета по страйкам · {scope}",
  "net {net} at spot {spot} · calls above zero, puts below · hover or tap a strike to read it":
    "нетто {net} при споте {spot} · коллы выше нуля, путы ниже · наведите или нажмите на страйк, чтобы прочитать",
  "{total} per IV point at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "{total} на пункт IV при споте {spot} · коллы и путы каждого страйка сложены · наведите или нажмите на страйк, чтобы прочитать",
  "{total} a day at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "{total} в день при споте {spot} · коллы и путы каждого страйка сложены · наведите или нажмите на страйк, чтобы прочитать",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of the total.":
    "Страйки дальше ±{pct} от спота не показаны: {usd} от общего итога.",
  "total {usd}": "итого {usd}",
  "{share} of it in that expiry, {left} left": "{share} — в этой экспирации, осталось {left}",
  "≈ {coins} at the spot; what the open options move like, as their buyers hold them":
    "≈ {coins} по споту; сколько базового актива повторяют открытые опционы для их покупателей",
  "what the open options move like, as their buyers hold them":
    "сколько базового актива повторяют открытые опционы для их покупателей",
  "Net delta": "Нетто-дельта",
  "calls' delta is positive, puts' negative": "дельта коллов положительна, путов — отрицательна",
  "Most delta": "Больше всего дельты",
  Vega: "Вега",
  "per IV point: what the open options gain if implied volatility rises one point, and their writers lose":
    "на пункт IV: сколько открытые опционы выигрывают при росте подразумеваемой волатильности на пункт, а их продавцы теряют",
  "every option gains as implied volatility rises":
    "при росте подразумеваемой волатильности дорожает любой опцион",
  "Most vega": "Больше всего веги",
  "of the options' value a day, {premium} in all": "стоимости опционов в день, всего {premium}",
  Theta: "Тета",
  "a day: what the open options lose to time with price and IV unchanged, paid by their buyers to their writers":
    "в день: сколько открытые опционы теряют со временем при неизменных цене и IV — это платят покупатели продавцам",
  "every option loses value as expiry nears, faster the closer it is":
    "любой опцион дешевеет по мере приближения экспирации, и тем быстрее, чем она ближе",
  "Most theta": "Больше всего теты",
  "Decay rate": "Скорость распада",
  "Delta in {unit}: the value of the underlying each expiry's open options move like. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Дельта в {unit}: сколько базового актива повторяют открытые опционы каждой экспирации. Экспирации вне выбранного диапазона приглушены; опцион в последний час до экспирации не учитывается.",
  "Vega in {unit} per IV point. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Вега в {unit} на пункт IV. Экспирации вне выбранного диапазона приглушены; опцион в последний час до экспирации не учитывается.",
  "Theta in {unit} a day. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Тета в {unit} в день. Экспирации вне выбранного диапазона приглушены; опцион в последний час до экспирации не учитывается.",
  "Of the chain's total, either side counted": "Доля общего итога цепочки, с учётом обеих сторон",
  Total: "Итого",
  "Delta is how much an option's value moves with the underlying: about a half at the money, near 1 deep in the money and near 0 far out of it, negative for puts. Times open interest and the forward, it is the value of the underlying the open options move like, added up by strike.":
    "Дельта показывает, насколько стоимость опциона меняется вместе с базовым активом: около половины на деньгах, почти 1 глубоко в деньгах и почти 0 далеко вне денег, у путов — со знаком минус. Умноженная на открытый интерес и форвард, она показывает, сколько базового актива повторяют открытые опционы, с суммой по страйкам.",
  "It is read from the side of whoever bought the options: calls positive, puts negative. Whoever wrote them holds exactly the opposite, so were every writer hedged, their hedges would hold this much of the underlying. Nothing here assumes who is on which side, unlike gamma exposure.":
    "Она читается со стороны тех, кто купил опционы: коллы положительны, путы отрицательны. Продавцы держат ровно противоположное, поэтому если бы все продавцы хеджировались, их хеджи держали бы столько базового актива. В отличие от гамма-экспозиции, здесь ничего не предполагается о том, кто на какой стороне.",
  "Most delta sits in options already in the money, away from the spot, so this chart often reaches wider than the gamma chart.":
    "Большая часть дельты приходится на опционы, уже находящиеся в деньгах, вдали от спота, поэтому этот график часто шире графика гаммы.",
  "Vega is how much an option's value moves when implied volatility moves one point, say from 40% to 41%: largest at the money and for options with long to run. Times open interest, it is what the open options gain if IV rises a point, added up by strike.":
    "Вега показывает, насколько меняется стоимость опциона, когда подразумеваемая волатильность сдвигается на пункт, например с 40% до 41%: больше всего на деньгах и у опционов с долгим сроком. Умноженная на открытый интерес, она показывает, сколько открытые опционы выигрывают при росте IV на пункт, с суммой по страйкам.",
  "Every option carries positive vega for whoever bought it and the same amount negative for whoever wrote it, so the total is what option writers stand to lose if IV rises a point, and gain if it falls one.":
    "У покупателя любого опциона вега положительна, у продавца — такая же отрицательная, поэтому итог — это сколько продавцы опционов могут потерять при росте IV на пункт и заработать при падении на пункт.",
  "Theta is how much an option's value falls in a day with price and implied volatility unchanged: largest at the money and in an option's last days. Times open interest, it is what the open options lose in a day, added up by strike.":
    "Тета показывает, насколько стоимость опциона падает за день при неизменных цене и подразумеваемой волатильности: больше всего на деньгах и в последние дни до экспирации. Умноженная на открытый интерес, она показывает, сколько открытые опционы теряют за день, с суммой по страйкам.",
  "Buyers pay it and writers collect it: the total is roughly what option writers earn in a quiet day, the carry they are paid for taking on gamma. The decay rate divides it by what the options in range are worth.":
    "Её платят покупатели и получают продавцы: итог — это примерно то, что продавцы опционов зарабатывают за спокойный день, плата за то, что они берут на себя гамму. Скорость распада — это итог, делённый на стоимость опционов в диапазоне.",
  "The same books and reads as Gamma Exposure: Deribit's BTC and ETH every five minutes, Cboe's US chains every 15 minutes through the session, and the exchanges' end-of-day files for Asia-Pacific and Europe. Each option's Greeks are Black-76 at a zero rate on its own open interest, implied volatility and forward, in the currency the contract pays; they reproduce Deribit's own to within 0.03%.":
    "Те же книги и те же чтения, что и для гамма-экспозиции: BTC и ETH на Deribit каждые пять минут, американские цепочки Cboe каждые 15 минут в течение сессии и файлы бирж по итогам дня для АТР и Европы. Греки каждого опциона считаются по Black-76 при нулевой ставке из его собственных открытого интереса, подразумеваемой волатильности и форварда, в валюте расчётов по контракту; они воспроизводят собственные значения Deribit с точностью до 0,03%.",
  "Delta as the options' buyers hold it: calls positive, puts negative; whoever wrote them holds the opposite. {source} options, {asof}.":
    "Дельта так, как её держат покупатели опционов: коллы положительны, путы отрицательны; продавцы держат противоположное. Опционы {source}, {asof}.",
  "Vega as the options' buyers hold it, per point of implied volatility; whoever wrote them holds the opposite. {source} options, {asof}.":
    "Вега так, как её держат покупатели опционов, на пункт подразумеваемой волатильности; продавцы держат противоположное. Опционы {source}, {asof}.",
  "Theta as the options' buyers hold it, per day; whoever wrote them collects it. {source} options, {asof}.":
    "Тета так, как её держат покупатели опционов, в день; её получают продавцы. Опционы {source}, {asof}.",
  "Delta, vega and theta have not been computed for {currency} yet; they arrive with its next read.":
    "Дельта, вега и тета для {currency} ещё не рассчитаны; они появятся при следующем чтении.",
  // The Gamma Exposure tab's By expiry chart (web/gamma.ts) and its readout (web/slot-chart.ts).
  "Each expiry's calls above zero and its puts below, at their value at the spot":
    "Коллы каждой экспирации выше нуля, путы ниже, по стоимости при споте",
  "Each expiry's gamma exposure: calls above zero, puts below":
    "Гамма-экспозиция каждой экспирации: коллы выше нуля, путы ниже",
  gamma: "гамма",
  "Each expiry's at-the-money implied volatility: the term structure":
    "Подразумеваемая волатильность на деньгах для каждой экспирации: временная структура",
  show: "показать",
  "{n} expiries · open interest {calls} in calls, {puts} in puts · hover or tap an expiry to read it":
    "экспираций: {n} · открытый интерес {calls} в коллах, {puts} в путах · наведите или нажмите на экспирацию, чтобы прочитать",
  "{currency} · {source} options · by expiry": "{currency} · опционы {source} · по экспирациям",
  "{currency} expiries; arrow keys read one at a time":
    "Экспирации {currency}; стрелки читают по одной",
  "One bar per expiry in date order, so the gaps between them are not to scale; expiries outside the chosen range are dimmed.":
    "Один столбец на экспирацию по порядку дат, поэтому промежутки не в масштабе времени; экспирации вне выбранного диапазона приглушены.",
  "{date}, {left} left": "{date}, осталось {left}",
  "{n} options": "опционов: {n}",
  "calls {oi} open": "коллы: открыто {oi}",
  "puts {oi} open": "путы: открыто {oi}",
  "put/call {ratio}": "put/call {ratio}",
  "gamma {calls} / {puts}, net {net}": "гамма {calls} / {puts}, нетто {net}",
  "ATM IV {iv}": "ATM IV {iv}",
  "max pain {price}": "max pain {price}",
  "dealer range {low} – {high}": "дилерский диапазон {low} – {high}",
  "premium {usd}": "премия {usd}",
  // Reaction zones (web/confluence.ts).
  "reaction zone, today": "зона реакции, сегодня",
  "gamma wall": "гамма-стена",
  "dealer break-even": "дилерская точка безубыточности",
  "gamma flip": "разворот гаммы",
  "the spot is inside it now": "спот сейчас внутри неё",
  "{points} ({pct}) away, {sigmas} of the day's move":
    "{points} ({pct}) до неё, {sigmas} дневного движения",
  "No zone above": "Зоны выше нет",
  "No zone below": "Зоны ниже нет",
  "no IV wall lines up with a ceiling": "ни одна IV-стена не совпадает с потолком",
  "no IV wall lines up with a floor": "ни одна IV-стена не совпадает с полом",
  "Above the spot": "Выше спота",
  "Below the spot": "Ниже спота",
  zone: "зона",
  "Dealers long gamma ({net} per 1% move, every expiry): their hedging sells rises and buys dips, which is what lets a wall hold.":
    "Дилеры в длинной гамме ({net} на 1% движения, все экспирации): хеджируясь, они продают на росте и покупают на падении, поэтому стена и держится.",
  "Dealers short gamma ({net} per 1% move, every expiry): their hedging chases the price, so walls give way more easily and fading them is riskier.":
    "Дилеры в короткой гамме ({net} на 1% движения, все экспирации): их хеджирование гонится за ценой, стены пробиваются легче, и торговать от них рискованнее.",
  "Flip {price}, {pct} ({sigmas}).": "Разворот {price}, {pct} ({sigmas}).",
  "Since {year}, a touch of this book's 1σ wall closed back inside {rev1} of {touch1} times, of its 90% wall {rev90} of {touch90}: better than a coin toss, not nine in ten.":
    "С {year} года касание 1σ-стены этого инструмента закрывалось обратно внутри в {rev1} из {touch1} случаев, 90%-стены — в {rev90} из {touch90}: лучше подбрасывания монеты, но не девять из десяти.",
  "A zone is where an IV wall and a market maker's level fall within a quarter of the day's 1σ move of each other: a place to wait for a rejection, not a trade on its own, and least reliable when dealers are short gamma.":
    "Зона — это место, где IV-стена и уровень маркетмейкера лежат в пределах четверти дневного 1σ-движения друг от друга: место ждать отбоя, а не сделка сама по себе, и надёжна меньше всего, когда дилеры в короткой гамме.",
  "the week's 1σ move": "недельное 1σ-движение",
  "the day's 1σ move": "дневное 1σ-движение",
  "Reaction zones": "Зоны реакции",
  "σ is {unit}, {move}": "σ — {unit}, {move}",
  "between the IV walls": "между IV-стенами",
  "between the 90% walls": "между 90%-стенами",
  "each line's mark is beside its name below": "вид каждой линии — рядом с её названием ниже",
};
