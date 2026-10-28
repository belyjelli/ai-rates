import type { Overview } from "../app/data";
import { BUILD, type BuildInfo } from "../build-info";
import { esc } from "./format";
import { helpHeading } from "./help";
import { currentLocale, msg, tr, trMsg } from "./i18n";
import { installBlock } from "./install";
import { layout } from "./layout";

const REPOSITORY = "https://github.com/belyjelli/ai-rates";
/** English, as the changelog is; marked so the version stamp can show them in the reader's language. */
const MONTHS = [
  msg("Jan"),
  msg("Feb"),
  msg("Mar"),
  msg("Apr"),
  msg("May"),
  msg("Jun"),
  msg("Jul"),
  msg("Aug"),
  msg("Sep"),
  msg("Oct"),
  msg("Nov"),
  msg("Dec"),
];

export interface Release {
  /** UTC date the changes went live, YYYY-MM-DD. */
  date: string;
  title: string;
  changes: string[];
}

/**
 * What changed, written for someone using the site rather than for whoever wrote the code: one line
 * per change a reader would notice, newest first. Kept by hand because commit subjects are written
 * for developers ("Phase 4 Track B") and a CI checkout may hold only the newest commit anyway.
 *
 * Add an entry when a release changes what the site shows, and only once it is live: an entry for
 * work that is merged but not deployed would describe a site nobody can see.
 */
