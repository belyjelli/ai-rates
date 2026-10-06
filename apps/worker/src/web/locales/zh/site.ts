/**
 * Simplified Chinese for the site-wide pieces and the small pages: web/about.ts, web/legal.ts and
 * web/tos.ts (their notice only -- the bodies stay English), web/referral-links.ts, web/referral.ts,
 * web/install.ts, web/share.ts, web/await.ts and web/tabs.ts. Glossary and style: ./index.ts.
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
  project: "项目",
  commit: "提交",
  "not recorded": "未记录",
  "This build did not record its commit. Deployed builds stamp the commit they were built from here.":
    "此构建未记录其提交。已部署的构建会在这里标注其所基于的提交。",
  committed: "提交于",
  deployed: "部署于",
  "Release notes are written in English.": "更新说明仅提供英文版。",
  About: "关于",
  "What airrates is, which version is running, and what has changed recently.":
    "airrates 是什么、当前运行的版本，以及近期有哪些更新。",
  "About airrates": "关于 airrates",
  "airrates is a funding-rate screener for perpetual futures. It reads funding from each exchange's public API every minute and shows where holding the same asset long on one exchange and short on another collects the gap between their rates, and what that has actually paid.":
    "airrates 是一个永续合约资金费率筛选器。它每分钟从各交易所的公开 API 读取资金费率，展示在一家交易所做多、同时在另一家交易所做空同一资产时，能赚取两者费率之差的机会，以及这样的配对实际赚到了多少。",
  "This version": "当前版本",
  "Recent changes": "近期更新",

  // web/legal.ts, web/tos.ts
  "This page is available in English only. The English text is the binding version.":
    "本页仅提供英文版，以英文文本为准。",

  // web/referral-links.ts
  "<b>Disclosure.</b> airrates may earn a commission if you open an account through a link on this page, at no extra cost to you. Referral links never affect which markets appear or how they are ranked. A listing here is not a recommendation: check that an exchange serves where you live before signing up, and remember that perpetual futures are leveraged and can lose more than your margin. {link}":
    "<b>披露。</b>如果你通过本页的链接开设账户，airrates 可能获得佣金，你无需支付任何额外费用。邀请链接绝不会影响哪些市场被展示或如何排名。列于此处并不构成推荐：注册前请确认该交易所在你所在地区提供服务，并请记住永续合约带有杠杆，亏损可能超过你的保证金。{link}",
  "How referral links work": "邀请链接如何运作",
  "No referral links yet.": "暂无邀请链接。",
  "Referral links are not shown in your location.": "你所在的地区不显示邀请链接。",
  "None of these exchanges' referral links can be shown in your location.":
    "这些交易所的邀请链接均无法在你所在的地区显示。",
  "The link applies the referral itself": "该链接会自动应用邀请关系",
  Exchange: "交易所",
  Type: "类型",
  "Referral code": "邀请码",
  "Sign up": "注册",
  "{count} more exchange's link is not available in your location.":
    "另有 {count} 家交易所的链接在你所在的地区不可用。",
  "{count} more exchanges' links are not available in your location.":
    "另有 {count} 家交易所的链接在你所在的地区不可用。",
  "Referral links": "邀请链接",
  "Referral links for the exchanges airrates tracks, for readers opening a new account.":
    "airrates 所追踪交易所的邀请链接，供开设新账户的读者使用。",
  "The exchanges airrates has a referral link for. If you don't have an account on one yet, you can open it through the link.":
    "以下是 airrates 提供邀请链接的交易所。如果你还没有其中某家交易所的账户，可以通过链接开设。",

  // web/referral.ts
  "How this works": "了解详情",
  "Referral link: Code {code}. airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "邀请链接：邀请码 {code}。若你通过该链接注册，airrates 可能获得佣金，你无需支付任何费用。{how}",
  "Referral link: airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "邀请链接：若你通过该链接注册，airrates 可能获得佣金，你无需支付任何费用。{how}",
  "Open a {venue} account": "开设 {venue} 账户",

  // web/install.ts
  "Install the app": "安装应用",
  "Install airrates": "安装 airrates",
  "Opens in its own window, from your home screen.": "从主屏幕打开，在独立窗口中运行。",
  "Install app": "安装应用",
  "Not now": "暂不",

  // web/share.ts
  "Share the chart in view as an image sized for X": "将当前图表分享为适合 X 的图片",
  chart: "图表",
  "Quote this page's best line, with a link back to it": "引用本页最有价值的一句话，并附上回链",
  cite: "引用",
  "No chart on this view": "当前视图没有图表",
  close: "关闭",
  Copied: "已复制",
  "Select + copy": "请选中后复制",
  "Cite this page": "引用本页",
  "Pick the line · the page's own numbers, as they read now": "选择一句 · 本页当前显示的数字",
  "Your post · edit it freely": "你的帖子 · 可自由编辑",
  "Back-link · this exact page, venue and filters": "回链 · 指向此页面、交易所和筛选条件",
  Copy: "复制",
  "Post on X": "发布到 X",
  "Copy line + link": "复制文字和链接",
  "Quote the number, link back to where it was read. Funding moves every minute, so the line says when it was true: {stamp}. Not financial advice.":
    "引用数字，并链接回它的出处。资金费率每分钟都在变化，所以这句话注明了它成立的时间：{stamp}。不构成投资建议。",
  "{count} characters left with the link": "含链接还可输入 {count} 个字符",
  "+{count} more": "+{count} 项",
  "public venue APIs · not financial advice": "交易所公开 API · 不构成投资建议",
  "Share your line": "分享图表",
  "chart image": "图表图片",
  "Image · 1600 × 900, X's own 16:9 — shows uncropped in the timeline. Right-click or long-press to save.":
    "图片 · 1600 × 900，即 X 的 16:9 比例，在时间线中完整显示、不被裁切。右键或长按即可保存。",
  "Copy image": "复制图片",
  "Download PNG": "下载 PNG",
  "Link · this exact view": "链接 · 指向当前视图",
  "Copy the image, press Post on X, paste it into the post. The card carries the address it came from; the link opens the same view. We never call direction — the numbers are the venues', the call is yours.":
    "复制图片，点击“发布到 X”，然后粘贴到帖子中。图片上印有它的来源地址；链接会打开同一视图。我们从不预测方向——数字来自各交易所，判断由你自己做出。",
  "the image could not be drawn in this browser": "此浏览器无法绘制该图片",
  "Copy blocked — download instead": "复制被阻止——请改为下载",

  // web/await.ts
  "Building report": "正在生成报告",
  "Still building": "仍在生成",

  // web/tabs.ts
  Sections: "分区",
};
