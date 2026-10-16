import type { Catalog } from "../../i18n";

/**
 * /whales (web/whales.ts), its route's 404 (app/app.ts) and its nav and hotkey label.
 *
 * Terms: whale orders クジラ注文, wall 壁 (bid wall 買い壁, ask wall 売り壁), resting 板上,
 * filled 約定, pulled 取消, spoof 見せ板. A taker burst (the circles) is テイカー買い / テイカー売り,
 * the glossary's taker. Candles are ローソク足, an n-hour candle n時間足. A Hyperliquid price
 * bucket is 価格帯.
 */
export const whales: Catalog = {
  "{asset} is not one of the markets tracked on {venue}.":
    "{asset} は {venue} で追跡している銘柄ではありません。",
  whales: "クジラ注文",
  bid: "買い",
  ask: "売り",
  resting: "板上",
  filled: "約定",
  pulled: "取消",
  "lost track": "追跡途絶",
  "{n}m": "{n}分",
  "{d}d {h}h": "{d}日{h}時間",
  "{side} wall {price} · {size} · {status} · {lived}":
    "{side}壁 {price} · {size} · {status} · {lived}",
  "{asset} · {venue} perp · {n}-hour candles, {zone}":
    "{asset} · {venue} 無期限先物 · {n}時間足、{zone}",
  "{asset} · {venue} perp · {n}-minute candles, {zone}":
    "{asset} · {venue} 無期限先物 · {n}分足、{zone}",
  "bid wall (buy orders)": "買い壁（買い注文）",
  "ask wall (sell orders)": "売り壁（売り注文）",
  "faded: filled or pulled": "薄色：約定または取消",
  "last price": "最終価格",
  Markets: "銘柄",
  "hide pulled walls": "取消された壁を隠す",
  "show pulled walls": "取消された壁を表示",
  "Bid walls resting": "板上の買い壁",
  "{n} buy walls below the price": "価格の下に買い壁 {n} 件",
  "Ask walls resting": "板上の売り壁",
  "{n} sell walls above the price": "価格の上に売り壁 {n} 件",
  "Largest wall": "最大の壁",
  "{side} at {price}": "{side} {price}",
  "none resting": "板上になし",
  "Pulled in {window}": "{window} の取消",
  "cancelled before the price reached them; {n} filled": "価格が届く前に取り消し。約定は {n} 件",
  "No candles for {asset} yet. The collector backfills three days within a minute of a market joining the set.":
    "{asset} のローソク足はまだありません。銘柄が追加されると、コレクターが 1 分以内に 3 日分を補完します。",
  Side: "サイド",
  "From the last price": "最終価格からの距離",
  Distance: "距離",
  Size: "サイズ",
  "The most it has held": "これまでの最大量",
  Peak: "最大",
  "Since the collector first saw it": "コレクターが最初に検出してから",
  "Resting since": "継続時間",
  "No wall is resting in {asset}'s book right now.": "現在、{asset} の板に壁はありません。",
  Lived: "存続",
  Ended: "終了",
  How: "結果",
  "No wall ended in the last {window}.": "直近 {window} に終了した壁はありません。",
  "Large resting limit orders in Binance's USD-M book for {asset}: one price level holding at least {floor} for at least a minute. A {bid} is buy orders below the price, an {ask} sell orders above it. Each line runs from when the collector first saw the wall to when it went, and is thicker the bigger it is.":
    "Binance の USD-M 板にある {asset} の大口指値注文です。1 つの価格に {floor} 以上が 1 分以上並んでいるものを示します。{bid}は価格の下の買い注文、{ask}は価格の上の売り注文です。各線はコレクターが壁を最初に検出した時点から消えるまで伸び、壁が大きいほど太くなります。",
  "bid wall": "買い壁",
  "ask wall": "売り壁",
  "A wall that ends is filled if the price reached it and pulled if it was cancelled first. Pulled walls are hidden by default: most are spoofs or quotes moving with the price. Walls are a snapshot of visible liquidity, not a floor or a ceiling, and not a forecast; any of them can be gone the moment the price gets near.":
    "消えた壁は、価格が届いていれば約定、その前に取り消されていれば取消として記録します。取消された壁は初期設定で非表示です。その多くは見せ板か、価格に合わせて動く気配だからです。壁は見えている流動性のスナップショットにすぎず、底や天井でも予測でもありません。価格が近づいた瞬間に消えることもあります。",
  "The forty markets are the top forty by open interest summed across every exchange we collect, read on Binance. The floor scales with that open interest. After every collector restart the book relearns levels far from the price as they change, so the oldest far walls can take an hour or two to reappear.":
    "この 40 銘柄は、当サイトが収集する全取引所の建玉合計で上位 40 の銘柄で、Binance の板を読んでいます。下限額はその建玉に応じて変わります。コレクターが再起動するたびに、価格から離れた価格帯は変化した時点で読み直すため、最も古い遠くの壁は再表示まで 1〜2 時間かかることがあります。",
  "Whale orders": "クジラ注文",
  "whale orders": "クジラ注文",
  "Large resting limit orders and large market orders on Binance and Hyperliquid futures, drawn over the price: where the walls sit, how big, whether they were filled or pulled, and who hit them.":
    "Binance と Hyperliquid の先物の大口指値注文と大口成行注文を価格チャートに重ねて表示します。壁の位置と大きさ、約定か取消か、そして誰がそれを食ったかがわかります。",
  "The whale-order feed has not ranked its markets yet. It does so within a few minutes of starting.":
    "クジラ注文のフィードはまだ銘柄の順位付けを終えていません。起動から数分以内に完了します。",
  "Resting now": "現在の板",
  "Orders and trades": "注文と約定",
  "{n} resting": "板上 {n} 件",
  "Every wall in the book right now, largest first. Distance is from the last price; size is what the level holds now, peak the most it has held.":
    "現在板にあるすべての壁を大きい順に表示します。距離は最終価格から、サイズはその価格の現在の量、最大はこれまでの最大量です。",
  "Ended in the last {window}": "直近 {window} に終了",
  "taker buy": "テイカー買い",
  "taker sell": "テイカー売り",
  "one fill": "約定 1 件",
  "{n} fills": "約定 {n} 件",
  "{side} {size} at {price} · {fills} · {time}": "{side} {size}、価格 {price} · {fills} · {time}",
  "large taker buy": "大口テイカー買い",
  "large taker sell": "大口テイカー売り",
  "Large buys in {window}": "{window} の大口買い",
  "Large sells in {window}": "{window} の大口売り",
  "{n} taker bursts of {floor} or more": "{floor} 以上のテイカー約定 {n} 件",
  "Aggregate trades in the burst: roughly the price levels it took":
    "このまとまった約定に含まれる集約約定の数。食った価格の数とほぼ同じです",
  Fills: "約定数",
  When: "時刻",
  "No taker burst of {floor} or more in the last {window}.":
    "直近 {window} に {floor} 以上のテイカー約定はありません。",
  "Largest trades in the last {window}": "直近 {window} の最大の約定",
  "taker {address}": "テイカー {address}",
  "{size} in {n} orders, one at least {proven}": "{size}（注文 {n} 件、うち 1 件は {proven} 以上）",
  "no walls": "壁なし",
  "{bid} bid · {ask} ask": "買い {bid} · 売り {ask}",
  "Pick a market": "銘柄を選択",
  "{n} markets": "{n} 銘柄",
  "Filter markets": "銘柄を絞り込む",
  "Walls resting, bid / ask": "板上の壁、買い / 売り",
  "Large taker buys minus sells, last 24 hours": "直近 24 時間の大口テイカー買いから売りを引いた額",
  "Whale flow 24h": "クジラフロー 24h",
  "No market matches.": "一致する銘柄はありません。",
  "Orders in the bucket at the last look": "最後に確認した時点でこの価格帯にあった注文数",
  Orders: "注文数",
  "The bucket's average order: its largest holds at least this":
    "この価格帯の平均注文額。最大の注文は少なくともこの額です",
  "Largest ≥": "最大 ≥",
  Taker: "テイカー",
  "Proven whale orders in {venue}'s book for {asset}. {venue} publishes only its 20 nearest price buckets a side, here {step} wide, each with how many orders it holds. A wall is a bucket whose average order is at least {floor}, so at least one order in it is that big; a {bid} sits below the price, an {ask} above it. It stays a wall while the bucket still holds what that order was proven to. A whale order sharing a bucket with many small ones cannot be proven, and is not drawn.":
    "{venue} の板にある {asset} の、存在が確かなクジラ注文です。{venue} は片側につき最も近い 20 の価格帯（ここでは幅 {step}）と、それぞれの注文数しか公開していません。壁とは平均注文額が {floor} 以上の価格帯のことで、その中に少なくとも 1 件はその規模の注文があります。{bid}は価格の下、{ask}は価格の上にあります。その価格帯に、確認された注文の額が残っている間は壁とみなします。多数の小口注文と同じ価格帯にあるクジラ注文は確認できないため、描画しません。",
  "Each circle is one account's market order in one block, of at least the same {floor}; the table names the account. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the order. The chart draws the 200 largest in the window.":
    "各円は、1 つのアカウントが 1 ブロック内に出した、同じく {floor} 以上の成行注文です。表にそのアカウントを示します。青はテイカーの買い、赤はテイカーの売りで、円が大きいほど注文も大きくなります。チャートには期間内の上位 200 件を描画します。",
  "The markets are the top forty by open interest summed across every exchange we collect, among those {venue} lists, its HIP-3 markets included (gold is xyz:GOLD). The floor scales with that open interest.":
    "銘柄は、{venue} に上場しているもの（HIP-3 銘柄を含む。金は xyz:GOLD）のうち、当サイトが収集する全取引所の建玉合計で上位 40 のものです。下限額はその建玉に応じて変わります。",
  "Each circle is a large market order: every fill on one side in the same millisecond, counted as one burst, of at least the same {floor}. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the burst. The chart draws the 200 largest in the window.":
    "各円は大口の成行注文です。同じミリ秒に同じ方向で約定したものをまとめて 1 件と数え、同じく {floor} 以上のものを示します。青はテイカーの買い、赤はテイカーの売りで、円が大きいほど約定も大きくなります。チャートには期間内の上位 200 件を描画します。",
  "off the chart:": "チャート外：",
  "last {price}": "最終 {price}",
  "hover or tap a candle to read it": "ローソク足にカーソルを合わせるかタップすると値を表示",
  "{asset} candles; arrow keys read one at a time":
    "{asset} のローソク足。矢印キーで1本ずつ確認できます",
  "{asset} volume per candle": "{asset} のローソク足ごとの出来高",
};
