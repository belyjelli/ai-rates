import type { Catalog } from "../../i18n";

/**
 * The Exchanges page (web/exchanges.ts) and one exchange's trading-cost section on its own page.
 * Glossary and style: ./index.ts.
 *
 * Terms: grade 评级 (the letters S/A/B/C/D stay as written), score 得分, execution 执行, liquidity
 * 流动性, activity 活跃度, order book / book 订单簿, mid 中间价, market order 市价单, depth 深度,
 * credited 计入, basket 资产篮子, majors 主流币, snapshot 快照, median 中位数, fill 成交, book reach
 * 订单簿覆盖范围, taker fee 吃单手续费, bp 基点, reserves 储备金, wallets 钱包, own token 自身代币,
 * clean (without the exchange's own token) 净 / clean reserves 净储备金, collateral 抵押资产 (protocol
 * collateral 协议抵押资产), pillar 支柱, breadth 广度, points 分 ("30 points" 30 分), n/a 无数据,
 * breakdown 分项明细, the leader 第一名, REAL score REAL 得分, CEX/DEX ranking "#{rank} of {of} CEXs"
 * {of} 家 CEX 中第 {rank} 名. Sizes ($10k, $100k) and bands (±0.1%, ±1%) are left exactly as
 * written; markouts stays in Latin letters, as desks write it; CEX, DEX and DefiLlama too.
 */
