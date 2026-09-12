import { type BacktestResult, pairCapitalUsd, tierForSize } from "@ai-rates/core";
import { VENUES, type Venue } from "@ai-rates/venues";
import type {
  ExchangeSummary,
  HeatmapCell,
  LeverageTierRow,
  MarketRow,
  Overview,
  ScreenerFilters,
  ScreenerPair,
  ScreenerSort,
  VerifiedPair,
} from "../app/data";
import type { BacktestParams, HeatmapParams, HeatmapTimeframe } from "../app/params";
import {
  DEFAULT_FILTERS,
  filtersToQuery,
  HEATMAP_TIMEFRAMES,
  heatmapToQuery,
  MAX_TAKER_FEE_BPS,
  VENUE_TYPES,
} from "../app/params";
import { TURNSTILE_ACTION } from "../app/turnstile";
import {
  aprTone,
  esc,
  formatApr,
  formatInterval,
  formatPrice,
  formatUsd,
  since,
  until,
} from "./format";
import { layout } from "./layout";
import { type RailScale, railPosition, railScale, renderRail } from "./rail";
import { VENUE_TYPE_LABEL, VENUE_TYPE_SHORT, venueName } from "./venues";

const assetHref = (asset: string) => `/markets/asset/${encodeURIComponent(asset)}`;
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
 * Each row links to its OWN legs. `pairHref(asset)` alone would open whichever pair the asset page
 * picks by spread, which is often not the pair that earned this row.
 */
function verifiedTable(verified: VerifiedPair[]): string {
  if (verified.length === 0) {
    return `<div class="sheet-wrap"><p class="empty">No replay yet: the nightly run needs a week of settled funding on both legs of a pair.</p></div>`;
  }
  const rows = verified
    .map((v) => {
      const href = `${pairHref(v.asset)}?long=${encodeURIComponent(v.long_venue_id)}&short=${encodeURIComponent(v.short_venue_id)}`;
      return `<tr>
<td class="asset"><a href="${href}">${esc(v.asset)}</a></td>
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
<tbody>${rows}</tbody>
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
    : `<section class="hero"><p class="eyebrow">Widest funding spread right now</p><p class="lede">No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.</p></section>`;
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
  return `<section class="hero">
<p class="eyebrow">Widest funding spread right now</p>
<div class="hero-head">
<a class="hero-asset" href="${assetHref(p.asset)}">${esc(p.asset)}</a>
<p class="hero-spread">${formatApr(p.spread_apr)}<span>funding spread, per year</span></p>
</div>
${renderRail({
  scale: railScale([p.long_apr, p.short_apr]),
  marks: [
    { apr: p.long_apr, tone: "long", label: `Long on ${long}` },
    { apr: p.short_apr, tone: "short", label: `Short on ${short}` },
  ],
  bar: [p.long_apr, p.short_apr],
  size: "big",
})}
<div class="legs">
<p class="long"><b>Long on <a href="${exchangeHref(p.long_venue_id)}">${esc(long)}</a></b> ${esc(p.long_symbol)} at ${formatApr(p.long_apr)}</p>
<p class="short"><b>Short on <a href="${exchangeHref(p.short_venue_id)}">${esc(short)}</a></b> ${esc(p.short_symbol)} at ${formatApr(p.short_apr)}</p>
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
  ) =>
    `<td><div class="leg ${side}-leg"><a class="venue" href="${exchangeHref(venueId)}">${esc(venueName(venueId))}</a><span class="meta">${esc(symbol)} · ${formatInterval(interval)} · OI ${formatUsd(oi)}</span></div></td>`;

  const rows = pairs
    .map(
      (p) => `<tr>
<td class="asset"><a href="${assetHref(p.asset)}">${esc(p.asset)}</a></td>
<td class="num spread">${formatApr(p.spread_apr)}</td>
<td class="rail-cell">${renderRail({
        scale,
        marks: [
          { apr: p.long_apr, tone: "long", label: `Long on ${venueName(p.long_venue_id)}` },
          { apr: p.short_apr, tone: "short", label: `Short on ${venueName(p.short_venue_id)}` },
        ],
        bar: [p.long_apr, p.short_apr],
      })}</td>
${leg("long", p.long_venue_id, p.long_symbol, p.long_interval_hours, p.long_open_interest_usd)}
<td class="num">${apr(p.long_apr)}</td>
${leg("short", p.short_venue_id, p.short_symbol, p.short_interval_hours, p.short_open_interest_usd)}
<td class="num">${apr(p.short_apr)}</td>
<td class="num">${p.spread_apr_7d === null ? '<span class="dim">–</span>' : formatApr(p.spread_apr_7d)}</td>
<td class="num dim">${p.venue_count}</td>
<td class="num"${stabilityTitle(p)}>${formatStability(p.pair_stability)}</td>
</tr>`,
    )
    .join("");

  return `<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>Asset</th>${sortableTh("spread", "Widest funding gap between two exchanges", filters)}<th title="Signed log scale, so ordinary rates keep room next to extreme ones">Long − short, log scale</th><th>Long leg</th><th class="num">Long APR</th><th>Short leg</th><th class="num">Short APR</th>${sortableTh("settled_7d", "Same two markets, averaged over the settlements of the last 7 days", filters)}${sortableTh("venues", "Exchanges with a live market for this asset", filters)}${sortableTh("stability", "How often the weaker leg held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score", filters)}</tr></thead>
<tbody>${rows}</tbody>
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
      (e) => `<tr>
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
      "Perpetual futures exchanges tracked by airates, with live market counts, open interest and volume.",
    path: "/markets",
    overview: data.overview,
    now: data.now,
    body: `<h1>Exchanges</h1>
<p class="lede">Every exchange with markets reported in the last five minutes. Open interest and volume are summed across its perpetual markets, where the exchange reports them.</p>
${
  data.exchanges.length === 0
    ? `<div class="sheet-wrap"><p class="empty">No exchange has reported in the last five minutes.</p></div>`
    : `<div class="sheet-wrap"><table class="sheet"><thead><tr><th>Exchange</th><th>Type</th><th class="num">Live markets</th><th class="num">Open interest</th><th class="num">24h volume</th><th class="num">Updated</th></tr></thead><tbody>${rows}</tbody></table></div>`
}
<p class="notes">Not collected yet: ${esc(notCollected.join(", "))}. Some block access from our data location or don't publish a usable funding API.</p>`,
  });
}

