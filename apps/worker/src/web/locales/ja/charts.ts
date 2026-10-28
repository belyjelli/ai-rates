/**
 * Japanese for the chart pages and their readouts: web/cvd.ts, web/kchart.ts, web/sentiment.ts,
 * web/funding-chart.ts and web/slot-chart.ts (web/rail.ts has no words of its own). Glossary and
 * style: ./index.ts.
 *
 * Terms: asset 銘柄 (a coin or ticker, the CVD screener's row; "{n}銘柄"), the polled market an asset
 * is read from 市場, window 期間, bar 足 in a timeframe ("5分足") and バー for a drawn bar, candle
 * ローソク足, taker buy / sell テイカー買い / テイカー売り, net buying / selling 買い越し / 売り越し,
 * net (a signed total) ネット, cumulative volume delta 累積出来高デルタ (CVD stays), divergence
 * ダイバージェンス, OHLC 始 / 高 / 安 / 終.
 *
 * Keys shared with the liquidations part (months, dates, "Window", the hover hints) carry the same
 * translation there, which i18n.test.ts holds.
 */

import type { Catalog } from "../../i18n";

export const charts: Catalog = {
  // Dates on the axes and in the hover readouts; the month names are marked in web/slot-chart.ts.
  Jan: "1月",
  Feb: "2月",
  Mar: "3月",
  Apr: "4月",
  May: "5月",
  Jun: "6月",
  Jul: "7月",
  Aug: "8月",
  Sep: "9月",
  Oct: "10月",
  Nov: "11月",
  Dec: "12月",
  "{month} {day}": "{month}{day}日",
  "{month} {day} {time} {zone}": "{month}{day}日 {time} {zone}",

  // web/slot-chart.ts: the hover readouts of the CVD and longs-vs-shorts charts.
  "{low} – {high} ({pct} from the mark)": "{low} – {high}（マーク価格から {pct}）",
  "longs liquidate here: {usd} ({n})": "ここで清算されるロング：{usd}（{n}）",
  "shorts liquidate here: {usd} ({n})": "ここで清算されるショート：{usd}（{n}）",
  "{n} position": "{n}ポジション",
  "no whale liquidates here": "ここで清算されるクジラはいません",
  "{usd} of longs liquidate between here and the mark":
    "ここからマーク価格までに {usd} のロングが清算",
  "{usd} of shorts liquidate between the mark and here":
    "マーク価格からここまでに {usd} のショートが清算",
  Cursor: "カーソル",
  cursor: "カーソル",
  bar: "バー",
  cross: "クロス",
  "Light up the bar under the pointer": "ポインターの下のバーを強調表示",
  "Dashed crosshair at the pointer, with the value there on each axis":
    "ポインター位置に破線の十字線を引き、各軸にその位置の値を表示",
  "no flow recorded": "フローの記録なし",
  "close {price}": "終値 {price}",
  "close {price} ({pct} since start)": "終値 {price}（開始から {pct}）",
  "bought {usd}": "テイカー買い {usd}",
  "sold {usd}": "テイカー売り {usd}",
  "net {net}": "ネット {net}",
  "net {net} ({pct} of volume)": "ネット {net}（出来高の {pct}）",
  "nothing force-closed": "清算なし",
  "longs closed {usd}": "ロング清算 {usd}",
  "shorts closed {usd}": "ショート清算 {usd}",
  "longs − shorts {diff}": "ロング − ショート {diff}",
  even: "均衡",
  "longs heavier, {pct}%": "ロングが多い、{pct}%",
  "shorts heavier, {pct}%": "ショートが多い、{pct}%",
  "{n} liquidation": "{n}件の清算",
  "{n} liquidations": "{n}件の清算",
  "{when} (still filling)": "{when}（集計中）",

  // web/cvd.ts: the chart.
  "{asset} · cumulative volume delta · {n}-hour bars, {zone}":
    "{asset} · 累積出来高デルタ · {n}時間足、{zone}",
  "{asset} · cumulative volume delta · {n}-minute bars, {zone}":
    "{asset} · 累積出来高デルタ · {n}分足、{zone}",
  "{asset} futures taker CVD, last {window}: {cvd}. Market buyers {bought} vs sellers {sold}.":
    "{asset} の直近 {window} の先物テイカー CVD：{cvd}。成行の買い手 {bought}、売り手 {sold}。",
  "{asset}, last {window}: futures CVD {futures}, spot CVD {spot}, delta {delta}.":
    "{asset} の直近 {window}：先物 CVD {futures}、現物 CVD {spot}、デルタ {delta}。",
  "Last {window}": "直近 {window}",
  "Loading {interval} bars…": "{interval} 足を読み込み中…",
  "Loading {asset}…": "{asset} を読み込み中…",
  "Not available yet: there is not enough history for {interval} bars":
    "まだ表示できません：{interval} 足に必要な履歴が足りません",
  "Not available yet": "まだ表示できません",
  Price: "価格",
  "Net buy": "買い越し",
  "Net sell": "売り越し",
  "hover or tap a bar to read it": "バーにカーソルを合わせるかタップすると値を表示",
  "{asset} bars; arrow keys read one at a time": "{asset} のバー。矢印キーで1本ずつ確認できます",
  "{asset} price and cumulative volume delta over the last {window}":
    "直近 {window} の {asset} の価格と累積出来高デルタ",
  "{asset} net taker flow per bar": "{asset} のバーごとのテイカーネットフロー",

  // web/cvd.ts: tiles, controls and the screener table.
  Volume: "出来高",
  CVD: "CVD",
  "CVD / volume": "CVD / 出来高",
  Change: "騰落率",
  "CVD breadth": "CVD の広がり",
  "of {n} assets with net taker buying": "{n}銘柄のうちテイカー買い越しの割合",
  "Bullish divergences": "強気ダイバージェンス",
  "price down ≥{price}%, takers net buying ≥{flow}% of volume":
    "価格が {price}% 以上下落、テイカー買い越しが出来高の {flow}% 以上",
  "Bearish divergences": "弱気ダイバージェンス",
  "price up ≥{price}%, takers net selling ≥{flow}% of volume":
    "価格が {price}% 以上上昇、テイカー売り越しが出来高の {flow}% 以上",
  "Top CVD flows": "CVD フロー上位",
  "largest net buy / net sell": "最大の買い越し / 売り越し",
  Window: "期間",
  "bullish div": "強気ダイバ",
  "bearish div": "弱気ダイバ",
  "Search symbol": "シンボルを検索",
  Find: "検索",
  "Pick an asset to chart": "チャートに表示する銘柄を選択",
  "{n} assets": "{n}銘柄",
  "No asset matches.": "一致する銘柄はありません。",
  "No taker flow has been collected in the last {window}. Collection polls each venue every five minutes; a new deployment backfills about a week within its first hour.":
    "直近 {window} のテイカーフローは収集されていません。各取引所を5分ごとに取得しており、新しいデプロイでは最初の1時間で約1週間分をさかのぼって補完します。",
  Asset: "銘柄",
  "Reference market's first close to last close in the window":
    "基準となる市場の、期間内の最初の終値から最後の終値までの変化",
  "Taker buys less taker sells, in dollars, summed over the polled venues":
    "テイカー買いからテイカー売りを引いた額（ドル）、取得対象の取引所の合計",
  "CVD as a share of the window's taker volume": "期間内のテイカー出来高に対する CVD の割合",
  "Taker buys plus taker sells, in dollars": "テイカー買いとテイカー売りの合計（ドル）",
  "Polled venues with flow for this asset": "この銘柄のフローがある取得対象の取引所",
  Venues: "取引所",
  "Price and flow disagreeing by more than the divergence thresholds in the tiles":
    "価格とフローが、上のタイルのダイバージェンス基準を超えて食い違っている",
  Signal: "シグナル",
  "No live market lists {asset}, so there is no flow to chart.":
    "{asset} を扱う稼働中の市場がないため、表示するフローはありません。",
  "Newest bucket {age}.": "最新の区間：{age}。",
  "The venues that publish statistics release each 5-minute bucket after it closes, so the newest bar holds only the live tapes for a few minutes.":
    "統計を公開する取引所は5分ごとの区間を締めてから公開するため、最新の足は数分間、リアルタイム集計の取引所だけを含みます。",

  // web/cvd.ts: the page.
  "taker buys": "テイカー買い",
  "taker sells": "テイカー売り",
  "The asset button beside the intervals opens the screener: every polled asset's taker flow over the window. Pick one to chart it, find a ticker in its box, or sort by a heading. Change is the busiest polled market's first to last close in the window. History is uneven by venue: Binance, Gate and Bitget publish weeks of it and OKX five days, while Bybit, Hyperliquid and the spot books other than Binance's are counted from their live trades since 28 October 2026, so older bars sum fewer venues.":
    "時間足ボタンの横にある銘柄ボタンでスクリーナーが開きます：取得対象の全銘柄の、期間内のテイカーフローです。銘柄を選ぶとチャートを表示し、検索欄でティッカーを探したり、見出しで並べ替えたりできます。騰落率は取得対象で最も出来高の多い市場の、期間内の最初の終値から最後の終値までの変化です。履歴の長さは取引所によって異なります。Binance、Gate、Bitget は数週間分、OKX は5日分を公開しています。Bybit、Hyperliquid、および Binance 以外の現物板は2026年10月28日からリアルタイムの約定で集計しているため、古い足に含まれる取引所は少なくなります。",

  // web/funding-chart.ts
  "The funding chart is unavailable right now. The backtest below is unaffected.":
    "資金調達率チャートは現在表示できません。下のバックテストには影響ありません。",
  "No stored funding for this window yet.": "この期間の資金調達率はまだ保存されていません。",
  Spread: "スプレッド",
  "Funding by exchange, annualized · hourly": "取引所別の資金調達率（年率）· 1時間ごと",
  "Funding by exchange, annualized · daily": "取引所別の資金調達率（年率）· 日次",
  "Funding APR by exchange over the window": "期間内の取引所別の資金調達率（年率）",
  "Hover the chart to read every visible line at one moment.":
    "チャートにカーソルを合わせると、その時点の表示中のすべての線の値を確認できます。",
  "Signed log scale, so ordinary rates keep room beside extreme ones. Each line holds a rate until that exchange's next settlement; a break is time with no recorded funding, not a zero.":
    "符号付きの対数スケールのため、通常のレートも極端なレートと並べて見やすく表示されます。各線はその取引所の次の精算までレートを保持します。線が途切れている部分は資金調達率の記録がない期間で、ゼロではありません。",

  // web/sentiment.ts
  "No readings yet in this window.": "この期間の測定値はまだありません。",
  "Fear & greed: {score}, {label}": "恐怖と強欲：{score}、{label}",
  "Fear and greed score reaches {score} ({label})": "恐怖と強欲スコアが {score} に到達（{label}）",
  "{n} readings, every 30 minutes · {age} to now": "測定値{n}件、30分ごと · {age}から現在まで",
  "no data in window": "期間内のデータなし",
  "Fear &amp; greed · updated {ago}": "恐怖と強欲 · {ago}に更新",
  "Fear &amp; greed": "恐怖と強欲",
  component: "指標",
  reading: "測定値",
  "percentile (30d, greed direction)": "パーセンタイル（30日、強欲方向）",
  "funding (OI-weighted APR)": "資金調達率（建玉加重の年率）",
  "open interest": "建玉",
  "liquidation skew (24h)": "清算の偏り（24時間）",
  "{pct} long-heavy": "{pct} ロング寄り",
  "taker flow (24h)": "テイカーフロー（24時間）",
  "{pct} net buy": "{pct} 買い越し",
  "Score is the mean of four components, each a percentile rank against this book's own trailing 30-day history — not a fixed scale, so the same raw number reads differently in a quiet stretch than a volatile one. <b>Funding</b> and <b>open interest</b> run high-is-greedy (crowded, levered longs paying to hold). <b>Liquidation skew</b> is inverted before averaging: a book where longs are being forced out is fear, however unusual that reading looks against its own history. <b>Taker flow</b> is net aggressive buying over aggressive selling, last 24h. Computed every 30 minutes by the collector (belyjelli/profitlock-worker, <code>collector rank-eval</code>'s sibling <code>market sentiment</code> job); coverage for liquidations and taker flow is not venue-complete, so this is a proxy, not a market-wide guarantee.":
    "スコアは4つの指標の平均で、各指標はこの市場自身の過去30日の履歴に対するパーセンタイル順位です — 固定の尺度ではないため、同じ生の値でも落ち着いた時期と荒れた時期とでは読み方が変わります。<b>資金調達率</b>と<b>建玉</b>は高いほど強欲です（混み合ったレバレッジのロングが保有コストを払っている状態）。<b>清算の偏り</b>は平均する前に反転させます：ロングが強制的に清算されている市場は、その値が自身の履歴に比べてどれほど異例に見えても恐怖です。<b>テイカーフロー</b>は直近24時間の積極的な買いから積極的な売りを引いた差です。コレクター（belyjelli/profitlock-worker、<code>collector rank-eval</code> と同列の <code>market sentiment</code> ジョブ）が30分ごとに計算します。清算とテイカーフローはすべての取引所を網羅していないため、これは代理指標であり、市場全体を保証するものではありません。",
  "Fear & Greed": "恐怖と強欲",
  "A funding-market fear and greed score: OI-weighted funding, open interest, liquidation skew and taker flow, each ranked against its own 30-day history.":
    "資金調達市場の恐怖と強欲スコア：建玉加重の資金調達率、建玉、清算の偏り、テイカーフローを、それぞれ自身の過去30日の履歴と比べて順位付けしたもの。",
  "{month} {day} {time}–{end} {zone}": "{month}{day}日 {time}–{end} {zone}",
  "close, {market}": "終値、{market}",
  "open {open} · high {high} · low {low} · close {close}":
    "始 {open} · 高 {high} · 安 {low} · 終 {close}",
  "volume {usd}": "出来高 {usd}",
  "large taker buys {usd} ({n})": "大口テイカー買い {usd}（{n}件）",
  "large taker sells {usd} ({n})": "大口テイカー売り {usd}（{n}件）",
  "no candle": "ローソク足なし",
  "{month} {day} {hours} {zone}": "{month}{day}日 {hours} {zone}",
  "{hours} {zone}": "{hours} {zone}",

  // web/kchart.ts: the trading chart on /cvd.
  "Loading older bars…": "過去の足を読み込み中…",
  "Nothing older: taker flow is kept for {days} days.":
    "これより古いデータはありません：テイカーフローの保存期間は{days}日です。",
  "Older bars did not load. Drag again to retry.":
    "過去の足を読み込めませんでした。もう一度ドラッグすると再試行します。",
  "drag to look back · wheel or pinch to zoom · hover a candle to read it":
    "ドラッグで過去へ · ホイールまたはピンチでズーム · ローソク足にカーソルを合わせて値を表示",
  "Futures CVD": "先物 CVD",
  "Spot CVD": "現物 CVD",
  "Delta buy": "デルタ買い越し",
  "Delta sell": "デルタ売り越し",
  "{asset} delta per bar, spot and futures net taker flow summed":
    "{asset} のバーごとのデルタ（現物と先物のテイカーネットフローの合計）",
  "No taker flow for {asset} in the last {window}. Only the ~500 assets deepest on {venues} are polled; pick one from the asset list above.":
    "直近 {window} に {asset} のテイカーフローはありません。{venues} で建玉の大きい約500銘柄のみを取得しています。上の銘柄リストから選んでください。",
  "Price with cumulative volume delta under it: spot and futures taker buying against taker selling, their combined delta per bar, and where price and order flow disagree.":
    "価格とその下の累積出来高デルタ：現物と先物のテイカー買いとテイカー売りの比較、バーごとの合計デルタ、そして価格とオーダーフローが食い違う箇所。",
  "Price, with cumulative volume delta (CVD) under it: {buys} less {sells}, in dollars, summed over every exchange we collect that lists the asset. Futures CVD adds up the perpetuals on <b>{futures}</b>; spot CVD the spot books on <b>{spot}</b>, one book an exchange. It covers the ~500 assets deepest by open interest and every commodity, index and currency pair, in 5-minute buckets. A divergence marks a window where price and flow pointed opposite ways; it describes what happened, not what happens next.":
    "価格と、その下の累積出来高デルタ（CVD）：{buys} から {sells} を引いた額（ドル）で、その銘柄を上場している取得対象のすべての取引所を合計したものです。先物 CVD は <b>{futures}</b> の無期限先物を、現物 CVD は <b>{spot}</b> の現物板（取引所ごとに1つ）を合計します。建玉の大きい約500銘柄と、すべてのコモディティ・指数・通貨ペアが対象で、5分単位です。ダイバージェンスは価格とフローが逆を向いた期間を示します。起きたことを表すもので、この先を予測するものではありません。",
  "Each key above the chart says how many venues its line sums for this asset; hover it for their names. Spot is crypto only: stocks, commodities and indices have no spot book on a crypto exchange and show futures only. Spot and futures each have a pane, because their sizes differ by an order of magnitude on most assets. The histogram under them is the delta: each bar's spot and futures net summed.":
    "チャート上の各凡例には、その線がこの銘柄で何取引所を合計しているかが表示されます。カーソルを合わせると取引所名が出ます。現物は暗号資産のみです。株式・コモディティ・指数は暗号資産取引所に現物板がないため、先物のみを表示します。多くの銘柄で規模が一桁違うため、現物と先物はそれぞれ別のパネルです。その下のヒストグラムはデルタで、バーごとの現物と先物のネットの合計です。",
  "Price is the busiest polled market's own candle. Each pane has its own scale, so where lines cross means nothing. Drag to look back, wheel or pinch to zoom, and hover a candle to read it in the box beside it; on a phone, tap.":
    "価格は取得対象で最も出来高の多い市場自身のローソク足です。パネルごとに目盛りが異なるため、線が交差する位置に意味はありません。ドラッグで過去をさかのぼり、ホイールまたはピンチで拡大縮小し、ローソク足にカーソルを合わせると横のボックスに値が表示されます。スマートフォンではタップしてください。",
  "futures net {net}": "先物ネット {net}",
  "spot net {net}": "現物ネット {net}",
  "delta {net}": "デルタ {net}",
  "delta {net} ({pct} of volume)": "デルタ {net}（出来高の {pct}）",
  "CVD futures {futures}, spot {spot}": "CVD 先物 {futures}、現物 {spot}",
  Open: "始値",
  High: "高値",
  Low: "安値",
  Futures: "先物",
  "Spot (Binance)": "現物（Binance）",
  // The Chart page's fund-flow dropdown (web/fund-flow.ts).
  "No spot book for this asset on the collected exchanges.":
    "取得対象の取引所にこの資産の現物板はありません。",
  "No futures flow for this asset yet.": "この資産の先物フローはまだありません。",
  Time: "時間",
  "Taker buys in the window, in dollars": "期間内のテイカー買い（ドル）",
  "Inflow ($)": "流入（$）",
  "Taker sells in the window, in dollars": "期間内のテイカー売り（ドル）",
  "Outflow ($)": "流出（$）",
  "Inflow less outflow": "流入から流出を引いた額",
  "Net inflow ($)": "純流入（$）",
  "Net inflow against the window of the same length before it":
    "直前の同じ長さの期間の純流入との比較",
  "Net inflow change": "純流入の変化",
  "Net inflow as a share of the asset's market cap": "純流入の時価総額に対する比率",
  "F/M cap ratio": "資金/時価総額比",
  "Spot fund": "現物資金",
  "Spot books on {venues}": "{venues} の現物板",
  "{count} venues": "{count} 取引所",
  "Futures fund": "先物資金",
  "Perpetuals on {venues}": "{venues} の無期限先物",
  "Fund flow": "資金フロー",
  "Inflow is taker buying and outflow taker selling, summed over each window back from the newest bucket every venue has published. Net inflow change compares the net with the window of the same length before it. F/M cap ratio is the net as a share of the asset's market cap (CoinGecko). A dash means the history does not reach back that far yet.":
    "流入はテイカー買い、流出はテイカー売りで、全取引所が公開済みの最新バケットから各期間をさかのぼって合計します。純流入の変化は、直前の同じ長さの期間の純流入との比較です。資金/時価総額比は、純流入が資産の時価総額（CoinGecko）に占める割合です。ダッシュは履歴がまだその期間に届いていないことを示します。",
  "Up to": "時点",
};
