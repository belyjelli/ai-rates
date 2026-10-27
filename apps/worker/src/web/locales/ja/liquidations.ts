/**
 * Japanese for web/liquidations.ts: the /liquidations map, the priced grid and the
 * longs-vs-shorts chart. Glossary and style: ./index.ts.
 *
 * Window codes ("24h", "7d") are left as written, as interval figures are elsewhere on the site: they
 * are units in a control strip and in its URLs, not words.
 *
 * Terms: force-closed 強制清算 (the glossary's 清算, made explicit), asset 銘柄, window 期間, price
 * band 価格帯, odds 確率, theory 仮説, typical move 標準的な値動き, pending (modeled) liquidations
 * 未発動の清算（推定）, cross / isolated margin クロス / 分離.
 */

import type { Catalog } from "../../i18n";

export const liquidations: Catalog = {
  // Axis dates.
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

  // Controls and legend.
  Window: "期間",
  Venue: "取引所",
  all: "すべて",
  Cell: "セル",
  "longs closed": "ロング清算",
  "shorts closed": "ショート清算",
  "Band width": "価格帯の幅",
  Asset: "銘柄",
  fit: "自動",

  // The map tab.
  "{usd} across {count} liquidation — {long} long, {short} short":
    "{usd}、清算 {count} 件 — ロング {long}、ショート {short}",
  "{usd} across {count} liquidations — {long} long, {short} short":
    "{usd}、清算 {count} 件 — ロング {long}、ショート {short}",
  "This column is still filling": "この列はまだ集計中です",
  "<b>{usd}</b> · {events} liquidations · {markets} markets":
    "<b>{usd}</b> · 清算 {events} 件 · {markets} 銘柄",
  "no liquidations in this window": "この期間に清算はありません",
  "other markets": "その他の銘柄",
  total: "合計",
  "No liquidations recorded in the last {window}. Only the venues that publish a feed the collector reads appear here, so a quiet window is not a quiet market.":
    "直近 {window} に記録された清算はありません。ここに表示されるのは、コレクターが読み取れるフィードを公開している取引所だけです。清算がない期間でも、市場が静かだったとは限りません。",
  "Columns are {hours}-hour buckets in {zone}, newest on the right; the last one is still filling.":
    "各列は {zone} での {hours} 時間ごとの区間で、右端が最新です。最後の列はまだ集計中です。",
  "Newest liquidation {age}.": "最新の清算：{age}。",
  "Rows are the {count} busiest assets by notional across every feed, and the rest are summed into “other markets”, so the totals below the grid are real totals and add up.":
    "各行は全フィードの想定元本で上位 {count} の銘柄で、残りは「その他の銘柄」にまとめています。そのため表の下の合計は実際の合計で、足し合わせると一致します。",
  "Any row opens that asset at the price it died at.":
    "行をクリックすると、その銘柄を清算された価格別に表示します。",

  // The priced tab.
  "<b>{usd}</b> · {events} liquidations · {long} long / {short} short":
    "<b>{usd}</b> · 清算 {events} 件 · ロング {long} / ショート {short}",
  "nothing force-closed here in this window": "この期間、ここで強制清算はありません",
  "Fill price": "約定価格",
  "No live market for {asset} is publishing a mark, so there is no price to band liquidations against.":
    "{asset} のマーク価格を公開している稼働中の銘柄がないため、清算を価格帯に分ける基準価格がありません。",
  "No liquidations recorded for {asset} in the last {window}. Only the venues publishing a feed the collector reads appear here.":
    "直近 {window} に記録された {asset} の清算はありません。ここに表示されるのは、コレクターが読み取れるフィードを公開している取引所だけです。",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark; the outer rows hold everything further out.":
    "<b>{asset}</b> をマーク価格を中心に {pct}% 刻みの価格帯で表示しています。両端の行には、それより外側のすべてが入ります。",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark, fitted to where this asset's closes actually landed; the outer rows hold everything further out.":
    "<b>{asset}</b> をマーク価格を中心に {pct}% 刻みの価格帯で表示しています（この銘柄で実際に清算された位置に合わせて自動調整）。両端の行には、それより外側のすべてが入ります。",
  "Banded from <b>{mark}</b>, the deepest market's mark — the same anchor the arbitrage guard uses, so both venues share rows.":
    "価格帯の基準は、建玉が最も大きい銘柄のマーク価格 <b>{mark}</b> です — アービトラージのチェックと同じ基準なので、両取引所で同じ行を共有します。",

  // The longs-vs-shorts tab and its chart.
  "Last {window}": "直近 {window}",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Longs took the beating.":
    "{asset} の直近 {window} の清算：ロング {long}、ショート {short} が強制清算され、計 {events} 件。ロングの損失が大きくなりました。",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Shorts took the beating.":
    "{asset} の直近 {window} の清算：ロング {long}、ショート {short} が強制清算され、計 {events} 件。ショートの損失が大きくなりました。",
  "{asset} longs vs shorts over time · {hours}-hour bars, {zone}":
    "{asset} のロングとショートの推移 · {hours}時間足、{zone}",
  "{asset} longs vs shorts over time · {minutes}-minute bars, {zone}":
    "{asset} のロングとショートの推移 · {minutes}分足、{zone}",
  "Longs closed": "ロング清算",
  "Shorts closed": "ショート清算",
  "Longs at risk, modeled · price falls <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "清算リスクのあるロング（推定）· 価格が <b>{pct}</b> 下落して {range} になると · 約 <b>{usd}</b> が清算されます",
  "Shorts at risk, modeled · price rises <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "清算リスクのあるショート（推定）· 価格が <b>{pct}</b> 上昇して {range} になると · 約 <b>{usd}</b> が清算されます",
  "Shorts at risk above": "上方のショートの清算リスク",
  "Longs at risk below": "下方のロングの清算リスク",
  "Modeled pending liquidations between {low} and {high}, around {mark}: about {shorts} of shorts above and {longs} of longs below":
    "{low} から {high} の間（現在 {mark}）の未発動の清算（推定）：上方にショート約 {shorts}、下方にロング約 {longs}",
  "Pending range": "未発動の範囲",
  "Zoom in": "拡大",
  "Columns are time, in your time zone ({zone}; click the clock at the top for UTC). Each is a {hours}-hour block named by its start hour. Where the day changes, the column shows date/hour (7/00 = the 7th at 00:00). The yellow column is the block in progress and still filling.":
    "列は時間で、お使いのタイムゾーン（{zone}。上部の時計をクリックすると UTC に切り替わります）で表示します。各列は {hours} 時間の区間で、開始時刻で示します。日付が変わる列は 日/時 で表示します（7/00 = 7日 00:00）。黄色の列は進行中の区間で、まだ集計中です。",
  "'All' is that price row's total over the whole window.":
    "「すべて」はその価格行の期間全体の合計です。",
  "{range}, still filling": "{range}、集計中",
  "This tab did not load.": "このタブを読み込めませんでした。",
  "Try again": "再試行",
  "Loading…": "読み込み中…",
  "Open this tab": "このタブを開く",
  "This tab has nothing to show right now.": "このタブには現在表示する内容がありません。",
  "Zoom out": "縮小",
  "shorts liquidate if price rises": "価格が上がるとショートが清算",
  "longs liquidate if price falls": "価格が下がるとロングが清算",
  "pending is modeled": "未発動分は推定",
  "pending by price band": "価格帯別の未発動の清算",
  "Modeled from open interest and leverage tiers, not reported by venues.":
    "建玉とレバレッジ段階から推定したもので、取引所の公表値ではありません。",
  Pending: "未発動",
  "Pending on": "未発動を表示",
  "Pending off": "未発動を隠す",
  "hover or tap a bar to read it": "バーにカーソルを合わせるかタップすると値を表示",
  "{asset} bars; arrow keys read one at a time": "{asset} のバー。矢印キーで1本ずつ確認できます",
  "{asset} longs closed above zero and shorts closed below, over the last {window}":
    "{asset} の直近 {window}：ゼロより上がロング清算、下がショート清算",
  "Longs closed above the line, shorts closed below, on the same linear scale. Hover a bar to read it beside the cursor; on a phone, tap and it reads in the line above the chart. The last bar is still filling.":
    "線より上がロング清算、下がショート清算で、同じ線形の目盛りです。バーにカーソルを合わせるとカーソルの横に値が表示されます。スマートフォンではタップすると、チャート上の行に表示されます。最後のバーはまだ集計中です。",
  "{usd} of longs closed between {band}": "{band} でロング {usd} が清算",
  "{usd} of shorts closed between {band}": "{band} でショート {usd} が清算",
  "Longs closed <b>{usd}</b> · {share}%": "ロング清算 <b>{usd}</b> · {share}%",
  "Shorts closed <b>{usd}</b> · {share}%": "ショート清算 <b>{usd}</b> · {share}%",
  All: "すべて",
  "Nothing was force-closed in {asset} in the last {window}, on either side.":
    "直近 {window}、{asset} ではロング・ショートとも強制清算はありませんでした。",
  "Showing <b>{asset}</b>, every exchange added together — the split by exchange is one tab along. Rows are the same {pct}% price bands, banded from <b>{mark}</b>. A long close is a forced SELL and a short close a forced BUY, so the heavier side is the one the move ran against. Any asset outside this list opens from a row on the map tab.":
    "<b>{asset}</b> を全取引所の合計で表示しています — 取引所別の内訳は隣のタブにあります。各行は <b>{mark}</b> を基準にした同じ {pct}% 刻みの価格帯です。ロングの清算は強制的な売り、ショートの清算は強制的な買いなので、多い側が値動きに逆らっていた側です。この一覧にない銘柄は、マップタブの行から開けます。",

  // The page.
  "Nothing has been force-closed in this window, so there is no asset to price.":
    "この期間に強制清算はないため、価格別に表示する銘柄がありません。",
  "Nothing has been force-closed in this window, so there is no asset to split.":
    "この期間に強制清算はないため、ロングとショートに分ける銘柄がありません。",
  "{first} and {last}": "{first} と {last}",
  ", ": "、",
  Liquidations: "清算",
  "Where positions were force-closed: by venue, asset and hour, and by the price level they died at.":
    "ポジションがどこで強制清算されたか：取引所・銘柄・時間帯別、そして清算された価格別に表示します。",
  "Where positions were force-closed, by exchange. Colour is the side that was closed — {longs}, {shorts} — and intensity is the money, on a log scale.":
    "取引所別の強制清算です。色は清算された側 — {longs}、{shorts} — を、濃さは金額を対数目盛りで表します。",
  "blue for longs": "青はロング",
  "red for shorts": "赤はショート",
  "No venue has reported a liquidation in this window.":
    "この期間に清算を報告した取引所はありません。",
  "This is {venues}, the one venue whose liquidation feed the collector reads — not the whole market.":
    "これは {venues}、つまりコレクターが清算フィードを読み取っている唯一の取引所のデータです — 市場全体ではありません。",
  "This is {venues}, the {count} venues whose liquidation feed the collector reads — not the whole market.":
    "これは {venues}、つまりコレクターが清算フィードを読み取っている {count} 取引所のデータです — 市場全体ではありません。",
  "By asset and hour": "銘柄・時間帯別",
  Assets: "銘柄",
  "Longs vs shorts": "ロング対ショート",
  "{asset} longs vs shorts": "{asset} ロング対ショート",
  Sides: "売買別",
  "By price level": "価格別",
  "{asset} price levels": "{asset} 価格別",
  Prices: "価格",
  "Updated {ago}.": "{ago}に更新。",

  // The odds tab.
  Odds: "確率",
  "{asset} odds": "{asset} 確率",
  "Nothing has been force-closed in this window, so there is no asset to size.":
    "この期間に強制清算はないため、値動きを見積もる銘柄がありません。",
  "4 hours": "4時間",
  "6 hours": "6時間",
  "1 day": "1日",
  "1 week": "1週間",
  Within: "期限",
  "Typical move (1 sigma)": "標準的な値動き（1σ）",
  "Closes higher than now": "現在より高く引ける",
  "Reaches the heaviest forced-close level": "強制清算額が最大の価格に到達",
  "Whichever of those two it reaches first": "その 2 つのうち先に到達する方",
  "The upper one first": "上側に先に到達",
  "The lower one first": "下側に先に到達",
  Neither: "どちらにも到達しない",
  "Reaches a move of": "次の値動きに到達",
  "{price} ({where}) · {usd} closed, {share} of the window":
    "{price}（{where}）· 清算 {usd}、期間全体の {share}",
  Theory: "仮説",
  "Reading now": "現在の値",
  Leans: "傾き",
  "Moves the odds?": "確率に反映？",
  up: "上昇",
  down: "下落",
  "Forced-close burst fades": "強制清算の集中は反転する",
  "Funding crowding fades": "資金調達率の偏りは反転する",
  "Stretch from the 50-hour average fades": "50 時間平均からの乖離は戻る",
  "Initiative vs absorption": "仕掛けと吸収",
  "Fear and greed": "恐怖と強欲",
  "Liquidation magnet": "清算マグネット",
  "Needs open positions by price level. The collector keeps closed ones only, so this cannot be read yet.":
    "価格別の未決済ポジションが必要です。コレクターは決済済みのものしか保存していないため、まだ読み取れません。",
  "Fewer than 5 forced closes in the last 4 hours: too thin to call a burst.":
    "直近 4 時間の強制清算が 5 件未満のため、集中と判断するには少なすぎます。",
  "Not enough data.": "データが不足しています。",
  "{longs} of the last 4 hours' forced closes were longs ({usd} in all)":
    "直近 4 時間の強制清算のうち {longs} がロング（合計 {usd}）",
  "{apr} a year funding, weighted by open interest": "建玉加重の資金調達率 年率 {apr}",
  "{sigma} bar-sigmas above its 50-hour average": "50 時間平均より足の σ で {sigma} 上",
  "{sigma} bar-sigmas below its 50-hour average": "50 時間平均より足の σ で {sigma} 下",
  "takers net buying {pct} of volume": "テイカーが出来高の {pct} を買い越し",
  "takers net selling {pct} of volume": "テイカーが出来高の {pct} を売り越し",
  "{flow}, price {change} over 4 hours": "{flow}、4 時間の価格変化 {change}",
  "{score} out of 100": "{score} / 100",
  "No. Not yet tested, so it carries no weight.":
    "いいえ。まだ検証していないため、重みはゼロです。",
  "No. Context only: its claim never leans.":
    "いいえ。参考情報のみで、方向を示す仮説ではありません。",
  "No. Cannot be computed.": "いいえ。計算できません。",
  "There is not yet enough price history for {asset} to size its moves, or no live market is publishing a mark. The odds need at least 12 hours of closes.":
    "{asset} の値動きを見積もるだけの価格履歴がまだないか、マーク価格を公開している稼働中の銘柄がありません。確率の計算には少なくとも 12 時間分の終値が必要です。",
  "These are the odds that <b>{asset}</b> reaches a price within each horizon, worked out from how far it has actually been moving: about {hourly} an hour over the last {hours} hours. They are not a forecast of direction.":
    "<b>{asset}</b> が各期限内にある価格に到達する確率です。実際の値動きの大きさ（直近 {hours} 時間で 1 時間あたり約 {hourly}）から計算しています。方向の予測ではありません。",
  "The levels are where the most dollars were force-closed in the last {window}. Those positions are gone, so a heavy level is somewhere price has been, not fuel waiting for it. The collector does not keep open positions by price, so the resting map a liquidation magnet needs cannot be built yet.":
    "これらの価格は、直近 {window} に最も多くの金額が強制清算された場所です。そのポジションはもう存在しないため、金額の大きい価格は価格が通過した場所であって、これから燃料になるものではありません。コレクターは価格別の未決済ポジションを保存していないため、清算マグネットに必要な分布図はまだ作れません。",
  "Real prices have fatter tails than this model assumes, so the far levels are reached more often than shown. Volatility is measured over the recent past and held constant.":
    "実際の価格はこのモデルの想定よりも裾が厚いため、遠い価格には表示よりも頻繁に到達します。ボラティリティは直近の期間で測定し、一定と仮定しています。",
  "Odds of reaching a level, from {asset}'s own volatility. They say how far it can go, not which way. The chance of closing higher stays at 50% until a theory below passes a test set in advance, after costs.":
    "{asset} 自身のボラティリティから求めた、ある価格に到達する確率です。どこまで動きうるかを示すもので、どちらに動くかは示しません。下の仮説のいずれかが、事前に定めたコスト控除後の検証に合格するまで、高く引ける確率は 50% のままです。",
  "Levels closer than the 4-hour typical move ({pct}) are left out, because price is already standing in them.":
    "4 時間の標準的な値動き（{pct}）より近い価格は、すでに価格がその範囲にあるため除外しています。",
  "No forced-close level lies beyond the 4-hour typical move":
    "4 時間の標準的な値動きより外側に強制清算の価格はありません",
  "What the liquidation theories read now": "清算に関する仮説の現在の値",
  "A reading that leans one way is a hypothesis, not a signal: none of these has been shown to beat the base rate. The first three are measured against a fade, the way their test was written down in advance, and a flat reading leans nowhere.":
    "一方向に傾いた値は仮説であり、シグナルではありません。どれもベースレートを上回ることは示されていません。最初の 3 つは、事前に定めた検証の通り反転を前提に測っており、横ばいの値はどちらにも傾きません。",
  // web/liquidations.ts: the whale map tab.
  "Nothing has been force-closed in this window, so there is no asset to map.":
    "この期間に強制清算はないため、マップに表示する銘柄がありません。",
  "Position size": "ポジションサイズ",
  "Price range": "価格範囲",
  "Whale map": "クジラマップ",
  "{asset} whale map": "{asset} クジラマップ",
  Whales: "クジラ",

  // web/whale-map.ts
  "mark {price}": "マーク価格 {price}",
  "{n} positions of {floor} or more · {longs} of longs, {shorts} of shorts · hover or tap a bar to read it":
    "{floor} 以上のポジション {n} 件 · ロング {longs}、ショート {shorts} · バーにカーソルを合わせるかタップすると値を表示",
  "Beyond ±{pct} of the mark, off the chart: {longs} of longs and {shorts} of shorts.":
    "マーク価格から ±{pct} より外側（チャート外）：ロング {longs}、ショート {shorts}。",
  "{asset} · whale positions by liquidation price · {venues}":
    "{asset} · 清算価格別のクジラのポジション · {venues}",
  "Longs liquidate": "ロング清算",
  "Shorts liquidate": "ショート清算",
  "Total to the mark": "マーク価格までの累計",
  "{asset} price bands; arrow keys read one at a time":
    "{asset} の価格帯。矢印キーで 1 つずつ読めます",
  "{asset} whale positions by the price they liquidate at":
    "{asset} のクジラのポジション（清算価格別）",
  "Every position here is one an exchange publishes for a named account: reported, not modeled. Only Hyperliquid, Lighter and dYdX publish every account's positions, and together they hold about a tenth of the open interest; Binance, OKX and the other centralized exchanges publish none, so they are not in this map.":
    "ここにあるポジションはすべて、取引所が特定のアカウントについて公開しているものです。推定ではなく実データです。すべてのアカウントのポジションを公開しているのは Hyperliquid、Lighter、dYdX だけで、3 つを合わせても建玉全体の約 1 割です。Binance、OKX などの中央集権型取引所は一切公開していないため、このマップには含まれません。",
  "Hyperliquid and Lighter report each position's liquidation price. dYdX does not, so its are computed from the account's own balance and positions with dYdX's maintenance margins, holding its other prices where they are; they are marked * in the table.":
    "Hyperliquid と Lighter は各ポジションの清算価格を公開しています。dYdX は公開していないため、アカウント自身の残高とポジションから dYdX の維持証拠金率で計算し、他の価格は現在のままと仮定しています。表では * を付けています。",
  "On Hyperliquid the collector watches the leaderboard's accounts worth $100k or more and any account it sees in a large trade, re-reading each every few minutes while it holds $1M or more and hourly while it holds $100k. On Lighter it follows the leaderboard's owners with $100k in the account or a $100k position, whose changes arrive as they happen. On dYdX it reads every account on the chain every five minutes. So the map covers the largest traders, not every account.":
    "Hyperliquid では、コレクターはリーダーボード上の資産 $100k 以上のアカウントと、大口約定で見つけたアカウントを監視し、$1M 以上を保有している間は数分ごとに、$100k の間は 1 時間ごとに読み直します。Lighter では、リーダーボード上で口座残高 $100k またはポジション $100k のアカウントを追跡し、変化はリアルタイムで届きます。dYdX では、チェーン上の全アカウントを 5 分ごとに読み取ります。そのため、このマップがカバーするのは最大級のトレーダーで、すべてのアカウントではありません。",
  "A cross-margin position's liquidation price moves with the rest of its account: its other positions' profit and loss, deposits and withdrawals. Each one is as of its account's last read, shown in the table. Bars are the money that liquidates in each price band, longs below the mark and shorts above; the lines add up everything between the mark and that price.":
    "クロスマージンのポジションの清算価格は、アカウントの他の部分（他のポジションの損益、入金と出金）に応じて動きます。各ポジションは、表に示したそのアカウントの最終取得時点のものです。バーは各価格帯で清算される金額で、ロングはマーク価格の下、ショートは上にあります。線はマーク価格からその価格までのすべてを累計したものです。",
  "The whale positions could not be read right now.": "現在、クジラのポジションを読み取れません。",
  "No position of {floor} or more in {asset} among the accounts watched.":
    "監視中のアカウントに、{asset} の {floor} 以上のポジションはありません。",
  "There are {n} of $100k or more: switch to $100k+.":
    "$100k 以上のポジションは {n} 件あります。$100k+ に切り替えてください。",
  "nearest at {price} ({pct})": "最も近いのは {price}（{pct}）",
  "none with a liquidation price": "清算価格のあるものはなし",
  "Whale longs": "クジラのロング",
  "{n} positions": "{n} ポジション",
  "Whale shorts": "クジラのショート",
  "Within 5% of the mark": "マーク価格から 5% 以内",
  "longs below / shorts above": "下にロング / 上にショート",
  Accounts: "アカウント",
  "read a median {age}": "取得時刻の中央値：{age}",
  "No live mark for {asset}, so the positions cannot be placed on a price axis.":
    "{asset} の稼働中のマーク価格がないため、ポジションを価格軸に配置できません。",
  long: "ロング",
  short: "ショート",
  "No liquidation price: the account's margin covers any move":
    "清算価格なし：アカウントの証拠金がどんな値動きにも耐えます",
  "dYdX publishes no liquidation price: computed from the account's balance and positions with dYdX's maintenance margins":
    "dYdX は清算価格を公開していません：アカウントの残高とポジションから dYdX の維持証拠金率で計算しています",
  "By venue:": "取引所別：",
  none: "なし",
  "{leverage}× isolated": "{leverage}× 分離",
  // Cross margin, not the chart cursor's crosshair (charts.ts's "cross").
  "{leverage}× cross": "{leverage}× クロス",
  "The {n} nearest to liquidation of {total}.": "{total} 件のうち、清算に最も近い {n} 件。",
  "Positions by distance to liquidation": "清算までの距離順のポジション",
  Trader: "トレーダー",
  Value: "評価額",
  Entry: "建値",
  "Liquidates at": "清算価格",
  "From the market's mark to the liquidation price": "その銘柄のマーク価格から清算価格までの距離",
  Leverage: "レバレッジ",
  Unrealized: "含み損益",
  "The whole account's value on its venue": "その取引所でのアカウント全体の評価額",
  Account: "口座",
  Read: "取得",
  // Before a link to the member login, inside the sentence below.
  "Log in": "ログイン",
  "Refreshes every 30 s. {login} to refresh every 10 s, with the nearest accounts re-read about every minute.":
    "30 秒ごとに更新。{login}すると 10 秒ごとに更新され、清算に最も近い口座は約 1 分ごとに再取得されます。",
  "Live for members: refreshes every 10 s, and the nearest accounts are re-read about every minute.":
    "会員ライブ：10 秒ごとに更新、清算に最も近い口座は約 1 分ごとに再取得されます。",
  Indexes: "指数",
  "Other stocks": "その他の株式",
  "Energy and other commodities": "エネルギー・その他商品",
  FX: "為替",
  "{long} long · {short} short": "ロング {long} · ショート {short}",
  "Pick an asset": "資産を選択",
  "Filter assets": "資産を絞り込む",
  Liquidated: "清算額",
  "Longs / shorts": "ロング / ショート",
  Events: "件数",
};
