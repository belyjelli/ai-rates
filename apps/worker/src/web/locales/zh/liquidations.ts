/**
 * Simplified Chinese for web/liquidations.ts: the /liquidations map, the priced grid and the
 * longs-vs-shorts chart. Glossary and style: ./index.ts.
 *
 * Window codes ("24h", "7d") are left as written, as interval figures are elsewhere on the site: they
 * are units in a control strip and in its URLs, not words.
 */

import type { Catalog } from "../../i18n";

export const liquidations: Catalog = {
  // Axis dates.
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

  // Controls and legend.
  Window: "时间窗口",
  Venue: "交易所",
  all: "全部",
  Cell: "单元格",
  "longs closed": "多头爆仓",
  "shorts closed": "空头爆仓",
  "Band width": "区间宽度",
  Asset: "资产",
  fit: "自适应",

  // The map tab.
  "{usd} across {count} liquidation — {long} long, {short} short":
    "{usd}，共 {count} 笔爆仓 — 多头 {long}，空头 {short}",
  "{usd} across {count} liquidations — {long} long, {short} short":
    "{usd}，共 {count} 笔爆仓 — 多头 {long}，空头 {short}",
  "This column is still filling": "此列仍在累计中",
  "<b>{usd}</b> · {events} liquidations · {markets} markets":
    "<b>{usd}</b> · {events} 笔爆仓 · {markets} 个市场",
  "no liquidations in this window": "此时间窗口内没有爆仓",
  "other markets": "其他市场",
  total: "合计",
  "No liquidations recorded in the last {window}. Only the venues that publish a feed the collector reads appear here, so a quiet window is not a quiet market.":
    "最近 {window} 内没有记录到爆仓。这里只显示发布了本站采集器所读取的爆仓数据流的交易所，因此窗口内没有爆仓并不代表市场平静。",
  "Columns are {hours}-hour buckets in {zone}, newest on the right; the last one is still filling.":
    "每列为 {hours} 小时的时段（{zone}），最新的在最右侧；最后一列仍在累计中。",
  "Newest liquidation {age}.": "最新爆仓：{age}。",
  "Rows are the {count} busiest assets by notional across every feed, and the rest are summed into “other markets”, so the totals below the grid are real totals and add up.":
    "各行是所有数据源中按名义价值排名前 {count} 的资产，其余合并为“其他市场”，因此表格下方的合计是真实合计，可以逐项相加核对。",
  "Any row opens that asset at the price it died at.": "点击任意一行，可按爆仓价格查看该资产。",

  // The priced tab.
  "<b>{usd}</b> · {events} liquidations · {long} long / {short} short":
    "<b>{usd}</b> · {events} 笔爆仓 · 多头 {long} / 空头 {short}",
  "nothing force-closed here in this window": "此时间窗口内这里没有强制平仓",
  "Fill price": "成交价格",
  "No live market for {asset} is publishing a mark, so there is no price to band liquidations against.":
    "{asset} 目前没有发布标记价格的在线市场，因此没有可用于划分爆仓价格区间的基准价。",
  "No liquidations recorded for {asset} in the last {window}. Only the venues publishing a feed the collector reads appear here.":
    "最近 {window} 内没有记录到 {asset} 的爆仓。这里只显示发布了本站采集器所读取的爆仓数据流的交易所。",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark; the outer rows hold everything further out.":
    "当前显示 <b>{asset}</b>，以标记价格为中心按 {pct}% 划分价格区间；最外侧两行包含更远处的全部爆仓。",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark, fitted to where this asset's closes actually landed; the outer rows hold everything further out.":
    "当前显示 <b>{asset}</b>，以标记价格为中心按 {pct}% 划分价格区间（按该资产实际爆仓的分布自动适配）；最外侧两行包含更远处的全部爆仓。",
  "Banded from <b>{mark}</b>, the deepest market's mark — the same anchor the arbitrage guard uses, so both venues share rows.":
    "区间以 <b>{mark}</b> 为基准，即持仓量最大市场的标记价格 — 与套利校验使用的基准相同，因此各交易所共用同一组行。",

  // The longs-vs-shorts tab and its chart.
  "Last {window}": "最近 {window}",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Longs took the beating.":
    "{asset} 最近 {window} 爆仓：多头被强平 {long}，空头被强平 {short}，共 {events} 笔。多头损失更重。",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Shorts took the beating.":
    "{asset} 最近 {window} 爆仓：多头被强平 {long}，空头被强平 {short}，共 {events} 笔。空头损失更重。",
  "{asset} longs vs shorts over time · {hours}-hour bars, {zone}":
    "{asset} 多空爆仓走势 · 每根柱 {hours} 小时，{zone}",
  "{asset} longs vs shorts over time · {minutes}-minute bars, {zone}":
    "{asset} 多空爆仓走势 · 每根柱 {minutes} 分钟，{zone}",
  "Longs closed": "多头爆仓",
  "Shorts closed": "空头爆仓",
  "Longs at risk, modeled · price falls <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "多头风险（模型估算）· 价格下跌 <b>{pct}</b> 至 {range} · 约 <b>{usd}</b> 将被强平",
  "Shorts at risk, modeled · price rises <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "空头风险（模型估算）· 价格上涨 <b>{pct}</b> 至 {range} · 约 <b>{usd}</b> 将被强平",
  "Shorts at risk above": "上方空头风险",
  "Longs at risk below": "下方多头风险",
  "Modeled pending liquidations between {low} and {high}, around {mark}: about {shorts} of shorts above and {longs} of longs below":
    "{low} 至 {high} 之间（当前 {mark}）的待触发爆仓（模型估算）：上方空头约 {shorts}，下方多头约 {longs}",
  "Pending range": "待触发范围",
  "Zoom in": "放大",
  "Columns are time, in your time zone ({zone}; click the clock at the top for UTC). Each is a {hours}-hour block named by its start hour. Where the day changes, the column shows date/hour (7/00 = the 7th at 00:00). The yellow column is the block in progress and still filling.":
    "列表示时间，按你的时区（{zone}；点击顶部时钟可切换为 UTC）。每列为 {hours} 小时，以开始时刻标注。日期变化处显示为 日/时（7/00 = 7 日 00:00）。黄色列为当前时段，仍在累计。",
  "'All' is that price row's total over the whole window.":
    "「全部」为该价格行在整个时间窗口内的合计。",
  "{range}, still filling": "{range}，仍在累计",
  "This tab did not load.": "此标签页未能加载。",
  "Try again": "重试",
  "Loading…": "加载中…",
  "Open this tab": "打开此标签页",
  "This tab has nothing to show right now.": "此标签页暂无内容。",
  "Zoom out": "缩小",
  "shorts liquidate if price rises": "价格上涨则空头被强平",
  "longs liquidate if price falls": "价格下跌则多头被强平",
  "pending is modeled": "待触发部分为模型估算",
  "pending by price band": "按价格区间的待触发爆仓",
  "Modeled from open interest and leverage tiers, not reported by venues.":
    "根据未平仓合约和杠杆档位估算，并非交易所披露的数据。",
  Pending: "待触发",
  "Pending on": "显示待触发",
  "Pending off": "隐藏待触发",
  "hover or tap a bar to read it": "悬停或点击柱形查看数值",
  "{asset} bars; arrow keys read one at a time": "{asset} 柱形图；用方向键逐根查看",
  "{asset} longs closed above zero and shorts closed below, over the last {window}":
    "{asset} 最近 {window} 的爆仓：零线以上为多头爆仓，以下为空头爆仓",
  "Longs closed above the line, shorts closed below, on the same linear scale. Hover a bar to read it beside the cursor; on a phone, tap and it reads in the line above the chart. The last bar is still filling.":
    "零线以上为多头爆仓，以下为空头爆仓，两者使用同一线性刻度。将鼠标悬停在柱形上即可在光标旁查看数值；在手机上点击柱形，数值会显示在图表上方的那一行中。最后一根柱仍在累计中。",
  "{usd} of longs closed between {band}": "{band} 区间内多头爆仓 {usd}",
  "{usd} of shorts closed between {band}": "{band} 区间内空头爆仓 {usd}",
  "Longs closed <b>{usd}</b> · {share}%": "多头爆仓 <b>{usd}</b> · {share}%",
  "Shorts closed <b>{usd}</b> · {share}%": "空头爆仓 <b>{usd}</b> · {share}%",
  All: "全部",
  "Nothing was force-closed in {asset} in the last {window}, on either side.":
    "最近 {window} 内 {asset} 的多空双方均没有被强制平仓。",
  "Showing <b>{asset}</b>, every exchange added together — the split by exchange is one tab along. Rows are the same {pct}% price bands, banded from <b>{mark}</b>. A long close is a forced SELL and a short close a forced BUY, so the heavier side is the one the move ran against. Any asset outside this list opens from a row on the map tab.":
    "当前显示 <b>{asset}</b>，已汇总所有交易所 — 按交易所拆分的视图在相邻标签页。各行使用相同的 {pct}% 价格区间，以 <b>{mark}</b> 为基准。多头爆仓是被迫卖出，空头爆仓是被迫买入，因此爆仓更重的一方就是行情所针对的一方。列表之外的资产可从地图标签页中的对应行打开。",

  // The page.
  "Nothing has been force-closed in this window, so there is no asset to price.":
    "此时间窗口内没有强制平仓，因此没有可按价格查看的资产。",
  "Nothing has been force-closed in this window, so there is no asset to split.":
    "此时间窗口内没有强制平仓，因此没有可拆分多空的资产。",
  "{first} and {last}": "{first} 和 {last}",
  ", ": "、",
  Liquidations: "爆仓",
  "Where positions were force-closed: by venue, asset and hour, and by the price level they died at.":
    "仓位在哪里被强制平仓：按交易所、资产和时段，以及按爆仓时的价格水平。",
  "Where positions were force-closed, by exchange. Colour is the side that was closed — {longs}, {shorts} — and intensity is the money, on a log scale.":
    "各交易所的强制平仓分布。颜色表示被平仓的一方 — {longs}，{shorts} — 深浅表示金额，采用对数刻度。",
  "blue for longs": "蓝色为多头",
  "red for shorts": "红色为空头",
  "No venue has reported a liquidation in this window.": "此时间窗口内没有交易所报告爆仓。",
  "This is {venues}, the one venue whose liquidation feed the collector reads — not the whole market.":
    "以上数据来自 {venues}，即本站采集器读取其爆仓数据流的唯一一家交易所 — 并非全市场。",
  "This is {venues}, the {count} venues whose liquidation feed the collector reads — not the whole market.":
    "以上数据来自 {venues}，即本站采集器读取其爆仓数据流的 {count} 家交易所 — 并非全市场。",
  "By asset and hour": "按资产和时段",
  Assets: "资产",
  "Longs vs shorts": "多空对比",
  "{asset} longs vs shorts": "{asset} 多空对比",
  Sides: "多空",
  "By price level": "按价格水平",
  "{asset} price levels": "{asset} 价格水平",
  Prices: "价格",
  "Updated {ago}.": "{ago}更新。",

  // The odds tab.
  Odds: "概率",
  "{asset} odds": "{asset} 概率",
  "Nothing has been force-closed in this window, so there is no asset to size.":
    "此时间窗口内没有强制平仓，因此没有可估算波动的资产。",
  "4 hours": "4 小时",
  "6 hours": "6 小时",
  "1 day": "1 天",
  "1 week": "1 周",
  Within: "时限",
  "Typical move (1 sigma)": "典型波动（1 个标准差）",
  "Closes higher than now": "收盘高于当前价",
  "Reaches the heaviest forced-close level": "触及强平金额最大的价位",
  "Whichever of those two it reaches first": "两者中先触及的一个",
  "The upper one first": "先触及上方价位",
  "The lower one first": "先触及下方价位",
  Neither: "都没有触及",
  "Reaches a move of": "触及以下涨跌幅",
  "{price} ({where}) · {usd} closed, {share} of the window":
    "{price}（{where}）· 平仓 {usd}，占窗口内 {share}",
  Theory: "假说",
  "Reading now": "当前读数",
  Leans: "倾向",
  "Moves the odds?": "是否影响概率？",
  up: "上涨",
  down: "下跌",
  "Forced-close burst fades": "爆仓潮之后回落",
  "Funding crowding fades": "资金费率拥挤之后回落",
  "Stretch from the 50-hour average fades": "偏离 50 小时均线之后回归",
  "Initiative vs absorption": "主动成交与承接",
  "Fear and greed": "恐惧与贪婪",
  "Liquidation magnet": "爆仓磁吸",
  "Needs open positions by price level. The collector keeps closed ones only, so this cannot be read yet.":
    "需要按价格水平划分的未平仓头寸。采集器只保存已平仓的记录，因此目前无法读取。",
  "Fewer than 5 forced closes in the last 4 hours: too thin to call a burst.":
    "最近 4 小时强制平仓不足 5 笔：样本太少，不足以判断爆仓潮。",
  "Not enough data.": "数据不足。",
  "{longs} of the last 4 hours' forced closes were longs ({usd} in all)":
    "最近 4 小时的强制平仓中，多头占 {longs}（共 {usd}）",
  "{apr} a year funding, weighted by open interest": "按持仓量加权的资金费率年化 {apr}",
  "{sigma} bar-sigmas above its 50-hour average": "高于 50 小时均线 {sigma} 个 K 线标准差",
  "{sigma} bar-sigmas below its 50-hour average": "低于 50 小时均线 {sigma} 个 K 线标准差",
  "takers net buying {pct} of volume": "吃单净买入，占成交量 {pct}",
  "takers net selling {pct} of volume": "吃单净卖出，占成交量 {pct}",
  "{flow}, price {change} over 4 hours": "{flow}，4 小时内价格 {change}",
  "{score} out of 100": "{score} / 100",
  "No. Not yet tested, so it carries no weight.": "否。尚未通过检验，因此权重为零。",
  "No. Context only: its claim never leans.": "否。仅作背景参考，它的假说不指向涨跌。",
  "No. Cannot be computed.": "否。无法计算。",
  "There is not yet enough price history for {asset} to size its moves, or no live market is publishing a mark. The odds need at least 12 hours of closes.":
    "{asset} 的价格历史还不足以估算其波动，或者没有在线市场发布标记价格。概率至少需要 12 小时的收盘价。",
  "These are the odds that <b>{asset}</b> reaches a price within each horizon, worked out from how far it has actually been moving: about {hourly} an hour over the last {hours} hours. They are not a forecast of direction.":
    "这是 <b>{asset}</b> 在各个时限内触及某一价格的概率，依据它实际的波动幅度计算：最近 {hours} 小时约为每小时 {hourly}。这不是对方向的预测。",
  "The levels are where the most dollars were force-closed in the last {window}. Those positions are gone, so a heavy level is somewhere price has been, not fuel waiting for it. The collector does not keep open positions by price, so the resting map a liquidation magnet needs cannot be built yet.":
    "这些价位是最近 {window} 内强制平仓金额最大的位置。这些仓位已经不在了，所以金额大的价位只是价格走过的地方，并不是等着被触发的燃料。采集器不保存按价格划分的未平仓头寸，因此爆仓磁吸所需的挂单分布图目前还无法绘制。",
  "Real prices have fatter tails than this model assumes, so the far levels are reached more often than shown. Volatility is measured over the recent past and held constant.":
    "真实价格的尾部比此模型假设的更厚，所以较远的价位实际被触及的频率高于表中所示。波动率取自最近一段时间，并假设保持不变。",
  "Odds of reaching a level, from {asset}'s own volatility. They say how far it can go, not which way. The chance of closing higher stays at 50% until a theory below passes a test set in advance, after costs.":
    "触及某一价位的概率，依据 {asset} 自身的波动计算。它只说明能走多远，不说明往哪个方向。在下列任一假说通过事先设定的、扣除成本后的检验之前，收盘走高的概率保持 50%。",
  "Levels closer than the 4-hour typical move ({pct}) are left out, because price is already standing in them.":
    "距离小于 4 小时典型波动（{pct}）的价位已被排除，因为价格本来就停留在那里。",
  "No forced-close level lies beyond the 4-hour typical move": "4 小时典型波动之外没有强平价位",
  "What the liquidation theories read now": "爆仓假说的当前读数",
  "A reading that leans one way is a hypothesis, not a signal: none of these has been shown to beat the base rate. The first three are measured against a fade, the way their test was written down in advance, and a flat reading leans nowhere.":
    "读数倾向某一方向只是假说，不是信号：目前没有任何一项被证明胜过基准概率。前三项按事先写定的检验方式，以回落（反向）为假设来衡量；读数持平则不指向任何方向。",
  // web/liquidations.ts: the whale map tab.
  "Nothing has been force-closed in this window, so there is no asset to map.":
    "该时间窗口内没有任何强平，因此没有可绘制地图的资产。",
  "Position size": "仓位规模",
  "Price range": "价格范围",
  "Whale map": "巨鲸地图",
  "{asset} whale map": "{asset} 巨鲸地图",
  Whales: "巨鲸",

  // web/whale-map.ts
  "mark {price}": "标记价格 {price}",
  "{n} positions of {floor} or more · {longs} of longs, {shorts} of shorts · hover or tap a bar to read it":
    "{n} 个 {floor} 及以上的仓位 · 多头 {longs}，空头 {shorts} · 悬停或点按柱形查看",
  "Beyond ±{pct} of the mark, off the chart: {longs} of longs and {shorts} of shorts.":
    "距标记价格 ±{pct} 之外、未在图中显示：多头 {longs}，空头 {shorts}。",
  "{asset} · whale positions by liquidation price · {venues}":
    "{asset} · 巨鲸仓位，按强平价格分布 · {venues}",
  "Longs liquidate": "多头强平",
  "Shorts liquidate": "空头强平",
  "Total to the mark": "至标记价格的累计",
  "{asset} price bands; arrow keys read one at a time": "{asset} 价格区间；方向键逐个读取",
  "{asset} whale positions by the price they liquidate at": "{asset} 巨鲸仓位，按其强平价格分布",
  "Every position here is one an exchange publishes for a named account: reported, not modeled. Only Hyperliquid, Lighter and dYdX publish every account's positions, and together they hold about a tenth of the open interest; Binance, OKX and the other centralized exchanges publish none, so they are not in this map.":
    "这里的每个仓位都是交易所为某个具体账户公布的仓位：是实际数据，不是模型推算。只有 Hyperliquid、Lighter 和 dYdX 公开每个账户的仓位，三者合计约占全市场持仓量的十分之一；Binance、OKX 等中心化交易所不公开任何账户仓位，因此不在本地图中。",
  "Hyperliquid and Lighter report each position's liquidation price. dYdX does not, so its are computed from the account's own balance and positions with dYdX's maintenance margins, holding its other prices where they are; they are marked * in the table.":
    "Hyperliquid 和 Lighter 会给出每个仓位的强平价格。dYdX 不提供，因此其强平价格由账户自身的余额与仓位、按 dYdX 的维持保证金率计算得出，并假定账户其他市场价格不变；表格中以 * 标注。",
  "On Hyperliquid the collector watches the leaderboard's accounts worth $100k or more and any account it sees in a large trade, re-reading each every few minutes while it holds $1M or more and hourly while it holds $100k. On Lighter it follows the leaderboard's owners with $100k in the account or a $100k position, whose changes arrive as they happen. On dYdX it reads every account on the chain every five minutes. So the map covers the largest traders, not every account.":
    "在 Hyperliquid 上，采集器跟踪排行榜上资产 $100k 及以上的账户，以及出现大额成交的任何账户；持有 $1M 及以上仓位的账户每隔几分钟重新读取一次，持有 $100k 的每小时一次。在 Lighter 上，它跟踪排行榜上账户资产达 $100k 或持有 $100k 仓位的地址，仓位变化实时推送。在 dYdX 上，它每五分钟读取一次链上的全部账户。因此地图覆盖的是最大的交易者，而不是所有账户。",
  "A cross-margin position's liquidation price moves with the rest of its account: its other positions' profit and loss, deposits and withdrawals. Each one is as of its account's last read, shown in the table. Bars are the money that liquidates in each price band, longs below the mark and shorts above; the lines add up everything between the mark and that price.":
    "全仓仓位的强平价格会随账户其余部分变化：其他仓位的盈亏、充值与提现。每个仓位以其账户最近一次读取为准，读取时间见表格。柱形表示每个价格区间内会被强平的金额，多头在标记价格下方，空头在上方；折线累计从标记价格到该价格之间的全部金额。",
  "The whale positions could not be read right now.": "暂时无法读取巨鲸仓位。",
  "No position of {floor} or more in {asset} among the accounts watched.":
    "在所跟踪的账户中，没有 {asset} 上 {floor} 及以上的仓位。",
  "There are {n} of $100k or more: switch to $100k+.":
    "有 {n} 个 $100k 及以上的仓位：可切换到 $100k+。",
  "nearest at {price} ({pct})": "最近的在 {price}（{pct}）",
  "none with a liquidation price": "均无强平价格",
  "Whale longs": "巨鲸多头",
  "{n} positions": "{n} 个仓位",
  "Whale shorts": "巨鲸空头",
  "Within 5% of the mark": "距标记价格 5% 以内",
  "longs below / shorts above": "下方多头 / 上方空头",
  Accounts: "账户",
  "read a median {age}": "读取时间中位数：{age}",
  "No live mark for {asset}, so the positions cannot be placed on a price axis.":
    "{asset} 没有在线标记价格，因此无法将仓位放到价格轴上。",
  long: "多头",
  short: "空头",
  "No liquidation price: the account's margin covers any move":
    "没有强平价格：账户保证金足以覆盖任何波动",
  "dYdX publishes no liquidation price: computed from the account's balance and positions with dYdX's maintenance margins":
    "dYdX 不公布强平价格：按账户余额与仓位及 dYdX 的维持保证金率计算得出",
  "By venue:": "按交易所：",
  none: "无",
  "{leverage}× isolated": "{leverage}× 逐仓",
  // Cross margin, not the chart cursor's crosshair (charts.ts's "cross").
  "{leverage}× cross": "{leverage}× 全仓",
  "The {n} nearest to liquidation of {total}.": "共 {total} 个中最接近强平的 {n} 个。",
  "Positions by distance to liquidation": "按距强平远近排列的仓位",
  Trader: "交易者",
  Value: "价值",
  Entry: "开仓价",
  "Liquidates at": "强平价格",
  "From the market's mark to the liquidation price": "从该市场标记价格到强平价格的距离",
  Leverage: "杠杆",
  Unrealized: "未实现盈亏",
  "The whole account's value on its venue": "该账户在其交易所上的总价值",
  Account: "账户价值",
  Read: "读取",
  // Before a link to the member login, inside the sentence below.
  "Log in": "登录",
  "Refreshes every 30 s. {login} to refresh every 10 s, with the nearest accounts re-read about every minute.":
    "每 30 秒刷新一次。{login}后每 10 秒刷新，最接近强平的账户约每分钟重新读取一次。",
  "Live for members: refreshes every 10 s, and the nearest accounts are re-read about every minute.":
    "会员实时：每 10 秒刷新，最接近强平的账户约每分钟重新读取一次。",
  Indexes: "指数",
  "Other stocks": "其他股票",
  "Energy and other commodities": "能源及其他商品",
  FX: "外汇",
  "{long} long · {short} short": "多头 {long} · 空头 {short}",
  "Pick an asset": "选择资产",
  "Filter assets": "筛选资产",
  Liquidated: "爆仓额",
  "Longs / shorts": "多头 / 空头",
  Events: "笔数",
};
