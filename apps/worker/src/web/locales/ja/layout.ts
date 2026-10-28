/**
 * Japanese for the frame every page shares -- web/layout.ts (masthead, nav, footer), the time and
 * label helpers in web/format.ts -- and the not-found messages app/app.ts builds.
 * Glossary and style: ./index.ts.
 *
 * Terms: a live market 稼働中の銘柄, local time ローカル時刻.
 */

import type { Catalog } from "../../i18n";

export const layout: Catalog = {
  // web/format.ts
  "{s}s": "{s}秒",
  "{m}m": "{m}分",
  "{h}h {m}m": "{h}時間{m}分",
  "{time} ago": "{time}前",
  settling: "精算中",
  never: "なし",
  "extreme fear": "極度の恐怖",
  fear: "恐怖",
  neutral: "中立",
  greed: "強欲",
  "extreme greed": "極度の強欲",

  // web/layout.ts
  spreads: "スプレッド",
  screener: "スクリーナー",
  rates: "レート",
  arbitrage: "アービトラージ",
  liquidations: "清算",
  exchanges: "取引所",
  "{markets} markets · {venues} venues · updated {ago}":
    "{markets}銘柄 · {venues}取引所 · {ago}に更新",
  "no venue has reported in five minutes": "5分間どの取引所からもデータがありません",
  "Fear &amp; greed: click for the chart": "恐怖と強欲：クリックでチャートを表示",
  "What settled. Not what might.": "精算済みの数字だけ。皮算用はしない。",
  "Your local time ({zone}). Click for UTC.": "ローカル時刻（{zone}）。クリックで UTC に切り替え。",
  "UTC, the clock funding settles by. Click for your local time.":
    "UTC（資金調達料の精算に使われる時刻）。クリックでローカル時刻に切り替え。",
  filter: "フィルター",
  login: "ログイン",
  telegram: "Telegram",
  "Join the airrates group on Telegram: @airratesnet":
    "Telegram の airrates グループに参加：@airratesnet",
  status: "ステータス",
  "geo-probe": "地域チェック",
  about: "概要",
  "referral links": "紹介リンク",
  "MCP &amp; agents": "MCP とエージェント",
  "legal &amp; privacy": "法的事項とプライバシー",
  terms: "利用規約",
  Language: "言語",
  menu: "メニュー",
  "Not financial advice. Data may be delayed or inaccurate. Not affiliated with or endorsed by any exchange.":
    "投資助言ではありません。データは遅延または不正確な場合があります。いかなる取引所とも提携しておらず、承認も受けていません。",

  // web/help.ts
  "What is this?": "これは何？",
  "About this page": "このページについて",

  // app/app.ts
  "{asset} is not an asset address.": "{asset} は有効な資産アドレスではありません。",
  "No live market for {asset}.": "{asset} の稼働中の銘柄はありません。",
  "No live market for {asset}, so nothing to band against.":
    "{asset} の稼働中の銘柄がないため、価格帯を区切れません。",
  "No exchange is quoting a {asset} book right now.":
    "現在 {asset} の板を提示している取引所はありません。",
  "There's no exchange with that name.": "その名前の取引所はありません。",
  "No exchange has a live {asset} perpetual right now.":
    "現在 {asset} の無期限先物を扱っている取引所はありません。",
  // web/command.ts: the site-wide search, and its key on /keys
  search: "検索",
  "Search tickers, exchanges and indices": "ティッカー・取引所・指数を検索",
  Search: "検索",
  "Ticker, exchange or index": "ティッカー・取引所・指数",
  Results: "結果",
  move: "移動",
  open: "開く",
  close: "閉じる",
  "every exchange's rate and open interest": "各取引所のレートと建玉",
  "Funding spreads": "資金調達率スプレッド",
  "backtest a long/short pair": "ロング／ショートのペアをバックテスト",
  Screener: "スクリーナー",
  "its spreads, ranked": "スプレッドのランキング",
  Arbitrage: "アービトラージ",
  "price gaps between exchanges": "取引所間の価格差",
  "large resting orders and trades": "大口の板注文と約定",
  Liquidations: "清算",
  "where positions are liquidated": "ポジションが清算される価格",
  "options gamma by strike": "権利行使価格ごとのオプションのガンマ",
  "1 exchange": "1 取引所",
  "{n} exchanges": "{n} 取引所",
  "OI {usd}": "建玉 {usd}",
  Tickers: "ティッカー",
  "Other tickers": "その他のティッカー",
  Exchanges: "取引所",
  "markets, costs and grade": "市場・コスト・評価",
  "Indices and option books": "指数とオプション",
  Pages: "ページ",
  Recent: "最近",
  "Loading tickers…": "ティッカーを読み込み中…",
  "The ticker list did not load. Exchanges and pages still match.":
    "ティッカー一覧を読み込めませんでした。取引所とページは検索できます。",
  "Nothing matches {q}.": "{q} に一致するものはありません。",
  "price, spot and futures CVD": "価格、現物と先物の CVD",
  System: "システム",
  "Day or Night, as your device is set": "デバイスの設定に合わせてデイかナイト",
  Settings: "設定",
  "Your settings on airrates: theme, clock, chart cursor, language and keyboard.":
    "airrates での設定：テーマ、時計、チャートのカーソル、言語、キーボード。",
  "Each choice is kept in this browser, not on an account: it needs no login, and another browser or device starts from the defaults. Clearing the site's data resets them.":
    "選択はアカウントではなくこのブラウザに保存されます。ログインは不要で、別のブラウザや端末では初期設定から始まります。サイトのデータを消去するとリセットされます。",
  Theme: "テーマ",
  "The colours of every page. Charts take the new colours from the next page you open.":
    "すべてのページの配色。チャートは次に開くページから新しい配色になります。",
  Clock: "時計",
  "The clock in the header, and the times on charts and tables.":
    "ヘッダーの時計と、チャートや表の時刻。",
  "Local time": "現地時間",
  "Chart cursor": "チャートのカーソル",
  "What follows the pointer on a chart: a crosshair with the value on each axis, or the whole bar lit.":
    "チャート上でポインタに付いてくるもの：各軸に値を示す十字線か、バー全体のハイライト。",
  "The site's language, kept for this browser.": "サイトの言語。このブラウザに保存されます。",
  "Every shortcut on the site. Members remap them into profiles kept on their account.":
    "サイトのすべてのショートカット。会員は割り当てを変え、プロファイルをアカウントに保存できます。",
  "keyboard shortcuts": "キーボードショートカット",
  Reset: "リセット",
  "Back to the defaults: Night, local time, the crosshair, and every chart's own view.":
    "初期設定に戻します：ナイト、現地時間、十字線、各チャートの表示。",
  "reset settings": "設定をリセット",
  "Saved in this browser.": "このブラウザに保存しました。",
  "Back to the defaults.": "初期設定に戻しました。",
  settings: "設定",
  Night: "ナイト",
  "Black terminal, the default": "黒いターミナル、初期設定",
  "Ink on white, for daylight": "白地に墨、昼間向け",
  Solar: "ソーラー",
  "Solarized light: warm paper, soft contrast":
    "Solarized ライト：温かみのある紙、柔らかなコントラスト",
  "Solar dark": "ソーラー ダーク",
  "Solarized dark: deep teal": "Solarized ダーク：深いティール",
  Dusk: "ダスク",
  "Slate blue, easy on the eyes at night": "スレートブルー、夜に目に優しい",
  Sepia: "セピア",
  "Old paper and brown ink": "古い紙と茶色のインク",
  Phosphor: "フォスファー",
  "Green screen, an old terminal": "緑の画面、昔の端末",
  "High contrast": "ハイコントラスト",
  "White on black, brightest lines": "黒地に白、最も明るい線",
};
