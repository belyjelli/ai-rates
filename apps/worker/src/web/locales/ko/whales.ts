import type { Catalog } from "../../i18n";

/**
 * /whales (web/whales.ts), its route's 404 (app/app.ts) and its nav and hotkey label.
 *
 * Terms: whale orders 고래 주문, wall 벽 (bid wall 매수벽, ask wall 매도벽), resting 대기 중,
 * filled 체결, pulled 취소. A resting order is a maker's order waiting in the 호가창. A taker burst
 * (the circles) is the glossary's taker: taker buy 테이커 매수, taker sell 테이커 매도.
 */
export const whales: Catalog = {
  "{asset} is not one of the markets tracked on {venue}.":
    "{asset}은(는) {venue}에서 추적하는 종목이 아닙니다.",
  whales: "고래 주문",
  bid: "매수",
  ask: "매도",
  resting: "대기 중",
  filled: "체결",
  pulled: "취소",
  "lost track": "추적 중단",
  "{n}m": "{n}분",
  "{d}d {h}h": "{d}일 {h}시간",
  "{side} wall {price} · {size} · {status} · {lived}":
    "{side}벽 {price} · {size} · {status} · {lived}",
  "{asset} · {venue} perp · {n}-hour candles, {zone}":
    "{asset} · {venue} 무기한 선물 · {n}시간 봉, {zone}",
  "{asset} · {venue} perp · {n}-minute candles, {zone}":
    "{asset} · {venue} 무기한 선물 · {n}분 봉, {zone}",
  "bid wall (buy orders)": "매수벽(매수 주문)",
  "ask wall (sell orders)": "매도벽(매도 주문)",
  "faded: filled or pulled": "흐리게: 체결 또는 취소",
  "last price": "최근 가격",
  Markets: "종목",
  "hide pulled walls": "취소된 벽 숨기기",
  "show pulled walls": "취소된 벽 보기",
  "Bid walls resting": "대기 중인 매수벽",
  "{n} buy walls below the price": "가격 아래 매수벽 {n}개",
  "Ask walls resting": "대기 중인 매도벽",
  "{n} sell walls above the price": "가격 위 매도벽 {n}개",
  "Largest wall": "가장 큰 벽",
  "{side} at {price}": "{side}, {price}",
  "none resting": "대기 중인 벽 없음",
  "Pulled in {window}": "{window} 동안 취소",
  "cancelled before the price reached them; {n} filled": "가격이 닿기 전에 취소됨, 체결 {n}개",
  "No candles for {asset} yet. The collector backfills three days within a minute of a market joining the set.":
    "{asset}의 봉 데이터가 아직 없습니다. 종목이 추적 대상에 추가되면 수집기가 1분 안에 3일치를 채웁니다.",
  Side: "방향",
  "From the last price": "최근 가격으로부터",
  Distance: "거리",
  Size: "규모",
  "The most it has held": "지금까지의 최대 규모",
  Peak: "최대",
  "Since the collector first saw it": "수집기가 처음 포착한 뒤로",
  "Resting since": "대기 시간",
  "No wall is resting in {asset}'s book right now.":
    "지금 {asset} 호가창에 대기 중인 벽이 없습니다.",
  Lived: "유지 시간",
  Ended: "종료",
  How: "결과",
  "No wall ended in the last {window}.": "최근 {window} 동안 종료된 벽이 없습니다.",
  "Large resting limit orders in Binance's USD-M book for {asset}: one price level holding at least {floor} for at least a minute. A {bid} is buy orders below the price, an {ask} sell orders above it. Each line runs from when the collector first saw the wall to when it went, and is thicker the bigger it is.":
    "Binance USD-M 호가창에서 {asset}의 대기 중인 대량 지정가 주문입니다. 한 가격에 {floor} 이상이 1분 이상 걸려 있는 경우를 말합니다. {bid}은 가격 아래의 매수 주문, {ask}은 가격 위의 매도 주문입니다. 각 선은 수집기가 벽을 처음 포착한 때부터 사라질 때까지 이어지며, 벽이 클수록 굵습니다.",
  "bid wall": "매수벽",
  "ask wall": "매도벽",
  "A wall that ends is filled if the price reached it and pulled if it was cancelled first. Pulled walls are hidden by default: most are spoofs or quotes moving with the price. Walls are a snapshot of visible liquidity, not a floor or a ceiling, and not a forecast; any of them can be gone the moment the price gets near.":
    "벽이 사라질 때 가격이 닿았으면 체결, 그 전에 취소되었으면 취소로 기록합니다. 취소된 벽은 기본적으로 숨깁니다. 대부분 허수 주문이거나 가격을 따라 움직이는 호가이기 때문입니다. 벽은 보이는 유동성의 스냅숏일 뿐 바닥이나 천장이 아니며, 예측도 아닙니다. 가격이 다가오는 순간 어떤 벽이든 사라질 수 있습니다.",
  "The forty markets are the top forty by open interest summed across every exchange we collect, read on Binance. The floor scales with that open interest. After every collector restart the book relearns levels far from the price as they change, so the oldest far walls can take an hour or two to reappear.":
    "40개 종목은 수집하는 모든 거래소의 미결제약정 합계 기준 상위 40개이며, Binance에서 읽습니다. 기준 금액은 그 미결제약정에 비례합니다. 수집기가 재시작할 때마다 호가창은 가격에서 먼 수준을 그 수준이 바뀔 때 다시 익히므로, 가장 오래된 먼 벽이 다시 나타나기까지 한두 시간이 걸릴 수 있습니다.",
  "Whale orders": "고래 주문",
  "whale orders": "고래 주문",
  "Large resting limit orders and large market orders on Binance and Hyperliquid futures, drawn over the price: where the walls sit, how big, whether they were filled or pulled, and who hit them.":
    "Binance와 Hyperliquid 선물의 대량 지정가 주문과 대량 시장가 주문을 가격 위에 그립니다: 벽의 위치와 규모, 체결 또는 취소 여부, 그리고 누가 벽을 쳤는지.",
  "The whale-order feed has not ranked its markets yet. It does so within a few minutes of starting.":
    "고래 주문 피드가 아직 종목 순위를 정하지 않았습니다. 시작 후 몇 분 안에 정해집니다.",
  "Resting now": "현재 대기 중",
  "Orders and trades": "주문과 체결",
  "{n} resting": "대기 중 {n}개",
  "Every wall in the book right now, largest first. Distance is from the last price; size is what the level holds now, peak the most it has held.":
    "지금 호가창에 있는 모든 벽을 큰 순서로 보여 줍니다. 거리는 최근 가격 기준이고, 규모는 그 가격에 지금 걸린 금액, 최대는 지금까지 걸렸던 최대 금액입니다.",
  "Ended in the last {window}": "최근 {window} 동안 종료",
  "taker buy": "테이커 매수",
  "taker sell": "테이커 매도",
  "one fill": "체결 1건",
  "{n} fills": "체결 {n}건",
  "{side} {size} at {price} · {fills} · {time}": "{side} {size}, {price} · {fills} · {time}",
  "large taker buy": "대량 테이커 매수",
  "large taker sell": "대량 테이커 매도",
  "Large buys in {window}": "{window} 동안 대량 매수",
  "Large sells in {window}": "{window} 동안 대량 매도",
  "{n} taker bursts of {floor} or more": "{floor} 이상 테이커 체결 {n}건",
  "Aggregate trades in the burst: roughly the price levels it took":
    "이 체결에 포함된 집계 거래 수: 대략 소진한 가격 수준의 수",
  Fills: "체결 수",
  When: "시각",
  "No taker burst of {floor} or more in the last {window}.":
    "최근 {window} 동안 {floor} 이상 테이커 체결이 없습니다.",
  "Largest trades in the last {window}": "최근 {window} 최대 거래",
  "taker {address}": "테이커 {address}",
  "{size} in {n} orders, one at least {proven}": "{size}, 주문 {n}개, 그중 하나는 최소 {proven}",
  "no walls": "벽 없음",
  "{bid} bid · {ask} ask": "매수 {bid} · 매도 {ask}",
  "Pick a market": "종목 선택",
  "{n} markets": "{n}개 종목",
  "Filter markets": "종목 검색",
  "Walls resting, bid / ask": "대기 중인 벽, 매수 / 매도",
  "Large taker buys minus sells, last 24 hours": "최근 24시간 대량 테이커 매수 − 매도",
  "Whale flow 24h": "24시간 고래 흐름",
  "No market matches.": "일치하는 종목이 없습니다.",
  "Orders in the bucket at the last look": "마지막 확인 시 그 구간의 주문 수",
  Orders: "주문 수",
  "The bucket's average order: its largest holds at least this":
    "구간의 평균 주문 금액: 가장 큰 주문은 최소 이만큼입니다",
  "Largest ≥": "최대 ≥",
  Taker: "테이커",
  "Proven whale orders in {venue}'s book for {asset}. {venue} publishes only its 20 nearest price buckets a side, here {step} wide, each with how many orders it holds. A wall is a bucket whose average order is at least {floor}, so at least one order in it is that big; a {bid} sits below the price, an {ask} above it. It stays a wall while the bucket still holds what that order was proven to. A whale order sharing a bucket with many small ones cannot be proven, and is not drawn.":
    "{venue} 호가창에서 {asset}의 입증된 고래 주문입니다. {venue}은(는) 양쪽 각각 가장 가까운 20개 가격 구간만 공개하며, 여기서는 구간 폭이 {step}이고 구간마다 주문 수가 함께 나옵니다. 벽은 평균 주문 금액이 {floor} 이상인 구간이므로, 그 안에 적어도 한 주문은 그만큼 큽니다. {bid}은 가격 아래, {ask}은 가격 위에 있습니다. 그 주문의 입증된 금액이 구간에 남아 있는 동안 벽으로 유지됩니다. 작은 주문이 많은 구간에 섞인 고래 주문은 입증할 수 없어 그리지 않습니다.",
  "Each circle is one account's market order in one block, of at least the same {floor}; the table names the account. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the order. The chart draws the 200 largest in the window.":
    "원 하나는 한 블록 안에서 한 계정이 낸 시장가 주문이며, 마찬가지로 {floor} 이상입니다. 표에 그 계정이 나옵니다. 파란색은 테이커 매수, 빨간색은 테이커 매도이며, 원이 클수록 주문이 큽니다. 차트는 기간 내 가장 큰 200건을 그립니다.",
  "The markets are the top forty by open interest summed across every exchange we collect, among those {venue} lists, its HIP-3 markets included (gold is xyz:GOLD). The floor scales with that open interest.":
    "종목은 {venue}에 상장된 것 중 수집하는 모든 거래소의 미결제약정 합계 기준 상위 40개이며, HIP-3 종목도 포함합니다(금은 xyz:GOLD). 기준 금액은 그 미결제약정에 비례합니다.",
  "Each circle is a large market order: every fill on one side in the same millisecond, counted as one burst, of at least the same {floor}. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the burst. The chart draws the 200 largest in the window.":
    "원 하나는 대량 시장가 주문입니다. 같은 밀리초에 한 방향으로 일어난 모든 체결을 한 건으로 묶으며, 마찬가지로 {floor} 이상입니다. 파란색은 테이커 매수, 빨간색은 테이커 매도이며, 원이 클수록 체결이 큽니다. 차트는 기간 내 가장 큰 200건을 그립니다.",
  "off the chart:": "차트 밖:",
  "last {price}": "최근 가격 {price}",
  "hover or tap a candle to read it": "봉에 마우스를 올리거나 탭하여 값 확인",
  "{asset} candles; arrow keys read one at a time": "{asset} 봉, 방향키로 하나씩 확인",
  "{asset} volume per candle": "{asset} 봉별 거래량",
};
