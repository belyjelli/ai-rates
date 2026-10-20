import type { Catalog } from "../../i18n";

/**
 * The Rates page's Gamma Exposure tab (web/gamma.ts), its chart readout (web/slot-chart.ts) and the
 * page's two tab labels. Glossary and style: ./index.ts.
 *
 * Terms: gamma exposure 감마 익스포저 (GEX left as written), option 옵션, call 콜, put 풋, strike
 * 행사가, expiry 만기 (expiry date 만기일), spot 현물가, dealer 딜러, flip 플립, call wall / put wall
 * 콜 월 / 풋 월, hedging 헤지, option book 옵션 북, forward 선도가격, net 순액. Black-76 and the
 * exchanges' abbreviations (HKEX, CFFEX, TAIFEX, NSE, BSE, Eurex) stay in Latin letters, as Korean
 * brokers write them. The book names are plain text, escaped where they are shown, so "S&P" keeps
 * its "&" as written.
 */
export const gamma: Catalog = {
  "Funding rates": "펀딩비",
  Funding: "펀딩비",
  "Gamma Exposure": "감마 익스포저",
  Gamma: "감마",
  "Next: {date}": "다음: {date}",
  "Next expiry": "다음 만기",
  "7 days": "7일",
  "30 days": "30일",
  "All expiries": "전체 만기",
  "Option book": "옵션 북",
  Expiries: "만기",
  "spot {price}": "현물가 {price}",
  "net {net} per 1% move at spot {spot} · {bars} · hover or tap a strike to read it":
    "현물가 {spot}에서 1% 변동당 순액 {net} · {bars} · 행사가에 마우스를 올리거나 탭하여 확인",
  "bars are each strike's calls and puts": "막대는 행사가별 콜과 풋",
  "bars are each strike's calls and puts added": "막대는 행사가별 콜과 풋의 합",
  "Net long": "순 롱",
  "Net short": "순 숏",
  "short gamma": "숏 감마",
  "long gamma": "롱 감마",
  View: "보기",
  view: "보기",
  "calls/puts": "콜/풋",
  "Each strike's calls above zero and its puts below": "행사가별 콜은 0 위에, 풋은 0 아래에",
  net: "순액",
  "One bar per strike: its calls and puts added": "행사가마다 막대 하나: 콜과 풋의 합",
  zones: "구간",
  "Net bars, with the prices shaded where dealers would be short gamma or long it":
    "순액 막대와 함께, 딜러가 숏 감마 또는 롱 감마가 되는 가격대를 음영으로 표시",
  "The view switch beside the cursor draws the bars three ways: calls/puts, each strike's calls above zero and its puts below; net, the two added into one bar; and zones, the net bars with the prices shaded where the line is below zero (dealers short gamma, red) or above it (long gamma, blue).":
    "커서 옆의 보기 전환은 막대를 세 가지 방식으로 그립니다. 콜/풋은 행사가별 콜을 0 위에, 풋을 0 아래에 그립니다. 순액은 둘을 합쳐 막대 하나로 그립니다. 구간은 순액 막대와 함께, 선이 0 아래인 가격대(딜러 숏 감마, 빨간색)와 0 위인 가격대(롱 감마, 파란색)를 음영으로 표시합니다.",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of exposure, either sign.":
    "현물가 ±{pct} 밖의 행사가는 차트에 없습니다: 부호와 무관하게 익스포저 {usd}.",
  "flip {price}": "플립 {price}",
  "{currency} · {source} options · gamma exposure by strike · {scope}":
    "{currency} · {source} 옵션 · 행사가별 감마 익스포저 · {scope}",
  Calls: "콜",
  Puts: "풋",
  "Net if the spot moved there": "현물가가 그 가격으로 움직일 때의 순액",
  Spot: "현물가",
  "{currency} strike bands; arrow keys read one at a time":
    "{currency} 행사가 구간, 방향키로 하나씩 확인",
  "{currency} options gamma exposure by strike": "{currency} 옵션 행사가별 감마 익스포저",
  "net gamma keeps one sign within ±30% of the spot":
    "현물가 ±30% 안에서 순 감마의 부호가 바뀌지 않음",
  "{pct} from spot; net gamma changes sign here": "현물가 대비 {pct}; 여기서 순 감마의 부호가 바뀜",
  "Net gamma exposure": "순 감마 익스포저",
  "per 1% move · dealers long gamma: their hedging damps moves":
    "1% 변동당 · 딜러 롱 감마: 헤지가 변동을 완화",
  "per 1% move · dealers short gamma: their hedging adds to moves":
    "1% 변동당 · 딜러 숏 감마: 헤지가 변동을 키움",
  "Gamma flip": "감마 플립",
  "Call wall / put wall": "콜 월 / 풋 월",
  "the strikes holding the most call and put gamma": "콜·풋 감마가 가장 많이 몰린 행사가",
  "calls / puts at the spot · put/call {ratio} · {options} options, {expiries} expiries":
    "현물가 기준 콜 / 풋 · 풋/콜 {ratio} · 옵션 {options}개, 만기 {expiries}개",
  "calls / puts at the spot · put/call {ratio} · {options} options, one expiry":
    "현물가 기준 콜 / 풋 · 풋/콜 {ratio} · 옵션 {options}개, 만기 1개",
  "By expiry": "만기별",
  Expiry: "만기",
  Left: "잔여",
  Options: "옵션 수",
  "Call OI ({unit})": "콜 미결제약정 ({unit})",
  "Put OI ({unit})": "풋 미결제약정 ({unit})",
  Net: "순액",
  "Of the chain's exposure, either sign counted": "체인 전체 익스포저 대비 비중, 부호 무관",
  Share: "비중",
  "Exposure in dollars per 1% move. Expiries outside the chosen range are dimmed. Every Deribit option expires at 08:00 UTC; one in its last hour is left out.":
    "익스포저는 1% 변동당 달러 기준입니다. 선택한 범위 밖의 만기는 흐리게 표시됩니다. Deribit 옵션은 모두 08:00 UTC에 만기되며, 만기 전 마지막 1시간 안의 옵션은 제외합니다.",
  "Gamma exposure is how much of the underlying the holders of its options would have to buy or sell to stay hedged for a 1% move in price: each option's gamma times its open interest, per 1% move in the currency the contract pays, added up by strike.":
    "감마 익스포저는 가격이 1% 움직일 때 옵션 보유자가 헤지를 유지하려면 기초자산을 얼마나 사거나 팔아야 하는지를 나타냅니다: 각 옵션의 감마에 미결제약정을 곱해 계약의 결제 통화로 1% 변동당 금액을 구하고, 행사가별로 합산한 값입니다.",
  "Calls count positive and puts negative. That is the standard reading, and an assumption: it takes dealers to be long the calls customers sold them and short the puts customers bought. No exchange publishes who holds which side, so every signed figure here rests on it; where open interest and gamma sit does not.":
    "콜은 양수, 풋은 음수로 셉니다. 이는 표준적인 해석이자 가정입니다: 딜러가 고객이 판 콜을 롱으로, 고객이 산 풋을 숏으로 보유한다고 봅니다. 누가 어느 쪽을 보유하는지 공개하는 거래소는 없으므로 여기서 부호가 붙은 모든 수치는 이 가정에 기대고 있습니다. 미결제약정과 감마가 어디에 몰려 있는지는 이 가정과 무관합니다.",
  "Positive net exposure means dealers sell into rises and buy into falls, which tends to damp moves; negative means they chase the price, which tends to add to them. The flip is where the net would change sign were the spot to move there, and the line shows the net at every such price. The walls are the strikes holding the most call and put gamma.":
    "순 익스포저가 양수이면 딜러는 상승 시 팔고 하락 시 사므로 변동이 완화되는 경향이 있습니다. 음수이면 딜러가 가격을 따라가므로 변동이 커지는 경향이 있습니다. 플립은 현물가가 그곳으로 움직일 경우 순액의 부호가 바뀌는 지점이며, 선은 각 가격에서의 순액을 보여 줍니다. 콜 월과 풋 월은 콜·풋 감마가 가장 많이 몰린 행사가입니다.",
  "Crypto: Deribit's BTC and ETH books, which hold most listed crypto options; Bybit, OKX and Binance list far fewer and are not included. Open interest, mark volatility and each expiry's forward are Deribit's own; gamma is computed from them with Black-76, which reproduces Deribit's own delta and vega. Read every five minutes.":
    "암호화폐: 상장된 암호화폐 옵션의 대부분을 차지하는 Deribit의 BTC·ETH 옵션 북입니다. Bybit, OKX, Binance는 상장 옵션이 훨씬 적어 포함하지 않습니다. 미결제약정, 마크 변동성, 각 만기의 선도가격은 Deribit 자체 데이터이며, 감마는 이를 바탕으로 Black-76으로 계산해 Deribit 자체의 델타와 베가를 재현합니다. 5분마다 읽습니다.",
  "United States: Cboe's 15-minute delayed chains for the S&amp;P 500, Nasdaq-100 and Russell 2000 indexes and the most traded ETFs and stocks, with Cboe's own volatility and open interest, the spot taken as the forward. Read every 15 minutes through the US session; outside it the figures are the last session's.":
    "미국: S&amp;P 500, 나스닥 100, 러셀 2000 지수와 거래가 가장 많은 ETF·주식에 대한 Cboe의 15분 지연 옵션 체인입니다. 변동성과 미결제약정은 Cboe 자체 데이터이며, 현물가를 선도가격으로 씁니다. 미국 정규장 동안 15분마다 읽으며, 장외 시간에는 직전 세션의 수치입니다.",
  "Asia-Pacific and Europe: each exchange's end-of-day file, read once after it is published -- HKEX (Hang Seng indexes), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, its three nearest months), ASX (S&amp;P/ASX 200), NSE and BSE (Nifty, Sensex) and Eurex (Euro Stoxx 50, DAX, SMI). They publish settlement prices and open interest but no volatility, so each strike's is backed out of its out-of-the-money settlement (for ASX, its closing theoretical price) with Black-76, against the forward that put-call parity or the exchange's own future gives. Their figures are in the currency the contract pays, and as of that day's close.":
    "아시아·태평양·유럽: 각 거래소의 장 마감 파일을 발표 후 한 번 읽습니다 -- HKEX(항셍 지수 계열), CFFEX(CSI 300, SSE 50, CSI 1000), TAIFEX(대만 가권지수), JPX(닛케이 225, 가장 가까운 3개 월물), ASX(S&amp;P/ASX 200), NSE·BSE(니프티, 센섹스), Eurex(유로 스톡스 50, DAX, SMI). 이들 거래소는 정산가와 미결제약정은 공개하지만 변동성은 공개하지 않으므로, 각 행사가의 변동성은 외가격 옵션의 정산가(ASX는 장 마감 이론가)에서 Black-76으로 역산하며, 선도가격은 풋-콜 패리티 또는 거래소 자체 선물에서 구합니다. 수치는 계약의 결제 통화 기준이며, 그날 종가 시점입니다.",
  "The options data could not be read right now.": "지금은 옵션 데이터를 읽을 수 없습니다.",
  "No gamma exposure has been computed for {currency} yet.":
    "{currency}의 감마 익스포저는 아직 계산되지 않았습니다.",
  "{source}'s {currency} options were last read {ago}, too long ago to show as current positioning.":
    "{source}의 {currency} 옵션을 마지막으로 읽은 것이 {ago}이라, 현재 포지셔닝으로 보여 주기에는 너무 오래되었습니다.",
  "Not updated since {ago}: the latest read of {source} failed, so these figures are that old.":
    "{ago} 이후 업데이트되지 않음: {source}의 최근 읽기에 실패해 아래 수치는 그 시점의 것입니다.",
  "Not updated since {ago}: nothing newer has been read from {source}, a holiday or a failed read, so these figures are that old.":
    "{ago} 이후 업데이트되지 않음: 휴장 또는 읽기 실패로 {source}에서 더 새로운 데이터를 읽지 못해 아래 수치는 그 시점의 것입니다.",
  "No expiry in this range": "이 범위에 만기 없음",
  "No {currency} option expires in this range; the nearest expires {date}.":
    "이 범위에 만기되는 {currency} 옵션이 없습니다. 가장 가까운 만기는 {date}입니다.",
  "No strike has open interest in this range.": "이 범위에는 미결제약정이 있는 행사가가 없습니다.",
  "Calls positive, puts negative: dealers assumed long calls and short puts, since no exchange publishes who holds which side. {source} options, {asof}.":
    "콜은 양수, 풋은 음수: 누가 어느 쪽을 보유하는지 공개하는 거래소가 없어 딜러가 콜 롱, 풋 숏이라고 가정합니다. {source} 옵션, {asof}.",
  "read {ago}": "{ago} 읽음",
  "15-minute delayed, read {ago}": "15분 지연, {ago} 읽음",
  "from the end-of-day file for {date}": "{date} 장 마감 파일 기준",
  expired: "만기됨",
  "Call OI": "콜 미결제약정",
  "Put OI": "풋 미결제약정",
  "Exposure in {unit} per 1% move; open interest at its value at the spot. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "익스포저는 1% 변동당 {unit} 기준이며, 미결제약정은 현물가 기준 금액입니다. 선택한 범위 밖의 만기는 흐리게 표시되며, 만기 전 마지막 1시간 안의 옵션은 제외합니다.",
  // The book picker.
  "Pick an option book": "옵션 북 선택",
  "{n} books": "옵션 북 {n}개",
  "Filter books": "옵션 북 필터",
  Book: "옵션 북",
  "Net gamma": "순 감마",
  "Every expiry, per 1% move, in the currency the contract pays":
    "전체 만기, 1% 변동당, 계약의 결제 통화 기준",
  "Calls / puts": "콜 / 풋",
  Flip: "플립",
  "Where net gamma changes sign, from the spot": "순 감마의 부호가 바뀌는 지점, 현물가 대비",
  "As of": "기준 시점",
  "No book matches.": "일치하는 옵션 북이 없습니다.",
  "calls {calls} · puts {puts}": "콜 {calls} · 풋 {puts}",
  "close {date}": "{date} 종가",
  Crypto: "암호화폐",
  "United States": "미국",
  "Asia-Pacific": "아시아·태평양",
  Europe: "유럽",
  Other: "기타",
  Bitcoin: "비트코인",
  Ether: "이더리움",
  "S&P 500": "S&P 500",
  "Nasdaq-100": "나스닥 100",
  "Russell 2000": "러셀 2000",
  "SPDR S&P 500 ETF": "SPDR S&P 500 ETF",
  "Invesco QQQ": "인베스코 QQQ",
  "iShares Russell 2000 ETF": "iShares 러셀 2000 ETF",
  "SPDR Gold Shares": "SPDR 골드 셰어즈",
  "iShares Silver Trust": "iShares 실버 트러스트",
  "United States Oil Fund": "미국 원유 펀드",
  "iShares Bitcoin Trust": "iShares 비트코인 트러스트",
  "iShares Ethereum Trust": "iShares 이더리움 트러스트",
  Strategy: "스트래티지",
  Coinbase: "코인베이스",
  NVIDIA: "엔비디아",
  Tesla: "테슬라",
  Micron: "마이크론",
  "Hang Seng": "항셍지수",
  "Hang Seng China Enterprises": "항셍중국기업지수",
  "Hang Seng TECH": "항셍테크지수",
  "CSI 300": "CSI 300",
  "SSE 50": "SSE 50",
  "CSI 1000": "CSI 1000",
  TAIEX: "대만 가권지수",
  "Nikkei 225": "닛케이 225",
  "S&P/ASX 200": "S&P/ASX 200(호주)",
  "Nifty 50": "니프티 50",
  "Nifty Bank": "니프티 뱅크",
  "BSE Sensex": "BSE 센섹스",
  "Euro Stoxx 50": "유로 스톡스 50",
  DAX: "독일 DAX",
  "Swiss Market Index": "스위스 SMI",
  // Chart readout (slot-chart.ts).
  "strike {strikes} ({pct} from spot)": "행사가 {strikes} (현물가 대비 {pct})",
  "{low} – {high} ({pct} from spot)": "{low} – {high} (현물가 대비 {pct})",
  "no open interest here": "이 구간 미결제약정 없음",
  "calls {usd} ({oi} open)": "콜 {usd} (미결제 {oi})",
  "puts {usd} ({oi} open)": "풋 {usd} (미결제 {oi})",
  "net {usd}": "순액 {usd}",
  "if the spot were here: net {usd}": "현물가가 여기라면: 순액 {usd}",
  "Expected price move": "예상 가격 변동폭",
  "1 day ahead": "1일 후",
  "1 week ahead": "1주 후",
  "30 days ahead": "30일 후",
  "to the {date} expiry": "{date} 만기까지",
  "IV {iv}": "IV {iv}",
  "ATM IV": "ATM IV",
  "Implied volatility at the expiry's forward, a year": "만기 선도가격에서의 내재변동성(연율)",
  "closed inside 1σ on {one} and 2σ on {two} of days since {year}":
    "{year}년 이후 {one}의 날이 1σ 안, {two}가 2σ 안에서 마감",
  "expected move, 1σ and 2σ, {horizon}": "예상 변동폭 1σ·2σ, {horizon}",
  "spot · {source} IV": "현물가 · {source} IV",
  "One standard deviation is the price × IV × √(days/365), from each expiry's at-the-money implied volatility (between two expiries, their total variance interpolated). The walls are one and two deviations either side of the spot. A normal distribution ends inside them 68% and 95% of the time; real prices have fatter tails, and options usually price in more movement than follows.":
    "1표준편차 = 가격 × IV × √(일수/365)로, 각 만기의 등가격 내재변동성에서 구합니다(두 만기 사이는 총분산을 보간). 월은 현물가 위아래 1표준편차와 2표준편차 지점입니다. 정규분포라면 68%와 95%의 확률로 그 안에서 끝나지만, 실제 가격은 꼬리가 더 두껍고 옵션은 보통 이후 실제 움직임보다 큰 변동을 반영합니다.",
  "The last line of a branch is how often it really did, from Deribit's 30-day volatility index (DVOL) and the perpetual's daily settlement: one 30-day IV for every horizon, and overlapping windows, so frequencies rather than independent trials.":
    "각 가지의 마지막 줄은 실제로 그랬던 빈도로, Deribit 30일 변동성 지수(DVOL)와 무기한 선물의 일일 정산가에서 구했습니다. 모든 기간에 같은 30일 IV를 쓰고 구간이 겹치므로 독립 시행이 아닌 빈도입니다.",
  "The expected move is the range the options have priced in: one standard deviation is the price times the at-the-money implied volatility times the square root of the days ahead over 365, and the walls sit one and two deviations either side of the spot. The chart draws them for the chosen expiries (30 days ahead for all of them); the mind map under it gives every horizon. They are not support or resistance, only the market's own estimate of how far price may travel.":
    "예상 변동폭은 옵션이 반영한 범위입니다. 1표준편차는 가격 × 등가격 내재변동성 × √(앞으로의 일수/365)이고, 월은 현물가 위아래 1표준편차와 2표준편차에 있습니다. 차트는 선택한 만기 범위에 대해 그리며(전체 만기는 30일 후), 그 아래 마인드맵이 모든 기간을 보여 줍니다. 지지선이나 저항선이 아니라, 가격이 얼마나 움직일 수 있는지에 대한 시장 자체의 추정입니다.",
  reference: "기준",
  Level: "수준",
  "From the reference": "기준에서",
  "the next session": "다음 거래 시간",
  "{date}, from 08:00 UTC": "{date}, 08:00 UTC부터",
  "{date} session": "{date} 거래 시간",
  "no trade yet today": "오늘은 아직 거래 없음",
  "above it now": "지금은 그 위",
  "below it now": "지금은 그 아래",
  "reached it today and back inside": "오늘 닿았다가 안으로 돌아옴",
  "inside all day so far": "오늘 지금까지 계속 안쪽",
  "No history is kept for this book's walls yet, so its 90% wall is the normal distribution's 1.645 standard deviations of the options' own IV, not a measured one. Its record starts with its first day below.":
    "이 옵션 북의 월에는 아직 기록이 없어서, 90% 월은 실측이 아니라 옵션 자체 IV에 대한 정규분포의 1.645 표준편차입니다. 기록은 아래 첫날부터 시작됩니다.",
  "Measured on {days} sessions since {since} {year}, against Cboe's 1-day VIX: the S&amp;P 500 closed inside one standard deviation on {inside1}, and within {k90} of them on 90%, so that is where the 90% wall sits. Cboe's free history has the index's closes only, so touches of a wall during the day are not counted here; this book's own record below counts them.":
    "{since} {year} 이후 {days}개 거래 시간을 Cboe의 1일 VIX와 비교해 측정: S&amp;P 500은 {inside1}가 1표준편차 안에서 마감했고, 90%는 {k90}표준편차 안에서 마감해 90% 월을 그곳에 둡니다. Cboe의 무료 기록은 지수 종가뿐이라 장중에 월에 닿은 횟수는 여기서 세지 않습니다. 아래 이 옵션 북 자체의 기록이 셉니다.",
  "Measured on {days} Deribit days since {since} {year}, against the 30-day volatility index (DVOL) as each day began: the whole day stayed within {k90} standard deviations on 90% of days, so that is where the 90% wall sits. Within one, the whole day stayed on {inside1} and the close on {close1}. A touch of the 1σ wall closed back inside {rev1} of {touch1} times; a touch of the 90% wall, {rev90} of {touch90} times.":
    "{since} {year} 이후 {days}개 Deribit 거래일을 매일 시작 시점의 30일 변동성 지수(DVOL)와 비교해 측정: 90%의 날에 하루 내내 {k90}표준편차 안에 머물러 90% 월을 그곳에 둡니다. 1표준편차 안에 머문 비율은 하루 전체 {inside1}, 종가 {close1}. 1σ 월에 닿은 {touch1}번 중 {rev1}가 안에서 마감했고, 90% 월에 닿은 {touch90}번 중 {rev90}입니다.",
  "not reached": "닿지 않음",
  "reached, closed back inside": "닿은 뒤 안에서 마감",
  "closed beyond": "밖에서 마감",
  "above: {what}": "위: {what}",
  "below: {what}": "아래: {what}",
  "The IV wall is the move the options price for the day: the reference close plus and minus one standard deviation, the close times the options' implied volatility a day ahead times the square root of 1/365. The levels are fixed when the day begins (Deribit's day at 08:00 UTC, a US session at its first read) so they do not drift through the day.":
    "IV 월은 옵션이 그날 반영한 움직임입니다. 기준 종가의 위아래 1표준편차로, 종가 × 하루 앞 옵션 내재변동성 × √(1/365)입니다. 수준은 하루가 시작될 때 고정되며(Deribit의 하루는 08:00 UTC, 미국 거래 시간은 첫 조회 시점) 장중에 움직이지 않습니다.",
  "The 90% wall is where history says price stayed: the multiple of a day's standard deviation that held on 90% of past days. BTC and ETH are measured on every Deribit day since 2021 against DVOL, their whole day's range; the S&amp;P 500 on every session since 2022 against Cboe's 1-day VIX, closes only. A book with no history uses the normal distribution's 1.645.":
    "90% 월은 과거에 가격이 머문 범위입니다. 지난 날의 90%에서 깨지지 않은 하루 표준편차의 배수입니다. BTC와 ETH는 2021년 이후 모든 Deribit 거래일을 DVOL과 비교해 하루 전체 변동폭으로, S&amp;P 500은 2022년 이후 모든 거래 시간을 Cboe의 1일 VIX와 비교해 종가만으로 측정합니다. 기록이 없는 옵션 북은 정규분포의 1.645를 씁니다.",
  "A wall is a probability, not a promise: a touch of the IV wall has closed back inside a little over half the time, not nine times in ten. The record under the ladder shows each day's outcome for this book.":
    "월은 약속이 아니라 확률입니다. IV 월에 닿은 뒤 안으로 돌아온 비율은 절반을 조금 넘을 뿐, 열 번에 아홉 번이 아닙니다. 래더 아래 기록에 이 옵션 북의 날마다의 결과를 보여 줍니다.",
  "{currency}'s options carry no implied volatility to draw walls from yet.":
    "{currency}의 옵션에는 아직 월을 그릴 내재변동성이 없습니다.",
  "1.645 standard deviations of the options' IV (normal distribution)":
    "옵션 IV의 1.645표준편차(정규분포)",
  "{k90} standard deviations of {method} {sigma}, measured":
    "{method} {sigma}의 {k90}표준편차, 실측",
  "IV wall, 1σ": "IV 월, 1σ",
  "±{move} (±{pct}) from IV {iv} a day ahead": "±{move}(±{pct}), 하루 앞 IV {iv} 기준",
  "90% wall": "90% 월",
  "The day so far": "오늘 지금까지",
  Reference: "기준",
  "high {high} · low {low}": "고가 {high} · 저가 {low}",
  "IV wall: {status}": "IV 월: {status}",
  "the latest close, for the next session": "최근 종가, 다음 거래 시간용",
  "Reference close": "기준 종가",
  "{currency} · {source} options · IV walls · {day}": "{currency} · {source} 옵션 · IV 월 · {day}",
  "The day's range": "그날의 변동폭",
  "IV wall": "IV 월",
  "90% wall, above": "90% 월, 위",
  "IV wall, above": "IV 월, 위",
  "1σ of the options' IV": "옵션 IV의 1σ",
  "IV wall, below": "IV 월, 아래",
  "90% wall, below": "90% 월, 아래",
  "{currency} comes from an end-of-day file, so its walls are for the next session and are not kept day by day.":
    "{currency}는 장 마감 파일에서 읽어서, 월은 다음 거래 시간용이며 날마다 기록하지 않습니다.",
  "{currency}'s own record starts with today; each finished day is added here.":
    "{currency} 자체 기록은 오늘부터 시작합니다. 끝난 날마다 여기에 추가됩니다.",
  "{currency}'s own record, {days} finished days since {since}. IV wall: touched {reached}, closed back inside {held}. 90% wall: touched {reached90}, closed back inside {held90}.":
    "{currency} 자체 기록, {since} 이후 끝난 {days}일. IV 월: 닿음 {reached}, 안에서 마감 {held}. 90% 월: 닿음 {reached90}, 안에서 마감 {held90}.",
  "High / low": "고가 / 저가",
  Close: "종가",
  "At the IV wall": "IV 월에서",
  "At the 90% wall": "90% 월에서",
  "How price has behaved at the walls": "월에서의 가격 움직임",
  "Prices in {unit}. {source} options, read {ago}.":
    "가격은 {unit} 기준. {source} 옵션, {ago} 조회.",
  "Two readings of where the market makers stand, side by side, for the nearest expiry. The gamma ceiling is the strike above the spot holding the most call gamma, and the gamma floor the strike below it holding the most put gamma: where hedging flows are largest.":
    "가장 가까운 만기에 대해 마켓메이커의 위치를 두 가지로 읽어 나란히 보여 줍니다. 감마 천장은 현물가 위에서 콜 감마가 가장 많은 행사가, 감마 바닥은 현물가 아래에서 풋 감마가 가장 많은 행사가로, 헤지 흐름이 가장 큰 곳입니다.",
  "The dealer range reads every option as sold by dealers who keep the premium, as max pain does: at expiry they pay out what the options are worth, so they earn most at the max pain strike and start losing beyond the break-evens either side, the dealer ceiling and floor. No exchange publishes who sold what, so this rests on that assumption, and the Gamma Exposure tab's sign assumes the opposite for calls.":
    "딜러 범위는 맥스 페인과 마찬가지로 모든 옵션을 프리미엄을 받은 딜러가 판 것으로 읽습니다. 만기에 옵션의 가치를 지급하므로 맥스 페인 행사가에서 가장 많이 벌고, 양쪽 손익분기점인 딜러 천장과 바닥을 넘으면 손실이 나기 시작합니다. 누가 무엇을 팔았는지 공개하는 거래소는 없어 이 가정에 기대며, 감마 익스포저 탭의 부호는 콜에 대해 반대로 가정합니다.",
  "A ceiling or floor within a quarter of the day's move of an IV wall is marked as lined up with it. Whether price turns there more often than elsewhere is what the record under the ladder is for: it starts with this tab and grows a day at a time.":
    "IV 월에서 그날 움직임의 4분의 1 안에 있는 천장이나 바닥은 월과 겹친다고 표시합니다. 가격이 다른 곳보다 그곳에서 더 자주 돌아서는지는 래더 아래 기록이 답합니다. 기록은 이 탭과 함께 시작해 하루씩 늘어납니다.",
  "gamma ceiling": "감마 천장",
  "dealer ceiling": "딜러 천장",
  "gamma floor": "감마 바닥",
  "dealer floor": "딜러 바닥",
  "Gamma ceiling / floor": "감마 천장 / 바닥",
  "the strikes holding the most call gamma above the spot and put gamma below it, expiring {expiry}":
    "현물가 위 콜 감마, 아래 풋 감마가 가장 많은 행사가, {expiry} 만기",
  "Dealer ceiling / floor": "딜러 천장 / 바닥",
  "where dealers who sold every option of that expiry break even; max pain {pain}":
    "그 만기의 옵션을 모두 판 딜러의 손익분기점; 맥스 페인 {pain}",
  "Lined up with an IV wall": "IV 월과 겹침",
  "within a quarter of the day's 1σ move ({band}) of an IV wall or a 90% wall":
    "IV 월 또는 90% 월에서 그날 1σ 움직임의 4분의 1({band}) 이내",
  "max pain": "맥스 페인",
  "{currency} · {source} options · ceiling and floor · expiring {expiry}":
    "{currency} · {source} 옵션 · 천장과 바닥 · {expiry} 만기",
  "dealer ceiling and floor": "딜러 천장과 바닥",
  "lined up with a wall": "월과 겹침",
  "Dealer range by expiry": "만기별 딜러 범위",
  Premium: "프리미엄",
  "Dealer floor": "딜러 바닥",
  "Max pain": "맥스 페인",
  "Dealer ceiling": "딜러 천장",
  "From the spot": "현물가에서",
  "Lined up with a wall": "월과 겹침",
  "{currency} comes from an end-of-day file, so its levels are for the next session and are not kept day by day.":
    "{currency}는 장 마감 파일에서 읽어서, 수준은 다음 거래 시간용이며 날마다 기록하지 않습니다.",
  Days: "일수",
  Reached: "닿음",
  "Closed back inside": "안에서 마감",
  "Over {days} finished days since {since}, both sides counted; a level is reached when the day's high (or low) touches it, and held when the day closes back inside it.":
    "{since} 이후 끝난 {days}일, 양쪽을 모두 셉니다. 그날의 고가(또는 저가)가 닿으면 닿음, 그날 그 안에서 마감하면 지킨 것입니다.",
  "How price has behaved at these levels": "이 수준에서의 가격 움직임",
  "IV Walls": "IV 월",
  "IV walls": "IV 월",
  "Ceiling & Floor": "천장과 바닥",
  Ceiling: "천장",
  "the spot now": "현재 현물가",
  "week from {date}": "{date}부터의 주",
  "Levels for": "수준 기준",
  "The Day and Week switch reads the same levels for the nearest expiry or for the week's: Deribit's Friday 08:00 UTC weekly, or a US book's last expiry of the week. The week's levels are fixed by its first read, its IV walls span the time to that expiry, and its 90% wall is measured on whole past weeks where there is history.":
    "일/주 전환은 같은 수준을 가장 가까운 만기나 그 주의 만기 기준으로 읽습니다. Deribit의 금요일 08:00 UTC 주간 만기, 또는 미국 옵션 북의 그 주 마지막 만기입니다. 주의 수준은 그 주 첫 조회 때 고정되고, IV 월은 그 만기까지의 시간에 걸치며, 90% 월은 기록이 있는 곳에서 지난 온전한 주들로 측정합니다.",
  "the strikes holding the most call gamma above the spot and put gamma below it, in everything expiring by {expiry}":
    "{expiry}까지 만기인 모든 옵션 중 현물가 위 콜 감마, 아래 풋 감마가 가장 많은 행사가",
  "within a quarter of the week's 1σ move ({band}) of an IV wall or a 90% wall":
    "IV 월 또는 90% 월에서 그 주 1σ 움직임의 4분의 1({band}) 이내",
  "The week so far": "이번 주 지금까지",
  "the spot now; this week's levels are fixed by its first read":
    "현재 현물가; 이번 주 수준은 그 주 첫 조회 때 고정됩니다",
  "{currency}'s weekly record starts with this week; each finished week is added here.":
    "{currency}의 주간 기록은 이번 주부터 시작합니다. 끝난 주마다 여기에 추가됩니다.",
  Weeks: "주 수",
  "Over {weeks} finished weeks since {since}, both sides counted; a level is reached when the week's high (or low) touches it, and held when the week closes back inside it.":
    "{since} 이후 끝난 {weeks}주, 양쪽을 모두 셉니다. 그 주의 고가(또는 저가)가 닿으면 닿음, 그 주가 그 안에서 마감하면 지킨 것입니다.",
};
