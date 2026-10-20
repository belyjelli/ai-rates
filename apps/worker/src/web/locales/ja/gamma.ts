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
  reference: "基準",
  Level: "水準",
  "From the reference": "基準からの距離",
  "the next session": "次の取引時間",
  "{date}, from 08:00 UTC": "{date}、08:00 UTC から",
  "{date} session": "{date} の取引時間",
  "no trade yet today": "今日はまだ取引なし",
  "above it now": "いまは上抜け",
  "below it now": "いまは下抜け",
  "reached it today and back inside": "今日タッチしてから内側に戻った",
  "inside all day so far": "今日はここまでずっと内側",
  "No history is kept for this book's walls yet, so its 90% wall is the normal distribution's 1.645 standard deviations of the options' own IV, not a measured one. Its record starts with its first day below.":
    "この原資産のウォールにはまだ履歴がないため、90% ウォールは実測ではなく、オプション自身の IV に対する正規分布の 1.645 標準偏差です。記録は下の最初の日から始まります。",
  "Measured on {days} sessions since {since} {year}, against Cboe's 1-day VIX: the S&amp;P 500 closed inside one standard deviation on {inside1}, and within {k90} of them on 90%, so that is where the 90% wall sits. Cboe's free history has the index's closes only, so touches of a wall during the day are not counted here; this book's own record below counts them.":
    "{since} {year} 以降の {days} 取引時間を Cboe の 1 日 VIX と比べて測定：S&amp;P 500 が 1 標準偏差の内側で引けたのは {inside1}、90% は {k90} 標準偏差の内側で引けたため、90% ウォールはそこに置いています。Cboe の無料の履歴は指数の終値だけなので、日中のウォールへのタッチはここでは数えていません。下のこの原資産自身の記録では数えます。",
  "Measured on {days} Deribit days since {since} {year}, against the 30-day volatility index (DVOL) as each day began: the whole day stayed within {k90} standard deviations on 90% of days, so that is where the 90% wall sits. Within one, the whole day stayed on {inside1} and the close on {close1}. A touch of the 1σ wall closed back inside {rev1} of {touch1} times; a touch of the 90% wall, {rev90} of {touch90} times.":
    "{since} {year} 以降の {days} の Deribit の日を、各日の始まりの 30 日ボラティリティ指数（DVOL）と比べて測定：90% の日は一日中 {k90} 標準偏差の内側にとどまったため、90% ウォールはそこに置いています。1 標準偏差の内側にとどまったのは、一日中で {inside1}、終値で {close1}。1σ ウォールへのタッチのうち内側で引けたのは {touch1} 回中 {rev1}、90% ウォールへのタッチでは {touch90} 回中 {rev90}。",
  "not reached": "届かず",
  "reached, closed back inside": "タッチして内側で引けた",
  "closed beyond": "外側で引けた",
  "above: {what}": "上：{what}",
  "below: {what}": "下：{what}",
  "The IV wall is the move the options price for the day: the reference close plus and minus one standard deviation, the close times the options' implied volatility a day ahead times the square root of 1/365. The levels are fixed when the day begins (Deribit's day at 08:00 UTC, a US session at its first read) so they do not drift through the day.":
    "IV ウォールはオプションがその日に織り込む値動きです。基準の終値の上下 1 標準偏差で、終値 × 1 日先のオプションのインプライド・ボラティリティ × √(1/365)。水準はその日の始まりに固定され（Deribit の日は 08:00 UTC、米国の取引時間は最初の読み取り）、日中に動きません。",
  "The 90% wall is where history says price stayed: the multiple of a day's standard deviation that held on 90% of past days. BTC and ETH are measured on every Deribit day since 2021 against DVOL, their whole day's range; the S&amp;P 500 on every session since 2022 against Cboe's 1-day VIX, closes only. A book with no history uses the normal distribution's 1.645.":
    "90% ウォールは過去に価格がとどまった範囲です。過去の日の 90% で破られなかった、1 日の標準偏差の倍数。BTC と ETH は 2021 年以降のすべての Deribit の日を DVOL と比べて一日の値幅で、S&amp;P 500 は 2022 年以降のすべての取引時間を Cboe の 1 日 VIX と比べて終値だけで測定しています。履歴のない原資産は正規分布の 1.645 を使います。",
  "A wall is a probability, not a promise: a touch of the IV wall has closed back inside a little over half the time, not nine times in ten. The record under the ladder shows each day's outcome for this book.":
    "ウォールは確率であって約束ではありません。IV ウォールへのタッチが内側に戻ったのは半分を少し上回る程度で、10 回に 9 回ではありません。ラダーの下の記録に、この原資産の毎日の結果を示します。",
  "{currency}'s options carry no implied volatility to draw walls from yet.":
    "{currency} のオプションには、まだウォールを引くためのインプライド・ボラティリティがありません。",
  "1.645 standard deviations of the options' IV (normal distribution)":
    "オプションの IV の 1.645 標準偏差（正規分布）",
  "{k90} standard deviations of {method} {sigma}, measured":
    "{method} {sigma} の {k90} 標準偏差（実測）",
  "IV wall, 1σ": "IV ウォール、1σ",
  "±{move} (±{pct}) from IV {iv} a day ahead": "±{move}（±{pct}）、1 日先の IV {iv} から",
  "90% wall": "90% ウォール",
  "The day so far": "今日ここまで",
  Reference: "基準",
  "high {high} · low {low}": "高値 {high} · 安値 {low}",
  "IV wall: {status}": "IV ウォール：{status}",
  "the latest close, for the next session": "最新の終値、次の取引時間向け",
  "Reference close": "基準の終値",
  "{currency} · {source} options · IV walls · {day}":
    "{currency} · {source} のオプション · IV ウォール · {day}",
  "The day's range": "その日の値幅",
  "IV wall": "IV ウォール",
  "90% wall, above": "90% ウォール、上",
  "IV wall, above": "IV ウォール、上",
  "1σ of the options' IV": "オプションの IV の 1σ",
  "IV wall, below": "IV ウォール、下",
  "90% wall, below": "90% ウォール、下",
  "{currency} comes from an end-of-day file, so its walls are for the next session and are not kept day by day.":
    "{currency} は引け後のファイルから読むため、ウォールは次の取引時間向けで、日ごとには記録しません。",
  "{currency}'s own record starts with today; each finished day is added here.":
    "{currency} 自身の記録は今日から始まります。終わった日ごとにここへ加わります。",
  "{currency}'s own record, {days} finished days since {since}. IV wall: touched {reached}, closed back inside {held}. 90% wall: touched {reached90}, closed back inside {held90}.":
    "{currency} 自身の記録、{since} 以降の終わった {days} 日。IV ウォール：タッチ {reached}、内側で引けた {held}。90% ウォール：タッチ {reached90}、内側で引けた {held90}。",
  "High / low": "高値 / 安値",
  Close: "終値",
  "At the IV wall": "IV ウォールで",
  "At the 90% wall": "90% ウォールで",
  "How price has behaved at the walls": "ウォールでの値動き",
  "Prices in {unit}. {source} options, read {ago}.":
    "価格は {unit} 建て。{source} のオプション、{ago}に読み取り。",
  "Two readings of where the market makers stand, side by side, for the nearest expiry. The gamma ceiling is the strike above the spot holding the most call gamma, and the gamma floor the strike below it holding the most put gamma: where hedging flows are largest.":
    "直近満期について、マーケットメーカーの位置を 2 通りの読み方で並べます。ガンマの天井は現物価格より上でコールのガンマが最も多い行使価格、ガンマの底は現物価格より下でプットのガンマが最も多い行使価格です。ヘッジの流れが最も大きい場所です。",
  "The dealer range reads every option as sold by dealers who keep the premium, as max pain does: at expiry they pay out what the options are worth, so they earn most at the max pain strike and start losing beyond the break-evens either side, the dealer ceiling and floor. No exchange publishes who sold what, so this rests on that assumption, and the Gamma Exposure tab's sign assumes the opposite for calls.":
    "ディーラーのレンジは、マックスペインと同じく、すべてのオプションをプレミアムを受け取るディーラーが売ったものとして読みます。満期にオプションの価値を支払うので、マックスペインの行使価格で最も儲かり、両側の損益分岐点、つまりディーラーの天井と底を越えると損をし始めます。誰が何を売ったかを公表する取引所はないため、この前提に立っており、ガンマエクスポージャーのタブの符号はコールについて逆を仮定しています。",
  "A ceiling or floor within a quarter of the day's move of an IV wall is marked as lined up with it. Whether price turns there more often than elsewhere is what the record under the ladder is for: it starts with this tab and grows a day at a time.":
    "IV ウォールからその日の値動きの 4 分の 1 以内にある天井や底は、ウォールと重なると表示します。価格がほかよりそこで反転しやすいかは、ラダーの下の記録が答えます。記録はこのタブから始まり、1 日ずつ増えます。",
  "gamma ceiling": "ガンマの天井",
  "dealer ceiling": "ディーラーの天井",
  "gamma floor": "ガンマの底",
  "dealer floor": "ディーラーの底",
  "Gamma ceiling / floor": "ガンマの天井 / 底",
  "the strikes holding the most call gamma above the spot and put gamma below it, expiring {expiry}":
    "現物価格の上でコールのガンマ、下でプットのガンマが最も多い行使価格、{expiry} 満期",
  "Dealer ceiling / floor": "ディーラーの天井 / 底",
  "where dealers who sold every option of that expiry break even; max pain {pain}":
    "その満期のオプションをすべて売ったディーラーの損益分岐点。マックスペイン {pain}",
  "Lined up with an IV wall": "IV ウォールと重なる",
  "within a quarter of the day's 1σ move ({band}) of an IV wall or a 90% wall":
    "IV ウォールまたは 90% ウォールから、その日の 1σ の値動きの 4 分の 1（{band}）以内",
  "max pain": "マックスペイン",
  "{currency} · {source} options · ceiling and floor · expiring {expiry}":
    "{currency} · {source} のオプション · 天井と底 · {expiry} 満期",
  "dealer ceiling and floor": "ディーラーの天井と底",
  "lined up with a wall": "ウォールと重なる",
  "Dealer range by expiry": "満期別のディーラーのレンジ",
  Premium: "プレミアム",
  "Dealer floor": "ディーラーの底",
  "Max pain": "マックスペイン",
  "Dealer ceiling": "ディーラーの天井",
  "From the spot": "現物価格から",
  "Lined up with a wall": "ウォールと重なる",
  "{currency} comes from an end-of-day file, so its levels are for the next session and are not kept day by day.":
    "{currency} は引け後のファイルから読むため、水準は次の取引時間向けで、日ごとには記録しません。",
  Days: "日数",
  Reached: "タッチ",
  "Closed back inside": "内側で引けた",
  "Over {days} finished days since {since}, both sides counted; a level is reached when the day's high (or low) touches it, and held when the day closes back inside it.":
    "{since} 以降の終わった {days} 日、両側を数えています。その日の高値（または安値）が触れればタッチ、その日がその内側で引ければ維持です。",
  "How price has behaved at these levels": "これらの水準での値動き",
  "IV Walls": "IV ウォール",
  "IV walls": "IV ウォール",
  "Ceiling & Floor": "天井と底",
  Ceiling: "天井",
  "the spot now": "いまの現物価格",
  "week from {date}": "{date} からの週",
  "Levels for": "水準の期間",
  "The Day and Week switch reads the same levels for the nearest expiry or for the week's: Deribit's Friday 08:00 UTC weekly, or a US book's last expiry of the week. The week's levels are fixed by its first read, its IV walls span the time to that expiry, and its 90% wall is measured on whole past weeks where there is history.":
    "日と週の切り替えは、同じ水準を直近満期か、その週の満期で読みます。Deribit の金曜 08:00 UTC の週次、または米国の原資産のその週最後の満期です。週の水準はその週の最初の読み取りで固定され、IV ウォールはその満期までの時間にわたり、90% ウォールは履歴がある場合、過去の丸一週間で測定します。",
  "the strikes holding the most call gamma above the spot and put gamma below it, in everything expiring by {expiry}":
    "{expiry} までに満期を迎えるすべてのオプションで、現物価格の上でコールのガンマ、下でプットのガンマが最も多い行使価格",
  "within a quarter of the week's 1σ move ({band}) of an IV wall or a 90% wall":
    "IV ウォールまたは 90% ウォールから、その週の 1σ の値動きの 4 分の 1（{band}）以内",
  "The week so far": "今週ここまで",
  "the spot now; this week's levels are fixed by its first read":
    "いまの現物価格。今週の水準は今週最初の読み取りで固定されます",
  "{currency}'s weekly record starts with this week; each finished week is added here.":
    "{currency} の週次の記録は今週から始まります。終わった週ごとにここへ加わります。",
  Weeks: "週数",
  "Over {weeks} finished weeks since {since}, both sides counted; a level is reached when the week's high (or low) touches it, and held when the week closes back inside it.":
    "{since} 以降の終わった {weeks} 週、両側を数えています。その週の高値（または安値）が触れればタッチ、その週がその内側で引ければ維持です。",
  "{currency} · {source} options · IV walls day by day":
    "{currency} · {source} のオプション · IV ウォールの日次推移",
  "{currency} · {source} options · ceiling and floor day by day":
    "{currency} · {source} のオプション · 天井と底の日次推移",
  "daily candle": "日足",
  "week's expiry": "週次満期",
  "Each day's candle under the walls it opened with. The walls are fixed by the day's first read, so they move only from one day to the next.":
    "各日のローソク足を、その日の始まりのウォールの下に描きます。ウォールはその日の最初の読み取りで固定されるため、動くのは日が変わるときだけです。",
  "Each day's candle under the levels it opened with. They are fixed by the day's first read, so they move only from one day to the next; the dotted rule marks each week's expiry.":
    "各日のローソク足を、その日の始まりの水準の下に描きます。水準はその日の最初の読み取りで固定されるため、動くのは日が変わるときだけです。点線は各週の満期を示します。",
  "Each day's candle under its week's levels. They are fixed by the week's first read, so they move only at a week's expiry, the dotted rule.":
    "各日のローソク足を、その週の水準の下に描きます。水準はその週の最初の読み取りで固定されるため、動くのは週の満期（点線）のときだけです。",
  // The Delta, Vega and Theta tabs (web/greeks.ts).
  Delta: "デルタ",
  "{currency} · {source} options · delta by strike · {scope}":
    "{currency} · {source} オプション · 行使価格別デルタ · {scope}",
  "{currency} · {source} options · vega by strike · {scope}":
    "{currency} · {source} オプション · 行使価格別ベガ · {scope}",
  "{currency} · {source} options · theta by strike · {scope}":
    "{currency} · {source} オプション · 行使価格別セータ · {scope}",
  "net {net} at spot {spot} · calls above zero, puts below · hover or tap a strike to read it":
    "現物価格 {spot} でのネット {net} · コールはゼロより上、プットは下 · 行使価格にカーソルを合わせるかタップで表示",
  "{total} per IV point at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "現物価格 {spot} で IV 1ポイントあたり {total} · 各行使価格のコールとプットを積み上げ · 行使価格にカーソルを合わせるかタップで表示",
  "{total} a day at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "現物価格 {spot} で1日あたり {total} · 各行使価格のコールとプットを積み上げ · 行使価格にカーソルを合わせるかタップで表示",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of the total.":
    "現物価格の ±{pct} より外の行使価格はチャート外です：合計のうち {usd}。",
  "total {usd}": "合計 {usd}",
  "{share} of it in that expiry, {left} left": "その満期に {share}、残り {left}",
  "≈ {coins} at the spot; what the open options move like, as their buyers hold them":
    "現物価格で約 {coins}。未決済オプションが買い手にとって原資産いくら分の値動きをするか",
  "what the open options move like, as their buyers hold them":
    "未決済オプションが買い手にとって原資産いくら分の値動きをするか",
  "Net delta": "ネットデルタ",
  "calls' delta is positive, puts' negative": "コールのデルタはプラス、プットはマイナス",
  "Most delta": "デルタ最大",
  Vega: "ベガ",
  "per IV point: what the open options gain if implied volatility rises one point, and their writers lose":
    "IV 1ポイントあたり：インプライド・ボラティリティが1ポイント上がったときに未決済オプションが得る額で、売り手はその分を失います",
  "every option gains as implied volatility rises":
    "インプライド・ボラティリティが上がると、どのオプションも値上がりします",
  "Most vega": "ベガ最大",
  "of the options' value a day, {premium} in all":
    "オプション価値に対する1日あたりの割合、総額 {premium}",
  Theta: "セータ",
  "a day: what the open options lose to time with price and IV unchanged, paid by their buyers to their writers":
    "1日あたり：価格と IV が変わらないとき、時間の経過で未決済オプションが失う額。買い手から売り手へ支払われます",
  "every option loses value as expiry nears, faster the closer it is":
    "どのオプションも満期が近づくほど価値を失い、近いほど速くなります",
  "Most theta": "セータ最大",
  "Decay rate": "減価率",
  "Delta in {unit}: the value of the underlying each expiry's open options move like. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "デルタは {unit} 建て：各満期の未決済オプションが原資産いくら分の値動きをするか。選択範囲外の満期は薄く表示し、最後の1時間に入ったオプションは除外しています。",
  "Vega in {unit} per IV point. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "ベガは IV 1ポイントあたりの {unit} 建て。選択範囲外の満期は薄く表示し、最後の1時間に入ったオプションは除外しています。",
  "Theta in {unit} a day. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "セータは1日あたりの {unit} 建て。選択範囲外の満期は薄く表示し、最後の1時間に入ったオプションは除外しています。",
  "Of the chain's total, either side counted": "全体の合計に占める割合（両サイドを計上）",
  Total: "合計",
  "Delta is how much an option's value moves with the underlying: about a half at the money, near 1 deep in the money and near 0 far out of it, negative for puts. Times open interest and the forward, it is the value of the underlying the open options move like, added up by strike.":
    "デルタは、原資産の値動きに対してオプション価値がどれだけ動くかです。アット・ザ・マネーで約半分、ディープ・イン・ザ・マネーで1に近く、遠いアウト・オブ・ザ・マネーで0に近く、プットではマイナスです。建玉とフォワードを掛けると、未決済オプションが原資産いくら分の値動きをするかになり、行使価格ごとに合計します。",
  "It is read from the side of whoever bought the options: calls positive, puts negative. Whoever wrote them holds exactly the opposite, so were every writer hedged, their hedges would hold this much of the underlying. Nothing here assumes who is on which side, unlike gamma exposure.":
    "オプションを買った側から読んでいます：コールはプラス、プットはマイナス。売った側はちょうど反対を持つので、売り手が全員ヘッジしていれば、そのヘッジはこれだけの原資産を持つことになります。ガンマエクスポージャーと違い、誰がどちら側かは何も仮定していません。",
  "Most delta sits in options already in the money, away from the spot, so this chart often reaches wider than the gamma chart.":
    "デルタの大半はすでにイン・ザ・マネーで現物価格から離れたオプションにあるため、このチャートはガンマのチャートより広い範囲に及ぶことがよくあります。",
  "Vega is how much an option's value moves when implied volatility moves one point, say from 40% to 41%: largest at the money and for options with long to run. Times open interest, it is what the open options gain if IV rises a point, added up by strike.":
    "ベガは、インプライド・ボラティリティが1ポイント（たとえば40%から41%）動いたときのオプション価値の変化です。アット・ザ・マネーと残存期間の長いオプションで最大になります。建玉を掛けると、IV が1ポイント上がったときに未決済オプションが得る額になり、行使価格ごとに合計します。",
  "Every option carries positive vega for whoever bought it and the same amount negative for whoever wrote it, so the total is what option writers stand to lose if IV rises a point, and gain if it falls one.":
    "どのオプションも買い手にはプラスのベガ、売り手には同じ大きさのマイナスのベガがあるため、合計は IV が1ポイント上がったときにオプションの売り手が失いうる額で、1ポイント下がれば得る額です。",
  "Theta is how much an option's value falls in a day with price and implied volatility unchanged: largest at the money and in an option's last days. Times open interest, it is what the open options lose in a day, added up by strike.":
    "セータは、価格とインプライド・ボラティリティが変わらないときにオプション価値が1日で下がる額です。アット・ザ・マネーと満期直前の数日で最大になります。建玉を掛けると、未決済オプションが1日で失う額になり、行使価格ごとに合計します。",
  "Buyers pay it and writers collect it: the total is roughly what option writers earn in a quiet day, the carry they are paid for taking on gamma. The decay rate divides it by what the options in range are worth.":
    "買い手が支払い、売り手が受け取ります：合計はおおよそ、オプションの売り手が静かな1日に稼ぐ額で、ガンマを引き受ける対価です。減価率は、これを選択範囲のオプションの価値で割ったものです。",
  "The same books and reads as Gamma Exposure: Deribit's BTC and ETH every five minutes, Cboe's US chains every 15 minutes through the session, and the exchanges' end-of-day files for Asia-Pacific and Europe. Each option's Greeks are Black-76 at a zero rate on its own open interest, implied volatility and forward, in the currency the contract pays; they reproduce Deribit's own to within 0.03%.":
    "ガンマエクスポージャーと同じ原資産と取得です：Deribit の BTC と ETH は5分ごと、Cboe の米国チェーンは取引時間中15分ごと、アジア太平洋と欧州は各取引所の日次ファイル。各オプションのグリークスは、そのオプション自身の建玉、インプライド・ボラティリティ、フォワードから Black-76（金利ゼロ）で計算し、契約の決済通貨建てです。Deribit 自身の値を0.03%以内で再現します。",
  "Delta as the options' buyers hold it: calls positive, puts negative; whoever wrote them holds the opposite. {source} options, {asof}.":
    "オプションの買い手が持つデルタ：コールはプラス、プットはマイナス。売り手はその反対を持ちます。{source} オプション、{asof}。",
  "Vega as the options' buyers hold it, per point of implied volatility; whoever wrote them holds the opposite. {source} options, {asof}.":
    "オプションの買い手が持つベガ、インプライド・ボラティリティ1ポイントあたり。売り手はその反対を持ちます。{source} オプション、{asof}。",
  "Theta as the options' buyers hold it, per day; whoever wrote them collects it. {source} options, {asof}.":
    "オプションの買い手が持つセータ、1日あたり。売り手がそれを受け取ります。{source} オプション、{asof}。",
  "Delta, vega and theta have not been computed for {currency} yet; they arrive with its next read.":
    "{currency} のデルタ、ベガ、セータはまだ計算されていません。次の取得で表示されます。",
  // The Gamma Exposure tab's By expiry chart (web/gamma.ts) and its readout (web/slot-chart.ts).
  "Each expiry's calls above zero and its puts below, at their value at the spot":
    "各満期のコールをゼロより上、プットを下に、現物価格での評価額で表示",
  "Each expiry's gamma exposure: calls above zero, puts below":
    "各満期のガンマエクスポージャー：コールはゼロより上、プットは下",
  gamma: "ガンマ",
  "Each expiry's at-the-money implied volatility: the term structure":
    "各満期のアット・ザ・マネーのインプライド・ボラティリティ：期間構造",
  show: "表示",
  "{n} expiries · open interest {calls} in calls, {puts} in puts · hover or tap an expiry to read it":
    "満期{n}件 · 建玉はコール {calls}、プット {puts} · 満期にカーソルを合わせるかタップで表示",
  "{currency} · {source} options · by expiry": "{currency} · {source} オプション · 満期別",
  "{currency} expiries; arrow keys read one at a time": "{currency} の満期。矢印キーで1つずつ表示",
  "One bar per expiry in date order, so the gaps between them are not to scale; expiries outside the chosen range are dimmed.":
    "満期ごとに1本のバーを日付順に並べているため、間隔は時間に比例しません。選択範囲外の満期は薄く表示しています。",
  "{date}, {left} left": "{date}、残り {left}",
  "{n} options": "オプション{n}件",
  "calls {oi} open": "コール建玉 {oi}",
  "puts {oi} open": "プット建玉 {oi}",
  "put/call {ratio}": "プット/コール {ratio}",
  "gamma {calls} / {puts}, net {net}": "ガンマ {calls} / {puts}、ネット {net}",
  "ATM IV {iv}": "ATM IV {iv}",
  "max pain {price}": "マックスペイン {price}",
  "dealer range {low} – {high}": "ディーラーレンジ {low} – {high}",
  "premium {usd}": "プレミアム {usd}",
};
