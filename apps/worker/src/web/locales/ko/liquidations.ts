/**
 * Korean for web/liquidations.ts: the /liquidations map, the priced grid and the longs-vs-shorts
 * chart. Glossary and style: ./index.ts.
 *
 * Window codes ("24h", "7d") are left as written, as interval figures are elsewhere on the site: they
 * are units in a control strip and in its URLs, not words.
 *
 * Terms: force-closed 강제 청산, pending (modeled) liquidations 대기 청산, price band 가격 구간,
 * price level 가격 수준, window 기간, whale map 고래 지도, odds 확률, theory 가설, fade 되돌림,
 * 1 sigma 1시그마. A request to the reader ends in -세요; a statement in -ㅂ니다.
 */

import type { Catalog } from "../../i18n";

export const liquidations: Catalog = {
  // Axis dates.
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

  // Controls and legend.
  Window: "기간",
  Venue: "거래소",
  all: "전체",
  Cell: "셀",
  "longs closed": "롱 청산",
  "shorts closed": "숏 청산",
  "Band width": "구간 폭",
  Asset: "자산",
  fit: "자동",

  // The map tab.
  "{usd} across {count} liquidation — {long} long, {short} short":
    "{usd}, 청산 {count}건 — 롱 {long}, 숏 {short}",
  "{usd} across {count} liquidations — {long} long, {short} short":
    "{usd}, 청산 {count}건 — 롱 {long}, 숏 {short}",
  "This column is still filling": "이 열은 아직 집계 중입니다",
  "<b>{usd}</b> · {events} liquidations · {markets} markets":
    "<b>{usd}</b> · 청산 {events}건 · {markets}개 종목",
  "no liquidations in this window": "이 기간에 청산 없음",
  "other markets": "기타 종목",
  total: "합계",
  "No liquidations recorded in the last {window}. Only the venues that publish a feed the collector reads appear here, so a quiet window is not a quiet market.":
    "최근 {window} 동안 기록된 청산이 없습니다. 수집기가 읽는 청산 피드를 공개하는 거래소만 여기에 나오므로, 이 기간이 조용하다고 해서 시장이 조용한 것은 아닙니다.",
  "Columns are {hours}-hour buckets in {zone}, newest on the right; the last one is still filling.":
    "각 열은 {hours}시간 단위({zone})이며 최신이 오른쪽입니다. 마지막 열은 아직 집계 중입니다.",
  "Newest liquidation {age}.": "최근 청산: {age}.",
  "Rows are the {count} busiest assets by notional across every feed, and the rest are summed into “other markets”, so the totals below the grid are real totals and add up.":
    "행은 모든 피드에서 명목 금액 기준 상위 {count}개 자산이며, 나머지는 ‘기타 종목’으로 합산됩니다. 따라서 표 아래의 합계는 실제 합계이며 각 행을 더하면 일치합니다.",
  "Any row opens that asset at the price it died at.":
    "행을 누르면 그 자산의 청산을 가격별로 볼 수 있습니다.",

  // The priced tab.
  "<b>{usd}</b> · {events} liquidations · {long} long / {short} short":
    "<b>{usd}</b> · 청산 {events}건 · 롱 {long} / 숏 {short}",
  "nothing force-closed here in this window": "이 기간에 이 구간의 강제 청산 없음",
  "Fill price": "체결 가격",
  "No live market for {asset} is publishing a mark, so there is no price to band liquidations against.":
    "{asset}의 마크 가격을 공개하는 거래 중인 종목이 없어, 청산을 가격 구간으로 나눌 기준 가격이 없습니다.",
  "No liquidations recorded for {asset} in the last {window}. Only the venues publishing a feed the collector reads appear here.":
    "최근 {window} 동안 {asset}의 청산 기록이 없습니다. 수집기가 읽는 피드를 공개하는 거래소만 여기에 나옵니다.",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark; the outer rows hold everything further out.":
    "<b>{asset}</b>을(를) 마크 가격 기준 {pct}% 가격 구간으로 나누어 표시합니다. 맨 바깥 행에는 그보다 먼 청산이 모두 들어갑니다.",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark, fitted to where this asset's closes actually landed; the outer rows hold everything further out.":
    "<b>{asset}</b>을(를) 마크 가격 기준 {pct}% 가격 구간으로 나누어 표시합니다. 구간 폭은 이 자산의 청산이 실제로 일어난 위치에 맞췄습니다. 맨 바깥 행에는 그보다 먼 청산이 모두 들어갑니다.",
  "Banded from <b>{mark}</b>, the deepest market's mark — the same anchor the arbitrage guard uses, so both venues share rows.":
    "구간 기준은 <b>{mark}</b>, 즉 가장 큰 종목의 마크 가격입니다 — 차익거래 검증과 같은 기준이므로 두 거래소가 같은 행을 씁니다.",

  // The longs-vs-shorts tab and its chart.
  "Last {window}": "최근 {window}",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Longs took the beating.":
    "{asset} 청산, 최근 {window}: 롱 {long}, 숏 {short} 강제 청산, 총 {events}건. 롱의 피해가 더 컸습니다.",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Shorts took the beating.":
    "{asset} 청산, 최근 {window}: 롱 {long}, 숏 {short} 강제 청산, 총 {events}건. 숏의 피해가 더 컸습니다.",
  "{asset} longs vs shorts over time · {hours}-hour bars, {zone}":
    "{asset} 시간대별 롱 대 숏 · {hours}시간 막대, {zone}",
  "{asset} longs vs shorts over time · {minutes}-minute bars, {zone}":
    "{asset} 시간대별 롱 대 숏 · {minutes}분 막대, {zone}",
  "Longs closed": "롱 청산",
  "Shorts closed": "숏 청산",
  "Longs at risk, modeled · price falls <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "롱 위험(모델 추정) · 가격이 <b>{pct}</b> 하락해 {range} 도달 시 · 약 <b>{usd}</b> 청산",
  "Shorts at risk, modeled · price rises <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "숏 위험(모델 추정) · 가격이 <b>{pct}</b> 상승해 {range} 도달 시 · 약 <b>{usd}</b> 청산",
  "Shorts at risk above": "위쪽 숏 위험",
  "Longs at risk below": "아래쪽 롱 위험",
  "Modeled pending liquidations between {low} and {high}, around {mark}: about {shorts} of shorts above and {longs} of longs below":
    "{low}~{high} 구간(현재 {mark} 기준)의 대기 청산(모델 추정): 위쪽 숏 약 {shorts}, 아래쪽 롱 약 {longs}",
  "Pending range": "대기 청산 범위",
  "Zoom in": "확대",
  "Columns are time, in your time zone ({zone}; click the clock at the top for UTC). Each is a {hours}-hour block named by its start hour. Where the day changes, the column shows date/hour (7/00 = the 7th at 00:00). The yellow column is the block in progress and still filling.":
    "열은 시간이며, 사용자의 시간대({zone}, 상단 시계를 클릭하면 UTC)로 표시합니다. 각 열은 {hours}시간 단위이며 시작 시각으로 표시합니다. 날짜가 바뀌는 곳에서는 일/시(7/00 = 7일 00:00)로 표시합니다. 노란색 열은 진행 중인 구간으로 아직 집계 중입니다.",
  "'All' is that price row's total over the whole window.":
    "‘전체’는 그 가격 행의 전체 기간 합계입니다.",
  "{range}, still filling": "{range}, 집계 중",
  "This tab did not load.": "이 탭을 불러오지 못했습니다.",
  "Try again": "다시 시도",
  "Loading…": "불러오는 중…",
  "Open this tab": "이 탭 열기",
  "This tab has nothing to show right now.": "지금은 이 탭에 표시할 내용이 없습니다.",
  "Zoom out": "축소",
  "shorts liquidate if price rises": "가격 상승 시 숏 청산",
  "longs liquidate if price falls": "가격 하락 시 롱 청산",
  "pending is modeled": "대기 청산은 모델 추정",
  "pending by price band": "가격 구간별 대기 청산",
  "axis squeezed above {usd}": "{usd} 초과는 세로축 압축",
  "Modeled from 30 days of open interest and price on each market and its leverage limits, not reported by venues.":
    "각 시장의 30일 미결제약정과 가격, 레버리지 한도로 추정한 값이며, 거래소가 공개한 데이터가 아닙니다.",
  Pending: "대기 청산",
  "Pending on": "대기 청산 표시",
  "Pending off": "대기 청산 숨김",
  "hover or tap a bar to read it": "막대에 마우스를 올리거나 탭하여 값 확인",
  "{asset} bars; arrow keys read one at a time": "{asset} 막대, 방향키로 하나씩 확인",
  "{asset} longs closed above zero and shorts closed below, over the last {window}":
    "최근 {window} {asset} 청산: 0 위는 롱 청산, 아래는 숏 청산",
  "Longs closed above the line, shorts closed below, on the same linear scale. Hover a bar to read it beside the cursor; on a phone, tap and it reads in the line above the chart. The last bar is still filling.":
    "선 위는 롱 청산, 아래는 숏 청산이며 같은 선형 눈금을 씁니다. 막대에 마우스를 올리면 커서 옆에 값이 나오고, 휴대폰에서는 탭하면 차트 위 줄에 나옵니다. 마지막 막대는 아직 집계 중입니다.",
  "{usd} of longs closed between {band}": "{band} 구간 롱 청산 {usd}",
  "{usd} of shorts closed between {band}": "{band} 구간 숏 청산 {usd}",
  "Longs closed <b>{usd}</b> · {share}%": "롱 청산 <b>{usd}</b> · {share}%",
  "Shorts closed <b>{usd}</b> · {share}%": "숏 청산 <b>{usd}</b> · {share}%",
  All: "전체",
  "Nothing was force-closed in {asset} in the last {window}, on either side.":
    "최근 {window} 동안 {asset}에서 롱과 숏 모두 강제 청산이 없었습니다.",
  "Showing <b>{asset}</b>, every exchange added together — the split by exchange is one tab along. Rows are the same {pct}% price bands, banded from <b>{mark}</b>. A long close is a forced SELL and a short close a forced BUY, so the heavier side is the one the move ran against. Any asset outside this list opens from a row on the map tab.":
    "<b>{asset}</b>을(를) 모든 거래소를 합산해 표시합니다 — 거래소별로 나눈 화면은 옆 탭에 있습니다. 행은 <b>{mark}</b> 기준의 같은 {pct}% 가격 구간입니다. 롱 청산은 강제 매도, 숏 청산은 강제 매수이므로, 더 큰 쪽이 가격 움직임에 당한 쪽입니다. 이 목록에 없는 자산은 자산 탭의 행에서 열 수 있습니다.",

  // The page.
  "Nothing has been force-closed in this window, so there is no asset to price.":
    "이 기간에 강제 청산이 없어 가격별로 볼 자산이 없습니다.",
  "Nothing has been force-closed in this window, so there is no asset to split.":
    "이 기간에 강제 청산이 없어 롱과 숏으로 나눌 자산이 없습니다.",
  "{first} and {last}": "{first} 및 {last}",
  ", ": ", ",
  Liquidations: "청산",
  "Where positions were force-closed: by venue, asset and hour, and by the price level they died at.":
    "포지션이 강제 청산된 곳: 거래소·자산·시간별, 그리고 청산된 가격 수준별.",
  "Where positions were force-closed, by exchange. Colour is the side that was closed — {longs}, {shorts} — and intensity is the money, on a log scale.":
    "거래소별 강제 청산 위치입니다. 색은 청산된 쪽({longs}, {shorts})을, 진하기는 금액(로그 눈금)을 나타냅니다.",
  "blue for longs": "파란색은 롱",
  "red for shorts": "빨간색은 숏",
  "No venue has reported a liquidation in this window.":
    "이 기간에 청산을 보고한 거래소가 없습니다.",
  "This is {venues}, the one venue whose liquidation feed the collector reads — not the whole market.":
    "이 데이터는 수집기가 청산 피드를 읽는 유일한 거래소인 {venues}의 것으로, 시장 전체가 아닙니다.",
  "This is {venues}, the {count} venues whose liquidation feed the collector reads — not the whole market.":
    "이 데이터는 수집기가 청산 피드를 읽는 거래소 {count}곳({venues})의 것으로, 시장 전체가 아닙니다.",
  "Asset Timeline": "자산 타임라인",
  Timeline: "타임라인",
  Assets: "자산",
  "Longs vs shorts": "롱 대 숏",
  "{asset} longs vs shorts": "{asset} 롱 대 숏",
  Sides: "롱/숏",
  "By price level": "가격 수준별",
  "{asset} price levels": "{asset} 가격 수준",
  Prices: "가격",
  "Updated {ago}.": "{ago} 업데이트.",

  // The odds tab.
  Odds: "확률",
  "{asset} odds": "{asset} 확률",
  "Nothing has been force-closed in this window, so there is no asset to size.":
    "이 기간에 강제 청산이 없어 변동 폭을 추정할 자산이 없습니다.",
  "4 hours": "4시간",
  "6 hours": "6시간",
  "1 day": "1일",
  "1 week": "1주",
  Within: "기간",
  "Typical move (1 sigma)": "일반적 변동(1시그마)",
  "Closes higher than now": "지금보다 높게 마감",
  "Reaches the heaviest forced-close level": "강제 청산이 가장 컸던 가격 도달",
  "Whichever of those two it reaches first": "둘 중 먼저 도달하는 쪽",
  "The upper one first": "위쪽 먼저",
  "The lower one first": "아래쪽 먼저",
  Neither: "둘 다 아님",
  "Reaches a move of": "다음 변동 폭 도달",
  "{price} ({where}) · {usd} closed, {share} of the window":
    "{price}({where}) · {usd} 청산, 기간 전체의 {share}",
  Theory: "가설",
  "Reading now": "현재 값",
  Leans: "방향",
  "Moves the odds?": "확률에 반영?",
  up: "상승",
  down: "하락",
  "Forced-close burst fades": "청산 급증 후 되돌림",
  "Funding crowding fades": "펀딩비 쏠림 후 되돌림",
  "Stretch from the 50-hour average fades": "50시간 평균 이탈 후 되돌림",
  "Initiative vs absorption": "주도 매매 대 흡수",
  "Fear and greed": "공포와 탐욕",
  "Liquidation magnet": "청산 자석",
  "Needs open positions by price level. The collector keeps closed ones only, so this cannot be read yet.":
    "가격 수준별 미결제 포지션이 필요합니다. 수집기는 청산된 포지션만 보관하므로 아직 읽을 수 없습니다.",
  "Fewer than 5 forced closes in the last 4 hours: too thin to call a burst.":
    "최근 4시간 강제 청산이 5건 미만: 급증이라 하기엔 너무 적습니다.",
  "Not enough data.": "데이터가 부족합니다.",
  "{longs} of the last 4 hours' forced closes were longs ({usd} in all)":
    "최근 4시간 강제 청산 중 롱 비중 {longs}(총 {usd})",
  "{apr} a year funding, weighted by open interest": "미결제약정 가중 펀딩비 연 {apr}",
  "{sigma} bar-sigmas above its 50-hour average": "50시간 평균보다 {sigma} 봉-시그마 위",
  "{sigma} bar-sigmas below its 50-hour average": "50시간 평균보다 {sigma} 봉-시그마 아래",
  "takers net buying {pct} of volume": "테이커 순매수, 거래량의 {pct}",
  "takers net selling {pct} of volume": "테이커 순매도, 거래량의 {pct}",
  "{flow}, price {change} over 4 hours": "{flow}, 4시간 가격 {change}",
  "{score} out of 100": "{score} / 100",
  "No. Not yet tested, so it carries no weight.": "아니요. 아직 검증되지 않아 가중치가 없습니다.",
  "No. Context only: its claim never leans.": "아니요. 참고용일 뿐, 방향을 가리키지 않습니다.",
  "No. Cannot be computed.": "아니요. 계산할 수 없습니다.",
  "There is not yet enough price history for {asset} to size its moves, or no live market is publishing a mark. The odds need at least 12 hours of closes.":
    "{asset}의 변동 폭을 추정할 가격 기록이 아직 부족하거나, 마크 가격을 공개하는 거래 중인 종목이 없습니다. 확률을 계산하려면 최소 12시간의 종가가 필요합니다.",
  "These are the odds that <b>{asset}</b> reaches a price within each horizon, worked out from how far it has actually been moving: about {hourly} an hour over the last {hours} hours. They are not a forecast of direction.":
    "<b>{asset}</b>이(가) 각 기간 안에 특정 가격에 도달할 확률이며, 실제로 움직여 온 폭(최근 {hours}시간 동안 시간당 약 {hourly})으로 계산했습니다. 방향 예측이 아닙니다.",
  "The levels are where the most dollars were force-closed in the last {window}. Those positions are gone, so a heavy level is somewhere price has been, not fuel waiting for it. The collector does not keep open positions by price, so the resting map a liquidation magnet needs cannot be built yet.":
    "이 가격 수준은 최근 {window} 동안 강제 청산 금액이 가장 컸던 곳입니다. 그 포지션은 이미 사라졌으므로, 금액이 큰 수준은 가격이 지나간 자리일 뿐 가격을 기다리는 연료가 아닙니다. 수집기는 가격별 미결제 포지션을 보관하지 않으므로, 청산 자석에 필요한 대기 포지션 지도는 아직 만들 수 없습니다.",
  "Real prices have fatter tails than this model assumes, so the far levels are reached more often than shown. Volatility is measured over the recent past and held constant.":
    "실제 가격은 이 모델의 가정보다 꼬리가 두꺼워, 먼 가격 수준에 도달하는 빈도가 표시보다 높습니다. 변동성은 최근 기간으로 측정하며 일정하다고 가정합니다.",
  "Odds of reaching a level, from {asset}'s own volatility. They say how far it can go, not which way. The chance of closing higher stays at 50% until a theory below passes a test set in advance, after costs.":
    "{asset} 자체의 변동성으로 계산한 가격 도달 확률입니다. 얼마나 멀리 갈 수 있는지를 말할 뿐, 어느 방향인지는 말하지 않습니다. 아래 가설 중 하나가 비용 차감 후 미리 정한 검증을 통과하기 전까지, 더 높게 마감할 확률은 50%로 둡니다.",
  "Levels closer than the 4-hour typical move ({pct}) are left out, because price is already standing in them.":
    "4시간 일반적 변동({pct})보다 가까운 가격 수준은 제외했습니다. 가격이 이미 그 안에 있기 때문입니다.",
  "No forced-close level lies beyond the 4-hour typical move":
    "4시간 일반적 변동 밖에는 강제 청산 가격 수준이 없음",
  "What the liquidation theories read now": "청산 가설의 현재 값",
  "A reading that leans one way is a hypothesis, not a signal: none of these has been shown to beat the base rate. The first three are measured against a fade, the way their test was written down in advance, and a flat reading leans nowhere.":
    "한쪽으로 기운 값은 가설일 뿐 신호가 아닙니다. 이 중 어느 것도 기본 확률보다 낫다고 입증되지 않았습니다. 처음 세 가지는 미리 적어 둔 검증 방식대로 되돌림을 기준으로 측정하며, 보합인 값은 어느 쪽으로도 기울지 않습니다.",
  // web/liquidations.ts: the whale map tab.
  "Nothing has been force-closed in this window, so there is no asset to map.":
    "이 기간에 강제 청산이 없어 지도로 그릴 자산이 없습니다.",
  "Position size": "포지션 규모",
  "Price range": "가격 범위",
  "Whale map": "고래 지도",
  "{asset} whale map": "{asset} 고래 지도",
  Whales: "고래",

  // web/whale-map.ts
  "mark {price}": "마크 가격 {price}",
  "{n} positions of {floor} or more · {longs} of longs, {shorts} of shorts · hover or tap a bar to read it":
    "{floor} 이상 포지션 {n}개 · 롱 {longs}, 숏 {shorts} · 막대에 마우스를 올리거나 탭하여 값 확인",
  "Beyond ±{pct} of the mark, off the chart: {longs} of longs and {shorts} of shorts.":
    "마크 가격 ±{pct} 밖이라 차트에 없는 포지션: 롱 {longs}, 숏 {shorts}.",
  "{asset} · whale positions by liquidation price · {venues}":
    "{asset} · 청산 가격별 고래 포지션 · {venues}",
  "Longs liquidate": "롱 청산 가격",
  "Shorts liquidate": "숏 청산 가격",
  "Total to the mark": "마크 가격까지 누적",
  "{asset} price bands; arrow keys read one at a time": "{asset} 가격 구간, 방향키로 하나씩 확인",
  "{asset} whale positions by the price they liquidate at": "청산 가격별 {asset} 고래 포지션",
  "Every position here is one an exchange publishes for a named account: reported, not modeled. Only Hyperliquid, Lighter and dYdX publish every account's positions, and together they hold about a tenth of the open interest; Binance, OKX and the other centralized exchanges publish none, so they are not in this map.":
    "여기 나오는 포지션은 모두 거래소가 특정 계정에 대해 공개한 것으로, 모델 추정이 아니라 실제 보고된 값입니다. 모든 계정의 포지션을 공개하는 곳은 Hyperliquid, Lighter, dYdX뿐이며, 셋을 합쳐 전체 미결제약정의 약 10분의 1을 차지합니다. Binance, OKX 등 중앙화 거래소는 전혀 공개하지 않으므로 이 지도에 없습니다.",
  "Hyperliquid and Lighter report each position's liquidation price. dYdX does not, so its are computed from the account's own balance and positions with dYdX's maintenance margins, holding its other prices where they are; they are marked * in the table.":
    "Hyperliquid와 Lighter는 포지션마다 청산 가격을 공개합니다. dYdX는 공개하지 않으므로, 계정의 잔고와 포지션에 dYdX의 유지 증거금률을 적용하고 다른 종목의 가격은 그대로라고 가정해 계산합니다. 표에서는 *로 표시합니다.",
  "On Hyperliquid the collector watches the leaderboard's accounts worth $100k or more and any account it sees in a large trade, re-reading each every few minutes while it holds $1M or more and hourly while it holds $100k. On Lighter it follows the leaderboard's owners with $100k in the account or a $100k position, whose changes arrive as they happen. On dYdX it reads every account on the chain every five minutes. So the map covers the largest traders, not every account.":
    "Hyperliquid에서 수집기는 리더보드에서 자산이 $100k 이상인 계정과 대량 거래에서 포착된 모든 계정을 추적하며, $1M 이상을 보유한 계정은 몇 분마다, $100k를 보유한 계정은 매시간 다시 읽습니다. Lighter에서는 리더보드에서 계정 자산 $100k 이상 또는 포지션 $100k 이상인 소유자를 추적하며, 변경 사항은 발생 즉시 들어옵니다. dYdX에서는 체인의 모든 계정을 5분마다 읽습니다. 따라서 이 지도는 모든 계정이 아니라 가장 큰 트레이더들을 다룹니다.",
  "A cross-margin position's liquidation price moves with the rest of its account: its other positions' profit and loss, deposits and withdrawals. Each one is as of its account's last read, shown in the table. Bars are the money that liquidates in each price band, longs below the mark and shorts above; the lines add up everything between the mark and that price.":
    "교차 마진 포지션의 청산 가격은 계정의 나머지 부분, 즉 다른 포지션의 손익과 입출금에 따라 움직입니다. 각 포지션은 표에 나온 그 계정의 마지막 읽기 시점 기준입니다. 막대는 각 가격 구간에서 청산되는 금액으로, 롱은 마크 가격 아래, 숏은 위에 있습니다. 선은 마크 가격부터 그 가격까지를 모두 더한 값입니다.",
  "The whale positions could not be read right now.": "지금은 고래 포지션을 읽을 수 없습니다.",
  "No position of {floor} or more in {asset} among the accounts watched.":
    "추적 중인 계정 중 {asset}에서 {floor} 이상인 포지션이 없습니다.",
  "There are {n} of $100k or more: switch to $100k+.":
    "$100k 이상 포지션은 {n}개 있습니다. $100k+로 바꿔 보세요.",
  "nearest at {price} ({pct})": "가장 가까운 곳 {price}({pct})",
  "none with a liquidation price": "청산 가격이 있는 포지션 없음",
  "Whale longs": "고래 롱",
  "{n} positions": "포지션 {n}개",
  "Whale shorts": "고래 숏",
  "Within 5% of the mark": "마크 가격 5% 이내",
  "longs below / shorts above": "아래 롱 / 위 숏",
  Accounts: "계정",
  "read a median {age}": "읽기 시점 중앙값 {age}",
  "No live mark for {asset}, so the positions cannot be placed on a price axis.":
    "{asset}의 실시간 마크 가격이 없어 포지션을 가격 축에 놓을 수 없습니다.",
  long: "롱",
  short: "숏",
  "No liquidation price: the account's margin covers any move":
    "청산 가격 없음: 계정 증거금이 어떤 가격 변동도 감당합니다",
  "dYdX publishes no liquidation price: computed from the account's balance and positions with dYdX's maintenance margins":
    "dYdX는 청산 가격을 공개하지 않음: 계정 잔고와 포지션에 dYdX 유지 증거금률을 적용해 계산",
  "By venue:": "거래소별:",
  none: "없음",
  "{leverage}× isolated": "{leverage}× 격리",
  // Cross margin, not the chart cursor's crosshair (charts.ts's "cross").
  "{leverage}× cross": "{leverage}× 교차",
  "The {n} nearest to liquidation of {total}.": "전체 {total}개 중 청산에 가장 가까운 {n}개.",
  Trader: "트레이더",
  Value: "가치",
  Entry: "진입가",
  "Liquidates at": "청산 가격",
  "From the market's mark to the liquidation price": "종목의 마크 가격에서 청산 가격까지",
  Leverage: "레버리지",
  Unrealized: "미실현 손익",
  "The whole account's value on its venue": "해당 거래소에서 계정 전체의 가치",
  Account: "계정 가치",
  Read: "읽은 시각",
  // Before a link to the member login, inside the sentence below.
  "Log in": "로그인",
  "Refreshes every 30 s. {login} to refresh every 10 s, with the nearest accounts re-read about every minute.":
    "30초마다 새로 고칩니다. {login}하면 10초마다 새로 고치고, 청산에 가장 가까운 계정은 약 1분마다 다시 읽습니다.",
  "Live for members: refreshes every 10 s, and the nearest accounts are re-read about every minute.":
    "회원 실시간: 10초마다 새로 고치고, 청산에 가장 가까운 계정은 약 1분마다 다시 읽습니다.",
  Indexes: "지수",
  "Other stocks": "기타 주식",
  "Energy and other commodities": "에너지·기타 원자재",
  FX: "외환",
  "{long} long · {short} short": "롱 {long} · 숏 {short}",
  "Pick an asset": "자산 선택",
  "Filter assets": "자산 필터",
  Liquidated: "청산 금액",
  "Longs / shorts": "롱 / 숏",
  Events: "건수",
  "{asset} liquidations": "{asset} 청산",
  "{asset} liquidations across exchanges: longs against shorts by the hour, the price levels positions were closed at, and where large open positions would be liquidated.":
    "거래소 전체의 {asset} 청산: 시간별 롱 대 숏, 포지션이 강제 청산된 가격대, 대형 미결제 포지션의 청산 가격.",
  "All assets": "전체 자산",
  "{n} exchange": "거래소 {n}곳",
  "{n} asset": "자산 {n}개",
  "In the last 7 days": "지난 7일 동안",
  "In the last 48 hours": "지난 48시간 동안",
  "In the last 24 hours": "지난 24시간 동안",
  "{share} of it longs": "그중 {share}가 롱",
  "{share} of it shorts": "그중 {share}가 숏",
  "{window}, no {asset} position was force-closed on the exchanges whose liquidation feeds the collector reads.":
    "{window} 수집기가 청산 피드를 읽는 거래소에서는 {asset} 포지션이 강제 청산되지 않았습니다.",
  "{window}, {total} of {asset} positions were force-closed in {events} on {venues}, {sides}.":
    "{window} {venues}에서 {asset} 포지션 {total}이 강제 청산되었습니다({events}). {sides}.",
  "The largest single one was a {usd} long on {venue} at {price}, {ago}.":
    "단일 최대는 {venue}의 {usd} 롱으로, {price}에 체결, {ago}.",
  "The largest single one was a {usd} short on {venue} at {price}, {ago}.":
    "단일 최대는 {venue}의 {usd} 숏으로, {price}에 체결, {ago}.",
  "Of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX, {longs} of longs would be liquidated within 5% below the price and {shorts} of shorts within 5% above.":
    "Hyperliquid, Lighter, dYdX에서 지켜보는 $1M 이상 고래 포지션 중 가격 아래 5% 이내에서 롱 {longs}, 위 5% 이내에서 숏 {shorts}이 청산됩니다.",
  "{window}, {total} of positions were force-closed across {assets} on {venues}, {sides}.":
    "{window} {venues}에서 {assets}의 포지션 {total}이 강제 청산되었습니다. {sides}.",
  "The most liquidated: {list}.": "청산이 가장 많은 자산: {list}.",
  "The largest single liquidation was a {usd} {asset} long on {venue} at {price} ({when} UTC).":
    "단일 최대 청산은 {venue}의 {usd} {asset} 롱으로, {price}에 체결 (UTC {when}).",
  "The largest single liquidation was a {usd} {asset} short on {venue} at {price} ({when} UTC).":
    "단일 최대 청산은 {venue}의 {usd} {asset} 숏으로, {price}에 체결 (UTC {when}).",
  Order: "정렬",
  "Largest first": "큰 순",
  "Newest first": "최신 순",
  "Smallest close": "최소 금액",
  "The largest liquidations could not be read right now.": "지금은 최대 청산을 읽을 수 없습니다.",
  "No single liquidation of {floor} or more in this window.":
    "이 기간에 {floor} 이상의 단일 청산이 없습니다.",
  "Nothing has been force-closed in this window.": "이 기간에 강제 청산된 포지션이 없습니다.",
  "The {n} newest liquidations of {floor} or more in this window.":
    "이 기간 {floor} 이상 청산 중 최신 {n}건.",
  "Every liquidation of {floor} or more in this window.": "이 기간 {floor} 이상 청산 전체.",
  "The {n} largest single liquidations in this window.": "이 기간 최대 단일 청산 {n}건.",
  "Every liquidation in this window, largest first.": "이 기간 청산 전체, 큰 순.",
  "The position's value at the fill price": "체결 가격 기준 포지션 가치",
  "Each row is one forced close as its exchange reported it: the side is the position that was closed, the size its value at the fill price. Times are in {zone}.":
    "각 행은 거래소가 보고한 강제 청산 1건입니다. 방향은 청산된 포지션, 규모는 체결 가격 기준 가치입니다. 시간대는 {zone}.",
  "{asset} largest liquidations": "{asset} 최대 청산",
  "Largest liquidations": "최대 청산",
  Largest: "최대",
  "None of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX would be liquidated within 5% of the price.":
    "Hyperliquid, Lighter, dYdX에서 지켜보는 $1M 이상 고래 포지션 중 가격 5% 이내에서 청산될 포지션은 없습니다.",
  later: "나중에",
  "A cascade is a burst in which one asset's liquidations piled up within minutes: consecutive minutes each running at {pace} times its 7-day average pace or more, with no more than {gap} quiet minutes between them, and at least an hour's worth of that average pace, and {floor}, in all. Every exchange whose liquidation feed the collector reads is counted; the venue choices on the other tabs do not narrow it.":
    "캐스케이드는 한 자산의 청산이 몇 분 안에 몰린 폭발입니다. 분당 청산 속도가 7일 평균의 {pace}배 이상인 분이 이어지고, 그 사이 조용한 시간은 {gap}분 이하이며, 합계가 평균 속도의 1시간 분량 이상이고 {floor} 이상인 경우를 셉니다. 수집기가 청산 피드를 읽는 모든 거래소를 합산하며, 다른 탭의 거래소 선택으로 좁혀지지 않습니다.",
  "Prices are the asset's busiest market in 5-minute candles. Into it is the move from the last close before the cascade to the furthest the price went inside it: the low when mostly longs were closed, the high when mostly shorts were. 1h and 4h after run from the close at its end to the close an hour and four hours later, and say later until that candle has closed.":
    "가격은 해당 자산에서 거래가 가장 많은 시장의 5분봉입니다. '진행 중'은 캐스케이드 시작 전 마지막 종가에서 진행 중 가격이 가장 멀리 간 지점까지의 변동입니다. 주로 롱이 청산되면 저가, 숏이면 고가입니다. '1시간 후'와 '4시간 후'는 종료 시 종가에서 1시간, 4시간 뒤 종가까지이며, 그 봉이 마감되기 전에는 '나중에'로 표시됩니다.",
  "The cascades could not be read right now.": "지금은 캐스케이드를 읽을 수 없습니다.",
  "No cascade in {asset} in this window: no burst reached {pace} times its usual pace with an hour's worth of it. Its usual pace is {usd} a minute, the 7-day average.":
    "이 기간에 {asset} 캐스케이드가 없습니다: 평소 속도의 {pace}배에 이르러 1시간 분량에 도달한 폭발이 없었습니다. 평소 속도는 분당 {usd}(7일 평균)입니다.",
  "none in this window": "이 기간에 없음",
  "none an hour old yet": "아직 1시간 지난 것 없음",
  "higher in {up} of {n}": "{n}회 중 {up}회 상승",
  Cascades: "캐스케이드",
  "{usd} longs": "롱 {usd}",
  "{usd} shorts": "숏 {usd}",
  "An hour after long cascades": "롱 캐스케이드 1시간 후",
  "An hour after short cascades": "숏 캐스케이드 1시간 후",
  "Usual pace": "평소 속도",
  "a minute, the 7-day average": "분당, 7일 평균",
  "{n} min": "{n}분",
  "longs {share}": "롱 {share}",
  "shorts {share}": "숏 {share}",
  "Prices: {market} on {venue}, in 5-minute candles.": "가격: {venue}의 {market}, 5분봉.",
  "No price history for {asset}, so the moves are blank.":
    "{asset}의 가격 기록이 없어 변동은 비어 있습니다.",
  Start: "시작",
  Length: "길이",
  "Exchanges with a liquidation in it": "진행 중 청산이 있었던 거래소",
  "The last close before the cascade began": "캐스케이드 시작 전 마지막 종가",
  "Price before": "시작 전 가격",
  "From the price before to the furthest it went inside the cascade":
    "시작 전 가격에서 진행 중 가장 멀리 간 지점까지",
  "Into it": "진행 중",
  "From the close at its end to the close an hour later": "종료 시 종가에서 1시간 뒤 종가까지",
  "1h after": "1시간 후",
  "From the close at its end to the close four hours later": "종료 시 종가에서 4시간 뒤 종가까지",
  "4h after": "4시간 후",
  "Newest first.": "최신 순.",
  "Times are in {zone}.": "시간대는 {zone}.",
  "Nothing has been force-closed in this window, so there is no asset to read.":
    "이 기간에 강제 청산이 없어 읽을 자산이 없습니다.",
  "{asset} cascades": "{asset} 캐스케이드",
  "{asset} longs vs shorts by day · UTC days": "{asset} 일별 롱 대 숏 · UTC 기준 일",
  "30- and 90-day history": "30일 및 90일 기록",
  "{asset} over 30 and 90 days": "{asset}의 30일 및 90일",
  "Every day's longs and shorts liquidated over the last 30 or 90 days, each day as a share of the open interest on the same exchanges, and the heaviest days ranked.":
    "지난 30일 또는 90일 동안 매일 청산된 롱과 숏, 각 날이 같은 거래소 미결제약정에서 차지한 비율, 그리고 가장 무거웠던 날의 순위.",
  "Liquidations against open interest": "청산 대 미결제약정",
  "Which markets were really flushed rather than just big: every asset's liquidations in the window as a share of its open interest, and the same for crypto, stocks, commodities and indices.":
    "규모가 클 뿐 아니라 실제로 정리된 시장은 어디인가: 기간 중 각 자산의 청산이 미결제약정에서 차지한 비율과 암호화폐, 주식, 원자재, 지수별 비율.",
  "For members": "회원 전용",
  "Create a free account": "무료 계정 만들기",
  "Loading the member view…": "회원 화면을 불러오는 중…",
  "The history could not be read right now.": "지금은 기록을 읽을 수 없습니다.",
  "Nothing was force-closed in {asset} over this span.": "이 기간에 {asset} 강제 청산이 없습니다.",
  "Liquidated over {span} days": "{span}일간 청산",
  "A typical day": "보통의 하루",
  "of open interest, on average": "미결제약정 대비 평균 비율",
  "The heaviest day": "가장 무거웠던 날",
  "Days with data": "데이터가 있는 날",
  "from {date}": "{date}부터",
  "The heaviest days, as a share of open interest": "가장 무거웠던 날 (미결제약정 대비)",
  "Day (UTC)": "날짜 (UTC)",
  "Exchanges that reported a liquidation that day": "그날 청산을 보고한 거래소",
  "Open interest is the day's average on the exchanges whose liquidation feeds reported {asset}, so the share compares like with like.":
    "미결제약정은 {asset} 청산을 보고한 거래소의 그날 평균이므로, 비율은 같은 범위끼리 비교한 것입니다.",
  "Liquidation feeds were added over time: from {least} to {most} exchanges a day here, so early days undercount.":
    "청산 피드는 차례로 추가되었습니다: 여기서는 하루 {least}~{most}곳이므로 초기 날짜는 적게 잡힙니다.",
  Commodities: "원자재",
  Indices: "지수",
  "The open interest could not be read right now.": "지금은 미결제약정을 읽을 수 없습니다.",
  "{liq} of {oi} open": "미결제약정 {oi} 중 {liq}",
  "The markets most flushed for their size": "규모 대비 가장 많이 정리된 시장",
  "No market with $1M of open interest had a liquidation in this window.":
    "이 기간에 미결제약정 $1M 이상인 시장에서 청산이 없었습니다.",
  Class: "분류",
  "Liquidations over the last {window} against the open interest now, both on the {feeds} exchanges whose liquidation feeds reported closes in that window. Markets under $1M of open interest are left out of the ranking.":
    "지난 {window}의 청산과 현재 미결제약정을 비교하며, 둘 다 이 기간에 청산을 보고한 거래소 {feeds}곳 기준입니다. 미결제약정 $1M 미만 시장은 순위에서 제외합니다.",
  Span: "기간",
  History: "기록",
  "{asset} history": "{asset} 기록",
  "Liquidations vs open interest": "청산 대 미결제약정",
  "vs OI": "OI 대비",
  "Every cascade, in every asset": "모든 자산의 모든 캐스케이드",
  "Every liquidation cascade in every asset, found each minute as it happens, with the price an hour and four hours after. Members can also have them sent to Telegram the moment they start.":
    "모든 자산의 청산 캐스케이드를 매분 실시간으로 찾아 1시간 후와 4시간 후 가격과 함께 보여 줍니다. 회원은 시작되는 순간 Telegram으로 받을 수도 있습니다.",
  "No cascade in any asset in the last {window}.":
    "지난 {window} 동안 캐스케이드가 있었던 자산이 없습니다.",
  "in {n} assets": "자산 {n}개",
  "Longs and shorts": "롱과 숏",
  "{longs} long cascades, {shorts} short": "롱 캐스케이드 {longs}회, 숏 {shorts}회",
  "The deepest market's mark when the watch first saw it, a minute or two in":
    "감시가 처음 발견했을 때 가장 깊은 시장의 마크 가격 (시작 후 1~2분)",
  "Price when seen": "발견 시 가격",
  "From the price when seen to the mark an hour after the cascade ended":
    "발견 시 가격에서 캐스케이드 종료 1시간 뒤 마크 가격까지",
  "From the price when seen to the mark four hours after the cascade ended":
    "발견 시 가격에서 캐스케이드 종료 4시간 뒤 마크 가격까지",
  "Every asset, found each minute as it happens, by the rule of each asset's Cascades tab. Prices are the asset's deepest market's mark when the watch saw it and an hour and four hours after it ended. Members can have them sent to Telegram from {alerts}.":
    "모든 자산을 매분 실시간으로, 각 자산의 캐스케이드 탭과 같은 기준으로 찾습니다. 가격은 발견 시와 종료 1시간·4시간 뒤 해당 자산의 가장 깊은 시장 마크 가격입니다. 회원은 {alerts}에서 Telegram 알림을 설정할 수 있습니다.",
  "the alerts page": "알림 페이지",
  "All cascades": "전체 캐스케이드",
  // The member Top traders tab (web/trader.ts), 2026-11-15.
  "24h": "24시간",
  "30d": "30일",
  "All time": "전체 기간",
  "over the last day": "지난 하루",
  "over the last week": "지난 한 주",
  "over the last month": "지난 한 달",
  "over all time": "전체 기간",
  "Long {coin}": "{coin} 롱",
  "Short {coin}": "{coin} 숏",
  "Rank by profit over": "수익 집계 기간",
  "Hyperliquid's leaderboard could not be read right now. Try again in a minute.":
    "지금은 Hyperliquid 리더보드를 읽을 수 없습니다. 1분 후 다시 시도하세요.",
  "+{n} more": "외 {n}개",
  "nothing over $100k": "$100k 넘는 포지션 없음",
  Profit: "수익",
  "Profit over the account's value, as Hyperliquid's leaderboard computes it":
    "수익을 계정 가치로 나눈 값(Hyperliquid 리더보드 계산 방식)",
  Return: "수익률",
  "Account value": "계정 가치",
  "Holding now": "현재 보유",
  "Hyperliquid's own leaderboard, every one of its {ranked} accounts ranked by profit {window}, read {ago}. Hyperliquid is the large perp exchange where every account is public, so any of them opens on its positions, fills and orders. Holdings are the whale tracker's: positions of $100k and up, read within three hours.":
    "Hyperliquid 공식 리더보드로, {ranked}개 계정 전체를 {window} 수익으로 순위를 매겼으며 {ago} 읽었습니다. Hyperliquid는 모든 계정이 공개된 대형 무기한 선물 거래소라서 어느 계정이든 열어 포지션, 체결, 주문을 볼 수 있습니다. 보유 내역은 고래 추적기의 것으로, 3시간 이내에 읽은 $100k 이상 포지션입니다.",
  "Too little history in this window to draw.": "이 기간에는 그릴 만한 기록이 너무 적습니다.",
  "Open long": "롱 오픈",
  "Close long": "롱 종료",
  "Open short": "숏 오픈",
  "Close short": "숏 종료",
  "Long to short": "롱에서 숏으로",
  "Short to long": "숏에서 롱으로",
  Buy: "매수",
  Sell: "매도",
  Limit: "지정가",
  "Stop market": "스탑 시장가",
  "Stop limit": "스탑 지정가",
  "Take profit market": "익절 시장가",
  "Take profit limit": "익절 지정가",
  "reduce only": "포지션 축소 전용",
  "position TP/SL": "포지션 TP/SL",
  Filled: "체결",
  Canceled: "취소",
  Triggered: "발동",
  Rejected: "거부",
  "Canceled: margin": "취소: 증거금 부족",
  "All top traders": "전체 톱 트레이더",
  "#{place} on Hyperliquid's leaderboard by profit {window}.":
    "{window} 수익 기준 Hyperliquid 리더보드 {place}위.",
  "Hyperliquid is answering too many requests right now. Try again in a minute.":
    "지금 Hyperliquid에 요청이 너무 많습니다. 1분 후 다시 시도하세요.",
  "Hyperliquid did not answer for this account right now. Try again in a minute.":
    "지금 Hyperliquid가 이 계정에 응답하지 않았습니다. 1분 후 다시 시도하세요.",
  "{usd} free to withdraw": "출금 가능 {usd}",
  "Profit {window}": "{window} 수익",
  "{usd} traded": "거래액 {usd}",
  "Open positions": "보유 포지션",
  "{lev}x the account's value": "계정 가치의 {lev}배",
  "on the open positions": "보유 포지션 기준",
  "Profit chart window": "손익 차트 기간",
  "Profit and loss {window}": "{window} 손익",
  "The profit history could not be read right now.": "지금은 손익 기록을 읽을 수 없습니다.",
  "No open positions.": "보유 포지션이 없습니다.",
  Coin: "코인",
  "Unrealized profit over the margin the position holds": "미실현 손익을 포지션 증거금으로 나눈 값",
  ROE: "ROE",
  "Liq. price": "청산 가격",
  "Funding the position has paid since it opened; a minus is funding received":
    "포지션을 연 뒤 지불한 펀딩비. 마이너스는 받은 펀딩비",
  isolated: "격리",
  "The positions could not be read right now.": "지금은 포지션을 읽을 수 없습니다.",
  "Resting orders": "대기 주문",
  Placed: "주문 시각",
  Trigger: "트리거",
  "The fills could not be read right now.": "지금은 체결 내역을 읽을 수 없습니다.",
  "No fills on record.": "체결 기록이 없습니다.",
  "This account was liquidated in this fill": "이 체결에서 이 계정이 청산됨",
  liquidated: "청산됨",
  "Results by coin": "코인별 결과",
  "Orders that filled": "체결된 주문",
  Trades: "거래",
  "Profit realized by closing, before fees": "포지션 종료로 실현한 손익(수수료 차감 전)",
  "Closed P&amp;L": "실현 손익",
  Fees: "수수료",
  Direction: "방향",
  "Size-weighted over the order's fills": "주문 체결 수량 가중",
  Fee: "수수료",
  "Fills the order took": "주문의 체결 건수",
  "No trades in {coin} among these fills.": "이 체결 중 {coin} 거래는 없습니다.",
  "Hyperliquid answers an account's last {n} fills, here from {date}; results by coin are over those fills only. Each trade is one order's fills taken together.":
    "Hyperliquid는 계정의 최근 체결 {n}건만 제공하며, 여기서는 {date}부터입니다. 코인별 결과는 이 체결만 대상으로 합니다. 거래 하나는 한 주문의 체결을 합친 것입니다.",
  "The order history could not be read right now.": "지금은 주문 내역을 읽을 수 없습니다.",
  market: "시장가",
  "No orders on record.": "주문 기록이 없습니다.",
  "Hyperliquid answers an account's last {n} orders, each shown once at its latest status.":
    "Hyperliquid는 계정의 최근 주문 {n}건만 제공하며, 각 주문은 최신 상태로 한 번만 표시합니다.",
  "Hyperliquid throttled part of this read; what is missing says so. Try again in a minute.":
    "Hyperliquid가 이번 조회의 일부를 제한했습니다. 빠진 부분은 그렇게 표시됩니다. 1분 후 다시 시도하세요.",
  Positions: "포지션",
  "Order history": "주문 내역",
  "Read from Hyperliquid {ago}.": "{ago} Hyperliquid에서 읽음.",
  "Top traders, and every order they place": "톱 트레이더와 그들의 모든 주문",
  "Hyperliquid's biggest winners over a day, a week, a month or all time, with what they hold now. Open any of them for their positions and liquidation prices, profit over time, and their recent trades and orders, coin by coin.":
    "하루, 한 주, 한 달, 전체 기간 동안 Hyperliquid에서 가장 많이 번 트레이더와 현재 보유 포지션. 누구든 열면 포지션과 청산 가격, 손익 추이, 코인별 최근 거래와 주문을 볼 수 있습니다.",
  "Top traders": "톱 트레이더",
  Winners: "승자",
  "Longs near liquidation": "청산 임박 롱",
  "Longs closest to their liquidation price": "청산 가격에 가장 가까운 롱",
  "Closest first: how far the price has to fall to liquidate each one.":
    "가까운 순: 각 포지션이 청산되려면 가격이 얼마나 내려야 하는지.",
  "Shorts near liquidation": "청산 임박 숏",
  "Shorts closest to their liquidation price": "청산 가격에 가장 가까운 숏",
  "Closest first: how far the price has to rise to liquidate each one.":
    "가까운 순: 각 포지션이 청산되려면 가격이 얼마나 올라야 하는지.",
  "Largest longs": "최대 롱",
  "Largest longs that can be liquidated": "청산될 수 있는 최대 롱",
  "Biggest first, each with the price that would liquidate it.":
    "큰 순서, 각 포지션을 청산할 가격과 함께.",
  "Largest shorts": "최대 숏",
  "Largest shorts that can be liquidated": "청산될 수 있는 최대 숏",
  "The {n} largest of {total}.": "전체 {total}개 중 가장 큰 {n}개.",
  "Position list": "포지션 목록",
  "No long position here has a liquidation price.": "청산 가격이 있는 롱 포지션이 없습니다.",
  "No short position here has a liquidation price.": "청산 가격이 있는 숏 포지션이 없습니다.",
};
