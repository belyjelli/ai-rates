/**
 * Korean for web/pages.ts (every page but the /status body, which stays English) and
 * web/venues.ts. Glossary and style: ./index.ts.
 *
 * Terms: live market 활성 종목, price gap 가격 차이, good for (resting size a gap can take) 가용 규모,
 * top of book 최우선 호가, resting size 잔량, bid / ask 매수 호가 / 매도 호가, charging day 부과일,
 * distressed listing 부실 상장, cumulative funding 누적 펀딩비, drawdown 낙폭, window 기간.
 */

import type { Catalog } from "../../i18n";

export const pages: Catalog = {
  // shared helpers
  flat: "보합",
  crypto: "암호화폐",
  equity: "주식",
  commodity: "원자재",
  fx: "외환",
  index: "지수",
  "{days} charging days in the last 30": "최근 30일 중 펀딩비 부과일 {days}일",
  Asset: "자산",
  "7d settled": "7일 정산",
  Stability: "안정성",
  "Long on {venue}": "{venue}에서 롱",
  "Short on {venue}": "{venue}에서 숏",
  day: "1일",
  "{n} days": "{n}일",
  Any: "전체",
  Reset: "초기화",

  // home: verified ranking and hero
  "No replay yet: the nightly run needs a week of settled funding on both legs of a pair.":
    "아직 리플레이가 없습니다. 야간 실행에는 페어의 두 레그 모두 1주일치 정산된 펀딩비가 필요합니다.",
  "Replayed, not forecast: {asset} long {long} / short {short} settled {net} on {size} a leg over 7 days. {apr} annualized, {win}% of days positive.":
    "예측이 아닌 리플레이: {asset} 롱 {long} / 숏 {short}, 레그당 {size}로 7일간 {net} 정산. 연환산 {apr}, 수익이 난 날 {win}%.",
  "Open interest on the thinner of the two legs. A big figure earned on a shallow market is not a trade you can size into":
    "두 레그 중 얇은 쪽의 미결제약정. 얕은 시장에서 나온 큰 숫자는 규모를 키울 수 있는 거래가 아닙니다",
  "The more extreme leg's funding, absolute. Rates past a few hundred percent usually mean a delisting or a distressed listing rather than carry":
    "더 극단적인 레그의 펀딩비(절댓값). 수백 퍼센트를 넘는 요율은 대개 캐리가 아니라 상장 폐지나 부실 상장을 뜻합니다",
  "Funding both legs actually settled over the last 7 days, per $10,000 of notional on each leg":
    "최근 7일간 두 레그에서 실제로 정산된 펀딩비, 레그당 명목 $10,000 기준",
  Annualized: "연환산",
  "Long leg": "롱 레그",
  "Short leg": "숏 레그",
  "Days the pair was net positive, as a share of days that settled at all":
    "정산이 있었던 날 중 페어가 순수익을 낸 날의 비율",
  "Win rate": "승률",
  "Thinner leg OI": "얇은 레그 미결제약정",
  "Worst leg APR": "최악 레그 연환산",
  "How often the weaker leg held its funding direction over 30 days":
    "30일 동안 약한 레그가 펀딩비 방향을 유지한 빈도",
  "Widest funding spread right now": "현재 가장 큰 펀딩비 스프레드",
  "No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.":
    "최근 5분 동안 데이터를 보낸 거래소가 없어 페어를 만들 수 없습니다. 1분 뒤 다시 확인하세요.",
  "Funding spreads across perp exchanges": "무기한 선물 거래소 간 펀딩비 스프레드",
  "Live funding rate spreads between perpetual futures exchanges, refreshed every minute.":
    "무기한 선물 거래소 간 실시간 펀딩비 스프레드, 1분마다 갱신.",
  "Widest spreads": "가장 큰 스프레드",
  "Open the screener": "스크리너 열기",
  "No pairs yet: an asset needs live markets on at least two venues.":
    "아직 페어가 없습니다. 자산이 최소 두 거래소에 활성 종목을 가져야 합니다.",
  "What actually paid, last 7 days": "최근 7일 실제 수익",
  "replayed {date}": "{date} 리플레이",
  "Not a forecast: both legs replayed at their own settlement times from stored funding, on $10,000 per leg. Ranked by what settled, with nothing filtered out — so check the thinner leg's depth and the worse leg's rate before reading a big number as a trade.":
    "예측이 아닙니다. 저장된 펀딩비로 두 레그를 각자의 정산 시각에 리플레이했으며, 레그당 $10,000 기준입니다. 정산된 금액순이며 아무것도 걸러내지 않았습니다. 그러니 큰 숫자를 거래로 받아들이기 전에 얇은 레그의 깊이와 나쁜 레그의 요율을 확인하세요.",
  "{asset} carry, long {long} / short {short}: {funding} of funding settled on {size} a leg over the last {span}. {net} after retail fees. Price risk hedged, not guessed.":
    "{asset} 캐리, 롱 {long} / 숏 {short}: 최근 {span} 동안 레그당 {size}로 펀딩비 {funding} 정산. 일반 수수료 차감 후 {net}. 가격 위험은 추측이 아니라 헤지했습니다.",
  "Best verified carry, last {span}": "최근 {span} 검증된 최고 캐리",
  "funding settled on {size} per leg": "레그당 {size} 기준 정산된 펀딩비",
  "after retail fees {value}": "일반 수수료 차감 후 {value}",
  "annualized {value} before fees": "수수료 전 연환산 {value}",
  "win rate {value} of days": "일별 승률 {value}",
  "thinner leg {value} open interest": "얇은 레그 미결제약정 {value}",
  "stability {value}": "안정성 {value}",
  "Open this backtest": "이 백테스트 열기",
  "Settled, not forecast: both legs replayed at their own settlement times. This is the best pair in the newest nightly run with at least {oi} of open interest on its thinner leg, neither leg past {apr}% a year, stability of {stability} or better and no missed settlements. Retail fees are {bps} bps on each of {fills} fills, opening and closing both legs. Last week's funding is not a promise about next week's.":
    "예측이 아닌 정산 결과: 두 레그를 각자의 정산 시각에 리플레이했습니다. 최신 야간 실행에서 얇은 레그의 미결제약정이 {oi} 이상이고, 두 레그 모두 연 {apr}% 이하이며, 안정성 {stability} 이상이고 누락된 정산이 없는 페어 중 최고입니다. 일반 수수료는 두 레그의 진입과 청산을 합친 {fills}번 체결에 각각 {bps} bps입니다. 지난주 펀딩비가 다음 주를 보장하지 않습니다.",
  "Widest funding spread across perp exchanges right now: {asset} at {spread} a year. Long {long} at {longApr}, short {short} at {shortApr}.":
    "현재 무기한 선물 거래소 간 가장 큰 펀딩비 스프레드: {asset}, 연 {spread}. 롱 {long}({longApr}), 숏 {short}({shortApr}).",
  "funding spread, per year": "펀딩비 스프레드, 연간",
  "{symbol} at {apr}": "{symbol}, {apr}",
  "Holding equal size on both legs cancels the price exposure; the gap between the two funding rates is what the pair collects over a year, before trading fees and before either rate moves.":
    "두 레그를 같은 규모로 보유하면 가격 노출이 상쇄됩니다. 두 펀딩비의 차이가 페어가 1년 동안 받는 수익이며, 거래 수수료와 요율 변동은 반영하기 전입니다.",

  // screener
  "Funding spread screener": "펀딩비 스프레드 스크리너",
  "Filter live cross-exchange funding spreads by open interest, volume and exchange type.":
    "실시간 거래소 간 펀딩비 스프레드를 미결제약정, 거래량, 거래소 유형으로 필터링합니다.",
  "For each asset, the cheapest market to hold long and the richest to hold short, on different exchanges. Each leg must pass the filters.":
    "자산마다 서로 다른 거래소에서 롱 보유 비용이 가장 낮은 종목과 숏 보유 수익이 가장 높은 종목을 찾습니다. 각 레그는 필터를 통과해야 합니다.",
  "No pairs match these filters. Lower the minimum open interest or include more exchange types.":
    "이 필터에 맞는 페어가 없습니다. 최소 미결제약정을 낮추거나 거래소 유형을 더 포함하세요.",
  "Min open interest, each leg": "레그별 최소 미결제약정",
  "Min 24h volume, each leg": "레그별 최소 24시간 거래량",
  "Exchange types": "거래소 유형",
  Settlement: "정산 통화",
  "A USDT leg against a USDC leg carries the basis between the two stablecoins and needs collateral in both. Ticked, each asset is paired only within one quote currency":
    "USDT 레그와 USDC 레그를 짝지으면 두 스테이블코인 사이의 베이시스를 떠안고 양쪽 모두에 담보가 필요합니다. 체크하면 자산마다 같은 견적 통화 안에서만 페어를 만듭니다",
  "Same quote currency on both legs": "두 레그 같은 견적 통화",
  "Distressed markets": "부실 종목",
  "Delisting and distressed listings can pay beyond ±2000% APR and crowd out tradeable spreads":
    "상장 폐지 및 부실 상장 종목은 연환산 ±2000%를 넘을 수 있어 거래 가능한 스프레드를 밀어냅니다",
  "Include beyond ±1000% APR": "연환산 ±1000% 초과 포함",
  Rows: "행 수",
  "Apply filters": "필터 적용",
  Spread: "스프레드",
  Venues: "거래소",
  "Neither leg has settled funding to score yet":
    "두 레그 모두 아직 점수를 매길 정산 펀딩비가 없습니다",
  "The long leg has no settled funding to score yet":
    "롱 레그에 아직 점수를 매길 정산 펀딩비가 없습니다",
  "The short leg has no settled funding to score yet":
    "숏 레그에 아직 점수를 매길 정산 펀딩비가 없습니다",
  "Weaker leg held its direction on {days} of its charging days in the last 30":
    "최근 30일 중 약한 레그가 부과일 {days}일에 방향을 유지했습니다",
  "This exchange does not say what the leg settles in, so it cannot be shown to match the other leg":
    "이 거래소는 레그의 정산 통화를 밝히지 않아 다른 레그와 일치하는지 보여줄 수 없습니다",
  "Settles in {quote} while the other leg settles in {other}: the pair carries the basis between them":
    "{quote}(으)로 정산되고 다른 레그는 {other}(으)로 정산됩니다. 이 페어는 둘 사이의 베이시스를 떠안습니다",
  "an undeclared currency": "밝히지 않은 통화",
  "quote ?": "견적 ?",
  OI: "미결제약정",
  "{asset} pays {spread} a year to hold both sides: long {long} at {longApr}, short {short} at {shortApr}. Same coin, two exchanges, price exposure cancelled.":
    "{asset} 양쪽을 보유하면 연 {spread}: 롱 {long}({longApr}), 숏 {short}({shortApr}). 같은 코인, 두 거래소, 가격 노출 상쇄.",
  "Signed log scale, so ordinary rates keep room next to extreme ones":
    "부호 있는 로그 척도라 극단적인 요율 옆에서도 보통 요율이 보입니다",
  "Long − short, log scale": "롱 − 숏, 로그 척도",
  "Exchanges with a live market for this asset": "이 자산의 활성 종목이 있는 거래소",
  "How often the weaker leg held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "30일 동안 약한 레그가 펀딩비 방향을 유지한 빈도. 0.50은 동전 던지기 수준이고, 0.88이 한 달 전체로 받을 수 있는 최고점입니다",

  // exchanges and one exchange
  Exchanges: "거래소",
  "No exchange has reported in the last five minutes.":
    "최근 5분 동안 데이터를 보낸 거래소가 없습니다.",
  Exchange: "거래소",
  Type: "유형",
  "Open interest": "미결제약정",
  "24h volume": "24시간 거래량",
  Updated: "업데이트",
  "{venue}: {count} live perp markets, {oi} open interest. Richest funding {richest} at {richestApr} a year; cheapest {cheapest} at {cheapestApr}.":
    "{venue}: 활성 무기한 선물 종목 {count}개, 미결제약정 {oi}. 펀딩비 최고 {richest}(연 {richestApr}), 최저 {cheapest}(연 {cheapestApr}).",
  "{venue} funding rates": "{venue} 펀딩비",
  "Live funding rates, open interest and volume for every {venue} perpetual market.":
    "{venue} 모든 무기한 선물 종목의 실시간 펀딩비, 미결제약정, 거래량.",
  "No live markets from {venue}: it isn't collected yet, or its last update is more than five minutes old.":
    "{venue}의 활성 종목이 없습니다. 아직 수집하지 않았거나 마지막 업데이트가 5분 이상 지났습니다.",
  "{count} live markets": "활성 종목 {count}개",
  "{value} open interest": "미결제약정 {value}",
  "updated {value}": "{value} 업데이트",
  Market: "종목",
  "Funding APR": "펀딩비 연환산",
  "Rate, log scale": "요율, 로그 척도",
  Interval: "정산 주기",
  "Next funding": "다음 정산",
  "Mark price": "마크 가격",
  "Centralized exchange": "중앙화 거래소",
  "Onchain perp exchange": "온체인 무기한 선물 거래소",
  "Hyperliquid HIP-3 dex": "Hyperliquid HIP-3 DEX",

  // rates
  now: "현재",
  asset: "자산",
  "open interest": "미결제약정",
  spread: "스프레드",
  "{asset} funding runs from {low} on {lowVenue} to {high} on {highVenue}: {gap} a year apart across {count} exchanges.":
    "{asset} 펀딩비는 {lowVenue}의 {low}부터 {highVenue}의 {high}까지, 거래소 {count}곳 사이에서 연 {gap} 차이가 납니다.",
  previous: "이전",
  "assets {from}–{to}": "자산 {from}–{to}",
  next: "다음",
  "No asset has live markets on two or more venues right now.":
    "지금 두 곳 이상의 거래소에 활성 종목이 있는 자산이 없습니다.",
  Rates: "요율",
  "Funding APR for every asset across every perpetual exchange, in one grid.":
    "모든 무기한 선물 거래소의 모든 자산 펀딩비 연환산을 한 표에.",
  "Every exchange's funding for the deepest assets at once. Positive means longs pay, so a short collects; an empty cell means that exchange has no market for the asset, not that funding is flat.":
    "가장 깊은 자산들의 거래소별 펀딩비를 한눈에 봅니다. 양수는 롱이 지불하고 숏이 받는다는 뜻입니다. 빈 칸은 펀딩비가 0이라는 뜻이 아니라 그 거래소에 해당 자산 종목이 없다는 뜻입니다.",

  // price gaps
  "{asset}: buy on {buyVenue} at {buyPrice}, sell on {sellVenue} at {sellPrice}. A {gap} bps gap at the top of the book.":
    "{asset}: {buyVenue}에서 {buyPrice}에 매수, {sellVenue}에서 {sellPrice}에 매도. 최우선 호가 기준 {gap} bps 차이.",
  "Quotes seen {quoted}; the older leg's funding row fetched {fetched}":
    "호가 확인 {quoted}, 오래된 레그의 펀딩비 데이터 수집 {fetched}",
  "No asset quotes a gap this wide right now. The median comparable asset sits near 1.6 bps, so try a lower floor.":
    "지금 이만큼 큰 차이를 보이는 자산이 없습니다. 비교 가능한 자산의 중앙값이 약 1.6 bps이니 하한을 낮춰 보세요.",
  "Highest bid against lowest ask, across two different exchanges":
    "서로 다른 두 거래소의 최고 매수 호가 대 최저 매도 호가",
  "Gap, bps": "차이(bps)",
  "The sell price less the buy price, in the asset's own price units":
    "매도 가격에서 매수 가격을 뺀 값, 자산 자체의 가격 단위",
  Basis: "베이시스",
  "The smaller of the two resting sizes: what the gap is actually good for":
    "양쪽 잔량 중 작은 쪽: 이 차이로 실제 거래할 수 있는 규모",
  "Good for": "가용 규모",
  "Buy price": "매수 가격",
  "Buy at": "매수 거래소",
  "Ask size": "매도 잔량",
  "Sell price": "매도 가격",
  "Sell at": "매도 거래소",
  "Bid size": "매수 잔량",
  "Exchanges quoting this asset that survived the mark-agreement check":
    "이 자산을 호가하며 마크 가격 일치 검사를 통과한 거래소",
  Quoted: "호가 시각",
  "Price gaps across exchanges": "거래소 간 가격 차이",
  "Where one exchange's bid sits above another's ask.":
    "한 거래소의 매수 호가가 다른 거래소의 매도 호가보다 높은 곳.",
  "Price gaps": "가격 차이",
  "For each asset, the cheapest exchange to buy and the dearest to sell, at the top of each book. These are <b>quotable gaps</b>, not fillable trades: nothing here reflects the book below level 1, the taker fees, or the two transfers a real position needs. The widest gaps sit on the thinnest books — when this was measured, 395 of 721 assets showed any gap at a median of 1.6 bps, while the leaders were good for as little as $3 of resting size.":
    "자산마다 각 호가창의 최우선 호가에서 가장 싸게 살 수 있는 거래소와 가장 비싸게 팔 수 있는 거래소를 찾습니다. 이것은 체결 가능한 거래가 아니라 <b>호가상의 차이</b>입니다. 1호가 아래의 호가창, 테이커 수수료, 실제 포지션에 필요한 두 번의 이체는 반영하지 않습니다. 가장 큰 차이는 가장 얇은 호가창에 있습니다. 측정 당시 721개 자산 중 395개에 차이가 있었고 중앙값은 1.6 bps였으며, 상위 종목의 잔량은 고작 $3인 경우도 있었습니다.",
  "Min gap, bps": "최소 차이(bps)",
  "Any, including 0.0": "전체, 0.0 포함",
  "Min resting size": "최소 잔량",
  Apply: "적용",
  "This venue's mark disagrees with the rest, so it is excluded from the gap":
    "이 거래소의 마크 가격이 다른 곳과 맞지 않아 차이 계산에서 제외했습니다",
  "Marked {ratio}× above this asset's deepest market, so it is a different instrument, not a price gap":
    "마크 가격이 이 자산의 가장 깊은 종목보다 {ratio}× 높아 가격 차이가 아니라 다른 상품입니다",
  "Marked {ratio}× below this asset's deepest market, so it is a different instrument, not a price gap":
    "마크 가격이 이 자산의 가장 깊은 종목보다 {ratio}× 낮아 가격 차이가 아니라 다른 상품입니다",
  best: "최우선",
  "This venue's own bid-ask spread, which a taker crosses on entry and again on exit":
    "이 거래소 자체의 매수·매도 스프레드로, 테이커는 진입할 때와 청산할 때 한 번씩 넘습니다",
  "This venue's funding row has not been refreshed within the freshness window, so its mark is withheld rather than shown stale — the quote beside it is live":
    "이 거래소의 펀딩비 데이터가 유효 시간 안에 갱신되지 않아, 오래된 마크 가격을 보여주는 대신 숨겼습니다. 옆의 호가는 실시간입니다",
  "Quote seen {quoted}; funding row fetched {fetched}":
    "호가 확인 {quoted}, 펀딩비 데이터 수집 {fetched}",
  "Every pair": "모든 페어",
  "One row per direction: buy at the first exchange, sell at the second. The widest gap is often not the one to take — a narrower pair can rest far more size behind it, and most directions lose outright.":
    "방향마다 한 행입니다. 첫 번째 거래소에서 매수, 두 번째 거래소에서 매도합니다. 가장 큰 차이가 꼭 잡을 만한 것은 아닙니다. 더 좁은 페어 뒤에 훨씬 많은 잔량이 있을 수 있고, 대부분의 방향은 그냥 손실입니다.",
  "The smaller of the buying side's ask size and the selling side's bid size — what this direction is good for":
    "매수 쪽 매도 잔량과 매도 쪽 매수 잔량 중 작은 쪽: 이 방향으로 거래할 수 있는 규모",
  "No two exchanges quote {asset} in a way that can be compared right now.":
    "지금 {asset}을(를) 비교 가능하게 호가하는 거래소가 두 곳이 되지 않습니다.",
  "Buying on {buy} and selling on {sell} quotes {gap}, though one side's resting size is unknown.":
    "{buy}에서 매수하고 {sell}에서 매도하면 호가 차이는 {gap}이지만, 한쪽의 잔량을 알 수 없습니다.",
  "Buying on {buy} and selling on {sell} quotes {gap}, good for about {size}.":
    "{buy}에서 매수하고 {sell}에서 매도하면 호가 차이는 {gap}, 가용 규모는 약 {size}입니다.",
  "That is a quote at the size shown, not a fillable trade: it is before fees, before the book below level 1, and before the transfer between two exchanges.":
    "표시된 규모의 호가일 뿐 체결 가능한 거래가 아닙니다. 수수료, 1호가 아래의 호가창, 두 거래소 간 이체를 반영하기 전입니다.",
  Status: "상태",
  "{count} venue is shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "거래소 {count}곳은 흐리게 표시하고 차이 계산에서 뺐습니다: {venues}. 마크 가격이 미결제약정 기준 이 자산의 가장 깊은 종목과 10% 넘게 달라, 가격 차이가 아니라 계약 단위나 이름이 다른 상품이라는 뜻입니다. 이 검사가 1375× 불일치를 13,660,780 bps 기회로 게시하는 일을 막습니다. 각각의 이유는 {status} 페이지에 있습니다.",
  "{count} venues are shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "거래소 {count}곳은 흐리게 표시하고 차이 계산에서 뺐습니다: {venues}. 마크 가격이 미결제약정 기준 이 자산의 가장 깊은 종목과 10% 넘게 달라, 가격 차이가 아니라 계약 단위나 이름이 다른 상품이라는 뜻입니다. 이 검사가 1375× 불일치를 13,660,780 bps 기회로 게시하는 일을 막습니다. 각각의 이유는 {status} 페이지에 있습니다.",
  "{asset} price gaps by exchange": "{asset} 거래소별 가격 차이",
  "{asset} best bid and ask on every exchange that quotes it, with the size resting at each.":
    "{asset}을(를) 호가하는 모든 거래소의 최우선 매수·매도 호가와 각 잔량.",
  "Every exchange": "모든 거래소",
  "Best bid": "최우선 매수",
  "Best ask": "최우선 매도",
  "The venue's own bid-ask spread in basis points": "거래소 자체의 매수·매도 스프레드(bps)",
  "Own spread": "자체 스프레드",
  Mark: "마크 가격",
  "Sizes are the money resting at the very top of each book, converted to USD because the three venues that publish depth count it differently — Gate in contracts, OKX in contracts against <code>ctVal</code>, Bybit in base coin. Reading those raw, side by side, is a 10,000× error.":
    "규모는 각 호가창 최우선 호가에 걸린 금액을 USD로 환산한 것입니다. 깊이를 공개하는 세 거래소의 단위가 다르기 때문입니다. Gate는 계약 수, OKX는 <code>ctVal</code>을 곱한 계약 수, Bybit는 기초 코인 단위입니다. 원래 숫자를 나란히 읽으면 10,000× 오차가 납니다.",

  // one asset
  "Best pair: long on {long} at {longApr}, short on {short} at {shortApr}, a {spread} spread per year.":
    "최고 페어: {long}에서 롱({longApr}), {short}에서 숏({shortApr}), 연 {spread} 스프레드.",
  "Only markets with at least {minOi} open interest are paired.":
    "미결제약정이 {minOi} 이상인 종목만 페어로 묶습니다.",
  "Funding only, before trading fees: none were entered.":
    "펀딩비만 반영, 거래 수수료 전: 수수료를 입력하지 않았습니다.",
  "Only one exchange lists it right now, so there's no cross-exchange pair.":
    "지금은 한 거래소에만 상장되어 있어 거래소 간 페어가 없습니다.",
  "No two exchanges have at least {minOi} open interest in it, so there's no pair to show.":
    "미결제약정이 {minOi} 이상인 거래소가 두 곳이 되지 않아 보여줄 페어가 없습니다.",
  "{asset} funding rates by exchange": "{asset} 거래소별 펀딩비",
  "{asset} perpetual funding rates across {count} exchanges, with the widest long/short spread.":
    "거래소 {count}곳의 {asset} 무기한 선물 펀딩비와 가장 큰 롱/숏 스프레드.",
  "Funding by exchange": "거래소별 펀딩비",
  "{markets} live markets on {venues} exchanges.": "거래소 {venues}곳, 활성 종목 {markets}개.",
  "{asset} funding across {count} exchanges: long {long} at {longApr}, short {short} at {shortApr}. A {spread} spread a year on one coin.":
    "거래소 {count}곳의 {asset} 펀딩비: 롱 {long}({longApr}), 숏 {short}({shortApr}). 한 코인으로 연 {spread} 스프레드.",
  "Backtest this pair": "이 페어 백테스트",
  "long {long} · short {short} · {spread} a year, replayed on settled funding":
    "롱 {long} · 숏 {short} · 연 {spread}, 정산된 펀딩비로 리플레이",
  "24h settled": "24시간 정산",
  "How often this market held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "30일 동안 이 종목이 펀딩비 방향을 유지한 빈도. 0.50은 동전 던지기 수준이고, 0.88이 한 달 전체로 받을 수 있는 최고점입니다",
  "Last 7 charging days against the days before them, in APR points. Up means funding is widening in the direction it already had":
    "최근 부과일 7일과 그 이전 날들의 비교, 연환산 %p 단위. 상승은 펀딩비가 기존 방향으로 커지고 있다는 뜻입니다",
  "30d trend": "30일 추세",

  // pair backtest
  "capital {amount} — {venue} will not open a position above {max} on {symbol}":
    "자본 {amount} — {venue}에서는 {symbol} 포지션을 {max} 넘게 열 수 없습니다",
  "capital {amount} across both legs at {leverage}":
    "두 레그 합계 자본 {amount}, 레버리지 {leverage}",
  "capital {amount} across both legs, unleveraged": "두 레그 합계 자본 {amount}, 레버리지 없음",
  "capital at least {amount} across both legs — {leverage} is the small-size maximum":
    "두 레그 합계 자본 최소 {amount} — {leverage}는 소규모 포지션의 최대 레버리지입니다",
  "capital {amount} across both legs at {leverage} (small size)":
    "두 레그 합계 자본 {amount}, 레버리지 {leverage}(소규모)",
  "Cumulative funding reaches {amount} after {days} days": "{days}일 후 누적 펀딩비 {amount} 도달",
  "Cumulative funding on {size} per leg · {from} to {to}":
    "레그당 {size} 기준 누적 펀딩비 · {from} ~ {to}",
  "Taker fee in basis points, per fill. Both legs must be filled in before costs are charged.":
    "체결당 테이커 수수료(bps). 두 레그를 모두 입력해야 비용이 반영됩니다.",
  "blank = ignore": "비우면 무시",
  Window: "기간",
  "Long on": "롱 거래소",
  "Short on": "숏 거래소",
  "Size per leg": "레그당 규모",
  "Long taker fee": "롱 테이커 수수료",
  "Short taker fee": "숏 테이커 수수료",
  "Run backtest": "백테스트 실행",
  "swap legs": "레그 바꾸기",
  "What entering and exiting would cost at each exchange's top of book":
    "각 거래소 최우선 호가에서 진입하고 청산할 때의 비용",
  "price gap": "가격 차이",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, before fees. Replayed from settled funding:":
    "{asset} 펀딩비 캐리, 롱 {long} / 숏 {short}: 최근 {span} 동안 레그당 {size}로 {net}, 수수료 전. 정산된 펀딩비로 리플레이:",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, after fees. Replayed from settled funding:":
    "{asset} 펀딩비 캐리, 롱 {long} / 숏 {short}: 최근 {span} 동안 레그당 {size}로 {net}, 수수료 차감 후. 정산된 펀딩비로 리플레이:",
  "Share on X": "X에 공유",
  "opens a post with this result and a link back to it": "이 결과와 링크가 담긴 게시물을 엽니다",
  "after costs {net} on {fees} of fees": "수수료 {fees} 차감 후 {net}",
  "never repays the fees at this rate": "이 요율로는 수수료를 회수하지 못합니다",
  "fees repay in {days}": "수수료 회수까지 {days}",
  "under a day": "1일 미만",
  Jan: "1월",
  Feb: "2월",
  Mar: "3월",
  Apr: "4월",
  May: "5월",
  Jun: "6월",
  Jul: "7월",
  Aug: "8월",
  Sep: "9월",
  Oct: "10월",
  Nov: "11월",
  Dec: "12월",
  "{month} {day}": "{month} {day}일",
  "best day {amount} {date}": "일간 최고 {amount} ({date})",
  "worst day {amount} {date}": "일간 최저 {amount} ({date})",
  "The largest fall in cumulative funding from a previous high, before costs":
    "누적 펀딩비가 직전 고점에서 가장 크게 떨어진 폭, 비용 전",
  "max drawdown {amount}": "최대 낙폭 {amount}",
  "{days}d avg {apr}": "{days}일 평균 {apr}",
  "now {apr}, {average}, every {interval}": "현재 {apr}, {average}, {interval}마다",
  "now {apr}, every {interval}": "현재 {apr}, {interval}마다",
  "net funding over the last {span} · {apr} annualized": "최근 {span} 순 펀딩비 · 연환산 {apr}",
  "Long {venue}": "롱 {venue}",
  "{n} settlements": "정산 {n}회",
  "Short {venue}": "숏 {venue}",
  "win rate {value} of {days} days": "{days}일 중 승률 {value}",
  "average {value} a day": "하루 평균 {value}",
  "Missed settlements: {long} on {longVenue}, {short} on {shortVenue}. A gap is reported rather than counted as zero, so this total covers only the settlements actually recorded.":
    "누락된 정산: {longVenue} {long}회, {shortVenue} {short}회. 빈 곳은 0으로 치지 않고 그대로 알리므로, 이 합계는 실제로 기록된 정산만 포함합니다.",
  "Only {have} of the {asked} days asked for have stored settlements. The annualized figure still divides by the whole window, so it reads low. The daily rollup keeps 70 days, and history is still filling on some venues.":
    "요청한 {asked}일 중 저장된 정산이 있는 날은 {have}일뿐입니다. 연환산 수치는 여전히 전체 기간으로 나누므로 낮게 나옵니다. 일별 집계는 70일간 보관하며, 일부 거래소는 아직 기록을 채우는 중입니다.",
  "Funding only, on a position kept at {size} per leg. Trading fees are excluded because none were given: taker fees depend on your own volume tier and discounts, so fill in both legs' fees above to see this net of costs. Price moves between settlements aren't modelled either, because venue funding history gives a rate and a time, and almost never a mark price.":
    "레그당 {size}로 유지한 포지션의 펀딩비만 반영합니다. 수수료를 입력하지 않아 거래 수수료는 빠졌습니다. 테이커 수수료는 본인의 거래량 등급과 할인에 따라 다르니, 비용을 뺀 결과를 보려면 위에서 두 레그의 수수료를 입력하세요. 정산 사이의 가격 변동도 모델링하지 않습니다. 거래소의 펀딩비 기록에는 요율과 시각만 있고 마크 가격은 거의 없기 때문입니다.",
  "Net of the fees you entered, on a position kept at {size} per leg: {long} bps long and {short} bps short, charged on four fills — entry and exit on both legs. Opening and closing once is assumed; rolling the position would cost this again each time. Price moves between settlements still aren't modelled, because venue funding history gives a rate and a time, and almost never a mark price.":
    "입력한 수수료를 뺀 결과이며, 포지션은 레그당 {size}로 유지합니다: 롱 {long} bps, 숏 {short} bps를 네 번의 체결, 즉 두 레그의 진입과 청산에 부과합니다. 한 번 열고 한 번 닫는다고 가정합니다. 포지션을 롤오버하면 그때마다 이 비용이 다시 듭니다. 정산 사이의 가격 변동은 여전히 모델링하지 않습니다. 거래소의 펀딩비 기록에는 요율과 시각만 있고 마크 가격은 거의 없기 때문입니다.",
  "Only one exchange lists {asset} right now, so there's no pair to hold.":
    "지금은 한 거래소에만 {asset}이(가) 상장되어 있어 보유할 페어가 없습니다.",
  "Pick two exchanges to hold against each other.": "서로 맞세워 보유할 거래소 두 곳을 고르세요.",
  "{asset} funding carry backtest": "{asset} 펀딩비 캐리 백테스트",
  "What holding {asset} long on one exchange and short on another would have paid in funding.":
    "한 거래소에서 {asset} 롱, 다른 거래소에서 숏을 보유했다면 받았을 펀딩비.",
  backtest: "백테스트",
  "{asset} carry": "{asset} 캐리",
  "Every exchange's funding over one window, and what the two legs you pick actually settled, summed per UTC day. Windows are whole calendar days ending today, and the figures refresh hourly.":
    "한 기간 동안 모든 거래소의 펀딩비와, 선택한 두 레그가 실제로 정산한 금액을 UTC 일 단위로 합산합니다. 기간은 오늘로 끝나는 온전한 달력 날짜이며, 수치는 매시간 갱신됩니다.",

  // errors
  "Too many requests": "요청이 너무 많습니다",
  "Too many backtests from this address.": "이 주소에서 백테스트를 너무 많이 실행했습니다.",
  "That is more backtests than one address may run in a minute. Wait a moment and try again. Results already computed are served from the cache and are never limited, so a combination someone has run before still loads immediately.":
    "한 주소가 1분에 실행할 수 있는 백테스트 수를 넘었습니다. 잠시 후 다시 시도하세요. 이미 계산된 결과는 캐시에서 제공되며 제한이 없으므로, 누군가 실행한 적 있는 조합은 바로 열립니다.",
  "Back to the screener": "스크리너로 돌아가기",
  "Not found": "찾을 수 없음",
  "Page not found.": "페이지를 찾을 수 없습니다.",
  "Nothing lives at {path}.": "{path}에는 아무것도 없습니다.",
  "See today's widest spreads": "오늘 가장 큰 스프레드 보기",
  "A runner sprinting": "전력 질주하는 주자",
  "Data center busy": "데이터 센터 혼잡",
  "The data center is too busy and a runner is on it. Try again later.":
    "데이터 센터가 너무 바빠 주자가 뛰고 있습니다. 나중에 다시 시도하세요.",
  "The data center is getting too busy and is currently sprinting in circles":
    "데이터 센터가 너무 바빠져서 지금 제자리를 맴돌며 전력 질주 중입니다",
  "Every server is screaming, the funding rates are on fire, and one intern is running the whole thing on foot. Go touch grass and try again later.":
    "서버는 전부 비명을 지르고, 펀딩비는 불타고, 인턴 한 명이 두 발로 뛰며 전부를 떠받치고 있습니다. 바람 좀 쐬고 나중에 다시 오세요.",
  "Try again": "다시 시도",
  // pages.ts invertedMark: an FX leg quoted the other way round (migration 041).
  "short this contract": "이 종목 숏",
  "long this contract": "이 종목 롱",
  "sell this contract": "이 종목 매도",
  "buy this contract": "이 종목 매수",
  "{symbol} quotes this pair the other way round, so this side of the pair is the opposite side of that contract. Its price is shown inverted and its funding with the sign flipped, in the pair's terms.":
    "{symbol}은(는) 이 통화쌍을 반대 방향으로 호가하므로, 통화쌍의 이쪽은 그 종목의 반대쪽입니다. 가격은 역수로, 펀딩비는 부호를 바꿔 통화쌍 기준으로 표시합니다.",
  Now: "현재",
  "7D APR": "7일 연환산",
  "Payback, days": "회수 일수",
  Long: "롱",
  Short: "숏",
  "7d {apr}": "7일 {apr}",
  "The funding spread now: short leg's rate minus long leg's, a year":
    "현재 펀딩비 차이: 숏 레그 비율에서 롱 레그 비율을 뺀 연환산",
  "The same two markets' spread, averaged over the settlements of the last 7 days, a year":
    "같은 두 종목의 차이를 최근 7일 정산으로 평균한 연환산",
  "Days of funding it takes to repay the fees of opening and closing both legs, at public retail taker rates. From the 7-day spread; dimmed where there is only the spread now":
    "공개된 일반 테이커 수수료 기준으로, 두 레그의 진입과 청산 수수료를 펀딩비로 회수하는 데 걸리는 일수. 7일 차이로 계산하며 현재 차이만 있으면 흐리게 표시",
  "Where to hold the long side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "롱을 보유할 곳: 거래소와 현재 펀딩비. 아래에 종목, 정산 주기, 미결제약정, 7일 펀딩비",
  "Where to hold the short side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "숏을 보유할 곳: 거래소와 현재 펀딩비. 아래에 종목, 정산 주기, 미결제약정, 7일 펀딩비",
  "Days of the 7-day spread it takes to repay {bps} bps of fees: a taker fill in and out of both legs, at public retail rates":
    "7일 차이로 {bps} bps 수수료를 회수하는 데 걸리는 일수: 두 레그 모두 테이커로 진입과 청산 한 번씩, 공개된 일반 수수료 기준",
  "No 7 days of settlements yet, so this is from the spread now: days to repay {bps} bps of fees, a taker fill in and out of both legs, at public retail rates":
    "아직 7일치 정산이 없어 현재 차이로 계산: {bps} bps 수수료를 회수하는 데 걸리는 일수, 두 레그 모두 테이커로 진입과 청산 한 번씩, 공개된 일반 수수료 기준",
};
