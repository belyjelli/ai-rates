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
  "<b>{usd}</b> · {share}% of this asset's forced flow":
    "<b>{usd}</b> · 占该资产强平总额的 {share}%",
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
};
