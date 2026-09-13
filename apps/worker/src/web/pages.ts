import {
  type AssetClass,
  type BacktestResult,
  type IdentityVerdict,
  pairCapitalUsd,
  tierForSize,
} from "@ai-rates/core";
import { VENUES, type Venue } from "@ai-rates/venues";
import type {
  ArbitrageRow,
  ExchangeSummary,
  HeatmapCell,
  IdentityCheckRow,
  LeverageTierRow,
  MarketRow,
  Overview,
  PriceQuote,
  ScreenerFilters,
  ScreenerPair,
  ScreenerSort,
  VenueState,
  VenueStatus,
  VerifiedPair,
} from "../app/data";
// A value, not a type: the page and the JSON endpoint must classify a venue the same way, so the
// rule lives beside the type rather than being restated here.
import { venueState } from "../app/data";
import type {
  ArbitrageParams,
  BacktestParams,
  HeatmapParams,
  HeatmapTimeframe,
} from "../app/params";
import {
  arbitrageToQuery,
  BACKTEST_WINDOWS,
  backtestToQuery,
  DEFAULT_BACKTEST_DAYS,
  DEFAULT_FILTERS,
  filtersToQuery,
  HEATMAP_TIMEFRAMES,
  heatmapToQuery,
  MAX_TAKER_FEE_BPS,
  VENUE_TYPES,
} from "../app/params";
import {
  aprTone,
  esc,
  formatApr,
  formatGapBps,
  formatInterval,
  formatPrice,
  formatUsd,
  since,
  until,
} from "./format";
import { type FundingHistory, renderFundingChart } from "./funding-chart";
import { layout } from "./layout";
import { type RailScale, railPosition, railScale, renderRail } from "./rail";
import { VENUE_TYPE_LABEL, VENUE_TYPE_SHORT, venueName } from "./venues";

/**
 * An asset's address. Crypto is the unmarked default; every other class is part of the path, so BB
 * the stock and BB the token never share a page -- a class-less URL would merge BlackBerry's and
 * BounceBit's markets onto one table, the exact conflation migration 017 exists to end.
 */
const assetPath = (asset: string, assetClass: AssetClass) =>
  assetClass === "crypto"
    ? encodeURIComponent(asset)
    : `${assetClass}/${encodeURIComponent(asset)}`;
export const assetHref = (asset: string, assetClass: AssetClass) =>
  `/markets/asset/${assetPath(asset, assetClass)}`;
export const pairHref = (asset: string, assetClass: AssetClass) =>
  `/pair/${assetPath(asset, assetClass)}`;
export const priceHref = (asset: string, assetClass: AssetClass) =>
  `/price-pair/${assetPath(asset, assetClass)}`;
/** A row identity that keeps two same-named assets apart when a live refresh matches rows. */
const assetKey = (asset: string, assetClass: AssetClass) =>
  assetClass === "crypto" ? asset : `${assetClass}:${asset}`;
/**
 * The ticker, tagged with its class unless it is crypto. Tagging only the ~70 tradfi markets keeps
 * 5,900 crypto rows clean, and still tells the two BB rows apart wherever both appear.
 */
const assetName = (asset: string, assetClass: AssetClass) =>
  `${esc(asset)}${assetClass === "crypto" ? "" : ` <span class="cls">${assetClass}</span>`}`;
const assetTitle = (asset: string, assetClass: AssetClass) =>
  assetClass === "crypto" ? asset : `${asset} (${assetClass})`;
const exchangeHref = (venueId: string) => `/markets/exchange/${encodeURIComponent(venueId)}`;
const apr = (value: number | null) => `<span class="${aprTone(value)}">${formatApr(value)}</span>`;

/**
 * Momentum in APR points: the last 7 charging days against the days before them. A plain signed
 * figure rather than the signed-log the rails use, because the distribution is tight where it
 * matters — 978 markets sit under 1 point and 2,217 between 1 and 10 — so compressing it would
 * flatten exactly the near-zero distinctions a reader is looking for. The 217 markets beyond 100
 * points are shown as they are.
 *
 * Deliberately uncoloured. `aprTone` means "who pays" everywhere else on the site, and a market
 * fading from +200% to +150% has negative momentum while still paying shorts — tinting it blue
 * would invert that meaning. An arrow carries direction instead.
 */
const momentum = (points: number | null): string => {
  if (points === null) return '<span class="dim">–</span>';
  const rounded = Math.round(points * 10) / 10;
  if (rounded === 0) return '<span class="dim">flat</span>';
  return `<span class="dim">${rounded > 0 ? "↑" : "↓"}</span> ${Math.abs(rounded).toFixed(1)}`;
};

/** A stability score with its evidence: the bare number invites reading 0.69 on 6 days as settled. */
const stability = (score: number | null, days: number | null): string =>
  score === null
    ? '<span class="dim">–</span>'
    : `<span title="${days ?? 0} charging days in the last 30">${score.toFixed(2)}</span>`;

/**
 * Last night's replay of what each pair actually settled, ranked by realised funding.
 *
 * The ranking is UNGATED on purpose, so the disclosure is doing real work rather than decorating:
 * the leader can be a distressed listing whose thinner leg holds $0.28M and whose worse leg funds
 * at 305% APR. Every row therefore shows the thinner leg's depth, the worse leg's absolute APR and
 * the pair's stability, so a reader can see the danger beside the number instead of discovering it
 * after opening a position.
 *
 * Each row links to its OWN legs. `pairHref` alone would open whichever pair the asset page
 * picks by spread, which is often not the pair that earned this row.
 */
function verifiedTable(verified: VerifiedPair[]): string {
  if (verified.length === 0) {
    return `<div class="sheet-wrap"><p class="empty">No replay yet: the nightly run needs a week of settled funding on both legs of a pair.</p></div>`;
  }
  const rows = verified
    .map((v) => {
      const href = `${pairHref(v.asset, v.asset_class)}?long=${encodeURIComponent(v.long_venue_id)}&short=${encodeURIComponent(v.short_venue_id)}`;
      return `<tr data-k="${esc(`${assetKey(v.asset, v.asset_class)}|${v.long_venue_id}|${v.short_venue_id}`)}">
<td class="asset"><a href="${href}">${assetName(v.asset, v.asset_class)}</a></td>
<td class="num ${v.net_funding_usd >= 0 ? "longs-paid" : "shorts-paid"}">${money(v.net_funding_usd)}</td>
<td class="num">${formatApr(v.net_funding_apr_percent)}</td>
<td><div class="leg long-leg"><a class="venue" href="${exchangeHref(v.long_venue_id)}">${esc(venueName(v.long_venue_id))}</a><span class="meta">${esc(v.long_symbol)}</span></div></td>
<td><div class="leg short-leg"><a class="venue" href="${exchangeHref(v.short_venue_id)}">${esc(venueName(v.short_venue_id))}</a><span class="meta">${esc(v.short_symbol)}</span></div></td>
<td class="num">${Math.round(v.win_rate_days * 100)}%</td>
<td class="num" title="Open interest on the thinner of the two legs. A big figure earned on a shallow market is not a trade you can size into">${formatUsd(v.thinner_leg_oi_usd)}</td>
<td class="num" title="The more extreme leg's funding, absolute. Rates past a few hundred percent usually mean a delisting or a distressed listing rather than carry">${v.worst_leg_abs_apr === null ? '<span class="dim">–</span>' : formatApr(v.worst_leg_abs_apr)}</td>
<td class="num">${stability(v.pair_stability, Math.min(v.long_charge_days, v.short_charge_days))}</td>
</tr>`;
    })
    .join("");

  return `<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>Asset</th><th class="num" title="Funding both legs actually settled over the last 7 days, per $10,000 of notional on each leg">7d settled</th><th class="num">Annualized</th><th>Long leg</th><th>Short leg</th><th class="num" title="Days the pair was net positive, as a share of days that settled at all">Win rate</th><th class="num">Thinner leg OI</th><th class="num">Worst leg APR</th><th class="num" title="How often the weaker leg held its funding direction over 30 days">Stability</th></tr></thead>
<tbody data-live="verified">${rows}</tbody>
</table></div>`;
}

export function home(data: {
  overview: Overview;
  pairs: ScreenerPair[];
  verified: VerifiedPair[];
  now: number;
}): string {
  const [top] = data.pairs;
  const hero = top
    ? heroPair(top)
    : `<section class="hero" data-live="hero"><p class="eyebrow">Widest funding spread right now</p><p class="lede">No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.</p></section>`;
  const runDay = data.verified[0]?.run_day;

  return layout({
    title: "Funding spreads across perp exchanges",
    description:
      "Live funding rate spreads between perpetual futures exchanges, refreshed every minute.",
    path: "/",
    overview: data.overview,
    now: data.now,
    body: `${hero}
<section>
<div class="section-head"><h2>Widest spreads</h2><a href="/screener">Open the screener</a></div>
${pairsTable(data.pairs, "No pairs yet: an asset needs live markets on at least two venues.")}
</section>
<section>
<div class="section-head"><h2>What actually paid, last 7 days</h2>${runDay ? `<span class="dim">replayed ${esc(runDay.toISOString().slice(0, 10))}</span>` : ""}</div>
<p class="lede">Not a forecast: both legs replayed at their own settlement times from stored funding, on $10,000 per leg. Ranked by what settled, with nothing filtered out — so check the thinner leg's depth and the worse leg's rate before reading a big number as a trade.</p>
${verifiedTable(data.verified)}
</section>`,
  });
}

function heroPair(p: ScreenerPair): string {
  const long = venueName(p.long_venue_id);
  const short = venueName(p.short_venue_id);
  return `<section class="hero" data-live="hero">
<p class="eyebrow">Widest funding spread right now</p>
<div class="hero-head">
<a class="hero-asset" href="${assetHref(p.asset, p.asset_class)}">${assetName(p.asset, p.asset_class)}</a>
<p class="hero-spread"><b data-u="spread">${formatApr(p.spread_apr)}</b><span>funding spread, per year</span></p>
</div>
${renderRail({
  scale: railScale([p.long_apr, p.short_apr]),
  marks: [
    { apr: p.long_apr, tone: "long", label: `Long on ${long}`, key: "long" },
    { apr: p.short_apr, tone: "short", label: `Short on ${short}`, key: "short" },
  ],
  bar: [p.long_apr, p.short_apr],
  size: "big",
})}
<div class="legs">
<p class="long" data-u="long"><b>Long on <a href="${exchangeHref(p.long_venue_id)}">${esc(long)}</a></b> ${esc(p.long_symbol)} at <span data-u="long-apr">${formatApr(p.long_apr)}</span></p>
<p class="short" data-u="short"><b>Short on <a href="${exchangeHref(p.short_venue_id)}">${esc(short)}</a></b> ${esc(p.short_symbol)} at <span data-u="short-apr">${formatApr(p.short_apr)}</span></p>
</div>
<p class="lede">Holding equal size on both legs cancels the price exposure; the gap between the two funding rates is what the pair collects over a year, before trading fees and before either rate moves.</p>
</section>`;
}

