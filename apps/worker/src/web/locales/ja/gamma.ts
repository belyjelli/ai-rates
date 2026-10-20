import type { Catalog } from "../../i18n";

/**
 * The Rates page's Gamma Exposure tab (web/gamma.ts), its chart readout (web/slot-chart.ts) and the
 * page's two tab labels. Glossary and style: ./index.ts.
 *
 * Terms: gamma exposure ガンマエクスポージャー (GEX left as written), option オプション, call コール,
 * put プット, strike 行使価格, expiry 満期, spot 現物価格, dealer ディーラー, flip フリップ, call wall /
 * put wall コールウォール / プットウォール, hedging ヘッジ, net (a signed total) ネット, an option book
 * (the options on one underlying, the picker's row) 原資産, settlement price 決済価格 (not 清算, which
 * is a liquidation on this site). Black-76 and the Greek names stay in Latin letters or katakana as
 * Japanese option desks write them. The book names are plain text, escaped where they are shown, so
 * "S&P" keeps its "&" as written.
 */
export const gamma: Catalog = {
  "Funding rates": "資金調達率",
  Funding: "資金調達率",
  "Gamma Exposure": "ガンマエクスポージャー",
  Gamma: "ガンマ",
  "Next: {date}": "直近：{date}",
  "Next expiry": "直近満期",
  "7 days": "7日以内",
  "30 days": "30日以内",
  "All expiries": "全満期",
  "Option book": "オプション原資産",
  Expiries: "満期",
  "spot {price}": "現物価格 {price}",
  "net {net} per 1% move at spot {spot} · {bars} · hover or tap a strike to read it":
    "現物価格 {spot} での1%変動あたりネット {net} · {bars} · 行使価格にカーソルを合わせるかタップで表示",
  "bars are each strike's calls and puts": "バーは各行使価格のコールとプット",
  "bars are each strike's calls and puts added": "バーは各行使価格のコールとプットの合計",
  "Net long": "ネットロング",
  "Net short": "ネットショート",
  "short gamma": "ショートガンマ",
  "long gamma": "ロングガンマ",
  View: "表示",
  view: "表示",
  "calls/puts": "コール/プット",
  "Each strike's calls above zero and its puts below":
    "各行使価格のコールをゼロより上、プットを下に表示",
  net: "ネット",
  "One bar per strike: its calls and puts added": "行使価格ごとに1本：コールとプットの合計",
  zones: "ゾーン",
  "Net bars, with the prices shaded where dealers would be short gamma or long it":
    "ネットのバーに、ディーラーがショートガンマまたはロングガンマになる価格帯を色付け",
  "The view switch beside the cursor draws the bars three ways: calls/puts, each strike's calls above zero and its puts below; net, the two added into one bar; and zones, the net bars with the prices shaded where the line is below zero (dealers short gamma, red) or above it (long gamma, blue).":
    "カーソルの横の表示切替で、バーを3通りに描きます：コール/プットは、各行使価格のコールをゼロより上、プットを下に。ネットは、両者を合計した1本のバー。ゾーンは、ネットのバーに、線がゼロを下回る価格帯（ディーラーがショートガンマ、赤）と上回る価格帯（ロングガンマ、青）を色付けしたものです。",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of exposure, either sign.":
    "現物価格の ±{pct} より外の行使価格はチャート外です：エクスポージャー {usd}（プラスとマイナスの合計）。",
  "flip {price}": "フリップ {price}",
  "{currency} · {source} options · gamma exposure by strike · {scope}":
    "{currency} · {source} オプション · 行使価格別ガンマエクスポージャー · {scope}",
  Calls: "コール",
  Puts: "プット",
  "Net if the spot moved there": "現物価格がそこまで動いた場合のネット",
  Spot: "現物価格",
  "{currency} strike bands; arrow keys read one at a time":
    "{currency} の行使価格帯。矢印キーで1つずつ確認できます",
  "{currency} options gamma exposure by strike":
    "{currency} オプションの行使価格別ガンマエクスポージャー",
  "net gamma keeps one sign within ±30% of the spot":
    "現物価格の ±30% 以内ではネットガンマの符号は変わりません",
  "{pct} from spot; net gamma changes sign here":
    "現物価格から {pct}。ここでネットガンマの符号が変わります",
  "Net gamma exposure": "ネットガンマエクスポージャー",
  "per 1% move · dealers long gamma: their hedging damps moves":
    "1%変動あたり · ディーラーはロングガンマ：ヘッジが値動きを抑えます",
  "per 1% move · dealers short gamma: their hedging adds to moves":
    "1%変動あたり · ディーラーはショートガンマ：ヘッジが値動きを増幅します",
  "Gamma flip": "ガンマフリップ",
  "Call wall / put wall": "コールウォール / プットウォール",
  "the strikes holding the most call and put gamma": "コールとプットのガンマが最も集中する行使価格",
  "calls / puts at the spot · put/call {ratio} · {options} options, {expiries} expiries":
    "現物価格でのコール / プット · プット/コール {ratio} · オプション{options}件、満期{expiries}件",
  "calls / puts at the spot · put/call {ratio} · {options} options, one expiry":
    "現物価格でのコール / プット · プット/コール {ratio} · オプション{options}件、満期1件",
  "By expiry": "満期別",
  Expiry: "満期",
  Left: "残り",
  Options: "オプション数",
  "Call OI ({unit})": "コール建玉（{unit}）",
  "Put OI ({unit})": "プット建玉（{unit}）",
  Net: "ネット",
  "Of the chain's exposure, either sign counted":
    "全体のエクスポージャーに占める割合（プラスもマイナスも計上）",
  Share: "比率",
  "Exposure in dollars per 1% move. Expiries outside the chosen range are dimmed. Every Deribit option expires at 08:00 UTC; one in its last hour is left out.":
    "エクスポージャーは1%変動あたりのドル額です。選択範囲外の満期は薄く表示します。Deribit のオプションはすべて 08:00 UTC に満期を迎え、最後の1時間に入ったものは除外しています。",
  "Gamma exposure is how much of the underlying the holders of its options would have to buy or sell to stay hedged for a 1% move in price: each option's gamma times its open interest, per 1% move in the currency the contract pays, added up by strike.":
    "ガンマエクスポージャーとは、価格が1%動いたときに、オプションの保有者がヘッジを保つために売買しなければならない原資産の量です：各オプションのガンマに建玉を掛け、契約の決済通貨での1%変動あたりの額にして、行使価格ごとに合計したものです。",
  "Calls count positive and puts negative. That is the standard reading, and an assumption: it takes dealers to be long the calls customers sold them and short the puts customers bought. No exchange publishes who holds which side, so every signed figure here rests on it; where open interest and gamma sit does not.":
    "コールをプラス、プットをマイナスとして数えます。これは標準的な読み方であり、ひとつの仮定です：ディーラーは顧客が売ったコールをロングし、顧客が買ったプットをショートしているとみなします。どちらの側を誰が保有しているかを公表する取引所はないため、ここにある符号付きの数値はすべてこの仮定に基づきます。建玉とガンマがどこにあるかは、この仮定に左右されません。",
  "Positive net exposure means dealers sell into rises and buy into falls, which tends to damp moves; negative means they chase the price, which tends to add to them. The flip is where the net would change sign were the spot to move there, and the line shows the net at every such price. The walls are the strikes holding the most call and put gamma.":
    "ネットエクスポージャーがプラスなら、ディーラーは上昇局面で売り、下落局面で買うため、値動きを抑える傾向があります。マイナスなら価格を追いかけるため、値動きを増幅する傾向があります。フリップは、現物価格がそこまで動いた場合にネットの符号が変わる価格で、線はそれぞれの価格でのネットを示します。ウォールは、コールとプットのガンマが最も集中する行使価格です。",
  "Crypto: Deribit's BTC and ETH books, which hold most listed crypto options; Bybit, OKX and Binance list far fewer and are not included. Open interest, mark volatility and each expiry's forward are Deribit's own; gamma is computed from them with Black-76, which reproduces Deribit's own delta and vega. Read every five minutes.":
    "暗号資産：Deribit の BTC と ETH のオプション。上場している暗号資産オプションの大半を占めます。Bybit、OKX、Binance の上場数ははるかに少なく、含めていません。建玉、マークボラティリティ、各満期のフォワードは Deribit 自身のもので、ガンマはそこから Black-76 で計算しており、Deribit 自身のデルタとベガを再現します。5分ごとに取得します。",
  "United States: Cboe's 15-minute delayed chains for the S&amp;P 500, Nasdaq-100 and Russell 2000 indexes and the most traded ETFs and stocks, with Cboe's own volatility and open interest, the spot taken as the forward. Read every 15 minutes through the US session; outside it the figures are the last session's.":
    "米国：Cboe の15分遅延のオプションチェーン。S&amp;P 500、ナスダック100、ラッセル2000 の各指数と、取引の多い ETF・個別株が対象で、ボラティリティと建玉は Cboe 自身のもの、フォワードには現物価格を用います。米国の取引時間中は15分ごとに取得し、時間外は直前のセッションの数値です。",
  "Asia-Pacific and Europe: each exchange's end-of-day file, read once after it is published -- HKEX (Hang Seng indexes), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, its three nearest months), ASX (S&amp;P/ASX 200), NSE and BSE (Nifty, Sensex) and Eurex (Euro Stoxx 50, DAX, SMI). They publish settlement prices and open interest but no volatility, so each strike's is backed out of its out-of-the-money settlement (for ASX, its closing theoretical price) with Black-76, against the forward that put-call parity or the exchange's own future gives. Their figures are in the currency the contract pays, and as of that day's close.":
    "アジア太平洋と欧州：各取引所の日次ファイルを、公開後に1回取得します：HKEX（ハンセン系指数）、CFFEX（CSI 300、上証50、CSI 1000）、TAIFEX（台湾加権指数）、JPX（日経225、直近3限月）、ASX（S&amp;P/ASX 200）、NSE と BSE（ニフティ、センセックス）、Eurex（ユーロ・ストックス50、DAX、SMI）。これらは決済価格と建玉を公表しますがボラティリティは公表しないため、各行使価格のボラティリティはアウト・オブ・ザ・マネーの決済価格（ASX は引け時点の理論価格）から Black-76 で逆算し、フォワードにはプット・コール・パリティまたは取引所自身の先物を用います。数値は契約の決済通貨建てで、その日の終値時点のものです。",
  "The options data could not be read right now.": "現在オプションデータを読み込めません。",
  "No gamma exposure has been computed for {currency} yet.":
    "{currency} のガンマエクスポージャーはまだ計算されていません。",
  "{source}'s {currency} options were last read {ago}, too long ago to show as current positioning.":
    "{source} の {currency} オプションの最終取得は{ago}で、現在のポジションとして表示するには古すぎます。",
  "Not updated since {ago}: the latest read of {source} failed, so these figures are that old.":
    "{ago}から更新されていません：{source} の最新の取得に失敗したため、数値はその時点のものです。",
  "Not updated since {ago}: nothing newer has been read from {source}, a holiday or a failed read, so these figures are that old.":
    "{ago}から更新されていません：{source} から新しいデータを取得できていないため（休場または取得失敗）、数値はその時点のものです。",
  "No expiry in this range": "この範囲に満期はありません",
  "No {currency} option expires in this range; the nearest expires {date}.":
    "この範囲に満期を迎える {currency} オプションはありません。最も近い満期は{date}です。",
  "No strike has open interest in this range.": "この範囲に建玉のある行使価格はありません。",
  "Calls positive, puts negative: dealers assumed long calls and short puts, since no exchange publishes who holds which side. {source} options, {asof}.":
    "コールはプラス、プットはマイナス：どちらの側を誰が保有しているかを公表する取引所はないため、ディーラーはコールをロング、プットをショートしていると仮定しています。{source} オプション、{asof}。",
  "read {ago}": "{ago}に取得",
  "15-minute delayed, read {ago}": "15分遅延、{ago}に取得",
  "from the end-of-day file for {date}": "{date}の日次ファイルより",
  expired: "満期済み",
  "Call OI": "コール建玉",
  "Put OI": "プット建玉",
  "Exposure in {unit} per 1% move; open interest at its value at the spot. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "エクスポージャーは1%変動あたりの {unit} 建て、建玉は現物価格での評価額です。選択範囲外の満期は薄く表示し、最後の1時間に入ったオプションは除外しています。",
  // The book picker.
  "Pick an option book": "原資産を選択",
  "{n} books": "原資産{n}件",
  "Filter books": "原資産を絞り込み",
  Book: "原資産",
  "Net gamma": "ネットガンマ",
  "Every expiry, per 1% move, in the currency the contract pays":
    "全満期、1%変動あたり、契約の決済通貨建て",
  "Calls / puts": "コール / プット",
  Flip: "フリップ",
  "Where net gamma changes sign, from the spot":
    "ネットガンマの符号が変わる価格の、現物価格からの距離",
  "As of": "時点",
  "No book matches.": "一致する原資産はありません。",
  "calls {calls} · puts {puts}": "コール {calls} · プット {puts}",
  "close {date}": "{date}終値",
  Crypto: "暗号資産",
  "United States": "米国",
  "Asia-Pacific": "アジア太平洋",
  Europe: "欧州",
  Other: "その他",
  Bitcoin: "ビットコイン",
  Ether: "イーサリアム",
  "S&P 500": "S&P 500",
  "Nasdaq-100": "ナスダック100",
  "Russell 2000": "ラッセル2000",
  "SPDR S&P 500 ETF": "SPDR S&P 500 ETF",
  "Invesco QQQ": "インベスコ QQQ",
  "iShares Russell 2000 ETF": "iシェアーズ ラッセル2000 ETF",
  "SPDR Gold Shares": "SPDR ゴールド・シェア",
  "iShares Silver Trust": "iシェアーズ シルバー・トラスト",
  "United States Oil Fund": "米国原油ファンド",
  "iShares Bitcoin Trust": "iシェアーズ ビットコイン・トラスト",
  "iShares Ethereum Trust": "iシェアーズ イーサリアム・トラスト",
  Strategy: "ストラテジー",
  Coinbase: "コインベース",
  NVIDIA: "エヌビディア",
  Tesla: "テスラ",
  Micron: "マイクロン",
  "Hang Seng": "ハンセン指数",
  "Hang Seng China Enterprises": "ハンセン中国企業株指数",
  "Hang Seng TECH": "ハンセンテック指数",
  "CSI 300": "CSI 300",
  "SSE 50": "上証50",
  "CSI 1000": "CSI 1000",
  TAIEX: "台湾加権指数",
  "Nikkei 225": "日経225",
  "S&P/ASX 200": "S&P/ASX 200（豪州）",
  "Nifty 50": "ニフティ50",
  "Nifty Bank": "ニフティ・バンク",
  "BSE Sensex": "BSE センセックス",
  "Euro Stoxx 50": "ユーロ・ストックス50",
  DAX: "DAX",
  "Swiss Market Index": "スイス・マーケット指数",
  // Chart readout (slot-chart.ts).
  "strike {strikes} ({pct} from spot)": "行使価格 {strikes}（現物価格から {pct}）",
  "{low} – {high} ({pct} from spot)": "{low} – {high}（現物価格から {pct}）",
  "no open interest here": "ここに建玉なし",
  "calls {usd} ({oi} open)": "コール {usd}（建玉 {oi}）",
  "puts {usd} ({oi} open)": "プット {usd}（建玉 {oi}）",
  "net {usd}": "ネット {usd}",
  "if the spot were here: net {usd}": "現物価格がここなら：ネット {usd}",
  "Expected price move": "予想価格変動幅",
  "1 day ahead": "1日先",
  "1 week ahead": "1週間先",
  "30 days ahead": "30日先",
  "to the {date} expiry": "{date} 満期まで",
  "IV {iv}": "IV {iv}",
  "ATM IV": "ATM IV",
  "Implied volatility at the expiry's forward, a year":
    "満期のフォワード価格でのインプライド・ボラティリティ（年率）",
  "closed inside 1σ on {one} and 2σ on {two} of days since {year}":
    "{year} 年以降、{one} の日が 1σ 内、{two} が 2σ 内で終了",
  "expected move, 1σ and 2σ, {horizon}": "予想変動幅 1σ・2σ、{horizon}",
  "spot · {source} IV": "現物価格 · {source} の IV",
  "One standard deviation is the price × IV × √(days/365), from each expiry's at-the-money implied volatility (between two expiries, their total variance interpolated). The walls are one and two deviations either side of the spot. A normal distribution ends inside them 68% and 95% of the time; real prices have fatter tails, and options usually price in more movement than follows.":
    "1標準偏差＝価格 × IV × √(日数/365)。各満期の ATM インプライド・ボラティリティから求め、満期と満期の間は総分散を補間します。ウォールは現物価格の上下1標準偏差と2標準偏差の位置です。正規分布なら68%と95%の確率でその内側に収まりますが、実際の価格は裾が厚く、オプションは通常その後の実際の値動きより大きな変動を織り込みます。",
  "The last line of a branch is how often it really did, from Deribit's 30-day volatility index (DVOL) and the perpetual's daily settlement: one 30-day IV for every horizon, and overlapping windows, so frequencies rather than independent trials.":
    "各ブランチの最後の行は実際にそうなった頻度で、Deribit の30日ボラティリティ指数（DVOL）と無期限先物の日次決済価格から求めています。どの期間にも同じ30日 IV を使い、期間が重なり合うため、独立した試行ではなく頻度です。",
  "The expected move is the range the options have priced in: one standard deviation is the price times the at-the-money implied volatility times the square root of the days ahead over 365, and the walls sit one and two deviations either side of the spot. The chart draws them for the chosen expiries (30 days ahead for all of them); the mind map under it gives every horizon. They are not support or resistance, only the market's own estimate of how far price may travel.":
    "予想変動幅はオプションが織り込んでいる範囲です。1標準偏差は価格 × ATM インプライド・ボラティリティ × √(先の日数/365) で、ウォールは現物価格の上下1標準偏差と2標準偏差の位置にあります。チャートは選んだ満期範囲について描き（全満期では30日先）、その下のマインドマップがすべての期間を示します。サポートやレジスタンスではなく、価格がどこまで動きうるかについての市場自身の見積もりです。",
};
