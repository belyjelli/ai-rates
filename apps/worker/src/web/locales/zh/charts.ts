/**
 * Simplified Chinese for the chart pages and their readouts: web/cvd.ts, web/sentiment.ts,
 * web/funding-chart.ts and web/slot-chart.ts (web/rail.ts has no words of its own). Glossary and
 * style: ./index.ts.
 *
 * Keys shared with the liquidations part (months, dates, "Window", the hover hints) carry the same
 * translation there, which i18n.test.ts holds.
 */

import type { Catalog } from "../../i18n";

export const charts: Catalog = {
  // Dates on the axes and in the hover readouts; the month names are marked in web/slot-chart.ts.
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
  "{month} {day}": "{month}{day}日",
  "{month} {day} {time} UTC": "{month}{day}日 {time} UTC",

  // web/slot-chart.ts: the hover readouts of the CVD and longs-vs-shorts charts.
  "no flow recorded": "没有记录到成交流",
  "price {price}": "价格 {price}",
  "price {price} ({pct} since start)": "价格 {price}（较窗口起点 {pct}）",
  "bought {usd}": "主动买入 {usd}",
  "sold {usd}": "主动卖出 {usd}",
  "net {net}": "净额 {net}",
  "net {net} ({pct} of volume)": "净额 {net}（占成交量 {pct}）",
  "nothing force-closed": "没有强制平仓",
  "longs closed {usd}": "多头爆仓 {usd}",
  "shorts closed {usd}": "空头爆仓 {usd}",
  "longs − shorts {diff}": "多头 − 空头 {diff}",
  even: "持平",
  "longs heavier, {pct}%": "多头更重，{pct}%",
  "shorts heavier, {pct}%": "空头更重，{pct}%",
  "{n} liquidation": "{n} 笔爆仓",
  "{n} liquidations": "{n} 笔爆仓",
  "{when} (still filling)": "{when}（仍在累计中）",

  // web/cvd.ts: the chart.
  "{asset} · cumulative volume delta · {n}-hour bars, UTC":
    "{asset} · 累计成交量差 · 每根柱 {n} 小时，UTC",
  "{asset} · cumulative volume delta · {n}-minute bars, UTC":
    "{asset} · 累计成交量差 · 每根柱 {n} 分钟，UTC",
  "{asset} taker CVD, last {window}: {cvd}. Market buyers {bought} vs sellers {sold}.":
    "{asset} 最近 {window} 的主动成交 CVD：{cvd}。市价买方 {bought}，市价卖方 {sold}。",
  "Last {window}": "最近 {window}",
  "Loading {interval} bars…": "正在加载 {interval} 柱…",
  "Not available yet: there is not enough history for {interval} bars":
    "暂不可用：历史数据不足以绘制 {interval} 柱",
  Price: "价格",
  "Net buy": "净买入",
  "Net sell": "净卖出",
  "hover or tap a bar to read it": "悬停或点击柱形查看数值",
  "{asset} bars; arrow keys read one at a time": "{asset} 柱形图；用方向键逐根查看",
  "{asset} price and cumulative volume delta over the last {window}":
    "{asset} 最近 {window} 的价格与累计成交量差",
  "{asset} net taker flow per bar": "{asset} 每根柱的主动成交净额",
  "Price is the busiest polled market's own close, left axis; CVD is taker buys less taker sells from the start of the window, right axis. The two are scaled separately, so where the lines cross means nothing. Hover either panel to read one bar beside the cursor; on a phone, tap and it reads in the line above the chart.":
    "价格为成交最活跃的被采集市场自身的收盘价，对应左轴；CVD 为自窗口起点起主动买入减去主动卖出的累计值，对应右轴。两者分别缩放，因此两条线在哪里交叉没有任何含义。将鼠标悬停在任一面板上，即可在光标旁查看单根柱的数值；在手机上点击柱形，数值会显示在图表上方的那一行中。",

  // web/cvd.ts: tiles, controls and the screener table.
  Volume: "成交量",
  CVD: "CVD",
  "CVD / volume": "CVD / 成交量",
  Change: "涨跌幅",
  "CVD breadth": "CVD 广度",
  "of {n} assets with net taker buying": "{n} 个资产中主动净买入的占比",
  "Bullish divergences": "看涨背离",
  "price down ≥{price}%, takers net buying ≥{flow}% of volume":
    "价格下跌 ≥{price}%，主动净买入 ≥ 成交量的 {flow}%",
  "Bearish divergences": "看跌背离",
  "price up ≥{price}%, takers net selling ≥{flow}% of volume":
    "价格上涨 ≥{price}%，主动净卖出 ≥ 成交量的 {flow}%",
  "Top CVD flows": "CVD 最大流向",
  "largest net buy / net sell": "最大净买入 / 净卖出",
  Window: "时间窗口",
  "bullish div": "看涨背离",
  "bearish div": "看跌背离",
  "Search symbol": "搜索代码",
  Find: "查找",
  clear: "清除",
  "No taker flow has been collected in the last {window}. Collection polls each venue every five minutes; a new deployment backfills about a week within its first hour.":
    "最近 {window} 内没有采集到主动成交数据。采集器每五分钟轮询一次各交易所；新部署会在第一个小时内回填约一周的数据。",
  Asset: "资产",
  "Reference market's first close to last close in the window":
    "参考市场在窗口内从首个收盘价到最后一个收盘价的变化",
  "Taker buys less taker sells, in dollars, summed over the polled venues":
    "主动买入减去主动卖出（美元），在被采集的交易所间加总",
  "CVD as a share of the window's taker volume": "CVD 占窗口内主动成交量的比例",
  "Taker buys plus taker sells, in dollars": "主动买入加主动卖出（美元）",
  "Polled venues with flow for this asset": "该资产有成交数据的被采集交易所数量",
  Venues: "交易所",
  "Price and flow disagreeing by more than the thresholds above the table":
    "价格与成交流方向相反，且超过表格上方所列的阈值",
  Signal: "信号",
  "No asset matches “{q}”.": "没有与“{q}”匹配的资产。",
  "No live market lists {asset}, so there is no flow to chart.":
    "没有在线市场上架 {asset}，因此没有可绘制的成交流。",
  "No taker flow for {asset} in the last {window}. Only the ~100 assets deepest on {venues} are polled; pick one from the table below.":
    "最近 {window} 内没有 {asset} 的主动成交数据。只采集在 {venues} 上持仓量最大的约 100 个资产；请从下表中选择一个。",
  "Newest bucket {age}.": "最新时段：{age}。",
  "Venues publish each 5-minute bucket after it closes, so the right edge runs a few minutes behind.":
    "交易所在每个 5 分钟时段结束后才发布该时段数据，因此图表最右侧会落后几分钟。",

  // web/cvd.ts: the page.
  "Cumulative volume delta: taker buying against taker selling across exchanges, and where price and order flow disagree.":
    "累计成交量差：各交易所主动买入与主动卖出的对比，以及价格与订单流方向相反之处。",
  "Cumulative volume delta: {buys} less {sells}, in dollars. These are the exchanges' own 5-minute taker statistics from <b>{venues}</b>, summed, for the ~100 assets deepest on them — not every venue, and nothing finer than five minutes. A divergence marks a window where price and flow pointed opposite ways; it describes what happened, not what happens next.":
    "累计成交量差：{buys}减去{sells}，单位为美元。数据来自交易所自身发布的 5 分钟主动成交统计（<b>{venues}</b>），加总后覆盖在这些交易所上持仓量最大的约 100 个资产 — 并非所有交易所，也没有比五分钟更细的粒度。背离表示该时间窗口内价格与成交流方向相反；它描述的是已经发生的情况，而不是对后市的预测。",
  "taker buys": "主动买入",
  "taker sells": "主动卖出",
  "CVD screener · net buying and selling by asset": "CVD 筛选器 · 各资产的净买入与净卖出",
  "Click an asset to chart it above. Change is the busiest polled market's first to last close in the window. History is uneven by venue: Binance and Gate publish weeks of it and OKX five days, so the oldest bars of a new 7-day window sum fewer venues.":
    "点击资产即可在上方绘制其图表。涨跌幅为成交最活跃的被采集市场在窗口内从首个收盘价到最后一个收盘价的变化。各交易所的历史数据长短不一：Binance 和 Gate 提供数周，OKX 提供五天，因此新的 7 天窗口中最早的几根柱加总的交易所较少。",

  // web/funding-chart.ts
  "The funding chart is unavailable right now. The backtest below is unaffected.":
    "资金费率图表暂时无法显示。下方的回测不受影响。",
  "No stored funding for this window yet.": "此时间窗口内尚无已存储的资金费率。",
  Spread: "价差",
  "Funding by exchange, annualized · hourly": "各交易所资金费率（年化）· 每小时",
  "Funding by exchange, annualized · daily": "各交易所资金费率（年化）· 每日",
  "Funding APR by exchange over the window": "时间窗口内各交易所的资金费率年化",
  "Hover the chart to read every visible line at one moment.":
    "将鼠标悬停在图表上，可查看同一时刻每条可见曲线的数值。",
  "Signed log scale, so ordinary rates keep room beside extreme ones. Each line holds a rate until that exchange's next settlement; a break is time with no recorded funding, not a zero.":
    "采用带符号的对数刻度，使普通费率与极端费率都能清晰显示。每条曲线在该交易所下一次结算前保持当前费率；曲线中断表示该时段没有记录到资金费率，而不是零。",

  // web/sentiment.ts
  "No readings yet in this window.": "此时间窗口内尚无读数。",
  "Fear & greed: {score}, {label}": "恐惧与贪婪：{score}，{label}",
  "Fear and greed score reaches {score} ({label})": "恐惧与贪婪指数达到 {score}（{label}）",
  "{n} readings, every 30 minutes · {age} to now": "{n} 个读数，每 30 分钟一次 · 从{age}至今",
  "no data in window": "窗口内无数据",
  "Fear &amp; greed · updated {ago}": "恐惧与贪婪 · {ago}更新",
  "Fear &amp; greed": "恐惧与贪婪",
  component: "指标",
  reading: "读数",
  "percentile (30d, greed direction)": "百分位（30 天，贪婪方向）",
  "funding (OI-weighted APR)": "资金费率（按持仓量加权的年化）",
  "open interest": "持仓量",
  "liquidation skew (24h)": "爆仓偏向（24 小时）",
  "{pct} long-heavy": "{pct} 偏多头",
  "taker flow (24h)": "主动成交流（24 小时）",
  "{pct} net buy": "{pct} 净买入",
  "Score is the mean of four components, each a percentile rank against this book's own trailing 30-day history — not a fixed scale, so the same raw number reads differently in a quiet stretch than a volatile one. <b>Funding</b> and <b>open interest</b> run high-is-greedy (crowded, levered longs paying to hold). <b>Liquidation skew</b> is inverted before averaging: a book where longs are being forced out is fear, however unusual that reading looks against its own history. <b>Taker flow</b> is net aggressive buying over aggressive selling, last 24h. Computed every 30 minutes by the collector (belyjelli/profitlock-worker, <code>collector rank-eval</code>'s sibling <code>market sentiment</code> job); coverage for liquidations and taker flow is not venue-complete, so this is a proxy, not a market-wide guarantee.":
    "得分为四个指标的平均值，每个指标都是相对本市场自身过去 30 天历史的百分位排名 — 不是固定刻度，因此同样的原始数值在平静期和波动期的读数不同。<b>资金费率</b>和<b>持仓量</b>越高越贪婪（拥挤的杠杆多头在付费持仓）。<b>爆仓偏向</b>在平均之前先取反：多头被强制平仓的市场代表恐惧，无论这个读数相对其自身历史看起来多么反常。<b>主动成交流</b>为最近 24 小时主动买入超出主动卖出的净额。由采集器每 30 分钟计算一次（belyjelli/profitlock-worker，<code>collector rank-eval</code> 的同级任务 <code>market sentiment</code>）；爆仓和主动成交流的数据并未覆盖所有交易所，因此这只是一个代理指标，而非全市场的保证。",
  "Fear & Greed": "恐惧与贪婪",
  "A funding-market fear and greed score: OI-weighted funding, open interest, liquidation skew and taker flow, each ranked against its own 30-day history.":
    "资金费率市场的恐惧与贪婪指数：按持仓量加权的资金费率、持仓量、爆仓偏向和主动成交流，各自与其过去 30 天的历史进行排名。",
};
