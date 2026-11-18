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
  "axis squeezed above {usd}": "{usd} 超は縦軸を圧縮",
  "Modeled from 30 days of open interest and price on each market and its leverage limits, not reported by venues.":
    "各市場の30日間の建玉と価格、レバレッジ上限から推定したもので、取引所の公表値ではありません。",
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
  "Asset Timeline": "銘柄タイムライン",
  Timeline: "タイムライン",
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
  "{asset} liquidations": "{asset} の清算",
  "{asset} liquidations across exchanges: longs against shorts by the hour, the price levels positions were closed at, and where large open positions would be liquidated.":
    "取引所横断の {asset} 清算：1時間ごとのロング対ショート、ポジションが強制決済された価格帯、大口の未決済ポジションが清算される価格。",
  "All assets": "すべての銘柄",
  "{n} exchange": "{n} 取引所",
  "{n} asset": "{n}銘柄",
  "In the last 7 days": "過去7日間で",
  "In the last 48 hours": "過去48時間で",
  "In the last 24 hours": "過去24時間で",
  "{share} of it longs": "うち {share} がロング",
  "{share} of it shorts": "うち {share} がショート",
  "{window}, no {asset} position was force-closed on the exchanges whose liquidation feeds the collector reads.":
    "{window}、コレクターが清算フィードを読み取っている取引所では {asset} のポジションは強制決済されていません。",
  "{window}, {total} of {asset} positions were force-closed in {events} on {venues}, {sides}.":
    "{window}、{venues}で {asset} のポジション {total} が強制決済されました（{events}）。{sides}。",
  "The largest single one was a {usd} long on {venue} at {price}, {ago}.":
    "単独で最大は {venue} の {usd} のロングで、{price} で約定、{ago}。",
  "The largest single one was a {usd} short on {venue} at {price}, {ago}.":
    "単独で最大は {venue} の {usd} のショートで、{price} で約定、{ago}。",
  "Of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX, {longs} of longs would be liquidated within 5% below the price and {shorts} of shorts within 5% above.":
    "Hyperliquid、Lighter、dYdX で監視している $1M 以上のクジラのポジションのうち、価格の下 5% 以内で {longs} のロングが、上 5% 以内で {shorts} のショートが清算されます。",
  "{window}, {total} of positions were force-closed across {assets} on {venues}, {sides}.":
    "{window}、{venues}で {assets}のポジション {total} が強制決済されました。{sides}。",
  "The most liquidated: {list}.": "清算が最も多いのは：{list}。",
  "The largest single liquidation was a {usd} {asset} long on {venue} at {price} ({when} UTC).":
    "単独で最大の清算は {venue} の {usd} の {asset} ロングで、{price} で約定（UTC {when}）。",
  "The largest single liquidation was a {usd} {asset} short on {venue} at {price} ({when} UTC).":
    "単独で最大の清算は {venue} の {usd} の {asset} ショートで、{price} で約定（UTC {when}）。",
  Order: "並び順",
  "Largest first": "大きい順",
  "Newest first": "新しい順",
  "Smallest close": "最小額",
  "The largest liquidations could not be read right now.": "最大の清算を現在読み取れません。",
  "No single liquidation of {floor} or more in this window.":
    "この期間に {floor} 以上の清算はありません。",
  "Nothing has been force-closed in this window.": "この期間に強制決済はありません。",
  "The {n} newest liquidations of {floor} or more in this window.":
    "この期間の {floor} 以上の清算のうち新しい {n} 件。",
  "Every liquidation of {floor} or more in this window.": "この期間の {floor} 以上の清算すべて。",
  "The {n} largest single liquidations in this window.": "この期間で最大の清算 {n} 件。",
  "Every liquidation in this window, largest first.": "この期間の清算すべて、大きい順。",
  "The position's value at the fill price": "約定価格でのポジション価値",
  "Each row is one forced close as its exchange reported it: the side is the position that was closed, the size its value at the fill price. Times are in {zone}.":
    "各行は取引所が報告した強制決済1件です。サイドは決済されたポジション、サイズは約定価格での価値です。時刻は {zone}。",
  "{asset} largest liquidations": "{asset} 最大の清算",
  "Largest liquidations": "最大の清算",
  Largest: "最大",
  "None of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX would be liquidated within 5% of the price.":
    "Hyperliquid、Lighter、dYdX で監視している $1M 以上のクジラのポジションで、価格から 5% 以内に清算されるものはありません。",
  later: "後ほど",
  "A cascade is a burst in which one asset's liquidations piled up within minutes: consecutive minutes each running at {pace} times its 7-day average pace or more, with no more than {gap} quiet minutes between them, and at least an hour's worth of that average pace, and {floor}, in all. Every exchange whose liquidation feed the collector reads is counted; the venue choices on the other tabs do not narrow it.":
    "カスケードとは、ある銘柄の清算が数分のうちに集中したバーストです。各分の清算ペースが 7 日平均の {pace} 倍以上の分が続き、その間の静かな時間は {gap} 分以内、合計で平均ペースの 1 時間分以上かつ {floor} 以上のものを数えます。コレクターが清算フィードを読み取っているすべての取引所を合算し、他のタブの取引所の選択では絞り込みません。",
  "Prices are the asset's busiest market in 5-minute candles. Into it is the move from the last close before the cascade to the furthest the price went inside it: the low when mostly longs were closed, the high when mostly shorts were. 1h and 4h after run from the close at its end to the close an hour and four hours later, and say later until that candle has closed.":
    "価格はその銘柄で最も取引の多い市場の 5 分足です。「期間中」はカスケード開始前の最後の終値から、期間中に価格が最も動いた点まで：主にロングが清算された場合は安値、ショートの場合は高値です。「1 時間後」「4 時間後」は終了時の終値から 1 時間後・4 時間後の終値までで、その足が確定するまで「後ほど」と表示します。",
  "The cascades could not be read right now.": "カスケードを現在読み取れません。",
  "No cascade in {asset} in this window: no burst reached {pace} times its usual pace with an hour's worth of it. Its usual pace is {usd} a minute, the 7-day average.":
    "この期間に {asset} のカスケードはありません：平常ペースの {pace} 倍に達し、その 1 時間分に届いたバーストはありませんでした。平常ペースは 1 分あたり {usd}（7 日平均）です。",
  "none in this window": "この期間にはなし",
  "none an hour old yet": "1 時間経過したものはまだなし",
  "higher in {up} of {n}": "{n} 回中 {up} 回上昇",
  Cascades: "カスケード",
  "{usd} longs": "ロング {usd}",
  "{usd} shorts": "ショート {usd}",
  "An hour after long cascades": "ロングのカスケードの 1 時間後",
  "An hour after short cascades": "ショートのカスケードの 1 時間後",
  "Usual pace": "平常ペース",
  "a minute, the 7-day average": "1 分あたり、7 日平均",
  "{n} min": "{n} 分",
  "longs {share}": "ロング {share}",
  "shorts {share}": "ショート {share}",
  "Prices: {market} on {venue}, in 5-minute candles.": "価格：{venue} の {market}、5 分足。",
  "No price history for {asset}, so the moves are blank.":
    "{asset} の価格履歴がないため、値動きは空欄です。",
  Start: "開始",
  Length: "長さ",
  "Exchanges with a liquidation in it": "期間中に清算があった取引所",
  "The last close before the cascade began": "カスケード開始前の最後の終値",
  "Price before": "開始前の価格",
  "From the price before to the furthest it went inside the cascade":
    "開始前の価格から期間中に最も動いた点まで",
  "Into it": "期間中",
  "From the close at its end to the close an hour later": "終了時の終値から 1 時間後の終値まで",
  "1h after": "1 時間後",
  "From the close at its end to the close four hours later": "終了時の終値から 4 時間後の終値まで",
  "4h after": "4 時間後",
  "Newest first.": "新しい順。",
  "Times are in {zone}.": "時刻は {zone}。",
  "Nothing has been force-closed in this window, so there is no asset to read.":
    "この期間に強制決済はなく、読み取る銘柄がありません。",
  "{asset} cascades": "{asset} カスケード",
  "{asset} longs vs shorts by day · UTC days": "{asset} 日別ロング対ショート · UTC 日",
  "30- and 90-day history": "30 日・90 日の履歴",
  "{asset} over 30 and 90 days": "{asset} の 30 日・90 日",
  "Every day's longs and shorts liquidated over the last 30 or 90 days, each day as a share of the open interest on the same exchanges, and the heaviest days ranked.":
    "過去 30 日または 90 日の毎日のロングとショートの清算額、各日の同じ取引所の建玉に対する比率、そして最も重かった日のランキング。",
  "Liquidations against open interest": "清算と建玉の比較",
  "Which markets were really flushed rather than just big: every asset's liquidations in the window as a share of its open interest, and the same for crypto, stocks, commodities and indices.":
    "規模が大きいだけでなく本当に一掃された市場はどこか：期間中の各銘柄の清算額が建玉に占める比率と、暗号資産・株式・コモディティ・指数ごとの比率。",
  "For members": "メンバー限定",
  "Create a free account": "無料アカウントを作成",
  "Loading the member view…": "メンバー表示を読み込み中…",
  "The history could not be read right now.": "履歴を現在読み取れません。",
  "Nothing was force-closed in {asset} over this span.":
    "この期間に {asset} の強制決済はありません。",
  "Liquidated over {span} days": "{span} 日間の清算額",
  "A typical day": "典型的な一日",
  "of open interest, on average": "建玉に対する平均比率",
  "The heaviest day": "最も重かった日",
  "Days with data": "データのある日数",
  "from {date}": "{date} から",
  "The heaviest days, as a share of open interest": "最も重かった日（建玉比）",
  "Day (UTC)": "日付（UTC）",
  "Exchanges that reported a liquidation that day": "その日に清算を報告した取引所",
  "Open interest is the day's average on the exchanges whose liquidation feeds reported {asset}, so the share compares like with like.":
    "建玉は {asset} の清算を報告した取引所におけるその日の平均で、比率は同じ範囲どうしの比較です。",
  "Liquidation feeds were added over time: from {least} to {most} exchanges a day here, so early days undercount.":
    "清算フィードは順次追加されました：ここでは 1 日あたり {least} から {most} 取引所のため、初期の日は少なめです。",
  Commodities: "コモディティ",
  Indices: "指数",
  "The open interest could not be read right now.": "建玉を現在読み取れません。",
  "{liq} of {oi} open": "建玉 {oi} のうち {liq}",
  "The markets most flushed for their size": "規模の割に最も一掃された市場",
  "No market with $1M of open interest had a liquidation in this window.":
    "この期間に建玉 $1M 以上の市場で清算はありませんでした。",
  Class: "区分",
  "Liquidations over the last {window} against the open interest now, both on the {feeds} exchanges whose liquidation feeds reported closes in that window. Markets under $1M of open interest are left out of the ranking.":
    "過去 {window} の清算と現在の建玉の比較で、どちらもこの期間に清算を報告した {feeds} 取引所のものです。建玉 $1M 未満の市場はランキングから除外しています。",
  Span: "期間",
  History: "履歴",
  "{asset} history": "{asset} の履歴",
  "Liquidations vs open interest": "清算と建玉の比較",
  "vs OI": "建玉比",
  "Every cascade, in every asset": "すべての銘柄のすべてのカスケード",
  "Every liquidation cascade in every asset, found each minute as it happens, with the price an hour and four hours after. Members can also have them sent to Telegram the moment they start.":
    "すべての銘柄の清算カスケードを毎分リアルタイムで検出し、1 時間後と 4 時間後の価格を添えて表示します。メンバーは開始と同時に Telegram で受け取ることもできます。",
  "No cascade in any asset in the last {window}.":
    "過去 {window} にカスケードのあった銘柄はありません。",
  "in {n} assets": "{n} 銘柄",
  "Longs and shorts": "ロングとショート",
  "{longs} long cascades, {shorts} short": "ロングのカスケード {longs} 回、ショート {shorts} 回",
  "The deepest market's mark when the watch first saw it, a minute or two in":
    "監視が最初に検出した時点の最も厚い市場のマーク価格（開始から 1〜2 分後）",
  "Price when seen": "検出時の価格",
  "From the price when seen to the mark an hour after the cascade ended":
    "検出時の価格から、カスケード終了 1 時間後のマーク価格まで",
  "From the price when seen to the mark four hours after the cascade ended":
    "検出時の価格から、カスケード終了 4 時間後のマーク価格まで",
  "Every asset, found each minute as it happens, by the rule of each asset's Cascades tab. Prices are the asset's deepest market's mark when the watch saw it and an hour and four hours after it ended. Members can have them sent to Telegram from {alerts}.":
    "すべての銘柄を毎分リアルタイムで、各銘柄のカスケードタブと同じ基準で検出します。価格は検出時と終了 1 時間後・4 時間後の、その銘柄で最も厚い市場のマーク価格です。メンバーは {alerts} から Telegram への通知を設定できます。",
  "the alerts page": "アラートページ",
  "All cascades": "すべてのカスケード",
  // The member Top traders tab (web/trader.ts), 2026-11-15.
  "24h": "24時間",
  "30d": "30日",
  "All time": "全期間",
  "over the last day": "過去1日",
  "over the last week": "過去1週間",
  "over the last month": "過去1か月",
  "over all time": "全期間",
  "Long {coin}": "{coin} ロング",
  "Short {coin}": "{coin} ショート",
  "Rank by profit over": "利益の集計期間",
  "Hyperliquid's leaderboard could not be read right now. Try again in a minute.":
    "現在 Hyperliquid のリーダーボードを読み込めません。1分後にもう一度お試しください。",
  "+{n} more": "ほか {n} 件",
  "nothing over $100k": "$100k 超のポジションなし",
  Profit: "利益",
  "Profit over the account's value, as Hyperliquid's leaderboard computes it":
    "利益を口座価値で割ったもの（Hyperliquid のリーダーボードの計算による）",
  Return: "リターン",
  "Account value": "口座価値",
  "Holding now": "現在の保有",
  "Hyperliquid's own leaderboard, every one of its {ranked} accounts ranked by profit {window}, read {ago}. Hyperliquid is the large perp exchange where every account is public, so any of them opens on its positions, fills and orders. Holdings are the whale tracker's: positions of $100k and up, read within three hours.":
    "Hyperliquid 公式のリーダーボードで、{ranked} の全口座を{window}の利益で順位付けしたもの。{ago}に読み込み。Hyperliquid はすべての口座が公開されている大手パーペチュアル取引所なので、どの口座もポジション、約定、注文を開いて見られます。保有はクジラ追跡によるもので、$100k 以上のポジションを3時間以内に読み込んだものです。",
  "Too little history in this window to draw.": "この期間は描画できるほどの履歴がありません。",
  "Open long": "ロング新規",
  "Close long": "ロング決済",
  "Open short": "ショート新規",
  "Close short": "ショート決済",
  "Long to short": "ロングからショート",
  "Short to long": "ショートからロング",
  Buy: "買い",
  Sell: "売り",
  Limit: "指値",
  "Stop market": "ストップ成行",
  "Stop limit": "ストップ指値",
  "Take profit market": "利確成行",
  "Take profit limit": "利確指値",
  "reduce only": "決済のみ",
  "position TP/SL": "ポジションの TP/SL",
  Filled: "約定済み",
  Canceled: "キャンセル",
  Triggered: "発動済み",
  Rejected: "拒否",
  "Canceled: margin": "キャンセル：証拠金不足",
  "All top traders": "トップトレーダー一覧",
  "#{place} on Hyperliquid's leaderboard by profit {window}.":
    "{window}の利益で Hyperliquid リーダーボード {place} 位。",
  "Hyperliquid is answering too many requests right now. Try again in a minute.":
    "現在 Hyperliquid へのリクエストが多すぎます。1分後にもう一度お試しください。",
  "Hyperliquid did not answer for this account right now. Try again in a minute.":
    "現在 Hyperliquid からこの口座の応答がありません。1分後にもう一度お試しください。",
  "{usd} free to withdraw": "出金可能 {usd}",
  "Profit {window}": "{window}の利益",
  "{usd} traded": "取引高 {usd}",
  "Open positions": "保有ポジション",
  "{lev}x the account's value": "口座価値の {lev} 倍",
  "on the open positions": "保有ポジションの含み損益",
  "Profit chart window": "損益チャートの期間",
  "Profit and loss {window}": "{window}の損益",
  "The profit history could not be read right now.": "現在、損益の履歴を読み込めません。",
  "No open positions.": "保有ポジションはありません。",
  Coin: "銘柄",
  "Unrealized profit over the margin the position holds":
    "含み損益をそのポジションの証拠金で割ったもの",
  ROE: "ROE",
  "Liq. price": "清算価格",
  "Funding the position has paid since it opened; a minus is funding received":
    "ポジションを建ててから支払った資金調達料。マイナスは受け取り",
  isolated: "分離",
  "The positions could not be read right now.": "現在、ポジションを読み込めません。",
  "Resting orders": "板上の注文",
  Placed: "発注",
  Trigger: "トリガー",
  "The fills could not be read right now.": "現在、約定を読み込めません。",
  "No fills on record.": "約定の記録はありません。",
  "This account was liquidated in this fill": "この約定でこの口座は清算された",
  liquidated: "清算",
  "Results by coin": "銘柄別の結果",
  "Orders that filled": "約定した注文",
  Trades: "取引",
  "Profit realized by closing, before fees": "決済で確定した損益（手数料控除前）",
  "Closed P&amp;L": "確定損益",
  Fees: "手数料",
  Direction: "方向",
  "Size-weighted over the order's fills": "注文の約定を数量で加重",
  Fee: "手数料",
  "Fills the order took": "注文の約定数",
  "No trades in {coin} among these fills.": "これらの約定に {coin} の取引はありません。",
  "Hyperliquid answers an account's last {n} fills, here from {date}; results by coin are over those fills only. Each trade is one order's fills taken together.":
    "Hyperliquid が返すのは口座の直近 {n} 件の約定で、ここでは {date} 以降。銘柄別の結果はこれらの約定のみが対象です。1件の取引は1つの注文の約定をまとめたものです。",
  "The order history could not be read right now.": "現在、注文履歴を読み込めません。",
  market: "成行",
  "No orders on record.": "注文の記録はありません。",
  "Hyperliquid answers an account's last {n} orders, each shown once at its latest status.":
    "Hyperliquid が返すのは口座の直近 {n} 件の注文で、各注文は最新のステータスで1回だけ表示します。",
  "Hyperliquid throttled part of this read; what is missing says so. Try again in a minute.":
    "Hyperliquid が今回の読み込みの一部を制限しました。欠けている部分はその旨を表示しています。1分後にもう一度お試しください。",
  Positions: "ポジション",
  "Order history": "注文履歴",
  "Read from Hyperliquid {ago}.": "{ago}に Hyperliquid から読み込み。",
  "Top traders, and every order they place": "トップトレーダーと、そのすべての注文",
  "Hyperliquid's biggest winners over a day, a week, a month or all time, with what they hold now. Open any of them for their positions and liquidation prices, profit over time, and their recent trades and orders, coin by coin.":
    "1日、1週間、1か月、全期間で Hyperliquid の利益が最も大きいトレーダーと、現在の保有。誰でも開けば、ポジションと清算価格、損益の推移、直近の取引と注文を銘柄ごとに見られます。",
  "Top traders": "トップトレーダー",
  Winners: "勝者",
  "Longs near liquidation": "清算間近のロング",
  "Longs closest to their liquidation price": "清算価格に最も近いロング",
  "Closest first: how far the price has to fall to liquidate each one.":
    "近い順：各ポジションの清算までに価格がどれだけ下がる必要があるか。",
  "Shorts near liquidation": "清算間近のショート",
  "Shorts closest to their liquidation price": "清算価格に最も近いショート",
  "Closest first: how far the price has to rise to liquidate each one.":
    "近い順：各ポジションの清算までに価格がどれだけ上がる必要があるか。",
  "Largest longs": "最大のロング",
  "Largest longs that can be liquidated": "清算されうる最大のロング",
  "Biggest first, each with the price that would liquidate it.":
    "大きい順。各ポジションを清算する価格つき。",
  "Largest shorts": "最大のショート",
  "Largest shorts that can be liquidated": "清算されうる最大のショート",
  "The {n} largest of {total}.": "{total} 件のうち最大の {n} 件。",
  "Position list": "ポジション一覧",
  "No long position here has a liquidation price.": "清算価格のあるロングはありません。",
  "No short position here has a liquidation price.": "清算価格のあるショートはありません。",
  "The odds of reaching each price": "各価格に届く確率",
  "{asset}: the odds of reaching each price": "{asset}：各価格に届く確率",
  "How far the price can plausibly get in 4 hours, 6 hours, a day and a week: the chance it touches each level, sized from its own measured volatility, beside the levels where positions were liquidated and what each liquidation theory reads.":
    "4時間、6時間、1日、1週間で価格がどこまで動きうるか：実測ボラティリティから各水準に触れる確率を算出し、清算が起きた水準と各清算理論の読みを並べて表示。",
  "Clicked bar": "クリックしたバー",
  "Positions that liquidate in a bar": "バー内で清算されるポジション",
  "Every position in the bar you clicked, longs and shorts, largest first.":
    "クリックしたバーのすべてのポジション（ロング・ショート両方）、大きい順。",
  "No tracked position liquidates in this bar.":
    "このバーで清算される追跡中のポジションはありません。",
  "Click a bar on the map above to list every position that liquidates in it.":
    "上のマップのバーをクリックすると、その価格帯で清算されるすべてのポジションを一覧します。",
  "Positions that liquidate between {low} and {high}":
    "{low} から {high} の間で清算されるポジション",
  "click one to list its positions below": "バーをクリックすると下にポジションを一覧",
  // The Longs vs shorts tab's positioning strip.
  "{low}% to {high}%": "{low}%〜{high}%",
  "{venue}: share of all accounts net long": "{venue}：全アカウントのうちネットロングの割合",
  "{venue}: share of the top traders' position size held long":
    "{venue}：上位トレーダーのポジション量のうちロングの割合",
  "{venue}: share of the top traders' accounts net long":
    "{venue}：上位トレーダーのアカウントのうちネットロングの割合",
  "{venue}: share of the last hour's taker volume that bought, on average":
    "{venue}：直近1時間のテイカー出来高のうち買いの平均割合",
  "{asset} positioning": "{asset} のポジション動向",
  "{asset} positioning: the share long on each exchange":
    "{asset} のポジション動向：取引所ごとのロング比率",
  "newest {time}": "最新 {time}",
  "All accounts": "全アカウント",
  "Top traders' positions": "上位トレーダーのポジション",
  "Top traders' accounts": "上位トレーダーのアカウント",
  "Taker buys": "テイカー買い",
  "all accounts": "全アカウント",
  "top positions": "上位ポジション",
  "Each exchange's own published statistics, read every 15 minutes. All accounts counts every account once, so it reads the crowd. Top traders are each exchange's own group (Binance: the top 20% by margin), by position size and by accounts. Taker buys is the share of taker volume that bought, averaged over the last hour. A dash is a figure the exchange does not publish.":
    "各取引所が公表している統計を 15 分ごとに取得しています。全アカウントは各アカウントを 1 回ずつ数えるため、大衆の傾きを示します。上位トレーダーは各取引所が独自に定める層（Binance：証拠金上位 20%）で、ポジション量とアカウント数の両方で示します。テイカー買いは直近 1 時間のテイカー出来高のうち買いの平均割合です。「–」はその取引所が公表していない項目です。",
};
