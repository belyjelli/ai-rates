/**
 * Japanese for the site-wide pieces and the small pages: web/about.ts, web/legal.ts and web/tos.ts
 * (their notice only -- the bodies stay English), web/referral-links.ts, web/referral.ts,
 * web/install.ts, web/share.ts, web/await.ts and web/tabs.ts. Glossary and style: ./index.ts.
 *
 * Terms: referral link 紹介リンク, referral code 紹介コード, commission 報酬, sign up 登録, open an
 * account 口座を開設, the reader あなた (only where the English addresses them), cite 引用,
 * release notes 更新履歴.
 */

import type { Catalog } from "../../i18n";

export const site: Catalog = {
  // web/about.ts
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
  "{month} {day}, {year}": "{year}年{month}{day}日",
  project: "プロジェクト",
  commit: "コミット",
  "not recorded": "記録なし",
  "This build did not record its commit. Deployed builds stamp the commit they were built from here.":
    "このビルドはコミットを記録していません。デプロイされたビルドでは、ビルド元のコミットがここに表示されます。",
  committed: "コミット日時",
  deployed: "デプロイ日時",
  "Release notes are written in English.": "更新履歴は英語で記載しています。",
  About: "サイトについて",
  "What airrates is, which version is running, and what has changed recently.":
    "airrates とは何か、稼働中のバージョン、最近の変更点。",
  "About airrates": "airrates について",
  "airrates is a funding-rate screener for perpetual futures. It reads funding from each exchange's public API every minute and shows where holding the same asset long on one exchange and short on another collects the gap between their rates, and what that has actually paid.":
    "airrates は無期限先物の資金調達率スクリーナーです。各取引所の公開 API から資金調達率を毎分読み取り、同じ資産をある取引所でロング、別の取引所でショートして両者のレート差を受け取れる組み合わせと、それが実際にいくら支払われたかを表示します。",
  "This version": "このバージョン",
  "Recent changes": "最近の変更",

  // web/legal.ts, web/tos.ts
  "This page is available in English only. The English text is the binding version.":
    "このページは英語版のみです。英語の本文が正式な版です。",

  // web/referral-links.ts
  "<b>Disclosure.</b> airrates may earn a commission if you open an account through a link on this page, at no extra cost to you. Referral links never affect which markets appear or how they are ranked. A listing here is not a recommendation: check that an exchange serves where you live before signing up, and remember that perpetual futures are leveraged and can lose more than your margin. {link}":
    "<b>開示。</b>このページのリンクから口座を開設すると airrates が報酬を受け取る場合がありますが、あなたに追加の費用はかかりません。紹介リンクが、表示される市場やその順位に影響することはありません。ここへの掲載は推奨ではありません：登録の前に、その取引所がお住まいの地域でサービスを提供しているか確認してください。また、無期限先物はレバレッジ取引であり、証拠金を超える損失が出る可能性があることに留意してください。{link}",
  "How referral links work": "紹介リンクの仕組み",
  "No referral links yet.": "紹介リンクはまだありません。",
  "Referral links are not shown in your location.":
    "お住まいの地域では紹介リンクを表示していません。",
  "None of these exchanges' referral links can be shown in your location.":
    "これらの取引所の紹介リンクは、お住まいの地域ではいずれも表示できません。",
  "The link applies the referral itself": "リンクから登録すると紹介が自動で適用されます",
  Exchange: "取引所",
  Type: "種類",
  "Referral code": "紹介コード",
  "Sign up": "登録",
  "{count} more exchange's link is not available in your location.":
    "ほか{count}件の取引所のリンクは、お住まいの地域では利用できません。",
  "{count} more exchanges' links are not available in your location.":
    "ほか{count}件の取引所のリンクは、お住まいの地域では利用できません。",
  "Referral links": "紹介リンク",
  "Referral links for the exchanges airrates tracks, for readers opening a new account.":
    "airrates が追跡している取引所の紹介リンク。新しく口座を開設する方向けです。",
  "The exchanges airrates has a referral link for. If you don't have an account on one yet, you can open it through the link.":
    "airrates が紹介リンクを用意している取引所です。まだ口座をお持ちでなければ、リンクから開設できます。",

  // web/referral.ts
  "How this works": "仕組み",
  "Referral link: Code {code}. airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "紹介リンク：コード {code}。このリンクから登録すると airrates が報酬を受け取る場合がありますが、あなたに費用はかかりません。{how}",
  "Referral link: airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "紹介リンク：このリンクから登録すると airrates が報酬を受け取る場合がありますが、あなたに費用はかかりません。{how}",
  "Open a {venue} account": "{venue} の口座を開設",

  // web/install.ts
  "Install the app": "アプリをインストール",
  "Install airrates": "airrates をインストール",
  "Opens in its own window, from your home screen.": "ホーム画面から、専用のウィンドウで開きます。",
  "Install app": "インストール",
  "Not now": "後で",

  // web/share.ts
  "Share the chart in view as an image sized for X": "表示中のチャートを X 向けサイズの画像で共有",
  chart: "チャート",
  "Quote this page's best line, with a link back to it":
    "このページの要点を引用し、このページへのリンクを添える",
  cite: "引用",
  "No chart on this view": "この表示にはチャートがありません",
  close: "閉じる",
  Copied: "コピーしました",
  "Select + copy": "選択してコピー",
  "Cite this page": "このページを引用",
  "Pick the line · the page's own numbers, as they read now": "文を選ぶ · このページの現在の数値",
  "Your post · edit it freely": "投稿文 · 自由に編集できます",
  "Back-link · this exact page, venue and filters":
    "リンク · このページ、取引所、フィルターをそのまま",
  Copy: "コピー",
  "Post on X": "X に投稿",
  "Copy line + link": "文とリンクをコピー",
  "Quote the number, link back to where it was read. Funding moves every minute, so the line says when it was true: {stamp}. Not financial advice.":
    "数値を引用し、読み取った場所へリンクしてください。資金調達率は毎分変わるため、文にはいつ時点の値かを記しています：{stamp}。投資助言ではありません。",
  "{count} characters left with the link": "リンク込みで残り{count}文字",
  "+{count} more": "ほか{count}件",
  "public venue APIs · not financial advice": "取引所の公開 API · 投資助言ではありません",
  "Share your line": "チャートを共有",
  "chart image": "チャート画像",
  "Image · 1600 × 900, X's own 16:9 — shows uncropped in the timeline. Right-click or long-press to save.":
    "画像 · 1600 × 900、X の 16:9 — タイムラインで切り取られずに表示されます。右クリックまたは長押しで保存できます。",
  "Copy image": "画像をコピー",
  "Download PNG": "PNG をダウンロード",
  "Link · this exact view": "リンク · この表示をそのまま",
  "Copy the image, press Post on X, paste it into the post. The card carries the address it came from; the link opens the same view. We never call direction — the numbers are the venues', the call is yours.":
    "画像をコピーし、「X に投稿」を押して投稿に貼り付けてください。画像には取得元のアドレスが入っており、リンクは同じ表示を開きます。方向は予想しません — 数値は取引所のもの、判断はあなたのものです。",
  "the image could not be drawn in this browser": "このブラウザでは画像を描画できませんでした",
  "Copy blocked — download instead": "コピーがブロックされました — ダウンロードしてください",

  // web/await.ts
  "Building report": "レポートを作成中",
  "Still building": "まだ作成中",

  // web/tabs.ts
  Sections: "セクション",

  // web/glossary.ts (and its entry in the footer menu and the shortcut map)
  terminology: "用語集",
  Terminology: "用語集",
  "Order flow": "オーダーフロー",
  "Aggressive buying minus aggressive selling.": "成行買いから成行売りを引いたものです。",
  "cumulative volume delta": "累積出来高デルタ",
  "Delta added up through the session.": "取引時間を通じてデルタを足し上げたものです。",
  'Shown on the <a href="/chart">Chart</a> page, spot and futures apart, summed across exchanges.':
    '<a href="/chart">チャート</a>ページに表示されます。現物と先物を分け、取引所をまたいで合計しています。',
  Imbalance: "インバランス",
  "One side trading 3x or more the other at a price.":
    "ある価格で、片側の出来高がもう片側の3倍以上あることです。",
  Absorption: "吸収",
  "Heavy aggression, no progress.": "成行注文が厚いのに、価格が進まないことです。",
  'Read on the <a href="/liquidations#odds">Liquidations</a> page’s Odds tab, as initiative vs absorption.':
    '<a href="/liquidations#odds">清算</a>ページの確率タブで、仕掛けと吸収として読めます。',
  "Volume profile": "ボリュームプロファイル",
  "volume point of control": "出来高のポイント・オブ・コントロール",
  "The price with the most volume.": "出来高が最も多い価格です。",
  "Value area": "バリューエリア",
  "Where 70% of the volume traded.": "出来高の70%が成立した価格帯です。",
  "low-volume node": "低出来高ノード",
  "A thin price the market moved through fast.": "出来高が薄く、相場が素早く通過した価格です。",
  "Single prints": "シングルプリント",
  "A zone only one 30-minute period traded.": "1つの30分間だけで取引された価格帯です。",
  // web/glossary.ts: the terms added 2026-11-10 beside the owner's first eight
  "Delta (order flow)": "デルタ（オーダーフロー）",
  Initiative: "仕掛け",
  "Aggression that moves price; the opposite of absorption.":
    "価格を動かす成行注文のことです。吸収の反対です。",
  "Taker flow": "テイカーフロー",
  "The trades CVD is added up from, buys against sells.":
    "CVD の元になる約定です。成行買いと成行売りを比べます。",
  "Options and gamma": "オプションとガンマ",
  "gamma exposure": "ガンマエクスポージャー",
  "How much dealers must buy or sell for each 1% move.":
    "価格が 1% 動くごとに、ディーラーがどれだけ売買しなければならないかです。",
  'Shown on the <a href="/rates#gamma">Rates</a> page’s Gamma Exposure tab, and told as it moves by the market narrator at the top of every page.':
    '<a href="/rates#gamma">レート</a>ページのガンマエクスポージャータブにあり、ページ上部のマーケット実況が動きに合わせて伝えます。',
  "The price where dealers' net gamma changes sign.":
    "ディーラーのネットガンマの符号が変わる価格です。",
  'Marked on the <a href="/rates#gamma">Gamma Exposure</a> tab, and the line the market narrator reads every price against.':
    '<a href="/rates#gamma">ガンマエクスポージャー</a>タブに印があり、マーケット実況はすべての価格をこの線と比べます。',
  "Long / short gamma": "ロング / ショートガンマ",
  "Long: dealers' hedging sells rises and buys dips, damping moves. Short: it chases price, adding to moves.":
    "ロング：ディーラーのヘッジは上昇で売り下落で買い、値動きを抑えます。ショート：ヘッジが価格を追い、値動きを増幅します。",
  'Shaded in the zones view of the <a href="/rates#gamma">Gamma Exposure</a> tab.':
    '<a href="/rates#gamma">ガンマエクスポージャー</a>タブのゾーン表示で色分けされます。',
  "The strike holding the most call or put gamma; it tends to cap or floor price.":
    "コールまたはプットのガンマが最も集中する行使価格です。価格の天井や底になりやすい水準です。",
  'Shown on the <a href="/rates#gamma">Gamma Exposure</a> tab and in every market narrator line.':
    '<a href="/rates#gamma">ガンマエクスポージャー</a>タブと、マーケット実況のすべての行にあります。',
  "Delta (options)": "デルタ（オプション）",
  "How much an option's price moves per point of the underlying.":
    "原資産が 1 ポイント動いたときに、オプション価格が動く量です。",
  'By strike on the <a href="/rates#delta">Rates</a> page’s Delta tab.':
    '行使価格ごとに<a href="/rates#delta">レート</a>ページのデルタタブにあります。',
  "How much an option's price moves per point of implied volatility.":
    "インプライド・ボラティリティが 1 ポイント動いたときに、オプション価格が動く量です。",
  'By strike on the <a href="/rates#vega">Rates</a> page’s Vega tab.':
    '行使価格ごとに<a href="/rates#vega">レート</a>ページのベガタブにあります。',
  "What an option loses in value each day as expiry nears.":
    "満期が近づくにつれて、オプションが毎日失う価値です。",
  'By strike on the <a href="/rates#theta">Rates</a> page’s Theta tab.':
    '行使価格ごとに<a href="/rates#theta">レート</a>ページのセータタブにあります。',
  "implied volatility": "インプライド・ボラティリティ",
  "The size of move the option prices expect, per year.":
    "オプション価格が織り込んでいる値動きの大きさで、年率で表します。",
  'Drawn as walls on the <a href="/rates#ivwalls">Rates</a> page’s IV Walls tab.':
    '<a href="/rates#ivwalls">レート</a>ページの IV ウォールタブでウォールとして描かれます。',
  "1σ move": "1σ の値幅",
  "The day's expected move from the options: one standard deviation either side.":
    "オプションから求めたその日の予想値幅で、上下に 1 標準偏差ずつです。",
  'The IV walls on the <a href="/rates#ivwalls">Rates</a> page, and the IV move on <a href="/whales">Whales</a>.':
    '<a href="/rates#ivwalls">レート</a>ページの IV ウォールと、<a href="/whales">クジラ注文</a>ページの IV 変動幅です。',
  "The strike where option buyers lose the most at expiry.":
    "満期時にオプションの買い手の損失が最も大きくなる行使価格です。",
  'Marked on the <a href="/rates#levels">Rates</a> page’s Ceiling &amp; Floor tab.':
    '<a href="/rates#levels">レート</a>ページの天井と底タブに印があります。',
  "Reaction zone": "反応ゾーン",
  "Where an IV wall and a gamma wall line up.": "IV ウォールとガンマのウォールが重なる場所です。",
  'In full on the <a href="/rates#ivwalls">IV Walls</a> and <a href="/rates#levels">Ceiling &amp; Floor</a> tabs, folded on the other option tabs.':
    '<a href="/rates#ivwalls">IV ウォール</a>と<a href="/rates#levels">天井と底</a>のタブに全体が、ほかのオプションタブには折りたたんで表示されます。',
  "Funding and perps": "資金調達率と無期限先物",
  "Funding rate": "資金調達率",
  "What longs pay shorts, or shorts pay longs, to keep a perp near spot.":
    "無期限先物の価格を現物に近づけるため、ロングがショートに（またはショートがロングに）払う料金です。",
  'Every exchange side by side on the <a href="/rates">Rates</a> page.':
    '<a href="/rates">レート</a>ページに全取引所が並びます。',
  "annual percentage rate": "年率",
  "A funding rate scaled to a year, so different settlement intervals compare.":
    "資金調達率を 1 年分に換算したもので、決済間隔の違う市場を比べられます。",
  'The unit the <a href="/screener">Screener</a> shows by default.':
    '<a href="/screener">スクリーナー</a>の既定の単位です。',
  "Settlement interval": "決済間隔",
  "How often funding is paid: every 1, 4 or 8 hours.":
    "資金調達率が支払われる頻度で、1、4、8 時間ごとです。",
  'In each leg of a <a href="/screener">Screener</a> row.':
    '<a href="/screener">スクリーナー</a>の各行の各レッグにあります。',
  "Funding spread / carry": "資金調達率スプレッド / キャリー",
  "Long where funding is cheap, short where it is rich, and collect the gap.":
    "資金調達率の安い市場でロング、高い市場でショートし、その差を受け取ることです。",
  'The pairs the <a href="/">home page</a> and the <a href="/screener">Screener</a> rank.':
    '<a href="/">ホーム</a>ページと<a href="/screener">スクリーナー</a>が順位をつけるペアです。',
  "Contracts still open: money in the market, not traded volume.":
    "まだ決済されていない契約で、出来高ではなく市場に残っている資金です。",
  'In each leg of a <a href="/screener">Screener</a> row, and per asset on the <a href="/chart">Chart</a> page.':
    '<a href="/screener">スクリーナー</a>の各行の各レッグと、<a href="/chart">チャート</a>ページの銘柄ごとにあります。',
  "A perp or future's price minus spot.": "無期限先物や先物の価格から現物価格を引いたものです。",
  "Mark / index price": "マーク価格 / インデックス価格",
  "Mark is the price used for liquidations; index is the spot average it tracks.":
    "マーク価格は清算に使う価格で、インデックス価格はそれが追う現物の平均価格です。",
  'Each pair’s page, opened from a row on <a href="/arbitrage">Arbitrage</a>, charts the mark prices hourly.':
    '<a href="/arbitrage">アービトラージ</a>の行から開く各ペアのページが、マーク価格を 1 時間ごとに描きます。',
  "Taker / maker": "テイカー / メイカー",
  "A taker crosses the spread and pays the higher fee; a maker rests an order and waits.":
    "テイカーはスプレッドをまたいで約定し高い手数料を払い、メイカーは注文を置いて待ちます。",
  'The <a href="/markets">Exchanges</a> page prices a $10k market order with each exchange’s taker fee.':
    '<a href="/markets">取引所</a>ページが、各取引所のテイカー手数料で 1 万ドルの成行注文のコストを示します。',
  "Liquidations and whales": "清算とクジラ",
  Liquidation: "清算",
  "A position the exchange closes because its margin ran out.":
    "証拠金が尽きたため、取引所が強制的に決済するポジションです。",
  'Every exchange’s, live, on the <a href="/liquidations">Liquidations</a> page.':
    '<a href="/liquidations">清算</a>ページで、全取引所の清算をリアルタイムで見られます。',
  "Whale order": "クジラ注文",
  "A resting order big enough to show on the depth chart.":
    "板の深さチャートに現れるほど大きな指値注文です。",
  'Binance walls and Hyperliquid whale orders on the <a href="/whales">Whales</a> page.':
    '<a href="/whales">クジラ注文</a>ページに、Binance のウォールと Hyperliquid のクジラ注文があります。',
  "The site's terms in one line each: order flow, the volume profile, options and gamma, funding and perps, liquidations and whales.":
    "このサイトの用語を 1 行ずつ：オーダーフロー、ボリュームプロファイル、オプションとガンマ、資金調達率と無期限先物、清算とクジラ。",
  "The words the site uses, each in one line: order flow, the volume profile, options and gamma, funding, liquidations. Every term has its own link to share: /glossary#cvd opens this page at CVD.":
    "このサイトで使う用語を 1 行ずつ：オーダーフロー、ボリュームプロファイル、オプションとガンマ、資金調達率、清算。用語ごとに共有用のリンクがあり、/glossary#cvd でこのページの CVD が開きます。",
};
