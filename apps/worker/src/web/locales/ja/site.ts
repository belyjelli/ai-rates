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
};
