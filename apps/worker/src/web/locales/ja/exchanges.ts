import type { Catalog } from "../../i18n";

/**
 * The Exchanges page (web/exchanges.ts): the grade, the trading-cost columns and tiles, and one
 * exchange's trading-cost table. Glossary and style: ./index.ts.
 *
 * Terms: grade 評価 (the letters S/A/B/C/D stay), score スコア, execution / liquidity / activity 執行 /
 * 流動性 / 活況度, mid (price) ミッド価格, depth 板の厚み (as on the Arbitrage page), level (of a book)
 * 価格帯, public order book 公開板, market order 成行注文, fill 約定, credited (counted by the grade)
 * 計上, basket バスケット, twelve majors 主要12銘柄, asset 銘柄, snapshot スナップショット, markout
 * マークアウト, standard taker fee 標準テイカー手数料, lower bound 下限値. "$10k", "$100k", "±0.1%" and
 * "±1%" stay as written; "{bps} bp" is written "{bps}bp" like "{n} bp" elsewhere on the page.
 * The grade's pillars (after DefiLlama's REAL score): pillar 柱, reserves (a pillar, and what an
 * exchange holds) 準備金, (tracked) wallets 追跡対象のウォレット, clean (without the exchange's own
 * token) 自社トークンを除く / 自社トークン以外, (protocol) collateral (プロトコルの)担保, weight 重み,
 * breadth 広がり, breakdown 内訳, the leader 首位の取引所, "{n} points" (a pillar's weight out of 100)
 * {n}点, "n/a" stays n/a, "#{rank} of {of} CEXs" CEX {of}取引所中 {rank}位 (DEX likewise). DefiLlama,
 * REAL, CEX and DEX stay in Latin letters.
 */
