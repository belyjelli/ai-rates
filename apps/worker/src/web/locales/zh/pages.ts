/**
 * Simplified Chinese for web/pages.ts (every page but the /status body, which stays English) and
 * web/venues.ts. Glossary and style: ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const pages: Catalog = {
  // shared helpers
  flat: "持平",
  crypto: "加密",
  equity: "股票",
  commodity: "商品",
  fx: "外汇",
  index: "指数",
  "{days} charging days in the last 30": "最近 30 天中有 {days} 天收取资金费",
  Asset: "资产",
  "7d settled": "7 日已结算",
  Stability: "稳定性",
  "Long on {venue}": "在 {venue} 做多",
  "Short on {venue}": "在 {venue} 做空",
  day: "1 天",
  "{n} days": "{n} 天",
  Any: "不限",

  // home: verified ranking and hero
  "No replay yet: the nightly run needs a week of settled funding on both legs of a pair.":
    "暂无回放：每晚的回放需要配对的两条腿都有一周的已结算资金费。",
  "Replayed, not forecast: {asset} long {long} / short {short} settled {net} on {size} a leg over 7 days. {apr} annualized, {win}% of days positive.":
    "回放而非预测：{asset} 在 {long} 做多 / 在 {short} 做空，每条腿 {size}，7 天内结算 {net}。年化 {apr}，{win}% 的天数为正收益。",
  "Open interest on the thinner of the two legs. A big figure earned on a shallow market is not a trade you can size into":
    "两条腿中较薄一侧的持仓量。在浅薄市场上赚到的大数字，并不是能放大仓位的交易",
  "The more extreme leg's funding, absolute. Rates past a few hundred percent usually mean a delisting or a distressed listing rather than carry":
    "费率更极端一侧的资金费率（绝对值）。超过几百个百分点的费率通常意味着下架或困境上市，而不是套利",
  "Funding both legs actually settled over the last 7 days, per $10,000 of notional on each leg":
    "最近 7 天两条腿实际结算的资金费，按每条腿 $10,000 名义价值计",
  Annualized: "年化",
  "Long leg": "多头腿",
  "Short leg": "空头腿",
  "Days the pair was net positive, as a share of days that settled at all":
    "配对净收益为正的天数，占有结算天数的比例",
  "Win rate": "胜率",
  "Thinner leg OI": "较薄腿持仓量",
  "Worst leg APR": "最差腿年化",
  "How often the weaker leg held its funding direction over 30 days":
    "30 天内较弱一腿保持资金费方向的频率",
  "Widest funding spread right now": "当前最大资金费率价差",
  "No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.":
    "最近五分钟没有交易所上报数据，因此无法配对。请一分钟后再查看。",
  "Funding spreads across perp exchanges": "各永续合约交易所的资金费率价差",
  "Live funding rate spreads between perpetual futures exchanges, refreshed every minute.":
    "永续合约交易所之间的实时资金费率价差，每分钟刷新。",
  "Widest spreads": "最大价差",
  "Open the screener": "打开筛选器",
  "No pairs yet: an asset needs live markets on at least two venues.":
    "暂无配对：资产需要在至少两家交易所有在线市场。",
  "What actually paid, last 7 days": "最近 7 天的实际收益",
  "replayed {date}": "回放于 {date}",
  "Not a forecast: both legs replayed at their own settlement times from stored funding, on $10,000 per leg. Ranked by what settled, with nothing filtered out — so check the thinner leg's depth and the worse leg's rate before reading a big number as a trade.":
    "这不是预测：两条腿按各自的结算时间、用存储的资金费数据回放，每条腿 $10,000。按已结算金额排名，未做任何过滤——因此在把大数字当作交易之前，请先查看较薄一腿的深度和较差一腿的费率。",
  "{asset} carry, long {long} / short {short}: {funding} of funding settled on {size} a leg over the last {span}. {net} after retail fees. Price risk hedged, not guessed.":
    "{asset} 套利，在 {long} 做多 / 在 {short} 做空：最近 {span}内每条腿 {size}，结算资金费 {funding}。扣除零售手续费后为 {net}。价格风险已对冲，而非靠猜。",
  "Best verified carry, last {span}": "最近 {span}经验证的最佳套利",
  "funding settled on {size} per leg": "每条腿 {size} 的已结算资金费",
  "after retail fees {value}": "扣除零售手续费后 {value}",
  "annualized {value} before fees": "费前年化 {value}",
  "win rate {value} of days": "按天计胜率 {value}",
  "thinner leg {value} open interest": "较薄腿持仓量 {value}",
  "stability {value}": "稳定性 {value}",
  "Open this backtest": "打开此回测",
  "Settled, not forecast: both legs replayed at their own settlement times. This is the best pair in the newest nightly run with at least {oi} of open interest on its thinner leg, neither leg past {apr}% a year, stability of {stability} or better and no missed settlements. Retail fees are {bps} bps on each of {fills} fills, opening and closing both legs. Last week's funding is not a promise about next week's.":
    "已结算而非预测：两条腿按各自的结算时间回放。这是最新一次夜间回放中满足以下条件的最佳配对：较薄一腿持仓量至少 {oi}，两条腿年化均不超过 {apr}%，稳定性不低于 {stability}，且没有漏掉的结算。零售手续费按 {fills} 笔成交、每笔 {bps} 个基点计算，涵盖两条腿的开仓和平仓。上周的资金费不代表下周的收益。",
  "Widest funding spread across perp exchanges right now: {asset} at {spread} a year. Long {long} at {longApr}, short {short} at {shortApr}.":
    "当前各永续合约交易所最大资金费率价差：{asset}，年化 {spread}。在 {long} 做多（{longApr}），在 {short} 做空（{shortApr}）。",
  "funding spread, per year": "资金费率价差（年化）",
  "{symbol} at {apr}": "{symbol}，费率 {apr}",
  "Holding equal size on both legs cancels the price exposure; the gap between the two funding rates is what the pair collects over a year, before trading fees and before either rate moves.":
    "两条腿持有相同规模即可抵消价格敞口；两个资金费率之间的差值，就是该配对一年能收取的收益——未计交易手续费，也未计任一费率的变动。",

  // screener
  "Funding spread screener": "资金费率价差筛选器",
  "Filter live cross-exchange funding spreads by open interest, volume and exchange type.":
    "按持仓量、成交量和交易所类型筛选实时跨交易所资金费率价差。",
  "For each asset, the cheapest market to hold long and the richest to hold short, on different exchanges. Each leg must pass the filters.":
    "对每个资产，在不同交易所中找出做多成本最低和做空收益最高的市场。每条腿都必须通过筛选条件。",
  "No pairs match these filters. Lower the minimum open interest or include more exchange types.":
    "没有符合这些筛选条件的配对。请降低最低持仓量，或纳入更多交易所类型。",
  "Min open interest, each leg": "每条腿最低持仓量",
  "Min 24h volume, each leg": "每条腿最低 24 小时成交量",
  "A USDT leg against a USDC leg carries the basis between the two stablecoins and needs collateral in both. Ticked, each asset is paired only within one quote currency":
    "USDT 腿对 USDC 腿会承担两种稳定币之间的基差，且两边都需要保证金。勾选后，每个资产只在同一计价货币内配对",
  "Same quote currency on both legs": "两条腿使用相同计价货币",
  "Delisting and distressed listings can pay beyond ±2000% APR and crowd out tradeable spreads":
    "下架和困境上市的合约年化可能超过 ±2000%，会挤掉可交易的价差",
  "Include beyond ±1000% APR": "包含年化超过 ±1000% 的市场",
  Rows: "行数",
  Spread: "价差",
  Venues: "交易所",
  "Neither leg has settled funding to score yet": "两条腿都还没有可供评分的已结算资金费",
  "The long leg has no settled funding to score yet": "多头腿还没有可供评分的已结算资金费",
  "The short leg has no settled funding to score yet": "空头腿还没有可供评分的已结算资金费",
  "Weaker leg held its direction on {days} of its charging days in the last 30":
    "最近 30 天内，较弱一腿在其收费日中有 {days} 天保持了方向",
  "This exchange does not say what the leg settles in, so it cannot be shown to match the other leg":
    "该交易所未说明这条腿以什么货币结算，因此无法确认它与另一条腿匹配",
  "Settles in {quote} while the other leg settles in {other}: the pair carries the basis between them":
    "以 {quote} 结算，而另一条腿以 {other} 结算：该配对承担两者之间的基差",
  "an undeclared currency": "未声明的货币",
  "quote ?": "计价 ?",
  OI: "持仓量",
  "{asset} pays {spread} a year to hold both sides: long {long} at {longApr}, short {short} at {shortApr}. Same coin, two exchanges, price exposure cancelled.":
    "同时持有 {asset} 两侧，每年可获 {spread}：在 {long} 做多（{longApr}），在 {short} 做空（{shortApr}）。同一币种，两家交易所，价格敞口相互抵消。",
  "Signed log scale, so ordinary rates keep room next to extreme ones":
    "带符号的对数刻度，让普通费率在极端费率旁边也有显示空间",
  "Long − short, log scale": "多头 − 空头，对数刻度",
  "Exchanges with a live market for this asset": "有该资产在线市场的交易所数",
  "How often the weaker leg held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "30 天内较弱一腿保持资金费方向的频率。0.50 相当于抛硬币；0.88 是整月能得到的最高分",

  // exchanges and one exchange
  Exchanges: "交易所",
  "No exchange has reported in the last five minutes.": "最近五分钟没有交易所上报数据。",
  Exchange: "交易所",
  Type: "类型",
  "Open interest": "持仓量",
  "24h volume": "24 小时成交量",
  Updated: "更新",
  "{venue}: {count} live perp markets, {oi} open interest. Richest funding {richest} at {richestApr} a year; cheapest {cheapest} at {cheapestApr}.":
    "{venue}：{count} 个在线永续合约市场，持仓量 {oi}。资金费率最高的是 {richest}，年化 {richestApr}；最低的是 {cheapest}，年化 {cheapestApr}。",
  "{venue} funding rates": "{venue} 资金费率",
  "Live funding rates, open interest and volume for every {venue} perpetual market.":
    "{venue} 所有永续合约市场的实时资金费率、持仓量和成交量。",
  "No live markets from {venue}: it isn't collected yet, or its last update is more than five minutes old.":
    "{venue} 没有在线市场：它尚未被采集，或最近一次更新已超过五分钟。",
  "{count} live markets": "{count} 个在线市场",
  "{value} open interest": "持仓量 {value}",
  "updated {value}": "{value}更新",
  Market: "市场",
  "Funding APR": "资金费率年化",
  "Rate, log scale": "费率，对数刻度",
  Interval: "结算周期",
  "Next funding": "下次结算",
  "Mark price": "标记价格",
  "Centralized exchange": "中心化交易所",
  "Onchain perp exchange": "链上永续合约交易所",
  "Hyperliquid HIP-3 dex": "Hyperliquid HIP-3 DEX",

  // rates
  now: "当前",
  asset: "资产",
  "open interest": "持仓量",
  spread: "价差",
  "{asset} funding runs from {low} on {lowVenue} to {high} on {highVenue}: {gap} a year apart across {count} exchanges.":
    "{asset} 的资金费率从 {lowVenue} 的 {low} 到 {highVenue} 的 {high}：在 {count} 家交易所之间年化相差 {gap}。",
  previous: "上一页",
  "assets {from}–{to}": "资产 {from}–{to}",
  next: "下一页",
  "No asset has live markets on two or more venues right now.":
    "目前没有资产在两家或以上交易所有在线市场。",
  Rates: "费率",
  "Funding APR for every asset across every perpetual exchange, in one grid.":
    "所有资产在所有永续合约交易所的资金费率年化，汇于一张表。",
  "Every exchange's funding for the deepest assets at once. Positive means longs pay, so a short collects; an empty cell means that exchange has no market for the asset, not that funding is flat.":
    "一次查看各交易所最有深度资产的资金费率。正值表示多头支付、空头收取；空单元格表示该交易所没有该资产的市场，而不是资金费率持平。",

  // price gaps
  "{asset}: buy on {buyVenue} at {buyPrice}, sell on {sellVenue} at {sellPrice}. A {gap} bps gap at the top of the book.":
    "{asset}：在 {buyVenue} 以 {buyPrice} 买入，在 {sellVenue} 以 {sellPrice} 卖出。盘口最优档价差 {gap} 个基点。",
  "Quotes seen {quoted}; the older leg's funding row fetched {fetched}":
    "报价获取于 {quoted}；较旧一腿的资金费数据获取于 {fetched}",
  "No asset quotes a gap this wide right now. The median comparable asset sits near 1.6 bps, so try a lower floor.":
    "目前没有资产报出这么大的价差。可比资产的中位数约为 1.6 个基点，请尝试更低的下限。",
  "Highest bid against lowest ask, across two different exchanges":
    "两家不同交易所之间的最高买价对最低卖价",
  "Gap, bps": "价差（基点）",
  "The sell price less the buy price, in the asset's own price units":
    "卖出价减去购入价，以该资产的价格单位计",
  Basis: "基差",
  "The smaller of the two resting sizes: what the gap is actually good for":
    "两侧挂单量中较小者：即这个价差实际能容纳的规模",
  "Good for": "利用量",
  "Buy price": "购入价",
  "Buy at": "买入于",
  "Ask size": "卖一挂单额",
  "Sell price": "卖出价",
  "Sell at": "卖出于",
  "Bid size": "买一挂单额",
  "Exchanges quoting this asset that survived the mark-agreement check":
    "报价该资产且通过标记价格一致性检查的交易所数",
  Quoted: "报价时间",
  "Price gaps across exchanges": "跨交易所价格差",
  "Where one exchange's bid sits above another's ask.": "一家交易所的买价高于另一家卖价的情形。",
  "Price gaps": "价格差",
  "For each asset, the cheapest exchange to buy and the dearest to sell, at the top of each book. These are <b>quotable gaps</b>, not fillable trades: nothing here reflects the book below level 1, the taker fees, or the two transfers a real position needs. The widest gaps sit on the thinnest books — when this was measured, 395 of 721 assets showed any gap at a median of 1.6 bps, while the leaders were good for as little as $3 of resting size.":
    "对每个资产，在各盘口最优档找出买入最便宜和卖出最贵的交易所。这些是<b>可报出的价差</b>，而不是可成交的交易：这里既没有反映一档以下的盘口和吃单手续费，也没有反映真实仓位所需的两次资金划转。最大的价差出现在最薄的盘口上——测量时，721 个资产中有 395 个出现价差，中位数为 1.6 个基点，而排名靠前的仅能容纳低至 $3 的挂单量。",
  Apply: "应用",
  "This venue's mark disagrees with the rest, so it is excluded from the gap":
    "该交易所的标记价格与其他交易所不一致，因此不计入价差",
  "Marked {ratio}× above this asset's deepest market, so it is a different instrument, not a price gap":
    "标记价格比该资产最深的市场高 {ratio}×，因此是不同的合约，而不是价格差",
  "Marked {ratio}× below this asset's deepest market, so it is a different instrument, not a price gap":
    "标记价格比该资产最深的市场低 {ratio}×，因此是不同的合约，而不是价格差",
  best: "最优",
  "This venue's own bid-ask spread, which a taker crosses on entry and again on exit":
    "该交易所自身的买卖价差，吃单者开仓和平仓时各跨越一次",
  "This venue's funding row has not been refreshed within the freshness window, so its mark is withheld rather than shown stale — the quote beside it is live":
    "该交易所的资金费数据未在有效期内刷新，因此不显示其标记价格，以免显示过期数据——旁边的报价是实时的",
  "Quote seen {quoted}; funding row fetched {fetched}":
    "报价获取于 {quoted}；资金费数据获取于 {fetched}",
  "Every pair": "所有配对",
  "One row per direction: buy at the first exchange, sell at the second. The widest gap is often not the one to take — a narrower pair can rest far more size behind it, and most directions lose outright.":
    "每个方向一行：在第一家交易所买入，在第二家卖出。最大的价差往往不是该做的那个——较窄的配对背后可能挂着多得多的量，而且大多数方向直接亏损。",
  "The smaller of the buying side's ask size and the selling side's bid size — what this direction is good for":
    "买方卖单量与卖方买单量中较小者——即这个方向能容纳的规模",
  "No two exchanges quote {asset} in a way that can be compared right now.":
    "目前没有两家交易所对 {asset} 的报价可以相互比较。",
  "Buying on {buy} and selling on {sell} quotes {gap}, though one side's resting size is unknown.":
    "在 {buy} 买入、在 {sell} 卖出，报价价差为 {gap}，但有一侧的挂单量未知。",
  "Buying on {buy} and selling on {sell} quotes {gap}, good for about {size}.":
    "在 {buy} 买入、在 {sell} 卖出，报价价差为 {gap}，约可容纳 {size}。",
  "That is a quote at the size shown, not a fillable trade: it is before fees, before the book below level 1, and before the transfer between two exchanges.":
    "这只是按所示规模的报价，而不是可成交的交易：未计手续费、未计一档以下的盘口，也未计两家交易所之间的资金划转。",
  Status: "状态",
  "{count} venue is shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "{count} 家交易所以灰色显示，不计入价差：{venues}。它们的标记价格与该资产按持仓量计最深的市场相差超过 10%，这意味着是规格或名称不同的合约，而不是价格差异——正是这项检查阻止了把 1375× 的不匹配当作 13,660,780 个基点的机会发布。每一家的原因请见{status}页。",
  "{count} venues are shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "{count} 家交易所以灰色显示，不计入价差：{venues}。它们的标记价格与该资产按持仓量计最深的市场相差超过 10%，这意味着是规格或名称不同的合约，而不是价格差异——正是这项检查阻止了把 1375× 的不匹配当作 13,660,780 个基点的机会发布。每一家的原因请见{status}页。",
  "{asset} price gaps by exchange": "{asset} 各交易所价格差",
  "{asset} best bid and ask on every exchange that quotes it, with the size resting at each.":
    "{asset} 在所有报价交易所的最优买价和卖价，以及各自的挂单量。",
  "Every exchange": "所有交易所",
  "Best bid": "最优买价",
  "Best ask": "最优卖价",
  "The venue's own bid-ask spread in basis points": "该交易所自身的买卖价差（基点）",
  "Own spread": "自身价差",
  Mark: "标记价格",
  "Sizes are the money resting at the very top of each book, converted to USD because the three venues that publish depth count it differently — Gate in contracts, OKX in contracts against <code>ctVal</code>, Bybit in base coin. Reading those raw, side by side, is a 10,000× error.":
    "规模指各盘口最优档上挂着的资金，统一换算成美元，因为公布深度的三家交易所计量方式不同——Gate 按合约张数，OKX 按合约张数乘以 <code>ctVal</code>，Bybit 按基础币。直接并排读取原始数字，会产生 10,000× 的误差。",

  // one asset
  "Best pair: long on {long} at {longApr}, short on {short} at {shortApr}, a {spread} spread per year.":
    "最佳配对：在 {long} 做多（{longApr}），在 {short} 做空（{shortApr}），年化价差 {spread}。",
  "Only markets with at least {minOi} open interest are paired.":
    "只有持仓量至少 {minOi} 的市场才参与配对。",
  "Funding only, before trading fees: none were entered.":
    "仅计资金费，未计交易手续费：未填写手续费。",
  "Only one exchange lists it right now, so there's no cross-exchange pair.":
    "目前只有一家交易所上线该资产，因此没有跨交易所配对。",
  "No two exchanges have at least {minOi} open interest in it, so there's no pair to show.":
    "没有两家交易所在该资产上的持仓量达到 {minOi}，因此没有可显示的配对。",
  "{asset} funding rates by exchange": "{asset} 各交易所资金费率",
  "{asset} perpetual funding rates across {count} exchanges, with the widest long/short spread.":
    "{asset} 在 {count} 家交易所的永续合约资金费率，以及最大的多空价差。",
  "Funding by exchange": "各交易所资金费率",
  "{markets} live markets on {venues} exchanges.": "{venues} 家交易所共 {markets} 个在线市场。",
  "{asset} funding across {count} exchanges: long {long} at {longApr}, short {short} at {shortApr}. A {spread} spread a year on one coin.":
    "{asset} 在 {count} 家交易所的资金费率：在 {long} 做多（{longApr}），在 {short} 做空（{shortApr}）。同一币种年化价差 {spread}。",
  "Backtest this pair": "回测此配对",
  "long {long} · short {short} · {spread} a year, replayed on settled funding":
    "做多 {long} · 做空 {short} · 年化 {spread}，基于已结算资金费回放",
  "24h settled": "24 小时已结算",
  "How often this market held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "30 天内该市场保持资金费方向的频率。0.50 相当于抛硬币；0.88 是整月能得到的最高分",
  "Last 7 charging days against the days before them, in APR points. Up means funding is widening in the direction it already had":
    "最近 7 个收费日与之前天数的对比，单位为年化百分点。向上表示资金费正沿原方向扩大",
  "30d trend": "30 日趋势",

  // pair backtest
  "capital {amount} — {venue} will not open a position above {max} on {symbol}":
    "资金 {amount} — {venue} 在 {symbol} 上不允许开超过 {max} 的仓位",
  "capital {amount} across both legs at {leverage}": "两条腿共需资金 {amount}，杠杆 {leverage}",
  "capital {amount} across both legs, unleveraged": "两条腿共需资金 {amount}，无杠杆",
  "capital at least {amount} across both legs — {leverage} is the small-size maximum":
    "两条腿共需资金至少 {amount}——{leverage} 是小仓位时的最高杠杆",
  "capital {amount} across both legs at {leverage} (small size)":
    "两条腿共需资金 {amount}，杠杆 {leverage}（小仓位）",
  "Cumulative funding reaches {amount} after {days} days": "{days} 天后累计资金费达到 {amount}",
  "Cumulative funding on {size} per leg · {from} to {to}":
    "每条腿 {size} 的累计资金费 · {from} 至 {to}",
  "Taker fee in basis points, per fill. Both legs must be filled in before costs are charged.":
    "每笔成交的吃单手续费（基点）。两条腿都填写后才会计入成本。",
  "blank = ignore": "留空 = 忽略",
  Window: "时间窗口",
  "Long on": "做多交易所",
  "Short on": "做空交易所",
  "Size per leg": "每条腿规模",
  "Long taker fee": "多头吃单费率",
  "Short taker fee": "空头吃单费率",
  "Run backtest": "运行回测",
  "swap legs": "交换两腿",
  "What entering and exiting would cost at each exchange's top of book":
    "在各交易所盘口最优档开仓和平仓的成本",
  "price gap": "价格差",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, before fees. Replayed from settled funding:":
    "{asset} 资金费率套利，在 {long} 做多 / 在 {short} 做空：最近 {span}内每条腿 {size}，收益 {net}（未计手续费）。基于已结算资金费回放：",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, after fees. Replayed from settled funding:":
    "{asset} 资金费率套利，在 {long} 做多 / 在 {short} 做空：最近 {span}内每条腿 {size}，收益 {net}（已扣手续费）。基于已结算资金费回放：",
  "Share on X": "分享到 X",
  "opens a post with this result and a link back to it": "打开一条附带此结果和回链的帖子",
  "after costs {net} on {fees} of fees": "扣除 {fees} 手续费后为 {net}",
  "never repays the fees at this rate": "按此费率永远无法收回手续费",
  "fees repay in {days}": "{days}即可收回手续费",
  "under a day": "不到 1 天",
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
  "best day {amount} {date}": "最佳单日 {amount}（{date}）",
  "worst day {amount} {date}": "最差单日 {amount}（{date}）",
  "The largest fall in cumulative funding from a previous high, before costs":
    "累计资金费从前期高点的最大回落，未计成本",
  "max drawdown {amount}": "最大回撤 {amount}",
  "{days}d avg {apr}": "{days} 日均值 {apr}",
  "now {apr}, {average}, every {interval}": "当前 {apr}，{average}，每 {interval} 结算",
  "now {apr}, every {interval}": "当前 {apr}，每 {interval} 结算",
  "net funding over the last {span} · {apr} annualized": "最近 {span}净资金费 · 年化 {apr}",
  "Long {venue}": "做多 {venue}",
  "{n} settlements": "{n} 次结算",
  "Short {venue}": "做空 {venue}",
  "win rate {value} of {days} days": "{days} 天中胜率 {value}",
  "average {value} a day": "日均 {value}",
  "Missed settlements: {long} on {longVenue}, {short} on {shortVenue}. A gap is reported rather than counted as zero, so this total covers only the settlements actually recorded.":
    "漏掉的结算：{longVenue} {long} 次，{shortVenue} {short} 次。缺口会如实报告而不按零计算，因此该总额只涵盖实际记录到的结算。",
  "Only {have} of the {asked} days asked for have stored settlements. The annualized figure still divides by the whole window, so it reads low. The daily rollup keeps 70 days, and history is still filling on some venues.":
    "所请求的 {asked} 天中只有 {have} 天有存储的结算。年化数字仍按整个时间窗口计算，因此会偏低。每日汇总保留 70 天，部分交易所的历史数据仍在补充中。",
  "Funding only, on a position kept at {size} per leg. Trading fees are excluded because none were given: taker fees depend on your own volume tier and discounts, so fill in both legs' fees above to see this net of costs. Price moves between settlements aren't modelled either, because venue funding history gives a rate and a time, and almost never a mark price.":
    "仅含资金费，仓位保持每条腿 {size}。由于未填写手续费，交易手续费未计入：吃单手续费取决于你自己的交易量等级和折扣，请在上方填写两条腿的手续费以查看扣除成本后的结果。结算之间的价格波动也未建模，因为交易所的资金费历史只给出费率和时间，几乎从不提供标记价格。",
  "Net of the fees you entered, on a position kept at {size} per leg: {long} bps long and {short} bps short, charged on four fills — entry and exit on both legs. Opening and closing once is assumed; rolling the position would cost this again each time. Price moves between settlements still aren't modelled, because venue funding history gives a rate and a time, and almost never a mark price.":
    "已扣除你填写的手续费，仓位保持每条腿 {size}：多头 {long} 个基点、空头 {short} 个基点，按四笔成交收取——两条腿各开仓、平仓一次。假设只开仓和平仓一次；每次展期都会再产生这笔成本。结算之间的价格波动仍未建模，因为交易所的资金费历史只给出费率和时间，几乎从不提供标记价格。",
  "Only one exchange lists {asset} right now, so there's no pair to hold.":
    "目前只有一家交易所上线 {asset}，因此没有可持有的配对。",
  "Pick two exchanges to hold against each other.": "选择两家交易所进行对冲持有。",
  "{asset} funding carry backtest": "{asset} 资金费率套利回测",
  "What holding {asset} long on one exchange and short on another would have paid in funding.":
    "在一家交易所做多、另一家做空 {asset}，本可获得多少资金费。",
  backtest: "回测",
  "{asset} carry": "{asset} 套利",
  "Every exchange's funding over one window, and what the two legs you pick actually settled, summed per UTC day. Windows are whole calendar days ending today, and the figures refresh hourly.":
    "一个时间窗口内各交易所的资金费率，以及你选择的两条腿实际结算的金额（按 UTC 日汇总）。时间窗口为截至今天的完整自然日，数据每小时刷新。",

  // errors
  "Too many requests": "请求过多",
  "Too many backtests from this address.": "该地址发起的回测过多。",
  "That is more backtests than one address may run in a minute. Wait a moment and try again. Results already computed are served from the cache and are never limited, so a combination someone has run before still loads immediately.":
    "这超出了单个地址每分钟可运行的回测次数。请稍等片刻再试。已计算过的结果由缓存提供，从不受限，因此别人运行过的组合仍会立即加载。",
  "Back to the screener": "返回筛选器",
  "Not found": "未找到",
  "Page not found.": "页面未找到。",
  "Nothing lives at {path}.": "{path} 没有任何内容。",
  "See today's widest spreads": "查看今日最大价差",
  "A runner sprinting": "一个正在冲刺的跑步者",
  "Data center busy": "数据中心繁忙",
  "The data center is too busy and a runner is on it. Try again later.":
    "数据中心太忙了，有人正在跑着处理。请稍后再试。",
  "The data center is getting too busy and is currently sprinting in circles":
    "数据中心忙不过来，正在原地兜圈狂奔",
  "Every server is screaming, the funding rates are on fire, and one intern is running the whole thing on foot. Go touch grass and try again later.":
    "每台服务器都在尖叫，资金费率在燃烧，只有一个实习生在徒步撑起整个系统。出去走走，稍后再试。",
  "Try again": "重试",
  // pages.ts invertedMark: an FX leg quoted the other way round (migration 041).
  "short this contract": "做空此合约",
  "long this contract": "做多此合约",
  "sell this contract": "卖出此合约",
  "buy this contract": "买入此合约",
  "{symbol} quotes this pair the other way round, so this side of the pair is the opposite side of that contract. Its price is shown inverted and its funding with the sign flipped, in the pair's terms.":
    "{symbol} 以相反方向报价这一货币对，因此货币对的这一侧就是该合约的反向。其价格已取倒数，资金费率已反转符号，均按货币对计算。",
  Now: "当前",
  "Payback, days": "回本天数",
  Long: "做多",
  Short: "做空",
  "7d {apr}": "7 日 {apr}",
  "Where to hold the long side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "在哪里持有多头：交易所及其当前资金费率；下方为合约、结算间隔、持仓量和 7 日资金费率",
  "Where to hold the short side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "在哪里持有空头：交易所及其当前资金费率；下方为合约、结算间隔、持仓量和 7 日资金费率",
  "Days of the {days}-day spread it takes to repay {bps} bps of fees: a taker fill in and out of both legs, at public retail rates":
    "按 {days} 日费率差，抵消 {bps} 个基点手续费所需的天数：双腿各吃单开仓、平仓一次，按公开零售费率",
  "No {days} days of settlements yet, so this is from the spread now: days to repay {bps} bps of fees, a taker fill in and out of both legs, at public retail rates":
    "尚无 {days} 天的结算，因此按当前费率差计算：抵消 {bps} 个基点手续费所需的天数，双腿各吃单开仓、平仓一次，按公开零售费率",
  "per {unit}": "每{unit}",
  "Days of funding it takes to repay the fees of opening and closing both legs, at public retail taker rates. From the {days}-day spread; dimmed where there is only the spread now":
    "按公开零售吃单费率，资金费收入抵消双腿开仓和平仓手续费所需的天数。按 {days} 日费率差计算；只有当前费率差时显示为暗色",
  "The funding spread now: short leg's rate minus long leg's":
    "当前资金费率差：空头腿费率减多头腿费率",
  "The same two markets' spread, averaged over the settlements of the last {days} days":
    "同样两个市场的费率差，按最近 {days} 天的结算取平均",
  "dollars, or 250k, 1.5m": "美元，或 250k、1.5m",
  "Delete preset": "删除预设",
  "No presets yet.": "还没有预设。",
  Presets: "预设",
  "Preset name": "预设名称",
  "Preset name…": "预设名称…",
  Save: "保存",
  "Clear all": "全部清除",
  "Select all": "全选",
  "{n} selected": "已选 {n}",
  Filters: "筛选",
  "Asset class": "资产类别",
  TradFi: "传统金融",
  "Spread now (APR %)": "当前费率差（年化 %）",
  "Both legs settle at this interval": "两条腿都按此间隔结算",
  "Funding interval": "资金费结算间隔",
  "No USDT leg against a USDC one": "不让 USDT 腿对 USDC 腿",
  "Distressed and delisting markets": "受困和下架中的市场",
  "Reset all": "全部重置",
  Steadiness: "稳定度",
  "Funding steadiness": "资金费稳定度",
  "How often a leg's funding kept its direction over the last 30 days: the dot beside each exchange in the Long and Short columns. The Stability column is the weaker leg's score.":
    "一条腿的资金费在过去 30 天里保持方向的频率：多头和空头列中每家交易所前的圆点。稳定性列是较弱一条腿的得分。",
  "Holds its direction almost every day. Income you can plan on.":
    "几乎每天都保持方向。可以计划的收入。",
  "Flips now and then. Usable for a carry, but size for the days it pays the other way.":
    "偶尔翻转。可以做套利，但仓位要考虑反向支付的日子。",
  "Flips often. Today's rate says little about next week's, and a backtest of it says less.":
    "经常翻转。今天的费率很难说明下周的情况，对它的回测更说明不了什么。",
  "Scored by direction, not by the coefficient of variation: that explodes whenever the average rate sits near zero. 0.50 is a coin flip; 0.88 is the most a full month can score.":
    "按方向评分，而不是变异系数：当平均费率接近零时，变异系数会急剧放大。0.50 相当于抛硬币；0.88 是整月所能得到的最高分。",
  "Search asset": "搜索资产",
  "Search asset…": "搜索资产…",
  Period: "周期",
  "Rate unit": "费率单位",
  Day: "日",
  "No settled funding to score yet": "尚无已结算的资金费可评分",
  "Funding held its direction on {days} of its charging days in the last 30: {band}":
    "过去 30 天中，资金费在 {days} 个收费日保持方向：{band}",
  erratic: "不稳定",
  mixed: "一般",
  steady: "稳定",
  Chart: "图表",
  "Running the backtest…": "正在运行回测…",
  "pick one": "请选择",
  "A price-convergence pair across two exchanges.": "两家交易所之间的价格收敛对。",
  "All quotes": "全部报价",
  Average: "平均",
  "Best bid / ask": "最优买价 / 卖价",
  "Bid-ask, both books": "买卖价差，两边订单簿",
  "Breakeven move {pct}": "保本所需变动 {pct}",
  "Dollars resting at the best bid and the best ask": "最优买价和最优卖价上挂单的美元金额",
  "Each hour's average mark on the two exchanges. Where a venue publishes no mark, its index stands in.":
    "两家交易所每小时的平均标记价格。交易所不公布标记价格时，以指数价格代替。",
  "Entry at the top of the book": "按订单簿最优价入场",
  "Every time in the window the spread rose to at least today's width, the hours until it next fell to the window's median. Hourly averages, so nothing shorter than an hour is seen, and the past is not a promise.":
    "窗口内每次价差升至不低于今日宽度时，到其下次回落至窗口中位数所用的小时数。基于小时平均值，因此看不到短于一小时的变化，过去也不代表未来。",
  "Exit target: the window's median spread, {median}. Full convergence to zero is rare, and waiting for it usually makes no sense.":
    "退出目标：窗口的中位价差 {median}。完全收敛到零很少见，等待它通常没有意义。",
  "Fees, four taker fills": "手续费，四次吃单成交",
  "From {n} comparable episodes in the last {window}; {open} had not closed by the end.":
    "基于最近 {window} 内 {n} 次可比情形；其中 {open} 次到窗口结束仍未收敛。",
  "Funding, est. {hold} hold": "资金费，预计持有 {hold}",
  Gross: "毛利",
  "Hold time, from history": "持有时间（据历史）",
  "Hover the chart to read every line at one hour.": "将鼠标悬停在图表上，可读取某一小时的每条线。",
  "If the spread closes from where it is now to each target. Fees are four taker fills, in and out of both legs. The books are each exchange's own bid-ask, crossed half on the way in and half on the way out, at the top of the book only. Funding is the short leg's rate less the long leg's over the hold, which can pay or cost.":
    "若价差从当前水平收敛到各目标。手续费为四次吃单成交，两条腿各进出一次。订单簿成本为各交易所自身的买卖价差，入场和出场各穿越一半，仅按最优价计算。资金费为持有期间空头腿费率减多头腿费率，可能是收入也可能是成本。",
  "If the spread closes to": "若价差收敛至",
  "Long leg · {venue}": "多头腿 · {venue}",
  "Long the exchange where the asset is cheaper, short the one where it is dearer, and close when the two prices meet. Price moves cancel between the legs; what is left is the gap closing, less fees, the books and funding. Marks are the exchanges' own fair prices, not fills, and the history is hourly averages.":
    "在价格较低的交易所做多，在价格较高的交易所做空，两边价格靠拢时平仓。两条腿的价格变动相互抵消，剩下的是价差收敛，扣除手续费、订单簿成本和资金费。标记价格是各交易所自己的公允价格，不是成交价，历史数据为小时平均值。",
  "Mark prices, hourly": "标记价格，按小时",
  Median: "中位数",
  "Not verified for this exchange: the site's retail assumption of {bps} bps":
    "此交易所未核实：采用本站零售假设 {bps} 个基点",
  "Off the market median": "偏离市场中位数",
  "One leg was listed recently or reported unevenly. The spread now is more trustworthy than the window's statistics.":
    "一条腿上市不久或报价不连续。当前价差比窗口统计更可信。",
  "Over the window's hours in which both legs reported a price, from each hour's average mark.":
    "基于窗口内两条腿都有报价的小时，按每小时平均标记价格计算。",
  "Own bid-ask": "自身买卖价差",
  "Price history is unavailable right now. The live figures below are unaffected.":
    "价格历史暂时无法获取。下方实时数据不受影响。",
  "Price spread, hourly": "价格价差，按小时",
  "Profit calculator": "利润计算器",
  Range: "区间",
  "Seen {age}": "更新于 {age}",
  "Short leg · {venue}": "空头腿 · {venue}",
  "Sparse history ({share}% of expected samples): statistics may be unreliable.":
    "历史数据稀疏（预期样本的 {share}%）：统计可能不可靠。",
  "Spread now (mark)": "当前价差（标记价格）",
  "Spread statistics": "价差统计",
  "Std dev": "标准差",
  "Swap legs": "交换两条腿",
  "Taker fee": "吃单手续费",
  "The exchange's published standard taker fee": "交易所公布的标准吃单手续费",
  "The price gap between {long} and {short} for {asset}: now, after costs, and over its history.":
    "{asset} 在 {long} 与 {short} 之间的价差：当前、扣除成本后以及历史表现。",
  "The short leg is not the dearer one right now, so there is no gap to close in this direction.":
    "目前空头腿并非价格较高的一方，因此这个方向没有可收敛的价差。",
  "The short leg's hourly mark less the long leg's, as a share of the long leg's. The dashed lines are the spread now and the window's median.":
    "空头腿每小时标记价格减多头腿，占多头腿的比例。虚线为当前价差和窗口中位数。",
  "The short leg's mark less the long leg's, as a share of the long leg's. Marks are each exchange's fair price, not a price anyone traded at; the entry below is what the books offer.":
    "空头腿标记价格减多头腿，占多头腿的比例。标记价格是各交易所的公允价格，并非实际成交价；下方入场价才是订单簿实际提供的价格。",
  "The spread is already at or below its median for the window ({median}): nothing to wait for.":
    "价差已处于或低于窗口中位数（{median}）：无需等待。",
  "This leg's mark against the median mark of every exchange quoting the asset":
    "该腿标记价格相对所有报价交易所标记价格中位数的偏离",
  "This pair: long {long}, short {short}": "此配对：做多 {long}，做空 {short}",
  Ticker: "交易代码",
  "Too few comparable episodes in the last {window} to estimate how long this takes. Try a longer window.":
    "最近 {window} 内可比情形太少，无法估算所需时间。请尝试更长的窗口。",
  "Top of book": "最优价挂单",
  "Trade long · {venue}": "做多 · {venue}",
  "Trade short · {venue}": "做空 · {venue}",
  "Window {window} · {n} hours of {expected}": "窗口 {window} · {expected} 小时中有 {n} 小时",
  "buying {venue}'s ask, selling {other}'s bid": "买入 {venue} 的卖价，卖出 {other} 的买价",
  details: "详情",
  "full convergence pays {times}× the round trip": "完全收敛可覆盖往返成本的 {times} 倍",
  "long {long} · short {short}": "多头 {long} · 空头 {short}",
  "long {long} · short {short}, good for {size}; deeper fills cost more and are not shown":
    "多头 {long} · 空头 {short}，可成交约 {size}；更深的成交成本更高，此处未显示",
  "market median {price} · long {long} · short {short}":
    "市场中位数 {price} · 多头 {long} · 空头 {short}",
  median: "中位数",
  pair: "配对",
  "seen {long} / {short}": "更新于 {long} / {short}",
  "sized at {size} a leg": "每条腿 {size}",
  "the book is thinner than this size": "订单簿深度小于此规模",
  "thin book: only {size} rests at those prices": "订单簿较薄：这些价格上仅挂有 {size}",
  "typical time to close (middle half {from} to {to})":
    "通常收敛所需时间（中间一半为 {from} 至 {to}）",
  "wider than {share}% of the last {window}'s hours": "宽于最近 {window} 中 {share}% 的小时",
  "{asset} convergence trade": "{asset} 收敛交易",
  "{asset} convergence trade: long {long}, short {short}":
    "{asset} 收敛交易：做多 {long}，做空 {short}",
  "{asset} · convergence trade": "{asset} · 收敛交易",
  "{long} bps on the long leg and {short} bps on the short, in and out":
    "多头腿 {long} 个基点，空头腿 {short} 个基点，进出各一次",
  "{n}th percentile": "第 {n} 百分位",
  "{venues} has no comparable {asset} book right now. Pick another exchange above.":
    "{venues} 目前没有可比的 {asset} 订单簿。请在上方选择其他交易所。",
  "~1h": "约 1 小时",
  "~{n} days": "约 {n} 天",
  "~{n}h": "约 {n} 小时",
  "Price gap (bps)": "价差（基点）",
  "Min resting size, thinner side": "最小挂单规模，较薄一侧",
  "A HIP-3 market: listed by a third-party deployer and settled on Hyperliquid":
    "HIP-3 市场：由第三方部署方上线，在 Hyperliquid 上结算",
  "A HIP-3 market: listed by a third-party deployer and settled on Hyperliquid, with its own book and its own risks.":
    "HIP-3 市场：由第三方部署方上线，在 Hyperliquid 上结算，有自己的订单簿和自身风险。",
  "A row offers a trade only with a LONG and a SHORT leg. Everything else is context.":
    "一行只有同时有做多和做空两条腿时才构成交易。其余都是背景信息。",
  Badges: "标签",
  LONG: "做多",
  "Left out of the gap: its price disagrees with the asset's deepest market by more than a real arbitrage ever does, so it is a different instrument. Hover it for how far out.":
    "不计入价差：其价格与该资产最深市场的偏离超过任何真实套利，因此是另一种合约。悬停可查看偏离多少。",
  "NO LIQ": "无流动性",
  "OFF-SYNC": "不同步",
  OUTLIER: "异常",
  "Quoted more than a minute before the price it is compared with. Pairing the two would read the asset's own move in the meantime as a gap.":
    "报价比所比较的价格早一分钟以上。把两者配对，会把资产在这段时间内自身的变动误读为价差。",
  "Quoted {seconds}s before the price it is compared with": "比所比较的价格早 {seconds} 秒报价",
  SHORT: "做空",
  "The cheapest venue: the leg you buy.": "价格最低的交易所：你买入的一腿。",
  "The dearest venue: the leg you sell.": "价格最高的交易所：你卖出的一腿。",
  "Under {volume} traded in 24 hours: a price with almost no trading behind it, which you may not be able to fill.":
    "24 小时成交不足 {volume}：几乎没有交易支撑的价格，可能无法成交。",
  "VIA HL": "经 HL",
  "What the badges mean": "标签含义",
  "{volume} traded in 24 hours: a price with almost no trading behind it":
    "24 小时成交 {volume}：几乎没有交易支撑的价格",
  "Quarantined on {date}: {evidence}. Its numbers are still collected and shown here, but it is left out of the default Screener and Arbitrage rankings until the venue review clears it.":
    "已于 {date} 隔离：{evidence}。其数据仍在采集并显示于此，但在交易所审查解除隔离之前，不计入资金费率筛选器与套利的默认排名。",
  quarantined: "已隔离",
  "Quarantined exchanges are left out unless you tick them: their numbers are still collected, but not trusted to rank.":
    "已隔离的交易所默认不计入，勾选后才会纳入：其数据仍在采集，但不足以信任用于排名。",
  "Default exchanges": "默认交易所",
};
