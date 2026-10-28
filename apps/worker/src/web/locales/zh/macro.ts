import type { Catalog } from "../../i18n";

/**
 * The Rates page's macro tabs (web/macro.ts) and the macro charts' readout words (web/slot-chart.ts).
 * Glossary and style: ./index.ts.
 *
 * Terms: Federal Reserve / Fed 美联储, FOMC 联邦公开市场委员会 (FOMC), fed funds rate 联邦基金利率,
 * target range 目标区间, effective rate 有效利率, interest on reserves 准备金利率 (IORB), midpoint
 * 中值, cut / hold / hike 降息 / 维持不变 / 加息, policy rate 政策利率, balance sheet 资产负债表,
 * Summary of Economic Projections 经济预测摘要 (SEP), dot plot 点阵图, Treasury (the securities)
 * 美国国债 / 美债, the Treasury (the department) 财政部, yield 收益率, yield curve 收益率曲线,
 * inverted 倒挂, real yield 实际收益率, breakeven 盈亏平衡通胀率, inflation-protected Treasury 通胀保值
 * 国债 (TIPS), reverse repo 逆回购, net liquidity 净流动性, on the month 环比, year on year 同比,
 * annualized 年化 (as the glossary), core 核心, print 公布值, payrolls 非农就业, unemployment rate
 * 失业率, jobless claims 初请失业金人数 (continuing 续请), job openings 职位空缺, average hourly
 * earnings 平均时薪, Sahm rule 萨姆规则, retail sales 零售销售, industrial production 工业产出,
 * recession 衰退, odds (Kalshi's) 概率, middle estimate 中位预期, pp 个百分点, bp 基点 (as the
 * glossary; "个基点" in prose, as pages.ts writes it), Commitments of Traders 持仓报告 (COT), dealers
 * 交易商 (the CFTC's sell-side category, not gamma.ts's option 做市商), asset managers 资产管理机构,
 * leveraged funds 杠杆基金, managed money 管理基金, producers and merchants 生产商与贸易商, swap
 * dealers 掉期交易商, net (position) 净持仓, 3-year rank 3 年分位, stablecoin 稳定币, supply 供应量.
 * Agency names are spelled out in Chinese once in the help (美国劳工统计局（BLS）) and left as BLS, BEA,
 * FRED, CFTC, CME, Kalshi, DefiLlama, GDPNow, NFCI, M2, SOFR, JOLTS, E-mini and VIX elsewhere.
 */