export const exchanges: Catalog = {
  // the grade's breakdown card: the four pillars and the line under each bar
  Reserves: "準備金",
  Execution: "執行",
  Activity: "活況度",
  Liquidity: "流動性",
  "not measured": "未計測",
  "no wallets published": "ウォレット未公開",
  "collateral not identified: the DEXes' median": "担保を特定できず：DEX の中央値",
  "{clean} clean of {total} in tracked wallets":
    "追跡対象のウォレットにある {total} のうち、自社トークン以外は {clean}",
  "{usd} protocol collateral": "プロトコルの担保 {usd}",
  "{cost} to trade $10k, {slip} slippage at $100k":
    "$10k の取引に {cost}、$100k でのスリッページ {slip}",
  "{oi} open interest, {volume} volume": "建玉 {oi}、出来高 {volume}",
  "{usd} credited within 0.1%; {n} of {total} markets hold $100k":
    "0.1%以内の計上額 {usd}、{total}銘柄中 {n}銘柄が $100k 以上",
  "#{rank} of {of} CEXs": "CEX {of}取引所中 {rank}位",
  "#{rank} of {of} DEXs": "DEX {of}取引所中 {rank}位",
  "n/a": "n/a",
  "Built from this site's own reading of the order books and DefiLlama's reserves. n/a never counts as zero; its weight goes to the others. S from 85, A 70, B 55, C 40, else D.":
    "当サイト独自の板の読み取りと DefiLlama の準備金から算出しています。n/a はゼロとして数えず、その重みは他の柱に回します。85以上で S、70以上で A、55以上で B、40以上で C、それ以外は D です。",
  "How the grade is built": "評価の算出方法",
  "Grade {grade}, score {score}: the breakdown": "評価 {grade}、スコア {score}：内訳",
  // the Reserves column
  "clean, of {total} in wallets": "ウォレット計 {total} のうち自社トークン以外",
  collateral: "担保",
  // how the grade is built, under the table
  "{n} points": "{n}点",
  "After DefiLlama's REAL score: a weighted mean of four pillars, each 0 to 100. Sizes are on a log scale, so an exchange a tenth the size of the leader still scores about 70. A pillar this site cannot measure for an exchange hands its weight to the others and never counts as zero. CEXes and DEXes are scored together and ranked within their own kind. Fixed bands, so a new exchange does not reshuffle the rest: S from 85, A from 70, B from 55, C from 40, D below.":
    "DefiLlama の REAL スコアにならったもので、それぞれ0〜100の4つの柱の加重平均です。規模は対数スケールで測るため、首位の取引所の10分の1の規模でもスコアはおよそ70になります。ある取引所について当サイトが計測できない柱は、その重みを他の柱に回し、ゼロとしては数えません。CEX と DEX は同じ基準で採点し、順位はそれぞれの種類の中で付けます。区切りは固定のため、新しい取引所が加わっても他の取引所の評価は入れ替わりません：85以上で S、70以上で A、55以上で B、40以上で C、それ未満は D です。",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain, without its own token; a DEX's protocol collateral, a floor, since market makers' money can sit elsewhere. Two thirds is size against the largest; one third is whether its open interest, a day's volume and the book it shows within 1% are sizes it could back, and how much of it is its own token. A CEX publishing no wallets scores 0; a DEX whose collateral is not identified scores the DEXes' median.":
    "取引所が保有する資産で、DefiLlama のデータを使います：CEX はオンチェーンで追跡されているウォレット（自社トークンを除く）、DEX はプロトコルの担保です。マーケットメイカーの資金は別の場所にあることもあるため、DEX の担保は下限値です。3分の2は最大の取引所と比べた規模、3分の1は、建玉、1日の出来高、1%以内に表示している板がその保有資産で裏付けられる規模かどうかと、保有資産のうち自社トークンが占める割合です。ウォレットを公開していない CEX は0、担保を特定できない DEX は DEX の中央値になります。",
  "What a market order costs, from each exchange's book every ten minutes over seven days: $10k all in (the published standard taker fee and the walk through the book), and what $10k and $100k pay beyond the mid, each against the cheapest exchange. DefiLlama also scores markouts and fills against the quote; those need trades, which this site does not record, so their weight goes to cost and slippage.":
    "成行注文にかかるコストで、各取引所の板を7日間、10分ごとに読み取って算出します：$10k の総コスト（公表されている標準テイカー手数料と、板を食っていく分）と、$10k と $100k の注文がミッド価格より余分に支払う額を、それぞれ最安の取引所と比較します。DefiLlama はマークアウトと気配値に対する約定価格も採点しますが、これには取引データが必要で、当サイトは記録していないため、その重みはコストとスリッページに回します。",
  "Open interest, credited up to three times clean reserves, and a day's volume, credited up to five times open interest, each against the leader.":
    "建玉（自社トークンを除いた準備金の3倍まで計上）と1日の出来高（建玉の5倍まで計上）を、それぞれ首位の取引所と比較します。",
  "Depth within 0.1% of the mid across the twelve majors, credited up to a tenth of each market's open interest, 2% of the exchange's daily volume and 5% of its clean reserves; and breadth, how many of the twelve hold $100k within 0.1%. Halved for a CEX publishing no reserves.":
    "主要12銘柄のミッド価格から0.1%以内の板の厚み（各銘柄の建玉の10分の1、取引所の1日の出来高の2%、自社トークンを除いた準備金の5%まで計上）と、広がり（12銘柄のうち0.1%以内に $100k 以上ある銘柄の数）です。準備金を公開していない CEX はこの柱のスコアが半分になります。",
  "These are this site's grades by DefiLlama's method, not DefiLlama's scores. What exchanges report about themselves counts only as far as it can be checked: open interest up to three times reserves, volume up to five times open interest. Reputation, age, brand and listings count not at all.":
    "これは DefiLlama の手法による当サイトの評価であり、DefiLlama のスコアではありません。取引所が自ら公表する数値は、確認できる範囲でしか数えません：建玉は準備金の3倍まで、出来高は建玉の5倍までです。評判、運営年数、ブランド、上場銘柄は一切数えません。",
  // the table's cells and tiles
  "fee {fee}{mark}": "手数料 {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "バスケットのうち {n}銘柄の板では、ほとんどの時間 $100k が約定しませんでした。それぞれ {bps}bp として計算しています",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, 2% of the exchange's daily volume or 5% of its clean reserves is not counted":
    "評価に計上するのはこのうち {usd} です：銘柄の建玉の10分の1、取引所の1日の出来高の2%、または自社トークンを除いた準備金の5%を超える板の厚みは数えません",
  "{n} of {total} assets": "{total}銘柄中 {n}銘柄",
  "Not measured: its order book is not read yet": "未計測：この取引所の板はまだ読み取っていません",
  "across {n} exchanges reporting now": "現在報告している {n}取引所の合計",
  "as each exchange reports it": "各取引所の公表値",
  "Cheapest $10k": "$10k の最安コスト",
  "{venue}: taker fee and slippage, the basket's mix":
    "{venue}：テイカー手数料とスリッページ（バスケットの構成比で加重）",
  "no book measured yet": "計測済みの板はまだありません",
  "Deepest books": "最も厚い板",
  "{venue}: credited within 0.1% of the mid, 12 majors":
    "{venue}：ミッド価格から0.1%以内の計上額、主要12銘柄",
  // the table's column heads
  Grade: "評価",
  "This site's grade after DefiLlama's REAL score: reserves, execution, activity and liquidity. A grade opens its breakdown":
    "DefiLlama の REAL スコアにならった当サイトの評価：準備金、執行、活況度、流動性。評価をクリックすると内訳を表示します",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain without its own token, a DEX's protocol collateral":
    "取引所の保有資産（DefiLlama より）：CEX はオンチェーンで追跡されているウォレット（自社トークンを除く）、DEX はプロトコルの担保",
  "Cost to trade $10k": "$10k の取引コスト",
  "A $10k market order all in: the published standard taker fee plus what the book makes it pay beyond the mid":
    "$10k の成行注文の総コスト：公表されている標準テイカー手数料に、板を食うことでミッド価格より余分に支払う分を加えたもの",
  Slippage: "スリッページ",
  "What a $10k and a $100k market order pay beyond the mid, from the book, before fees":
    "$10k と $100k の成行注文がミッド価格より余分に支払う額。板から算出、手数料は含みません",
  "The gap between the best bid and ask, basis points of the mid":
    "最良買い気配と最良売り気配の差。ミッド価格に対する bps",
  Depth: "板の厚み",
  "Dollars resting within 0.1% and within 1% of the mid on both sides, the basket's books added up, as each exchange's public book shows them":
    "ミッド価格から0.1%以内と1%以内に、買い・売り両側で置かれている金額（ドル）。バスケットの各板を合計したもので、各取引所の公開板に表示されているとおりの値です",
  "Summed over the exchange's perpetual markets, as it reports them":
    "取引所が公表する無期限先物銘柄全体の合計",
  "Live perpetual markets": "稼働中の無期限先物銘柄",
  // the page's help panel and description
  "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.":
    "当サイトが収集しているすべての無期限先物取引所を、そこで取引するコストの順に並べています。コストは各取引所の公開板から算出しており、主要12銘柄（BTC、ETH、SOL、XRP、DOGE、BNB、HYPE、SUI、ADA、LINK、AVAX、LTC）について10分ごとに読み取っています。各数値は直近7日間の中央値です。",
  "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.":
    "$10k の取引コストは、$10k の成行注文にかかる総コストです：取引所が公表している標準テイカー手数料（VIP ランク、手数料トークン、リベートで下がります）に、注文が板を食うことでミッド価格より余分に支払う分（スプレッドの半分を含む）を加えたものです。スリッページは後者だけを $10k と $100k で示したものです。各銘柄は全取引所での建玉に応じて重み付けしているため、どの取引所も同じ構成比で算出されます。",
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that.":
    "板の厚みは、各取引所の公開板に表示されているとおりの、ミッド価格から0.1%以内と1%以内に置かれている金額（ドル）です。取引所が公開する価格帯の数には限りがあるため（Binance の BTC では約0.15%まで）、1%の数値は下限値であり、評価には計測したすべての板が届く0.1%の数値を使います。銘柄の建玉の5%を超える単一の価格帯は、その5%までしか数えません。",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade follows DefiLlama's REAL score: reserves 30, execution 30, activity 20, liquidity 20. A grade opens its breakdown; how each pillar is built is under the table.":
    "これらは板が示す見込みであって、実際の約定ではありません：取引そのものは計測していないため、マークアウト（約定後に価格がどちらへ動くか）は表示していません。評価は DefiLlama の REAL スコアにならっています：準備金30点、執行30点、活況度20点、流動性20点。評価をクリックすると内訳を表示し、各柱の算出方法は表の下にあります。",
  "Every perpetual futures exchange tracked by airrates, graded on reserves, trading cost, activity and liquidity: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "airrates が追跡するすべての無期限先物取引所を、準備金、取引コスト、活況度、流動性で評価：$10k と $100k でのテイカー手数料とスリッページ、板の厚み、建玉、出来高。",
  // the notes under the table
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "{date} から板を計測しています。数値は直近7日間の中央値です。",
  "Order books are not measured yet.": "板はまだ計測していません。",
  "Reserves: DefiLlama, read every six hours.":
    "準備金は DefiLlama から6時間ごとに取得しています。",
  "Reserves are not available right now; the grade goes on without them.":
    "準備金は現在取得できません。評価は準備金を除いて算出しています。",
  "* No published taker fee found for {venues}: the site's default of {bps} bp is used.":
    "* {venues} は公表されたテイカー手数料が見つからないため、当サイトの既定値 {bps}bp を使用しています。",
  "Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.":
    "未評価：板をまだ読み取っていない取引所。未収集：{venues}。",
  // one exchange's page: its trading-cost table
  "not listed": "未上場",
  "$100k did not fill in most snapshots": "ほとんどのスナップショットで $100k が約定しませんでした",
  "did not fill": "約定せず",
  "{pct}%": "{pct}%",
  "Trading cost": "取引コスト",
  "{value} to trade $10k": "$10k の取引に {value}",
  "taker fee {fee}{mark}": "テイカー手数料 {fee}{mark}",
  "{value} slippage at $100k": "$100k でのスリッページ {value}",
  "{value} within 0.1%": "0.1%以内に {value}",
  "What a $10k market order pays beyond the mid, before fees":
    "$10k の成行注文がミッド価格より余分に支払う額（手数料を除く）",
  "$10k slippage": "$10k のスリッページ",
  "What a $100k market order pays beyond the mid, before fees":
    "$100k の成行注文がミッド価格より余分に支払う額（手数料を除く）",
  "$100k slippage": "$100k のスリッページ",
  "Depth ±0.1%": "板の厚み ±0.1%",
  "Depth ±1%": "板の厚み ±1%",
  "How far from the mid the published book reached": "公開板がミッド価格からどこまで届いていたか",
  "Book reach": "板の到達範囲",
  "Snapshots in the last seven days": "直近7日間のスナップショット数",
  Samples: "サンプル数",
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. Reserves are DefiLlama's.":
    "{venue} の公開板を10分ごとに記録した直近7日間のスナップショットの中央値です。コストは板から算出したもので、実際の約定ではありません。準備金は DefiLlama のデータです。",
};
