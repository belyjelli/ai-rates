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
 */
export const exchanges: Catalog = {
  "score {score}: execution {execution}, liquidity {liquidity}, activity {activity}":
    "スコア {score}：執行 {execution}、流動性 {liquidity}、活況度 {activity}",
  "fee {fee}{mark}": "手数料 {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "バスケットのうち {n}銘柄の板では、ほとんどの時間 $100k が約定しませんでした。それぞれ {bps}bp として計算しています",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, or 2% of the exchange's daily volume, is not counted":
    "評価に計上するのはこのうち {usd} です：銘柄の建玉の10分の1、または取引所の1日の出来高の2%を超える板の厚みは数えません",
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
  Grade: "評価",
  "This site's grade from its own measurements: S, A, B, C, D":
    "当サイトが独自の計測から付けた評価：S、A、B、C、D",
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
  "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.":
    "当サイトが収集しているすべての無期限先物取引所を、そこで取引するコストの順に並べています。コストは各取引所の公開板から算出しており、主要12銘柄（BTC、ETH、SOL、XRP、DOGE、BNB、HYPE、SUI、ADA、LINK、AVAX、LTC）について10分ごとに読み取っています。各数値は直近7日間の中央値です。",
  "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.":
    "$10k の取引コストは、$10k の成行注文にかかる総コストです：取引所が公表している標準テイカー手数料（VIP ランク、手数料トークン、リベートで下がります）に、注文が板を食うことでミッド価格より余分に支払う分（スプレッドの半分を含む）を加えたものです。スリッページは後者だけを $10k と $100k で示したものです。各銘柄は全取引所での建玉に応じて重み付けしているため、どの取引所も同じ構成比で算出されます。",
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that, and the grade credits a market's depth up to a tenth of its open interest and an exchange's up to 2% of its daily volume: displayed size beyond that rarely fills.":
    "板の厚みは、各取引所の公開板に表示されているとおりの、ミッド価格から0.1%以内と1%以内に置かれている金額（ドル）です。取引所が公開する価格帯の数には限りがあるため（Binance の BTC では約0.15%まで）、1%の数値は下限値であり、評価には計測したすべての板が届く0.1%の数値を使います。銘柄の建玉の5%を超える単一の価格帯はその5%までしか数えず、さらに評価では、銘柄の板の厚みはその建玉の10分の1まで、取引所全体ではその1日の出来高の2%までを計上します：それを超えて表示されている数量が約定することはまれだからです。",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade is this site's: half execution (cost and $100k slippage against the cheapest), three tenths liquidity (credited depth within 0.1% against the deepest), a fifth activity (open interest, and volume up to five times it). S from 85, A from 70, B from 55, C from 40, D below.":
    "これらは板が示す見込みであって、実際の約定ではありません：取引そのものは計測していないため、マークアウト（約定後に価格がどちらへ動くか）は表示していません。評価は当サイト独自のもので、執行が半分（コストと $100k のスリッページを最安の取引所と比較）、流動性が10分の3（0.1%以内の計上済みの板の厚みを最も厚い取引所と比較）、活況度が5分の1（建玉と、建玉の5倍までの出来高）です。85以上で S、70以上で A、55以上で B、40以上で C、それ未満は D です。",
  "Every perpetual futures exchange tracked by airrates, graded on what trading there costs: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "airrates が追跡するすべての無期限先物取引所を、取引コストで評価：$10k と $100k でのテイカー手数料とスリッページ、板の厚み、建玉、出来高。",
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "{date} から板を計測しています。数値は直近7日間の中央値です。",
  "Order books are not measured yet.": "板はまだ計測していません。",
  "* No published taker fee found for {venues}: the site's default of {bps} bp is used.":
    "* {venues} は公表されたテイカー手数料が見つからないため、当サイトの既定値 {bps}bp を使用しています。",
  "Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.":
    "未評価：板をまだ読み取っていない取引所。未収集：{venues}。",
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
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. How the grade is built: the Exchanges page.":
    "{venue} の公開板を10分ごとに記録した直近7日間のスナップショットの中央値です。コストは板から算出したもので、実際の約定ではありません。評価の算出方法は取引所ページをご覧ください。",
};
