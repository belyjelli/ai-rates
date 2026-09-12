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
} from "../app/data";
import type { BacktestParams } from "../app/params";
import { DEFAULT_FILTERS, VENUE_TYPES } from "../app/params";
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
import { railScale, renderRail } from "./rail";
import { VENUE_TYPE_LABEL, VENUE_TYPE_SHORT, venueName } from "./venues";

const assetHref = (asset: string) => `/markets/asset/${encodeURIComponent(asset)}`;
const exchangeHref = (venueId: string) => `/markets/exchange/${encodeURIComponent(venueId)}`;
const apr = (value: number | null) => `<span class="${aprTone(value)}">${formatApr(value)}</span>`;

export function home(data: { overview: Overview; pairs: ScreenerPair[]; now: number }): string {
  const [top] = data.pairs;
  const hero = top
    ? heroPair(top)
    : `<section class="hero"><p class="eyebrow">Widest funding spread right now</p><p class="lede">No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.</p></section>`;

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
${pairsTable(data.pairs, "No pairs match these filters. Lower the minimum open interest or include more exchange types.")}`,
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

function pairsTable(pairs: ScreenerPair[], emptyMessage: string): string {
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
</tr>`,
    )
    .join("");

  return `<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>Asset</th><th class="num">Spread</th><th title="Signed log scale, so ordinary rates keep room next to extreme ones">Long − short, log scale</th><th>Long leg</th><th class="num">Long APR</th><th>Short leg</th><th class="num">Short APR</th><th class="num" title="Same two markets, averaged over the settlements of the last 7 days">7d settled</th><th class="num" title="Exchanges with a live market for this asset">Venues</th></tr></thead>
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
<div class="sheet-wrap"><table class="sheet"><thead><tr><th>Exchange</th><th class="num">Funding APR</th><th class="num">24h settled</th><th class="num">7d settled</th><th class="num">Interval</th><th class="num">Next funding</th><th class="num">Mark price</th><th class="num">Open interest</th><th class="num">24h volume</th></tr></thead><tbody>${rows}</tbody></table></div>`,
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
<div class="actions"><button type="submit">Run backtest</button><a href="${assetHref(asset)}">Back to ${esc(asset)}</a></div>
</form>`;
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
<div class="facts"><span>win rate <b>${Math.round(result.winRateDays * 100)}%</b> of ${result.perDay.length} days</span><span>average <b>${money(result.avgDailyUsd)}</b> a day</span><span>${capitalFact(capital ?? pairCapital(params.sizeUsd, undefined, undefined, tiers))}</span></div>
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
<p class="notes">Funding only, on a position kept at ${wholeMoney(params.sizeUsd)} per leg. Trading fees are excluded: exchange taker fees aren't published consistently enough to assume one. Price moves between settlements aren't modelled either, because venue funding history gives a rate and a time, and almost never a mark price.</p>`
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