export function screener(data: {
  overview: Overview;
  pairs: ScreenerPair[];
  filters: ScreenerFilters;
  now: number;
}): string {
  return layout({
    title: "Funding spread screener",
    description:
      "Filter live cross-exchange funding spreads by open interest, volume and exchange type.",
    path: "/screener",
    overview: data.overview,
    now: data.now,
    body: `<h1>Funding spread screener</h1>
<p class="lede">For each asset, the cheapest market to hold long and the richest to hold short, on different exchanges. Each leg must pass the filters.</p>
${filtersForm(data.filters)}
${pairsTable(data.pairs, "No pairs match these filters. Lower the minimum open interest or include more exchange types.", data.filters)}`,
  });
}

function filtersForm(f: ScreenerFilters): string {
  const select = (name: string, label: string, current: number, options: [number, string][]) =>
    `<label class="field">${label}<select name="${name}">${options
      .map(
        ([value, text]) =>
          `<option value="${value}"${value === current ? " selected" : ""}>${text}</option>`,
      )
      .join("")}</select></label>`;
  const types = VENUE_TYPES.map(
    (type) =>
      `<label><input type="checkbox" name="types" value="${type}"${!f.venueTypes || f.venueTypes.includes(type) ? " checked" : ""}> ${VENUE_TYPE_SHORT[type]}</label>`,
  ).join("");
  const venues = f.venueIds
    ? `<input type="hidden" name="venues" value="${esc(f.venueIds.join(","))}">`
    : "";

  return `<form class="filters" method="get" action="/screener">
${select("min_oi", "Min open interest, each leg", f.minOpenInterestUsd, [
  [0, "Any"],
  [100_000, "$100k"],
  [250_000, "$250k"],
  [1_000_000, "$1M"],
  [10_000_000, "$10M"],
  [50_000_000, "$50M"],
])}
${select("min_vol", "Min 24h volume, each leg", f.minVolume24hUsd, [
  [0, "Any"],
  [100_000, "$100k"],
  [1_000_000, "$1M"],
  [10_000_000, "$10M"],
])}
<fieldset class="field"><legend>Exchange types</legend><div class="checks">${types}</div></fieldset>
<fieldset class="field"><legend>Settlement</legend><div class="checks"><label title="A USDT leg against a USDC leg carries the basis between the two stablecoins and needs collateral in both. Ticked, each asset is paired only within one quote currency"><input type="checkbox" name="quote" value="same"${f.sameQuote ? " checked" : ""}> Same quote currency on both legs</label></div></fieldset>
<fieldset class="field"><legend>Distressed markets</legend><div class="checks"><label title="Delisting and distressed listings can pay beyond ±2000% APR and crowd out tradeable spreads"><input type="checkbox" name="extremes" value="1"${f.maxAbsApr === null ? " checked" : ""}> Include beyond ±1000% APR</label></div></fieldset>
${select("limit", "Rows", f.limit, [
  [50, "50"],
  [100, "100"],
  [250, "250"],
  [500, "500"],
])}
${venues}
<div class="actions"><button type="submit">Apply filters</button><a href="/screener">Reset</a></div>
</form>`;
}

const SORT_LABELS: Record<ScreenerSort, string> = {
  spread: "Spread",
  settled_7d: "7d settled",
  venues: "Venues",
  stability: "Stability",
};

/**
 * Stability is a bare ratio, not a rate: `formatApr` would render 0.854 as "+0.85%" and invite the
 * reader to mistake a persistence score for a funding figure. Two decimals, no sign, no unit.
 *
 * The scale runs 0.5–0.878 rather than 0–1, so it is deliberately NOT shown as a percentage: 0.5 is
 * the mathematical floor (dominant-sign cannot fall below half) and shrinkage caps a 31-day window
 * at 36/41. A reader expecting the best market to approach 1.00 would misread every row.
 */
const formatStability = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? '<span class="dim">–</span>' : value.toFixed(2);

/**
 * A sortable column header. Without filters — the homepage's twelve-row teaser — it stays plain
 * text: re-sorting a fixed top-twelve means nothing, and a link would navigate away from the page.
 */
function sortableTh(
  sort: ScreenerSort,
  title: string,
  filters: ScreenerFilters | undefined,
): string {
  const head = `<th class="num" title="${esc(title)}"`;
  if (!filters) return `${head}>${SORT_LABELS[sort]}</th>`;
  const active = filters.sort === sort;
  const href = `/screener${filtersToQuery({ ...filters, sort })}`;
  return `${head}${active ? ' aria-sort="descending"' : ""}><a href="${href}">${SORT_LABELS[sort]}</a></th>`;
}

/**
 * The day count travels with the score, because 0.69 over 6 charging days and 0.69 over 30 are not
 * the same claim and the count is the only thing separating them — the same reason the backtest page
 * states its own coverage instead of annualizing a hole silently. A pair with an unscored leg says
 * which leg, rather than leaving a bare dash to look like a rendering fault.
 */
function stabilityTitle(p: ScreenerPair): string {
  if (p.pair_stability === null) {
    const which =
      p.long_stability === null && p.short_stability === null
        ? "Neither leg has"
        : p.long_stability === null
          ? "The long leg has no"
          : "The short leg has no";
    return ` title="${esc(`${which} settled funding to score yet`)}"`;
  }
  const days = Math.min(
    p.long_stability_days ?? Number.POSITIVE_INFINITY,
    p.short_stability_days ?? Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(days)) return "";
  return ` title="${esc(`Weaker leg held its direction on ${days} of its charging days in the last 30`)}"`;
}

/**
 * Names a leg's settlement currency, but only when the two legs differ. Same-quote pairs stay quiet:
 * 76% of live pairs settle both legs in one currency and a label on every row would be noise.
 *
 * Migration 019 measured 166 of 678 live pairs mixing quotes, 59 of them USDT against USDC. A mixed
 * pair is not delta-neutral in dollars: it carries the basis between the two stablecoins and needs
 * collateral in both. An unknown quote is said plainly rather than guessed.
 */
function quoteMark(quote: string | null, otherQuote: string | null): string {
  if (quote === otherQuote) return "";
  const title =
    quote === null
      ? "This exchange does not say what the leg settles in, so it cannot be shown to match the other leg"
      : `Settles in ${quote} while the other leg settles in ${otherQuote ?? "an undeclared currency"}: the pair carries the basis between them`;
  return ` · <span class="qmix" title="${esc(title)}">${esc(quote ?? "quote ?")}</span>`;
}

function pairsTable(
  pairs: ScreenerPair[],
  emptyMessage: string,
  filters?: ScreenerFilters,
): string {
  if (pairs.length === 0)
    return `<div class="sheet-wrap"><p class="empty">${emptyMessage}</p></div>`;
  const scale = railScale(
    pairs.flatMap((p) => [p.long_apr, p.short_apr]),
    "log",
  );
  const leg = (
    side: "long" | "short",
    venueId: string,
    symbol: string,
    interval: number | null,
    oi: number | null,
    quote: string | null,
    otherQuote: string | null,
  ) =>
    `<td><div class="leg ${side}-leg"><a class="venue" href="${exchangeHref(venueId)}">${esc(venueName(venueId))}</a><span class="meta">${esc(symbol)} · ${formatInterval(interval)} · OI <span data-u="${side}-oi">${formatUsd(oi)}</span>${quoteMark(quote, otherQuote)}</span></div></td>`;

  const rows = pairs
    .map(
      (p) => `<tr data-k="${esc(assetKey(p.asset, p.asset_class))}">
<td class="asset"><a href="${assetHref(p.asset, p.asset_class)}">${assetName(p.asset, p.asset_class)}</a></td>
<td class="num spread">${formatApr(p.spread_apr)}</td>
<td class="rail-cell">${renderRail({
        scale,
        marks: [
          {
            apr: p.long_apr,
            tone: "long",
            label: `Long on ${venueName(p.long_venue_id)}`,
            key: "long",
          },
          {
            apr: p.short_apr,
            tone: "short",
            label: `Short on ${venueName(p.short_venue_id)}`,
            key: "short",
          },
        ],
        bar: [p.long_apr, p.short_apr],
      })}</td>
${leg("long", p.long_venue_id, p.long_symbol, p.long_interval_hours, p.long_open_interest_usd, p.long_quote, p.short_quote)}
<td class="num">${apr(p.long_apr)}</td>
${leg("short", p.short_venue_id, p.short_symbol, p.short_interval_hours, p.short_open_interest_usd, p.short_quote, p.long_quote)}
<td class="num">${apr(p.short_apr)}</td>
<td class="num">${p.spread_apr_7d === null ? '<span class="dim">–</span>' : formatApr(p.spread_apr_7d)}</td>
<td class="num dim">${p.venue_count}</td>
<td class="num"${stabilityTitle(p)}>${formatStability(p.pair_stability)}</td>
</tr>`,
    )
    .join("");

  // The screener's table runs to hundreds of rows, so its header sticks under the masthead; the
  // homepage's twelve-row teaser, the other caller, has nothing to stick through.
  return `<div class="sheet-wrap${filters ? " stick" : ""}"><table class="sheet">
<thead><tr><th>Asset</th>${sortableTh("spread", "Widest funding gap between two exchanges", filters)}<th title="Signed log scale, so ordinary rates keep room next to extreme ones">Long − short, log scale</th><th>Long leg</th><th class="num">Long APR</th><th>Short leg</th><th class="num">Short APR</th>${sortableTh("settled_7d", "Same two markets, averaged over the settlements of the last 7 days", filters)}${sortableTh("venues", "Exchanges with a live market for this asset", filters)}${sortableTh("stability", "How often the weaker leg held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score", filters)}</tr></thead>
<tbody data-live="pairs">${rows}</tbody>
</table></div>`;
}

