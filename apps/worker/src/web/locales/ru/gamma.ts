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
};
