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
  cvd: "CVD",
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
  "legal &amp; privacy": "法的事項とプライバシー",
  terms: "利用規約",
  Language: "言語",
  "language:": "言語：",
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
};