export function exchanges(data: {
  overview: Overview;
  exchanges: ExchangeSummary[];
  now: number;
}): string {
  const live = new Set(data.exchanges.map((e) => e.id));
  const notCollected = VENUES.filter((v) => !live.has(v.id) && !v.aliasOf).map((v) => v.name);
  const rows = data.exchanges
    .map(
      (e) => `<tr data-k="${esc(e.id)}">
<td><a href="${exchangeHref(e.id)}">${esc(e.name)}</a></td>
<td class="dim">${VENUE_TYPE_SHORT[e.type] ?? esc(e.type)}</td>
<td class="num">${e.markets.toLocaleString("en-US")}</td>
<td class="num">${formatUsd(e.open_interest_usd)}</td>
<td class="num">${formatUsd(e.volume_24h_usd)}</td>
<td class="num dim">${since(e.updated_at, data.now)}</td>
</tr>`,
    )
    .join("");

  return layout({
    title: "Exchanges",
    description:
      "Perpetual futures exchanges tracked by airrates, with live market counts, open interest and volume.",
    path: "/markets",
    overview: data.overview,
    now: data.now,
    body: `<h1>Exchanges</h1>
<p class="lede">Every exchange with markets reported in the last five minutes. Open interest and volume are summed across its perpetual markets, where the exchange reports them.</p>
${
  data.exchanges.length === 0
    ? `<div class="sheet-wrap"><p class="empty">No exchange has reported in the last five minutes.</p></div>`
    : `<div class="sheet-wrap"><table class="sheet"><thead><tr><th>Exchange</th><th>Type</th><th class="num">Live markets</th><th class="num">Open interest</th><th class="num">24h volume</th><th class="num">Updated</th></tr></thead><tbody data-live="exchanges">${rows}</tbody></table></div>`
}
<p class="notes">Not collected yet: ${esc(notCollected.join(", "))}. Some block access from our data location or don't publish a usable funding API.</p>`,
  });
}

