import type { Overview } from "../app/data";
import { BUILD, type BuildInfo } from "../build-info";
import { esc } from "./format";
import { layout } from "./layout";

const REPOSITORY = "https://github.com/belyjelli/ai-rates";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function day(date: string): string {
  const [year, month, dayOfMonth] = date.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(dayOfMonth)}, ${year}`;
}

function moment(iso: string | null): string {
  if (!iso) return "–";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "–";
  return `${day(at.toISOString().slice(0, 10))} ${at.toISOString().slice(11, 16)} UTC`;
}

function version(build: BuildInfo): string {
  if (!build.commit) {
    return `<div class="facts"><span>project <b>airrates</b></span><span>commit <b>not recorded</b></span></div>
<p class="notes">This build did not record its commit. Deployed builds stamp the commit they were built from here.</p>`;
  }
  const short = build.commit.slice(0, 7);
  return `<div class="facts"><span>project <b>airrates</b></span><span>commit <b><a href="${REPOSITORY}/commit/${esc(build.commit)}">${esc(short)}</a></b></span><span>committed <b>${moment(build.committedAt)}</b></span><span>deployed <b>${moment(build.builtAt)}</b></span></div>
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

  return layout({
    title: "About",
    description: "What airrates is, which version is running, and what has changed recently.",
    path: "/about",
    overview,
    now,
    body: `<h1>About airrates</h1>
<p class="lede">airrates is a funding-rate screener for perpetual futures. It reads funding from each exchange's public API every minute and shows where holding the same asset long on one exchange and short on another collects the gap between their rates, and what that has actually paid.</p>
<section>
<div class="section-head"><h2>This version</h2></div>
${version(build)}
</section>
<section>
<div class="section-head"><h2>Recent changes</h2></div>
<div class="about-log">${releases}</div>
</section>`,
  });
}