export const CHANGELOG: readonly Release[] = [
  {
    date: "2026-10-28",
    title: "Spot bitcoin ETF flows pinned on the chart",
    changes: [
      "The Chart page now pins each trading day's net flow into the US spot bitcoin ETFs on BTC's candles, at 4 pm New York, when the funds strike the NAV their creations and redemptions are priced at. An inflow sits under its candle pointing up, an outflow above pointing down, and a larger flow draws a larger pin. Hover or tap one for each fund's share.",
      "The figures come from each issuer's own daily files, read every hour and kept for good: IBIT, ARKB and EZBC back to their launch in January 2024; BITB, HODL and OBTC from today. A day's flow is the change in a fund's shares outstanding at that day's NAV. IBIT reports a day late, so its newest day fills in the next morning.",
      "Fidelity's FBTC, Grayscale's GBTC and its mini trust, and the Invesco, WisdomTree, Morgan Stanley and CoinShares funds are not counted yet: their issuers block automated reads. Each pin lists what it leaves out.",
    ],
  },
  {
    date: "2026-10-28",
    title: "Fund flow beside the chart's asset picker",
    changes: [
      "A Fund flow button beside the Chart page's asset picker opens two tables: spot fund (Binance's USDT spot book) and futures fund (the perpetuals on Binance, OKX, Gate and Bitget). Each has a row per window from 5 minutes to 30 days.",
      "The columns: inflow (taker buying) and outflow (taker selling) in dollars, net inflow, net inflow change against the window of the same length before it, and F/M cap ratio, the net as a share of the asset's market cap from CoinGecko.",
      "Windows run back from the newest 5-minute bucket every venue has published. A window longer than the history collected so far shows a dash rather than a short sum; the busiest hundred assets have futures flow back to mid-September, while the rest, and every spot book, started on 28 October with about a week, so their longer windows fill in over the coming weeks.",
    ],
  },
  {
    date: "2026-10-28",
    title: "A setup guide for MCP and AI agents",
    changes: [
      "New page, MCP and agents, in the footer menu: how to add airrates to Claude, Claude Code, Cursor, VS Code, Windsurf, Gemini CLI, Codex or any MCP client, with the config to copy for each. No key or sign-in is needed.",
      "It lists the server's tools, shows each request and answer with curl, and explains the A2A agent card and the agent index (/.well-known/ai-catalog.json and the files it points to) for agents that find the site by its domain.",
      "A GET on the MCP and A2A endpoints now answers 405, as the MCP spec asks, rather than a not-found page that some clients read as a broken server.",
    ],
  },
  {
    date: "2026-10-28",
    title: "CVD is now Chart, with spot and futures apart",
    changes: [
      "The CVD page is now Chart, at /chart. Old /cvd links, with an asset or settings in them, still land on the same chart.",
      "Under the price candles, CVD is split in two: futures (the perpetuals on Binance, OKX, Gate and Bitget, summed) and spot (Binance's USDT book), each in its own pane, since spot is often a tenth the size. Below them, a histogram of the delta: each bar's spot and futures net added together. Stocks, commodities and indices have no spot book on a crypto exchange and show futures only.",
      "Hovering a candle now opens a box beside the cursor with its open, high, low and close, the taker buys, sells and net for futures and spot, the delta and both CVD lines, instead of rewriting the line above the chart.",
      "The asset picker reaches about 500 assets, up from 100, plus every commodity, index and currency pair those exchanges list. Newly added assets start with about a week of history.",
    ],
  },
  {
    date: "2026-10-28",
    title: "Trading costs for 24 more exchanges",
    changes: [
      "The Exchanges page now grades 45 exchanges on what trading there costs, up from 21: spread, slippage at $10k and $100k, and depth, read from each exchange's public order book every ten minutes. New: Coinbase, BloFin, Nado, SoDEX, edgeX V2, Arcus, RiseX, TxFlow, Polymarket, ApeX, Ondo, Bullet, WOOFi Pro, Paradex, Phoenix, N1, Hibachi, Reya, Bluefin, Velocity, Perpl, Aevo, StandX and Lighter's Robinhood deployment. Their figures are medians of a few hours of books so far and settle over the week.",
      "Most of them now carry their published taker fee rather than the 5 bp assumption. Paradex is priced as its app users trade: its retail book, which includes orders only app takers can fill, and its 0 fee for them.",
      "TxFlow's public book shows 20 price levels a side, so its depth is what those levels hold. Exchanges that list none of the twelve majors measured (QFEX and the stock and commodity exchanges on Hyperliquid) and Variational, where one market maker quotes each trade and nothing rests, still have no figures.",
      "Quarantined exchanges stay ungraded: their books show walls no taker would meet, which would have made them look the cheapest anywhere.",
    ],
  },
  {
    date: "2026-10-27",
    title: "Option books for chip and memory stocks",
    changes: [
      "29 more option books from Cboe for the chip, memory and hardware names the perps trade most: SK hynix (its Nasdaq ADR, SKHY), Sandisk, Western Digital, Seagate, the Roundhill Memory ETF, AMD, Broadcom, TSMC, Intel, Marvell, Arm, Qualcomm, ASML, Applied Materials, Lam Research, KLA, Dell, Supermicro, Lumentum, Coherent, Applied Optoelectronics, Corning, and the SMH, SOXX, SOXL, SOXS, MUU, EWY and KORU funds. They show on Gamma Exposure, Delta, Vega, Theta, IV Walls and Ceiling & Floor, and in the GEX switch on the whales page.",
      "The book picker groups them, with NVIDIA and Micron, under Chips and memory. The SKHYNIX perps quote one Seoul share rather than the ADR, so they have no book; Samsung's options trade only on the Korea Exchange and are not read yet.",
      "Two more groups: Biotech and health (Eli Lilly, UnitedHealth, Moderna, Johnson & Johnson, AbbVie, Merck, Pfizer, Novo Nordisk, Intuitive Surgical, Amgen, Thermo Fisher, Regeneron, Gilead, Tempus AI, Vertex, AstraZeneca, Hims & Hers, Biogen, Viking, and the XLV, XBI and IBB funds), and Metals and mining (gold and silver themselves, Newmont, Barrick, Agnico Eagle, Wheaton, Kinross, First Majestic, Hecla, Pan American, Coeur, Freeport-McMoRan, BHP, Rio Tinto, Southern Copper, and for batteries Vale, Albemarle, MP Materials and USA Rare Earth, with the GDX, GDXJ, SIL, SILJ and COPX funds). Books with less than about $0.5B of open interest, the small lithium names among them, are left out.",
      "Liquidations: the asset choice on the Sides, Prices, Odds and Whales tabs is now a dropdown of every asset force-closed in the window rather than the dozen busiest, grouped into crypto, indexes, chips and memory, biotech and health, metals and mining (gold and silver themselves with the miners), other stocks, energy and other commodities, and FX. Each row gives the amount liquidated, the long/short split, the number of closes and how many exchanges they came from, and the list can be filtered by typing.",
    ],
  },
  {
    date: "2026-10-20",
    title: "Reaction zones on every option tab",
    changes: [
      "Gamma Exposure, Delta, Vega, Theta, IV Walls and Ceiling & Floor now open with the day's reaction zones: where an IV wall (1σ or the 90% wall) and a market maker's level (the gamma ceiling or floor, or the dealer break-even) fall within a quarter of the day's 1σ move of each other. The zones are shaded on each tab's chart and ladder.",
      "Above the chart, a rail lays every level around the spot on one price axis, and each side lists them nearest first with their distance in points and in the day's 1σ move, the options' own yardstick for every book. A line says the gamma regime: dealers long gamma sell rises and buy dips, which is what lets a wall hold; short gamma, their hedging chases price and walls give way more easily.",
      "A zone is a place to wait for a rejection, not a promise: the strip quotes the measured record (since 2021 a touch of BTC's 1σ wall closed back inside 53% of the time, of its 90% wall 61%) rather than nine in ten.",
      "Each book now keeps a record of its own zones: on every finished day, whether price reached a zone and closed back on its near side, next to the same count for its plain IV walls, so the claim that a lined-up wall holds more often can be checked as the days add up. The Ceiling & Floor tab shows it as a tile in place of the one that named what lined up.",
      "On Gamma Exposure, Delta, Vega and Theta the strip is now one line (the zone above, the zone below, the gamma regime) that opens into the full strip, so each tab's own chart comes first; IV Walls and Ceiling & Floor keep it in full.",
      "Delta, Vega and Theta now have the By expiry chart Gamma Exposure has, opening on the tab's own Greek drawn as its strike chart draws it, with open interest and the ATM IV term structure a switch away; the expiry tables show each expiry's share as a plain percentage on all four tabs.",
    ],
  },
  {
    date: "2026-10-20",
    title: "Delta, Vega and Theta tabs, and a By expiry chart on Gamma Exposure",
    changes: [
      "Three new Rates tabs after Gamma Exposure, for every option book the site reads: Delta, Vega and Theta, by strike and by expiry, with the same book picker and expiry ranges. They are Black-76 on each option's own open interest, implied volatility and forward, and reproduce Deribit's own greeks to within 0.03%.",
      "They are read from the side of whoever bought the options, so unlike gamma exposure nothing is assumed about who holds them: calls' delta is positive and puts' negative, every option's vega is positive and its theta negative, and the writers hold the opposite. Delta is the value of the underlying the open options move like, vega is per point of implied volatility, theta is per day, and the Theta tab adds the decay rate, the day's theta over what the options are worth.",
      "Gamma Exposure's By expiry table now has a chart over it: one bar per expiry, switching between open interest, gamma exposure (calls above zero, puts below) and the ATM IV term structure. Hover or tap an expiry for its open interest, put/call ratio, gamma, IV, max pain, dealer range and premium.",
    ],
  },
  {
    date: "2026-10-20",
    title: "Two new Rates tabs: IV Walls, and Ceiling & Floor",
    changes: [
      "IV Walls: for every option book, the day's IV wall (the reference close plus and minus one standard deviation of the options' implied volatility a day ahead) and the 90% wall, the distance price has stayed within on 90% of past days. It is measured where there is history: 1.97 standard deviations for BTC and 2.08 for ETH over 2,035 Deribit days against DVOL, and 1.74 for the S&P 500 over 1,111 sessions against Cboe's 1-day VIX; other books use the normal distribution's 1.645. The levels are fixed when the day begins and drawn as a price ladder with the day's range.",
      "The tab says how price has really behaved at the walls: since 2021, a touch of BTC's IV wall closed back inside 53% of 858 times, and a touch of its 90% wall 61% of 205 times. A wall is a probability, not a promise.",
      "Ceiling & Floor: two readings of where market makers stand for the nearest expiry, side by side. The gamma ceiling and floor are the strikes holding the most call gamma above the spot and put gamma below it. The dealer range reads every option as sold by dealers who keep the premium: max pain, and the break-evens either side where they start losing. Each is drawn with the IV walls, a level close to a wall is marked as lined up with it, and the dealer range is listed for each expiry.",
      "BTC, ETH and the US books keep a day-by-day record of what price did at every level, starting today; the Asian and European indexes, read from end-of-day files, show the next session's levels.",
      "Ceiling & Floor has a Day | Week switch. Week reads the same levels for the week's expiry (Deribit's Friday weekly, a US book's last expiry of the week): the gamma ceiling and floor of everything expiring by then, that expiry's dealer range and max pain, and IV walls over the time to it. The week's 90% wall is measured on whole past weeks: 2.07 standard deviations for BTC over 290 weeks, 2.16 for ETH, 1.33 for the S&P 500 over 824 weeks against Cboe's 9-day VIX. Each finished week joins the record.",
    ],
  },
  {
    date: "2026-10-20",
    title: "The expected move on the Gamma Exposure tab",
    changes: [
      "Under the gamma chart, every option book has an expected-move map: the spot at the centre and, for the next expiry and a day, a week and 30 days ahead, the at-the-money implied volatility, the move it prices in (one standard deviation is the price × IV × √(days/365)), and the walls one and two deviations either side of the spot.",
      "For BTC and ETH, each branch also says how often price really closed inside those walls since March 2021, from Deribit's 30-day volatility index: BTC stayed inside one deviation on 80% of days a day ahead, against 68% in theory, yet broke the two-deviation walls on 7.5% of 30-day windows, against 4.6%.",
      "The gamma chart draws the walls for the chosen expiries (30 days ahead for all of them), and the by-expiry table gives each expiry's at-the-money IV.",
      "On Whale orders, the GEX switch has a fifth view, IV move: the day-ahead one- and two-deviation ranges shaded across the candles, beside the flip and the call and put walls.",
    ],
  },
  {
    date: "2026-10-18",
    title: "Six exchanges quarantined, and TxFlow joins",
    changes: [
      "Toobit, WEEX, LBank, CoinW, Hotcoin and Pionex are quarantined. The weekly venue review found numbers on each that are not their own or could not be real: Toobit, WEEX and LBank show Binance's exact funding rate on 20% to 36% of the markets they share with it, and CoinW shows Hotcoin's on a third; WEEX and LBank publish no open interest at all; Hotcoin's open interest is over 1,200 times its reserves, and Pionex and Toobit trade 13 and 51 times their open interest in a day.",
      "A quarantined exchange is still collected and still shown, on its own page and on the Exchanges page, where it carries a Quarantined tag with the evidence. It is left out of the Screener and Arbitrage by default, and out of the home page's top spreads, so a copied rate can no longer pose as an opportunity. Tick it in the exchange picker to rank it anyway. The review checks each one again and lifts the quarantine once its numbers hold up.",
      "TxFlow joins with 235 USDC perpetuals: 131 crypto, 78 stocks (mostly American, with SK hynix, Samsung and SpaceX among them), 12 ETFs, 4 pre-IPO shares (OpenAI, Anthropic, Moonshot, Oura), gold, silver, platinum, palladium, copper, WTI and Brent oil, natural gas, and EUR/USD and USD/JPY. Funding is hourly. TxFlow publishes no funding history, so its markets show the live rate only, with no seven-day settled rate.",
    ],
  },
  {
    date: "2026-10-18",
    title: "Bitget is back, and about 450 markets join their real asset",
    changes: [
      "Bitget is collected again. It was dropped on 2026-09-27 after its hot wallets were drained and withdrawals stopped; withdrawals reopened between 09-28 and 10-02, its reserves have held at about $5.5B, and its volume, open interest and funding look like its own.",
      "About 450 markets now sit with the asset they really track. Gold, silver and oil that Hotcoin and Pionex list as crypto now pair with every other gold, silver and oil market, as do stock perps on SoDEX, Orderly, Reya, Lighter RH, LBank and CoinW, and the pre-IPO shares Variational lists as crypto. Each was checked against its asset's other markets: within 2% on price and moving with them over a week.",
      "Two tickers that named two different coins are split apart. Pearl (PRL on Hyperliquid's EntropyIO, Lighter, ApeX and Polymarket) is now PEARL, which brings Perle (PRL on Binance, Bybit, KuCoin and 15 more) back into pairing. Gensyn on OKX and MEXC is now GENSYN, apart from the AI token on Lighter, Aster and Aevo.",
      "OKX's ANTHROPIC contract is a tenth of a share, so it is now priced per share and pairs with the other Anthropic markets.",
    ],
  },
  {
    date: "2026-10-18",
    title: "Four new exchanges: Kraken, Bitunix, Kalshi and QFEX",
    changes: [
      "Kraken Futures joins with its 207 USD perpetuals, crypto plus a few stocks, metals, oil, EUR, GBP, CHF and the Nasdaq 100. Funding is hourly.",
      "Bitunix joins with 781 perpetuals, about 210 of them stocks, ETFs and pre-IPO shares and 8 commodities. Each market keeps its own 1, 4 or 8 hour funding. Bitunix publishes no open interest, so its markets show none.",
      "Kalshi's US perpetuals join: 28 markets regulated by the CFTC, crypto, gold, silver, platinum, palladium, copper, aluminium, WTI oil and Kalshi's own US 500 and US Tech 100. Kalshi's two indices trade at their own level (1.77x the S&P 500 and 1.25x the Nasdaq 100), so they are kept apart from the S&P 500 and Nasdaq pools.",
      "QFEX joins with 214 perpetuals and no crypto at all: US and Asian stocks, pre-IPO shares, country ETFs, metals, oil and the S&P 500 and Nasdaq 100. Funding is hourly and is zero outside each market's trading hours. Its markets priced in won, yen, yuan or krona are left out.",
      "Kraken, Bitunix and Kalshi's order books are measured for the Exchanges page grade. QFEX lists none of the coins the grade measures, and only Bitunix has reserves on DefiLlama.",
    ],
  },
  {
    date: "2026-10-17",
    title: "Exchange grades on four pillars: reserves, execution, activity, liquidity",
    changes: [
      "The Exchanges page's grade now follows DefiLlama's REAL score: Reserves 30 points, Execution 30, Activity 20 and Liquidity 20, each 0 to 100. A pillar the site cannot measure for an exchange hands its weight to the others rather than counting as zero. CEXes and DEXes are scored together and ranked within their own kind.",
      "Reserves are new, from DefiLlama, read every six hours: a CEX's wallets tracked on-chain, without its own token, and a DEX's protocol collateral. Two thirds of the pillar is size against the largest balance sheet; a third is whether the exchange's open interest, volume and displayed book are sizes those reserves could back. A new Reserves column sorts.",
      "Each grade opens its breakdown: the score, the exchange's place among its kind, and each pillar's bar with what it was built from. How each pillar is built is under the table; each exchange's own page shows its breakdown.",
      "Execution is still read from the order books, not fills: DefiLlama's markouts and fills-against-quote need trades, which the site does not record, so their weight goes to cost and slippage.",
    ],
  },
  {
    date: "2026-10-17",
    title: "Exchanges graded on what trading there costs",
    changes: [
      "The Exchanges page ranks every collected perpetual exchange with a grade from S to D, and shows what a $10k market order costs all in (the exchange's published standard taker fee plus slippage), what $10k and $100k orders pay beyond the mid, the spread, and the depth within 0.1% and 1% of the mid, beside open interest, volume and market count. Each column sorts.",
      "The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC) on 17 exchanges, as seven-day medians, each asset counted by its open interest across all exchanges. They are what the books promise, not fills. Walls too big to fill are clipped, and depth beyond a tenth of a market's open interest or 2% of an exchange's daily volume does not raise its grade.",
      "Each exchange's own page shows its grade and every asset's book: spread, slippage at $10k and $100k, depth, and how far its published book reaches.",
    ],
  },
  {
    date: "2026-10-17",
    title:
      "Macro on the Rates page: inflation, the Fed, jobs, growth, policy signals and positioning",
    changes: [
      "Six new tabs on the Rates page, after Gamma Exposure. Inflation: CPI and PCE, headline and core, on the month, annualized over three and six months and on the year, with the inflation the Treasury market prices in. Fed policy: the target range and the overnight rates, the next FOMC meeting, each meeting's odds from Kalshi and the rate path they imply, the committee's own projections and the balance sheet. Employment: payrolls, unemployment and the Sahm rule, jobless claims, job openings and wages. Growth: real GDP, the Atlanta Fed's GDPNow, industrial production and retail sales.",
      "Policy signals: the 2-year yield against fed funds, the yield curve, real yields, net liquidity (the Fed's balance sheet less the Treasury's account and reverse repos), the dollar, financial conditions and M2. Positioning and flows: who holds the futures, from the CFTC's weekly Commitments of Traders, for CME Bitcoin and Ether, the stock indexes, VIX, Treasuries, SOFR, fed funds, currencies, gold, silver, oil and copper, each ranked against its last three years; and the dollar stablecoins in circulation.",
      "Each tab says when the next release is due, in your own time zone, and what Kalshi's traders expect of it: the middle of their odds on the next CPI, payrolls, unemployment and GDP prints. The figures come from FRED (the BLS, BEA, Federal Reserve and Treasury series), the Federal Reserve's FOMC calendar, Kalshi, the CFTC and DefiLlama, read every hour (odds every 15 minutes).",
    ],
  },
  {
    date: "2026-10-17",
    title: "The site in Japanese, Korean and Russian",
    changes: [
      "Every page can be read in Japanese, Korean and Russian: switch with language: 日本語, 한국어 or Русский at the foot of the page. A first visit follows your browser's language. As with Chinese, the legal and status pages and this changelog stay in English, and the API is never translated.",
      "On a phone, the chart and cite buttons at the top show just their icons, so the market count beside them stays readable.",
    ],
  },
  {
    date: "2026-10-16",
    title: "Gamma for stocks and world indexes, BloFin's markets, and a CVD chart you can drag",
    changes: [
      "The Gamma Exposure tab covers 31 option books. Beside Deribit's BTC and ETH: US indexes, ETFs and stocks from Cboe, 15 minutes delayed (S&P 500, Nasdaq-100, Russell 2000, SPY, QQQ, IWM, gold, silver, oil, the bitcoin and ether ETFs, MSTR, COIN, NVDA, TSLA, MU); and index options from each exchange's end-of-day file in Hong Kong (Hang Seng, HSCEI, Hang Seng TECH), mainland China (CSI 300, SSE 50, CSI 1000), Taiwan (TAIEX), India (Nifty 50, Nifty Bank, Sensex) and Europe (Euro Stoxx 50, DAX, SMI). Each is shown in the currency its contract pays.",
      "The tab's book switch is a dropdown, grouped by region, that shows each book's net gamma, how its gamma splits between calls and puts, where its flip sits from the spot, and how old its figures are. Type to filter it by ticker, name, exchange or currency.",
      "BloFin is collected: its 509 perpetual markets now appear across the site, with their funding, prices and open interest. It had been listed since October 10, but every run had failed until now.",
      "The CVD chart is a trading chart: price candles, the CVD line on its own scale, and each bar's net flow below. Drag it to the left to look back through up to 35 days, zoom in and out, and new bars join the chart where you are reading.",
    ],
  },
  {
    date: "2026-10-15",
    title: "Gamma exposure, and times in your own zone",
    changes: [
      "The rates page has a Gamma Exposure tab for BTC and ETH options on Deribit: dealer gamma by strike over all expiries, 30 days, 7 days or the next expiry, with the flip level, the call and put walls, open interest and the put/call ratio. It assumes dealers are long calls and short puts, since no exchange publishes who holds which side, and says so under the chart.",
      "Times on the CVD, liquidations and whales pages are shown in your own time zone, or in UTC when the clock at the top is set to UTC. Funding times and option expiries stay in UTC.",
      "A CVD bar's readout gives its whole time range, labels the price as the bar's close, and names the market the price comes from.",
      "The whales chart draws candles at 5 minutes, 15 minutes, 1 hour or 4 hours, with a volume strip and a readout of each candle's open, high, low, close, volume and the large trades inside it.",
    ],
  },
  {
    date: "2026-10-14",
    title: "A whale map, your own clock, and a CVD crosshair",
    changes: [
      "The liquidations page has a Whale map tab: large positions held by named accounts on Hyperliquid, Lighter and dYdX, by the price at which each would be liquidated, longs below the price and shorts above. Hyperliquid and Lighter report those prices; dYdX's are worked out from each account's balance and positions. Each trader links to its exchange's explorer. Centralized exchanges publish no account's positions, so they are not in it.",
      "The clock at the top shows your own time. Click it to switch to UTC, the clock funding settles by; the choice is remembered.",
      "On the CVD page the asset list is a picker beside the intervals, with the search inside it, and its headings sort it.",
      "The CVD chart has a dashed crosshair that tags the price, CVD and net flow under the pointer. A cursor switch brings back the bar highlight.",
    ],
  },
  {
    date: "2026-10-12",
    title: "Whale tables in one panel",
    changes: [
      "On a desktop, the whales page's resting walls, ended walls and largest trades open as one panel beside the market picker, instead of running three screens down the page. Phones keep them in the page.",
    ],
  },
  {
    date: "2026-10-11",
    title: "A Telegram group",
    changes: [
      "Every page's footer links to the airrates community chat on Telegram, t.me/airratesnet.",
    ],
  },
  {
    date: "2026-10-10",
    title: "A whales page, and link previews",
    changes: [
      "A new whales page, /whales, draws large resting limit orders as lines over the price, for the 40 Binance markets with the most open interest worldwide and for Hyperliquid. Large trades are circles sized by value, blue for buying and red for selling, and tables list the walls resting now, the walls that ended (pulled or filled) and the largest trades. On Hyperliquid, whose book is rounded, a wall is a price range proven to hold a whale's order, and each large trade names the account that took it.",
      "A link to airrates shared on Facebook or X shows a picture card instead of bare text.",
    ],
  },
  {
    date: "2026-10-08",
    title: "Hyperliquid liquidations, and a keyboard map",
    changes: [
      "Hyperliquid's forced closes are on the liquidations page, for its 20 deepest markets. Hyperliquid publishes no liquidation feed of its own, so they are read from an independent index of its trades.",
      "Every keyboard shortcut is drawn on one page, /keys, as a Bloomberg terminal keyboard, and ? opens it. New keys: [ and ] for the previous and next tab, and Esc to leave a text field. Signed-in members can remap the keys.",
    ],
  },
  {
    date: "2026-10-07",
    title: "Arbitrage reads cleaner, and liquidation controls work in place",
    changes: [
      "The arbitrage table shows each side as its price, then the exchange, with a new Basis column: the sell price less the buy price, in the asset's own units. The Net, Ask size and Bid size columns are gone, and clicking anywhere on a row opens that asset's price page.",
      "The size each price gap is good for is locked for now: its column shows a padlock, and the arbitrage API no longer returns it or the two sides' sizes.",
      "On the liquidation map you can add up any combination of exchanges: each one in the strip switches on or off, and the grid sums the ones that are lit. The view with a separate panel per exchange is gone.",
      "Picking exchanges, an asset, Pending on or off, the zoom or a band width now reloads only that tab instead of the whole page. The address still changes, so Back and shared links work as before.",
      "The pending liquidations strip has a dollar scale along the bottom.",
    ],
  },
  {
    date: "2026-10-07",
    title: "CVD by interval, and pending liquidations",
    changes: [
      "The CVD page lets you pick the bar interval: 5 minutes, 15 minutes, 1 hour, 4 hours or 24 hours. 2 hours and 7 days are shown but not available yet. Switching the interval, or clicking an asset's row, redraws the chart in place.",
      "The Longs vs shorts chart can show modeled pending liquidations: how much of each side would be force-closed as the price moves through each band, estimated from open interest and leverage tiers rather than reported by exchanges. Pending off hides it, and Zoom out widens it from ±10% to half the price and double it.",
      "The liquidation tabs you have not opened load when you first show them, so the page opens faster. The Longs vs shorts and Price levels help explains what each time column covers.",
    ],
  },
  {
    date: "2026-10-07",
    title: "An Odds tab, and an API you can find",
    changes: [
      "The liquidations page has an Odds tab: for each time horizon, the chance the price reaches the heaviest forced-close level, or a move of a given size, estimated from the asset's own volatility. The theories about direction are listed with their current readings; none of them moves the odds yet.",
      "There is an API docs page at /docs with an OpenAPI description. Search engines and AI agents can now find and read the site: a sitemap, an API catalog, and pages served as Markdown to agents that ask for it.",
    ],
  },
  {
    date: "2026-10-06",
    title: "Chinese, and explanations behind a ?",
    changes: [
      "Every page can be read in Simplified Chinese: switch with language: English · 中文 at the foot of the page. A first visit follows your browser's language. The legal and status pages and this changelog stay in English, and the API is never translated.",
      "Each page's explanation moved out of the way, into a ? beside its title or section heading.",
      "On a phone, the rates grid and the liquidation map scroll in their own box with the header row and asset column kept in view. Longs vs shorts is one table, with the price column printed once.",
    ],
  },
  {
    date: "2026-10-06",
    title: "Install it as an app, and charts that share properly",
    changes: [
      "In Chrome, airrates can be installed as an app that opens in its own window, from your home screen or dock. On a phone the about page shows an install banner across the top; on a tablet or a computer it shows an Install app button above the title. Browsers that cannot install a site never show either.",
      "The chart button on the fear and greed page puts the score line on the shared image, titled with the reading and with the 0 to 100 scale beside it. The image was blank before. The backtest's equity curve now appears on its shared image too.",
      "On a phone, the screener and the exchange tables scroll in a box of their own, sideways and down, with the header row and the first column kept in view, instead of widening the whole page.",
    ],
  },
  {
    date: "2026-09-27",
    title: "BitMart and Bitget are no longer collected",
    changes: [
      "BitMart has been removed from the screener, rates, spreads and every other live view. Its hot wallets were drained in December 2021, and the site would rather not point readers at an exchange with that history. Its past funding stays in the database; it just stops updating.",
      "Bitget is removed on the same grounds: about $352M was drained from its hot and warm wallets on September 24, 2026, and withdrawals were suspended. The CVD page now sums taker flow from Binance, OKX and Gate.",
    ],
  },
  {
    date: "2026-09-15",
    title: "A headline that already paid, and results you can share",
    changes: [
      "The home page now opens on the best pair from last night's replay that someone could actually have held: at least $1M of open interest on its thinner leg, neither leg above 200% a year, a stable weaker leg and no missed settlements. It shows what the pair paid over the last 7 days and what is left after a retail round trip of fees. When no pair clears that bar, the widest live spread heads the page as before.",
      "Backtest results have a Share on X button that writes the post for you, with the result's own figure and whether fees are in it.",
      "Page views are counted by where they came from and which page they opened, without cookies and without storing addresses.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Renamed stocks and commodities join their markets",
    changes: [
      "Several exchanges list the same stock or commodity under a different ticker: WTIOIL for crude, BRENT, XNG for natural gas, SMSN for Samsung, and stock contracts with a STOCK suffix such as CATSTOCK for Caterpillar. They now join the markets they track, after checking each one's price against the rest, so they can pair.",
      "Toobit's crude oil contracts and LBank's sugar, cocoa, cotton, soybean and wheat are filed as commodities, and HTX's Nasdaq 100 as an index.",
      "Pacifica is collected, with its crypto, stock, commodity, currency and index markets.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Nado, RiseX, Polymarket, Backpack and Bluefin",
    changes: [
      "Five more exchanges are collected, together more than 280 markets, including Polymarket's perpetuals on stocks, commodities and indices.",
      "Each one's funding was read every minute up to a settlement and compared with what was actually charged. RiseX only updates its rate at settlement, so it is shown as settled.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Seven more exchanges, checked against a real settlement",
    changes: [
      "ApeX, GRVT, Hibachi, N1, Aevo, Phoenix and Perpl are collected. Aevo, Hibachi and Phoenix include stocks, commodities or currencies alongside crypto.",
      "Each rate was read every minute up to a funding settlement and compared with what the exchange actually charged, so a figure shown as a forecast is one, and a figure that only changes at settlement is marked as settled. Phoenix and Perpl are shown as settled for that reason.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Eight more exchanges",
    changes: [
      "SoDEX, Ondo, StandX, Toobit, CoinW, edgeX, Lighter's Robinhood Chain deployment and Velocity (formerly Drift) are collected, together more than 1,400 markets.",
      "Ondo, StandX and edgeX file their stocks, commodities and indices as such, and Lighter's Robinhood deployment keeps its own list, so those markets pair with the same assets elsewhere.",
      "CoinW's public data only gives each market's last settled rate, so its figures are marked as settled. Its markets appear over the first few minutes as each one is read.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Hotcoin and LBank",
    changes: [
      "LBank is collected, more than 800 perpetual markets with its live predicted funding.",
      "Hotcoin is collected too. Its public data only gives each market's last settled rate, so Hotcoin's figures are marked as settled rather than presented as a forecast. Its markets appear over the first few minutes as each one's funding interval is learned.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Bitget, BingX, BitMart, HTX, Pionex and WOOFi Pro",
    changes: [
      "Six more exchanges are collected: Bitget, BingX, BitMart, HTX and Pionex, and WOOFi Pro on the Orderly network. Together they add around 2,600 markets, including stocks, commodities, currencies and indices where the exchange lists them.",
      "HTX and BitMart do not publish a mark price in bulk, so their markets are checked against the exchange's own index price instead. A coin that only shares a ticker with another still cannot pose as a spread.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Extended, Reya, Arcus and Variational",
    changes: [
      "Four more exchanges are collected: Extended, with crypto, stocks, commodities, currencies and indices; Reya; Arcus, with crypto and stocks; and Variational, with more than 540 markets.",
      "Each rate is converted from the way the exchange quotes it, whether hourly, annualised or continuous, so every exchange's funding compares on the same yearly scale.",
      "Reya can pay shorts less than longs pay. The rate shown is what longs pay.",
    ],
  },
  {
    date: "2026-09-13",
    title: "WEEX and Bullet",
    changes: [
      "WEEX is collected, more than 1,000 perpetual markets across crypto, stocks, commodities, currencies and indices.",
      "Bullet is collected too, its crypto and tokenised stock, commodity and index markets, with open interest on every one.",
      "Both report funding the way the exchange itself settles it: WEEX's forecast rate, and Bullet's hourly rate taken from its eight-hour quote.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Pairs that settle in two different dollars",
    changes: [
      "About a quarter of spreads pair a leg settled in one stablecoin with a leg settled in another, such as USDT against USDC. Those pairs now name the currency on each leg, because holding them means collateral in both and exposure to the gap between the two.",
      "A new screener filter, Same quote currency on both legs, pairs each asset only within one settlement currency, keeping its best such pair.",
      "Every Hyperliquid and Lighter market now says what it settles in, so none of their pairs are left unknown.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Stocks and tokens no longer share a ticker",
    changes: [
      "Every market now carries what it tracks: crypto, a stock, a commodity, a currency or an index, as the exchange itself declares it. BB the BlackBerry stock and BB the BounceBit token are now two separate assets, each with its own page, spreads and pairs, where before one of them had to be hidden.",
      "Stocks, commodities, currencies and indices are tagged wherever they are listed, and their pages carry the class in the address, for example /markets/asset/equity/BB.",
      "Binance's stock, commodity and index perpetuals are collected too, about 190 more markets.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Binance, and a price check on every market",
    changes: [
      "Binance's perpetual markets are now collected, more than 570 of them, alongside every other exchange on the site.",
      "Every market's price is checked against the deepest market for the same asset. One that disagrees by more than 10% is kept out of the screener, and the Status page says why, so two different coins sharing a ticker can no longer pose as a spread.",
    ],
  },
  {
    date: "2026-09-13",
    title: "The pair page shows every exchange at once",
    changes: [
      "The pair page opens with a chart of every exchange's funding for the asset. The two legs you pick and their spread are drawn, any other exchange is a checkbox away, and hovering reads every line at the same moment.",
      "Each leg shows its rate now beside its average over the window, and the result lists its best day, worst day and largest drawdown.",
      "Backtests load straight away, with no verification step, over 1, 3, 7, 15, 30 or 60 days. Swap the legs in one click, or jump to the price gap between the two exchanges' order books.",
    ],
  },
  {
    date: "2026-09-13",
    title: "Price gaps and exchange health",
    changes: [
      "New Arbitrage and Price pair pages show where one exchange's bid sits above another's ask, for the exchanges that publish their order books, and how much size each gap is good for.",
      "A Status page shows which exchanges are delivering data and which have gone quiet.",
    ],
  },
  {
    date: "2026-09-12",
    title: "Live numbers",
    changes: [
      "Pages refresh on their own about every 30 seconds. A figure that changes flashes green when it rises and red when it falls, and rate markers slide to their new positions.",
      "The Rates grid shows 50 assets a page, and every page's header says how fresh the data is.",
    ],
  },
  {
    date: "2026-09-12",
    title: "Rates grid, stability and backtests",
    changes: [
      "The Rates grid compares every exchange's funding across the deepest assets, as it stands now or averaged over 7, 30 or 60 days.",
      "The screener sorts by spread, settled funding, number of exchanges, or stability: how reliably a pair's weaker leg keeps paying in the same direction.",
      "The home page ranks what pairs actually paid over the last week, with each pair's depth and risk beside the figure.",
      "Backtest any two exchanges for an asset, with your own trading fees and capital sized from each exchange's leverage limits.",
    ],
  },
];

/**
 * A changelog date. Always English: the release notes are kept in English only (owner's decision,
 * 2026-10-06), so the date heading each one stays in the same language as the entry beneath it.
 */
function day(date: string): string {
  const [year, month, dayOfMonth] = date.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(dayOfMonth)}, ${year}`;
}

/** The same date for the version stamp, which is the reader's and follows their language. */
function localDay(date: string): string {
  const [year = "", month, dayOfMonth] = date.split("-");
  return tr("{month} {day}, {year}", {
    month: trMsg(MONTHS[Number(month) - 1] ?? ""),
    day: Number(dayOfMonth),
    year,
  });
}

function moment(iso: string | null): string {
  if (!iso) return "–";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "–";
  return `${localDay(at.toISOString().slice(0, 10))} ${at.toISOString().slice(11, 16)} UTC`;
}

function version(build: BuildInfo): string {
  if (!build.commit) {
    return `<div class="facts"><span>${tr("project")} <b>airrates</b></span><span>${tr("commit")} <b>${tr("not recorded")}</b></span></div>
<p class="notes">${tr("This build did not record its commit. Deployed builds stamp the commit they were built from here.")}</p>`;
  }
  const short = build.commit.slice(0, 7);
  return `<div class="facts"><span>${tr("project")} <b>airrates</b></span><span>${tr("commit")} <b><a href="${REPOSITORY}/commit/${esc(build.commit)}">${esc(short)}</a></b></span><span>${tr("committed")} <b>${moment(build.committedAt)}</b></span><span>${tr("deployed")} <b>${moment(build.builtAt)}</b></span></div>
${build.subject ? `<p class="notes">${esc(build.subject)}</p>` : ""}`;
}

/**
 * The project's name, the commit it is running, and what has changed, for readers who arrive from
 * the footer. `build` is a parameter only so the stamped case can be tested; the route passes nothing.
 */
export function about(data: {
  overview: Overview;
  now: number;
  build?: BuildInfo;
  changelog?: readonly Release[];
}): string {
  const { overview, now, build = BUILD, changelog = CHANGELOG } = data;
  const releases = changelog
    .map(
      (release) => `<article class="release">
<p class="eyebrow">${day(release.date)}</p>
<h2>${esc(release.title)}</h2>
<ul>${release.changes.map((change) => `<li>${esc(change)}</li>`).join("")}</ul>
</article>`,
    )
    .join("");
  // The entries stay English in every language; a reader in another one is told so, and the log is
  // marked English for screen readers. An English page is unchanged.
  const english = currentLocale() === "en";
  const logNote = english
    ? ""
    : `<p class="notes">${tr("Release notes are written in English.")}</p>`;

  return layout({
    title: tr("About"),
    description: tr("What airrates is, which version is running, and what has changed recently."),
    path: "/about",
    overview,
    now,
    // The install offer sits on top of the title: a button on a tablet or wider, a banner on a phone.
    body: `${installBlock()}
${helpHeading("h1", tr("About airrates"), "about", `<p>${tr("airrates is a funding-rate screener for perpetual futures. It reads funding from each exchange's public API every minute and shows where holding the same asset long on one exchange and short on another collects the gap between their rates, and what that has actually paid.")}</p>`)}
<section>
<div class="section-head"><h2>${tr("This version")}</h2></div>
${version(build)}
</section>
<section>
<div class="section-head"><h2>${tr("Recent changes")}</h2></div>
${logNote}<div class="about-log"${english ? "" : ' lang="en"'}>${releases}</div>
</section>`,
  });
}
