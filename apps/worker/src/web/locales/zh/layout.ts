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
  exchanges: "交易所",
  "{markets} markets · {venues} venues · updated {ago}":
    "{markets} 个市场 · {venues} 家交易所 · {ago}更新",
  "no venue has reported in five minutes": "五分钟内没有交易所上报数据",
  "Fear &amp; greed: click for the chart": "恐惧与贪婪：点击查看图表",
  "What settled. Not what might.": "只看已结算，不猜可能。",
  "Your local time ({zone}). Click for UTC.": "你的本地时间（{zone}）。点击切换为 UTC。",
  "UTC, the clock funding settles by. Click for your local time.":
    "UTC，资金费率按此时间结算。点击切换为本地时间。",
  filter: "筛选",
  login: "登录",
  telegram: "电报群",
  "Join the airrates group on Telegram: @airratesnet": "加入 airrates 的 Telegram 群：@airratesnet",
  status: "状态",
  "geo-probe": "地域探测",
  about: "关于",
  "referral links": "邀请链接",
  "legal &amp; privacy": "法律与隐私",
  terms: "服务条款",
  Language: "语言",
  menu: "菜单",
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
  // web/command.ts: the site-wide search, and its key on /keys
  search: "搜索",
  "Search tickers, exchanges and indices": "搜索代码、交易所和指数",
  Search: "搜索",
  "Ticker, exchange or index": "代码、交易所或指数",
  Results: "结果",
  move: "移动",
  open: "打开",
  close: "关闭",
  "every exchange's rate and open interest": "各交易所的费率和持仓量",
  "Funding spreads": "资金费率价差",
  "backtest a long/short pair": "回测一组多空配对",
  Screener: "筛选器",
  "its spreads, ranked": "它的价差排名",
  Arbitrage: "套利",
  "price gaps between exchanges": "交易所之间的价格差",
  "large resting orders and trades": "大额挂单和成交",
  Liquidations: "爆仓",
  "where positions are liquidated": "仓位在哪些价位爆仓",
  "options gamma by strike": "按行权价的期权 Gamma",
  "1 exchange": "1 家交易所",
  "{n} exchanges": "{n} 家交易所",
  "OI {usd}": "持仓量 {usd}",
  Tickers: "代码",
  "Other tickers": "其他代码",
  Exchanges: "交易所",
  "markets, costs and grade": "市场、成本和评级",
  "Indices and option books": "指数和期权",
  Pages: "页面",
  Recent: "最近",
  "Loading tickers…": "正在加载代码…",
  "The ticker list did not load. Exchanges and pages still match.":
    "代码列表未能加载。交易所和页面仍可搜索。",
  "Nothing matches {q}.": "没有与 {q} 匹配的结果。",
  "price, spot and futures CVD": "价格、现货与合约 CVD",
};
