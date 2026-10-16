import type { Catalog } from "../../i18n";

/**
 * The Rates page's Gamma Exposure tab (web/gamma.ts), its chart readout (web/slot-chart.ts) and the
 * page's two tab labels. Glossary and style: ./index.ts.
 *
 * Terms: gamma exposure Gamma 敞口 (GEX left as written), option 期权, call 看涨期权 (calls 看涨),
 * put 看跌期权 (puts 看跌), strike 行权价, expiry 到期日, spot 现货价, dealer 做市商, flip 翻转点,
 * call wall / put wall 看涨墙 / 看跌墙, hedging 对冲. Greek names and Black-76 stay in Latin letters,
 * as Chinese exchanges and option desks write them.
 */
export const gamma: Catalog = {
  "Funding rates": "资金费率",
  Funding: "资金费率",
  "Gamma Exposure": "Gamma 敞口",
  Gamma: "Gamma",
  "Next: {date}": "最近：{date}",
  "Next expiry": "最近到期",
  "7 days": "7 天内",
  "30 days": "30 天内",
  "All expiries": "全部到期日",
  "Option book": "期权簿",
  Expiries: "到期日",
  "spot {price}": "现货价 {price}",
  "net {net} per 1% move at spot {spot} · {bars} · hover or tap a strike to read it":
    "现货价 {spot} 处每 1% 波动净敞口 {net} · {bars} · 悬停或点按行权价查看",
  "bars are each strike's calls and puts": "柱为各行权价的看涨与看跌",
  "bars are each strike's calls and puts added": "柱为各行权价看涨与看跌之和",
  "Net long": "净多",
  "Net short": "净空",
  "short gamma": "负 Gamma 区",
  "long gamma": "正 Gamma 区",
  View: "视图",
  view: "视图",
  "calls/puts": "看涨/看跌",
  "Each strike's calls above zero and its puts below": "各行权价的看涨在零线上方，看跌在下方",
  net: "净值",
  "One bar per strike: its calls and puts added": "每个行权价一根柱：看涨与看跌相加",
  zones: "区间",
  "Net bars, with the prices shaded where dealers would be short gamma or long it":
    "净值柱，并为做市商处于负 Gamma 或正 Gamma 的价格区间着色",
  "The view switch beside the cursor draws the bars three ways: calls/puts, each strike's calls above zero and its puts below; net, the two added into one bar; and zones, the net bars with the prices shaded where the line is below zero (dealers short gamma, red) or above it (long gamma, blue).":
    "光标旁的视图切换以三种方式绘制柱：看涨/看跌，各行权价的看涨在零线上方、看跌在下方；净值，两者相加为一根柱；区间，净值柱，并为曲线低于零（做市商负 Gamma，红色）或高于零（正 Gamma，蓝色）的价格区间着色。",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of exposure, either sign.":
    "距现货价 ±{pct} 以外的行权价不在图内：敞口 {usd}，正负合计。",
  "flip {price}": "翻转点 {price}",
  "{currency} · {source} options · gamma exposure by strike · {scope}":
    "{currency} · {source} 期权 · 按行权价的 Gamma 敞口 · {scope}",
  Calls: "看涨",
  Puts: "看跌",
  "Net if the spot moved there": "现货价移至该处时的净敞口",
  Spot: "现货价",
  "{currency} strike bands; arrow keys read one at a time": "{currency} 行权价区间；方向键逐个查看",
  "{currency} options gamma exposure by strike": "{currency} 期权按行权价的 Gamma 敞口",
  "net gamma keeps one sign within ±30% of the spot": "现货价 ±30% 内净 Gamma 不变号",
  "{pct} from spot; net gamma changes sign here": "距现货价 {pct}；净 Gamma 在此变号",
  "Net gamma exposure": "净 Gamma 敞口",
  "per 1% move · dealers long gamma: their hedging damps moves":
    "每 1% 波动 · 做市商持有正 Gamma：其对冲会抑制波动",
  "per 1% move · dealers short gamma: their hedging adds to moves":
    "每 1% 波动 · 做市商持有负 Gamma：其对冲会放大波动",
  "Gamma flip": "Gamma 翻转点",
  "Call wall / put wall": "看涨墙 / 看跌墙",
  "the strikes holding the most call and put gamma": "看涨与看跌 Gamma 最集中的行权价",
  "calls / puts at the spot · put/call {ratio} · {options} options, {expiries} expiries":
    "按现货价计的看涨 / 看跌 · 看跌/看涨比 {ratio} · {options} 个期权，{expiries} 个到期日",
  "calls / puts at the spot · put/call {ratio} · {options} options, one expiry":
    "按现货价计的看涨 / 看跌 · 看跌/看涨比 {ratio} · {options} 个期权，1 个到期日",
  "By expiry": "按到期日",
  Expiry: "到期日",
  Left: "剩余",
  Options: "期权数",
  "Call OI ({unit})": "看涨持仓量（{unit}）",
  "Put OI ({unit})": "看跌持仓量（{unit}）",
  Net: "净额",
  "Of the chain's exposure, either sign counted": "占全部敞口的比例，正负均计",
  Share: "占比",
  "Exposure in dollars per 1% move. Expiries outside the chosen range are dimmed. Every Deribit option expires at 08:00 UTC; one in its last hour is left out.":
    "敞口以每 1% 波动的美元计。所选范围外的到期日显示为灰色。Deribit 期权均在 08:00 UTC 到期；最后一小时内的期权不计入。",
  "Gamma exposure is how much of the underlying the holders of its options would have to buy or sell to stay hedged for a 1% move in price: each option's gamma times its open interest, per 1% move in the currency the contract pays, added up by strike.":
    "Gamma 敞口是价格每波动 1% 时，期权持有方为保持对冲需要买入或卖出的标的数量：每个期权的 Gamma 乘以其持仓量，以合约结算货币计的每 1% 波动金额，按行权价加总。",
  "Calls count positive and puts negative. That is the standard reading, and an assumption: it takes dealers to be long the calls customers sold them and short the puts customers bought. No exchange publishes who holds which side, so every signed figure here rests on it; where open interest and gamma sit does not.":
    "看涨计为正，看跌计为负。这是通行的读法，也是一个假设：它认为做市商持有客户卖给他们的看涨期权，并卖出了客户买入的看跌期权。没有交易所公布哪一方持有哪一边，因此这里所有带正负号的数字都基于这一假设；持仓量和 Gamma 所在的位置则不受影响。",
  "Positive net exposure means dealers sell into rises and buy into falls, which tends to damp moves; negative means they chase the price, which tends to add to them. The flip is where the net would change sign were the spot to move there, and the line shows the net at every such price. The walls are the strikes holding the most call and put gamma.":
    "净敞口为正时，做市商在上涨时卖出、下跌时买入，往往会抑制波动；为负时，他们追随价格，往往会放大波动。翻转点是现货价移至该处时净敞口变号的位置，曲线显示每个这样的价格下的净敞口。看涨墙和看跌墙是看涨与看跌 Gamma 最集中的行权价。",
  "Crypto: Deribit's BTC and ETH books, which hold most listed crypto options; Bybit, OKX and Binance list far fewer and are not included. Open interest, mark volatility and each expiry's forward are Deribit's own; gamma is computed from them with Black-76, which reproduces Deribit's own delta and vega. Read every five minutes.":
    "加密货币：Deribit 的 BTC 和 ETH 期权簿，它们占上市加密期权的大部分；Bybit、OKX 和 Binance 的期权少得多，未计入。持仓量、标记波动率和各到期日的远期价格均为 Deribit 自己的数据；Gamma 由此按 Black-76 计算，可复现 Deribit 自己的 Delta 和 Vega。每五分钟读取一次。",
  "United States: Cboe's 15-minute delayed chains for the S&amp;P 500, Nasdaq-100 and Russell 2000 indexes and the most traded ETFs and stocks, with Cboe's own volatility and open interest, the spot taken as the forward. Read every 15 minutes through the US session; outside it the figures are the last session's.":
    "美国：Cboe 延迟 15 分钟的期权链，涵盖标普 500、纳斯达克 100 和罗素 2000 指数以及交易最活跃的 ETF 和个股，波动率和持仓量为 Cboe 自己的数据，以现货价作为远期价格。美股交易时段内每 15 分钟读取一次；时段外显示上一交易时段的数字。",
  "Asia and Europe: each exchange's end-of-day file, read once after it is published -- HKEX (Hang Seng indexes), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), NSE and BSE (Nifty, Sensex) and Eurex (Euro Stoxx 50, DAX, SMI). They publish settlement prices and open interest but no volatility, so each strike's is backed out of its out-of-the-money settlement with Black-76, against the forward that put-call parity or the exchange's own future gives. Their figures are in the currency the contract pays, and as of that day's close.":
    "亚洲和欧洲：各交易所的日终文件，发布后读取一次 —— 港交所（恒生系列指数）、中金所（沪深 300、上证 50、中证 1000）、台湾期交所（台湾加权指数）、NSE 和 BSE（Nifty、Sensex）以及 Eurex（欧洲斯托克 50、DAX、SMI）。它们公布结算价和持仓量，但不公布波动率，因此各行权价的波动率由其价外结算价按 Black-76 反推，远期价格取自看涨看跌平价或交易所自己的期货。这些数字以合约结算货币计，截至当日收盘。",
  "The options data could not be read right now.": "暂时无法读取期权数据。",
  "No gamma exposure has been computed for {currency} yet.": "{currency} 尚未计算 Gamma 敞口。",
  "{source}'s {currency} options were last read {ago}, too long ago to show as current positioning.":
    "{source} 的 {currency} 期权最近一次读取于{ago}，时间过久，不能作为当前持仓显示。",
  "Not updated since {ago}: the latest read of {source} failed, so these figures are that old.":
    "自{ago}起未更新：最近一次读取 {source} 失败，以下数字停留在那时。",
  "Not updated since {ago}: nothing newer has been read from {source}, a holiday or a failed read, so these figures are that old.":
    "自{ago}起未更新：未从 {source} 读到更新的数据（休市或读取失败），以下数字停留在那时。",
  "No expiry in this range": "此范围内无到期日",
  "No {currency} option expires in this range; the nearest expires {date}.":
    "此范围内没有 {currency} 期权到期；最近的到期日为 {date}。",
  "No strike has open interest in this range.": "此范围内没有行权价有持仓量。",
  "Calls positive, puts negative: dealers assumed long calls and short puts, since no exchange publishes who holds which side. {source} options, {asof}.":
    "看涨为正，看跌为负：假设做市商持有看涨、卖出看跌，因为没有交易所公布哪一方持有哪一边。{source} 期权，{asof}。",
  "read {ago}": "读取于{ago}",
  "15-minute delayed, read {ago}": "延迟 15 分钟，读取于{ago}",
  "from the end-of-day file for {date}": "取自 {date} 的日终文件",
  expired: "已到期",
  "Call OI": "看涨持仓",
  "Put OI": "看跌持仓",
  "Exposure in {unit} per 1% move; open interest at its value at the spot. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "敞口以每 1% 波动的 {unit} 计；持仓量按现货价计值。所选范围外的到期日显示为灰色；最后一小时内的期权不计入。",
  // The book picker.
  "Pick an option book": "选择期权簿",
  "{n} books": "{n} 个期权簿",
  "Filter books": "筛选期权簿",
  Book: "期权簿",
  "Net gamma": "净 Gamma",
  "Every expiry, per 1% move, in the currency the contract pays":
    "全部到期日，每 1% 波动，以合约结算货币计",
  "Calls / puts": "看涨 / 看跌",
  Flip: "翻转点",
  "Where net gamma changes sign, from the spot": "净 Gamma 变号处距现货价的距离",
  "As of": "截至",
  "No book matches.": "没有匹配的期权簿。",
  "calls {calls} · puts {puts}": "看涨 {calls} · 看跌 {puts}",
  "close {date}": "{date} 收盘",
  Crypto: "加密货币",
  "United States": "美国",
  "Asia-Pacific": "亚太",
  Europe: "欧洲",
  Other: "其他",
  Bitcoin: "比特币",
  Ether: "以太坊",
  "S&P 500": "标普 500",
  "Nasdaq-100": "纳斯达克 100",
  "Russell 2000": "罗素 2000",
  "SPDR S&P 500 ETF": "SPDR 标普 500 ETF",
  "Invesco QQQ": "景顺 QQQ",
  "iShares Russell 2000 ETF": "iShares 罗素 2000 ETF",
  "SPDR Gold Shares": "SPDR 黄金 ETF",
  "iShares Silver Trust": "iShares 白银 ETF",
  "United States Oil Fund": "美国原油基金",
  "iShares Bitcoin Trust": "iShares 比特币 ETF",
  "iShares Ethereum Trust": "iShares 以太坊 ETF",
  Strategy: "Strategy（微策略）",
  Coinbase: "Coinbase",
  NVIDIA: "英伟达",
  Tesla: "特斯拉",
  Micron: "美光科技",
  "Hang Seng": "恒生指数",
  "Hang Seng China Enterprises": "恒生中国企业指数",
  "Hang Seng TECH": "恒生科技指数",
  "CSI 300": "沪深 300",
  "SSE 50": "上证 50",
  "CSI 1000": "中证 1000",
  TAIEX: "台湾加权指数",
  "Nifty 50": "Nifty 50",
  "Nifty Bank": "Nifty 银行指数",
  "BSE Sensex": "孟买 Sensex",
  "Euro Stoxx 50": "欧洲斯托克 50",
  DAX: "德国 DAX",
  "Swiss Market Index": "瑞士 SMI",
  // Chart readout (slot-chart.ts).
  "strike {strikes} ({pct} from spot)": "行权价 {strikes}（距现货价 {pct}）",
  "{low} – {high} ({pct} from spot)": "{low} – {high}（距现货价 {pct}）",
  "no open interest here": "此处无持仓量",
  "calls {usd} ({oi} open)": "看涨 {usd}（持仓 {oi}）",
  "puts {usd} ({oi} open)": "看跌 {usd}（持仓 {oi}）",
  "net {usd}": "净额 {usd}",
  "if the spot were here: net {usd}": "若现货价在此：净额 {usd}",
};