export function exchange(data: {
  venue: Venue;
  markets: MarketRow[];
  /** Required: the status line reads it, and leaving it out reported every venue as silent. */
  overview: Overview;
  now: number;
}): string {
  const { venue, markets, now } = data;
  const oi = markets.reduce((sum, m) => sum + (m.open_interest_usd ?? 0), 0);
  const scale = railScale(
    markets.map((m) => m.apr),
    "log",
  );
  const rows = markets
    .map(
      (m) => `<tr data-k="${esc(m.venue_symbol)}">
<td>${esc(m.venue_symbol)}</td>
<td class="asset"><a href="${assetHref(m.base, m.asset_class)}">${assetName(m.base, m.asset_class)}</a></td>
<td class="num">${apr(m.apr)}</td>
<td class="rail-cell">${renderRail({ scale, marks: [{ apr: m.apr, tone: m.apr >= 0 ? "short" : "long", label: m.venue_symbol }] })}</td>
<td class="num">${m.apr_7d === null ? '<span class="dim">–</span>' : apr(m.apr_7d)}</td>
<td class="num">${formatInterval(m.interval_hours)}</td>
<td class="num">${until(m.next_funding_at, now)}</td>
<td class="num">${formatPrice(m.mark_price)}</td>
<td class="num">${formatUsd(m.open_interest_usd)}</td>
<td class="num">${formatUsd(m.volume_24h_usd)}</td>
</tr>`,
    )
    .join("");

  return layout({
    title: `${venue.name} funding rates`,
    description: `Live funding rates, open interest and volume for every ${venue.name} perpetual market.`,
    path: exchangeHref(venue.id),
    overview: data.overview,
    now,
    body: `<p class="eyebrow"><a href="/markets">Exchanges</a> / ${esc(VENUE_TYPE_LABEL[venue.type] ?? venue.type)}</p>
<h1>${esc(venue.name)}</h1>
${
  markets.length === 0
    ? `<p class="lede">No live markets from ${esc(venue.name)}: it isn't collected yet, or its last update is more than five minutes old.</p>`
    : `<div class="facts" data-live="facts"><span><b data-u="markets">${markets.length.toLocaleString("en-US")}</b> live markets</span><span><b data-u="oi">${formatUsd(oi)}</b> open interest</span><span>updated <b>${since(markets[0]?.observed_at ?? null, now)}</b></span></div>
<div class="sheet-wrap stick"><table class="sheet"><thead><tr><th>Market</th><th>Asset</th><th class="num">Funding APR</th><th title="Signed log scale, so ordinary rates keep room next to extreme ones">Rate, log scale</th><th class="num">7d settled</th><th class="num">Interval</th><th class="num">Next funding</th><th class="num">Mark price</th><th class="num">Open interest</th><th class="num">24h volume</th></tr></thead><tbody data-live="markets">${rows}</tbody></table></div>`
}`,
  });
}

/**
 * Cheapest and richest markets for one asset on two different venues, considering only markets with at least
 * `minOpenInterestUsd` open interest (same rule as the screener). Null when no such pair exists.
 */
export function bestPair(
  markets: MarketRow[],
  minOpenInterestUsd = 0,
): { long: MarketRow; short: MarketRow } | null {
  const eligible =
    minOpenInterestUsd > 0
      ? markets.filter((m) => (m.open_interest_usd ?? 0) >= minOpenInterestUsd)
      : markets;
  let best: { long: MarketRow; short: MarketRow } | null = null;
  for (const long of eligible) {
    for (const short of eligible) {
      if (long.venue_id === short.venue_id) continue;
      if (!best || short.apr - long.apr > best.short.apr - best.long.apr) best = { long, short };
    }
  }
  return best;
}

/** Venues trading on another venue's book. `exchanges` already hides them, and so must the grid. */
const ALIASED_VENUES = new Set(VENUES.filter((v) => v.aliasOf).map((v) => v.id));

export interface HeatmapRow {
  base: string;
  assetClass: AssetClass;
  assetOiUsd: number | null;
  /** Keyed by venue id. A venue with no market for this asset is absent, never zero. */
  byVenue: Map<string, HeatmapCell>;
}

/**
 * Turns the flat cell list into rows by asset plus the ordered column list.
 *
 * Row order is the order the query returned, which is already ranked by asset depth; re-sorting
 * here would make the ranking answerable in two places. Columns are the venues actually present,
 * deepest first, so the leftmost ones are those most rows can fill — the grid is only ~38% full, so
 * column order is what stops it reading as scattered holes.
 */
export function pivot(cells: readonly HeatmapCell[]): {
  rows: HeatmapRow[];
  venueIds: string[];
} {
  const rows: HeatmapRow[] = [];
  const byBase = new Map<string, HeatmapRow>();
  const depth = new Map<string, number>();

  for (const cell of cells) {
    if (ALIASED_VENUES.has(cell.venue_id)) continue;
    // Keyed by asset, not base: equity BB and crypto BB are two rows, never one merged row.
    const key = assetKey(cell.base, cell.asset_class);
    let row = byBase.get(key);
    if (!row) {
      row = {
        base: cell.base,
        assetClass: cell.asset_class,
        assetOiUsd: cell.asset_oi_usd,
        byVenue: new Map(),
      };
      byBase.set(key, row);
      rows.push(row);
    }
    row.byVenue.set(cell.venue_id, cell);
    depth.set(cell.venue_id, (depth.get(cell.venue_id) ?? 0) + (cell.open_interest_usd ?? 0));
  }

  const venueIds = [...depth.entries()]
    .sort(([aId, aDepth], [bId, bDepth]) => bDepth - aDepth || aId.localeCompare(bId))
    .map(([id]) => id);
  return { rows, venueIds };
}

/** Which stored column each timeframe reads. A lookup, so no user string ever names a field. */
const HEATMAP_VALUE: Record<HeatmapTimeframe, (cell: HeatmapCell) => number | null> = {
  now: (cell) => cell.apr,
  "7d": (cell) => cell.apr_7d,
  "30d": (cell) => cell.apr_30d,
  "60d": (cell) => cell.apr_60d,
};

/**
 * Five steps either side of zero, taken from the same signed-log scale the spread rails use, so a
 * grid holding both +1200% and +4% stays readable instead of collapsing into one shade.
 */
function heatBucket(value: number, scale: RailScale): string {
  if (value === 0) return "hm-z";
  const distance = Math.abs(railPosition(value, scale).pct - 50) / 50;
  const step = Math.min(5, Math.max(1, Math.ceil(distance * 5)));
  return `${value > 0 ? "hm-p" : "hm-n"}${step}`;
}

export function heatmap(data: {
  overview: Overview;
  cells: HeatmapCell[];
  params: HeatmapParams;
  now: number;
}): string {
  const { overview, cells, params, now } = data;
  const { rows, venueIds } = pivot(cells);
  const cellValue = HEATMAP_VALUE[params.tf];

  // One scale for the whole grid, so a colour means the same thing in every column.
  const scale = railScale(
    rows.flatMap((row) => [...row.byVenue.values()].map(cellValue)),
    "log",
  );

  const link = (next: Partial<HeatmapParams>, label: string, enabled = true) =>
    enabled
      ? `<a href="/rates${heatmapToQuery({ ...params, ...next })}">${label}</a>`
      : `<span class="dim">${label}</span>`;

  // The chosen timeframe stays a link, marked the way the masthead nav marks its page, so the two
  // selections share one highlight.
  const strip = HEATMAP_TIMEFRAMES.map((tf) =>
    tf === params.tf
      ? `<a href="/rates${heatmapToQuery({ ...params, tf })}" aria-current="true">${tf}</a>`
      : link({ tf }, tf),
  ).join("");

  const header = `<tr><th class="asset">asset</th><th>open interest</th><th>spread</th>${venueIds
    .map((id) => `<th>${esc(venueName(id))}</th>`)
    .join("")}</tr>`;

  const body = rows
    .map((row) => {
      const values = venueIds.map((id) => {
        const cell = row.byVenue.get(id);
        return cell ? cellValue(cell) : null;
      });
      const present = values.filter((value): value is number => value !== null);

      // The row's own spread, free of a second query: cheapest venue to hold long against the
      // richest to hold short. It needs two venues to mean anything.
      const spread =
        present.length > 1
          ? (() => {
              const low = Math.min(...present);
              const high = Math.max(...present);
              const longId = venueIds[values.indexOf(low)] as string;
              const shortId = venueIds[values.indexOf(high)] as string;
              return `<a href="${pairHref(row.base, row.assetClass)}?long=${encodeURIComponent(longId)}&short=${encodeURIComponent(shortId)}">${formatApr(high - low)}</a>`;
            })()
          : `<span class="dim">–</span>`;

      // Each cell names its venue, so a refresh that reorders the columns still compares like with like.
      const grid = values
        .map((value, i) => {
          const column = esc(venueIds[i] as string);
          // An absent market is a dim dash with no colour: ~62% of the grid is empty, and a tinted
          // zero would read as "funding is flat here" instead of "there is nothing here".
          return value === null
            ? `<td class="none" data-c="${column}">–</td>`
            : `<td class="${heatBucket(value, scale)}" data-c="${column}">${formatApr(value)}</td>`;
        })
        .join("");

      return `<tr data-k="${esc(assetKey(row.base, row.assetClass))}"><td class="asset"><a href="${assetHref(row.base, row.assetClass)}">${assetName(row.base, row.assetClass)}</a></td><td class="dim">${formatUsd(row.assetOiUsd)}</td><td>${spread}</td>${grid}</tr>`;
    })
    .join("");

  const pager = `<div class="pager" data-live="pager">${link(
    { offset: Math.max(0, params.offset - params.limit) },
    "← previous",
    params.offset > 0,
  )}<span class="dim">assets ${params.offset + 1}–${params.offset + rows.length}</span>${link(
    { offset: params.offset + params.limit },
    "next →",
    rows.length >= params.limit,
  )}</div>`;

  const grid =
    rows.length === 0
      ? `<div class="sheet-wrap"><p class="empty">No asset has live markets on two or more venues right now.</p></div>`
      : `<div class="heat-wrap"><table class="heat"><thead data-live="rates-head">${header}</thead><tbody data-live="rates">${body}</tbody></table></div>${pager}`;

  return layout({
    title: "Rates",
    description: "Funding APR for every asset across every perpetual exchange, in one grid.",
    path: "/rates",
    overview,
    now,
    body: `<h1>Rates</h1>
<p class="lede">Every exchange's funding for the deepest assets at once. Positive means longs pay, so a short collects; an empty cell means that exchange has no market for the asset, not that funding is flat.</p>
<div class="tf">${strip}</div>
${grid}`,
  });
}

/**
 * Buy where the ask is lowest, sell where the bid is highest, on two different venues.
 *
 * Three disciplines carried over from what measuring this cost us:
 *
 * 1. **Depth sits beside every gap, never behind a click.** `ONE` once showed 269.6 bps against an
 *    OKX ask of two units and Gate's 220,004 — a quote, not a trade. The thinner side is its own
 *    column and the row is titled with both.
 * 2. **No rail, and no `aprTone`.** Those mean "who pays whom" on every other page; a price gap has
 *    no such polarity, and borrowing the colour would assert a direction that does not exist.
 * 3. **The widest gap has the thinnest book, and that is the finding.** Measured live across 721
 *    assets quoted on two or more venues: 395 show a positive gap at a median of 1.6 bps, but the
 *    leaders rest on almost nothing — 317 bps good for $568, 297 bps for $18, 106 bps for $3. So
 *    the table is ranked by gap, because that is the question it answers, with the depth beside it
 *    doing the same work the thinner-leg column does on the ungated verified ranking.
 */
export function arbitrage(data: {
  overview: Overview;
  rows: ArbitrageRow[];
  params: ArbitrageParams;
  now: number;
}): string {
  const { overview, rows, params, now } = data;

  const link = (next: Partial<ArbitrageParams>, label: string, enabled = true) =>
    enabled
      ? `<a href="/arbitrage${arbitrageToQuery({ ...params, ...next })}">${label}</a>`
      : `<span class="dim">${label}</span>`;

  const side = (
    kind: "buy" | "sell",
    venueId: string,
    symbol: string,
    price: number,
    depth: number | null,
  ) =>
    `<td><div class="leg ${kind}-leg"><a class="venue" href="${exchangeHref(venueId)}">${esc(venueName(venueId))}</a><span class="meta">${esc(symbol)} · <span data-u="${kind}-price">${formatPrice(price)}</span></span></div></td>
<td class="num"><span data-u="${kind}-depth">${formatUsd(depth)}</span></td>`;

  const body = rows
    .map((r) => {
      // The gap is only good for the smaller of the two sides, so that is what the row is titled
      // with. A null depth says so plainly instead of rendering as a zero.
      const title =
        r.thinner_depth_usd === null
          ? "One side's resting size is unknown, so the size this gap is good for cannot be stated"
          : `Good for about ${formatUsd(r.thinner_depth_usd)} at these quotes, before fees and before either book moves`;
      return `<tr data-k="${esc(assetKey(r.asset, r.asset_class))}">
<td class="asset"><a href="${priceHref(r.asset, r.asset_class)}">${assetName(r.asset, r.asset_class)}</a></td>
<td class="num spread" title="${esc(title)}"><span data-u="gap">${formatGapBps(r.gap_bps)}</span></td>
<td class="num" title="${esc(title)}">${formatUsd(r.thinner_depth_usd)}</td>
${side("buy", r.buy_venue_id, r.buy_symbol, r.buy_price, r.buy_depth_usd)}
${side("sell", r.sell_venue_id, r.sell_symbol, r.sell_price, r.sell_depth_usd)}
<td class="num dim">${r.venue_count}</td>
<td class="dim">${since(r.oldest_observed_at, now)}</td>
</tr>`;
    })
    .join("");

  const pager = `<div class="pager" data-live="arb-pager">${link(
    { offset: Math.max(0, params.offset - params.limit) },
    "← previous",
    params.offset > 0,
  )}<span class="dim">assets ${params.offset + 1}–${params.offset + rows.length}</span>${link(
    { offset: params.offset + params.limit },
    "next →",
    rows.length >= params.limit,
  )}</div>`;

  const table =
    rows.length === 0
      ? `<div class="sheet-wrap"><p class="empty">No asset quotes a gap this wide right now. The median comparable asset sits near 1.6 bps, so try a lower floor.</p></div>`
      : `<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>Asset</th><th class="num" title="Highest bid against lowest ask, across two different exchanges">Gap, bps</th><th class="num" title="The smaller of the two resting sizes: what the gap is actually good for">Good for</th><th>Buy at</th><th class="num">Ask size</th><th>Sell at</th><th class="num">Bid size</th><th class="num" title="Exchanges quoting this asset that survived the mark-agreement check">Venues</th><th>Quoted</th></tr></thead>
<tbody data-live="arb">${body}</tbody>
</table></div>${pager}`;

  return layout({
    title: "Price gaps across exchanges",
    description:
      "Where one exchange's bid sits above another's ask, with the size resting at each quote.",
    path: "/arbitrage",
    overview,
    now,
    body: `<h1>Price gaps</h1>
<p class="lede">For each asset, the cheapest exchange to buy and the dearest to sell, at the top of each book. These are <b>quotable gaps at the size shown</b>, not fillable trades: nothing here reflects the book below level 1, fees, or the two transfers a real position needs. The widest gaps sit on the thinnest books — when this was measured, 395 of 721 assets showed any gap at a median of 1.6 bps, while the leaders were good for as little as $3 of resting size. Read the <b>good for</b> column before the gap.</p>
${filtersForArbitrage(params)}
${table}`,
  });
}

/** Two floors, both of which default to showing more rather than less. */
function filtersForArbitrage(params: ArbitrageParams): string {
  const option = (value: number, label: string, current: number) =>
    `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`;
  return `<form class="filters" method="get" action="/arbitrage">
<label class="field">Min gap, bps<select name="min_bps">${[
    [0, "Any, including 0.0"],
    [1, "1"],
    [5, "5"],
    [25, "25"],
    [100, "100"],
  ]
    .map(([value, label]) => option(value as number, label as string, params.minGapBps))
    .join("")}</select></label>
<label class="field">Min resting size<select name="min_depth">${[
    [0, "Any"],
    [1_000, "$1k"],
    [10_000, "$10k"],
    [100_000, "$100k"],
  ]
    .map(([value, label]) => option(value as number, label as string, params.minDepthUsd))
    .join("")}</select></label>
<div class="actions"><button type="submit">Apply</button><a href="/arbitrage">Reset</a></div>
</form>`;
}

/**
 * One asset's top of book on every venue that quotes it.
 *
 * The list page must drop a mismatched instrument, or a 1375× disagreement tops the ranking with a
 * gap of 13,660,780 bps. This page does the opposite and shows it, dimmed, with how far out it is —
 * because "why is that exchange missing" is the question a detail page exists to answer, and a
 * silently shortened list teaches the reader nothing about why the guard exists.
 *
 * The best bid and best ask are marked, so the cross-venue gap reads as a relationship between two
 * rows rather than a number asserted at the top of the page.
 */
export function pricePair(data: {
  asset: string;
  /** The class the quotes were read for, so the page's own address and heading carry it. */
  assetClass: AssetClass;
  quotes: PriceQuote[];
  overview: Overview;
  now: number;
}): string {
  const { asset: name, assetClass, quotes, now } = data;
  const agreeing = quotes.filter((q) => q.mark_agrees);
  const rejected = quotes.filter((q) => !q.mark_agrees);

  // Only among venues that survive the guard: the whole point is that a mismatch must not set the
  // price. Computed here rather than in SQL because the page already holds every row.
  const lowestAsk = agreeing.reduce<PriceQuote | null>(
    (best, q) => (best === null || q.best_ask < best.best_ask ? q : best),
    null,
  );
  const highestBid = agreeing.reduce<PriceQuote | null>(
    (best, q) => (best === null || q.best_bid > best.best_bid ? q : best),
    null,
  );
  const crossVenue =
    lowestAsk && highestBid && lowestAsk.venue_id !== highestBid.venue_id
      ? ((highestBid.best_bid - lowestAsk.best_ask) / lowestAsk.best_ask) * 10000
      : null;
  const goodFor =
    lowestAsk?.best_ask_size_usd == null || highestBid?.best_bid_size_usd == null
      ? null
      : Math.min(lowestAsk.best_ask_size_usd, highestBid.best_bid_size_usd);

  const row = (q: PriceQuote) => {
    const inVenueBps = ((q.best_ask - q.best_bid) / q.best_bid) * 10000;
    const off =
      q.mark_agrees || q.anchor_mark === null || q.mark_price === null || q.anchor_mark === 0
        ? null
        : q.mark_price / q.anchor_mark;
    const why =
      off === null
        ? "This venue's mark disagrees with the rest, so it is excluded from the gap"
        : `Marked ${off >= 1 ? off.toFixed(1) : (1 / off).toFixed(1)}× ${off >= 1 ? "above" : "below"} this asset's deepest market, so it is a different instrument, not a price gap`;
    return `<tr data-k="${esc(`${q.venue_id}|${q.venue_symbol}`)}"${q.mark_agrees ? "" : ` class="dim" title="${esc(why)}"`}>
<td><div class="leg${q === lowestAsk ? " buy-leg" : q === highestBid ? " sell-leg" : ""}"><a class="venue" href="${exchangeHref(q.venue_id)}">${esc(venueName(q.venue_id))}</a><span class="meta">${esc(q.venue_symbol)}</span></div></td>
<td class="num"><span data-u="bid">${formatPrice(q.best_bid)}</span>${q === highestBid ? ' <span class="dim">best</span>' : ""}</td>
<td class="num">${formatUsd(q.best_bid_size_usd)}</td>
<td class="num"><span data-u="ask">${formatPrice(q.best_ask)}</span>${q === lowestAsk ? ' <span class="dim">best</span>' : ""}</td>
<td class="num">${formatUsd(q.best_ask_size_usd)}</td>
<td class="num" title="This venue's own bid-ask spread, which a taker crosses on entry and again on exit">${formatGapBps(inVenueBps)}</td>
<td class="num">${formatPrice(q.mark_price)}</td>
<td class="dim">${since(q.observed_at, now)}</td>
</tr>`;
  };

  /**
   * Every direction, not just the best one.
   *
   * Naming a single pair hides the tradeable one. Sampling production for a minute showed the gaps
   * holding their magnitude while the depth behind them moved by an order of magnitude — MTL's
   * tradeable size went $243 → $2,085 → $264 — so the widest quote is routinely not the one worth
   * taking. Rejected venues never appear here: a mismatched instrument must not set a price in any
   * direction.
   */
  const pairs = agreeing
    .flatMap((buy) =>
      agreeing
        .filter((sell) => sell.venue_id !== buy.venue_id)
        .map((sell) => ({
          buy,
          sell,
          gapBps: ((sell.best_bid - buy.best_ask) / buy.best_ask) * 10000,
          // Math.min(null, 500) is 0, not null — the same skip-a-null trap as SQL's least(), in a
          // different language. An unknown side has to stay unknown.
          goodForUsd:
            buy.best_ask_size_usd === null || sell.best_bid_size_usd === null
              ? null
              : Math.min(buy.best_ask_size_usd, sell.best_bid_size_usd),
        })),
    )
    .sort((a, b) => b.gapBps - a.gapBps);

  const pairsTable =
    pairs.length === 0
      ? ""
      : `<div class="section-head"><h2>Every pair</h2></div>
<p class="lede">One row per direction: buy at the first exchange, sell at the second. The widest gap is often not the one to take — a narrower pair can rest far more size behind it, and most directions lose outright.</p>
<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>Buy at</th><th>Sell at</th><th class="num">Gap, bps</th><th class="num" title="The smaller of the buying side's ask size and the selling side's bid size — what this direction is good for">Good for</th></tr></thead>
<tbody data-live="pp-pairs">${pairs
          .map(
            (p) => `<tr data-k="${esc(`pair:${p.buy.venue_id}|${p.sell.venue_id}`)}"${
              p.gapBps > 0 ? "" : ' class="dim"'
            }>
<td><div class="leg buy-leg"><a class="venue" href="${exchangeHref(p.buy.venue_id)}">${esc(venueName(p.buy.venue_id))}</a></div></td>
<td><div class="leg sell-leg"><a class="venue" href="${exchangeHref(p.sell.venue_id)}">${esc(venueName(p.sell.venue_id))}</a></div></td>
<td class="num spread"><span data-u="pair-gap">${formatGapBps(p.gapBps)}</span>${p.buy === lowestAsk && p.sell === highestBid ? ' <span class="dim">best</span>' : ""}</td>
<td class="num"><span data-u="pair-depth">${formatUsd(p.goodForUsd)}</span></td>
</tr>`,
          )
          .join("")}</tbody>
</table></div>`;

  const headline =
    crossVenue === null
      ? `<p class="lede" data-live="pp-lede">No two exchanges quote ${esc(name)} in a way that can be compared right now.</p>`
      : `<p class="lede" data-live="pp-lede">Buying on <b>${esc(venueName((lowestAsk as PriceQuote).venue_id))}</b> and selling on <b>${esc(venueName((highestBid as PriceQuote).venue_id))}</b> quotes <b data-u="pp-gap">${formatGapBps(crossVenue)} bps</b>${goodFor === null ? ", though one side's resting size is unknown" : `, good for about <b>${formatUsd(goodFor)}</b>`}. That is a quote at the size shown, not a fillable trade: it is before fees, before the book below level 1, and before the transfer between two exchanges.</p>`;

  const excluded =
    rejected.length === 0
      ? ""
      : `<p class="notes">${rejected.length} ${rejected.length === 1 ? "venue is" : "venues are"} shown dimmed and left out of the gap: ${rejected
          .map((q) => esc(venueName(q.venue_id)))
          .join(
            ", ",
          )}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. <a href="/status">Status</a> names the reason for each one.</p>`;

  return layout({
    title: `${assetTitle(name, assetClass)} price gaps by exchange`,
    description: `${name} best bid and ask on every exchange that quotes it, with the size resting at each.`,
    path: priceHref(name, assetClass),
    overview: data.overview,
    now,
    body: `<p class="eyebrow"><a href="/arbitrage">Price gaps</a></p>
<h1>${assetName(name, assetClass)}</h1>
${headline}
${pairsTable}
<div class="section-head"><h2>Every exchange</h2></div>
<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>Exchange</th><th class="num">Best bid</th><th class="num">Bid size</th><th class="num">Best ask</th><th class="num">Ask size</th><th class="num" title="The venue's own bid-ask spread in basis points">Own spread</th><th class="num">Mark</th><th>Quoted</th></tr></thead>
<tbody data-live="pp-quotes">${quotes.map(row).join("")}</tbody>
</table></div>
${excluded}
<p class="notes">Sizes are the money resting at the very top of each book, converted to USD because the three venues that publish depth count it differently — Gate in contracts, OKX in contracts against <code>ctVal</code>, Bybit in base coin. Reading those raw, side by side, is a 10,000× error.</p>`,
  });
}