export const macro: Catalog = {
  // The tab bar.
  "Inflation (CPI)": "通胀（CPI）",
  CPI: "CPI",
  "Fed policy": "美联储政策",
  Fed: "美联储",
  Employment: "就业",
  Jobs: "就业",
  Growth: "经济增长",
  "Policy signals": "政策信号",
  Signals: "信号",
  "Positioning and flows": "持仓与资金流向",
  Flows: "资金流向",

  // Units, dates and the chart frame. "{n} pp" and "{n} bp" are suffixes after a signed figure.
  "{n} pp": "{n} 个百分点",
  "{n} bp": "{n} 基点",
  "{month} {year}": "{year}年{month}",
  "Q{q} {year}": "{year}年第{q}季度",
  "in {time}": "{time}后",
  "hover or tap the chart to read any point": "悬停或点击图表查看任一点的数值",
  "{chart}; arrow keys read one point at a time": "{chart}；用方向键逐点查看",

  // The release calendar.
  "PCE prices": "PCE 物价指数",
  "Jobs report": "非农就业报告",
  "Jobless claims": "初请失业金人数",
  "Job openings (JOLTS)": "职位空缺（JOLTS）",
  GDP: "GDP",
  "Retail sales": "零售销售",
  "Industrial production": "工业产出",
  "FOMC decision": "FOMC 利率决议",
  "Coming up": "即将公布",

  // Kalshi's ladders and the footnotes.
  "below {value}": "低于 {value}",
  "above {value}": "高于 {value}",
  "middle estimate {value}": "中位预期 {value}",
  "Not updated since {ago}: the latest reads of these sources failed, so the figures are that old.":
    "自{ago}起未更新：最近几次读取这些数据源均失败，以下数字停留在那时。",
  "{sources} Last read {ago}.": "{sources}最近读取于{ago}。",

  // Inflation.
  "No inflation figures have been read yet.": "尚未读取到通胀数据。",
  "CPI, year on year": "CPI 同比",
  "{month}: {mom} on the month · core {core}": "{month}：环比 {mom} · 核心 {core}",
  "Core PCE, year on year": "核心 PCE 同比",
  "{month} · the measure the Fed's 2% target is set in": "{month} · 美联储 2% 通胀目标所依据的指标",
  "Next CPI": "下次 CPI",
  "Kalshi: {headline} on the month, core {core}": "Kalshi：环比 {headline}，核心 {core}",
  "no date published yet": "尚未公布日期",
  "5-year breakeven": "5 年期盈亏平衡通胀率",
  "the inflation Treasuries price in · 5y5y forward {fwd}": "美债定价的通胀 · 5y5y 远期 {fwd}",
  "Inflation, year on year": "通胀同比",
  "Core CPI": "核心 CPI",
  PCE: "PCE",
  "Core PCE": "核心 PCE",
  "Fed's 2% target": "美联储 2% 目标",
  "Inflation the bond market prices in": "债市定价的通胀",
  "10-year breakeven": "10 年期盈亏平衡通胀率",
  "5y5y forward": "5y5y 远期",
  "Breakeven: the gap between a nominal Treasury's yield and an inflation-protected one's of the same term. Weekly, each week's last close.":
    "盈亏平衡通胀率：同期限名义国债与通胀保值国债的收益率之差。按周显示，取每周最后一个收盘值。",
  "Latest prints": "最新公布值",
  Measure: "指标",
  Month: "月份",
  "On the month": "环比",
  "3 months, annualized": "3 个月年化",
  "6 months, annualized": "6 个月年化",
  "Year on year": "同比",
  "A year earlier": "一年前",
  "CPI, on the month": "CPI 环比",
  "Core CPI, on the month": "核心 CPI 环比",
  Inflation: "通胀",
  "CPI is the Bureau of Labor Statistics' consumer price index, published monthly; core leaves out food and energy. PCE is the Bureau of Economic Analysis' price index for personal consumption, published about two weeks after CPI; the Fed's 2% target is set in it, and core PCE is the figure it watches most.":
    "CPI 是美国劳工统计局（BLS）每月公布的消费者价格指数；核心 CPI 剔除食品和能源。PCE 是美国经济分析局（BEA）的个人消费支出价格指数，约在 CPI 之后两周公布；美联储的 2% 通胀目标以它为准，核心 PCE 是美联储最关注的数字。",
  "The changes are worked out here from the seasonally adjusted indexes: on the month, over three and six months annualized (the recent pace, which the year-on-year figure is slow to show), and on the year.":
    "各项变化由本站根据季调后的指数计算：环比，3 个月和 6 个月年化（即近期的节奏，同比数字要过一段时间才能反映出来），以及同比。",
  "The breakevens are the inflation the Treasury market prices in, from the Fed's daily yields: 5-year and 10-year, and the 5-year rate starting five years from now (5y5y), which the Fed reads as long-run expectations.":
    "盈亏平衡通胀率是美债市场定价的通胀，取自美联储公布的每日收益率：5 年期和 10 年期，以及从五年后起算的 5 年期通胀率（5y5y），美联储将其视为长期通胀预期。",
  "Kalshi, a CFTC-regulated exchange, lists contracts that pay if the next print is above a level. Their prices read as the market's chances; the middle estimate is where the chance of above crosses one half.":
    "Kalshi 是受 CFTC 监管的交易所，其合约在下次公布值高于某一水平时赔付。合约价格可视为市场给出的概率；中位预期是「高于」的概率跨过一半的位置。",
  "What Kalshi's traders expect": "Kalshi 交易者的预期",
  "Sources: BLS and BEA through FRED; breakevens from the Fed's Treasury yields; odds from Kalshi.":
    "来源：BLS 和 BEA（经由 FRED）；盈亏平衡通胀率取自美联储公布的美债收益率；概率来自 Kalshi。",

  // Fed policy.
  "cut more than 25 bp": "降息超过 25 基点",
  "cut 25 bp": "降息 25 基点",
  hold: "维持不变",
  "hike 25 bp": "加息 25 基点",
  "hike more than 25 bp": "加息超过 25 基点",
  "No Fed policy figures have been read yet.": "尚未读取到美联储政策数据。",
  "Target range": "目标区间",
  "effective {effr} · SOFR {sofr} · interest on reserves {iorb}":
    "有效利率 {effr} · SOFR {sofr} · 准备金利率 {iorb}",
  "Next FOMC decision": "下次 FOMC 利率决议",
  "with projections": "含经济预测",
  "Kalshi: {outcome} {p}": "Kalshi：{outcome} {p}",
  "Rate path the market prices": "市场定价的利率路径",
  "midpoint after {meeting}: {move} from today's {mid}":
    "{meeting}会议后的中值：较当前的 {mid} 变动 {move}",
  "no Kalshi odds read yet": "尚未读取到 Kalshi 概率",
  "Fed balance sheet": "美联储资产负债表",
  "{change} over four weeks · week of {date}": "四周变动 {change} · {date}当周",
  "A meeting with a Summary of Economic Projections": "发布经济预测摘要（SEP）的会议",
  SEP: "SEP",
  "Each meeting's odds, from Kalshi": "各次会议的概率（来自 Kalshi）",
  Meeting: "会议",
  "Cut &gt;25": "降息 &gt;25",
  "Cut 25": "降息 25",
  Hold: "维持不变",
  "Hike 25": "加息 25",
  "Hike &gt;25": "加息 &gt;25",
  "Each outcome's move times its chance, added up": "各结果的变动幅度乘以其概率后相加",
  "Expected move": "预期变动",
  "Today's midpoint plus every expected move to this meeting":
    "当前中值加上截至本次会议的每一次预期变动",
  "Implied midpoint": "隐含中值",
  "The Fed's own projections": "美联储自身的预测",
  "Median, end of year": "年末中值",
  "Longer run": "长期",
  "Fed funds rate": "联邦基金利率",
  "PCE inflation": "PCE 通胀",
  "Core PCE inflation": "核心 PCE 通胀",
  "Unemployment rate": "失业率",
  "Real GDP growth": "实际 GDP 增速",
  "From the Summary of Economic Projections of {date}: the median of the committee's forecasts (the dot plot's middle dot for the rate). Inflation and growth are fourth quarter on fourth quarter; unemployment is the fourth quarter's average.":
    "取自经济预测摘要（SEP，{date}）：委员会成员预测的中值（利率为点阵图中间的那个点）。通胀和增长为第四季度相对上年第四季度的变化；失业率为第四季度均值。",
  "Policy rate": "政策利率",
  "Top of the range": "区间上限",
  "Bottom of the range": "区间下限",
  "Effective rate": "有效利率",
  "Fed balance sheet, total assets": "美联储资产负债表（总资产）",
  "Total assets": "总资产",
  "The target range is the Federal Open Market Committee's range for the federal funds rate; the effective rate is where overnight fed funds actually trade, SOFR is the overnight Treasury repo rate, and interest on reserves is what the Fed pays banks, which holds the effective rate inside the range.":
    "目标区间是联邦公开市场委员会（FOMC）为联邦基金利率设定的区间；有效利率是隔夜联邦基金的实际成交利率，SOFR 是以美国国债为抵押的隔夜回购利率，准备金利率是美联储付给银行的利率，它让有效利率保持在区间之内。",
  "The odds are Kalshi's: for each meeting, contracts that pay on a cut of more than 25 basis points, a 25 bp cut, a hold, a 25 bp hike or a larger hike. Each meeting's prices are scaled to add up to 100%. The expected move is each outcome's size times its chance; the implied midpoint adds every expected move from today's midpoint, a path in the way CME's FedWatch draws one from fed funds futures.":
    "概率来自 Kalshi：每次会议都有一组合约，分别在降息超过 25 个基点、降息 25 个基点、维持不变、加息 25 个基点或加息更多时赔付。每次会议的价格经缩放后合计为 100%。预期变动是各结果的幅度乘以其概率；隐含中值是从当前中值起逐次累加预期变动，得出的路径与 CME FedWatch 根据联邦基金期货推算的方式相同。",
  "The projections are the committee's own, published four times a year with the meeting's statement; the dot plot is each member's view of where the rate should be at the end of each year.":
    "这些预测由委员会自己作出，每年随会议声明公布四次；点阵图是每位委员对各年年末利率应处水平的看法。",
  "The balance sheet is the Fed's total assets, weekly, as of Wednesday. It grows when the Fed buys bonds and shrinks as they run off.":
    "资产负债表为美联储的总资产，按周公布，截至每周三。美联储购债时扩张，所持债券到期缩减时收缩。",
  "Sources: the Federal Reserve and the New York Fed through FRED; the FOMC calendar from the Federal Reserve; odds from Kalshi.":
    "来源：美联储和纽约联储（经由 FRED）；FOMC 日程来自美联储；概率来自 Kalshi。",

  // Employment.
  "No employment figures have been read yet.": "尚未读取到就业数据。",
  "Payrolls, {month}": "{month}非农就业",
  "jobs added on the month · three-month average {avg}": "当月新增就业 · 三个月均值 {avg}",
  "{month} · Sahm rule {sahm} (a recession signal from 0.50)":
    "{month} · 萨姆规则 {sahm}（达到 0.50 即为衰退信号）",
  "Initial jobless claims": "初请失业金人数",
  "week to {date} · four-week average {avg} · continuing {cont}":
    "截至 {date}的一周 · 四周均值 {avg} · 续请 {cont}",
  "Next jobs report": "下次非农就业报告",
  "Kalshi: payrolls {pay}, unemployment {u}": "Kalshi：非农 {pay}，失业率 {u}",
  "Jobs added each month": "每月新增就业",
  "Payrolls, change on the month": "非农就业月度变动",
  "Three-month average": "三个月均值",
  "Nonfarm payrolls, thousands, seasonally adjusted. The latest two months are revised with each report.":
    "非农就业人数，单位千人，经季节调整。最近两个月的数据会随每次报告修正。",
  "The Sahm rule is the three-month average unemployment rate less its low of the past twelve months, in percentage points; every US recession since 1970 began with it at 0.50 or more. A gap is a month with no household survey.":
    "萨姆规则是失业率的三个月均值减去其过去十二个月的低点，以百分点计；1970 年以来美国每一次衰退开始时，该值都在 0.50 或以上。曲线中断表示该月没有家庭调查。",
  "Initial claims": "初请人数",
  "Four-week average": "四周均值",
  "Latest figures": "最新数据",
  Latest: "最新",
  Context: "说明",
  "Average hourly earnings": "平均时薪",
  "{month}, year on year · {mom} on the month": "{month}同比 · 环比 {mom}",
  "Job openings": "职位空缺",
  "{month} · {before} a year earlier": "{month} · 一年前 {before}",
  "Continuing claims": "续请失业金人数",
  "week to {date}": "截至 {date}的一周",
  Payrolls: "非农就业",
  "Payrolls and the unemployment rate come from the Bureau of Labor Statistics' monthly jobs report, usually the first Friday of the month: payrolls from a survey of employers, unemployment from a survey of households. Jobless claims are the Labor Department's weekly count of new filings for unemployment insurance, the most timely read on layoffs.":
    "非农就业和失业率来自美国劳工统计局（BLS）每月的非农就业报告，通常在每月第一个周五公布：非农就业来自对雇主的调查，失业率来自对家庭的调查。初请失业金人数是美国劳工部每周统计的新申领失业保险人数，是反映裁员最及时的指标。",
  "Job openings are from the JOLTS survey, a month behind the jobs report. Average hourly earnings are private employers' pay, a gauge of wage inflation.":
    "职位空缺来自 JOLTS 调查，比非农就业报告晚一个月。平均时薪是私营企业支付的薪资，用于衡量工资通胀。",
  "The odds are Kalshi's contracts on the next report's payrolls and unemployment rate; the middle estimate is where the chance of above crosses one half.":
    "概率来自 Kalshi 针对下一份报告非农就业和失业率的合约；中位预期是「高于」的概率跨过一半的位置。",
  "Sources: BLS and the Labor Department through FRED; odds from Kalshi.":
    "来源：BLS 和美国劳工部（经由 FRED）；概率来自 Kalshi。",

  // Growth.
  "No growth figures have been read yet.": "尚未读取到经济增长数据。",
  "Real GDP, {quarter}": "{quarter}实际 GDP",
  "on the quarter, annualized · recession probability {p}": "环比年化 · 衰退概率 {p}",
  "GDPNow, {quarter}": "{quarter} GDPNow",
  "the Atlanta Fed's running estimate of the quarter not yet published":
    "亚特兰大联储对尚未公布季度的实时估算",
  "Next GDP estimate": "下次 GDP 估算",
  "Kalshi: {value} for {quarter}": "Kalshi：{quarter} {value}",
  "Real GDP growth, annualized": "实际 GDP 增速（年化）",
  "Real GDP": "实际 GDP",
  "GDPNow estimate": "GDPNow 估算",
  "Quarter on quarter at an annual rate, as the Bureau of Economic Analysis publishes it; the latest figure is revised twice.":
    "环比年化，按美国经济分析局（BEA）公布的口径；最新数字之后还会修正两次。",
  "Activity, year on year": "经济活动同比",
  "Retail sales are in dollars, so they include price rises; industrial production is a volume index.":
    "零售销售以美元计，因此包含价格上涨；工业产出是实物量指数。",
  "Real GDP is the Bureau of Economic Analysis' measure of the economy's output after inflation, quarter on quarter at an annual rate. Each quarter is first estimated about a month after it ends and revised twice.":
    "实际 GDP 是美国经济分析局（BEA）对剔除通胀后经济产出的统计，以环比年化计。每个季度在结束约一个月后公布首次估算，之后修正两次。",
  "GDPNow is the Atlanta Fed's model estimate of the quarter not yet published, updated as each month's data come in; it is a model, not a forecast by the Fed.":
    "GDPNow 是亚特兰大联储对尚未公布季度的模型估算，随每月数据陆续公布而更新；它只是一个模型，并非美联储的预测。",
  "Industrial production (the Fed's index of factory, mining and utility output) and retail sales (the Census Bureau's) are monthly. The recession probability is the Chauvet and Piger model's, from four monthly indicators, as FRED publishes it.":
    "工业产出（美联储编制的制造业、采矿业和公用事业产出指数）和零售销售（美国人口普查局统计）均为月度数据。衰退概率来自 Chauvet-Piger 模型，基于四项月度指标，由 FRED 公布。",
  "The odds are Kalshi's contracts on the next GDP estimate.":
    "概率来自 Kalshi 针对下一次 GDP 估算的合约。",
  "Sources: BEA, the Federal Reserve, the Census Bureau and the Atlanta Fed through FRED; odds from Kalshi.":
    "来源：BEA、美联储、美国人口普查局和亚特兰大联储（经由 FRED）；概率来自 Kalshi。",

  // Policy signals.
  "No market signals have been read yet.": "尚未读取到市场信号数据。",
  "2-year yield less fed funds": "2 年期收益率减联邦基金利率",
  "2-year {two} above the effective rate: the market prices rates higher over two years":
    "2 年期 {two} 高于有效利率：市场定价未来两年利率走高",
  "2-year {two} below the effective rate: the market prices cuts over two years":
    "2 年期 {two} 低于有效利率：市场定价未来两年降息",
  "Yield curve, 10-year less 2-year": "收益率曲线（10 年期减 2 年期）",
  "10-year less 3-month {s} · below zero the curve is inverted":
    "10 年期减 3 个月期 {s} · 低于零即曲线倒挂",
  "10-year real yield": "10 年期实际收益率",
  "inflation-protected Treasury · nominal 10-year {ten}": "通胀保值国债 · 10 年期名义收益率 {ten}",
  "Net liquidity": "净流动性",
  "Fed assets less the Treasury's account and reverse repos": "美联储资产减财政部账户与逆回购",
  "{change} over four weeks · Fed assets less the Treasury's account and reverse repos":
    "四周变动 {change} · 美联储资产减财政部账户与逆回购",
  "Treasury yields": "美债收益率",
  "3-month": "3 个月期",
  "2-year": "2 年期",
  "10-year": "10 年期",
  "30-year": "30 年期",
  "Yield curve": "收益率曲线",
  "10-year less 2-year": "10 年期减 2 年期",
  "10-year less 3-month": "10 年期减 3 个月期",
  "An inverted curve, long yields below short ones, has come before every US recession since the 1970s, often by a year or more; the turn back above zero has often come closer to it.":
    "收益率曲线倒挂（长端收益率低于短端）出现在 1970 年代以来美国每一次衰退之前，往往提前一年或更久；而曲线重新回到零以上，往往离衰退更近。",
  "The Fed's total assets less the Treasury General Account and the overnight reverse repo facility: a rough count of the dollars the Fed's balance sheet leaves in the market, which many crypto traders watch against prices.":
    "美联储总资产减去财政部一般账户（TGA）和隔夜逆回购工具：粗略估算美联储资产负债表留在市场中的美元，许多加密货币交易者会拿它与价格对照。",
  "Other signals": "其他信号",
  "4 weeks": "4 周",
  "1 year": "1 年",
  Reading: "解读",
  "Dollar, broad index": "美元广义指数",
  "the Fed's trade-weighted dollar; a rising dollar tightens conditions worldwide":
    "美联储的贸易加权美元指数；美元走强会收紧全球金融条件",
  "Financial conditions (NFCI)": "金融条件（NFCI）",
  "below zero: looser than average": "低于零：比平均水平宽松",
  "above zero: tighter than average": "高于零：比平均水平紧",
  "Money supply (M2)": "货币供应量（M2）",
  "{month}, year on year": "{month}同比",
  "What the bond market says about policy before the Fed does. The 2-year Treasury yield tracks where traders expect the policy rate over the next two years: well above the effective rate, they expect it higher; well below, they expect cuts.":
    "债市先于美联储说出的政策信号。2 年期美债收益率反映交易者对未来两年政策利率的预期：明显高于有效利率，说明他们预期利率走高；明显低于，则说明他们预期降息。",
  "The yield curve is the 10-year yield less the 2-year, and less the 3-month bill. Real yields are inflation-protected Treasuries' (TIPS); a high real yield is a high cost of holding assets that pay nothing, crypto among them.":
    "收益率曲线为 10 年期收益率减 2 年期收益率，以及减 3 个月期国库券收益率。实际收益率是通胀保值国债（TIPS）的收益率；实际收益率高，意味着持有不产生收益的资产（包括加密货币）的成本高。",
  "Net liquidity is the Fed's balance sheet less the Treasury's cash at the Fed and the reverse repo facility, worked out here from the weekly figures; it is a rule of thumb, not an official measure. The NFCI is the Chicago Fed's index of financial conditions, zero at its long-run average.":
    "净流动性是美联储资产负债表减去财政部存放在美联储的现金和逆回购工具余额，由本站根据周度数据计算；这是经验指标，并非官方统计。NFCI 是芝加哥联储的金融条件指数，长期平均水平为零。",
  "Sources: Treasury yields, the Federal Reserve and the Chicago Fed through FRED.":
    "来源：美国财政部的国债收益率、美联储和芝加哥联储（经由 FRED）。",

  // Positioning and flows: the futures markets.
  "Bitcoin (CME)": "比特币（CME）",
  "Ether (CME)": "以太坊（CME）",
  "S&P 500 E-mini": "标普 500 E-mini",
  "Nasdaq-100 E-mini": "纳斯达克 100 E-mini",
  "Russell 2000 E-mini": "罗素 2000 E-mini",
  "VIX futures": "VIX 期货",
  "2-year Treasury note": "2 年期美国国债",
  "10-year Treasury note": "10 年期美国国债",
  "Treasury bond": "美国长期国债",
  "3-month SOFR": "3 个月期 SOFR",
  "30-day fed funds": "30 天期联邦基金",
  "US dollar index": "美元指数",
  Euro: "欧元",
  "Japanese yen": "日元",
  Gold: "黄金",
  Silver: "白银",
  "WTI crude oil": "WTI 原油",
  Copper: "铜",

  // Positioning and flows: the tables, tiles and charts.
  "Leveraged funds": "杠杆基金",
  "Asset managers": "资产管理机构",
  Dealers: "交易商",
  "Managed money": "管理基金",
  "Producers and merchants": "生产商与贸易商",
  "Swap dealers": "掉期交易商",
  "Financial futures: who holds them": "金融期货：谁在持有",
  "Commodity futures: who holds them": "商品期货：谁在持有",
  "{group}, net": "{group}净持仓",
  Week: "周变动",
  "Where this week's net sits among the last three years' weeks: 0% the shortest, 100% the longest":
    "本周净持仓在过去三年各周中的位置：0% 为最偏空，100% 为最偏多",
  "3-year rank": "3 年分位",
  "3 years": "3 年",
  "No positioning data has been read yet.": "尚未读取到持仓数据。",
  "contracts net, {share} of open interest · 3-year rank {rank} · {other} {otherNet}":
    "张合约净持仓，占持仓量 {share} · 3 年分位 {rank} · {other} {otherNet}",
  "Stablecoin supply": "稳定币供应量",
  "{d30} in 30 days · {d90} in 90 days": "30 天 {d30} · 90 天 {d90}",
  "CME Bitcoin, leveraged funds": "CME 比特币，杠杆基金",
  "asset managers": "资产管理机构",
  "CME Ether, leveraged funds": "CME 以太坊，杠杆基金",
  "Gold, managed money": "黄金，管理基金",
  producers: "生产商",
  "Who holds CME Bitcoin futures": "谁在持有 CME 比特币期货",
  "Net contracts (longs less shorts) of five bitcoin each, as of each Tuesday. Leveraged funds are hedge funds and trading firms; much of their short is the futures leg of a cash-and-carry trade against spot ETFs, not a bet on a fall.":
    "净持仓合约数（多头减空头），每张合约 5 枚比特币，截至每周二。杠杆基金指对冲基金和交易公司；其空头很大一部分是针对现货 ETF 的期现套利中的期货腿，而非押注下跌。",
  "Dollar stablecoins in circulation": "流通中的美元稳定币",
  "Every dollar-pegged stablecoin's supply, added up by DefiLlama: dollars already on-chain, the first money to reach crypto prices.":
    "所有锚定美元的稳定币供应量，由 DefiLlama 加总：已经在链上的美元，是最先作用于加密货币价格的资金。",
  "Who actually holds the futures, from the CFTC's weekly Commitments of Traders: positions as of Tuesday, published the Friday after. For financial futures the CFTC splits traders into dealers (the banks that make markets), asset managers (pension funds, insurers, mutual funds: slower, real money) and leveraged funds (hedge funds and trading firms: faster, speculative). For commodities it splits producers and merchants (hedgers), swap dealers and managed money (the speculators).":
    "期货究竟由谁持有，来自 CFTC 每周的持仓报告（COT）：持仓截至周二，于随后的周五公布。对金融期货，CFTC 将交易者分为交易商（做市的银行）、资产管理机构（养老基金、保险公司、共同基金：节奏较慢的长线资金）和杠杆基金（对冲基金和交易公司：节奏较快，偏投机）。对商品期货，则分为生产商与贸易商（套期保值者）、掉期交易商和管理基金（投机者）。",
  "Net is longs less shorts, in contracts; its share is of the market's open interest. The 3-year rank says where this week's net sits among every week of the last three years: near 0% the speculators are as short as they have been, near 100% as long, which is when positioning tends to unwind.":
    "净持仓为多头减空头，以合约张数计；其占比是相对该市场持仓量而言。3 年分位表示本周净持仓在过去三年每一周中的位置：接近 0% 说明投机者的空头已达这段时间的极值，接近 100% 说明多头已达极值，而这往往正是仓位开始松动、平仓离场的时候。",
  "Stablecoin supply is the dollars already on-chain, from DefiLlama: when it grows, new money is arriving in crypto.":
    "稳定币供应量是已经在链上的美元，数据来自 DefiLlama：供应量增长，说明有新资金正在流入加密市场。",
  "Sources: the CFTC's Commitments of Traders, futures only{date}; DefiLlama for stablecoins.":
    "来源：CFTC 持仓报告（仅期货{date}）；稳定币数据来自 DefiLlama。",
  ", report of {date}": "，报告日期 {date}",
  "The macro data could not be read right now.": "暂时无法读取宏观数据。",

  // Chart readout (slot-chart.ts).
  "week of {month} {day}, {year}": "{year}年{month}{day}日当周",
  // The Rates page's prediction-market tabs (web/crowd.ts).
  "1d": "1日",
  "1d change": "1日变化",
  "7d": "7日",
  "Another Fed hike in 2026": "2026 年美联储是否再加息",
  "BTC odds": "BTC 概率",
  "BTC: crowd vs options": "BTC：预测市场 vs 期权",
  "Bitcoin above, {when}": "比特币高于（{when}）",
  "Bitcoin now": "比特币现价",
  Chance: "概率",
  "Change in the expected move over the last day": "预期变动在过去一天的变化",
  "Deribit index at the option chain's read": "读取期权链时的 Deribit 指数",
  "Deribit's option chain: Black-76 with the smile's slope, between the expiries either side":
    "Deribit 期权链：含微笑斜率的 Black-76，在前后两个到期日之间插值",
  "Each FOMC meeting, both venues": "每次 FOMC 会议，两家平台",
  "Each price is the chance the venue's traders give the outcome, its Yes price; a fed meeting's outcomes are scaled to add up to one. Changes are in percentage points against the price a day and a week before. Polymarket is read every 15 minutes and kept hourly for good; Kalshi's odds are the Fed, Jobs and Growth tabs' own.":
    "每个价格是该平台交易者给出的结果概率，即其 Yes 价格；每次美联储会议的各结果按比例缩放至合计为一。变化以百分点表示，对比一天前和一周前的价格。Polymarket 每 15 分钟读取一次，并按小时永久保存；Kalshi 的概率与美联储、就业和增长标签页相同。",
  "Fed cuts in 2026": "2026 年美联储降息次数",
  "Fed rate at the end of 2026": "2026 年底联邦基金利率",
  "GDP growth, the quarter": "季度 GDP 增长",
  Gap: "差值",
  "How high US unemployment goes in 2026": "2026 年美国失业率最高到多少",
  "How high inflation gets in 2026": "2026 年通胀最高到多少",
  "How many Fed cuts in 2026": "2026 年美联储降息几次",
  "Kalshi median": "Kalshi 中位数",
  "Next settlement": "下次结算",
  "No Bitcoin ladder has been read yet. The collector reads Polymarket every 15 minutes.":
    "尚未读取比特币阶梯。采集器每 15 分钟读取一次 Polymarket。",
  "No prediction market has been read yet. The collector reads Polymarket every 15 minutes.":
    "尚未读取预测市场。采集器每 15 分钟读取一次 Polymarket。",
  "Percentage points over the last day": "过去一天的百分点变化",
  "Percentage points over the last week": "过去一周的百分点变化",
  "Polymarket less options, in percentage points": "Polymarket 减期权，单位为百分点",
  "Polymarket median": "Polymarket 中位数",
  "Polymarket's change over the last day, in percentage points":
    "Polymarket 过去一天的变化，单位为百分点",
  "Polymarket's ladders settle on Binance's BTC/USDT one-minute close at noon New York. The options column is what Deribit's latest BTC chain implies for the same price and moment: each strike's volatility from the smile, the chance of finishing above it with the smile's slope counted, the total variance read between the expiries either side. A positive gap means Polymarket's crowd gives the price better odds than the options do.":
    "Polymarket 的阶梯按纽约中午币安 BTC/USDT 一分钟收盘价结算。期权一栏是 Deribit 最新 BTC 期权链对同一价格和时刻的隐含概率：每个行权价的波动率取自微笑曲线，计入微笑斜率计算收于其上方的概率，总方差在前后两个到期日之间读取。差值为正表示 Polymarket 的人群给出的概率高于期权。",
  "Polymarket's median outcome": "Polymarket 的中位结果",
  "Prediction markets": "预测市场",
  Predictions: "预测",
  Print: "数据",
  Settles: "结算",
  "The Fed rate at the end of 2026": "2026 年底的联邦基金利率",
  "The next prints, both venues": "下一次数据公布，两家平台",
  "The outcome bucket where Polymarket's chances, in order, pass one half":
    "按顺序累计 Polymarket 概率超过一半时所在的结果区间",
  "The prediction markets could not be read right now.": "暂时无法读取预测市场。",
  "The year ahead, on Polymarket": "未来一年，Polymarket 上的预期",
  "US GDP growth in 2026": "2026 年美国 GDP 增长",
  "US recession": "美国衰退",
  "Where Kalshi's ladder of above-X chances crosses one half":
    "Kalshi 高于 X 概率阶梯越过一半的位置",
  "Widest gap": "最大差值",
  "above {price} on {date}: the crowd is {side} than the options":
    "{date} 高于 {price}：人群比期权{side}",
  bp: "基点",
  "by the end of each year": "截至每年年底",
  "crowd median {crowd} · options median {options}": "人群中位数 {crowd} · 期权中位数 {options}",
  "more bearish": "更看跌",
  "more bullish": "更看涨",
  "no option chain read yet": "尚未读取期权链",
  "noon New York": "纽约中午",
  "{change} pp over a week": "一周内 {change} 个百分点",
  "{n} more outcomes under 1%": "另有 {n} 个结果低于 1%",
};
