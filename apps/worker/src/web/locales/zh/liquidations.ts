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
  "axis squeezed above {usd}": "纵轴在 {usd} 以上压缩",
  "Modeled from 30 days of open interest and price on each market and its leverage limits, not reported by venues.":
    "根据各市场30天的未平仓合约、价格及其杠杆上限估算，并非交易所披露的数据。",
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
  "Asset Timeline": "资产时间线",
  Timeline: "时间线",
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
  "{asset} liquidations": "{asset} 爆仓",
  "{asset} liquidations across exchanges: longs against shorts by the hour, the price levels positions were closed at, and where large open positions would be liquidated.":
    "{asset} 各交易所爆仓：逐小时多空对比、仓位被强平的价位，以及大额未平仓位的爆仓价。",
  "All assets": "全部资产",
  "{n} exchange": "{n} 家交易所",
  "{n} asset": "{n} 个资产",
  "In the last 7 days": "过去 7 天内",
  "In the last 48 hours": "过去 48 小时内",
  "In the last 24 hours": "过去 24 小时内",
  "{share} of it longs": "其中 {share} 为多头",
  "{share} of it shorts": "其中 {share} 为空头",
  "{window}, no {asset} position was force-closed on the exchanges whose liquidation feeds the collector reads.":
    "{window}，在采集器读取爆仓数据的交易所中，没有 {asset} 仓位被强平。",
  "{window}, {total} of {asset} positions were force-closed in {events} on {venues}, {sides}.":
    "{window}，{venues}共强平 {asset} 仓位 {total}，计 {events}，{sides}。",
  "The largest single one was a {usd} long on {venue} at {price}, {ago}.":
    "单笔最大的是 {venue} 上一笔 {usd} 的多头，成交于 {price}，{ago}。",
  "The largest single one was a {usd} short on {venue} at {price}, {ago}.":
    "单笔最大的是 {venue} 上一笔 {usd} 的空头，成交于 {price}，{ago}。",
  "Of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX, {longs} of longs would be liquidated within 5% below the price and {shorts} of shorts within 5% above.":
    "在 Hyperliquid、Lighter 和 dYdX 上关注的 $1M 及以上巨鲸仓位中，价格下方 5% 以内有 {longs} 的多头会被强平，上方 5% 以内有 {shorts} 的空头。",
  "{window}, {total} of positions were force-closed across {assets} on {venues}, {sides}.":
    "{window}，{venues}共强平 {assets}的仓位 {total}，{sides}。",
  "The most liquidated: {list}.": "爆仓最多：{list}。",
  "The largest single liquidation was a {usd} {asset} long on {venue} at {price} ({when} UTC).":
    "单笔最大爆仓是 {venue} 上一笔 {usd} 的 {asset} 多头，成交于 {price}（UTC {when}）。",
  "The largest single liquidation was a {usd} {asset} short on {venue} at {price} ({when} UTC).":
    "单笔最大爆仓是 {venue} 上一笔 {usd} 的 {asset} 空头，成交于 {price}（UTC {when}）。",
  Order: "排序",
  "Largest first": "最大优先",
  "Newest first": "最新优先",
  "Smallest close": "最小金额",
  "The largest liquidations could not be read right now.": "暂时无法读取最大爆仓。",
  "No single liquidation of {floor} or more in this window.":
    "此时间窗口内没有 {floor} 及以上的单笔爆仓。",
  "Nothing has been force-closed in this window.": "此时间窗口内没有仓位被强平。",
  "The {n} newest liquidations of {floor} or more in this window.":
    "此时间窗口内最新的 {n} 笔 {floor} 及以上爆仓。",
  "Every liquidation of {floor} or more in this window.": "此时间窗口内所有 {floor} 及以上的爆仓。",
  "The {n} largest single liquidations in this window.": "此时间窗口内最大的 {n} 笔单笔爆仓。",
  "Every liquidation in this window, largest first.": "此时间窗口内的全部爆仓，按金额从大到小。",
  "The position's value at the fill price": "按成交价格计算的仓位价值",
  "Each row is one forced close as its exchange reported it: the side is the position that was closed, the size its value at the fill price. Times are in {zone}.":
    "每行是交易所报告的一笔强平：方向是被平掉的仓位，金额是按成交价格计算的价值。时间为 {zone}。",
  "{asset} largest liquidations": "{asset} 最大爆仓",
  "Largest liquidations": "最大爆仓",
  Largest: "最大",
  "None of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX would be liquidated within 5% of the price.":
    "在 Hyperliquid、Lighter 和 dYdX 上关注的 $1M 及以上巨鲸仓位中，没有一个会在价格 5% 以内被强平。",
  later: "稍后",
  "A cascade is a burst in which one asset's liquidations piled up within minutes: consecutive minutes each running at {pace} times its 7-day average pace or more, with no more than {gap} quiet minutes between them, and at least an hour's worth of that average pace, and {floor}, in all. Every exchange whose liquidation feed the collector reads is counted; the venue choices on the other tabs do not narrow it.":
    "连环爆仓是指某一资产的爆仓在几分钟内集中爆发：连续若干分钟，每分钟的爆仓速度都达到其 7 天平均速度的 {pace} 倍或以上，中间的平静时段不超过 {gap} 分钟，且合计至少相当于平均速度一小时的量，并不少于 {floor}。采集器读取爆仓数据的所有交易所都计入；其他标签页的交易所选择不会缩小范围。",
  "Prices are the asset's busiest market in 5-minute candles. Into it is the move from the last close before the cascade to the furthest the price went inside it: the low when mostly longs were closed, the high when mostly shorts were. 1h and 4h after run from the close at its end to the close an hour and four hours later, and say later until that candle has closed.":
    "价格取该资产成交最活跃的市场的 5 分钟 K 线。“期间”是从连环爆仓开始前的最后收盘价到期间价格走得最远之处：以多头爆仓为主时取最低价，以空头为主时取最高价。“1 小时后”和“4 小时后”是从结束时的收盘价到一小时和四小时后的收盘价，在那根 K 线收盘前显示“稍后”。",
  "The cascades could not be read right now.": "暂时无法读取连环爆仓。",
  "No cascade in {asset} in this window: no burst reached {pace} times its usual pace with an hour's worth of it. Its usual pace is {usd} a minute, the 7-day average.":
    "此时间窗口内 {asset} 没有连环爆仓：没有一段爆发达到其平常速度的 {pace} 倍并累计一小时的量。其平常速度为每分钟 {usd}，即 7 天平均值。",
  "none in this window": "此窗口内没有",
  "none an hour old yet": "尚无满一小时的",
  "higher in {up} of {n}": "{n} 次中 {up} 次走高",
  Cascades: "连环爆仓",
  "{usd} longs": "多头 {usd}",
  "{usd} shorts": "空头 {usd}",
  "An hour after long cascades": "多头连环爆仓一小时后",
  "An hour after short cascades": "空头连环爆仓一小时后",
  "Usual pace": "平常速度",
  "a minute, the 7-day average": "每分钟，7 天平均",
  "{n} min": "{n} 分钟",
  "longs {share}": "多头 {share}",
  "shorts {share}": "空头 {share}",
  "Prices: {market} on {venue}, in 5-minute candles.": "价格：{venue} 的 {market}，5 分钟 K 线。",
  "No price history for {asset}, so the moves are blank.": "{asset} 没有价格历史，因此涨跌为空。",
  Start: "开始",
  Length: "时长",
  "Exchanges with a liquidation in it": "期间有爆仓的交易所",
  "The last close before the cascade began": "连环爆仓开始前的最后收盘价",
  "Price before": "之前价格",
  "From the price before to the furthest it went inside the cascade":
    "从之前价格到期间价格走得最远之处",
  "Into it": "期间",
  "From the close at its end to the close an hour later": "从结束时的收盘价到一小时后的收盘价",
  "1h after": "1 小时后",
  "From the close at its end to the close four hours later": "从结束时的收盘价到四小时后的收盘价",
  "4h after": "4 小时后",
  "Newest first.": "最新的在前。",
  "Times are in {zone}.": "时间为 {zone}。",
  "Nothing has been force-closed in this window, so there is no asset to read.":
    "此时间窗口内没有仓位被强平，因此没有可读取的资产。",
  "{asset} cascades": "{asset} 连环爆仓",
  "{asset} longs vs shorts by day · UTC days": "{asset} 每日多空对比 · UTC 日",
  "30- and 90-day history": "30 天和 90 天历史",
  "{asset} over 30 and 90 days": "{asset} 的 30 天和 90 天",
  "Every day's longs and shorts liquidated over the last 30 or 90 days, each day as a share of the open interest on the same exchanges, and the heaviest days ranked.":
    "过去 30 或 90 天每天被强平的多头和空头，每天占同一批交易所未平仓量的比例，并列出最重的几天。",
  "Liquidations against open interest": "爆仓与未平仓量对比",
  "Which markets were really flushed rather than just big: every asset's liquidations in the window as a share of its open interest, and the same for crypto, stocks, commodities and indices.":
    "哪些市场是真正被清洗，而不只是规模大：此时间窗口内每个资产的爆仓占其未平仓量的比例，以及加密货币、股票、大宗商品和指数各自的比例。",
  "For members": "会员专享",
  "Create a free account": "免费注册",
  "Loading the member view…": "正在加载会员视图…",
  "The history could not be read right now.": "暂时无法读取历史。",
  "Nothing was force-closed in {asset} over this span.": "此期间 {asset} 没有仓位被强平。",
  "Liquidated over {span} days": "{span} 天内爆仓",
  "A typical day": "典型的一天",
  "of open interest, on average": "占未平仓量的平均比例",
  "The heaviest day": "最重的一天",
  "Days with data": "有数据的天数",
  "from {date}": "自 {date}",
  "The heaviest days, as a share of open interest": "最重的几天（占未平仓量比例）",
  "Day (UTC)": "日期（UTC）",
  "Exchanges that reported a liquidation that day": "当天报告了爆仓的交易所",
  "Open interest is the day's average on the exchanges whose liquidation feeds reported {asset}, so the share compares like with like.":
    "未平仓量是当天报告 {asset} 爆仓的交易所上的日均值，因此比例是同口径比较。",
  "Liquidation feeds were added over time: from {least} to {most} exchanges a day here, so early days undercount.":
    "爆仓数据源是陆续加入的：这里每天 {least} 到 {most} 家交易所，因此较早的日子偏少。",
  Commodities: "大宗商品",
  Indices: "指数",
  "The open interest could not be read right now.": "暂时无法读取未平仓量。",
  "{liq} of {oi} open": "{oi} 未平仓中的 {liq}",
  "The markets most flushed for their size": "相对规模被清洗最多的市场",
  "No market with $1M of open interest had a liquidation in this window.":
    "此时间窗口内没有未平仓量达 $1M 的市场发生爆仓。",
  Class: "类别",
  "Liquidations over the last {window} against the open interest now, both on the {feeds} exchanges whose liquidation feeds reported closes in that window. Markets under $1M of open interest are left out of the ranking.":
    "过去 {window} 的爆仓与当前未平仓量对比，两者都取自此窗口内报告了爆仓的 {feeds} 家交易所。未平仓量低于 $1M 的市场不参与排名。",
  Span: "期间",
  History: "历史",
  "{asset} history": "{asset} 历史",
  "Liquidations vs open interest": "爆仓与未平仓量对比",
  "vs OI": "对比 OI",
  "Every cascade, in every asset": "所有资产的每一次连环爆仓",
  "Every liquidation cascade in every asset, found each minute as it happens, with the price an hour and four hours after. Members can also have them sent to Telegram the moment they start.":
    "每个资产的每一次连环爆仓，每分钟实时发现，并附上一小时和四小时后的价格。会员还可以在连环爆仓开始时收到 Telegram 推送。",
  "No cascade in any asset in the last {window}.": "过去 {window} 内没有任何资产发生连环爆仓。",
  "in {n} assets": "涉及 {n} 个资产",
  "Longs and shorts": "多头与空头",
  "{longs} long cascades, {shorts} short": "{longs} 次多头连环爆仓，{shorts} 次空头",
  "The deepest market's mark when the watch first saw it, a minute or two in":
    "监测首次发现时最深市场的标记价格，约在开始后一两分钟",
  "Price when seen": "发现时价格",
  "From the price when seen to the mark an hour after the cascade ended":
    "从发现时价格到连环爆仓结束一小时后的标记价格",
  "From the price when seen to the mark four hours after the cascade ended":
    "从发现时价格到连环爆仓结束四小时后的标记价格",
  "Every asset, found each minute as it happens, by the rule of each asset's Cascades tab. Prices are the asset's deepest market's mark when the watch saw it and an hour and four hours after it ended. Members can have them sent to Telegram from {alerts}.":
    "所有资产，每分钟实时发现，规则与各资产的连环爆仓标签页相同。价格是监测发现时以及结束一小时和四小时后该资产最深市场的标记价格。会员可以在 {alerts} 设置 Telegram 推送。",
  "the alerts page": "提醒页面",
  "All cascades": "全部连环爆仓",
  // The member Top traders tab (web/trader.ts), 2026-11-15.
  "24h": "24小时",
  "30d": "30日",
  "All time": "全部时间",
  "over the last day": "过去一天",
  "over the last week": "过去一周",
  "over the last month": "过去一个月",
  "over all time": "全部时间",
  "Long {coin}": "做多 {coin}",
  "Short {coin}": "做空 {coin}",
  "Rank by profit over": "按以下时段的盈利排名",
  "Hyperliquid's leaderboard could not be read right now. Try again in a minute.":
    "暂时无法读取 Hyperliquid 排行榜，请一分钟后再试。",
  "+{n} more": "另有 {n} 个",
  "nothing over $100k": "没有超过 $100k 的持仓",
  Profit: "盈利",
  "Profit over the account's value, as Hyperliquid's leaderboard computes it":
    "盈利除以账户价值，按 Hyperliquid 排行榜的算法",
  Return: "收益率",
  "Account value": "账户价值",
  "Holding now": "当前持仓",
  "Hyperliquid's own leaderboard, every one of its {ranked} accounts ranked by profit {window}, read {ago}. Hyperliquid is the large perp exchange where every account is public, so any of them opens on its positions, fills and orders. Holdings are the whale tracker's: positions of $100k and up, read within three hours.":
    "Hyperliquid 官方排行榜：全部 {ranked} 个账户按{window}的盈利排名，读取于 {ago}。Hyperliquid 是每个账户都公开的大型永续合约交易所，因此任何一个账户都可以打开查看其持仓、成交和订单。持仓来自巨鲸追踪：$100k 及以上的仓位，三小时内读取。",
  "Too little history in this window to draw.": "该时段的历史数据太少，无法绘制。",
  "Open long": "开多",
  "Close long": "平多",
  "Open short": "开空",
  "Close short": "平空",
  "Long to short": "多转空",
  "Short to long": "空转多",
  Buy: "买入",
  Sell: "卖出",
  Limit: "限价",
  "Stop market": "止损市价",
  "Stop limit": "止损限价",
  "Take profit market": "止盈市价",
  "Take profit limit": "止盈限价",
  "reduce only": "只减仓",
  "position TP/SL": "仓位止盈止损",
  Filled: "已成交",
  Canceled: "已撤销",
  Triggered: "已触发",
  Rejected: "已拒绝",
  "Canceled: margin": "已撤销：保证金不足",
  "All top traders": "全部顶级交易者",
  "#{place} on Hyperliquid's leaderboard by profit {window}.":
    "按{window}的盈利，在 Hyperliquid 排行榜第 {place} 名。",
  "Hyperliquid is answering too many requests right now. Try again in a minute.":
    "Hyperliquid 当前请求过多，请一分钟后再试。",
  "Hyperliquid did not answer for this account right now. Try again in a minute.":
    "Hyperliquid 暂未返回该账户的数据，请一分钟后再试。",
  "{usd} free to withdraw": "可提取 {usd}",
  "Profit {window}": "{window}盈利",
  "{usd} traded": "成交 {usd}",
  "Open positions": "未平仓位",
  "{lev}x the account's value": "为账户价值的 {lev} 倍",
  "on the open positions": "来自未平仓位",
  "Profit chart window": "盈亏图时段",
  "Profit and loss {window}": "{window}盈亏",
  "The profit history could not be read right now.": "暂时无法读取盈亏历史。",
  "No open positions.": "没有未平仓位。",
  Coin: "币种",
  "Unrealized profit over the margin the position holds": "未实现盈亏除以该仓位占用的保证金",
  ROE: "回报率",
  "Liq. price": "强平价格",
  "Funding the position has paid since it opened; a minus is funding received":
    "该仓位开仓以来支付的资金费；负数为收取的资金费",
  isolated: "逐仓",
  "The positions could not be read right now.": "暂时无法读取持仓。",
  "Resting orders": "挂单",
  Placed: "下单时间",
  Trigger: "触发价",
  "The fills could not be read right now.": "暂时无法读取成交记录。",
  "No fills on record.": "没有成交记录。",
  "This account was liquidated in this fill": "该账户在这笔成交中被强平",
  liquidated: "被强平",
  "Results by coin": "按币种的结果",
  "Orders that filled": "已成交的订单",
  Trades: "交易",
  "Profit realized by closing, before fees": "平仓实现的盈亏，未扣手续费",
  "Closed P&amp;L": "已实现盈亏",
  Fees: "手续费",
  Direction: "方向",
  "Size-weighted over the order's fills": "按该订单各笔成交的数量加权",
  Fee: "手续费",
  "Fills the order took": "该订单的成交笔数",
  "No trades in {coin} among these fills.": "这些成交中没有 {coin} 的交易。",
  "Hyperliquid answers an account's last {n} fills, here from {date}; results by coin are over those fills only. Each trade is one order's fills taken together.":
    "Hyperliquid 只返回一个账户最近的 {n} 笔成交，这里从 {date} 起；按币种的结果仅基于这些成交。每笔交易是一个订单所有成交的合计。",
  "The order history could not be read right now.": "暂时无法读取订单历史。",
  market: "市价",
  "No orders on record.": "没有订单记录。",
  "Hyperliquid answers an account's last {n} orders, each shown once at its latest status.":
    "Hyperliquid 只返回一个账户最近的 {n} 个订单，每个订单按其最新状态显示一次。",
  "Hyperliquid throttled part of this read; what is missing says so. Try again in a minute.":
    "Hyperliquid 限制了本次部分读取，缺失的部分已注明。请一分钟后再试。",
  Positions: "持仓",
  "Order history": "订单历史",
  "Read from Hyperliquid {ago}.": "{ago}从 Hyperliquid 读取。",
  "Top traders, and every order they place": "顶级交易者，以及他们下的每一笔订单",
  "Hyperliquid's biggest winners over a day, a week, a month or all time, with what they hold now. Open any of them for their positions and liquidation prices, profit over time, and their recent trades and orders, coin by coin.":
    "Hyperliquid 在一天、一周、一个月或全部时间内盈利最多的交易者，以及他们当前的持仓。打开任何一位，可查看其持仓与强平价格、盈亏走势，以及按币种列出的近期交易和订单。",
  "Top traders": "顶级交易者",
  Winners: "赢家",
};