export function exchange(data: { venue: Venue; markets: MarketRow[]; now: number }): string {
  const { venue, markets, now } = data;
  const oi = markets.reduce((sum, m) => sum + (m.open_interest_usd ?? 0), 0);
  const scale = railScale(
    markets.map((m) => m.apr),
    "log",
  );
  const rows = markets
    .map(
      (m) => `<tr>
<td>${esc(m.venue_symbol)}</td>
<td class="asset"><a href="${assetHref(m.base)}">${esc(m.base)}</a></td>
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
    now,
    body: `<p class="eyebrow"><a href="/markets">Exchanges</a> / ${esc(VENUE_TYPE_LABEL[venue.type] ?? venue.type)}</p>
<h1>${esc(venue.name)}</h1>
${
  markets.length === 0
    ? `<p class="lede">No live markets from ${esc(venue.name)}: it isn't collected yet, or its last update is more than five minutes old.</p>`
    : `<div class="facts"><span><b>${markets.length.toLocaleString("en-US")}</b> live markets</span><span><b>${formatUsd(oi)}</b> open interest</span><span>updated <b>${since(markets[0]?.observed_at ?? null, now)}</b></span></div>
<div class="sheet-wrap"><table class="sheet"><thead><tr><th>Market</th><th>Asset</th><th class="num">Funding APR</th><th title="Signed log scale, so ordinary rates keep room next to extreme ones">Rate, log scale</th><th class="num">7d settled</th><th class="num">Interval</th><th class="num">Next funding</th><th class="num">Mark price</th><th class="num">Open interest</th><th class="num">24h volume</th></tr></thead><tbody>${rows}</tbody></table></div>`
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
    let row = byBase.get(cell.base);
    if (!row) {
      row = { base: cell.base, assetOiUsd: cell.asset_oi_usd, byVenue: new Map() };
      byBase.set(cell.base, row);
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

  const strip = HEATMAP_TIMEFRAMES.map((tf) =>
    tf === params.tf ? `<b>${tf}</b>` : link({ tf }, tf),
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
              return `<a href="${pairHref(row.base)}?long=${encodeURIComponent(longId)}&short=${encodeURIComponent(shortId)}">${formatApr(high - low)}</a>`;
            })()
          : `<span class="dim">–</span>`;

      const grid = values
        .map((value) =>
          // An absent market is a dim dash with no colour: ~62% of the grid is empty, and a tinted
          // zero would read as "funding is flat here" instead of "there is nothing here".
          value === null
            ? `<td class="none">–</td>`
            : `<td class="${heatBucket(value, scale)}">${formatApr(value)}</td>`,
        )
        .join("");

      return `<tr><td class="asset"><a href="${assetHref(row.base)}">${esc(row.base)}</a></td><td class="dim">${formatUsd(row.assetOiUsd)}</td><td>${spread}</td>${grid}</tr>`;
    })
    .join("");

  const pager = `<div class="pager">${link(
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
      : `<div class="heat-wrap"><table class="heat"><thead>${header}</thead><tbody>${body}</tbody></table></div>${pager}`;

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

export function asset(data: { asset: string; markets: MarketRow[]; now: number }): string {
  const { markets, now } = data;
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
      (m) => `<tr>
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
    ? `Best pair: long on ${esc(venueName(pair.long.venue_id))} at ${formatApr(pair.long.apr)}, short on ${esc(venueName(pair.short.venue_id))} at ${formatApr(pair.short.apr)}, a ${formatApr(pair.short.apr - pair.long.apr)} spread per year. Only markets with at least ${formatUsd(minOi)} open interest are paired.`
    : venues < 2
      ? "Only one exchange lists it right now, so there's no cross-exchange pair."
      : `No two exchanges have at least ${formatUsd(minOi)} open interest in it, so there's no pair to show.`;

  return layout({
    title: `${data.asset} funding rates by exchange`,
    description: `${data.asset} perpetual funding rates across ${venues} exchanges, with the widest long/short spread.`,
    path: assetHref(data.asset),
    now,
    body: `<p class="eyebrow">Funding by exchange</p>
<h1>${esc(data.asset)}</h1>
<p class="lede">${markets.length} live markets on ${venues} exchanges. ${summary}${pair ? ` <a href="${pairHref(data.asset)}?long=${encodeURIComponent(pair.long.venue_id)}&short=${encodeURIComponent(pair.short.venue_id)}">Backtest this pair</a>.` : ""}</p>
${renderRail({ scale, marks, bar: pair ? [pair.long.apr, pair.short.apr] : undefined, size: "big" })}
<div class="sheet-wrap"><table class="sheet"><thead><tr><th>Exchange</th><th class="num">Funding APR</th><th class="num">24h settled</th><th class="num">7d settled</th><th class="num" title="How often this market held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score">Stability</th><th class="num" title="Last 7 charging days against the days before them, in APR points. Up means funding is widening in the direction it already had">30d trend</th><th class="num">Interval</th><th class="num">Next funding</th><th class="num">Mark price</th><th class="num">Open interest</th><th class="num">24h volume</th></tr></thead><tbody>${rows}</tbody></table></div>`,
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

const pairHref = (asset: string) => `/pair/${encodeURIComponent(asset)}`;

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

function backtestForm(asset: string, markets: MarketRow[], params: BacktestParams | null): string {
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

  return `<form class="filters" method="get" action="${pairHref(asset)}">
${venueField("long", params?.longVenueId)}
${venueField("short", params?.shortVenueId)}
${numberField("size", "Size per leg", params?.sizeUsd ?? 10_000, [
  [1_000, "$1k"],
  [10_000, "$10k"],
  [25_000, "$25k"],
  [100_000, "$100k"],
  [1_000_000, "$1M"],
])}
${numberField("days", "Window", params?.days ?? 30, [
  [7, "7 days"],
  [14, "14 days"],
  [30, "30 days"],
  [60, "60 days"],
  [90, "90 days"],
])}
${feeField("fee_long", "Long taker fee", params?.longTakerBps ?? null)}
${feeField("fee_short", "Short taker fee", params?.shortTakerBps ?? null)}
<div class="actions"><button type="submit">Run backtest</button><a href="${assetHref(asset)}">Back to ${esc(asset)}</a></div>
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

export function pair(data: {
  asset: string;
  markets: MarketRow[];
  params: BacktestParams | null;
  result: BacktestResult | null;
  /** Risk-limit ladders for the two legs. Required so a caller cannot silently price without them. */
  tiers: LeverageTierRow[];
  now: number;
}): string {
  const { asset, markets, params, result, tiers, now } = data;
  const venues = new Set(markets.map((m) => m.venue_id)).size;
  const legMarket = (venueId: string, venueSymbol: string) =>
    markets.find((m) => m.venue_id === venueId && m.venue_symbol === venueSymbol);
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
<p class="eyebrow">net funding over ${Math.round(result.days)} days · ${formatApr(result.netFundingAprPercent)} annualized</p>
<div class="pair-legs">
<span class="long"><b>Long ${esc(venueName(result.long.venueId))}</b> ${esc(result.long.venueSymbol)} · ${result.long.settlements} settlements · ${money(result.long.fundingUsd)}</span>
<span class="short"><b>Short ${esc(venueName(result.short.venueId))}</b> ${esc(result.short.venueSymbol)} · ${result.short.settlements} settlements · ${money(result.short.fundingUsd)}</span>
</div>
${equityCurve(result, params.sizeUsd)}
<div class="facts"><span>win rate <b>${Math.round(result.winRateDays * 100)}%</b> of ${result.perDay.length} days</span><span>average <b>${money(result.avgDailyUsd)}</b> a day</span><span>${capitalFact(capital ?? pairCapital(params.sizeUsd, undefined, undefined, tiers))}</span>${costsFact(result)}</div>
${
  result.long.missedSettlements > 0 || result.short.missedSettlements > 0
    ? `<p class="notes">Missed settlements: ${result.long.missedSettlements} on ${esc(venueName(result.long.venueId))}, ${result.short.missedSettlements} on ${esc(venueName(result.short.venueId))}. A gap is reported rather than counted as zero, so this total covers only the settlements actually recorded.</p>`
    : ""
}
${
  result.perDay.length > 0 && result.perDay.length < Math.round(result.days) - 1
    ? `<p class="notes">Only ${result.perDay.length} of the ${Math.round(result.days)} days asked for have stored settlements. The annualized figure still divides by the whole window, so it reads low. History reaches 90 days on most venues and is still filling on the rest.</p>`
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
    title: `${asset} funding carry backtest`,
    description: `What holding ${asset} long on one exchange and short on another would have paid in funding.`,
    path: pairHref(asset),
    now,
    body: `<p class="eyebrow"><a href="${assetHref(asset)}">${esc(asset)}</a> / backtest</p>
<h1>${esc(asset)} carry</h1>
<p class="lede">What the funding on both legs actually settled to, summed at each venue's own settlement times over the window.</p>
${backtestForm(asset, markets, params)}
${body}`,
  });
}

/**
 * Shown when a backtest nobody has run yet is asked for and the visitor has no clearance.
 *
 * It exists because the token cannot ride in a GET query string: the edge cache keys on the URL, so
 * a token there would miss cache every time and would put a single-use 300-second credential into a
 * shareable link. The form POSTs instead, and a solved challenge buys a short-lived cookie.
 *
 * Returned with status 403 by the caller, which is what keeps this page out of the edge cache — a
 * cached challenge would otherwise replace the result at this URL for everyone.
 */
export function challenge(data: {
  asset: string;
  params: BacktestParams;
  sitekey: string;
  now: number;
}): string {
  const { asset, params, sitekey, now } = data;
  const hidden = (name: string, value: string | number | null) =>
    value === null ? "" : `<input type="hidden" name="${name}" value="${esc(String(value))}">`;

  return layout({
    title: `${asset} carry — one check first`,
    description: `A quick check before replaying ${asset} funding across both legs.`,
    path: pairHref(asset),
    now,
    body: `<p class="eyebrow"><a href="${assetHref(asset)}">${esc(asset)}</a> / backtest</p>
<h1>One check before the replay</h1>
<p class="lede">This replays every stored settlement on both legs, which is real work against the database. A combination someone has already run is served straight from the cache with no check at all — this only appears for one nobody has asked for yet.</p>
<form class="filters" method="post" action="${pairHref(asset)}/verify">
${hidden("long", params.longVenueId)}${hidden("short", params.shortVenueId)}${hidden("size", params.sizeUsd)}${hidden("days", params.days)}${hidden("fee_long", params.longTakerBps)}${hidden("fee_short", params.shortTakerBps)}
<div class="cf-turnstile" data-sitekey="${esc(sitekey)}" data-action="${TURNSTILE_ACTION}"></div>
<div class="actions"><button type="submit">Run the backtest</button><a href="${assetHref(asset)}">Back to ${esc(asset)}</a></div>
</form>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`,
  });
}

/** Rate limited. Says plainly that cached results are never limited, so the advice is actionable. */
export function tooMany(path: string, now: number): string {
  return layout({
    title: "Too many requests",
    description: "Too many uncached backtests from this address.",
    path,
    now,
    body: `<h1>Too many requests</h1>
<p class="lede">That is more new backtests than one address may run in a minute. Wait a moment and try again. Results that have already been computed are served from the cache and are never limited, so a combination someone has run before will load immediately.</p>
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
