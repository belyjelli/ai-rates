/**
 * Simplified Chinese for the chart pages and their readouts: web/cvd.ts, web/kchart.ts,
 * web/sentiment.ts, web/funding-chart.ts and web/slot-chart.ts (web/rail.ts has no words of its own). Glossary and
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
  "{month} {day} {time} {zone}": "{month}{day}日 {time} {zone}",

  // web/slot-chart.ts: the hover readouts of the CVD and longs-vs-shorts charts.
  "{low} – {high} ({pct} from the mark)": "{low} – {high}（距标记价格 {pct}）",
  "longs liquidate here: {usd} ({n})": "此处多头强平：{usd}（{n}）",
  "shorts liquidate here: {usd} ({n})": "此处空头强平：{usd}（{n}）",
  "{n} position": "{n} 个仓位",
  "no whale liquidates here": "此处没有巨鲸强平",
  "{usd} of longs liquidate between here and the mark": "从此处到标记价格之间，多头强平 {usd}",
  "{usd} of shorts liquidate between the mark and here": "从标记价格到此处之间，空头强平 {usd}",
  Cursor: "光标",
  cursor: "光标",
  bar: "柱",
  cross: "十字线",
  "Light up the bar under the pointer": "高亮指针所在的柱",
  "Dashed crosshair at the pointer, with the value there on each axis":
    "在指针处显示虚线十字线，并在两侧坐标轴上标出该处数值",
  "no flow recorded": "没有记录到成交流",
  "close {price}": "收盘 {price}",
  "close {price} ({pct} since start)": "收盘 {price}（较窗口起点 {pct}）",
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
  "{asset} · cumulative volume delta · {n}-hour bars, {zone}":
    "{asset} · 累计成交量差 · 每根柱 {n} 小时，{zone}",
  "{asset} · cumulative volume delta · {n}-minute bars, {zone}":
    "{asset} · 累计成交量差 · 每根柱 {n} 分钟，{zone}",
  "{asset} taker CVD, last {window}: {cvd}. Market buyers {bought} vs sellers {sold}.":
    "{asset} 最近 {window} 的主动成交 CVD：{cvd}。市价买方 {bought}，市价卖方 {sold}。",
  "Last {window}": "最近 {window}",
  "Loading {interval} bars…": "正在加载 {interval} 柱…",
  "Loading {asset}…": "正在加载 {asset}…",
  "Not available yet: there is not enough history for {interval} bars":
    "暂不可用：历史数据不足以绘制 {interval} 柱",
  "Not available yet": "暂不可用",
  Price: "价格",
  "Net buy": "净买入",
  "Net sell": "净卖出",
  "hover or tap a bar to read it": "悬停或点击柱形查看数值",
  "{asset} bars; arrow keys read one at a time": "{asset} 柱形图；用方向键逐根查看",
  "{asset} price and cumulative volume delta over the last {window}":
    "{asset} 最近 {window} 的价格与累计成交量差",
  "{asset} net taker flow per bar": "{asset} 每根柱的主动成交净额",

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
  "Pick an asset to chart": "选择要绘制的资产",
  "{n} assets": "{n} 个资产",
  "No asset matches.": "没有匹配的资产。",
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
  "Price and flow disagreeing by more than the divergence thresholds in the tiles":
    "价格与成交流方向相反，且超过背离卡片中所列的阈值",
  Signal: "信号",
  "No live market lists {asset}, so there is no flow to chart.":
    "没有在线市场上架 {asset}，因此没有可绘制的成交流。",
  "Newest bucket {age}.": "最新时段：{age}。",
  "Venues publish each 5-minute bucket after it closes, so the right edge runs a few minutes behind.":
    "交易所在每个 5 分钟时段结束后才发布该时段数据，因此图表最右侧会落后几分钟。",

  // web/cvd.ts: the page.
  "taker buys": "主动买入",
  "taker sells": "主动卖出",
  "The asset button beside the intervals opens the screener: every polled asset's taker flow over the window. Pick one to chart it, find a ticker in its box, or sort by a heading. Change is the busiest polled market's first to last close in the window. History is uneven by venue: Binance and Gate publish weeks of it and OKX five days, so the oldest bars of a new 7-day window sum fewer venues.":
    "时间间隔旁的资产按钮会打开筛选器：每个被采集资产在窗口内的主动成交流。选择一个即可绘制其图表，也可以在搜索框中查找代码，或点击列标题排序。涨跌幅为成交最活跃的被采集市场在窗口内从首个收盘价到最后一个收盘价的变化。各交易所的历史数据长短不一：Binance 和 Gate 提供数周，OKX 提供五天，因此新的 7 天窗口中最早的几根柱加总的交易所较少。",

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
  "{month} {day} {time}–{end} {zone}": "{month}{day}日 {time}–{end} {zone}",
  "close, {market}": "收盘价，{market}",
  "open {open} · high {high} · low {low} · close {close}":
    "开 {open} · 高 {high} · 低 {low} · 收 {close}",
  "volume {usd}": "成交额 {usd}",
  "large taker buys {usd} ({n})": "大额主动买入 {usd}（{n} 笔）",
  "large taker sells {usd} ({n})": "大额主动卖出 {usd}（{n} 笔）",
  "no candle": "无 K 线",
  "{month} {day} {hours} {zone}": "{month}{day}日 {hours} {zone}",
  "{hours} {zone}": "{hours} {zone}",

  // web/kchart.ts: the trading chart on /cvd.
  "Loading older bars…": "正在加载更早的 K 线…",
  "Nothing older: taker flow is kept for {days} days.":
    "没有更早的数据：主动成交数据保留 {days} 天。",
  "Older bars did not load. Drag again to retry.": "更早的 K 线未能加载，再拖动一次可重试。",
  "drag to look back · wheel or pinch to zoom · hover a candle to read it":
    "拖动查看历史 · 滚轮或双指缩放 · 悬停 K 线查看数值",
  "Futures CVD": "合约 CVD",
  "Spot CVD": "现货 CVD",
  "Delta buy": "Delta 净买入",
  "Delta sell": "Delta 净卖出",
  "{asset} delta per bar, spot and futures net taker flow summed":
    "{asset} 每根柱的 Delta，即现货与合约主动成交净额之和",
  "No taker flow for {asset} in the last {window}. Only the ~500 assets deepest on {venues} are polled; pick one from the asset list above.":
    "最近 {window} 内没有 {asset} 的主动成交数据。只采集在 {venues} 上持仓量最大的约 500 个资产；请从上方的资产列表中选择一个。",
  "Price with cumulative volume delta under it: spot and futures taker buying against taker selling, their combined delta per bar, and where price and order flow disagree.":
    "价格及其下方的累计成交量差：现货与合约的主动买入与主动卖出对比、每根柱的合并 Delta，以及价格与订单流方向相反之处。",
  "Price, with cumulative volume delta (CVD) under it: {buys} less {sells}, in dollars. Futures CVD is the exchanges' own 5-minute taker statistics for their perpetuals from <b>{venues}</b>, summed, for the ~500 assets deepest on them and every commodity, index and currency pair they list — not every venue, and nothing finer than five minutes. A divergence marks a window where price and flow pointed opposite ways; it describes what happened, not what happens next.":
    "价格，下方为累计成交量差（CVD）：{buys}减去{sells}，单位为美元。合约 CVD 来自交易所自身发布的永续合约 5 分钟主动成交统计（<b>{venues}</b>），加总后覆盖在这些交易所上持仓量最大的约 500 个资产，以及它们上市的所有商品、指数和货币对 — 并非所有交易所，也没有比五分钟更细的粒度。背离表示该时间窗口内价格与成交流方向相反；它描述的是已经发生的情况，而不是对后市的预测。",
  "Spot CVD is Binance's USDT spot book alone, for the crypto assets it lists; stocks, commodities and indices have no spot book on a crypto exchange and show futures only. Spot and futures each have a pane, because their sizes differ by an order of magnitude on most assets. The histogram under them is the delta: each bar's spot and futures net summed.":
    "现货 CVD 仅来自 Binance 的 USDT 现货订单簿，覆盖其上市的加密资产；股票、商品和指数在加密交易所没有现货订单簿，只显示合约。现货与合约各占一个面板，因为在大多数资产上两者的规模相差一个数量级。下方的柱状图为 Delta：每根柱的现货净额与合约净额之和。",
  "Price is the busiest polled market's own candle. Each pane has its own scale, so where lines cross means nothing. Drag to look back, wheel or pinch to zoom, and hover a candle to read it in the line above the chart; on a phone, tap.":
    "价格为成交最活跃的被采集市场自身的 K 线。每个面板有各自的刻度，因此线条在哪里交叉没有任何含义。拖动可回看历史，滚轮或双指缩放，将鼠标悬停在 K 线上即可在图表上方的那一行读取数值；在手机上请点击。",
  "futures net {net}": "合约净额 {net}",
  "spot net {net}": "现货净额 {net}",
  "delta {net}": "Delta {net}",
  "delta {net} ({pct} of volume)": "Delta {net}（占成交量 {pct}）",
  "CVD futures {futures}, spot {spot}": "CVD 合约 {futures}，现货 {spot}",
};
