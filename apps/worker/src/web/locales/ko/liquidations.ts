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
  "Modeled from open interest and leverage tiers, not reported by venues.":
    "미결제약정과 레버리지 구간으로 추정한 값이며, 거래소가 공개한 데이터가 아닙니다.",
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
  "By asset and hour": "자산·시간별",
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
  "Positions by distance to liquidation": "청산까지 거리순 포지션",
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
};
