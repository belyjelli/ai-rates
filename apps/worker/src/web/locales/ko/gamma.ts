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
};