/** Problems first. A page nobody reads when things are fine must lead with what is not. */
/**
 * Verdicts worst-first. `mismatch` leads because it means two different assets are sharing one
 * ticker, which silently corrupts every pair built on them; `unverified` trails because a market
 * too thin to judge is not an accusation.
 */
const VERDICT_ORDER: IdentityVerdict[] = ["mismatch", "scale", "tracks", "unverified"];

const VERDICT_TITLE: Record<IdentityVerdict, string> = {
  mismatch:
    "Does not track the pool's deepest market: a different asset under the same ticker, or a bad alias. Never pair it",
  scale:
    "Tracks the deepest market at a clean power of ten, so it is the same asset quoted per contract rather than per unit",
  tracks:
    "Tracks the deepest market, but at a constant that is not a contract scale. Needs a human",
  unverified:
    "Too little shared movement to judge either way, which usually means a market whose mark barely moves rather than a fault",
};

/** These ratios span nine orders of magnitude, so the extremes go exponential rather than to zeros. */
function formatPriceRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "–";
  return ratio >= 1000 || ratio < 0.001 ? `${ratio.toExponential(1)}×` : `${ratio.toFixed(3)}×`;
}

const STATE_ORDER: VenueState[] = ["failing", "stale", "silent", "empty", "live", "planned"];

const STATE_TITLE: Record<VenueState, string> = {
  failing: "The most recent run returned an error",
  stale: "Running, but nothing has updated in the last five minutes",
  silent: "Ran at some point in the last 30 days, but not in the last 24 hours",
  planned: "Catalogued, but the collector has never run it: no adapter yet",
  empty: "Running cleanly and returning no markets at all",
  live: "Running, and its markets are current",
};

/** "18.3s" reads; "18271ms" does not. Sub-second stays in milliseconds, where the detail matters. */
const duration = (ms: number | null): string =>
  ms === null ? "–" : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

/**
 * Whether each exchange is actually delivering data.
 *
 * Deliberately not a dump of `collector_runs`. The table has six columns and printing all of them
 * would answer no question at all; this answers three — is anything broken, which venue, how bad.
 *
 * The state that earns the page is **empty**: a venue running cleanly, reporting no error, and
 * returning zero markets. Six Hyperliquid sub-dexes are in exactly that condition, and both a
 * pass/fail reading and the geo-probe call them healthy.
 */
