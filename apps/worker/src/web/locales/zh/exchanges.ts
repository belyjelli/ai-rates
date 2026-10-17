import type { Catalog } from "../../i18n";

/**
 * The Exchanges page (web/exchanges.ts) and one exchange's trading-cost section on its own page.
 * Glossary and style: ./index.ts.
 *
 * Terms: grade 评级 (the letters S/A/B/C/D stay as written), score 得分, execution 执行, liquidity
 * 流动性, activity 活跃度, order book / book 订单簿, mid 中间价, market order 市价单, depth 深度,
 * credited 计入, basket 资产篮子, majors 主流币, snapshot 快照, median 中位数, fill 成交, book reach
 * 订单簿覆盖范围, taker fee 吃单手续费, bp 基点. Sizes ($10k, $100k) and bands (±0.1%, ±1%) are left
 * exactly as written; markouts stays in Latin letters, as desks write it.
 */
export const exchanges: Catalog = {
  // the grade badge and the table
  "score {score}: execution {execution}, liquidity {liquidity}, activity {activity}":
    "得分 {score}：执行 {execution}，流动性 {liquidity}，活跃度 {activity}",
  "fee {fee}{mark}": "手续费 {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "$100k 订单在资产篮子的 {n} 个订单簿上多数时候未能成交；每个按 {bps} 基点计",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, or 2% of the exchange's daily volume, is not counted":
    "评级只计入其中的 {usd}：超出市场持仓量十分之一、或超出交易所日成交量 2% 的深度不计入",
  "{n} of {total} assets": "{total} 个资产中的 {n} 个",
  "Not measured: its order book is not read yet": "未测量：尚未读取其订单簿",

  // the tiles
  "across {n} exchanges reporting now": "当前上报的 {n} 家交易所合计",
  "as each exchange reports it": "以各交易所公布的为准",
  "Cheapest $10k": "$10k 最低成本",
  "{venue}: taker fee and slippage, the basket's mix":
    "{venue}：吃单手续费加滑点，按资产篮子的构成",
  "no book measured yet": "尚无已测量的订单簿",
  "Deepest books": "最深订单簿",
  "{venue}: credited within 0.1% of the mid, 12 majors":
    "{venue}：中间价 0.1% 内计入的深度，12 个主流币",

  // column heads and their tooltips
  Grade: "评级",
  "This site's grade from its own measurements: S, A, B, C, D":
    "本站根据自身测量给出的评级：S、A、B、C、D",
  "Cost to trade $10k": "交易 $10k 的成本",
  "A $10k market order all in: the published standard taker fee plus what the book makes it pay beyond the mid":
    "一笔 $10k 市价单的全部成本：公布的标准吃单手续费，加上订单簿使其在中间价之外多付的部分",
  Slippage: "滑点",
  "What a $10k and a $100k market order pay beyond the mid, from the book, before fees":
    "$10k 和 $100k 市价单在中间价之外多付的部分，按订单簿计算，未计手续费",
  "The gap between the best bid and ask, basis points of the mid":
    "最优买价与最优卖价之差，以中间价的基点表示",
  Depth: "深度",
  "Dollars resting within 0.1% and within 1% of the mid on both sides, the basket's books added up, as each exchange's public book shows them":
    "中间价上下 0.1% 和 1% 内双边挂单的美元金额，资产篮子各订单簿相加，以各交易所公开订单簿所示为准",
  "Summed over the exchange's perpetual markets, as it reports them":
    "按交易所的永续合约市场汇总，以其公布的为准",
  "Live perpetual markets": "在线永续合约市场",

  // the help panel
  "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.":
    "本站采集的所有永续合约交易所，按在该交易所交易的成本排名。成本来自各交易所的公开订单簿，每十分钟读取一次，覆盖十二个主流币（BTC、ETH、SOL、XRP、DOGE、BNB、HYPE、SUI、ADA、LINK、AVAX、LTC）；每个数字都是最近七天的中位数。",
  "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.":
    "交易 $10k 的成本是一笔 $10k 市价单的全部成本：交易所公布的标准吃单手续费（VIP 等级、平台币抵扣和返佣会降低它），加上订单簿使该订单在中间价之外多付的部分，其中包括一半价差。滑点只是后一部分，分别按 $10k 和 $100k 计算。每个资产按其在所有交易所的持仓量计权，因此每家交易所都按相同的资产构成计价。",
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that, and the grade credits a market's depth up to a tenth of its open interest and an exchange's up to 2% of its daily volume: displayed size beyond that rarely fills.":
    "深度是中间价上下 0.1% 和 1% 内挂单的美元金额，以各交易所公开订单簿所示为准。交易所只公布有限的档位（Binance 的 BTC 订单簿只覆盖到约 0.15%），因此 1% 的数字只是下限，评级采用 0.1% 的数字，所有已测量的订单簿都能覆盖到这一范围。单一档位超过该市场持仓量 5% 的部分不计入；评级计入的深度，单个市场最多为其持仓量的十分之一，单家交易所最多为其日成交量的 2%：超出部分的挂单量很少真正成交。",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade is this site's: half execution (cost and $100k slippage against the cheapest), three tenths liquidity (credited depth within 0.1% against the deepest), a fifth activity (open interest, and volume up to five times it). S from 85, A from 70, B from 55, C from 40, D below.":
    "这些是订单簿给出的承诺，而不是实际成交：本站不测量任何成交，因此不显示 markout（成交后价格的走向）。评级由本站给出：执行占一半（成本和 $100k 滑点，与成本最低的交易所相比），流动性占十分之三（0.1% 内计入的深度，与最深的交易所相比），活跃度占五分之一（持仓量，以及最多为其五倍的成交量）。85 分起为 S，70 分起为 A，55 分起为 B，40 分起为 C，低于 40 分为 D。",

  // the page description and notes
  "Every perpetual futures exchange tracked by airrates, graded on what trading there costs: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "airrates 追踪的所有永续合约交易所，按交易成本评级：吃单手续费、$10k 与 $100k 的滑点、深度、持仓量和成交量。",
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "订单簿自 {date} 起测量；数字为最近七天的中位数。",
  "Order books are not measured yet.": "订单簿尚未测量。",
  "* No published taker fee found for {venues}: the site's default of {bps} bp is used.":
    "* 未找到 {venues} 公布的吃单手续费：采用本站默认的 {bps} 基点。",
  "Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.":
    "尚未评级：未读取订单簿的交易所。尚未采集：{venues}。",

  // one exchange's trading cost
  "not listed": "未上线",
  "$100k did not fill in most snapshots": "多数快照中 $100k 未能成交",
  "did not fill": "未能成交",
  "{pct}%": "{pct}%",
  "Trading cost": "交易成本",
  "{value} to trade $10k": "交易 $10k 成本 {value}",
  "taker fee {fee}{mark}": "吃单手续费 {fee}{mark}",
  "{value} slippage at $100k": "$100k 滑点 {value}",
  "{value} within 0.1%": "0.1% 内深度 {value}",
  "What a $10k market order pays beyond the mid, before fees":
    "$10k 市价单在中间价之外多付的部分，未计手续费",
  "$10k slippage": "$10k 滑点",
  "What a $100k market order pays beyond the mid, before fees":
    "$100k 市价单在中间价之外多付的部分，未计手续费",
  "$100k slippage": "$100k 滑点",
  "Depth ±0.1%": "深度 ±0.1%",
  "Depth ±1%": "深度 ±1%",
  "How far from the mid the published book reached": "公布的订单簿距中间价覆盖到多远",
  "Book reach": "订单簿覆盖范围",
  "Snapshots in the last seven days": "最近七天的快照数",
  Samples: "样本数",
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. How the grade is built: the Exchanges page.":
    "{venue} 公开订单簿最近七天快照（每十分钟一次）的中位数；成本来自订单簿，而非实际成交。评级的计算方法：见交易所页面。",
};
