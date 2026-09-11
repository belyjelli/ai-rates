import { VENUES, type Venue } from "@ai-rates/venues";
import type {
  ExchangeSummary,
  MarketRow,
  Overview,
  ScreenerFilters,
  ScreenerPair,
} from "../app/data";
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
<p class="lede">${markets.length} live markets on ${venues} exchanges. ${summary}</p>
${renderRail({ scale, marks, bar: pair ? [pair.long.apr, pair.short.apr] : undefined, size: "big" })}
<div class="sheet-wrap"><table class="sheet"><thead><tr><th>Exchange</th><th class="num">Funding APR</th><th class="num">24h settled</th><th class="num">7d settled</th><th class="num">Interval</th><th class="num">Next funding</th><th class="num">Mark price</th><th class="num">Open interest</th><th class="num">24h volume</th></tr></thead><tbody>${rows}</tbody></table></div>`,
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