export function status(data: {
  overview: Overview;
  venues: VenueStatus[];
  /** Null when the verification table could not be read at all, which is not the same as empty. */
  checks: IdentityCheckRow[] | null;
  now: number;
}): string {
  const { overview, venues, checks, now } = data;
  // An alias has no feed of its own; listing it would report another venue's health twice.
  const aliases = new Set(VENUES.filter((v) => v.aliasOf).map((v) => v.id));
  const rows = venues
    .filter((v) => !aliases.has(v.venue_id))
    .map((v) => ({ status: v, state: venueState(v, now) }))
    .sort(
      (a, b) =>
        STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
        b.status.live_markets - a.status.live_markets ||
        a.status.name.localeCompare(b.status.name),
    );

  const tally = (state: VenueState) => rows.filter((r) => r.state === state).length;
  // Planned venues are the scaling backlog, not the operational picture. There are more of them
  // than there are venues we run, so listing them as rows would bury the twenty that can break.
  const running = rows.filter((r) => r.state !== "planned");
  const planned = rows.filter((r) => r.state === "planned");
  const wrong = running.length - tally("live");
  const failures = rows.reduce((sum, r) => sum + r.status.failures_24h, 0);
  const runs = rows.reduce((sum, r) => sum + r.status.runs_24h, 0);

  const body = running
    .map(({ status: v, state }) => {
      // Live markets and the last run's count differ when a venue has gone stale holding a figure.
      const drift =
        v.last_run_markets !== null && v.last_run_markets !== v.live_markets
          ? ` <span class="dim">(last run ${v.last_run_markets.toLocaleString("en-US")})</span>`
          : "";
      const failed =
        v.failures_24h === 0
          ? '<span class="dim">–</span>'
          : `<span title="${esc(`${v.failures_24h} of ${v.runs_24h} runs in the last 24 hours`)}">${v.failures_24h}</span>`;
      return `<tr data-k="${esc(v.venue_id)}">
<td><div class="leg"><a class="venue" href="${exchangeHref(v.venue_id)}">${esc(v.name)}</a><span class="meta">${esc(v.type)}</span></div></td>
<td><span class="st st-${state}" title="${esc(v.last_error ? `${STATE_TITLE[state]}: ${v.last_error}` : STATE_TITLE[state])}">${state}</span></td>
<td class="num"><span data-u="markets">${v.live_markets.toLocaleString("en-US")}</span>${drift}</td>
<td class="dim">${v.last_success_at === null ? "never" : since(v.last_success_at, now)}</td>
<td class="num">${failed}</td>
<td class="num dim">${duration(v.duration_ms)}${v.requests === null ? "" : ` · ${v.requests} req`}</td>
</tr>`;
    })
    .join("");

  // Price verification (migration 015). Sorted by severity, then by the money behind the market: a
  // mismatch on a deep market is a worse problem than the same verdict on a dust listing.
  const verified = [...(checks ?? [])].sort(
    (a, b) =>
      VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict) ||
      (b.member_oi_usd ?? 0) - (a.member_oi_usd ?? 0) ||
      a.base.localeCompare(b.base),
  );
  const verdictTally = (verdict: IdentityVerdict) =>
    verified.filter((c) => c.verdict === verdict).length;
  const checkBody = verified
    .map((c) => {
      // A dash, never 0.00: a frozen price correlates with nothing, and reporting that as a
      // correlation of zero would read as evidence of a mismatch rather than an absence of it.
      const corr = c.return_corr === null ? '<span class="dim">–</span>' : c.return_corr.toFixed(2);
      return `<tr data-k="${esc(`${c.venue_id} ${c.venue_symbol}`)}">
<td class="asset"><a href="${assetHref(c.base, c.asset_class)}">${assetName(c.base, c.asset_class)}</a></td>
<td><div class="leg"><a class="venue" href="${exchangeHref(c.venue_id)}">${esc(c.venue_id)}</a><span class="meta">${esc(c.venue_symbol)}</span></div></td>
<td><div class="leg"><a class="venue" href="${exchangeHref(c.anchor_venue_id)}">${esc(c.anchor_venue_id)}</a><span class="meta">${esc(c.anchor_venue_symbol)}</span></div></td>
<td class="num">${formatPriceRatio(c.price_ratio)}</td>
<td class="num">${corr}</td>
<td class="num dim">${c.shared_minutes.toLocaleString("en-US")}</td>
<td><span class="st vd-${c.verdict}" title="${esc(VERDICT_TITLE[c.verdict])}">${c.verdict}</span></td>
</tr>`;
    })
    .join("");

  return layout({
    title: "Collector status",
    description: "Whether each exchange is delivering data right now, and what failed if not.",
    path: "/status",
    overview,
    now,
    body: `<p class="eyebrow">Collector</p>
<h1>Status</h1>
<p class="lede">Whether each exchange is actually delivering data. That is a different question from the <a href="/probe">geo-probe</a>, which asks only whether the endpoint answers: a venue can reply and still return nothing, which is what <b>empty</b> means here and why it is coloured as a fault.</p>
<p class="facts" data-live="status-facts"><span><b>${running.length}</b> collected</span><span><b>${tally("live")}</b> live</span>${
      tally("empty") ? `<span><b>${tally("empty")}</b> empty</span>` : ""
    }${tally("failing") ? `<span><b>${tally("failing")}</b> failing</span>` : ""}${
      tally("stale") ? `<span><b>${tally("stale")}</b> stale</span>` : ""
    }${tally("silent") ? `<span><b>${tally("silent")}</b> silent</span>` : ""}<span><b>${failures.toLocaleString("en-US")}</b> failed runs of ${runs.toLocaleString("en-US")} in 24h</span></p>
<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>Exchange</th><th>State</th><th class="num">Live markets</th><th>Last success</th><th class="num" title="Runs that returned an error in the last 24 hours. One blip and a venue that is down look identical without this">Failures 24h</th><th class="num" title="The last run's wall time and request count">Cost</th></tr></thead>
<tbody data-live="status">${body}</tbody>
</table></div>
${wrong === 0 ? '<p class="notes">Every collected exchange is live and current.</p>' : ""}
<h2>Price verification</h2>
<p class="lede">Whether each market really is the asset it is filed under. Every asset is anchored on its deepest market by open interest, and a market disagreeing with that anchor by more than 10% is judged on whether its minute returns follow it. Correlation decides, never the size of the gap: a ratio landing near a clean 10× is a coincidence, not evidence — Gate quotes <b>PURR</b> at 104.6× Hyperliquid's on a correlation of 0.005, and they are simply different assets. <b>mismatch</b> means two unrelated assets share one ticker.</p>
${
  checks === null
    ? '<p class="notes">Verification has not run yet, so nothing below is confirmed either way. This is what a deployment looks like before the collector has checked its first asset.</p>'
    : verified.length === 0
      ? '<p class="notes">Every market agrees with the deepest market in its asset pool.</p>'
      : `<p class="facts"><span><b>${verified.length}</b> diverging</span>${
          verdictTally("mismatch") ? `<span><b>${verdictTally("mismatch")}</b> mismatch</span>` : ""
        }${verdictTally("scale") ? `<span><b>${verdictTally("scale")}</b> scale</span>` : ""}${
          verdictTally("tracks") ? `<span><b>${verdictTally("tracks")}</b> tracks</span>` : ""
        }${
          verdictTally("unverified")
            ? `<span><b>${verdictTally("unverified")}</b> unverified</span>`
            : ""
        }</p>
<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>Asset</th><th>Market</th><th title="The deepest market in the asset's pool by open interest. Every other market is measured against it, because the largest cluster is not necessarily the truthful one">Anchor</th><th class="num" title="This market's mark divided by the anchor's">Ratio</th><th class="num" title="Correlation of minute log-returns against the anchor. A dash means one side never moved, which is not the same as a correlation of zero">Corr</th><th class="num" title="Minute buckets in which both markets reported a mark">Mins</th><th>Verdict</th></tr></thead>
<tbody data-checks="identity">${checkBody}</tbody>
</table></div>`
}
${
  planned.length === 0
    ? ""
    : `<p class="notes"><b>${planned.length}</b> more exchanges are catalogued but not collected yet — no adapter has been built for them, so they are a scaling backlog rather than a fault: ${planned
        .map((r) => esc(r.status.name))
        .join(", ")}.</p>`
}`,
  });
}

export function asset(data: {
  asset: string;
  assetClass: AssetClass;
  markets: MarketRow[];
  /** Required for the same reason as on the exchange page. */
  overview: Overview;
  now: number;
}): string {
  const { markets, now, assetClass } = data;
  const minOi = DEFAULT_FILTERS.minOpenInterestUsd;
  const pair = bestPair(markets, minOi);
  const venues = new Set(markets.map((m) => m.venue_id)).size;
  const scale = railScale(markets.map((m) => m.apr));
  const marks = markets.map((m) => ({
    apr: m.apr,
    tone:
      m === pair?.long
        ? ("long" as const)
        : m === pair?.short
          ? ("short" as const)
          : ("venue" as const),
    label: `${venueName(m.venue_id)} ${m.venue_symbol}`,
  }));
  const rows = markets
    .map(
      (m) => `<tr data-k="${esc(`${m.venue_id}|${m.venue_symbol}`)}">
<td><div class="leg${m === pair?.long ? " long-leg" : m === pair?.short ? " short-leg" : ""}"><a class="venue" href="${exchangeHref(m.venue_id)}">${esc(venueName(m.venue_id))}</a><span class="meta">${esc(m.venue_symbol)}</span></div></td>
<td class="num">${apr(m.apr)}</td>
<td class="num">${m.apr_24h === null ? '<span class="dim">–</span>' : apr(m.apr_24h)}</td>
<td class="num">${m.apr_7d === null ? '<span class="dim">–</span>' : apr(m.apr_7d)}</td>
<td class="num">${stability(m.stability_30d, m.stability_days)}</td>
<td class="num">${momentum(m.momentum_30d)}</td>
<td class="num">${formatInterval(m.interval_hours)}</td>
<td class="num">${until(m.next_funding_at, now)}</td>
<td class="num">${formatPrice(m.mark_price)}</td>
<td class="num">${formatUsd(m.open_interest_usd)}</td>
<td class="num">${formatUsd(m.volume_24h_usd)}</td>
</tr>`,
    )
    .join("");

  const summary = pair
    ? `Best pair: long on ${esc(venueName(pair.long.venue_id))} at <span data-u="best-long">${formatApr(pair.long.apr)}</span>, short on ${esc(venueName(pair.short.venue_id))} at <span data-u="best-short">${formatApr(pair.short.apr)}</span>, a <span data-u="best-spread">${formatApr(pair.short.apr - pair.long.apr)}</span> spread per year. Only markets with at least ${formatUsd(minOi)} open interest are paired.`
    : venues < 2
      ? "Only one exchange lists it right now, so there's no cross-exchange pair."
      : `No two exchanges have at least ${formatUsd(minOi)} open interest in it, so there's no pair to show.`;

  return layout({
    title: `${assetTitle(data.asset, assetClass)} funding rates by exchange`,
    description: `${assetTitle(data.asset, assetClass)} perpetual funding rates across ${venues} exchanges, with the widest long/short spread.`,
    path: assetHref(data.asset, assetClass),
    overview: data.overview,
    now,
    body: `<p class="eyebrow">Funding by exchange</p>
<h1>${assetName(data.asset, assetClass)}</h1>
<p class="lede" data-live="asset-lede">${markets.length} live markets on ${venues} exchanges. ${summary}${pair ? ` <a href="${pairHref(data.asset, assetClass)}?long=${encodeURIComponent(pair.long.venue_id)}&short=${encodeURIComponent(pair.short.venue_id)}">Backtest this pair</a>.` : ""}</p>
<div class="asset-rail" data-live="asset-rail">${renderRail({ scale, marks, bar: pair ? [pair.long.apr, pair.short.apr] : undefined, size: "big" })}</div>
<div class="sheet-wrap"><table class="sheet"><thead><tr><th>Exchange</th><th class="num">Funding APR</th><th class="num">24h settled</th><th class="num">7d settled</th><th class="num" title="How often this market held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score">Stability</th><th class="num" title="Last 7 charging days against the days before them, in APR points. Up means funding is widening in the direction it already had">30d trend</th><th class="num">Interval</th><th class="num">Next funding</th><th class="num">Mark price</th><th class="num">Open interest</th><th class="num">24h volume</th></tr></thead><tbody data-live="asset-markets">${rows}</tbody></table></div>`,
  });
}

