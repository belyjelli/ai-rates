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
  each: "分别",
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
  "Every feed": "全部数据源",
  "Every feed, {count} venues": "全部数据源，共 {count} 家交易所",
  "other markets": "其他市场",
  total: "合计",
  "No liquidations recorded in the last {window}. Only the venues that publish a feed the collector reads appear here, so a quiet window is not a quiet market.":
    "最近 {window} 内没有记录到爆仓。这里只显示发布了本站采集器所读取的爆仓数据流的交易所，因此窗口内没有爆仓并不代表市场平静。",
  "Columns are {hours}-hour buckets in UTC, newest on the right; the last one is still filling.":
    "每列为 {hours} 小时的时段（UTC），最新的在最右侧；最后一列仍在累计中。",
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
  "{asset} longs vs shorts over time · {hours}-hour bars, UTC":
    "{asset} 多空爆仓走势 · 每根柱 {hours} 小时，UTC",
  "{asset} longs vs shorts over time · {minutes}-minute bars, UTC":
    "{asset} 多空爆仓走势 · 每根柱 {minutes} 分钟，UTC",
  "Longs closed": "多头爆仓",
  "Shorts closed": "空头爆仓",
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
};
