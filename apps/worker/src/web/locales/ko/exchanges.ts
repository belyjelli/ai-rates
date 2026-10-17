import type { Catalog } from "../../i18n";

/**
 * The Exchanges page's trading-cost table and one exchange's cost block (web/exchanges.ts). Glossary
 * and style: ./index.ts.
 *
 * Terms: grade 등급 (S/A/B/C/D left as letters), score 점수, execution (a pillar) 체결 비용, liquidity
 * 유동성, activity 활동성, cost to trade 거래 비용, all in 총비용, market order 시장가 주문, standard
 * taker fee 기본 테이커 수수료, VIP tier VIP 레벨, rebate 리베이트, mid 중간가, best bid / ask 최우선
 * 매수·매도 호가, depth 깊이, resting (size) 걸린 잔량, level (of a book) 호가, credited (by the
 * grade) 반영, basket 바스켓, majors 주요 자산, fill / did not fill 체결 / 체결 불가, markout
 * 마크아웃, snapshot 스냅숏, median 중앙값, samples 표본, lower bound / floor 하한값, not listed
 * 미상장, reserves (a pillar) 준비금 (as in 준비금 증명, proof of reserves), wallets 지갑, tracked
 * on-chain 온체인에서 추적되는, clean 자체 토큰 제외 (clean reserves 자체 토큰을 제외한 준비금; never
 * 순자산, which reads as net assets), collateral 담보 (protocol collateral 프로토콜 담보), pillar 항목,
 * weight 가중치, breadth 폭, "{n} points" (a pillar's weight) "{n}점", breakdown 세부 내역, the leader
 * 선두 거래소, n/a stays n/a, CEX / DEX stay in Latin letters, ranking "CEX {of}곳 중 {rank}위".
 * "$10k", "$100k", "±0.1%", "±1%" stay as written; a bp joins its figure ("{bps}bp"), as "{n} bp"
 * does in ./macro.ts.
 */