/** Backtest results are small and exact, unlike the millions formatUsd is shaped for. */
const money = (value: number) =>
  `${value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Sizes the reader chose from a menu: cents on "$10,000.00" are noise. */
const wholeMoney = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

const formatLeverage = (value: number) => `${value % 1 === 0 ? value : value.toFixed(1)}×`;

/**
 * Above this size per leg the venues' headline maximum no longer holds anywhere we have data for:
 * Bybit's 150x on BTCUSDT stops at roughly $300k notional and is 100x by $2M, and altcoin ladders
 * step down sooner still. One global figure is a deliberately conservative stand-in, not a real
 * boundary — B1 replaces it with each venue's own tiers from `market_leverage_tiers`.
 */
const HEADLINE_LEVERAGE_MAX_SIZE_USD = 250_000;

type PairCapital =
  /** Priced from both venues' risk-limit tiers at this size: exact, no caveat needed. */
  | { kind: "tiered"; capitalUsd: number; leverage: number }
  /** Priced from the headline maximum, which holds only at small size. */
  | { kind: "headline"; capitalUsd: number; leverage: number | null; beyondHeadline: boolean }
  /** A leg's size is past the largest position the venue will open on that market. */
  | { kind: "unopenable"; venueId: string; venueSymbol: string; maxNotionalUsd: number };

/** The bands stored for one leg, in the shape `tierForSize` matches on. */
function bandsFor(market: MarketRow | undefined, tiers: readonly LeverageTierRow[]) {
  if (!market) return [];
  return tiers
    .filter((t) => t.venue_id === market.venue_id && t.venue_symbol === market.venue_symbol)
    .map((t) => ({
      lowerNotionalUsd: t.lower_notional_usd,
      upperNotionalUsd: t.upper_notional_usd,
      imr: t.imr,
    }));
}

/**
 * What a pair actually ties up. Both legs are open at once on different exchanges and margin
 * independently, so capital is the sum of the two margins — at 1x that is twice the size.
 *
 * The venue's own ladder is used whenever both legs have one, because the margin rate a position
 * actually pays depends on its size. Failing that we fall back to the headline maximum, which
 * holds only at small size, and say so rather than quoting a figure we cannot back.
 *
 * On the headline path, symmetric leverage is the lower of the two venues' maxima: you cannot run
 * the pair at 100x on one side if the other caps at 10x. That is conservative, since independent
 * margining would let you post less on the permissive leg. A venue that publishes no figure at all
 * drops the pair to unleveraged rather than borrowing its partner's number.
 */
function pairCapital(
  sizeUsd: number,
  longMarket: MarketRow | undefined,
  shortMarket: MarketRow | undefined,
  tiers: readonly LeverageTierRow[] = [],
): PairCapital {
  const legs = [
    { market: longMarket, bands: bandsFor(longMarket, tiers) },
    { market: shortMarket, bands: bandsFor(shortMarket, tiers) },
  ];

  if (legs.every((leg) => leg.bands.length > 0)) {
    const priced = legs.map((leg) => ({ ...leg, tier: tierForSize(leg.bands, sizeUsd) }));
    const over = priced.find((leg) => leg.tier === null);
    if (over?.market) {
      return {
        kind: "unopenable",
        venueId: over.market.venue_id,
        venueSymbol: over.market.venue_symbol,
        // Every band is bounded on this path, since an unbounded top tier always matches.
        maxNotionalUsd: Math.max(...over.bands.map((band) => band.upperNotionalUsd ?? 0)),
      };
    }
    const [long, short] = priced;
    if (long?.tier && short?.tier) {
      const capitalUsd = pairCapitalUsd(sizeUsd, long.tier.imr, short.tier.imr);
      // What the pair is actually running at, which is not either venue's headline number.
      return { kind: "tiered", capitalUsd, leverage: (sizeUsd * 2) / capitalUsd };
    }
  }

  const usable = (market: MarketRow | undefined) =>
    market?.max_leverage && market.max_leverage > 0 ? market.max_leverage : null;
  const long = usable(longMarket);
  const short = usable(shortMarket);
  const leverage = long !== null && short !== null ? Math.min(long, short) : null;
  return {
    kind: "headline",
    capitalUsd: (sizeUsd * 2) / (leverage ?? 1),
    leverage,
    beyondHeadline: leverage !== null && sizeUsd > HEADLINE_LEVERAGE_MAX_SIZE_USD,
  };
}

/** The capital line, phrased so it never claims more precision than the tier data supports. */
function capitalFact(capital: PairCapital): string {
  if (capital.kind === "unopenable") {
    return `capital <b>–</b> — ${esc(venueName(capital.venueId))} will not open a position above ${wholeMoney(capital.maxNotionalUsd)} on ${esc(capital.venueSymbol)}`;
  }
  const amount = wholeMoney(capital.capitalUsd);
  if (capital.kind === "tiered") {
    return `capital <b>${amount}</b> across both legs at ${formatLeverage(capital.leverage)}`;
  }
  if (capital.leverage === null) return `capital <b>${amount}</b> across both legs, unleveraged`;
  const leverage = formatLeverage(capital.leverage);
  return capital.beyondHeadline
    ? `capital at least <b>${amount}</b> across both legs — ${leverage} is the small-size maximum`
    : `capital <b>${amount}</b> across both legs at ${leverage} (small size)`;
}

/**
 * Cumulative funding by day. Rendered server-side: the site has no chart library, and the Free plan
 * allows 10 ms of CPU per request.
 */
function equityCurve(result: BacktestResult, sizeUsd: number): string {
  if (result.perDay.length === 0) return "";
  let running = 0;
  const points = result.perDay.map((day) => (running += day.netUsd));
  const top = Math.max(0, ...points);
  const bottom = Math.min(0, ...points);
  const span = top - bottom || 1;
  const width = 720;
  const height = 130;
  const pad = 8;
  const x = (i: number) =>
    points.length === 1 ? width / 2 : pad + (i / (points.length - 1)) * (width - 2 * pad);
  const y = (value: number) => height - pad - ((value - bottom) / span) * (height - 2 * pad);

  const line = points.map((value, i) => `${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const zero = y(0).toFixed(1);
  const area = `${x(0).toFixed(1)},${zero} ${line} ${x(points.length - 1).toFixed(1)},${zero}`;
  const end = points.at(-1) ?? 0;
  const first = result.perDay[0]?.date ?? "";
  const last = result.perDay.at(-1)?.date ?? "";

  return `<figure class="curve ${end >= 0 ? "up" : "down"}">
<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Cumulative funding reaches ${money(end)} after ${points.length} days">
<polygon class="curve-area" points="${area}"></polygon>
<line class="curve-zero" x1="${pad}" x2="${width - pad}" y1="${zero}" y2="${zero}"></line>
<polyline class="curve-line" points="${line}"></polyline>
</svg>
<figcaption>Cumulative funding on ${wholeMoney(sizeUsd)} per leg · ${esc(first)} to ${esc(last)}</figcaption>
</figure>`;
}

/**
 * Fees are the one input no catalog can hold: they depend on the account's 30-day volume, its VIP or
 * staking tier and any referral discount, so the reader is the only one who knows them. A free-text
 * number rather than a menu, because 1.5, 4.5 and 2.3 bps are all ordinary and a menu would force a
 * rounded lie. Left blank, the backtest reports funding only and says so.
 */
function feeField(name: string, label: string, current: number | null): string {
  const value = current === null ? "" : String(current);
  return `<label class="field" title="Taker fee in basis points, per fill. Both legs must be filled in before costs are charged.">${label} (bps)<input type="number" name="${name}" value="${esc(value)}" min="0" max="${MAX_TAKER_FEE_BPS}" step="0.1" placeholder="blank = ignore" inputmode="decimal"></label>`;
}

/**
 * The window as links, marked the way the rates page marks its timeframe. Each keeps the legs, size
 * and fees already chosen, so switching window never throws away the pair being read.
 */
function windowStrip(
  asset: string,
  assetClass: AssetClass,
  params: BacktestParams | null,
  days: number,
): string {
  const links = BACKTEST_WINDOWS.map((n) => {
    const query = params
      ? backtestToQuery({ ...params, days: n })
      : n === DEFAULT_BACKTEST_DAYS
        ? ""
        : `?days=${n}`;
    return `<a href="${pairHref(asset, assetClass)}${query}"${n === days ? ' aria-current="true"' : ""}>${n}d</a>`;
  }).join("");
  return `<div class="tf" aria-label="Window">${links}</div>`;
}

