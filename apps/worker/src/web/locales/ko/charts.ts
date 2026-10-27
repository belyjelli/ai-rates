/**
 * Korean for the chart pages and their readouts: web/cvd.ts, web/kchart.ts, web/sentiment.ts,
 * web/funding-chart.ts and web/slot-chart.ts (web/rail.ts has no words of its own). Glossary and
 * style: ./index.ts.
 *
 * Terms: cumulative volume delta 누적 거래량 델타 (CVD left as written), taker flow 테이커 흐름,
 * taker buys / sells 테이커 매수 / 매도, net buy / net sell 순매수 / 순매도, bar (on a time axis) 봉,
 * bar (a drawn bar) 막대, candle 캔들, close 종가, divergence 다이버전스 (bullish 강세, bearish 약세),
 * window 기간, reading 측정값.
 *
 * Keys shared with the liquidations part (months, dates, "Window", the hover hints) carry the same
 * translation there, which i18n.test.ts holds.
 */

import type { Catalog } from "../../i18n";

export const charts: Catalog = {
  // Dates on the axes and in the hover readouts; the month names are marked in web/slot-chart.ts.
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
  "{month} {day} {time} {zone}": "{month} {day}일 {time} {zone}",

  // web/slot-chart.ts: the hover readouts of the CVD and longs-vs-shorts charts.
  "{low} – {high} ({pct} from the mark)": "{low} – {high} (마크 가격 대비 {pct})",
  "longs liquidate here: {usd} ({n})": "이 구간 롱 청산: {usd} ({n})",
  "shorts liquidate here: {usd} ({n})": "이 구간 숏 청산: {usd} ({n})",
  "{n} position": "포지션 {n}개",
  "no whale liquidates here": "이 구간에서 청산되는 고래 없음",
  "{usd} of longs liquidate between here and the mark":
    "이 가격과 마크 가격 사이에서 롱 {usd} 청산",
  "{usd} of shorts liquidate between the mark and here":
    "마크 가격과 이 가격 사이에서 숏 {usd} 청산",
  Cursor: "커서",
  cursor: "커서",
  bar: "막대",
  cross: "십자선",
  "Light up the bar under the pointer": "포인터 아래의 막대를 강조",
  "Dashed crosshair at the pointer, with the value there on each axis":
    "포인터 위치에 점선 십자선을 그리고 각 축에 그 지점의 값을 표시",
  "no flow recorded": "기록된 흐름 없음",
  "close {price}": "종가 {price}",
  "close {price} ({pct} since start)": "종가 {price} (시작 대비 {pct})",
  "bought {usd}": "테이커 매수 {usd}",
  "sold {usd}": "테이커 매도 {usd}",
  "net {net}": "순액 {net}",
  "net {net} ({pct} of volume)": "순액 {net} (거래량의 {pct})",
  "nothing force-closed": "강제 청산 없음",
  "longs closed {usd}": "롱 청산 {usd}",
  "shorts closed {usd}": "숏 청산 {usd}",
  "longs − shorts {diff}": "롱 − 숏 {diff}",
  even: "균형",
  "longs heavier, {pct}%": "롱 우세, {pct}%",
  "shorts heavier, {pct}%": "숏 우세, {pct}%",
  "{n} liquidation": "청산 {n}건",
  "{n} liquidations": "청산 {n}건",
  "{when} (still filling)": "{when} (집계 중)",

  // web/cvd.ts: the chart.
  "{asset} · cumulative volume delta · {n}-hour bars, {zone}":
    "{asset} · 누적 거래량 델타 · {n}시간 봉, {zone}",
  "{asset} · cumulative volume delta · {n}-minute bars, {zone}":
    "{asset} · 누적 거래량 델타 · {n}분 봉, {zone}",
  "{asset} taker CVD, last {window}: {cvd}. Market buyers {bought} vs sellers {sold}.":
    "최근 {window} {asset} 테이커 CVD: {cvd}. 시장가 매수 {bought}, 시장가 매도 {sold}.",
  "Last {window}": "최근 {window}",
  "Loading {interval} bars…": "{interval} 봉 불러오는 중…",
  "Loading {asset}…": "{asset} 불러오는 중…",
  "Not available yet: there is not enough history for {interval} bars":
    "아직 볼 수 없음: {interval} 봉을 그릴 만큼 기록이 쌓이지 않았습니다",
  "Not available yet": "아직 볼 수 없음",
  Price: "가격",
  "Net buy": "순매수",
  "Net sell": "순매도",
  "hover or tap a bar to read it": "막대에 마우스를 올리거나 탭하여 값 확인",
  "{asset} bars; arrow keys read one at a time": "{asset} 막대, 방향키로 하나씩 확인",
  "{asset} price and cumulative volume delta over the last {window}":
    "최근 {window} {asset} 가격과 누적 거래량 델타",
  "{asset} net taker flow per bar": "{asset} 봉별 테이커 순흐름",

  // web/cvd.ts: tiles, controls and the screener table.
  Volume: "거래량",
  CVD: "CVD",
  "CVD / volume": "CVD / 거래량",
  Change: "변동률",
  "CVD breadth": "CVD 폭",
  "of {n} assets with net taker buying": "자산 {n}개 중 테이커 순매수 비율",
  "Bullish divergences": "강세 다이버전스",
  "price down ≥{price}%, takers net buying ≥{flow}% of volume":
    "가격 ≥{price}% 하락, 테이커 순매수 ≥ 거래량의 {flow}%",
  "Bearish divergences": "약세 다이버전스",
  "price up ≥{price}%, takers net selling ≥{flow}% of volume":
    "가격 ≥{price}% 상승, 테이커 순매도 ≥ 거래량의 {flow}%",
  "Top CVD flows": "CVD 상위 흐름",
  "largest net buy / net sell": "최대 순매수 / 순매도",
  Window: "기간",
  "bullish div": "강세 다이버전스",
  "bearish div": "약세 다이버전스",
  "Search symbol": "심볼 검색",
  Find: "찾기",
  "Pick an asset to chart": "차트로 볼 자산 선택",
  "{n} assets": "자산 {n}개",
  "No asset matches.": "일치하는 자산이 없습니다.",
  "No taker flow has been collected in the last {window}. Collection polls each venue every five minutes; a new deployment backfills about a week within its first hour.":
    "최근 {window} 동안 수집된 테이커 흐름이 없습니다. 수집기는 5분마다 각 거래소를 조회하며, 새로 배포되면 첫 1시간 안에 약 일주일치를 채워 넣습니다.",
  Asset: "자산",
  "Reference market's first close to last close in the window":
    "기간 내 기준 종목의 첫 종가 대비 마지막 종가",
  "Taker buys less taker sells, in dollars, summed over the polled venues":
    "테이커 매수에서 테이커 매도를 뺀 달러 금액, 수집 대상 거래소 합계",
  "CVD as a share of the window's taker volume": "기간 내 테이커 거래량 대비 CVD 비율",
  "Taker buys plus taker sells, in dollars": "테이커 매수와 테이커 매도의 합, 달러 기준",
  "Polled venues with flow for this asset": "이 자산의 흐름이 있는 수집 대상 거래소 수",
  Venues: "거래소",
  "Price and flow disagreeing by more than the divergence thresholds in the tiles":
    "가격과 흐름이 위 타일의 다이버전스 기준보다 크게 엇갈림",
  Signal: "신호",
  "No live market lists {asset}, so there is no flow to chart.":
    "{asset}의 운영 중인 종목이 없어 차트로 그릴 흐름이 없습니다.",
  "Newest bucket {age}.": "최신 구간: {age}.",
  "Venues publish each 5-minute bucket after it closes, so the right edge runs a few minutes behind.":
    "거래소는 5분 구간이 끝난 뒤에 그 구간을 발표하므로 차트 오른쪽 끝은 몇 분 늦습니다.",

  // web/cvd.ts: the page.
  "taker buys": "테이커 매수",
  "taker sells": "테이커 매도",
  "The asset button beside the intervals opens the screener: every polled asset's taker flow over the window. Pick one to chart it, find a ticker in its box, or sort by a heading. Change is the busiest polled market's first to last close in the window. History is uneven by venue: Binance and Gate publish weeks of it and OKX five days, so the oldest bars of a new 7-day window sum fewer venues.":
    "봉 간격 옆의 자산 버튼을 누르면 스크리너가 열립니다: 수집 대상인 모든 자산의 기간 내 테이커 흐름입니다. 하나를 골라 차트로 보거나, 검색창에서 티커를 찾거나, 열 제목으로 정렬할 수 있습니다. 변동률은 수집 대상 중 거래가 가장 활발한 종목의 기간 내 첫 종가 대비 마지막 종가입니다. 거래소마다 기록 길이가 다릅니다: Binance와 Gate는 몇 주치, OKX는 5일치를 제공하므로 새 7일 기간의 가장 오래된 봉은 더 적은 거래소의 합계입니다.",

  // web/funding-chart.ts
  "The funding chart is unavailable right now. The backtest below is unaffected.":
    "지금은 펀딩비 차트를 표시할 수 없습니다. 아래 백테스트에는 영향이 없습니다.",
  "No stored funding for this window yet.": "이 기간에 저장된 펀딩비가 아직 없습니다.",
  Spread: "스프레드",
  "Funding by exchange, annualized · hourly": "거래소별 펀딩비, 연환산 · 1시간",
  "Funding by exchange, annualized · daily": "거래소별 펀딩비, 연환산 · 1일",
  "Funding APR by exchange over the window": "기간 내 거래소별 펀딩비 연환산",
  "Hover the chart to read every visible line at one moment.":
    "차트에 마우스를 올리면 한 시점에서 보이는 모든 선의 값을 확인할 수 있습니다.",
  "Signed log scale, so ordinary rates keep room beside extreme ones. Each line holds a rate until that exchange's next settlement; a break is time with no recorded funding, not a zero.":
    "부호 있는 로그 스케일이라 극단적인 요율 옆에서도 일반적인 요율이 잘 보입니다. 각 선은 해당 거래소의 다음 정산까지 요율을 유지하며, 끊긴 구간은 0이 아니라 기록된 펀딩비가 없는 시간입니다.",

  // web/sentiment.ts
  "No readings yet in this window.": "이 기간에는 아직 측정값이 없습니다.",
  "Fear & greed: {score}, {label}": "공포와 탐욕: {score}, {label}",
  "Fear and greed score reaches {score} ({label})": "공포와 탐욕 점수 {score} ({label}) 도달",
  "{n} readings, every 30 minutes · {age} to now": "측정값 {n}개, 30분마다 · {age}부터 현재까지",
  "no data in window": "기간 내 데이터 없음",
  "Fear &amp; greed · updated {ago}": "공포와 탐욕 · {ago} 업데이트",
  "Fear &amp; greed": "공포와 탐욕",
  component: "구성 요소",
  reading: "측정값",
  "percentile (30d, greed direction)": "백분위 (30일, 탐욕 방향)",
  "funding (OI-weighted APR)": "펀딩비 (미결제약정 가중 연환산)",
  "open interest": "미결제약정",
  "liquidation skew (24h)": "청산 편향 (24시간)",
  "{pct} long-heavy": "{pct} 롱 편중",
  "taker flow (24h)": "테이커 흐름 (24시간)",
  "{pct} net buy": "{pct} 순매수",
  "Score is the mean of four components, each a percentile rank against this book's own trailing 30-day history — not a fixed scale, so the same raw number reads differently in a quiet stretch than a volatile one. <b>Funding</b> and <b>open interest</b> run high-is-greedy (crowded, levered longs paying to hold). <b>Liquidation skew</b> is inverted before averaging: a book where longs are being forced out is fear, however unusual that reading looks against its own history. <b>Taker flow</b> is net aggressive buying over aggressive selling, last 24h. Computed every 30 minutes by the collector (belyjelli/profitlock-worker, <code>collector rank-eval</code>'s sibling <code>market sentiment</code> job); coverage for liquidations and taker flow is not venue-complete, so this is a proxy, not a market-wide guarantee.":
    "점수는 네 가지 구성 요소의 평균이며, 각 요소는 이 시장 자체의 최근 30일 기록 대비 백분위 순위입니다 — 고정된 척도가 아니므로 같은 원시 값도 조용한 구간과 변동성이 큰 구간에서 다르게 읽힙니다. <b>펀딩비</b>와 <b>미결제약정</b>은 높을수록 탐욕입니다(과밀한 레버리지 롱이 보유 비용을 내는 상태). <b>청산 편향</b>은 평균하기 전에 반전합니다: 롱이 강제로 정리되는 시장은 그 값이 자체 기록 대비 아무리 이례적이어도 공포입니다. <b>테이커 흐름</b>은 최근 24시간 공격적 매수에서 공격적 매도를 뺀 순액입니다. 수집기가 30분마다 계산합니다(belyjelli/profitlock-worker, <code>collector rank-eval</code>과 같은 계열의 <code>market sentiment</code> 작업). 청산과 테이커 흐름은 모든 거래소를 포괄하지 않으므로, 이는 시장 전체를 보장하는 값이 아니라 대리 지표입니다.",
  "Fear & Greed": "공포와 탐욕",
  "A funding-market fear and greed score: OI-weighted funding, open interest, liquidation skew and taker flow, each ranked against its own 30-day history.":
    "펀딩 시장의 공포와 탐욕 점수: 미결제약정 가중 펀딩비, 미결제약정, 청산 편향, 테이커 흐름을 각각 자체 30일 기록과 비교해 순위를 매깁니다.",
  "{month} {day} {time}–{end} {zone}": "{month} {day}일 {time}–{end} {zone}",
  "close, {market}": "종가, {market}",
  "open {open} · high {high} · low {low} · close {close}":
    "시가 {open} · 고가 {high} · 저가 {low} · 종가 {close}",
  "volume {usd}": "거래대금 {usd}",
  "large taker buys {usd} ({n})": "대량 테이커 매수 {usd} ({n}건)",
  "large taker sells {usd} ({n})": "대량 테이커 매도 {usd} ({n}건)",
  "no candle": "캔들 없음",
  "{month} {day} {hours} {zone}": "{month} {day}일 {hours} {zone}",
  "{hours} {zone}": "{hours} {zone}",

  // web/kchart.ts: the trading chart on /cvd.
  "Loading older bars…": "이전 봉 불러오는 중…",
  "Nothing older: taker flow is kept for {days} days.":
    "더 이전 데이터 없음: 테이커 흐름은 {days}일간 보관됩니다.",
  "Older bars did not load. Drag again to retry.":
    "이전 봉을 불러오지 못했습니다. 다시 드래그하면 재시도합니다.",
  "drag to look back · wheel or pinch to zoom · hover a candle to read it":
    "드래그해서 과거 보기 · 휠 또는 핀치로 확대 · 캔들에 마우스를 올려 값 확인",
  "Futures CVD": "선물 CVD",
  "Spot CVD": "현물 CVD",
  "Delta buy": "델타 순매수",
  "Delta sell": "델타 순매도",
  "{asset} delta per bar, spot and futures net taker flow summed":
    "{asset} 봉별 델타(현물과 선물 테이커 순흐름의 합)",
  "No taker flow for {asset} in the last {window}. Only the ~500 assets deepest on {venues} are polled; pick one from the asset list above.":
    "최근 {window} 동안 {asset}의 테이커 흐름이 없습니다. {venues}에서 미결제약정이 가장 큰 약 500개 자산만 수집합니다. 위의 자산 목록에서 하나를 선택하세요.",
  "Price with cumulative volume delta under it: spot and futures taker buying against taker selling, their combined delta per bar, and where price and order flow disagree.":
    "가격과 그 아래의 누적 거래량 델타: 현물과 선물의 테이커 매수와 테이커 매도 비교, 봉별 합산 델타, 그리고 가격과 주문 흐름이 엇갈리는 지점.",
  "Price, with cumulative volume delta (CVD) under it: {buys} less {sells}, in dollars. Futures CVD is the exchanges' own 5-minute taker statistics for their perpetuals from <b>{venues}</b>, summed, for the ~500 assets deepest on them and every commodity, index and currency pair they list — not every venue, and nothing finer than five minutes. A divergence marks a window where price and flow pointed opposite ways; it describes what happened, not what happens next.":
    "가격, 그리고 그 아래의 누적 거래량 델타(CVD): {buys}에서 {sells}을(를) 뺀 값으로, 달러 기준입니다. 선물 CVD는 <b>{venues}</b>의 무기한 선물에 대한 거래소 자체 5분 테이커 통계를 합산한 것이며, 이들 거래소에서 미결제약정이 가장 큰 약 500개 자산과 상장된 모든 원자재·지수·통화쌍이 대상입니다 — 모든 거래소가 아니며, 5분보다 세밀한 단위도 없습니다. 다이버전스는 가격과 흐름이 반대 방향을 가리킨 기간을 표시합니다. 이는 일어난 일을 설명할 뿐, 앞으로 일어날 일을 말하지 않습니다.",
  "Spot CVD is Binance's USDT spot book alone, for the crypto assets it lists; stocks, commodities and indices have no spot book on a crypto exchange and show futures only. Spot and futures each have a pane, because their sizes differ by an order of magnitude on most assets. The histogram under them is the delta: each bar's spot and futures net summed.":
    "현물 CVD는 Binance의 USDT 현물 호가창만 사용하며, Binance에 상장된 암호화폐가 대상입니다. 주식·원자재·지수는 암호화폐 거래소에 현물 호가창이 없어 선물만 표시합니다. 대부분의 자산에서 규모가 한 자릿수 이상 차이 나므로 현물과 선물은 각각 별도의 패널을 씁니다. 그 아래 히스토그램은 델타로, 봉마다 현물 순액과 선물 순액을 합한 값입니다.",
  "Price is the busiest polled market's own candle. Each pane has its own scale, so where lines cross means nothing. Drag to look back, wheel or pinch to zoom, and hover a candle to read it in the line above the chart; on a phone, tap.":
    "가격은 수집 대상 중 거래가 가장 활발한 종목의 자체 캔들입니다. 패널마다 축이 따로 있으므로 선이 교차하는 지점에는 아무 의미가 없습니다. 드래그하면 과거를 볼 수 있고, 휠이나 핀치로 확대·축소하며, 캔들에 마우스를 올리면 차트 위 줄에 값이 표시됩니다. 휴대폰에서는 탭하세요.",
  "futures net {net}": "선물 순액 {net}",
  "spot net {net}": "현물 순액 {net}",
  "delta {net}": "델타 {net}",
  "delta {net} ({pct} of volume)": "델타 {net} (거래량의 {pct})",
  "CVD futures {futures}, spot {spot}": "CVD 선물 {futures}, 현물 {spot}",
  Open: "시가",
  High: "고가",
  Low: "저가",
  Futures: "선물",
  "Spot (Binance)": "현물(Binance)",
};
