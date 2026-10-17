/**
 * Japanese for web/pages.ts (every page but the /status body, which stays English) and
 * web/venues.ts. Glossary and style: ./index.ts.
 *
 * Terms: live market 稼働中の銘柄, quote (top of book) 気配, best bid / ask 最良買い気配 / 最良売り
 * 気配, resting size 板数量, replay リプレイ, notional 想定元本, interval 間隔, window 期間,
 * settlement currency 決済通貨, distressed listing 問題銘柄.
 */

import type { Catalog } from "../../i18n";

export const pages: Catalog = {
  // shared helpers
  flat: "横ばい",
  crypto: "暗号資産",
  equity: "株式",
  commodity: "コモディティ",
  fx: "為替",
  index: "指数",
  "{days} charging days in the last 30": "直近30日のうち{days}日で資金調達料が発生",
  Asset: "銘柄",
  "7d settled": "7日間精算額",
  Stability: "安定性",
  "Long on {venue}": "{venue} でロング",
  "Short on {venue}": "{venue} でショート",
  day: "1日",
  "{n} days": "{n}日間",
  Any: "指定なし",
  Reset: "リセット",

  // home: verified ranking and hero
  "No replay yet: the nightly run needs a week of settled funding on both legs of a pair.":
    "まだリプレイはありません。毎晩の処理には、ペアの両レッグで1週間分の精算済み資金調達料が必要です。",
  "Replayed, not forecast: {asset} long {long} / short {short} settled {net} on {size} a leg over 7 days. {apr} annualized, {win}% of days positive.":
    "予測ではなくリプレイ：{asset} を {long} でロング / {short} でショート、各レッグ {size} で7日間に {net} を精算。年率 {apr}、プラスの日は {win}%。",
  "Open interest on the thinner of the two legs. A big figure earned on a shallow market is not a trade you can size into":
    "2つのレッグのうち薄い方の建玉。浅い市場で得た大きな数字は、ポジションを大きくできる取引ではありません",
  "The more extreme leg's funding, absolute. Rates past a few hundred percent usually mean a delisting or a distressed listing rather than carry":
    "より極端なレッグの資金調達率（絶対値）。数百%を超えるレートは、キャリーではなく上場廃止や問題銘柄であることがほとんどです",
  "Funding both legs actually settled over the last 7 days, per $10,000 of notional on each leg":
    "直近7日間に両レッグで実際に精算された資金調達料（各レッグ想定元本 $10,000 あたり）",
  Annualized: "年率",
  "Long leg": "ロングレッグ",
  "Short leg": "ショートレッグ",
  "Days the pair was net positive, as a share of days that settled at all":
    "精算があった日のうち、ペアが純プラスだった日の割合",
  "Win rate": "勝率",
  "Thinner leg OI": "薄い側の建玉",
  "Worst leg APR": "悪い側の年率",
  "How often the weaker leg held its funding direction over 30 days":
    "30日間で弱い方のレッグが資金調達率の向きを維持した頻度",
  "Widest funding spread right now": "現在最大の資金調達率スプレッド",
  "No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.":
    "直近5分間どの取引所からもデータがないため、ペアを組めません。1分後にもう一度ご確認ください。",
  "Funding spreads across perp exchanges": "無期限先物取引所間の資金調達率スプレッド",
  "Live funding rate spreads between perpetual futures exchanges, refreshed every minute.":
    "無期限先物取引所間のリアルタイム資金調達率スプレッド。毎分更新。",
  "Widest spreads": "最大スプレッド",
  "Open the screener": "スクリーナーを開く",
  "No pairs yet: an asset needs live markets on at least two venues.":
    "まだペアはありません。少なくとも2つの取引所で稼働中の銘柄がある資産が必要です。",
  "What actually paid, last 7 days": "直近7日間で実際に得られた収益",
  "replayed {date}": "{date} にリプレイ",
  "Not a forecast: both legs replayed at their own settlement times from stored funding, on $10,000 per leg. Ranked by what settled, with nothing filtered out — so check the thinner leg's depth and the worse leg's rate before reading a big number as a trade.":
    "予測ではありません。保存済みの資金調達データから、両レッグをそれぞれの精算時刻で各 $10,000 としてリプレイしています。精算額で順位付けし、何も除外していません。大きな数字を取引とみなす前に、薄い側のレッグの厚みと悪い側のレッグのレートを確認してください。",
  "{asset} carry, long {long} / short {short}: {funding} of funding settled on {size} a leg over the last {span}. {net} after retail fees. Price risk hedged, not guessed.":
    "{asset} のキャリー、{long} でロング / {short} でショート：直近{span}に各レッグ {size} で資金調達料 {funding} を精算。リテール手数料控除後 {net}。価格リスクは予想ではなくヘッジ済み。",
  "Best verified carry, last {span}": "直近{span}の検証済み最良キャリー",
  "funding settled on {size} per leg": "各レッグ {size} で精算された資金調達料",
  "after retail fees {value}": "リテール手数料控除後 {value}",
  "annualized {value} before fees": "手数料控除前の年率 {value}",
  "win rate {value} of days": "日次勝率 {value}",
  "thinner leg {value} open interest": "薄い側の建玉 {value}",
  "stability {value}": "安定性 {value}",
  "Open this backtest": "このバックテストを開く",
  "Settled, not forecast: both legs replayed at their own settlement times. This is the best pair in the newest nightly run with at least {oi} of open interest on its thinner leg, neither leg past {apr}% a year, stability of {stability} or better and no missed settlements. Retail fees are {bps} bps on each of {fills} fills, opening and closing both legs. Last week's funding is not a promise about next week's.":
    "予測ではなく精算実績：両レッグをそれぞれの精算時刻でリプレイしています。最新の夜間処理のうち、薄い側のレッグの建玉が {oi} 以上、どちらのレッグも年率 {apr}% 以下、安定性 {stability} 以上、精算の欠損なし、という条件を満たす最良のペアです。リテール手数料は、両レッグのエントリーと決済にあたる {fills}回の約定それぞれに {bps} bps。先週の資金調達料は来週の収益を約束するものではありません。",
  "Widest funding spread across perp exchanges right now: {asset} at {spread} a year. Long {long} at {longApr}, short {short} at {shortApr}.":
    "現在、無期限先物取引所間で最大の資金調達率スプレッド：{asset}、年率 {spread}。{long} でロング（{longApr}）、{short} でショート（{shortApr}）。",
  "funding spread, per year": "資金調達率スプレッド（年率）",
  "{symbol} at {apr}": "{symbol}（{apr}）",
  "Holding equal size on both legs cancels the price exposure; the gap between the two funding rates is what the pair collects over a year, before trading fees and before either rate moves.":
    "両レッグを同じサイズで持てば価格エクスポージャーは相殺されます。2つの資金調達率の差が、このペアが1年間に受け取る収益です（取引手数料とレートの変動は考慮前）。",

  // screener
  "Funding spread screener": "資金調達率スプレッド・スクリーナー",
  "Filter live cross-exchange funding spreads by open interest, volume and exchange type.":
    "取引所間のリアルタイム資金調達率スプレッドを、建玉・出来高・取引所の種類で絞り込めます。",
  "For each asset, the cheapest market to hold long and the richest to hold short, on different exchanges. Each leg must pass the filters.":
    "資産ごとに、異なる取引所の中からロングを持つのに最も安い銘柄と、ショートを持つのに最も有利な銘柄を組み合わせます。各レッグがフィルター条件を満たす必要があります。",
  "No pairs match these filters. Lower the minimum open interest or include more exchange types.":
    "条件に合うペアはありません。最低建玉を下げるか、取引所の種類を増やしてください。",
  "Min open interest, each leg": "各レッグの最低建玉",
  "Min 24h volume, each leg": "各レッグの最低24時間出来高",
  "A USDT leg against a USDC leg carries the basis between the two stablecoins and needs collateral in both. Ticked, each asset is paired only within one quote currency":
    "USDT のレッグと USDC のレッグを組むと、2つのステーブルコイン間のベーシスを負い、両方に証拠金が必要です。チェックすると、各資産は同じ建て通貨の中だけでペアを組みます",
  "Same quote currency on both legs": "両レッグを同じ建て通貨に",
  "Delisting and distressed listings can pay beyond ±2000% APR and crowd out tradeable spreads":
    "上場廃止予定の銘柄や問題銘柄は年率 ±2000% を超えることがあり、取引可能なスプレッドを押しのけてしまいます",
  "Include beyond ±1000% APR": "年率 ±1000% 超も含める",
  Rows: "表示件数",
  Spread: "スプレッド",
  Venues: "取引所",
  "Neither leg has settled funding to score yet":
    "どちらのレッグにも、まだ評価できる精算済み資金調達料がありません",
  "The long leg has no settled funding to score yet":
    "ロングレッグには、まだ評価できる精算済み資金調達料がありません",
  "The short leg has no settled funding to score yet":
    "ショートレッグには、まだ評価できる精算済み資金調達料がありません",
  "Weaker leg held its direction on {days} of its charging days in the last 30":
    "直近30日の資金調達料発生日のうち、弱い方のレッグが向きを維持したのは{days}日",
  "This exchange does not say what the leg settles in, so it cannot be shown to match the other leg":
    "この取引所はレッグの決済通貨を公表していないため、もう一方のレッグと一致するか確認できません",
  "Settles in {quote} while the other leg settles in {other}: the pair carries the basis between them":
    "{quote} 建てで決済、もう一方のレッグは {other} 建て：このペアは両者間のベーシスを負います",
  "an undeclared currency": "非公表の通貨",
  "quote ?": "建て ?",
  OI: "建玉",
  "{asset} pays {spread} a year to hold both sides: long {long} at {longApr}, short {short} at {shortApr}. Same coin, two exchanges, price exposure cancelled.":
    "{asset} の両サイドを持つと年 {spread} の収益：{long} でロング（{longApr}）、{short} でショート（{shortApr}）。同じコイン、2つの取引所で、価格エクスポージャーは相殺。",
  "Signed log scale, so ordinary rates keep room next to extreme ones":
    "符号付き対数目盛。極端なレートの隣でも通常のレートが見えるようにしています",
  "Long − short, log scale": "ロング − ショート、対数目盛",
  "Exchanges with a live market for this asset": "この資産の銘柄が稼働中の取引所数",
  "How often the weaker leg held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "30日間で弱い方のレッグが資金調達率の向きを維持した頻度。0.50 はコイントスと同じ、0.88 は1か月で取り得る最高値です",

  // exchanges and one exchange
  Exchanges: "取引所",
  "No exchange has reported in the last five minutes.":
    "直近5分間、どの取引所からもデータがありません。",
  Exchange: "取引所",
  Type: "種類",
  "Open interest": "建玉",
  "24h volume": "24時間出来高",
  Updated: "更新",
  "{venue}: {count} live perp markets, {oi} open interest. Richest funding {richest} at {richestApr} a year; cheapest {cheapest} at {cheapestApr}.":
    "{venue}：稼働中の無期限先物 {count}銘柄、建玉 {oi}。資金調達率が最も高いのは {richest}（年率 {richestApr}）、最も低いのは {cheapest}（年率 {cheapestApr}）。",
  "{venue} funding rates": "{venue} の資金調達率",
  "Live funding rates, open interest and volume for every {venue} perpetual market.":
    "{venue} の全無期限先物銘柄のリアルタイム資金調達率・建玉・出来高。",
  "No live markets from {venue}: it isn't collected yet, or its last update is more than five minutes old.":
    "{venue} に稼働中の銘柄はありません。未収集か、最終更新から5分以上経過しています。",
  "{count} live markets": "{count}銘柄が稼働中",
  "{value} open interest": "建玉 {value}",
  "updated {value}": "{value}に更新",
  Market: "銘柄",
  "Funding APR": "資金調達率（年率）",
  "Rate, log scale": "レート（対数目盛）",
  Interval: "間隔",
  "Next funding": "次回精算",
  "Mark price": "マーク価格",
  "Centralized exchange": "中央集権型取引所",
  "Onchain perp exchange": "オンチェーン無期限先物取引所",
  "Hyperliquid HIP-3 dex": "Hyperliquid HIP-3 DEX",

  // rates
  now: "現在",
  asset: "資産",
  "open interest": "建玉",
  spread: "スプレッド",
  "{asset} funding runs from {low} on {lowVenue} to {high} on {highVenue}: {gap} a year apart across {count} exchanges.":
    "{asset} の資金調達率は {lowVenue} の {low} から {highVenue} の {high} まで：{count}取引所の間で年率 {gap} の差があります。",
  previous: "前へ",
  "assets {from}–{to}": "資産 {from}–{to}",
  next: "次へ",
  "No asset has live markets on two or more venues right now.":
    "現在、2つ以上の取引所で稼働中の銘柄がある資産はありません。",
  Rates: "レート",
  "Funding APR for every asset across every perpetual exchange, in one grid.":
    "全資産・全無期限先物取引所の資金調達率（年率）を1つの表に。",
  "Every exchange's funding for the deepest assets at once. Positive means longs pay, so a short collects; an empty cell means that exchange has no market for the asset, not that funding is flat.":
    "流動性の高い資産について、全取引所の資金調達率を一覧できます。プラスはロングが支払い、ショートが受け取ることを意味します。空欄はその取引所にその資産の銘柄がないことを示し、資金調達率がゼロという意味ではありません。",

  // price gaps
  "{asset}: buy on {buyVenue} at {buyPrice}, sell on {sellVenue} at {sellPrice}. A {gap} bps gap at the top of the book.":
    "{asset}：{buyVenue} で {buyPrice} で買い、{sellVenue} で {sellPrice} で売り。板の最良気配で {gap} bps の差。",
  "Quotes seen {quoted}; the older leg's funding row fetched {fetched}":
    "気配の取得 {quoted}、古い方のレッグの資金調達データの取得 {fetched}",
  "No asset quotes a gap this wide right now. The median comparable asset sits near 1.6 bps, so try a lower floor.":
    "現在、これほど広い差を提示している資産はありません。比較可能な資産の中央値は約 1.6 bps なので、下限を下げてみてください。",
  "Highest bid against lowest ask, across two different exchanges":
    "異なる2つの取引所間の、最高買い気配と最安売り気配",
  "Gap, bps": "差（bps）",
  "The sell price less the buy price, in the asset's own price units":
    "売値から買値を引いた値（その資産の価格単位）",
  Basis: "ベーシス",
  "The smaller of the two resting sizes: what the gap is actually good for":
    "両側の板数量のうち小さい方：この差が実際に使える規模",
  "Good for": "利用可能量",
  "Buy price": "買値",
  "Buy at": "買い取引所",
  "Ask size": "売り板数量",
  "Sell price": "売値",
  "Sell at": "売り取引所",
  "Bid size": "買い板数量",
  "Exchanges quoting this asset that survived the mark-agreement check":
    "この資産を提示し、マーク価格の整合チェックを通過した取引所数",
  Quoted: "気配時刻",
  "Price gaps across exchanges": "取引所間の価格差",
  "Where one exchange's bid sits above another's ask.":
    "ある取引所の買い気配が、別の取引所の売り気配を上回っている箇所。",
  "Price gaps": "価格差",
  "For each asset, the cheapest exchange to buy and the dearest to sell, at the top of each book. These are <b>quotable gaps</b>, not fillable trades: nothing here reflects the book below level 1, the taker fees, or the two transfers a real position needs. The widest gaps sit on the thinnest books — when this was measured, 395 of 721 assets showed any gap at a median of 1.6 bps, while the leaders were good for as little as $3 of resting size.":
    "資産ごとに、各板の最良気配で最も安く買える取引所と最も高く売れる取引所を示します。これは<b>提示されている差</b>であって、約定できる取引ではありません。最良気配より下の板、テイカー手数料、実際のポジションに必要な2回の送金は一切反映していません。最も広い差は最も薄い板に現れます。計測時には 721 資産のうち 395 資産に差があり、その中央値は 1.6 bps でしたが、上位の資産の板数量はわずか $3 でした。",
  "Min gap, bps": "最小差（bps）",
  "Any, including 0.0": "指定なし（0.0 を含む）",
  "Min resting size": "最小板数量",
  Apply: "適用",
  "This venue's mark disagrees with the rest, so it is excluded from the gap":
    "この取引所のマーク価格は他と一致しないため、差の計算から除外しています",
  "Marked {ratio}× above this asset's deepest market, so it is a different instrument, not a price gap":
    "この資産の最も厚い銘柄よりマーク価格が {ratio}× 高いため、価格差ではなく別の商品です",
  "Marked {ratio}× below this asset's deepest market, so it is a different instrument, not a price gap":
    "この資産の最も厚い銘柄よりマーク価格が {ratio}× 低いため、価格差ではなく別の商品です",
  best: "最良",
  "This venue's own bid-ask spread, which a taker crosses on entry and again on exit":
    "この取引所自身の売買スプレッド。テイカーはエントリー時と決済時にそれぞれこれを支払います",
  "This venue's funding row has not been refreshed within the freshness window, so its mark is withheld rather than shown stale — the quote beside it is live":
    "この取引所の資金調達データが有効期間内に更新されていないため、古い値を出さずにマーク価格を非表示にしています。隣の気配はリアルタイムです",
  "Quote seen {quoted}; funding row fetched {fetched}":
    "気配の取得 {quoted}、資金調達データの取得 {fetched}",
  "Every pair": "全ペア",
  "One row per direction: buy at the first exchange, sell at the second. The widest gap is often not the one to take — a narrower pair can rest far more size behind it, and most directions lose outright.":
    "方向ごとに1行：1つ目の取引所で買い、2つ目で売ります。最も広い差が狙うべきものとは限りません。より狭いペアの方がはるかに多くの数量が板にあることがあり、ほとんどの方向はそのままでは損失になります。",
  "The smaller of the buying side's ask size and the selling side's bid size — what this direction is good for":
    "買い側の売り板数量と売り側の買い板数量のうち小さい方。この方向で使える規模です",
  "No two exchanges quote {asset} in a way that can be compared right now.":
    "現在、{asset} の気配を比較できる取引所の組み合わせはありません。",
  "Buying on {buy} and selling on {sell} quotes {gap}, though one side's resting size is unknown.":
    "{buy} で買い {sell} で売ると {gap} の差ですが、片側の板数量は不明です。",
  "Buying on {buy} and selling on {sell} quotes {gap}, good for about {size}.":
    "{buy} で買い {sell} で売ると {gap} の差で、約 {size} まで使えます。",
  "That is a quote at the size shown, not a fillable trade: it is before fees, before the book below level 1, and before the transfer between two exchanges.":
    "これは表示数量での気配であり、約定できる取引ではありません。手数料、最良気配より下の板、2つの取引所間の送金は考慮していません。",
  Status: "ステータス",
  "{count} venue is shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "{count}取引所はグレー表示で、差の計算から除外しています：{venues}。マーク価格が、建玉で見たこの資産の最も厚い銘柄と10%以上ずれており、価格差ではなく、サイズや名称の異なる商品であることを示します。このチェックにより、1375× の不一致が 13,660,780 bps の機会として公開されるのを防いでいます。それぞれの理由は{status}ページに記載しています。",
  "{count} venues are shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "{count}取引所はグレー表示で、差の計算から除外しています：{venues}。マーク価格が、建玉で見たこの資産の最も厚い銘柄と10%以上ずれており、価格差ではなく、サイズや名称の異なる商品であることを示します。このチェックにより、1375× の不一致が 13,660,780 bps の機会として公開されるのを防いでいます。それぞれの理由は{status}ページに記載しています。",
  "{asset} price gaps by exchange": "{asset} の取引所別価格差",
  "{asset} best bid and ask on every exchange that quotes it, with the size resting at each.":
    "{asset} を提示している全取引所の最良買い気配・最良売り気配と、それぞれの板数量。",
  "Every exchange": "全取引所",
  "Best bid": "最良買い気配",
  "Best ask": "最良売り気配",
  "The venue's own bid-ask spread in basis points": "この取引所自身の売買スプレッド（bps）",
  "Own spread": "自スプレッド",
  Mark: "マーク価格",
  "Sizes are the money resting at the very top of each book, converted to USD because the three venues that publish depth count it differently — Gate in contracts, OKX in contracts against <code>ctVal</code>, Bybit in base coin. Reading those raw, side by side, is a 10,000× error.":
    "数量は各板の最良気配に置かれている金額で、USD に換算しています。板の厚みを公表している3つの取引所で数え方が異なるためです。Gate は契約数、OKX は契約数に <code>ctVal</code> を掛けたもの、Bybit は基軸通貨建て。生の値をそのまま並べて読むと 10,000× の誤差になります。",

  // one asset
  "Best pair: long on {long} at {longApr}, short on {short} at {shortApr}, a {spread} spread per year.":
    "最良ペア：{long} でロング（{longApr}）、{short} でショート（{shortApr}）、年率スプレッド {spread}。",
  "Only markets with at least {minOi} open interest are paired.":
    "建玉が {minOi} 以上の銘柄だけでペアを組みます。",
  "Funding only, before trading fees: none were entered.":
    "資金調達料のみ、取引手数料控除前（手数料が未入力のため）。",
  "Only one exchange lists it right now, so there's no cross-exchange pair.":
    "現在1つの取引所にしか上場していないため、取引所間のペアはありません。",
  "No two exchanges have at least {minOi} open interest in it, so there's no pair to show.":
    "建玉が {minOi} 以上の取引所が2つないため、表示できるペアはありません。",
  "{asset} funding rates by exchange": "{asset} の取引所別資金調達率",
  "{asset} perpetual funding rates across {count} exchanges, with the widest long/short spread.":
    "{count}取引所の {asset} 無期限先物の資金調達率と、最大のロング/ショートスプレッド。",
  "Funding by exchange": "取引所別の資金調達率",
  "{markets} live markets on {venues} exchanges.": "{venues}取引所で{markets}銘柄が稼働中。",
  "{asset} funding across {count} exchanges: long {long} at {longApr}, short {short} at {shortApr}. A {spread} spread a year on one coin.":
    "{count}取引所の {asset} 資金調達率：{long} でロング（{longApr}）、{short} でショート（{shortApr}）。1つのコインで年率 {spread} のスプレッド。",
  "Backtest this pair": "このペアをバックテスト",
  "long {long} · short {short} · {spread} a year, replayed on settled funding":
    "ロング {long} · ショート {short} · 年率 {spread}、精算済み資金調達料でリプレイ",
  "24h settled": "24時間精算額",
  "How often this market held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "30日間でこの銘柄が資金調達率の向きを維持した頻度。0.50 はコイントスと同じ、0.88 は1か月で取り得る最高値です",
  "Last 7 charging days against the days before them, in APR points. Up means funding is widening in the direction it already had":
    "直近7日の資金調達料発生日とそれ以前の日の比較（年率ポイント）。上向きは、資金調達率がもとの向きに拡大していることを示します",
  "30d trend": "30日トレンド",

  // pair backtest
  "capital {amount} — {venue} will not open a position above {max} on {symbol}":
    "必要資金 {amount} — {venue} は {symbol} で {max} を超えるポジションを建てられません",
  "capital {amount} across both legs at {leverage}":
    "両レッグで必要資金 {amount}（レバレッジ {leverage}）",
  "capital {amount} across both legs, unleveraged": "両レッグで必要資金 {amount}（レバレッジなし）",
  "capital at least {amount} across both legs — {leverage} is the small-size maximum":
    "両レッグで必要資金 {amount} 以上 — {leverage} は小口時の最大レバレッジ",
  "capital {amount} across both legs at {leverage} (small size)":
    "両レッグで必要資金 {amount}（レバレッジ {leverage}、小口）",
  "Cumulative funding reaches {amount} after {days} days":
    "{days}日後に累計資金調達料が {amount} に到達",
  "Cumulative funding on {size} per leg · {from} to {to}":
    "各レッグ {size} の累計資金調達料 · {from} 〜 {to}",
  "Taker fee in basis points, per fill. Both legs must be filled in before costs are charged.":
    "約定ごとのテイカー手数料（bps）。両レッグとも入力すると手数料が計算されます。",
  "blank = ignore": "空欄 = 無視",
  Window: "期間",
  "Long on": "ロング取引所",
  "Short on": "ショート取引所",
  "Size per leg": "各レッグのサイズ",
  "Long taker fee": "ロングのテイカー手数料",
  "Short taker fee": "ショートのテイカー手数料",
  "Run backtest": "バックテストを実行",
  "swap legs": "レッグを入れ替え",
  "What entering and exiting would cost at each exchange's top of book":
    "各取引所の最良気配でエントリー・決済した場合のコスト",
  "price gap": "価格差",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, before fees. Replayed from settled funding:":
    "{asset} の資金調達率キャリー、{long} でロング / {short} でショート：直近{span}、各レッグ {size} で {net}（手数料控除前）。精算済み資金調達料からのリプレイ：",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, after fees. Replayed from settled funding:":
    "{asset} の資金調達率キャリー、{long} でロング / {short} でショート：直近{span}、各レッグ {size} で {net}（手数料控除後）。精算済み資金調達料からのリプレイ：",
  "Share on X": "X でシェア",
  "opens a post with this result and a link back to it": "この結果とリンクを入れた投稿を開きます",
  "after costs {net} on {fees} of fees": "手数料 {fees} 控除後 {net}",
  "never repays the fees at this rate": "このレートでは手数料を回収できません",
  "fees repay in {days}": "{days}で手数料を回収",
  "under a day": "1日未満",
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
  "best day {amount} {date}": "最良日 {amount}（{date}）",
  "worst day {amount} {date}": "最悪日 {amount}（{date}）",
  "The largest fall in cumulative funding from a previous high, before costs":
    "累計資金調達料の直近高値からの最大下落（コスト控除前）",
  "max drawdown {amount}": "最大ドローダウン {amount}",
  "{days}d avg {apr}": "{days}日平均 {apr}",
  "now {apr}, {average}, every {interval}": "現在 {apr}、{average}、{interval} ごとに精算",
  "now {apr}, every {interval}": "現在 {apr}、{interval} ごとに精算",
  "net funding over the last {span} · {apr} annualized": "直近{span}の純資金調達料 · 年率 {apr}",
  "Long {venue}": "ロング {venue}",
  "{n} settlements": "{n}回の精算",
  "Short {venue}": "ショート {venue}",
  "win rate {value} of {days} days": "{days}日間の勝率 {value}",
  "average {value} a day": "1日平均 {value}",
  "Missed settlements: {long} on {longVenue}, {short} on {shortVenue}. A gap is reported rather than counted as zero, so this total covers only the settlements actually recorded.":
    "精算の欠損：{longVenue} で {long}回、{shortVenue} で {short}回。欠損はゼロとして数えずに報告しているため、この合計は実際に記録された精算のみを対象としています。",
  "Only {have} of the {asked} days asked for have stored settlements. The annualized figure still divides by the whole window, so it reads low. The daily rollup keeps 70 days, and history is still filling on some venues.":
    "指定された {asked}日のうち、保存済みの精算があるのは {have}日だけです。年率は期間全体で割っているため低めに出ます。日次集計の保存期間は70日で、一部の取引所では履歴がまだ蓄積中です。",
  "Funding only, on a position kept at {size} per leg. Trading fees are excluded because none were given: taker fees depend on your own volume tier and discounts, so fill in both legs' fees above to see this net of costs. Price moves between settlements aren't modelled either, because venue funding history gives a rate and a time, and almost never a mark price.":
    "資金調達料のみ、各レッグ {size} のポジションを維持した場合。手数料が入力されていないため取引手数料は含みません。テイカー手数料はご自身の取引量ランクや割引によって変わるため、上で両レッグの手数料を入力するとコスト控除後の値が表示されます。精算と精算の間の価格変動もモデル化していません。取引所の資金調達履歴にはレートと時刻しかなく、マーク価格はほとんど含まれないためです。",
  "Net of the fees you entered, on a position kept at {size} per leg: {long} bps long and {short} bps short, charged on four fills — entry and exit on both legs. Opening and closing once is assumed; rolling the position would cost this again each time. Price moves between settlements still aren't modelled, because venue funding history gives a rate and a time, and almost never a mark price.":
    "入力された手数料を控除済み、各レッグ {size} のポジションを維持した場合：ロング {long} bps、ショート {short} bps を、両レッグのエントリーと決済にあたる4回の約定に適用。建てて決済するのは1回と仮定しており、ポジションを乗り換えるたびに同じコストが再びかかります。精算と精算の間の価格変動はやはりモデル化していません。取引所の資金調達履歴にはレートと時刻しかなく、マーク価格はほとんど含まれないためです。",
  "Only one exchange lists {asset} right now, so there's no pair to hold.":
    "現在 {asset} は1つの取引所にしか上場していないため、組めるペアはありません。",
  "Pick two exchanges to hold against each other.": "互いにヘッジする2つの取引所を選んでください。",
  "{asset} funding carry backtest": "{asset} 資金調達率キャリーのバックテスト",
  "What holding {asset} long on one exchange and short on another would have paid in funding.":
    "ある取引所で {asset} をロング、別の取引所でショートしていたら、資金調達料でいくら得られたか。",
  backtest: "バックテスト",
  "{asset} carry": "{asset} キャリー",
  "Every exchange's funding over one window, and what the two legs you pick actually settled, summed per UTC day. Windows are whole calendar days ending today, and the figures refresh hourly.":
    "期間内の全取引所の資金調達率と、選んだ2つのレッグで実際に精算された額（UTC の日ごとに合計）。期間は今日までの暦日単位で、数値は1時間ごとに更新されます。",

  // errors
  "Too many requests": "リクエストが多すぎます",
  "Too many backtests from this address.": "このアドレスからのバックテストが多すぎます。",
  "That is more backtests than one address may run in a minute. Wait a moment and try again. Results already computed are served from the cache and are never limited, so a combination someone has run before still loads immediately.":
    "1つのアドレスが1分間に実行できるバックテストの回数を超えました。少し待ってから再度お試しください。計算済みの結果はキャッシュから返され制限されないため、誰かが一度実行した組み合わせはすぐに表示されます。",
  "Back to the screener": "スクリーナーに戻る",
  "Not found": "見つかりません",
  "Page not found.": "ページが見つかりません。",
  "Nothing lives at {path}.": "{path} には何もありません。",
  "See today's widest spreads": "今日の最大スプレッドを見る",
  "A runner sprinting": "全力疾走するランナー",
  "Data center busy": "データセンター混雑中",
  "The data center is too busy and a runner is on it. Try again later.":
    "データセンターが混雑しており、ランナーが対応中です。しばらくしてから再度お試しください。",
  "The data center is getting too busy and is currently sprinting in circles":
    "データセンターは大混雑で、ただいまぐるぐる全力疾走中です",
  "Every server is screaming, the funding rates are on fire, and one intern is running the whole thing on foot. Go touch grass and try again later.":
    "サーバーは悲鳴を上げ、資金調達率は燃え上がり、インターン1人が全部を走って回しています。外の空気でも吸って、しばらくしてからまたどうぞ。",
  "Try again": "再試行",
  // pages.ts invertedMark: an FX leg quoted the other way round (migration 041).
  "short this contract": "この銘柄をショート",
  "long this contract": "この銘柄をロング",
  "sell this contract": "この銘柄を売る",
  "buy this contract": "この銘柄を買う",
  "{symbol} quotes this pair the other way round, so this side of the pair is the opposite side of that contract. Its price is shown inverted and its funding with the sign flipped, in the pair's terms.":
    "{symbol} はこの通貨ペアを逆向きに建てているため、ペアのこちら側はその銘柄の反対側にあたります。価格は逆数、資金調達率は符号を反転し、どちらもペア基準で表示しています。",
  Now: "現在",
  "Payback, days": "回収日数",
  Long: "ロング",
  Short: "ショート",
  "7d {apr}": "7日 {apr}",
  "Where to hold the long side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "ロングを持つ場所：取引所と現在の資金調達率。その下に銘柄、精算間隔、建玉、7日間の資金調達率",
  "Where to hold the short side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "ショートを持つ場所：取引所と現在の資金調達率。その下に銘柄、精算間隔、建玉、7日間の資金調達率",
  "Days of the {days}-day spread it takes to repay {bps} bps of fees: a taker fill in and out of both legs, at public retail rates":
    "{days}日間の差で {bps} bps の手数料を回収するまでの日数：両レッグとも建玉と決済をテイカーで1回ずつ、公開の一般手数料で",
  "No {days} days of settlements yet, so this is from the spread now: days to repay {bps} bps of fees, a taker fill in and out of both legs, at public retail rates":
    "{days}日分の精算がまだないため現在の差から計算：{bps} bps の手数料を回収するまでの日数、両レッグとも建玉と決済をテイカーで1回ずつ、公開の一般手数料で",
  "per {unit}": "{unit}あたり",
  "Days of funding it takes to repay the fees of opening and closing both legs, at public retail taker rates. From the {days}-day spread; dimmed where there is only the spread now":
    "公開されている一般のテイカー手数料で、両レッグの建玉と決済の手数料を資金調達で回収するまでの日数。{days}日間の差から計算し、現在の差しかない場合は薄く表示",
  "The funding spread now: short leg's rate minus long leg's":
    "現在の資金調達率の差：ショート側の率からロング側の率を引いた値",
  "The same two markets' spread, averaged over the settlements of the last {days} days":
    "同じ2銘柄の差を直近{days}日間の精算で平均した値",
  "dollars, or 250k, 1.5m": "ドル、または 250k、1.5m",
  "Delete preset": "プリセットを削除",
  "No presets yet.": "プリセットはまだありません。",
  Presets: "プリセット",
  "Preset name": "プリセット名",
  "Preset name…": "プリセット名…",
  Save: "保存",
  "Clear all": "すべて解除",
  "Select all": "すべて選択",
  "{n} selected": "{n} 選択中",
  Filters: "フィルター",
  "Asset class": "資産クラス",
  TradFi: "伝統的金融",
  "Spread now (APR %)": "現在の差（年率 %）",
  "Both legs settle at this interval": "両レッグともこの間隔で精算",
  "Funding interval": "資金調達の間隔",
  "No USDT leg against a USDC one": "USDT のレッグと USDC のレッグを組まない",
  "Distressed and delisting markets": "経営難・上場廃止予定の銘柄",
  "Reset all": "すべてリセット",
  Steadiness: "安定度",
  "Funding steadiness": "資金調達の安定度",
  "How often a leg's funding kept its direction over the last 30 days: the dot beside each exchange in the Long and Short columns. The Stability column is the weaker leg's score.":
    "過去30日間にレッグの資金調達率が方向を保った頻度：ロング列とショート列の各取引所の前にある点。安定性の列は弱い方のレッグのスコアです。",
  "Holds its direction almost every day. Income you can plan on.":
    "ほぼ毎日方向を保つ。見通しの立つ収入。",
  "Flips now and then. Usable for a carry, but size for the days it pays the other way.":
    "ときどき反転する。キャリーには使えるが、逆に支払う日を考えてサイズを決める。",
  "Flips often. Today's rate says little about next week's, and a backtest of it says less.":
    "頻繁に反転する。今日の率は来週についてほとんど何も語らず、そのバックテストはさらに語らない。",
  "Scored by direction, not by the coefficient of variation: that explodes whenever the average rate sits near zero. 0.50 is a coin flip; 0.88 is the most a full month can score.":
    "変動係数ではなく方向で評価：平均の率がゼロ付近だと変動係数は発散するため。0.50 はコイン投げ、0.88 は1か月で取り得る最高値です。",
  "Search asset": "銘柄を検索",
  "Search asset…": "銘柄を検索…",
  Period: "期間",
  "Rate unit": "率の単位",
  Day: "日",
  "No settled funding to score yet": "評価できる精算済みの資金調達がまだありません",
  "Funding held its direction on {days} of its charging days in the last 30: {band}":
    "過去30日のうち {days} の課金日で方向を保った：{band}",
  erratic: "不安定",
  mixed: "中程度",
  steady: "安定",
  Chart: "チャート",
  "Running the backtest…": "バックテストを実行中…",
  "pick one": "選択してください",
  "A price-convergence pair across two exchanges.": "2つの取引所間の価格収束ペア。",
  "All quotes": "すべての気配",
  Average: "平均",
  "Best bid / ask": "最良買気配 / 売気配",
  "Bid-ask, both books": "売買スプレッド（両方の板）",
  "Breakeven move {pct}": "損益分岐の変動 {pct}",
  "Dollars resting at the best bid and the best ask": "最良買気配と最良売気配に並ぶドル額",
  "Each hour's average mark on the two exchanges. Where a venue publishes no mark, its index stands in.":
    "2つの取引所の1時間ごとの平均マーク価格。マーク価格を公開しない取引所はインデックス価格で代用。",
  "Entry at the top of the book": "板の最良気配でのエントリー",
  "Every time in the window the spread rose to at least today's width, the hours until it next fell to the window's median. Hourly averages, so nothing shorter than an hour is seen, and the past is not a promise.":
    "期間内でスプレッドが今日の幅以上に広がるたびに、次に期間の中央値まで戻るまでの時間。1時間平均のため1時間未満の動きは見えず、過去は将来を約束しません。",
  "Exit target: the window's median spread, {median}. Full convergence to zero is rare, and waiting for it usually makes no sense.":
    "エグジット目標：期間の中央値スプレッド {median}。ゼロまでの完全収束はまれで、待つ意味はたいていありません。",
  "Fees, four taker fills": "手数料（テイカー約定4回）",
  "From {n} comparable episodes in the last {window}; {open} had not closed by the end.":
    "直近 {window} の比較可能な {n} 回の局面から。うち {open} 回は期間終了時点で閉じていません。",
  "Funding, est. {hold} hold": "資金調達（保有 {hold} 想定）",
  Gross: "粗利益",
  "Hold time, from history": "保有時間（過去から推定）",
  "Hover the chart to read every line at one hour.":
    "チャートにカーソルを合わせると、ある1時間の各線の値を読めます。",
  "If the spread closes from where it is now to each target. Fees are four taker fills, in and out of both legs. The books are each exchange's own bid-ask, crossed half on the way in and half on the way out, at the top of the book only. Funding is the short leg's rate less the long leg's over the hold, which can pay or cost.":
    "スプレッドが現在から各目標まで縮小した場合。手数料は両レッグの建玉と決済で計4回のテイカー約定。板コストは各取引所の売買スプレッドを、エントリーとエグジットで半分ずつ、最良気配のみで計算。資金調達は保有期間中のショート側の率からロング側の率を引いたもので、受け取りにも支払いにもなります。",
  "If the spread closes to": "スプレッドの縮小先",
  "Long leg · {venue}": "ロングレッグ · {venue}",
  "Long the exchange where the asset is cheaper, short the one where it is dearer, and close when the two prices meet. Price moves cancel between the legs; what is left is the gap closing, less fees, the books and funding. Marks are the exchanges' own fair prices, not fills, and the history is hourly averages.":
    "資産が安い取引所でロング、高い取引所でショートし、2つの価格が一致したら決済します。価格変動はレッグ間で相殺され、残るのは差の縮小から手数料・板・資金調達を引いたもの。マーク価格は各取引所の公正価格で約定価格ではなく、履歴は1時間平均です。",
  "Mark prices, hourly": "マーク価格（1時間ごと）",
  Median: "中央値",
  "Not verified for this exchange: the site's retail assumption of {bps} bps":
    "この取引所は未確認：サイトの一般向け想定 {bps} bps",
  "Off the market median": "市場中央値からの乖離",
  "One leg was listed recently or reported unevenly. The spread now is more trustworthy than the window's statistics.":
    "一方のレッグが最近上場したか、報告が不規則でした。現在のスプレッドのほうが期間の統計より信頼できます。",
  "Over the window's hours in which both legs reported a price, from each hour's average mark.":
    "期間内で両レッグが価格を報告した時間について、各時間の平均マーク価格から算出。",
  "Own bid-ask": "自板の売買スプレッド",
  "Price history is unavailable right now. The live figures below are unaffected.":
    "価格履歴は現在利用できません。以下のリアルタイムの数値には影響ありません。",
  "Price spread, hourly": "価格スプレッド（1時間ごと）",
  "Profit calculator": "利益計算",
  Range: "レンジ",
  "Seen {age}": "{age} に確認",
  "Short leg · {venue}": "ショートレッグ · {venue}",
  "Sparse history ({share}% of expected samples): statistics may be unreliable.":
    "履歴がまばら（想定サンプルの {share}%）：統計は信頼できない可能性があります。",
  "Spread now (mark)": "現在のスプレッド（マーク）",
  "Spread statistics": "スプレッド統計",
  "Std dev": "標準偏差",
  "Swap legs": "レッグを入れ替え",
  "Taker fee": "テイカー手数料",
  "The exchange's published standard taker fee": "取引所が公表する標準テイカー手数料",
  "The price gap between {long} and {short} for {asset}: now, after costs, and over its history.":
    "{asset} の {long} と {short} の価格差：現在、コスト控除後、そして過去の推移。",
  "The short leg is not the dearer one right now, so there is no gap to close in this direction.":
    "現在ショート側の方が高いわけではないため、この方向では縮まる差がありません。",
  "The short leg's hourly mark less the long leg's, as a share of the long leg's. The dashed lines are the spread now and the window's median.":
    "ショート側の1時間ごとのマーク価格からロング側を引き、ロング側に対する割合で表示。破線は現在のスプレッドと期間の中央値。",
  "The short leg's mark less the long leg's, as a share of the long leg's. Marks are each exchange's fair price, not a price anyone traded at; the entry below is what the books offer.":
    "ショート側のマーク価格からロング側を引き、ロング側に対する割合で表示。マーク価格は各取引所の公正価格で、誰かが約定した価格ではありません。下のエントリーが板の提示価格です。",
  "The spread is already at or below its median for the window ({median}): nothing to wait for.":
    "スプレッドはすでに期間の中央値（{median}）以下です：待つものはありません。",
  "This leg's mark against the median mark of every exchange quoting the asset":
    "このレッグのマーク価格と、資産を提示する全取引所のマーク価格の中央値との比較",
  "This pair: long {long}, short {short}": "このペア：{long} でロング、{short} でショート",
  Ticker: "ティッカー",
  "Too few comparable episodes in the last {window} to estimate how long this takes. Try a longer window.":
    "直近 {window} の比較可能な局面が少なすぎて、所要時間を推定できません。より長い期間を試してください。",
  "Top of book": "最良気配の数量",
  "Trade long · {venue}": "ロングで取引 · {venue}",
  "Trade short · {venue}": "ショートで取引 · {venue}",
  "Window {window} · {n} hours of {expected}": "期間 {window} · {expected} 時間中 {n} 時間",
  "buying {venue}'s ask, selling {other}'s bid": "{venue} の売気配で買い、{other} の買気配で売る",
  details: "詳細",
  "full convergence pays {times}× the round trip": "完全収束で往復コストの {times} 倍",
  "long {long} · short {short}": "ロング {long} · ショート {short}",
  "long {long} · short {short}, good for {size}; deeper fills cost more and are not shown":
    "ロング {long} · ショート {short}、約 {size} まで約定可能。より深い約定はコストが高く、ここには表示しません",
  "market median {price} · long {long} · short {short}":
    "市場中央値 {price} · ロング {long} · ショート {short}",
  median: "中央値",
  pair: "ペア",
  "seen {long} / {short}": "確認 {long} / {short}",
  "sized at {size} a leg": "1レッグ {size}",
  "the book is thinner than this size": "板はこのサイズより薄い",
  "thin book: only {size} rests at those prices": "板が薄い：その価格には {size} しかありません",
  "typical time to close (middle half {from} to {to})":
    "典型的な解消までの時間（中央の半分は {from}〜{to}）",
  "wider than {share}% of the last {window}'s hours": "直近 {window} の {share}% の時間より広い",
  "{asset} convergence trade": "{asset} 収束トレード",
  "{asset} convergence trade: long {long}, short {short}":
    "{asset} 収束トレード：{long} でロング、{short} でショート",
  "{asset} · convergence trade": "{asset} · 収束トレード",
  "{long} bps on the long leg and {short} bps on the short, in and out":
    "ロング側 {long} bps、ショート側 {short} bps、建玉と決済で",
  "{n}th percentile": "{n} パーセンタイル",
  "{venues} has no comparable {asset} book right now. Pick another exchange above.":
    "{venues} には現在比較可能な {asset} の板がありません。上で別の取引所を選んでください。",
  "~1h": "約1時間",
  "~{n} days": "約{n}日",
  "~{n}h": "約{n}時間",
};
