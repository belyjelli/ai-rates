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
  "Chips and memory: the same Cboe chains for the chip, memory and hardware stocks and ETFs the perps trade most. SK hynix is its Nasdaq ADR (SKHY), the price the SKHY perps follow; the SKHYNIX perps quote one Seoul share instead. Samsung's options trade only on the Korea Exchange and are not read yet, and neither Deribit nor Binance lists options on stocks.":
    "芯片与存储：同样是 Cboe 的期权链，覆盖永续合约交易最多的芯片、存储和硬件股票及 ETF。SK 海力士取其纳斯达克 ADR（SKHY），即 SKHY 永续合约跟踪的价格；SKHYNIX 永续合约报价的则是一股首尔上市股票。三星的期权只在韩国交易所交易，暂未读取；Deribit 和 Binance 都没有上线股票期权。",
  "Biotech and health, and Metals and mining: the same Cboe chains for the drug makers, health care and biotech funds, and for the gold, silver and copper miners, their funds, gold and silver themselves (GLD, SLV), and the lithium, nickel and rare-earth producers batteries need. The perps trade few of them; a book is kept when its open interest is about $0.5B or more, which leaves out the small lithium names.":
    "生物科技与医疗、金属与矿业：同样是 Cboe 的期权链，覆盖制药公司、医疗保健和生物科技基金，以及金、银、铜矿企及其基金、黄金和白银本身（GLD、SLV），还有电池所需的锂、镍和稀土生产商。永续合约交易其中的少数；持仓量约 5 亿美元及以上的期权簿才会收录，因此小型锂矿股未计入。",
  "Asia-Pacific and Europe: each exchange's end-of-day file, read once after it is published -- HKEX (Hang Seng indexes), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, its three nearest months), ASX (S&amp;P/ASX 200), NSE and BSE (Nifty, Sensex) and Eurex (Euro Stoxx 50, DAX, SMI). They publish settlement prices and open interest but no volatility, so each strike's is backed out of its out-of-the-money settlement (for ASX, its closing theoretical price) with Black-76, against the forward that put-call parity or the exchange's own future gives. Their figures are in the currency the contract pays, and as of that day's close.":
    "亚太和欧洲：各交易所的日终文件，发布后读取一次 —— 港交所（恒生系列指数）、中金所（沪深 300、上证 50、中证 1000）、台湾期交所（台湾加权指数）、日本交易所 JPX（日经 225，最近三个合约月）、澳交所 ASX（S&amp;P/ASX 200）、NSE 和 BSE（Nifty、Sensex）以及 Eurex（欧洲斯托克 50、DAX、SMI）。它们公布结算价和持仓量，但不公布波动率，因此各行权价的波动率由其价外结算价（ASX 为收盘理论价）按 Black-76 反推，远期价格取自看涨看跌平价或交易所自己的期货。这些数字以合约结算货币计，截至当日收盘。",
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
  "Chips and memory": "芯片与存储",
  "Biotech and health": "生物科技与医疗",
  "Metals and mining": "金属与矿业",
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
  "SK hynix (ADR)": "SK 海力士（ADR）",
  Sandisk: "闪迪",
  "Western Digital": "西部数据",
  Seagate: "希捷",
  "Roundhill Memory ETF": "Roundhill 存储芯片 ETF",
  AMD: "AMD",
  Broadcom: "博通",
  "TSMC (ADR)": "台积电（ADR）",
  Intel: "英特尔",
  Marvell: "迈威尔科技",
  Arm: "Arm",
  Qualcomm: "高通",
  ASML: "阿斯麦（ASML）",
  "Applied Materials": "应用材料",
  "Lam Research": "泛林集团",
  KLA: "科磊（KLA）",
  Dell: "戴尔",
  Supermicro: "超微电脑",
  Lumentum: "Lumentum",
  Coherent: "Coherent（高意）",
  "Applied Optoelectronics": "应用光电",
  Corning: "康宁",
  "VanEck Semiconductor ETF": "VanEck 半导体 ETF",
  "iShares Semiconductor ETF": "iShares 半导体 ETF",
  "Direxion Semiconductor Bull 3X": "Direxion 三倍做多半导体 ETF",
  "iShares MSCI South Korea ETF": "iShares MSCI 韩国 ETF",
  "Direxion Semiconductor Bear 3X": "Direxion 三倍做空半导体 ETF",
  "Direxion Micron Bull 2X": "Direxion 两倍做多美光 ETF",
  "Direxion South Korea Bull 3X": "Direxion 三倍做多韩国 ETF",
  "Eli Lilly": "礼来",
  UnitedHealth: "联合健康",
  Moderna: "莫德纳",
  "Health Care Select Sector SPDR": "医疗保健精选行业 SPDR ETF",
  "Johnson & Johnson": "强生",
  "SPDR S&P Biotech ETF": "SPDR 标普生物科技 ETF",
  AbbVie: "艾伯维",
  Merck: "默沙东",
  Pfizer: "辉瑞",
  "Novo Nordisk (ADR)": "诺和诺德（ADR）",
  "Intuitive Surgical": "直觉外科",
  Amgen: "安进",
  "Thermo Fisher": "赛默飞世尔",
  Regeneron: "再生元",
  Gilead: "吉利德",
  "Tempus AI": "Tempus AI",
  Vertex: "福泰制药",
  "AstraZeneca (ADR)": "阿斯利康（ADR）",
  "Hims & Hers": "Hims & Hers",
  Biogen: "渤健",
  "iShares Biotechnology ETF": "iShares 生物科技 ETF",
  "Viking Therapeutics": "Viking Therapeutics",
  "VanEck Gold Miners ETF": "VanEck 金矿股 ETF",
  Newmont: "纽蒙特",
  Barrick: "巴里克",
  "Agnico Eagle": "伊格尔矿业",
  "VanEck Junior Gold Miners ETF": "VanEck 小型金矿股 ETF",
  "Wheaton Precious Metals": "惠顿贵金属",
  "Kinross Gold": "金罗斯黄金",
  "First Majestic Silver": "第一矿业白银",
  "Amplify Junior Silver Miners ETF": "Amplify 小型银矿股 ETF",
  "Hecla Mining": "赫克拉矿业",
  "Pan American Silver": "泛美白银",
  "Global X Silver Miners ETF": "Global X 银矿股 ETF",
  "Coeur Mining": "科尔矿业",
  "Freeport-McMoRan": "自由港麦克莫兰",
  "Global X Copper Miners ETF": "Global X 铜矿股 ETF",
  "BHP (ADR)": "必和必拓（ADR）",
  "Rio Tinto (ADR)": "力拓（ADR）",
  "Southern Copper": "南方铜业",
  "Vale (ADR)": "淡水河谷（ADR）",
  Albemarle: "雅保",
  "MP Materials": "MP Materials",
  "USA Rare Earth": "USA Rare Earth",
  "Hang Seng": "恒生指数",
  "Hang Seng China Enterprises": "恒生中国企业指数",
  "Hang Seng TECH": "恒生科技指数",
  "CSI 300": "沪深 300",
  "SSE 50": "上证 50",
  "CSI 1000": "中证 1000",
  TAIEX: "台湾加权指数",
  "Nikkei 225": "日经 225",
  "S&P/ASX 200": "S&P/ASX 200（澳洲）",
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
  "Expected price move": "预期价格波幅",
  "1 day ahead": "未来 1 天",
  "1 week ahead": "未来 1 周",
  "30 days ahead": "未来 30 天",
  "to the {date} expiry": "至 {date} 到期",
  "IV {iv}": "IV {iv}",
  "ATM IV": "平值 IV",
  "Implied volatility at the expiry's forward, a year": "该到期日远期价处的隐含波动率（年化）",
  "closed inside 1σ on {one} and 2σ on {two} of days since {year}":
    "自 {year} 年起，{one} 的日子收于 1σ 内，{two} 收于 2σ 内",
  "expected move, 1σ and 2σ, {horizon}": "预期波幅 1σ 与 2σ，{horizon}",
  "spot · {source} IV": "现货价 · {source} IV",
  "One standard deviation is the price × IV × √(days/365), from each expiry's at-the-money implied volatility (between two expiries, their total variance interpolated). The walls are one and two deviations either side of the spot. A normal distribution ends inside them 68% and 95% of the time; real prices have fatter tails, and options usually price in more movement than follows.":
    "一个标准差 = 价格 × IV × √(天数/365)，取各到期日的平值隐含波动率（两个到期日之间按总方差插值）。墙位于现货价两侧一个和两个标准差处。正态分布有 68% 和 95% 的时间收于其内；实际价格尾部更厚，期权定价的波动通常也大于随后的实际波动。",
  "The last line of a branch is how often it really did, from Deribit's 30-day volatility index (DVOL) and the perpetual's daily settlement: one 30-day IV for every horizon, and overlapping windows, so frequencies rather than independent trials.":
    "每个分支的最后一行是实际发生的频率，依据 Deribit 30 天波动率指数（DVOL）与永续合约每日结算价：所有期限都用同一个 30 天 IV，且窗口相互重叠，因此是频率而非独立试验。",
  "The expected move is the range the options have priced in: one standard deviation is the price times the at-the-money implied volatility times the square root of the days ahead over 365, and the walls sit one and two deviations either side of the spot. The chart draws them for the chosen expiries (30 days ahead for all of them); the mind map under it gives every horizon. They are not support or resistance, only the market's own estimate of how far price may travel.":
    "预期波幅是期权已定价的区间：一个标准差等于价格乘以平值隐含波动率，再乘以（未来天数/365）的平方根；墙位于现货价两侧一个和两个标准差处。图表按所选到期范围画出（全部到期日时为未来 30 天）；其下的思维导图列出每个期限。它们不是支撑或阻力，只是市场自身对价格可能走多远的估计。",
  reference: "参考价",
  Level: "水平",
  "From the reference": "距参考价",
  "the next session": "下一交易时段",
  "{date}, from 08:00 UTC": "{date}，自 08:00 UTC 起",
  "{date} session": "{date} 交易时段",
  "no trade yet today": "今天尚无成交",
  "above it now": "现已在其上方",
  "below it now": "现已在其下方",
  "reached it today and back inside": "今天触及后已回到区间内",
  "inside all day so far": "今天至今一直在区间内",
  "No history is kept for this book's walls yet, so its 90% wall is the normal distribution's 1.645 standard deviations of the options' own IV, not a measured one. Its record starts with its first day below.":
    "这个期权簿的墙还没有历史记录，所以它的 90% 墙用的是正态分布的 1.645 个标准差（基于期权自身的 IV），并非实测。它的记录从下方第一天开始。",
  "Measured on {days} sessions since {since} {year}, against Cboe's 1-day VIX: the S&amp;P 500 closed inside one standard deviation on {inside1}, and within {k90} of them on 90%, so that is where the 90% wall sits. Cboe's free history has the index's closes only, so touches of a wall during the day are not counted here; this book's own record below counts them.":
    "基于 {since} {year} 以来的 {days} 个交易时段，对照 Cboe 的 1 日 VIX 测得：标普 500 有 {inside1} 收于一个标准差之内，90% 收于 {k90} 个标准差之内，90% 墙就设在那里。Cboe 的免费历史只有指数收盘价，所以这里不计日内触墙；下方这个期权簿自己的记录会计入。",
  "Measured on {days} Deribit days since {since} {year}, against the 30-day volatility index (DVOL) as each day began: the whole day stayed within {k90} standard deviations on 90% of days, so that is where the 90% wall sits. Within one, the whole day stayed on {inside1} and the close on {close1}. A touch of the 1σ wall closed back inside {rev1} of {touch1} times; a touch of the 90% wall, {rev90} of {touch90} times.":
    "基于 {since} {year} 以来的 {days} 个 Deribit 交易日，对照每天开始时的 30 天波动率指数（DVOL）测得：90% 的日子里全天都在 {k90} 个标准差之内，90% 墙就设在那里。一个标准差之内：全天 {inside1}，收盘 {close1}。触及 1σ 墙后收回区间内 {rev1}（共 {touch1} 次）；触及 90% 墙后 {rev90}（共 {touch90} 次）。",
  "not reached": "未触及",
  "reached, closed back inside": "触及后收回区间内",
  "closed beyond": "收于墙外",
  "above: {what}": "上方：{what}",
  "below: {what}": "下方：{what}",
  "The IV wall is the move the options price for the day: the reference close plus and minus one standard deviation, the close times the options' implied volatility a day ahead times the square root of 1/365. The levels are fixed when the day begins (Deribit's day at 08:00 UTC, a US session at its first read) so they do not drift through the day.":
    "IV 墙是期权为当天定价的波动：参考收盘价上下各一个标准差，即收盘价乘以未来一天的期权隐含波动率，再乘以 1/365 的平方根。这些水平在一天开始时固定（Deribit 的一天始于 08:00 UTC，美股交易时段以首次读取为准），不会随当天的变化漂移。",
  "The 90% wall is where history says price stayed: the multiple of a day's standard deviation that held on 90% of past days. BTC and ETH are measured on every Deribit day since 2021 against DVOL, their whole day's range; the S&amp;P 500 on every session since 2022 against Cboe's 1-day VIX, closes only. A book with no history uses the normal distribution's 1.645.":
    "90% 墙是历史上价格停留的范围：过去 90% 的日子里不被突破的日标准差倍数。BTC 和 ETH 用 2021 年以来每个 Deribit 交易日对照 DVOL 测得，按全天波幅；标普 500 用 2022 年以来每个交易时段对照 Cboe 的 1 日 VIX 测得，只看收盘。没有历史的期权簿用正态分布的 1.645。",
  "A wall is a probability, not a promise: a touch of the IV wall has closed back inside a little over half the time, not nine times in ten. The record under the ladder shows each day's outcome for this book.":
    "墙是概率，不是承诺：触及 IV 墙后收回区间内的比例略高于一半，而不是十次中九次。梯形图下方的记录列出这个期权簿每天的结果。",
  "{currency}'s options carry no implied volatility to draw walls from yet.":
    "{currency} 的期权还没有可用于画墙的隐含波动率。",
  "1.645 standard deviations of the options' IV (normal distribution)":
    "期权 IV 的 1.645 个标准差（正态分布）",
  "{k90} standard deviations of {method} {sigma}, measured":
    "{method} {sigma} 的 {k90} 个标准差，实测",
  "IV wall, 1σ": "IV 墙，1σ",
  "±{move} (±{pct}) from IV {iv} a day ahead": "±{move}（±{pct}），基于未来一天的 IV {iv}",
  "90% wall": "90% 墙",
  "The day so far": "今天至今",
  Reference: "参考价",
  "high {high} · low {low}": "高 {high} · 低 {low}",
  "IV wall: {status}": "IV 墙：{status}",
  "the latest close, for the next session": "最新收盘价，用于下一交易时段",
  "Reference close": "参考收盘价",
  "{currency} · {source} options · IV walls · {day}": "{currency} · {source} 期权 · IV 墙 · {day}",
  "The day's range": "当天波幅",
  "IV wall": "IV 墙",
  "90% wall, above": "90% 墙，上方",
  "IV wall, above": "IV 墙，上方",
  "1σ of the options' IV": "期权 IV 的 1σ",
  "IV wall, below": "IV 墙，下方",
  "90% wall, below": "90% 墙，下方",
  "{currency} comes from an end-of-day file, so its walls are for the next session and are not kept day by day.":
    "{currency} 来自收盘后文件，所以它的墙是下一交易时段的，不逐日记录。",
  "{currency}'s own record starts with today; each finished day is added here.":
    "{currency} 自己的记录从今天开始；每个结束的交易日都会加到这里。",
  "{currency}'s own record, {days} finished days since {since}. IV wall: touched {reached}, closed back inside {held}. 90% wall: touched {reached90}, closed back inside {held90}.":
    "{currency} 自己的记录，自 {since} 起 {days} 个已结束的交易日。IV 墙：触及 {reached}，收回区间内 {held}。90% 墙：触及 {reached90}，收回区间内 {held90}。",
  "High / low": "高 / 低",
  Close: "收盘",
  "At the IV wall": "在 IV 墙",
  "At the 90% wall": "在 90% 墙",
  "How price has behaved at the walls": "价格在墙边的表现",
  "Prices in {unit}. {source} options, read {ago}.": "价格以 {unit} 计。{source} 期权，{ago}读取。",
  "Two readings of where the market makers stand, side by side, for the nearest expiry. The gamma ceiling is the strike above the spot holding the most call gamma, and the gamma floor the strike below it holding the most put gamma: where hedging flows are largest.":
    "并列两种解读做市商位置的方法，基于最近到期日。Gamma 天花板是现货价上方看涨 gamma 最多的行权价，gamma 地板是现货价下方看跌 gamma 最多的行权价：对冲流量最大的位置。",
  "The dealer range reads every option as sold by dealers who keep the premium, as max pain does: at expiry they pay out what the options are worth, so they earn most at the max pain strike and start losing beyond the break-evens either side, the dealer ceiling and floor. No exchange publishes who sold what, so this rests on that assumption, and the Gamma Exposure tab's sign assumes the opposite for calls.":
    "做市商区间把每张期权都看作由收取权利金的做市商卖出，与最大痛点的算法相同：到期时他们支付期权的价值，所以在最大痛点行权价赚得最多，越过两侧的盈亏平衡点就开始亏损，即做市商天花板和地板。没有交易所公布谁卖了什么，所以这建立在该假设之上；而 Gamma 敞口页对看涨期权的符号假设正好相反。",
  "A ceiling or floor within a quarter of the day's move of an IV wall is marked as lined up with it. Whether price turns there more often than elsewhere is what the record under the ladder is for: it starts with this tab and grows a day at a time.":
    "天花板或地板若在 IV 墙的当天波动的四分之一以内，就标为与墙重合。价格是否更常在那里掉头，正是梯形图下方记录要回答的：它从这个页签开始，逐日增加。",
  "gamma ceiling": "gamma 天花板",
  "dealer ceiling": "做市商天花板",
  "gamma floor": "gamma 地板",
  "dealer floor": "做市商地板",
  "Gamma ceiling / floor": "Gamma 天花板 / 地板",
  "the strikes holding the most call gamma above the spot and put gamma below it, expiring {expiry}":
    "现货价上方看涨 gamma 最多和下方看跌 gamma 最多的行权价，{expiry} 到期",
  "Dealer ceiling / floor": "做市商天花板 / 地板",
  "where dealers who sold every option of that expiry break even; max pain {pain}":
    "卖出该到期日全部期权的做市商在此盈亏平衡；最大痛点 {pain}",
  "max pain": "最大痛点",
  "{currency} · {source} options · ceiling and floor · expiring {expiry}":
    "{currency} · {source} 期权 · 天花板与地板 · {expiry} 到期",
  "dealer ceiling and floor": "做市商天花板与地板",
  "lined up with a wall": "与墙重合",
  "Dealer range by expiry": "各到期日的做市商区间",
  Premium: "权利金",
  "Dealer floor": "做市商地板",
  "Max pain": "最大痛点",
  "Dealer ceiling": "做市商天花板",
  "From the spot": "距现货价",
  "Lined up with a wall": "与墙重合",
  "{currency} comes from an end-of-day file, so its levels are for the next session and are not kept day by day.":
    "{currency} 来自收盘后文件，所以它的水平是下一交易时段的，不逐日记录。",
  Days: "天数",
  Reached: "触及",
  "Closed back inside": "收回区间内",
  "Over {days} finished days since {since}, both sides counted; a level is reached when the day's high (or low) touches it, and held when the day closes back inside it.":
    "基于自 {since} 起 {days} 个已结束的交易日，两侧都计入；当天最高（或最低）价触及即为触及，当天收回其内即为守住。",
  "How price has behaved at these levels": "价格在这些水平的表现",
  "IV Walls": "IV 墙",
  "IV walls": "IV 墙",
  "Ceiling & Floor": "天花板与地板",
  Ceiling: "天花板",
  "the spot now": "当前现货价",
  "week from {date}": "自 {date} 起的一周",
  "Levels for": "水平周期",
  "The Day and Week switch reads the same levels for the nearest expiry or for the week's: Deribit's Friday 08:00 UTC weekly, or a US book's last expiry of the week. The week's levels are fixed by its first read, its IV walls span the time to that expiry, and its 90% wall is measured on whole past weeks where there is history.":
    "日与周切换会按最近到期日或本周到期日读取同样的水平：Deribit 的周五 08:00 UTC 周度期权，或美股期权簿本周最后一个到期日。一周的水平由本周首次读取固定，IV 墙覆盖到该到期日的时间，90% 墙在有历史的地方按过去的整周测得。",
  "the strikes holding the most call gamma above the spot and put gamma below it, in everything expiring by {expiry}":
    "在 {expiry} 前到期的全部期权中，现货价上方看涨 gamma 最多和下方看跌 gamma 最多的行权价",
  "The week so far": "本周至今",
  "the spot now; this week's levels are fixed by its first read":
    "当前现货价；本周的水平由本周首次读取固定",
  "{currency}'s weekly record starts with this week; each finished week is added here.":
    "{currency} 的周度记录从本周开始；每个结束的一周都会加到这里。",
  Weeks: "周数",
  "Over {weeks} finished weeks since {since}, both sides counted; a level is reached when the week's high (or low) touches it, and held when the week closes back inside it.":
    "基于自 {since} 起 {weeks} 个已结束的周，两侧都计入；当周最高（或最低）价触及即为触及，当周收回其内即为守住。",
  "{currency} · {source} options · IV walls day by day": "{currency} · {source} 期权 · IV 墙逐日",
  "{currency} · {source} options · ceiling and floor day by day":
    "{currency} · {source} 期权 · 天花板与地板逐日",
  "daily candle": "日 K 线",
  "week's expiry": "周到期",
  "Each day's candle under the walls it opened with. The walls are fixed by the day's first read, so they move only from one day to the next.":
    "每天的 K 线画在它开盘时的墙下。墙由当天首次读取固定，所以只在换日时移动。",
  "Each day's candle under the levels it opened with. They are fixed by the day's first read, so they move only from one day to the next; the dotted rule marks each week's expiry.":
    "每天的 K 线画在它开盘时的水平下。水平由当天首次读取固定，所以只在换日时移动；虚线标出每周的到期。",
  "Each day's candle under its week's levels. They are fixed by the week's first read, so they move only at a week's expiry, the dotted rule.":
    "每天的 K 线画在其所在周的水平下。水平由本周首次读取固定，所以只在周到期（虚线）时移动。",
  // The Delta, Vega and Theta tabs (web/greeks.ts).
  Delta: "Delta",
  "{currency} · {source} options · delta by strike · {scope}":
    "{currency} · {source} 期权 · 按行权价的 Delta · {scope}",
  "{currency} · {source} options · vega by strike · {scope}":
    "{currency} · {source} 期权 · 按行权价的 Vega · {scope}",
  "{currency} · {source} options · theta by strike · {scope}":
    "{currency} · {source} 期权 · 按行权价的 Theta · {scope}",
  "net {net} at spot {spot} · calls above zero, puts below · hover or tap a strike to read it":
    "现货价 {spot} 处净值 {net} · 看涨在零线上方，看跌在下方 · 悬停或点按行权价查看",
  "{total} per IV point at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "现货价 {spot} 处每个 IV 点 {total} · 各行权价的看涨与看跌叠加 · 悬停或点按行权价查看",
  "{total} a day at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "现货价 {spot} 处每天 {total} · 各行权价的看涨与看跌叠加 · 悬停或点按行权价查看",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of the total.":
    "距现货价 ±{pct} 以外的行权价不在图内：占合计 {usd}。",
  "total {usd}": "合计 {usd}",
  "{share} of it in that expiry, {left} left": "该到期日占 {share}，剩余 {left}",
  "≈ {coins} at the spot; what the open options move like, as their buyers hold them":
    "按现货价约合 {coins}；未平仓期权相当于多少标的，按买方持有计",
  "what the open options move like, as their buyers hold them":
    "未平仓期权相当于多少标的，按买方持有计",
  "Net delta": "净 Delta",
  "calls' delta is positive, puts' negative": "看涨的 Delta 为正，看跌为负",
  "Most delta": "Delta 最多",
  Vega: "Vega",
  "per IV point: what the open options gain if implied volatility rises one point, and their writers lose":
    "每个 IV 点：隐含波动率上升 1 个点时未平仓期权的增值，也是卖方的损失",
  "every option gains as implied volatility rises": "隐含波动率上升时，每个期权都会增值",
  "Most vega": "Vega 最多",
  "of the options' value a day, {premium} in all": "期权价值的每日占比，总价值 {premium}",
  Theta: "Theta",
  "a day: what the open options lose to time with price and IV unchanged, paid by their buyers to their writers":
    "每天：价格与 IV 不变时，未平仓期权因时间流逝损失的价值，由买方付给卖方",
  "every option loses value as expiry nears, faster the closer it is":
    "每个期权都随到期临近而贬值，越临近越快",
  "Most theta": "Theta 最多",
  "Decay rate": "衰减率",
  "Delta in {unit}: the value of the underlying each expiry's open options move like. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Delta 以 {unit} 计：各到期日的未平仓期权相当于多少价值的标的。所选范围外的到期日显示为灰色；最后一小时内的期权不计入。",
  "Vega in {unit} per IV point. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Vega 以每个 IV 点的 {unit} 计。所选范围外的到期日显示为灰色；最后一小时内的期权不计入。",
  "Theta in {unit} a day. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Theta 以每天的 {unit} 计。所选范围外的到期日显示为灰色；最后一小时内的期权不计入。",
  "Of the chain's total, either side counted": "占全部合计的比例，两侧均计",
  Total: "合计",
  "Delta is how much an option's value moves with the underlying: about a half at the money, near 1 deep in the money and near 0 far out of it, negative for puts. Times open interest and the forward, it is the value of the underlying the open options move like, added up by strike.":
    "Delta 是期权价值随标的变动的幅度：平值时约为一半，深度实值时接近 1，远虚值时接近 0，看跌为负。乘以持仓量和远期价格，就是未平仓期权相当于多少价值的标的，按行权价加总。",
  "It is read from the side of whoever bought the options: calls positive, puts negative. Whoever wrote them holds exactly the opposite, so were every writer hedged, their hedges would hold this much of the underlying. Nothing here assumes who is on which side, unlike gamma exposure.":
    "它按买方的角度读取：看涨为正，看跌为负。卖方持有完全相反的一面，所以如果每个卖方都做了对冲，他们的对冲头寸就持有这么多标的。与 Gamma 敞口不同，这里不假设谁在哪一边。",
  "Most delta sits in options already in the money, away from the spot, so this chart often reaches wider than the gamma chart.":
    "大部分 Delta 位于已经实值、远离现货价的期权中，所以这张图通常比 Gamma 图覆盖得更宽。",
  "Vega is how much an option's value moves when implied volatility moves one point, say from 40% to 41%: largest at the money and for options with long to run. Times open interest, it is what the open options gain if IV rises a point, added up by strike.":
    "Vega 是隐含波动率变动一个点（比如从 40% 到 41%）时期权价值的变动：平值和剩余期限长的期权最大。乘以持仓量，就是 IV 上升一个点时未平仓期权的增值，按行权价加总。",
  "Every option carries positive vega for whoever bought it and the same amount negative for whoever wrote it, so the total is what option writers stand to lose if IV rises a point, and gain if it falls one.":
    "每个期权对买方都是正 Vega，对卖方则是同样大小的负 Vega，所以合计就是 IV 上升一个点时期权卖方可能的损失，下降一个点时的收益。",
  "Theta is how much an option's value falls in a day with price and implied volatility unchanged: largest at the money and in an option's last days. Times open interest, it is what the open options lose in a day, added up by strike.":
    "Theta 是价格和隐含波动率不变时期权价值一天内的下降：平值和到期前最后几天最大。乘以持仓量，就是未平仓期权一天损失的价值，按行权价加总。",
  "Buyers pay it and writers collect it: the total is roughly what option writers earn in a quiet day, the carry they are paid for taking on gamma. The decay rate divides it by what the options in range are worth.":
    "买方支付、卖方收取：合计大致就是期权卖方在平静的一天里赚到的钱，即他们承担 Gamma 所得到的报酬。衰减率是它除以所选范围内期权的价值。",
  "The same books and reads as Gamma Exposure: Deribit's BTC and ETH every five minutes, Cboe's US chains every 15 minutes through the session, and the exchanges' end-of-day files for Asia-Pacific and Europe. Each option's Greeks are Black-76 at a zero rate on its own open interest, implied volatility and forward, in the currency the contract pays; they reproduce Deribit's own to within 0.03%.":
    "与 Gamma 敞口相同的期权簿和读取：Deribit 的 BTC 和 ETH 每五分钟一次，Cboe 的美国期权链在交易时段内每 15 分钟一次，亚太和欧洲则是各交易所的日终文件。每个期权的希腊值按 Black-76（零利率）由其自身的持仓量、隐含波动率和远期价格计算，以合约结算货币计；可在 0.03% 以内复现 Deribit 自己的数值。",
  "Delta as the options' buyers hold it: calls positive, puts negative; whoever wrote them holds the opposite. {source} options, {asof}.":
    "按期权买方持有计的 Delta：看涨为正，看跌为负；卖方持有相反的一面。{source} 期权，{asof}。",
  "Vega as the options' buyers hold it, per point of implied volatility; whoever wrote them holds the opposite. {source} options, {asof}.":
    "按期权买方持有计的 Vega，以每个隐含波动率点计；卖方持有相反的一面。{source} 期权，{asof}。",
  "Theta as the options' buyers hold it, per day; whoever wrote them collects it. {source} options, {asof}.":
    "按期权买方持有计的 Theta，以每天计；由卖方收取。{source} 期权，{asof}。",
  "Delta, vega and theta have not been computed for {currency} yet; they arrive with its next read.":
    "{currency} 的 Delta、Vega 和 Theta 尚未计算；将随下一次读取出现。",
  // The Gamma Exposure tab's By expiry chart (web/gamma.ts) and its readout (web/slot-chart.ts).
  "Each expiry's calls above zero and its puts below, at their value at the spot":
    "各到期日的看涨在零线上方、看跌在下方，按现货价计值",
  "Each expiry's gamma exposure: calls above zero, puts below":
    "各到期日的 Gamma 敞口：看涨在零线上方，看跌在下方",
  gamma: "Gamma",
  "Each expiry's at-the-money implied volatility: the term structure":
    "各到期日的平值隐含波动率：期限结构",
  show: "显示",
  "{n} expiries · open interest {calls} in calls, {puts} in puts · hover or tap an expiry to read it":
    "{n} 个到期日 · 持仓量看涨 {calls}、看跌 {puts} · 悬停或点按到期日查看",
  "{currency} · {source} options · by expiry": "{currency} · {source} 期权 · 按到期日",
  "{currency} expiries; arrow keys read one at a time": "{currency} 到期日；用方向键逐个查看",
  "One bar per expiry in date order, so the gaps between them are not to scale; expiries outside the chosen range are dimmed.":
    "每个到期日一根柱，按日期排列，柱间距不按时间比例；所选范围外的到期日显示为灰色。",
  "{date}, {left} left": "{date}，剩余 {left}",
  "{n} options": "{n} 个期权",
  "calls {oi} open": "看涨持仓 {oi}",
  "puts {oi} open": "看跌持仓 {oi}",
  "put/call {ratio}": "看跌/看涨比 {ratio}",
  "gamma {calls} / {puts}, net {net}": "Gamma 看涨 {calls} / 看跌 {puts}，净额 {net}",
  "ATM IV {iv}": "平值 IV {iv}",
  "max pain {price}": "最大痛点 {price}",
  "dealer range {low} – {high}": "做市商区间 {low} – {high}",
  "premium {usd}": "权利金 {usd}",
  // Reaction zones (web/confluence.ts).
  "reaction zone, today": "反应区（今日）",
  "gamma wall": "gamma 墙",
  "dealer break-even": "做市商盈亏平衡点",
  "gamma flip": "gamma 翻转点",
  "the spot is inside it now": "现货价正在区内",
  "{points} ({pct}) away, {sigmas} of the day's move":
    "距离 {points}（{pct}），当日波动的 {sigmas}",
  "No zone above": "上方无反应区",
  "No zone below": "下方无反应区",
  "no IV wall lines up with a ceiling": "没有 IV 墙与天花板重合",
  "no IV wall lines up with a floor": "没有 IV 墙与地板重合",
  "Above the spot": "现货价上方",
  "Below the spot": "现货价下方",
  zone: "反应区",
  "Dealers long gamma ({net} per 1% move, every expiry): their hedging sells rises and buys dips, which is what lets a wall hold.":
    "做市商为正 Gamma（每 1% 波动 {net}，全部到期）：他们的对冲在上涨时卖出、下跌时买入，墙因此才守得住。",
  "Dealers short gamma ({net} per 1% move, every expiry): their hedging chases the price, so walls give way more easily and fading them is riskier.":
    "做市商为负 Gamma（每 1% 波动 {net}，全部到期）：他们的对冲追随价格，墙更容易被突破，逆势交易风险更高。",
  "Flip {price}, {pct} ({sigmas}).": "翻转点 {price}，{pct}（{sigmas}）。",
  "Since {year}, a touch of this book's 1σ wall closed back inside {rev1} of {touch1} times, of its 90% wall {rev90} of {touch90}: better than a coin toss, not nine in ten.":
    "自 {year} 年起，此标的触及 1σ 墙后收回墙内 {rev1}（共 {touch1} 次），触及 90% 墙后 {rev90}（共 {touch90} 次）：好过抛硬币，但远非十中有九。",
  "A zone is where an IV wall and a market maker's level fall within a quarter of the day's 1σ move of each other: a place to wait for a rejection, not a trade on its own, and least reliable when dealers are short gamma.":
    "反应区是 IV 墙与做市商水平相距不超过当日 1σ 波动四分之一的地方：是等待拒绝信号的位置，本身不是交易信号；做市商为负 Gamma 时最不可靠。",
  "the week's 1σ move": "本周的 1σ 波动",
  "the day's 1σ move": "当日的 1σ 波动",
  "Reaction zones": "反应区",
  "σ is {unit}, {move}": "σ 为{unit}，{move}",
  "between the IV walls": "IV 墙之间",
  "between the 90% walls": "90% 墙之间",
  "each line's mark is beside its name below": "每条线的样式标在下方名称旁",
  "Each expiry's delta: calls above zero, puts below":
    "各到期日的 delta：看涨在零轴上方，看跌在下方",
  "Each expiry's theta a day, its calls and puts stacked down from the top":
    "各到期日每天的 theta，看涨与看跌从顶部向下堆叠",
  "Each expiry's vega, its calls and puts stacked": "各到期日的 vega，看涨与看跌堆叠",
  "Its own zone record, {days} finished days since {since}: {zones} zones, price reached {reached} and closed back on the near side of {held}; its IV walls on those days were reached {wallReached} times and held {wallHeld}.":
    "此标的自身的反应区记录，自 {since} 起 {days} 个已结束交易日：共 {zones} 个反应区，价格触及 {reached} 个，其中 {held} 个收回近侧；同期其 IV 墙被触及 {wallReached} 次，守住 {wallHeld} 次。",
  "This book's zone record starts with today: each finished day adds whether price reached a zone and turned there.":
    "此标的的反应区记录从今天开始：每个结束的交易日都会记下价格是否触及反应区并在那里回头。",
  "Zone record": "反应区记录",
  "dealers long gamma": "做市商为正 Gamma",
  "dealers short gamma": "做市商为负 Gamma",
  delta: "delta",
  "delta {calls} / {puts}, net {net}": "delta {calls} / {puts}，净值 {net}",
  "each finished day adds whether price reached a zone and closed back on its near side":
    "每个结束的交易日都会记下价格是否触及反应区并收回其近侧",
  "no zone above": "上方无反应区",
  "no zone below": "下方无反应区",
  "starts this week": "本周开始",
  "starts today": "今天开始",
  "the spot is in the zone {range}": "现货价在反应区 {range} 内",
  theta: "theta",
  "theta {calls} / {puts} a day, total {net}": "theta {calls} / {puts} 每天，合计 {net}",
  "this book's days are not kept, so its zones have no record":
    "此标的的交易日不做保存，因此其反应区没有记录",
  vega: "vega",
  "vega {calls} / {puts}, total {net}": "vega {calls} / {puts}，合计 {net}",
  "zone above {range}, {sigmas} away": "上方反应区 {range}，距离 {sigmas}",
  "zone below {range}, {sigmas} away": "下方反应区 {range}，距离 {sigmas}",
  "zones reached and held over {days} finished days; the IV walls alone: {wallHeld} / {wallReached}":
    "{days} 个已结束交易日中反应区被触及并守住；仅 IV 墙：{wallHeld} / {wallReached}",
  "zones reached and held over {days} finished weeks; the IV walls alone: {wallHeld} / {wallReached}":
    "{days} 个已结束的周中反应区被触及并守住；仅 IV 墙：{wallHeld} / {wallReached}",
};
