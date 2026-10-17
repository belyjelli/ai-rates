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
 * 마크아웃, snapshot 스냅숏, median 중앙값, samples 표본, lower bound 하한값, not listed 미상장.
 * "$10k", "$100k", "±0.1%", "±1%" stay as written; a bp joins its figure ("{bps}bp"), as "{n} bp"
 * does in ./macro.ts.
 */
export const exchanges: Catalog = {
  "score {score}: execution {execution}, liquidity {liquidity}, activity {activity}":
    "점수 {score}: 체결 비용 {execution}, 유동성 {liquidity}, 활동성 {activity}",
  "fee {fee}{mark}": "수수료 {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "바스켓 호가창 중 {n}개에서 대부분 $100k를 다 체결할 수 없었으며, 각각 {bps}bp로 계산합니다",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, or 2% of the exchange's daily volume, is not counted":
    "등급에는 이 중 {usd}만 반영되며, 종목 미결제약정의 10분의 1이나 거래소 일일 거래량의 2%를 넘는 깊이는 계산하지 않습니다",
  "{n} of {total} assets": "자산 {total}개 중 {n}개",
  "Not measured: its order book is not read yet": "미측정: 아직 이 거래소의 호가창을 읽지 않습니다",
  "across {n} exchanges reporting now": "현재 데이터를 보내는 거래소 {n}곳 합계",
  "as each exchange reports it": "각 거래소가 공개하는 값 기준",
  "Cheapest $10k": "$10k 최저 비용",
  "{venue}: taker fee and slippage, the basket's mix":
    "{venue}: 테이커 수수료와 슬리피지, 바스켓 구성 비중 기준",
  "no book measured yet": "아직 측정한 호가창 없음",
  "Deepest books": "가장 깊은 호가창",
  "{venue}: credited within 0.1% of the mid, 12 majors":
    "{venue}: 중간가 0.1% 이내 반영 깊이, 주요 자산 12개",
  Grade: "등급",
  "This site's grade from its own measurements: S, A, B, C, D":
    "이 사이트가 자체 측정으로 매긴 등급: S, A, B, C, D",
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
  "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.":
    "이 사이트가 수집하는 모든 무기한 선물 거래소를 거래 비용순으로 정렬합니다. 비용은 각 거래소의 공개 호가창에서 나오며, 주요 자산 12개(BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC)의 호가창을 10분마다 읽습니다. 각 수치는 최근 7일의 중앙값입니다.",
  "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.":
    "$10k 거래 비용은 $10k 시장가 주문의 총비용입니다. 거래소가 공개한 기본 테이커 수수료(VIP 레벨, 수수료 토큰, 리베이트가 있으면 더 낮아집니다)에 호가창 때문에 주문이 중간가보다 더 내는 금액(스프레드의 절반 포함)을 더합니다. 슬리피지는 이 중 뒷부분만 $10k 및 $100k 기준으로 잰 값입니다. 각 자산은 모든 거래소를 합산한 미결제약정만큼 가중되므로, 모든 거래소가 같은 구성 비중으로 계산됩니다.",
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that, and the grade credits a market's depth up to a tenth of its open interest and an exchange's up to 2% of its daily volume: displayed size beyond that rarely fills.":
    "깊이는 각 거래소의 공개 호가창에 나타난 대로, 중간가 0.1% 이내와 1% 이내에 걸린 잔량(달러)입니다. 거래소는 호가를 일정 단계까지만 공개하므로(Binance는 BTC 기준 약 0.15%까지), 1% 수치는 하한값이며 등급에는 측정한 모든 호가창이 닿는 0.1% 수치를 씁니다. 한 호가의 잔량이 해당 종목 미결제약정의 5%를 넘으면 5%까지만 계산하고, 등급은 종목의 깊이를 미결제약정의 10분의 1까지, 거래소의 깊이를 일일 거래량의 2%까지만 반영합니다. 그 이상으로 표시된 잔량은 거의 체결되지 않기 때문입니다.",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade is this site's: half execution (cost and $100k slippage against the cheapest), three tenths liquidity (credited depth within 0.1% against the deepest), a fifth activity (open interest, and volume up to five times it). S from 85, A from 70, B from 55, C from 40, D below.":
    "이 수치는 실제 체결이 아니라 호가창이 약속하는 값입니다. 거래는 측정하지 않으므로 마크아웃(체결 후 가격이 움직이는 방향)은 표시하지 않습니다. 등급은 이 사이트가 매기며, 절반은 체결 비용(가장 저렴한 거래소 대비 비용과 $100k 슬리피지), 10분의 3은 유동성(가장 깊은 거래소 대비 0.1% 이내 반영 깊이), 5분의 1은 활동성(미결제약정, 그리고 그 5배까지의 거래량)입니다. 85점 이상 S, 70점 이상 A, 55점 이상 B, 40점 이상 C, 그 미만은 D입니다.",
  "Every perpetual futures exchange tracked by airrates, graded on what trading there costs: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "airrates가 추적하는 모든 무기한 선물 거래소와 거래 비용 기준 등급: $10k 및 $100k 기준 테이커 수수료와 슬리피지, 깊이, 미결제약정, 거래량.",
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "{date}부터 호가창을 측정했으며, 수치는 최근 7일의 중앙값입니다.",
  "Order books are not measured yet.": "아직 호가창을 측정하지 않았습니다.",
  "* No published taker fee found for {venues}: the site's default of {bps} bp is used.":
    "* {venues}의 공개 테이커 수수료를 찾지 못해 사이트 기본값 {bps}bp를 적용합니다.",
  "Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.":
    "아직 등급 없음: 호가창을 아직 읽지 않는 거래소입니다. 아직 수집하지 않음: {venues}.",
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
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. How the grade is built: the Exchanges page.":
    "{venue}의 공개 호가창을 10분마다 찍은 최근 7일 스냅숏의 중앙값이며, 비용은 실제 체결이 아니라 호가창 기준입니다. 등급 산정 방식: 거래소 페이지.",
};