function backtestForm(
  asset: string,
  assetClass: AssetClass,
  markets: MarketRow[],
  params: BacktestParams | null,
  days: number,
): string {
  const venues = [...new Set(markets.map((m) => m.venue_id))].sort((a, b) =>
    venueName(a).localeCompare(venueName(b)),
  );
  const venueField = (name: "long" | "short", current: string | undefined) =>
    `<label class="field">${name === "long" ? "Long on" : "Short on"}<select name="${name}">${venues
      .map(
        (id) =>
          `<option value="${esc(id)}"${id === current ? " selected" : ""}>${esc(venueName(id))}</option>`,
      )
      .join("")}</select></label>`;
  const numberField = (name: string, label: string, current: number, options: [number, string][]) =>
    `<label class="field">${label}<select name="${name}">${options
      .map(
        ([value, text]) =>
          `<option value="${value}"${value === current ? " selected" : ""}>${text}</option>`,
      )
      .join("")}</select></label>`;

  return `<form class="filters" method="get" action="${pairHref(asset, assetClass)}">
${venueField("long", params?.longVenueId)}
${venueField("short", params?.shortVenueId)}
${numberField("size", "Size per leg", params?.sizeUsd ?? 10_000, [
  [1_000, "$1k"],
  [10_000, "$10k"],
  [25_000, "$25k"],
  [100_000, "$100k"],
  [1_000_000, "$1M"],
])}
<input type="hidden" name="days" value="${days}">
${feeField("fee_long", "Long taker fee", params?.longTakerBps ?? null)}
${feeField("fee_short", "Short taker fee", params?.shortTakerBps ?? null)}
<div class="actions"><button type="submit">Run backtest</button>${
    params
      ? `<a href="${pairHref(asset, assetClass)}${backtestToQuery({ ...params, longVenueId: params.shortVenueId, shortVenueId: params.longVenueId })}">⇄ swap legs</a>`
      : ""
  }<a href="${priceHref(asset, assetClass)}" title="What entering and exiting would cost at each exchange's top of book">price gap</a><a href="${assetHref(asset, assetClass)}">Back to ${esc(asset)}</a></div>
</form>`;
}

/** Trims a bps figure for prose: "4.5" stays, "5.0" reads as "5". */
const formatBps = (bps: number | null): string => (bps === null ? "–" : String(Number(bps)));

/**
 * Costs and what they do to the result. Absent fees render nothing at all rather than a dash: the
 * note under the result already explains why, and an empty fact would read as a missing number.
 *
 * Payback is the figure that decides a carry trade. Funding that takes 40 days to repay its own
 * entry cost is not a 30-day trade, however good the gross APR looks.
 */
function costsFact(result: BacktestResult): string {
  if (result.costsUsd === null || result.netAfterCostsUsd === null) return "";
  const net = `<span>after costs <b class="${result.netAfterCostsUsd >= 0 ? "up" : "down"}">${money(result.netAfterCostsUsd)}</b> on ${money(result.costsUsd)} of fees</span>`;
  const payback =
    result.paybackDays === null
      ? `<span class="dim">never repays the fees at this rate</span>`
      : `<span>fees repay in <b>${result.paybackDays < 1 ? "under a day" : `${Math.round(result.paybackDays)} days`}</b></span>`;
  return `${net}${payback}`;
}

/**
 * The days that bracket the result, and how far cumulative funding fell on the way. They separate a
 * steady carry from one that earned everything in a single day. Funding only, before costs, the same
 * basis as the curve above them.
 */
function rangeFacts(result: BacktestResult): string {
  const { bestDay, worstDay } = result;
  if (!bestDay || !worstDay) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const when = (date: string) => {
    const [, month, day] = date.split("-");
    return `${months[Number(month) - 1]} ${Number(day)}`;
  };
  const drawdown = result.maxDrawdownUsd > 0 ? money(-result.maxDrawdownUsd) : money(0);
  return `<span>best day <b>${money(bestDay.netUsd)}</b> ${when(bestDay.date)}</span><span>worst day <b>${money(worstDay.netUsd)}</b> ${when(worstDay.date)}</span><span title="The largest fall in cumulative funding from a previous high, before costs">max drawdown <b>${drawdown}</b></span>`;
}

export function pair(data: {
  asset: string;
  assetClass: AssetClass;
  markets: MarketRow[];
  params: BacktestParams | null;
  /** The window, known even before legs are chosen, since the chart draws it either way. */
  days: number;
  result: BacktestResult | null;
  /** Risk-limit ladders for the two legs. Required so a caller cannot silently price without them. */
  tiers: LeverageTierRow[];
  /** Every listed market's funding over the window; null when the chart could not be read. */
  history: FundingHistory | null;
  /** Required, as on the asset and exchange pages: the status line reads it. */
  overview: Overview;
  now: number;
}): string {
  const { asset, assetClass, markets, params, days, result, tiers, history, overview, now } = data;
  const venues = new Set(markets.map((m) => m.venue_id)).size;
  const legMarket = (venueId: string, venueSymbol: string) =>
    markets.find((m) => m.venue_id === venueId && m.venue_symbol === venueSymbol);
  // What each leg charges right now, against its average over the window and how often it settles.
  // A leg quoting far above its own average is paying for a spike, not a carry.
  const legRates = (leg: BacktestResult["long"]) => {
    const market = legMarket(leg.venueId, leg.venueSymbol);
    const average =
      leg.averageAprPercent === null ? "" : `${days}d avg ${apr(leg.averageAprPercent)}`;
    if (!market) return average ? ` · ${average}` : "";
    return ` · now ${apr(market.apr)}${average ? `, ${average}` : ""}, every ${formatInterval(market.interval_hours)}`;
  };
  const legs = result
    ? {
        long: { venue_id: result.long.venueId, venue_symbol: result.long.venueSymbol },
        short: { venue_id: result.short.venueId, venue_symbol: result.short.venueSymbol },
      }
    : {};
  const capital =
    result && params
      ? pairCapital(
          params.sizeUsd,
          legMarket(result.long.venueId, result.long.venueSymbol),
          legMarket(result.short.venueId, result.short.venueSymbol),
          tiers,
        )
      : null;

  const body =
    result && params
      ? `<p class="headline ${result.netFundingUsd >= 0 ? "up" : "down"}">${money(result.netFundingUsd)}</p>
<p class="eyebrow">net funding over the last ${params.days === 1 ? "day" : `${params.days} days`} · ${formatApr(result.netFundingAprPercent)} annualized</p>
<div class="pair-legs">
<span class="long"><b>Long ${esc(venueName(result.long.venueId))}</b> ${esc(result.long.venueSymbol)} · ${result.long.settlements} settlements · ${money(result.long.fundingUsd)}${legRates(result.long)}</span>
<span class="short"><b>Short ${esc(venueName(result.short.venueId))}</b> ${esc(result.short.venueSymbol)} · ${result.short.settlements} settlements · ${money(result.short.fundingUsd)}${legRates(result.short)}</span>
</div>
${equityCurve(result, params.sizeUsd)}
<div class="facts"><span>win rate <b>${Math.round(result.winRateDays * 100)}%</b> of ${result.perDay.length} days</span><span>average <b>${money(result.avgDailyUsd)}</b> a day</span>${rangeFacts(result)}<span>${capitalFact(capital ?? pairCapital(params.sizeUsd, undefined, undefined, tiers))}</span>${costsFact(result)}</div>
${
  result.long.missedSettlements > 0 || result.short.missedSettlements > 0
    ? `<p class="notes">Missed settlements: ${result.long.missedSettlements} on ${esc(venueName(result.long.venueId))}, ${result.short.missedSettlements} on ${esc(venueName(result.short.venueId))}. A gap is reported rather than counted as zero, so this total covers only the settlements actually recorded.</p>`
    : ""
}
${
  result.perDay.length > 0 && result.perDay.length < params.days - 1
    ? `<p class="notes">Only ${result.perDay.length} of the ${params.days} days asked for have stored settlements. The annualized figure still divides by the whole window, so it reads low. The daily rollup keeps 70 days, and history is still filling on some venues.</p>`
    : ""
}
${
  result.costsUsd === null
    ? `<p class="notes">Funding only, on a position kept at ${wholeMoney(params.sizeUsd)} per leg. Trading fees are excluded because none were given: taker fees depend on your own volume tier and discounts, so fill in both legs' fees above to see this net of costs. Price moves between settlements aren't modelled either, because venue funding history gives a rate and a time, and almost never a mark price.</p>`
    : `<p class="notes">Net of the fees you entered, on a position kept at ${wholeMoney(params.sizeUsd)} per leg: ${formatBps(params.longTakerBps)} bps long and ${formatBps(params.shortTakerBps)} bps short, charged on four fills — entry and exit on both legs. Opening and closing once is assumed; rolling the position would cost this again each time. Price moves between settlements still aren't modelled, because venue funding history gives a rate and a time, and almost never a mark price.</p>`
}`
      : `<p class="lede">${
          venues < 2
            ? `Only one exchange lists ${esc(asset)} right now, so there's no pair to hold.`
            : "Pick two exchanges to hold against each other."
        }</p>`;

  return layout({
    title: `${assetTitle(asset, assetClass)} funding carry backtest`,
    description: `What holding ${assetTitle(asset, assetClass)} long on one exchange and short on another would have paid in funding.`,
    path: pairHref(asset, assetClass),
    overview,
    now,
    body: `<p class="eyebrow"><a href="${assetHref(asset, assetClass)}">${assetName(asset, assetClass)}</a> / backtest</p>
<h1>${assetName(asset, assetClass)} carry</h1>
<p class="lede">Every exchange's funding over one window, and what the two legs you pick actually settled, summed per UTC day. Windows are whole calendar days ending today, and the figures refresh hourly.</p>
${backtestForm(asset, assetClass, markets, params, days)}
${windowStrip(asset, assetClass, params, days)}
${renderFundingChart(history, legs)}
${body}`,
  });
}

/** Rate limited. Says plainly that cached results are never limited, so the advice is actionable. */
export function tooMany(path: string, now: number): string {
  return layout({
    title: "Too many requests",
    description: "Too many backtests from this address.",
    path,
    now,
    body: `<h1>Too many requests</h1>
<p class="lede">That is more backtests than one address may run in a minute. Wait a moment and try again. Results already computed are served from the cache and are never limited, so a combination someone has run before still loads immediately.</p>
<p><a href="/screener">Back to the screener</a></p>`,
  });
}

export function notFound(path: string, now: number, message?: string): string {
  return layout({
    title: "Not found",
    description: "Page not found.",
    path,
    now,
    body: `<h1>Not found</h1><p class="lede">${esc(message ?? `Nothing lives at ${path}.`)}</p><p><a href="/">See today's widest spreads</a></p>`,
  });
}

export function unavailable(path: string, now: number): string {
  return layout({
    title: "Data unavailable",
    description: "Market data is temporarily unavailable.",
    path,
    now,
    body: `<h1>Market data is unavailable</h1><p class="lede">The funding database didn't answer. Pages load again as soon as it does, usually within a minute.</p>`,
  });
}

export { DEFAULT_FILTERS };