export const exchanges: Catalog = {
  // the grade's breakdown card
  Reserves: "준비금",
  Execution: "체결 비용",
  Activity: "활동성",
  Liquidity: "유동성",
  "not measured": "미측정",
  "no wallets published": "공개된 지갑 없음",
  "collateral not identified: the DEXes' median": "담보 미확인: DEX 중앙값 적용",
  "{clean} clean of {total} in tracked wallets": "추적 지갑 {total} 중 자체 토큰 제외 {clean}",
  "{usd} protocol collateral": "프로토콜 담보 {usd}",
  "{cost} to trade $10k, {slip} slippage at $100k": "$10k 거래 비용 {cost}, $100k 슬리피지 {slip}",
  "{oi} open interest, {volume} volume": "미결제약정 {oi}, 거래량 {volume}",
  "{usd} credited within 0.1%; {n} of {total} markets hold $100k":
    "0.1% 이내 반영 깊이 {usd}; 종목 {total}개 중 {n}개에 $100k 이상 걸림",
  "#{rank} of {of} CEXs": "CEX {of}곳 중 {rank}위",
  "#{rank} of {of} DEXs": "DEX {of}곳 중 {rank}위",
  "n/a": "n/a",
  "Built from this site's own reading of the order books and DefiLlama's reserves. n/a never counts as zero; its weight goes to the others. S from 85, A 70, B 55, C 40, else D.":
    "이 사이트가 직접 읽은 호가창과 DefiLlama의 준비금 데이터로 산정합니다. n/a는 0점으로 계산하지 않으며, 그 가중치는 나머지 항목으로 넘어갑니다. 85점 이상 S, 70점 이상 A, 55점 이상 B, 40점 이상 C, 그 외 D.",
  "How the grade is built": "등급 산정 방식",
  "Grade {grade}, score {score}: the breakdown": "등급 {grade}, 점수 {score}: 세부 내역",

  // the table
  "fee {fee}{mark}": "수수료 {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "바스켓 호가창 중 {n}개에서 대부분 $100k를 다 체결할 수 없었으며, 각각 {bps}bp로 계산합니다",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, 2% of the exchange's daily volume or 5% of its clean reserves is not counted":
    "등급에는 이 중 {usd}만 반영되며, 종목 미결제약정의 10분의 1, 거래소 일일 거래량의 2%, 자체 토큰을 제외한 준비금의 5% 중 하나라도 넘는 깊이는 계산하지 않습니다",
  "{n} of {total} assets": "자산 {total}개 중 {n}개",
  "Not measured: its order book is not read yet": "미측정: 아직 이 거래소의 호가창을 읽지 않습니다",
  "clean, of {total} in wallets": "지갑 {total} 중 자체 토큰 제외분",
  collateral: "담보",

  // the tiles
  "across {n} exchanges reporting now": "현재 데이터를 보내는 거래소 {n}곳 합계",
  "as each exchange reports it": "각 거래소가 공개하는 값 기준",
  "Cheapest $10k": "$10k 최저 비용",
  "{venue}: taker fee and slippage, the basket's mix":
    "{venue}: 테이커 수수료와 슬리피지, 바스켓 구성 비중 기준",
  "no book measured yet": "아직 측정한 호가창 없음",
  "Deepest books": "가장 깊은 호가창",
  "{venue}: credited within 0.1% of the mid, 12 majors":
    "{venue}: 중간가 0.1% 이내 반영 깊이, 주요 자산 12개",

  // the column heads
  Grade: "등급",
  "This site's grade after DefiLlama's REAL score: reserves, execution, activity and liquidity. A grade opens its breakdown":
    "DefiLlama의 REAL 점수를 따른 이 사이트의 등급: 준비금, 체결 비용, 활동성, 유동성. 등급을 누르면 세부 내역이 열립니다",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain without its own token, a DEX's protocol collateral":
    "거래소가 보유한 자산, DefiLlama 기준: CEX는 온체인에서 추적되는 지갑(자체 토큰 제외), DEX는 프로토콜 담보",
  "Cost to trade $10k": "$10k 거래 비용",
  "A $10k market order all in: the published standard taker fee plus what the book makes it pay beyond the mid":
    "$10k 시장가 주문의 총비용: 공개된 기본 테이커 수수료에 호가창 때문에 중간가보다 더 내는 금액을 더한 값",
  Slippage: "슬리피지",
  "What a $10k and a $100k market order pay beyond the mid, from the book, before fees":
    "$10k 및 $100k 시장가 주문이 호가창에서 중간가보다 더 내는 금액, 수수료 제외",
  "The gap between the best bid and ask, basis points of the mid":
    "최우선 매수·매도 호가의 차이, 중간가 대비 bp 단위",
  Depth: "깊이",
  "Dollars resting within 0.1% and within 1% of the mid on both sides, the basket's books added up, as each exchange's public book shows them":
    "중간가 0.1% 이내와 1% 이내에 양쪽으로 걸린 잔량(달러), 바스켓 호가창 합계, 각 거래소의 공개 호가창 기준",
  "Summed over the exchange's perpetual markets, as it reports them":
    "거래소가 공개하는 값 기준, 무기한 선물 종목 전체 합계",
  "Live perpetual markets": "활성 무기한 선물 종목",

  // the help panel and the page description
  "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.":
    "이 사이트가 수집하는 모든 무기한 선물 거래소를 거래 비용순으로 정렬합니다. 비용은 각 거래소의 공개 호가창에서 나오며, 주요 자산 12개(BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC)의 호가창을 10분마다 읽습니다. 각 수치는 최근 7일의 중앙값입니다.",
  "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.":
    "$10k 거래 비용은 $10k 시장가 주문의 총비용입니다. 거래소가 공개한 기본 테이커 수수료(VIP 레벨, 수수료 토큰, 리베이트가 있으면 더 낮아집니다)에 호가창 때문에 주문이 중간가보다 더 내는 금액(스프레드의 절반 포함)을 더합니다. 슬리피지는 이 중 뒷부분만 $10k 및 $100k 기준으로 잰 값입니다. 각 자산은 모든 거래소를 합산한 미결제약정만큼 가중되므로, 모든 거래소가 같은 구성 비중으로 계산됩니다.",
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that.":
    "깊이는 각 거래소의 공개 호가창에 나타난 대로, 중간가 0.1% 이내와 1% 이내에 걸린 잔량(달러)입니다. 거래소는 호가를 일정 단계까지만 공개하므로(Binance는 BTC 기준 약 0.15%까지), 1% 수치는 하한값이며 등급에는 측정한 모든 호가창이 닿는 0.1% 수치를 씁니다. 한 호가의 잔량이 해당 종목 미결제약정의 5%를 넘으면 5%까지만 계산합니다.",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade follows DefiLlama's REAL score: reserves 30, execution 30, activity 20, liquidity 20. A grade opens its breakdown; how each pillar is built is under the table.":
    "이 수치는 실제 체결이 아니라 호가창이 약속하는 값입니다. 거래는 측정하지 않으므로 마크아웃(체결 후 가격이 움직이는 방향)은 표시하지 않습니다. 등급은 DefiLlama의 REAL 점수를 따르며, 가중치는 준비금 30, 체결 비용 30, 활동성 20, 유동성 20입니다. 등급을 누르면 세부 내역이 열리고, 각 항목의 산정 방식은 표 아래에 있습니다.",
  "Every perpetual futures exchange tracked by airrates, graded on reserves, trading cost, activity and liquidity: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "airrates가 추적하는 모든 무기한 선물 거래소와 준비금, 거래 비용, 활동성, 유동성 기준 등급: $10k 및 $100k 기준 테이커 수수료와 슬리피지, 깊이, 미결제약정, 거래량.",

  // the notes under the table
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "{date}부터 호가창을 측정했으며, 수치는 최근 7일의 중앙값입니다.",
  "Order books are not measured yet.": "아직 호가창을 측정하지 않았습니다.",
  "Reserves: DefiLlama, read every six hours.": "준비금: DefiLlama에서 6시간마다 읽습니다.",
  "Reserves are not available right now; the grade goes on without them.":
    "지금은 준비금 데이터를 받을 수 없어, 준비금 없이 등급을 매깁니다.",
  "* No published taker fee found for {venues}: the site's default of {bps} bp is used.":
    "* {venues}의 공개 테이커 수수료를 찾지 못해 사이트 기본값 {bps}bp를 적용합니다.",
  "Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.":
    "아직 등급 없음: 호가창을 아직 읽지 않는 거래소입니다. 아직 수집하지 않음: {venues}.",

  // how the grade is built
  "{n} points": "{n}점",
  "After DefiLlama's REAL score: a weighted mean of four pillars, each 0 to 100. Sizes are on a log scale, so an exchange a tenth the size of the leader still scores about 70. A pillar this site cannot measure for an exchange hands its weight to the others and never counts as zero. CEXes and DEXes are scored together and ranked within their own kind. Fixed bands, so a new exchange does not reshuffle the rest: S from 85, A from 70, B from 55, C from 40, D below.":
    "DefiLlama의 REAL 점수를 따릅니다. 각각 0에서 100점인 네 항목의 가중 평균입니다. 규모는 로그 척도로 계산하므로, 선두 거래소의 10분의 1 규모인 거래소도 약 70점을 받습니다. 이 사이트가 어떤 거래소에 대해 측정할 수 없는 항목은 그 가중치를 나머지 항목에 넘기며, 0점으로 계산하지 않습니다. CEX와 DEX는 함께 점수를 매기고, 순위는 같은 유형 안에서 정합니다. 등급 구간은 고정되어 있어 새 거래소가 들어와도 다른 거래소의 등급이 바뀌지 않습니다. 85점 이상 S, 70점 이상 A, 55점 이상 B, 40점 이상 C, 그 미만은 D입니다.",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain, without its own token; a DEX's protocol collateral, a floor, since market makers' money can sit elsewhere. Two thirds is size against the largest; one third is whether its open interest, a day's volume and the book it shows within 1% are sizes it could back, and how much of it is its own token. A CEX publishing no wallets scores 0; a DEX whose collateral is not identified scores the DEXes' median.":
    "거래소가 보유한 자산으로, DefiLlama 데이터입니다. CEX는 온체인에서 추적되는 지갑에서 자체 토큰을 뺀 금액이고, DEX는 프로토콜 담보입니다. 마켓 메이커의 자금은 다른 곳에 있을 수 있으므로 DEX의 값은 하한값입니다. 3분의 2는 가장 큰 거래소 대비 규모이고, 3분의 1은 미결제약정, 하루 거래량, 1% 이내에 보이는 호가창 잔량이 이 자산으로 뒷받침할 수 있는 규모인지, 그리고 그중 자체 토큰이 얼마나 되는지입니다. 지갑을 공개하지 않는 CEX는 0점, 담보를 확인할 수 없는 DEX는 DEX 중앙값을 받습니다.",
  "What a market order costs, from each exchange's book every ten minutes over seven days: $10k all in (the published standard taker fee and the walk through the book), and what $10k and $100k pay beyond the mid, each against the cheapest exchange. DefiLlama also scores markouts and fills against the quote; those need trades, which this site does not record, so their weight goes to cost and slippage.":
    "시장가 주문에 드는 비용으로, 각 거래소의 호가창을 7일 동안 10분마다 읽어 계산합니다. $10k 총비용(공개된 기본 테이커 수수료와 호가창을 따라 체결되며 붙는 비용), 그리고 $10k와 $100k가 중간가보다 더 내는 금액을 각각 가장 저렴한 거래소와 비교합니다. DefiLlama는 마크아웃과 호가 대비 실제 체결 가격도 점수에 넣지만, 이는 거래 데이터가 필요하고 이 사이트는 거래를 기록하지 않으므로 그 가중치는 비용과 슬리피지로 넘어갑니다.",
  "Open interest, credited up to three times clean reserves, and a day's volume, credited up to five times open interest, each against the leader.":
    "미결제약정(자체 토큰을 제외한 준비금의 3배까지 반영)과 하루 거래량(미결제약정의 5배까지 반영)을 각각 선두 거래소와 비교합니다.",
  "Depth within 0.1% of the mid across the twelve majors, credited up to a tenth of each market's open interest, 2% of the exchange's daily volume and 5% of its clean reserves; and breadth, how many of the twelve hold $100k within 0.1%. Halved for a CEX publishing no reserves.":
    "주요 자산 12개의 중간가 0.1% 이내 깊이(각 종목 미결제약정의 10분의 1, 거래소 일일 거래량의 2%, 자체 토큰을 제외한 준비금의 5%까지 반영), 그리고 폭, 즉 12개 중 0.1% 이내에 $100k 이상이 걸린 자산 수입니다. 준비금을 공개하지 않는 CEX는 이 점수를 절반으로 깎습니다.",
  "These are this site's grades by DefiLlama's method, not DefiLlama's scores. What exchanges report about themselves counts only as far as it can be checked: open interest up to three times reserves, volume up to five times open interest. Reputation, age, brand and listings count not at all.":
    "이 등급은 DefiLlama의 방법으로 이 사이트가 매긴 것이며, DefiLlama의 점수가 아닙니다. 거래소가 스스로 보고한 값은 확인할 수 있는 만큼만 반영합니다. 미결제약정은 준비금의 3배까지, 거래량은 미결제약정의 5배까지입니다. 평판, 운영 기간, 브랜드, 상장 종목 수는 전혀 반영하지 않습니다.",

  // one exchange's own page
  "not listed": "미상장",
  "$100k did not fill in most snapshots": "대부분의 스냅숏에서 $100k를 다 체결할 수 없음",
  "did not fill": "체결 불가",
  "{pct}%": "{pct}%",
  "Trading cost": "거래 비용",
  "{value} to trade $10k": "$10k 거래 비용 {value}",
  "taker fee {fee}{mark}": "테이커 수수료 {fee}{mark}",
  "{value} slippage at $100k": "$100k 슬리피지 {value}",
  "{value} within 0.1%": "0.1% 이내 깊이 {value}",
  "What a $10k market order pays beyond the mid, before fees":
    "$10k 시장가 주문이 중간가보다 더 내는 금액, 수수료 제외",
  "$10k slippage": "$10k 슬리피지",
  "What a $100k market order pays beyond the mid, before fees":
    "$100k 시장가 주문이 중간가보다 더 내는 금액, 수수료 제외",
  "$100k slippage": "$100k 슬리피지",
  "Depth ±0.1%": "깊이 ±0.1%",
  "Depth ±1%": "깊이 ±1%",
  "How far from the mid the published book reached": "공개된 호가창이 중간가에서 닿은 범위",
  "Book reach": "호가창 범위",
  "Snapshots in the last seven days": "최근 7일간 스냅숏 수",
  Samples: "표본",
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. Reserves are DefiLlama's.":
    "{venue}의 공개 호가창을 10분마다 찍은 최근 7일 스냅숏의 중앙값이며, 비용은 실제 체결이 아니라 호가창 기준입니다. 준비금은 DefiLlama 데이터입니다.",
};