export const exchanges: Catalog = {
  // the grade badge and the table
  "Grade {grade}, score {score}: the breakdown": "评级 {grade}，得分 {score}：分项明细",
  "clean, of {total} in wallets": "净储备，钱包共 {total}",
  collateral: "抵押资产",
  "fee {fee}{mark}": "手续费 {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "$100k 订单在资产篮子的 {n} 个订单簿上多数时候未能成交；每个按 {bps} 基点计",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, 2% of the exchange's daily volume or 5% of its clean reserves is not counted":
    "评级只计入其中的 {usd}：超出市场持仓量十分之一、交易所日成交量 2% 或其净储备金 5% 的深度不计入",
  "{n} of {total} assets": "{total} 个资产中的 {n} 个",
  "Not measured: its order book is not read yet": "未测量：尚未读取其订单簿",

  // the grade's breakdown card
  Reserves: "储备金",
  Execution: "执行",
  Activity: "活跃度",
  Liquidity: "流动性",
  "not measured": "未测量",
  "no wallets published": "未公布钱包",
  "collateral not identified: the DEXes' median": "未识别出抵押资产：取 DEX 的中位数",
  "{clean} clean of {total} in tracked wallets": "追踪钱包中共 {total}，其中净储备 {clean}",
  "{usd} protocol collateral": "协议抵押资产 {usd}",
  "{cost} to trade $10k, {slip} slippage at $100k": "交易 $10k 成本 {cost}，$100k 滑点 {slip}",
  "{oi} open interest, {volume} volume": "持仓量 {oi}，成交量 {volume}",
  "{usd} credited within 0.1%; {n} of {total} markets hold $100k":
    "0.1% 内计入深度 {usd}；{total} 个市场中有 {n} 个深度达 $100k",
  "#{rank} of {of} CEXs": "{of} 家 CEX 中第 {rank} 名",
  "#{rank} of {of} DEXs": "{of} 家 DEX 中第 {rank} 名",
  "n/a": "无数据",
  "Built from this site's own reading of the order books and DefiLlama's reserves. n/a never counts as zero; its weight goes to the others. S from 85, A 70, B 55, C 40, else D.":
    "依据本站自行读取的订单簿和 DefiLlama 的储备金数据计算。“无数据”从不按零计，其权重分给其余各项。85 分起为 S，70 分起为 A，55 分起为 B，40 分起为 C，其余为 D。",
  "How the grade is built": "评级的计算方法",

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
  "This site's grade after DefiLlama's REAL score: reserves, execution, activity and liquidity. A grade opens its breakdown":
    "本站参照 DefiLlama 的 REAL 得分给出的评级：储备金、执行、活跃度和流动性。点击评级可查看分项明细",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain without its own token, a DEX's protocol collateral":
    "交易所持有的资产，数据来自 DefiLlama：CEX 为链上追踪到的钱包（不含其自身代币），DEX 为协议抵押资产",
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
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that.":
    "深度是中间价上下 0.1% 和 1% 内挂单的美元金额，以各交易所公开订单簿所示为准。交易所只公布有限的档位（Binance 的 BTC 订单簿只覆盖到约 0.15%），因此 1% 的数字只是下限，评级采用 0.1% 的数字，所有已测量的订单簿都能覆盖到这一范围。单一档位超过该市场持仓量 5% 的部分不计入。",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade follows DefiLlama's REAL score: reserves 30, execution 30, activity 20, liquidity 20. A grade opens its breakdown; how each pillar is built is under the table.":
    "这些是订单簿给出的承诺，而不是实际成交：本站不测量任何成交，因此不显示 markout（成交后价格的走向）。评级参照 DefiLlama 的 REAL 得分：储备金 30、执行 30、活跃度 20、流动性 20。点击评级可查看分项明细；各支柱的计算方法见表格下方。",

  // how the grade is built
  "{n} points": "{n} 分",
  "After DefiLlama's REAL score: a weighted mean of four pillars, each 0 to 100. Sizes are on a log scale, so an exchange a tenth the size of the leader still scores about 70. A pillar this site cannot measure for an exchange hands its weight to the others and never counts as zero. CEXes and DEXes are scored together and ranked within their own kind. Fixed bands, so a new exchange does not reshuffle the rest: S from 85, A from 70, B from 55, C from 40, D below.":
    "参照 DefiLlama 的 REAL 得分：四个支柱的加权平均，每个支柱 0 到 100 分。规模按对数刻度计算，因此规模只有第一名十分之一的交易所仍能得到约 70 分。本站无法为某家交易所测量的支柱，会把权重让给其余支柱，而不会按零计。CEX 与 DEX 一同评分，并在各自类别内排名。分档固定，新交易所加入不会打乱其他交易所的评级：85 分起为 S，70 分起为 A，55 分起为 B，40 分起为 C，低于 40 分为 D。",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain, without its own token; a DEX's protocol collateral, a floor, since market makers' money can sit elsewhere. Two thirds is size against the largest; one third is whether its open interest, a day's volume and the book it shows within 1% are sizes it could back, and how much of it is its own token. A CEX publishing no wallets scores 0; a DEX whose collateral is not identified scores the DEXes' median.":
    "交易所持有的资产，数据来自 DefiLlama：CEX 为链上追踪到的钱包，不含其自身代币；DEX 为协议抵押资产，这只是下限，因为做市商的资金可能放在别处。三分之二看规模，与最大的交易所相比；三分之一看其持仓量、一天的成交量和 1% 内显示的订单簿是否在其储备能够支撑的规模之内，以及储备中有多少是其自身代币。未公布钱包的 CEX 得 0 分；未识别出抵押资产的 DEX 取 DEX 的中位数。",
  "What a market order costs, from each exchange's book every ten minutes over seven days: $10k all in (the published standard taker fee and the walk through the book), and what $10k and $100k pay beyond the mid, each against the cheapest exchange. DefiLlama also scores markouts and fills against the quote; those need trades, which this site does not record, so their weight goes to cost and slippage.":
    "一笔市价单的成本，来自七天内每十分钟读取一次的各交易所订单簿：$10k 的全部成本（公布的标准吃单手续费，加上沿订单簿逐档成交的成本），以及 $10k 和 $100k 在中间价之外多付的部分，均与成本最低的交易所相比。DefiLlama 还会对 markout 以及成交价相对报价的表现评分；这些需要成交数据，而本站不记录成交，因此它们的权重归入成本和滑点。",
  "Open interest, credited up to three times clean reserves, and a day's volume, credited up to five times open interest, each against the leader.":
    "持仓量，最多计入净储备金的三倍；一天的成交量，最多计入持仓量的五倍；两者均与第一名相比。",
  "Depth within 0.1% of the mid across the twelve majors, credited up to a tenth of each market's open interest, 2% of the exchange's daily volume and 5% of its clean reserves; and breadth, how many of the twelve hold $100k within 0.1%. Halved for a CEX publishing no reserves.":
    "十二个主流币在中间价 0.1% 内的深度，计入上限为各市场持仓量的十分之一、交易所日成交量的 2% 和其净储备金的 5%；以及广度，即十二个主流币中有多少个在 0.1% 内深度达 $100k。未公布储备金的 CEX 此项减半。",
  "These are this site's grades by DefiLlama's method, not DefiLlama's scores. What exchanges report about themselves counts only as far as it can be checked: open interest up to three times reserves, volume up to five times open interest. Reputation, age, brand and listings count not at all.":
    "这些是本站按 DefiLlama 的方法给出的评级，而非 DefiLlama 自己的得分。交易所自行公布的数据只在可核实的范围内计入：持仓量最多计入储备金的三倍，成交量最多计入持仓量的五倍。声誉、成立年限、品牌和上币数量完全不计。",

  // the page description and notes
  "Every perpetual futures exchange tracked by airrates, graded on reserves, trading cost, activity and liquidity: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "airrates 追踪的所有永续合约交易所，按储备金、交易成本、活跃度和流动性评级：吃单手续费、$10k 与 $100k 的滑点、深度、持仓量和成交量。",
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "订单簿自 {date} 起测量；数字为最近七天的中位数。",
  "Order books are not measured yet.": "订单簿尚未测量。",
  "Reserves: DefiLlama, read every six hours.": "储备金：来自 DefiLlama，每六小时读取一次。",
  "Reserves are not available right now; the grade goes on without them.":
    "暂无储备金数据；评级在不含储备金的情况下照常计算。",
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
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. Reserves are DefiLlama's.":
    "{venue} 公开订单簿最近七天快照（每十分钟一次）的中位数；成本来自订单簿，而非实际成交。储备金数据来自 DefiLlama。",
};
