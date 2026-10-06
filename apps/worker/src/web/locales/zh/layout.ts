/**
 * Simplified Chinese for the frame every page shares -- web/layout.ts (masthead, nav, footer), the
 * time and label helpers in web/format.ts -- and the not-found messages app/app.ts builds.
 * Glossary and style: ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const layout: Catalog = {
  // web/format.ts
  "{s}s": "{s}秒",
  "{m}m": "{m}分",
  "{h}h {m}m": "{h}小时{m}分",
  "{time} ago": "{time}前",
  settling: "结算中",
  never: "从未",
  "extreme fear": "极度恐惧",
  fear: "恐惧",
  neutral: "中性",
  greed: "贪婪",
  "extreme greed": "极度贪婪",

  // web/layout.ts
  spreads: "价差",
  screener: "筛选器",
  rates: "费率",
  arbitrage: "套利",
  liquidations: "爆仓",
  cvd: "CVD",
  exchanges: "交易所",
  "{markets} markets · {venues} venues · updated {ago}":
    "{markets} 个市场 · {venues} 家交易所 · {ago}更新",
  "no venue has reported in five minutes": "五分钟内没有交易所上报数据",
  "Fear &amp; greed: click for the chart": "恐惧与贪婪：点击查看图表",
  "funding carry sheet": "资金费率套利表",
  filter: "筛选",
  "read only · public venue APIs": "只读 · 交易所公开 API",
  login: "登录",
  status: "状态",
  "geo-probe": "地域探测",
  about: "关于",
  "referral links": "邀请链接",
  "legal &amp; privacy": "法律与隐私",
  terms: "服务条款",
  Language: "语言",
  "language:": "语言：",
  "Funding rates come from each venue's public API and refresh every minute. They are estimates for each venue's next settlement and change before it. Spreads are before trading fees, slippage and price moves.":
    "资金费率取自各交易所的公开 API，每分钟刷新一次。它们是对各交易所下一次结算的预估，结算前仍会变动。价差未计入交易手续费、滑点和价格波动。",
  "Not financial advice. Data may be delayed or inaccurate. Not affiliated with or endorsed by any exchange.":
    "不构成投资建议。数据可能延迟或不准确。本站与任何交易所均无关联，也未获任何交易所认可。",

  // web/help.ts
  "What is this?": "这是什么？",
  "About this page": "页面说明",

  // app/app.ts
  "{asset} is not an asset address.": "{asset} 不是有效的资产地址。",
  "No live market for {asset}.": "{asset} 目前没有在线市场。",
  "No live market for {asset}, so nothing to band against.":
    "{asset} 目前没有在线市场，无法划分价格区间。",
  "No exchange is quoting a {asset} book right now.": "目前没有交易所提供 {asset} 的盘口报价。",
  "There's no exchange with that name.": "没有这个名称的交易所。",
  "No exchange has a live {asset} perpetual right now.": "目前没有交易所上线 {asset} 永续合约。",
};
