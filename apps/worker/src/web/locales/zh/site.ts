/**
 * Simplified Chinese for the site-wide pieces and the small pages: web/about.ts, web/legal.ts and
 * web/tos.ts (their notice only -- the bodies stay English), web/referral-links.ts, web/referral.ts,
 * web/install.ts, web/share.ts, web/await.ts and web/tabs.ts. Glossary and style: ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const site: Catalog = {
  // web/about.ts
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
  "{month} {day}, {year}": "{year}年{month}{day}日",
  project: "项目",
  commit: "提交",
  "not recorded": "未记录",
  "This build did not record its commit. Deployed builds stamp the commit they were built from here.":
    "此构建未记录其提交。已部署的构建会在这里标注其所基于的提交。",
  committed: "提交于",
  deployed: "部署于",
  "Release notes are written in English.": "更新说明仅提供英文版。",
  About: "关于",
  "What airrates is, which version is running, and what has changed recently.":
    "airrates 是什么、当前运行的版本，以及近期有哪些更新。",
  "About airrates": "关于 airrates",
  "airrates is a funding-rate screener for perpetual futures. It reads funding from each exchange's public API every minute and shows where holding the same asset long on one exchange and short on another collects the gap between their rates, and what that has actually paid.":
    "airrates 是一个永续合约资金费率筛选器。它每分钟从各交易所的公开 API 读取资金费率，展示在一家交易所做多、同时在另一家交易所做空同一资产时，能赚取两者费率之差的机会，以及这样的配对实际赚到了多少。",
  "This version": "当前版本",
  "Recent changes": "近期更新",

  // web/legal.ts, web/tos.ts
  "This page is available in English only. The English text is the binding version.":
    "本页仅提供英文版，以英文文本为准。",

  // web/referral-links.ts
  "<b>Disclosure.</b> airrates may earn a commission if you open an account through a link on this page, at no extra cost to you. Referral links never affect which markets appear or how they are ranked. A listing here is not a recommendation: check that an exchange serves where you live before signing up, and remember that perpetual futures are leveraged and can lose more than your margin. {link}":
    "<b>披露。</b>如果你通过本页的链接开设账户，airrates 可能获得佣金，你无需支付任何额外费用。邀请链接绝不会影响哪些市场被展示或如何排名。列于此处并不构成推荐：注册前请确认该交易所在你所在地区提供服务，并请记住永续合约带有杠杆，亏损可能超过你的保证金。{link}",
  "How referral links work": "邀请链接如何运作",
  "No referral links yet.": "暂无邀请链接。",
  "Referral links are not shown in your location.": "你所在的地区不显示邀请链接。",
  "None of these exchanges' referral links can be shown in your location.":
    "这些交易所的邀请链接均无法在你所在的地区显示。",
  "The link applies the referral itself": "该链接会自动应用邀请关系",
  Exchange: "交易所",
  Type: "类型",
  "Referral code": "邀请码",
  "Sign up": "注册",
  "{count} more exchange's link is not available in your location.":
    "另有 {count} 家交易所的链接在你所在的地区不可用。",
  "{count} more exchanges' links are not available in your location.":
    "另有 {count} 家交易所的链接在你所在的地区不可用。",
  "Referral links": "邀请链接",
  "Referral links for the exchanges airrates tracks, for readers opening a new account.":
    "airrates 所追踪交易所的邀请链接，供开设新账户的读者使用。",
  "The exchanges airrates has a referral link for. If you don't have an account on one yet, you can open it through the link.":
    "以下是 airrates 提供邀请链接的交易所。如果你还没有其中某家交易所的账户，可以通过链接开设。",

  // web/referral.ts
  "How this works": "了解详情",
  "Referral link: Code {code}. airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "邀请链接：邀请码 {code}。若你通过该链接注册，airrates 可能获得佣金，你无需支付任何费用。{how}",
  "Referral link: airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "邀请链接：若你通过该链接注册，airrates 可能获得佣金，你无需支付任何费用。{how}",
  "Open a {venue} account": "开设 {venue} 账户",

  // web/install.ts
  "Install the app": "安装应用",
  "Install airrates": "安装 airrates",
  "Opens in its own window, from your home screen.": "从主屏幕打开，在独立窗口中运行。",
  "Install app": "安装应用",
  "Not now": "暂不",

  // web/share.ts
  "Share the chart in view as an image sized for X": "将当前图表分享为适合 X 的图片",
  chart: "图表",
  "Quote this page's best line, with a link back to it": "引用本页最有价值的一句话，并附上回链",
  cite: "引用",
  "No chart on this view": "当前视图没有图表",
  close: "关闭",
  Copied: "已复制",
  "Select + copy": "请选中后复制",
  "Cite this page": "引用本页",
  "Pick the line · the page's own numbers, as they read now": "选择一句 · 本页当前显示的数字",
  "Your post · edit it freely": "你的帖子 · 可自由编辑",
  "Back-link · this exact page, venue and filters": "回链 · 指向此页面、交易所和筛选条件",
  Copy: "复制",
  "Post on X": "发布到 X",
  "Copy line + link": "复制文字和链接",
  "Quote the number, link back to where it was read. Funding moves every minute, so the line says when it was true: {stamp}. Not financial advice.":
    "引用数字，并链接回它的出处。资金费率每分钟都在变化，所以这句话注明了它成立的时间：{stamp}。不构成投资建议。",
  "{count} characters left with the link": "含链接还可输入 {count} 个字符",
  "+{count} more": "+{count} 项",
  "public venue APIs · not financial advice": "交易所公开 API · 不构成投资建议",
  "Share your line": "分享图表",
  "chart image": "图表图片",
  "Image · 1600 × 900, X's own 16:9 — shows uncropped in the timeline. Right-click or long-press to save.":
    "图片 · 1600 × 900，即 X 的 16:9 比例，在时间线中完整显示、不被裁切。右键或长按即可保存。",
  "Copy image": "复制图片",
  "Download PNG": "下载 PNG",
  "Link · this exact view": "链接 · 指向当前视图",
  "Copy the image, press Post on X, paste it into the post. The card carries the address it came from; the link opens the same view. We never call direction — the numbers are the venues', the call is yours.":
    "复制图片，点击“发布到 X”，然后粘贴到帖子中。图片上印有它的来源地址；链接会打开同一视图。我们从不预测方向——数字来自各交易所，判断由你自己做出。",
  "the image could not be drawn in this browser": "此浏览器无法绘制该图片",
  "Copy blocked — download instead": "复制被阻止——请改为下载",

  // web/await.ts
  "Building report": "正在生成报告",
  "Still building": "仍在生成",

  // web/tabs.ts
  Sections: "分区",

  // web/glossary.ts (and its entry in the footer menu and the shortcut map)
  terminology: "术语",
  Terminology: "术语",
  "Order flow": "订单流",
  "Aggressive buying minus aggressive selling.": "主动买入减去主动卖出。",
  "cumulative volume delta": "累计成交量 Delta",
  "Delta added up through the session.": "整个交易时段内 Delta 的累加。",
  'Shown on the <a href="/chart">Chart</a> page, spot and futures apart, summed across exchanges.':
    '见<a href="/chart">图表</a>页，现货与合约分开，汇总各交易所。',
  Imbalance: "失衡",
  "One side trading 3x or more the other at a price.":
    "在某一价位上，一方的成交量达到另一方的 3 倍或以上。",
  Absorption: "承接",
  "Heavy aggression, no progress.": "主动成交很重，价格却推不动。",
  'Read on the <a href="/liquidations#odds">Liquidations</a> page’s Odds tab, as initiative vs absorption.':
    '见<a href="/liquidations#odds">爆仓</a>页的概率标签，即主动成交与承接。',
  "Volume profile": "成交量分布",
  "volume point of control": "成交量控制点",
  "The price with the most volume.": "成交量最大的价格。",
  "Value area": "价值区",
  "Where 70% of the volume traded.": "70% 的成交量所在的价格区间。",
  "low-volume node": "低成交量节点",
  "A thin price the market moved through fast.": "成交稀薄、市场快速穿过的价格。",
  "Single prints": "单一印记",
  "A zone only one 30-minute period traded.": "只有一个 30 分钟时段成交过的区间。",
  // web/glossary.ts: the terms added 2026-11-10 beside the owner's first eight
  "Delta (order flow)": "Delta（订单流）",
  Initiative: "主动成交",
  "Aggression that moves price; the opposite of absorption.": "推动价格的主动成交；与承接相反。",
  "Taker flow": "吃单流",
  "The trades CVD is added up from, buys against sells.":
    "CVD 由这些成交累加而来：主动买入对主动卖出。",
  "Options and gamma": "期权与 Gamma",
  "gamma exposure": "Gamma 敞口",
  "How much dealers must buy or sell for each 1% move.":
    "价格每波动 1%，做市商需要买入或卖出多少。",
  'Shown on the <a href="/rates#gamma">Rates</a> page’s Gamma Exposure tab, and told as it moves by the market narrator at the top of every page.':
    '见<a href="/rates#gamma">费率</a>页的 Gamma 敞口标签；页面顶部的行情解说也会随其变动讲述。',
  "The price where dealers' net gamma changes sign.": "做市商净 Gamma 变号的价格。",
  'Marked on the <a href="/rates#gamma">Gamma Exposure</a> tab, and the line the market narrator reads every price against.':
    '标注在 <a href="/rates#gamma">Gamma 敞口</a>标签上，也是行情解说衡量每个价格的基准线。',
  "Long / short gamma": "正 / 负 Gamma",
  "Long: dealers' hedging sells rises and buys dips, damping moves. Short: it chases price, adding to moves.":
    "正 Gamma：做市商的对冲在上涨时卖出、下跌时买入，抑制波动。负 Gamma：对冲追随价格，放大波动。",
  'Shaded in the zones view of the <a href="/rates#gamma">Gamma Exposure</a> tab.':
    '在 <a href="/rates#gamma">Gamma 敞口</a>标签的区域视图中以阴影标出。',
  "The strike holding the most call or put gamma; it tends to cap or floor price.":
    "看涨或看跌 Gamma 最集中的行权价；往往压住或托住价格。",
  'Shown on the <a href="/rates#gamma">Gamma Exposure</a> tab and in every market narrator line.':
    '见 <a href="/rates#gamma">Gamma 敞口</a>标签，行情解说的每一条也会写出。',
  "Delta (options)": "Delta（期权）",
  "How much an option's price moves per point of the underlying.":
    "标的每变动 1 点，期权价格变动多少。",
  'By strike on the <a href="/rates#delta">Rates</a> page’s Delta tab.':
    '按行权价见<a href="/rates#delta">费率</a>页的 Delta 标签。',
  "How much an option's price moves per point of implied volatility.":
    "隐含波动率每变动 1 点，期权价格变动多少。",
  'By strike on the <a href="/rates#vega">Rates</a> page’s Vega tab.':
    '按行权价见<a href="/rates#vega">费率</a>页的 Vega 标签。',
  "What an option loses in value each day as expiry nears.": "临近到期时，期权每天损失的价值。",
  'By strike on the <a href="/rates#theta">Rates</a> page’s Theta tab.':
    '按行权价见<a href="/rates#theta">费率</a>页的 Theta 标签。',
  "implied volatility": "隐含波动率",
  "The size of move the option prices expect, per year.": "期权价格所预期的波动幅度，按年计。",
  'Drawn as walls on the <a href="/rates#ivwalls">Rates</a> page’s IV Walls tab.':
    '在<a href="/rates#ivwalls">费率</a>页的 IV 墙标签中画成墙。',
  "1σ move": "1σ 波幅",
  "The day's expected move from the options: one standard deviation either side.":
    "由期权推算的当日预期波幅：上下各一个标准差。",
  'The IV walls on the <a href="/rates#ivwalls">Rates</a> page, and the IV move on <a href="/whales">Whales</a>.':
    '见<a href="/rates#ivwalls">费率</a>页的 IV 墙，以及<a href="/whales">巨鲸挂单</a>页的 IV 波幅。',
  "The strike where option buyers lose the most at expiry.": "到期时期权买方损失最大的行权价。",
  'Marked on the <a href="/rates#levels">Rates</a> page’s Ceiling &amp; Floor tab.':
    '标注在<a href="/rates#levels">费率</a>页的天花板与地板标签上。',
  "Reaction zone": "反应区",
  "Where an IV wall and a gamma wall line up.": "IV 墙与 Gamma 墙重合之处。",
  'In full on the <a href="/rates#ivwalls">IV Walls</a> and <a href="/rates#levels">Ceiling &amp; Floor</a> tabs, folded on the other option tabs.':
    '在 <a href="/rates#ivwalls">IV 墙</a>和<a href="/rates#levels">天花板与地板</a>标签中完整显示，其他期权标签中折叠为一行。',
  "Funding and perps": "资金费率与永续合约",
  "Funding rate": "资金费率",
  "What longs pay shorts, or shorts pay longs, to keep a perp near spot.":
    "多头付给空头（或空头付给多头）的费用，让永续合约价格贴近现货。",
  'Every exchange side by side on the <a href="/rates">Rates</a> page.':
    '见<a href="/rates">费率</a>页，各交易所并排。',
  "annual percentage rate": "年化利率",
  "A funding rate scaled to a year, so different settlement intervals compare.":
    "换算成一年的资金费率，让不同结算周期可以比较。",
  'The unit the <a href="/screener">Screener</a> shows by default.':
    '<a href="/screener">筛选器</a>默认使用的单位。',
  "Settlement interval": "结算周期",
  "How often funding is paid: every 1, 4 or 8 hours.": "资金费率多久结算一次：每 1、4 或 8 小时。",
  'In each leg of a <a href="/screener">Screener</a> row.':
    '见<a href="/screener">筛选器</a>每行的各条腿。',
  "Funding spread / carry": "资金费率价差 / 套利",
  "Long where funding is cheap, short where it is rich, and collect the gap.":
    "在资金费率低的地方做多，高的地方做空，赚取差额。",
  'The pairs the <a href="/">home page</a> and the <a href="/screener">Screener</a> rank.':
    '<a href="/">首页</a>和<a href="/screener">筛选器</a>排名的配对。',
  "Contracts still open: money in the market, not traded volume.":
    "仍未平仓的合约：留在市场里的资金，而不是成交量。",
  'In each leg of a <a href="/screener">Screener</a> row, and per asset on the <a href="/chart">Chart</a> page.':
    '见<a href="/screener">筛选器</a>每行的各条腿，以及<a href="/chart">图表</a>页的各资产。',
  "A perp or future's price minus spot.": "永续或期货价格减去现货价格。",
  "Mark / index price": "标记价格 / 指数价格",
  "Mark is the price used for liquidations; index is the spot average it tracks.":
    "标记价格用于计算爆仓；指数价格是它所跟踪的现货均价。",
  'Each pair’s page, opened from a row on <a href="/arbitrage">Arbitrage</a>, charts the mark prices hourly.':
    '从<a href="/arbitrage">套利</a>页的一行打开的配对页面，按小时绘出标记价格。',
  "Taker / maker": "吃单 / 挂单",
  "A taker crosses the spread and pays the higher fee; a maker rests an order and waits.":
    "吃单方跨过买卖价差成交，付较高手续费；挂单方挂出订单等待成交。",
  'The <a href="/markets">Exchanges</a> page prices a $10k market order with each exchange’s taker fee.':
    '<a href="/markets">交易所</a>页按各交易所的吃单手续费，计算一笔 1 万美元市价单的成本。',
  "Liquidations and whales": "爆仓与巨鲸",
  Liquidation: "爆仓",
  "A position the exchange closes because its margin ran out.":
    "保证金耗尽、被交易所强制平掉的仓位。",
  'Every exchange’s, live, on the <a href="/liquidations">Liquidations</a> page.':
    '见<a href="/liquidations">爆仓</a>页，各交易所实时数据。',
  "Whale order": "巨鲸挂单",
  "A resting order big enough to show on the depth chart.": "大到能在深度图上显现的挂单。",
  'Binance walls and Hyperliquid whale orders on the <a href="/whales">Whales</a> page.':
    '见<a href="/whales">巨鲸挂单</a>页：Binance 的挂单墙与 Hyperliquid 的巨鲸订单。',
  "The site's terms in one line each: order flow, the volume profile, options and gamma, funding and perps, liquidations and whales.":
    "本站术语，每个一句话：订单流、成交量分布、期权与 Gamma、资金费率与永续合约、爆仓与巨鲸。",
  "The words the site uses, each in one line: order flow, the volume profile, options and gamma, funding, liquidations. Every term has its own link to share: /glossary#cvd opens this page at CVD.":
    "本站用到的术语，每个一句话：订单流、成交量分布、期权与 Gamma、资金费率、爆仓。每个术语都有可分享的链接：/glossary#cvd 会打开本页并定位到 CVD。",
};
