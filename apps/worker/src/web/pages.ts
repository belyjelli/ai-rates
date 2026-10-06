import {
  type AssetClass,
  type BacktestResult,
  gapCost,
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
  LiquidationFeedRow,
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
import { HEADLINE_BAR, venueState } from "../app/data";
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
import { RETAIL_TAKER_BPS, retailSchedule } from "../app/retail-fees";
import {
  ageText,
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
import { helpButton, helpHeading, helpPanel } from "./help";
import { msg, tr, trMsg, withLocale } from "./i18n";
import { layout } from "./layout";
import { FEEDS, liquidationFeedTable } from "./liquidation-feeds";
import { type RailScale, railPosition, railScale, renderRail } from "./rail";
import { citeMark } from "./share";
import { tabBar } from "./tabs";
import { VENUE_TYPE_LABEL, VENUE_TYPE_SHORT, venueName } from "./venues";

/** Each class's tag, marked for translation; the class itself stays the English code in every URL. */
const ASSET_CLASS_LABELS: Readonly<Record<AssetClass, string>> = {
  crypto: msg("crypto"),
  equity: msg("equity"),
  commodity: msg("commodity"),
  fx: msg("fx"),
  index: msg("index"),
};
export const assetClassLabel = (assetClass: AssetClass) => trMsg(ASSET_CLASS_LABELS[assetClass]);

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
export const assetKey = (asset: string, assetClass: AssetClass) =>
  assetClass === "crypto" ? asset : `${assetClass}:${asset}`;
/**
 * The ticker, tagged with its class unless it is crypto. Tagging only the ~70 tradfi markets keeps
 * 5,900 crypto rows clean, and still tells the two BB rows apart wherever both appear.
 */
export const assetName = (asset: string, assetClass: AssetClass) =>
  `${esc(asset)}${assetClass === "crypto" ? "" : ` <span class="cls">${assetClassLabel(assetClass)}</span>`}`;
const assetTitle = (asset: string, assetClass: AssetClass) =>
  assetClass === "crypto" ? asset : `${asset} (${assetClassLabel(assetClass)})`;
const exchangeHref = (venueId: string) => `/markets/exchange/${encodeURIComponent(venueId)}`;
const apr = (value: number | null) => `<span class="${aprTone(value)}">${formatApr(value)}</span>`;
/** A spread or gap for prose: always positive, so the "+" formatApr signs rates with is noise there. */
const plainApr = (value: number | null) => formatApr(value).replace(/^\+/, "");

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
  if (rounded === 0) return `<span class="dim">${tr("flat")}</span>`;
  return `<span class="dim">${rounded > 0 ? "↑" : "↓"}</span> ${Math.abs(rounded).toFixed(1)}`;
};

/** A stability score with its evidence: the bare number invites reading 0.69 on 6 days as settled. */
const stability = (score: number | null, days: number | null): string =>
  score === null
    ? '<span class="dim">–</span>'
    : `<span title="${tr("{days} charging days in the last 30", { days: days ?? 0 })}">${score.toFixed(2)}</span>`;

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
    return `<div class="sheet-wrap"><p class="empty">${tr("No replay yet: the nightly run needs a week of settled funding on both legs of a pair.")}</p></div>`;
  }
  const rows = verified
    .map((v, i) => {
      const href = `${pairHref(v.asset, v.asset_class)}?long=${encodeURIComponent(v.long_venue_id)}&short=${encodeURIComponent(v.short_venue_id)}`;
      const cite =
        i === 0
          ? citeMark(
              tr(
                "Replayed, not forecast: {asset} long {long} / short {short} settled {net} on {size} a leg over 7 days. {apr} annualized, {win}% of days positive.",
                {
                  asset: assetTitle(v.asset, v.asset_class),
                  long: venueName(v.long_venue_id),
                  short: venueName(v.short_venue_id),
                  net: money(v.net_funding_usd),
                  size: wholeMoney(v.size_usd),
                  apr: plainApr(v.net_funding_apr_percent),
                  win: Math.round(v.win_rate_days * 100),
                },
              ),
              href,
            )
          : "";
      return `<tr data-k="${esc(`${assetKey(v.asset, v.asset_class)}|${v.long_venue_id}|${v.short_venue_id}`)}">
<td class="asset"><a href="${href}">${assetName(v.asset, v.asset_class)}</a>${cite}</td>
<td class="num ${v.net_funding_usd >= 0 ? "longs-paid" : "shorts-paid"}">${money(v.net_funding_usd)}</td>
<td class="num">${formatApr(v.net_funding_apr_percent)}</td>
<td><div class="leg long-leg"><a class="venue" href="${exchangeHref(v.long_venue_id)}">${esc(venueName(v.long_venue_id))}</a><span class="meta">${esc(v.long_symbol)}</span></div></td>
<td><div class="leg short-leg"><a class="venue" href="${exchangeHref(v.short_venue_id)}">${esc(venueName(v.short_venue_id))}</a><span class="meta">${esc(v.short_symbol)}</span></div></td>
<td class="num">${Math.round(v.win_rate_days * 100)}%</td>
<td class="num" title="${tr("Open interest on the thinner of the two legs. A big figure earned on a shallow market is not a trade you can size into")}">${formatUsd(v.thinner_leg_oi_usd)}</td>
<td class="num" title="${tr("The more extreme leg's funding, absolute. Rates past a few hundred percent usually mean a delisting or a distressed listing rather than carry")}">${v.worst_leg_abs_apr === null ? '<span class="dim">–</span>' : formatApr(v.worst_leg_abs_apr)}</td>
<td class="num">${stability(v.pair_stability, Math.min(v.long_charge_days, v.short_charge_days))}</td>
</tr>`;
    })
    .join("");

  return `<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>${tr("Asset")}</th><th class="num" title="${tr("Funding both legs actually settled over the last 7 days, per $10,000 of notional on each leg")}">${tr("7d settled")}</th><th class="num">${tr("Annualized")}</th><th>${tr("Long leg")}</th><th>${tr("Short leg")}</th><th class="num" title="${tr("Days the pair was net positive, as a share of days that settled at all")}">${tr("Win rate")}</th><th class="num">${tr("Thinner leg OI")}</th><th class="num">${tr("Worst leg APR")}</th><th class="num" title="${tr("How often the weaker leg held its funding direction over 30 days")}">${tr("Stability")}</th></tr></thead>
<tbody data-live="verified">${rows}</tbody>
</table></div>`;
}

export function home(data: {
  overview: Overview;
  pairs: ScreenerPair[];
  verified: VerifiedPair[];
  /** The newest run's best pair clearing HEADLINE_BAR; the live widest spread heads the page without one. */
  best: VerifiedPair | null;
  now: number;
}): string {
  const [top] = data.pairs;
  // The hero is a live region, so its explanation sits in a panel just after it; the badge inside it
  // only names the panel by id, which survives a refresh swapping the hero's children.
  const hero = data.best
    ? `${heroVerified(data.best)}\n${helpPanel("hero", `<p>${heroVerifiedNote()}</p>`)}`
    : top
      ? `${heroPair(top)}\n${helpPanel("hero", `<p>${heroPairNote()}</p>`)}`
      : `<section class="hero" data-live="hero"><p class="eyebrow">${tr("Widest funding spread right now")}</p><p class="lede">${tr("No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.")}</p></section>`;
  const runDay = data.verified[0]?.run_day;

  return layout({
    title: tr("Funding spreads across perp exchanges"),
    description: tr(
      "Live funding rate spreads between perpetual futures exchanges, refreshed every minute.",
    ),
    path: "/",
    overview: data.overview,
    now: data.now,
    body: `${hero}
<section>
<div class="section-head"><h2>${tr("Widest spreads")}</h2><a href="/screener">${tr("Open the screener")}</a></div>
${pairsTable(data.pairs, tr("No pairs yet: an asset needs live markets on at least two venues."))}
</section>
<section>
<div class="section-head"><h2 class="has-help">${tr("What actually paid, last 7 days")}${helpButton("paid")}</h2>${runDay ? `<span class="dim">${tr("replayed {date}", { date: esc(runDay.toISOString().slice(0, 10)) })}</span>` : ""}</div>
${helpPanel("paid", `<p>${tr("Not a forecast: both legs replayed at their own settlement times from stored funding, on $10,000 per leg. Ranked by what settled, with nothing filtered out — so check the thinner leg's depth and the worse leg's rate before reading a big number as a trade.")}</p>`)}
${verifiedTable(data.verified)}
</section>`,
  });
}

/**
 * The headline once a pair clears HEADLINE_BAR: what it settled, not what it quotes. The widest live
 * spread is the biggest number on the page and often an outlier on a thin book; this one is smaller,
 * already happened, and could have been held, which makes it the figure worth putting in front of
 * someone. Fees are a retail round trip, so the net is one a reader reaches without a VIP tier, and the
 * link opens the backtest with those same fees so the two pages agree.
 */
function heroVerified(v: VerifiedPair): string {
  const long = venueName(v.long_venue_id);
  const short = venueName(v.short_venue_id);
  const { retailTakerBps, roundTripFills } = HEADLINE_BAR;
  const net = v.net_funding_usd - (v.size_usd * roundTripFills * retailTakerBps) / 10_000;
  const query = backtestToQuery({
    longVenueId: v.long_venue_id,
    shortVenueId: v.short_venue_id,
    sizeUsd: v.size_usd,
    days: v.days,
    longTakerBps: retailTakerBps,
    shortTakerBps: retailTakerBps,
  });
  const span = v.days === 1 ? tr("day") : tr("{n} days", { n: v.days });
  const cite = citeMark(
    tr(
      "{asset} carry, long {long} / short {short}: {funding} of funding settled on {size} a leg over the last {span}. {net} after retail fees. Price risk hedged, not guessed.",
      {
        asset: assetTitle(v.asset, v.asset_class),
        long,
        short,
        funding: money(v.net_funding_usd),
        size: wholeMoney(v.size_usd),
        span,
        net: money(net),
      },
    ),
    `${pairHref(v.asset, v.asset_class)}${query}`,
  );
  return `<section class="hero" data-live="hero">
<p class="eyebrow has-help">${tr("Best verified carry, last {span}", { span })}${helpButton("hero")}</p>${cite}
<div class="hero-head">
<a class="hero-asset" href="${assetHref(v.asset, v.asset_class)}">${assetName(v.asset, v.asset_class)}</a>
<p class="hero-spread up"><b>${money(v.net_funding_usd)}</b><span>${tr("funding settled on {size} per leg", { size: wholeMoney(v.size_usd) })}</span></p>
</div>
<div class="legs">
<p class="long"><b>${tr("Long on {venue}", { venue: `<a href="${exchangeHref(v.long_venue_id)}">${esc(long)}</a>` })}</b> ${esc(v.long_symbol)}</p>
<p class="short"><b>${tr("Short on {venue}", { venue: `<a href="${exchangeHref(v.short_venue_id)}">${esc(short)}</a>` })}</b> ${esc(v.short_symbol)}</p>
</div>
<div class="facts"><span>${tr("after retail fees {value}", { value: `<b class="${net >= 0 ? "up" : "down"}">${money(net)}</b>` })}</span><span>${tr("annualized {value} before fees", { value: `<b>${formatApr(v.net_funding_apr_percent)}</b>` })}</span><span>${tr("win rate {value} of days", { value: `<b>${Math.round(v.win_rate_days * 100)}%</b>` })}</span><span>${tr("thinner leg {value} open interest", { value: `<b>${formatUsd(v.thinner_leg_oi_usd)}</b>` })}</span><span>${tr("stability {value}", { value: `<b>${stability(v.pair_stability, Math.min(v.long_charge_days, v.short_charge_days))}</b>` })}</span></div>
<div class="cta"><a class="btn" href="${pairHref(v.asset, v.asset_class)}${query}" data-await>${tr("Open this backtest")} <span aria-hidden="true">→</span></a><span class="dim">${tr("replayed {date}", { date: esc(v.run_day.toISOString().slice(0, 10)) })}</span></div>
</section>`;
}

/** What the verified hero is, for its "?" panel. */
function heroVerifiedNote(): string {
  return tr(
    "Settled, not forecast: both legs replayed at their own settlement times. This is the best pair in the newest nightly run with at least {oi} of open interest on its thinner leg, neither leg past {apr}% a year, stability of {stability} or better and no missed settlements. Retail fees are {bps} bps on each of {fills} fills, opening and closing both legs. Last week's funding is not a promise about next week's.",
    {
      oi: formatUsd(HEADLINE_BAR.minThinnerLegOiUsd),
      apr: HEADLINE_BAR.maxWorstLegAbsApr,
      stability: HEADLINE_BAR.minPairStability,
      bps: HEADLINE_BAR.retailTakerBps,
      fills: HEADLINE_BAR.roundTripFills,
    },
  );
}

/** What the live-spread hero is, for its "?" panel. */
function heroPairNote(): string {
  return tr(
    "Holding equal size on both legs cancels the price exposure; the gap between the two funding rates is what the pair collects over a year, before trading fees and before either rate moves.",
  );
}

function heroPair(p: ScreenerPair): string {
  const long = venueName(p.long_venue_id);
  const short = venueName(p.short_venue_id);
  const cite = citeMark(
    tr(
      "Widest funding spread across perp exchanges right now: {asset} at {spread} a year. Long {long} at {longApr}, short {short} at {shortApr}.",
      {
        asset: assetTitle(p.asset, p.asset_class),
        spread: plainApr(p.spread_apr),
        long,
        longApr: formatApr(p.long_apr),
        short,
        shortApr: formatApr(p.short_apr),
      },
    ),
    assetHref(p.asset, p.asset_class),
  );
  return `<section class="hero" data-live="hero">
<p class="eyebrow has-help">${tr("Widest funding spread right now")}${helpButton("hero")}</p>${cite}
<div class="hero-head">
<a class="hero-asset" href="${assetHref(p.asset, p.asset_class)}">${assetName(p.asset, p.asset_class)}</a>
<p class="hero-spread"><b data-u="spread">${formatApr(p.spread_apr)}</b><span>${tr("funding spread, per year")}</span></p>
</div>
${renderRail({
  scale: railScale([p.long_apr, p.short_apr]),
  marks: [
    { apr: p.long_apr, tone: "long", label: tr("Long on {venue}", { venue: long }), key: "long" },
    {
      apr: p.short_apr,
      tone: "short",
      label: tr("Short on {venue}", { venue: short }),
      key: "short",
    },
  ],
  bar: [p.long_apr, p.short_apr],
  size: "big",
})}
<div class="legs">
<p class="long" data-u="long"><b>${tr("Long on {venue}", { venue: `<a href="${exchangeHref(p.long_venue_id)}">${esc(long)}</a>` })}</b> ${tr("{symbol} at {apr}", { symbol: esc(p.long_symbol), apr: `<span data-u="long-apr">${formatApr(p.long_apr)}</span>` })}</p>
<p class="short" data-u="short"><b>${tr("Short on {venue}", { venue: `<a href="${exchangeHref(p.short_venue_id)}">${esc(short)}</a>` })}</b> ${tr("{symbol} at {apr}", { symbol: esc(p.short_symbol), apr: `<span data-u="short-apr">${formatApr(p.short_apr)}</span>` })}</p>
</div>
</section>`;
}

export function screener(data: {
  overview: Overview;
  pairs: ScreenerPair[];
  filters: ScreenerFilters;
  now: number;
}): string {
  return layout({
    title: tr("Funding spread screener"),
    description: tr(
      "Filter live cross-exchange funding spreads by open interest, volume and exchange type.",
    ),
    path: "/screener",
    overview: data.overview,
    now: data.now,
    body: `${helpHeading("h1", tr("Funding spread screener"), "screener", `<p>${tr("For each asset, the cheapest market to hold long and the richest to hold short, on different exchanges. Each leg must pass the filters.")}</p>`)}
${filtersForm(data.filters)}
${pairsTable(data.pairs, tr("No pairs match these filters. Lower the minimum open interest or include more exchange types."), data.filters)}`,
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
${select("min_oi", tr("Min open interest, each leg"), f.minOpenInterestUsd, [
  [0, tr("Any")],
  [100_000, "$100k"],
  [250_000, "$250k"],
  [1_000_000, "$1M"],
  [10_000_000, "$10M"],
  [50_000_000, "$50M"],
])}
${select("min_vol", tr("Min 24h volume, each leg"), f.minVolume24hUsd, [
  [0, tr("Any")],
  [100_000, "$100k"],
  [1_000_000, "$1M"],
  [10_000_000, "$10M"],
])}
<fieldset class="field"><legend>${tr("Exchange types")}</legend><div class="checks">${types}</div></fieldset>
<fieldset class="field"><legend>${tr("Settlement")}</legend><div class="checks"><label title="${tr("A USDT leg against a USDC leg carries the basis between the two stablecoins and needs collateral in both. Ticked, each asset is paired only within one quote currency")}"><input type="checkbox" name="quote" value="same"${f.sameQuote ? " checked" : ""}> ${tr("Same quote currency on both legs")}</label></div></fieldset>
<fieldset class="field"><legend>${tr("Distressed markets")}</legend><div class="checks"><label title="${tr("Delisting and distressed listings can pay beyond ±2000% APR and crowd out tradeable spreads")}"><input type="checkbox" name="extremes" value="1"${f.maxAbsApr === null ? " checked" : ""}> ${tr("Include beyond ±1000% APR")}</label></div></fieldset>
${select("limit", tr("Rows"), f.limit, [
  [50, "50"],
  [100, "100"],
  [250, "250"],
  [500, "500"],
])}
${venues}
<div class="actions"><button type="submit">${tr("Apply filters")}</button><a href="/screener">${tr("Reset")}</a></div>
</form>`;
}

const SORT_LABELS: Record<ScreenerSort, string> = {
  spread: msg("Spread"),
  settled_7d: msg("7d settled"),
  venues: msg("Venues"),
  stability: msg("Stability"),
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
  if (!filters) return `${head}>${trMsg(SORT_LABELS[sort])}</th>`;
  const active = filters.sort === sort;
  const href = `/screener${filtersToQuery({ ...filters, sort })}`;
  return `${head}${active ? ' aria-sort="descending"' : ""}><a href="${href}">${trMsg(SORT_LABELS[sort])}</a></th>`;
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
        ? tr("Neither leg has settled funding to score yet")
        : p.long_stability === null
          ? tr("The long leg has no settled funding to score yet")
          : tr("The short leg has no settled funding to score yet");
    return ` title="${esc(which)}"`;
  }
  const days = Math.min(
    p.long_stability_days ?? Number.POSITIVE_INFINITY,
    p.short_stability_days ?? Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(days)) return "";
  return ` title="${esc(tr("Weaker leg held its direction on {days} of its charging days in the last 30", { days }))}"`;
}

/**
 * Marks a quoted gap that is actually positive, where buying on one exchange and selling on the other
 * would take in more than it pays at the quotes shown. A gap that rounds to 0.0 stays plain, since the
 * figure printed beside it says nothing is there.
 */
const gapTone = (bps: number | null): string =>
  bps !== null && Number.isFinite(bps) && bps > 0 && Number(bps.toFixed(1)) !== 0
    ? ' class="gap-pos"'
    : "";

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
      ? tr(
          "This exchange does not say what the leg settles in, so it cannot be shown to match the other leg",
        )
      : tr(
          "Settles in {quote} while the other leg settles in {other}: the pair carries the basis between them",
          { quote, other: otherQuote ?? tr("an undeclared currency") },
        );
  return ` · <span class="qmix" title="${esc(title)}">${esc(quote ?? tr("quote ?"))}</span>`;
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
    `<td><div class="leg ${side}-leg"><a class="venue" href="${exchangeHref(venueId)}">${esc(venueName(venueId))}</a><span class="meta">${esc(symbol)} · ${formatInterval(interval)} · ${tr("OI")} <span data-u="${side}-oi">${formatUsd(oi)}</span>${quoteMark(quote, otherQuote)}</span></div></td>`;

  const cite = (p: ScreenerPair, i: number) =>
    i < 3
      ? citeMark(
          tr(
            "{asset} pays {spread} a year to hold both sides: long {long} at {longApr}, short {short} at {shortApr}. Same coin, two exchanges, price exposure cancelled.",
            {
              asset: assetTitle(p.asset, p.asset_class),
              spread: plainApr(p.spread_apr),
              long: venueName(p.long_venue_id),
              longApr: formatApr(p.long_apr),
              short: venueName(p.short_venue_id),
              shortApr: formatApr(p.short_apr),
            },
          ),
          assetHref(p.asset, p.asset_class),
        )
      : "";
  const rows = pairs
    .map(
      (p, i) => `<tr data-k="${esc(assetKey(p.asset, p.asset_class))}">
<td class="asset"><a href="${assetHref(p.asset, p.asset_class)}">${assetName(p.asset, p.asset_class)}</a>${cite(p, i)}</td>
<td class="num spread">${formatApr(p.spread_apr)}</td>
<td class="rail-cell">${renderRail({
        scale,
        marks: [
          {
            apr: p.long_apr,
            tone: "long",
            label: tr("Long on {venue}", { venue: venueName(p.long_venue_id) }),
            key: "long",
          },
          {
            apr: p.short_apr,
            tone: "short",
            label: tr("Short on {venue}", { venue: venueName(p.short_venue_id) }),
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
<thead><tr><th>${tr("Asset")}</th>${sortableTh("spread", tr("Widest funding gap between two exchanges"), filters)}<th title="${tr("Signed log scale, so ordinary rates keep room next to extreme ones")}">${tr("Long − short, log scale")}</th><th>${tr("Long leg")}</th><th class="num">${tr("Long APR")}</th><th>${tr("Short leg")}</th><th class="num">${tr("Short APR")}</th>${sortableTh("settled_7d", tr("Same two markets, averaged over the settlements of the last 7 days"), filters)}${sortableTh("venues", tr("Exchanges with a live market for this asset"), filters)}${sortableTh("stability", tr("How often the weaker leg held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score"), filters)}</tr></thead>
<tbody data-live="pairs">${rows}</tbody>
</table></div>`;
}

export function exchanges(data: {
  overview: Overview;
  exchanges: ExchangeSummary[];
  now: number;
}): string {
  const live = new Set(data.exchanges.map((e) => e.id));
  const notCollected = VENUES.filter((v) => !live.has(v.id) && !v.aliasOf && !v.retired).map(
    (v) => v.name,
  );
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
    title: tr("Exchanges"),
    description: tr(
      "Perpetual futures exchanges tracked by airrates, with live market counts, open interest and volume.",
    ),
    path: "/markets",
    overview: data.overview,
    now: data.now,
    body: `${helpHeading("h1", tr("Exchanges"), "exchanges", `<p>${tr("Every exchange with markets reported in the last five minutes. Open interest and volume are summed across its perpetual markets, where the exchange reports them.")}</p>`)}
${
  data.exchanges.length === 0
    ? `<div class="sheet-wrap"><p class="empty">${tr("No exchange has reported in the last five minutes.")}</p></div>`
    : `<div class="sheet-wrap"><table class="sheet"><thead><tr><th>${tr("Exchange")}</th><th>${tr("Type")}</th><th class="num">${tr("Live markets")}</th><th class="num">${tr("Open interest")}</th><th class="num">${tr("24h volume")}</th><th class="num">${tr("Updated")}</th></tr></thead><tbody data-live="exchanges">${rows}</tbody></table></div>`
}
<p class="notes">${tr(
      "Not collected yet: {venues}. Some block access from our data location or don't publish a usable funding API.",
      { venues: esc(notCollected.join(", ")) },
    )}</p>`,
  });
}

export function exchange(data: {
  venue: Venue;
  markets: MarketRow[];
  /** Required: the status line reads it, and leaving it out reported every venue as silent. */
  overview: Overview;
  now: number;
  /** The venue's referral CTA, already geo-gated; empty or absent renders nothing. */
  cta?: string;
}): string {
  const { venue, markets, now } = data;
  const oi = markets.reduce((sum, m) => sum + (m.open_interest_usd ?? 0), 0);
  // The two ends of the venue's funding, which is what a reader quoting a venue wants to say.
  const byApr = [...markets].sort((a, b) => b.apr - a.apr);
  const richest = byApr[0];
  const cheapest = byApr.at(-1);
  const cite =
    richest && cheapest
      ? citeMark(
          tr(
            "{venue}: {count} live perp markets, {oi} open interest. Richest funding {richest} at {richestApr} a year; cheapest {cheapest} at {cheapestApr}.",
            {
              venue: venue.name,
              count: markets.length.toLocaleString("en-US"),
              oi: formatUsd(oi),
              richest: richest.venue_symbol,
              richestApr: formatApr(richest.apr),
              cheapest: cheapest.venue_symbol,
              cheapestApr: formatApr(cheapest.apr),
            },
          ),
          exchangeHref(venue.id),
        )
      : "";
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
    title: tr("{venue} funding rates", { venue: venue.name }),
    description: tr(
      "Live funding rates, open interest and volume for every {venue} perpetual market.",
      { venue: venue.name },
    ),
    path: exchangeHref(venue.id),
    overview: data.overview,
    now,
    body: `<p class="eyebrow"><a href="/markets">${tr("Exchanges")}</a> / ${esc(trMsg(VENUE_TYPE_LABEL[venue.type] ?? venue.type))}</p>
<h1>${esc(venue.name)}</h1>
${data.cta ?? ""}
${
  markets.length === 0
    ? `<p class="lede">${tr(
        "No live markets from {venue}: it isn't collected yet, or its last update is more than five minutes old.",
        { venue: esc(venue.name) },
      )}</p>`
    : `<div class="facts" data-live="facts"><span>${tr("{count} live markets", { count: `<b data-u="markets">${markets.length.toLocaleString("en-US")}</b>` })}</span><span>${tr("{value} open interest", { value: `<b data-u="oi">${formatUsd(oi)}</b>` })}</span><span>${tr("updated {value}", { value: `<b>${since(markets[0]?.observed_at ?? null, now)}</b>` })}</span>${cite}</div>
<div class="sheet-wrap stick"><table class="sheet"><thead><tr><th>${tr("Market")}</th><th>${tr("Asset")}</th><th class="num">${tr("Funding APR")}</th><th title="${tr("Signed log scale, so ordinary rates keep room next to extreme ones")}">${tr("Rate, log scale")}</th><th class="num">${tr("7d settled")}</th><th class="num">${tr("Interval")}</th><th class="num">${tr("Next funding")}</th><th class="num">${tr("Mark price")}</th><th class="num">${tr("Open interest")}</th><th class="num">${tr("24h volume")}</th></tr></thead><tbody data-live="markets">${rows}</tbody></table></div>`
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
      ? `<a href="/rates${heatmapToQuery({ ...params, tf })}" aria-current="true">${tf === "now" ? tr("now") : tf}</a>`
      : link({ tf }, tf === "now" ? tr("now") : tf),
  ).join("");

  const header = `<tr><th class="asset">${tr("asset")}</th><th>${tr("open interest")}</th><th>${tr("spread")}</th>${venueIds
    .map((id) => `<th>${esc(venueName(id))}</th>`)
    .join("")}</tr>`;

  let cited = 0;
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
              const href = `${pairHref(row.base, row.assetClass)}?long=${encodeURIComponent(longId)}&short=${encodeURIComponent(shortId)}`;
              const cite =
                cited++ < 3
                  ? citeMark(
                      tr(
                        "{asset} funding runs from {low} on {lowVenue} to {high} on {highVenue}: {gap} a year apart across {count} exchanges.",
                        {
                          asset: assetTitle(row.base, row.assetClass),
                          low: formatApr(low),
                          lowVenue: venueName(longId),
                          high: formatApr(high),
                          highVenue: venueName(shortId),
                          gap: plainApr(high - low),
                          count: present.length,
                        },
                      ),
                      href,
                    )
                  : "";
              return `${cite}<a href="${pairHref(row.base, row.assetClass)}?long=${encodeURIComponent(longId)}&short=${encodeURIComponent(shortId)}">${formatApr(high - low)}</a>`;
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
    tr("← previous"),
    params.offset > 0,
  )}<span class="dim">${tr("assets {from}–{to}", { from: params.offset + 1, to: params.offset + rows.length })}</span>${link(
    { offset: params.offset + params.limit },
    tr("next →"),
    rows.length >= params.limit,
  )}</div>`;

  const grid =
    rows.length === 0
      ? `<div class="sheet-wrap"><p class="empty">${tr("No asset has live markets on two or more venues right now.")}</p></div>`
      : `<div class="heat-wrap"><table class="heat"><thead data-live="rates-head">${header}</thead><tbody data-live="rates">${body}</tbody></table></div>${pager}`;

  return layout({
    title: tr("Rates"),
    description: tr("Funding APR for every asset across every perpetual exchange, in one grid."),
    path: "/rates",
    overview,
    now,
    body: `${helpHeading("h1", tr("Rates"), "rates", `<p>${tr("Every exchange's funding for the deepest assets at once. Positive means longs pay, so a short collects; an empty cell means that exchange has no market for the asset, not that funding is flat.")}</p>`)}
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

  // One schedule for the whole page, covering only the venues actually on it. These are assumed fees,
  // not anyone's real ones, and the lede says so: see app/retail-fees.ts.
  const fees = retailSchedule(rows.flatMap((r) => [r.buy_venue_id, r.sell_venue_id]));

  const body = rows
    .map((r, i) => {
      // The gap is only good for the smaller of the two sides, so that is what the row is titled
      // with. A null depth says so plainly instead of rendering as a zero.
      const title =
        r.thinner_depth_usd === null
          ? tr(
              "One side's resting size is unknown, so the size this gap is good for cannot be stated",
            )
          : tr("Good for about {size} at these quotes, before fees and before either book moves", {
              size: formatUsd(r.thinner_depth_usd),
            });
      // Two fills, not four: a gap is captured by buying once and selling once, and the gap is already
      // quoted bid-to-ask, so each venue's own spread is inside it and must not be charged again.
      const cost = gapCost({
        gapBps: r.gap_bps,
        buyVenueId: r.buy_venue_id,
        sellVenueId: r.sell_venue_id,
        fees,
      });
      const netTitle = tr(
        "{gap} less {fee} bps of taker fee, one fill on each side. The transfer a real position needs is not counted.",
        { gap: formatGapBps(r.gap_bps), fee: formatGapBps(cost.takerBps) },
      );
      return `<tr data-k="${esc(assetKey(r.asset, r.asset_class))}">
<td class="asset"><a href="${priceHref(r.asset, r.asset_class)}">${assetName(r.asset, r.asset_class)}</a>${
        i < 3
          ? citeMark(
              tr(
                "{asset}: buy on {buyVenue} at {buyPrice}, sell on {sellVenue} at {sellPrice}. A {gap} bps gap, good for {size} at the top of the book.",
                {
                  asset: assetTitle(r.asset, r.asset_class),
                  buyVenue: venueName(r.buy_venue_id),
                  buyPrice: formatPrice(r.buy_price),
                  sellVenue: venueName(r.sell_venue_id),
                  sellPrice: formatPrice(r.sell_price),
                  gap: formatGapBps(r.gap_bps),
                  size: formatUsd(r.thinner_depth_usd),
                },
              ),
              priceHref(r.asset, r.asset_class),
            )
          : ""
      }</td>
<td class="num spread" title="${esc(title)}"><span data-u="gap"${gapTone(r.gap_bps)}>${formatGapBps(r.gap_bps)}</span></td>
<td class="num spread" title="${esc(netTitle)}"><span data-u="net"${gapTone(cost.netBps)}>${formatGapBps(cost.netBps)}</span></td>
<td class="num" title="${esc(title)}">${formatUsd(r.thinner_depth_usd)}</td>
${side("buy", r.buy_venue_id, r.buy_symbol, r.buy_price, r.buy_depth_usd)}
${side("sell", r.sell_venue_id, r.sell_symbol, r.sell_price, r.sell_depth_usd)}
<td class="num dim">${r.venue_count}</td>
<td class="dim" title="${esc(tr("Quotes seen {quoted}; the older leg's funding row fetched {fetched}", { quoted: ageText(r.oldest_quoted_at, now), fetched: ageText(r.oldest_observed_at, now) }))}">${since(r.oldest_quoted_at, now)}</td>
</tr>`;
    })
    .join("");

  const pager = `<div class="pager" data-live="arb-pager">${link(
    { offset: Math.max(0, params.offset - params.limit) },
    tr("← previous"),
    params.offset > 0,
  )}<span class="dim">${tr("assets {from}–{to}", { from: params.offset + 1, to: params.offset + rows.length })}</span>${link(
    { offset: params.offset + params.limit },
    tr("next →"),
    rows.length >= params.limit,
  )}</div>`;

  const table =
    rows.length === 0
      ? `<div class="sheet-wrap"><p class="empty">${tr("No asset quotes a gap this wide right now. The median comparable asset sits near 1.6 bps, so try a lower floor.")}</p></div>`
      : `<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>${tr("Asset")}</th><th class="num" title="${tr("Highest bid against lowest ask, across two different exchanges")}">${tr("Gap, bps")}</th><th class="num" title="${tr("The gap less one taker fee on each side, at an assumed retail rate. The transfer a real position needs is not counted.")}">${tr("Net, bps")}</th><th class="num" title="${tr("The smaller of the two resting sizes: what the gap is actually good for")}">${tr("Good for")}</th><th>${tr("Buy at")}</th><th class="num">${tr("Ask size")}</th><th>${tr("Sell at")}</th><th class="num">${tr("Bid size")}</th><th class="num" title="${tr("Exchanges quoting this asset that survived the mark-agreement check")}">${tr("Venues")}</th><th>${tr("Quoted")}</th></tr></thead>
<tbody data-live="arb">${body}</tbody>
</table></div>${pager}`;

  return layout({
    title: tr("Price gaps across exchanges"),
    description: tr(
      "Where one exchange's bid sits above another's ask, with the size resting at each quote.",
    ),
    path: "/arbitrage",
    overview,
    now,
    body: `${helpHeading(
      "h1",
      tr("Price gaps"),
      "arbitrage",
      `<p>${tr(
        "For each asset, the cheapest exchange to buy and the dearest to sell, at the top of each book. These are <b>quotable gaps at the size shown</b>, not fillable trades: nothing here reflects the book below level 1, or the two transfers a real position needs. <b>Net</b> charges {bps} bps of taker fee on each side, one fill to buy and one to sell — a retail rate, not yours, and a VIP tier pays less. The transfer is not in it. The widest gaps sit on the thinnest books — when this was measured, 395 of 721 assets showed any gap at a median of 1.6 bps, while the leaders were good for as little as $3 of resting size. Read the <b>good for</b> column before the gap.",
        { bps: RETAIL_TAKER_BPS },
      )}</p>`,
    )}
${filtersForArbitrage(params)}
${table}`,
  });
}

/** Two floors, both of which default to showing more rather than less. */
function filtersForArbitrage(params: ArbitrageParams): string {
  const option = (value: number, label: string, current: number) =>
    `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`;
  return `<form class="filters" method="get" action="/arbitrage">
<label class="field">${tr("Min gap, bps")}<select name="min_bps">${[
    [0, tr("Any, including 0.0")],
    [1, "1"],
    [5, "5"],
    [25, "25"],
    [100, "100"],
  ]
    .map(([value, label]) => option(value as number, label as string, params.minGapBps))
    .join("")}</select></label>
<label class="field">${tr("Min resting size")}<select name="min_depth">${[
    [0, tr("Any")],
    [1_000, "$1k"],
    [10_000, "$10k"],
    [100_000, "$100k"],
  ]
    .map(([value, label]) => option(value as number, label as string, params.minDepthUsd))
    .join("")}</select></label>
<div class="actions"><button type="submit">${tr("Apply")}</button><a href="/arbitrage">${tr("Reset")}</a></div>
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
        ? tr("This venue's mark disagrees with the rest, so it is excluded from the gap")
        : off >= 1
          ? tr(
              "Marked {ratio}× above this asset's deepest market, so it is a different instrument, not a price gap",
              { ratio: off.toFixed(1) },
            )
          : tr(
              "Marked {ratio}× below this asset's deepest market, so it is a different instrument, not a price gap",
              { ratio: (1 / off).toFixed(1) },
            );
    return `<tr data-k="${esc(`${q.venue_id}|${q.venue_symbol}`)}"${q.mark_agrees ? "" : ` class="dim" title="${esc(why)}"`}>
<td><div class="leg${q === lowestAsk ? " buy-leg" : q === highestBid ? " sell-leg" : ""}"><a class="venue" href="${exchangeHref(q.venue_id)}">${esc(venueName(q.venue_id))}</a><span class="meta">${esc(q.venue_symbol)}</span></div></td>
<td class="num"><span data-u="bid">${formatPrice(q.best_bid)}</span>${q === highestBid ? ` <span class="dim">${tr("best")}</span>` : ""}</td>
<td class="num">${formatUsd(q.best_bid_size_usd)}</td>
<td class="num"><span data-u="ask">${formatPrice(q.best_ask)}</span>${q === lowestAsk ? ` <span class="dim">${tr("best")}</span>` : ""}</td>
<td class="num">${formatUsd(q.best_ask_size_usd)}</td>
<td class="num" title="${tr("This venue's own bid-ask spread, which a taker crosses on entry and again on exit")}">${formatGapBps(inVenueBps)}</td>
<td class="num"${q.mark_price === null ? ` title="${tr("This venue's funding row has not been refreshed within the freshness window, so its mark is withheld rather than shown stale — the quote beside it is live")}"` : ""}>${formatPrice(q.mark_price)}</td>
<td class="dim" title="${esc(tr("Quote seen {quoted}; funding row fetched {fetched}", { quoted: ageText(q.quotes_at, now), fetched: ageText(q.observed_at, now) }))}">${since(q.quotes_at, now)}</td>
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
      : `<div class="section-head"><h2 class="has-help">${tr("Every pair")}${helpButton("pairs")}</h2></div>
${helpPanel("pairs", `<p>${tr("One row per direction: buy at the first exchange, sell at the second. The widest gap is often not the one to take — a narrower pair can rest far more size behind it, and most directions lose outright.")}</p>`)}
<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>${tr("Buy at")}</th><th>${tr("Sell at")}</th><th class="num">${tr("Gap, bps")}</th><th class="num" title="${tr("The smaller of the buying side's ask size and the selling side's bid size — what this direction is good for")}">${tr("Good for")}</th></tr></thead>
<tbody data-live="pp-pairs">${pairs
          .map(
            (p) => `<tr data-k="${esc(`pair:${p.buy.venue_id}|${p.sell.venue_id}`)}"${
              p.gapBps > 0 ? "" : ' class="dim"'
            }>
<td><div class="leg buy-leg"><a class="venue" href="${exchangeHref(p.buy.venue_id)}">${esc(venueName(p.buy.venue_id))}</a></div></td>
<td><div class="leg sell-leg"><a class="venue" href="${exchangeHref(p.sell.venue_id)}">${esc(venueName(p.sell.venue_id))}</a></div></td>
<td class="num spread"><span data-u="pair-gap"${gapTone(p.gapBps)}>${formatGapBps(p.gapBps)}</span>${p.buy === lowestAsk && p.sell === highestBid ? ` <span class="dim">${tr("best")}</span>` : ""}</td>
<td class="num"><span data-u="pair-depth">${formatUsd(p.goodForUsd)}</span></td>
</tr>`,
          )
          .join("")}</tbody>
</table></div>`;

  const headline =
    crossVenue === null
      ? `<p class="lede" data-live="pp-lede">${tr("No two exchanges quote {asset} in a way that can be compared right now.", { asset: esc(name) })}</p>`
      : `<p class="lede" data-live="pp-lede">${(() => {
          const values = {
            buy: `<b>${esc(venueName((lowestAsk as PriceQuote).venue_id))}</b>`,
            sell: `<b>${esc(venueName((highestBid as PriceQuote).venue_id))}</b>`,
            gap: `<b data-u="pp-gap">${formatGapBps(crossVenue)} bps</b>`,
            size: `<b>${formatUsd(goodFor)}</b>`,
          };
          return goodFor === null
            ? tr(
                "Buying on {buy} and selling on {sell} quotes {gap}, though one side's resting size is unknown.",
                values,
              )
            : tr(
                "Buying on {buy} and selling on {sell} quotes {gap}, good for about {size}.",
                values,
              );
        })()}</p>`;

  const excluded =
    rejected.length === 0
      ? ""
      : `<p class="notes">${(() => {
          const values = {
            count: rejected.length,
            venues: rejected.map((q) => esc(venueName(q.venue_id))).join(", "),
            status: `<a href="/status">${tr("Status")}</a>`,
          };
          return rejected.length === 1
            ? tr(
                "{count} venue is shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.",
                values,
              )
            : tr(
                "{count} venues are shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.",
                values,
              );
        })()}</p>`;

  return layout({
    title: tr("{asset} price gaps by exchange", { asset: assetTitle(name, assetClass) }),
    description: tr(
      "{asset} best bid and ask on every exchange that quotes it, with the size resting at each.",
      { asset: name },
    ),
    path: priceHref(name, assetClass),
    overview: data.overview,
    now,
    body: `<p class="eyebrow"><a href="/arbitrage">${tr("Price gaps")}</a></p>
${helpHeading("h1", assetName(name, assetClass), "price-pair", `<p>${tr("That is a quote at the size shown, not a fillable trade: it is before fees, before the book below level 1, and before the transfer between two exchanges.")}</p>`)}
${headline}
${pairsTable}
<div class="section-head"><h2 class="has-help">${tr("Every exchange")}${helpButton("quotes")}</h2></div>
${helpPanel("quotes", `<p>${tr("Sizes are the money resting at the very top of each book, converted to USD because the three venues that publish depth count it differently — Gate in contracts, OKX in contracts against <code>ctVal</code>, Bybit in base coin. Reading those raw, side by side, is a 10,000× error.")}</p>`)}
<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>${tr("Exchange")}</th><th class="num">${tr("Best bid")}</th><th class="num">${tr("Bid size")}</th><th class="num">${tr("Best ask")}</th><th class="num">${tr("Ask size")}</th><th class="num" title="${tr("The venue's own bid-ask spread in basis points")}">${tr("Own spread")}</th><th class="num">${tr("Mark")}</th><th>${tr("Quoted")}</th></tr></thead>
<tbody data-live="pp-quotes">${quotes.map(row).join("")}</tbody>
</table></div>
${excluded}`,
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
  /** Null when the liquidations table could not be read, which is not the same as no liquidations. */
  liquidationFeeds: LiquidationFeedRow[] | null;
  /** Null when the verification table could not be read at all, which is not the same as empty. */
  checks: IdentityCheckRow[] | null;
  now: number;
}): string {
  // The body stays in English for every reader, by the owner's choice: it is an operator's page, and
  // its verdicts and evidence are read against the collector's own logs. The masthead and footer
  // around it still follow the reader's language, so the site does not change language underneath them.
  return layout({
    title: "Collector status",
    description: "Whether each exchange is delivering data right now, and what failed if not.",
    path: "/status",
    overview: data.overview,
    now: data.now,
    body: withLocale("en", () => statusBody(data)),
  });
}

function statusBody(data: {
  venues: VenueStatus[];
  liquidationFeeds: LiquidationFeedRow[] | null;
  checks: IdentityCheckRow[] | null;
  now: number;
}): string {
  const { venues, checks, liquidationFeeds, now } = data;
  // An alias has no feed of its own; listing it would report another venue's health twice. A retired
  // venue keeps its `venues` row for the foreign keys, but it is neither a fault nor a backlog item.
  const hidden = new Set(VENUES.filter((v) => v.aliasOf || v.retired).map((v) => v.id));
  const rows = venues
    // A `<venue>:liq` row is one liquidation feed's own health, not a second copy of that exchange's
    // collection. It belongs in the liquidation tab, where its silence can be read against how often
    // that venue actually liquidates, instead of sitting here as an exchange listing no markets.
    .filter((v) => !hidden.has(v.venue_id) && !v.venue_id.endsWith(":liq"))
    .map((v) => ({ status: v, state: venueState(v, now) }))
    .sort(
      (a, b) =>
        STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
        b.status.live_markets - a.status.live_markets ||
        a.status.name.localeCompare(b.status.name),
    );

  const tally = (state: VenueState) => rows.filter((r) => r.state === state).length;
  // Planned venues are the scaling backlog, not the operational picture. Phase 5 inverted the
  // arithmetic -- 1 planned against 56 collected, where it was 41 against 20 -- so they no longer
  // bury the rows that can break. They stay separate because a venue with no feed has no health to
  // report, which is a different claim from "there are too many of them to list".
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

  return `<p class="eyebrow">Collector</p>
${helpHeading("h1", "Status", "status", '<p>Whether each exchange is actually delivering data. That is a different question from the <a href="/probe">geo-probe</a>, which asks only whether the endpoint answers: a venue can reply and still return nothing, which is what <b>empty</b> means here and why it is coloured as a fault.</p>')}
${tabBar({
  name: "status",
  tabs: [
    { id: "collector", label: "Collector", shortLabel: "Health" },
    {
      id: "liquidations",
      label: "Liquidation feeds",
      shortLabel: "Liq feeds",
      badge: FEEDS.filter((feed) => feed.verdict === "live").length,
    },
    {
      id: "verification",
      label: "Price verification",
      shortLabel: "Prices",
      // Absent when nothing diverges, and absent when the check has not run: a badge of 0
      // would claim a clean result the page may not have.
      badge: checks === null ? 0 : verified.length,
    },
  ],
  activeId: "collector",
})}
<div class="tabpanel" role="tabpanel" id="panel-status-collector" data-tab-panel="collector" aria-labelledby="tab-status-collector">
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
</div>
<div class="tabpanel" role="tabpanel" id="panel-status-liquidations" data-tab-panel="liquidations" aria-labelledby="tab-status-liquidations">
${liquidationFeedTable({ feeds: liquidationFeeds, venues, now })}
</div>
<div class="tabpanel" role="tabpanel" id="panel-status-verification" data-tab-panel="verification" aria-labelledby="tab-status-verification">
${helpHeading("h2", "Price verification", "verification", `<p>Whether each market really is the asset it is filed under. Every asset is anchored on its deepest market by open interest, and a market disagreeing with that anchor by more than 10% is judged on whether its minute returns follow it. Correlation decides, never the size of the gap: a ratio landing near a clean 10× is a coincidence, not evidence — Gate quotes <b>PURR</b> at 104.6× Hyperliquid's on a correlation of 0.005, and they are simply different assets. <b>mismatch</b> means two unrelated assets share one ticker.</p>`)}
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
</div>
${
  planned.length === 0
    ? ""
    : `<p class="notes"><b>${planned.length}</b> more exchanges are catalogued but not collected yet — either no adapter has been built for them, or one exists and is deliberately held back, so they are a backlog rather than a fault: ${planned
        .map((r) => esc(r.status.name))
        .join(", ")}.</p>`
}`;
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
    ? tr(
        "Best pair: long on {long} at {longApr}, short on {short} at {shortApr}, a {spread} spread per year.",
        {
          long: esc(venueName(pair.long.venue_id)),
          longApr: `<span data-u="best-long">${formatApr(pair.long.apr)}</span>`,
          short: esc(venueName(pair.short.venue_id)),
          shortApr: `<span data-u="best-short">${formatApr(pair.short.apr)}</span>`,
          spread: `<span data-u="best-spread">${formatApr(pair.short.apr - pair.long.apr)}</span>`,
        },
      )
    : venues < 2
      ? tr("Only one exchange lists it right now, so there's no cross-exchange pair.")
      : tr(
          "No two exchanges have at least {minOi} open interest in it, so there's no pair to show.",
          { minOi: formatUsd(minOi) },
        );

  return layout({
    title: tr("{asset} funding rates by exchange", { asset: assetTitle(data.asset, assetClass) }),
    description: tr(
      "{asset} perpetual funding rates across {count} exchanges, with the widest long/short spread.",
      { asset: assetTitle(data.asset, assetClass), count: venues },
    ),
    path: assetHref(data.asset, assetClass),
    overview: data.overview,
    now,
    body: `<p class="eyebrow">${tr("Funding by exchange")}</p>
${helpHeading("h1", assetName(data.asset, assetClass), "asset", `<p>${tr("Only markets with at least {minOi} open interest are paired.", { minOi: formatUsd(minOi) })}</p>`)}
<p class="lede" data-live="asset-lede">${tr("{markets} live markets on {venues} exchanges.", { markets: markets.length, venues })} ${summary}${
      pair
        ? citeMark(
            tr(
              "{asset} funding across {count} exchanges: long {long} at {longApr}, short {short} at {shortApr}. A {spread} spread a year on one coin.",
              {
                asset: assetTitle(data.asset, assetClass),
                count: venues,
                long: venueName(pair.long.venue_id),
                longApr: formatApr(pair.long.apr),
                short: venueName(pair.short.venue_id),
                shortApr: formatApr(pair.short.apr),
                spread: plainApr(pair.short.apr - pair.long.apr),
              },
            ),
            assetHref(data.asset, assetClass),
          )
        : ""
    }</p>
<div class="cta" data-live="asset-cta">${
      pair
        ? `<a class="btn" href="${pairHref(data.asset, assetClass)}?long=${encodeURIComponent(pair.long.venue_id)}&short=${encodeURIComponent(pair.short.venue_id)}" data-await>${tr("Backtest this pair")} <span aria-hidden="true">→</span></a><span class="dim">${tr(
            "long {long} · short {short} · {spread} a year, replayed on settled funding",
            {
              long: esc(venueName(pair.long.venue_id)),
              short: esc(venueName(pair.short.venue_id)),
              spread: `<span data-u="cta-spread">${formatApr(pair.short.apr - pair.long.apr)}</span>`,
            },
          )}</span>`
        : ""
    }</div>
<div class="asset-rail" data-live="asset-rail">${renderRail({ scale, marks, bar: pair ? [pair.long.apr, pair.short.apr] : undefined, size: "big" })}</div>
<div class="sheet-wrap"><table class="sheet"><thead><tr><th>${tr("Exchange")}</th><th class="num">${tr("Funding APR")}</th><th class="num">${tr("24h settled")}</th><th class="num">${tr("7d settled")}</th><th class="num" title="${tr("How often this market held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score")}">${tr("Stability")}</th><th class="num" title="${tr("Last 7 charging days against the days before them, in APR points. Up means funding is widening in the direction it already had")}">${tr("30d trend")}</th><th class="num">${tr("Interval")}</th><th class="num">${tr("Next funding")}</th><th class="num">${tr("Mark price")}</th><th class="num">${tr("Open interest")}</th><th class="num">${tr("24h volume")}</th></tr></thead><tbody data-live="asset-markets">${rows}</tbody></table></div>`,
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
    return tr("capital {amount} — {venue} will not open a position above {max} on {symbol}", {
      amount: "<b>–</b>",
      venue: esc(venueName(capital.venueId)),
      max: wholeMoney(capital.maxNotionalUsd),
      symbol: esc(capital.venueSymbol),
    });
  }
  const amount = `<b>${wholeMoney(capital.capitalUsd)}</b>`;
  if (capital.kind === "tiered") {
    return tr("capital {amount} across both legs at {leverage}", {
      amount,
      leverage: formatLeverage(capital.leverage),
    });
  }
  if (capital.leverage === null)
    return tr("capital {amount} across both legs, unleveraged", { amount });
  const leverage = formatLeverage(capital.leverage);
  return capital.beyondHeadline
    ? tr("capital at least {amount} across both legs — {leverage} is the small-size maximum", {
        amount,
        leverage,
      })
    : tr("capital {amount} across both legs at {leverage} (small size)", { amount, leverage });
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
<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${tr("Cumulative funding reaches {amount} after {days} days", { amount: money(end), days: points.length })}">
<polygon class="curve-area" points="${area}"></polygon>
<line class="curve-zero" x1="${pad}" x2="${width - pad}" y1="${zero}" y2="${zero}"></line>
<polyline class="curve-line" points="${line}"></polyline>
</svg>
<figcaption>${tr("Cumulative funding on {size} per leg · {from} to {to}", { size: wholeMoney(sizeUsd), from: esc(first), to: esc(last) })}</figcaption>
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
  return `<label class="field" title="${tr("Taker fee in basis points, per fill. Both legs must be filled in before costs are charged.")}">${label} (bps)<input type="number" name="${name}" value="${esc(value)}" min="0" max="${MAX_TAKER_FEE_BPS}" step="0.1" placeholder="${tr("blank = ignore")}" inputmode="decimal"></label>`;
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
  return `<div class="tf" aria-label="${tr("Window")}">${links}</div>`;
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
    `<label class="field">${name === "long" ? tr("Long on") : tr("Short on")}<select name="${name}">${venues
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

  return `<form class="filters" method="get" action="${pairHref(asset, assetClass)}" data-await>
${venueField("long", params?.longVenueId)}
${venueField("short", params?.shortVenueId)}
${numberField("size", tr("Size per leg"), params?.sizeUsd ?? 10_000, [
  [1_000, "$1k"],
  [10_000, "$10k"],
  [25_000, "$25k"],
  [100_000, "$100k"],
  [1_000_000, "$1M"],
])}
<input type="hidden" name="days" value="${days}">
${feeField("fee_long", tr("Long taker fee"), params?.longTakerBps ?? null)}
${feeField("fee_short", tr("Short taker fee"), params?.shortTakerBps ?? null)}
<div class="actions"><button type="submit">${tr("Run backtest")}</button>${
    params
      ? `<a class="btn" href="${pairHref(asset, assetClass)}${backtestToQuery({ ...params, longVenueId: params.shortVenueId, shortVenueId: params.longVenueId })}" data-await>⇄ ${tr("swap legs")}</a>`
      : ""
  }<a class="btn" href="${priceHref(asset, assetClass)}" title="${tr("What entering and exiting would cost at each exchange's top of book")}">${tr("price gap")}</a></div>
</form>`;
}

/**
 * A post on X with the result already written, linking back with `ref=x` so the visit counts under
 * its source (app/visits.ts). The text carries the page's own figure and nothing larger: net of fees
 * when both were entered, otherwise funding alone, and it says which.
 */
function shareOnX(
  asset: string,
  assetClass: AssetClass,
  params: BacktestParams,
  result: BacktestResult,
  origin: string,
): string {
  const net = result.netAfterCostsUsd ?? result.netFundingUsd;
  const label = assetClass === "crypto" ? asset : `${asset} (${assetClass})`;
  const span = params.days === 1 ? tr("day") : tr("{n} days", { n: params.days });
  const values = {
    asset: label,
    long: venueName(result.long.venueId),
    short: venueName(result.short.venueId),
    net: money(net),
    size: wholeMoney(params.sizeUsd),
    span,
  };
  const text =
    result.netAfterCostsUsd === null
      ? tr(
          "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, before fees. Replayed from settled funding:",
          values,
        )
      : tr(
          "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, after fees. Replayed from settled funding:",
          values,
        );
  const link = `${origin}${pairHref(asset, assetClass)}${backtestToQuery(params)}&ref=x`;
  const cite = citeMark(
    // The post ends on a colon that leads into the link; the quoted line stands alone, so it ends on
    // a full stop -- in either script.
    text.replace(/:$/, ".").replace(/：$/, "。"),
    `${pairHref(asset, assetClass)}${backtestToQuery(params)}`,
  );
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
  return `<div class="cta">${cite}<a class="btn" href="${esc(intent)}" target="_blank" rel="noopener">${tr("Share on X")}</a><span class="dim">${tr("opens a post with this result and a link back to it")}</span></div>`;
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
  const net = `<span>${tr("after costs {net} on {fees} of fees", {
    net: `<b class="${result.netAfterCostsUsd >= 0 ? "up" : "down"}">${money(result.netAfterCostsUsd)}</b>`,
    fees: money(result.costsUsd),
  })}</span>`;
  const payback =
    result.paybackDays === null
      ? `<span class="dim">${tr("never repays the fees at this rate")}</span>`
      : `<span>${tr("fees repay in {days}", {
          days: `<b>${result.paybackDays < 1 ? tr("under a day") : tr("{n} days", { n: Math.round(result.paybackDays) })}</b>`,
        })}</span>`;
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
  const when = (date: string) => {
    const [, month, day] = date.split("-");
    return tr("{month} {day}", {
      month: trMsg(months[Number(month) - 1] ?? ""),
      day: Number(day),
    });
  };
  const drawdown = result.maxDrawdownUsd > 0 ? money(-result.maxDrawdownUsd) : money(0);
  return `<span>${tr("best day {amount} {date}", { amount: `<b>${money(bestDay.netUsd)}</b>`, date: when(bestDay.date) })}</span><span>${tr("worst day {amount} {date}", { amount: `<b>${money(worstDay.netUsd)}</b>`, date: when(worstDay.date) })}</span><span title="${tr("The largest fall in cumulative funding from a previous high, before costs")}">${tr("max drawdown {amount}", { amount: `<b>${drawdown}</b>` })}</span>`;
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
  /** The site's own origin: a post on X needs an absolute link back to the result. */
  origin: string;
  now: number;
}): string {
  const {
    asset,
    assetClass,
    markets,
    params,
    days,
    result,
    tiers,
    history,
    overview,
    origin,
    now,
  } = data;
  const venues = new Set(markets.map((m) => m.venue_id)).size;
  const legMarket = (venueId: string, venueSymbol: string) =>
    markets.find((m) => m.venue_id === venueId && m.venue_symbol === venueSymbol);
  // What each leg charges right now, against its average over the window and how often it settles.
  // A leg quoting far above its own average is paying for a spike, not a carry.
  const legRates = (leg: BacktestResult["long"]) => {
    const market = legMarket(leg.venueId, leg.venueSymbol);
    const average =
      leg.averageAprPercent === null
        ? ""
        : tr("{days}d avg {apr}", { days, apr: apr(leg.averageAprPercent) });
    if (!market) return average ? ` · ${average}` : "";
    const values = {
      apr: apr(market.apr),
      average,
      interval: formatInterval(market.interval_hours),
    };
    return ` · ${
      average
        ? tr("now {apr}, {average}, every {interval}", values)
        : tr("now {apr}, every {interval}", values)
    }`;
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
<p class="eyebrow has-help">${tr("net funding over the last {span} · {apr} annualized", {
          span: params.days === 1 ? tr("day") : tr("{n} days", { n: params.days }),
          apr: formatApr(result.netFundingAprPercent),
        })}${helpButton("result")}</p>
${helpPanel("result", `<p>${costsNote(result, params)}</p>`)}
<div class="pair-legs">
<span class="long"><b>${tr("Long {venue}", { venue: esc(venueName(result.long.venueId)) })}</b> ${esc(result.long.venueSymbol)} · ${tr("{n} settlements", { n: result.long.settlements })} · ${money(result.long.fundingUsd)}${legRates(result.long)}</span>
<span class="short"><b>${tr("Short {venue}", { venue: esc(venueName(result.short.venueId)) })}</b> ${esc(result.short.venueSymbol)} · ${tr("{n} settlements", { n: result.short.settlements })} · ${money(result.short.fundingUsd)}${legRates(result.short)}</span>
</div>
${equityCurve(result, params.sizeUsd)}
<div class="facts"><span>${tr("win rate {value} of {days} days", { value: `<b>${Math.round(result.winRateDays * 100)}%</b>`, days: result.perDay.length })}</span><span>${tr("average {value} a day", { value: `<b>${money(result.avgDailyUsd)}</b>` })}</span>${rangeFacts(result)}<span>${capitalFact(capital ?? pairCapital(params.sizeUsd, undefined, undefined, tiers))}</span>${costsFact(result)}</div>
${shareOnX(asset, assetClass, params, result, origin)}
${
  result.long.missedSettlements > 0 || result.short.missedSettlements > 0
    ? `<p class="notes">${tr(
        "Missed settlements: {long} on {longVenue}, {short} on {shortVenue}. A gap is reported rather than counted as zero, so this total covers only the settlements actually recorded.",
        {
          long: result.long.missedSettlements,
          longVenue: esc(venueName(result.long.venueId)),
          short: result.short.missedSettlements,
          shortVenue: esc(venueName(result.short.venueId)),
        },
      )}</p>`
    : ""
}
${
  result.perDay.length > 0 && result.perDay.length < params.days - 1
    ? `<p class="notes">${tr(
        "Only {have} of the {asked} days asked for have stored settlements. The annualized figure still divides by the whole window, so it reads low. The daily rollup keeps 70 days, and history is still filling on some venues.",
        { have: result.perDay.length, asked: params.days },
      )}</p>`
    : ""
}
${result.costsUsd === null ? `<p class="notes">${tr("Funding only, before trading fees: none were entered.")}</p>` : ""}`
      : `<p class="lede">${
          venues < 2
            ? tr("Only one exchange lists {asset} right now, so there's no pair to hold.", {
                asset: esc(asset),
              })
            : tr("Pick two exchanges to hold against each other.")
        }</p>`;

  return layout({
    title: tr("{asset} funding carry backtest", { asset: assetTitle(asset, assetClass) }),
    description: tr(
      "What holding {asset} long on one exchange and short on another would have paid in funding.",
      { asset: assetTitle(asset, assetClass) },
    ),
    path: pairHref(asset, assetClass),
    overview,
    now,
    body: `<p class="eyebrow"><a href="${assetHref(asset, assetClass)}">${assetName(asset, assetClass)}</a> / ${tr("backtest")}</p>
${helpHeading("h1", tr("{asset} carry", { asset: assetName(asset, assetClass) }), "pair", `<p>${tr("Every exchange's funding over one window, and what the two legs you pick actually settled, summed per UTC day. Windows are whole calendar days ending today, and the figures refresh hourly.")}</p>`)}
${backtestForm(asset, assetClass, markets, params, days)}
${windowStrip(asset, assetClass, params, days)}
${renderFundingChart(history, legs)}
${body}`,
  });
}

/** How the result was costed, for its "?" panel: what is charged, and what is not modelled. */
function costsNote(result: BacktestResult, params: BacktestParams): string {
  return result.costsUsd === null
    ? tr(
        "Funding only, on a position kept at {size} per leg. Trading fees are excluded because none were given: taker fees depend on your own volume tier and discounts, so fill in both legs' fees above to see this net of costs. Price moves between settlements aren't modelled either, because venue funding history gives a rate and a time, and almost never a mark price.",
        { size: wholeMoney(params.sizeUsd) },
      )
    : tr(
        "Net of the fees you entered, on a position kept at {size} per leg: {long} bps long and {short} bps short, charged on four fills — entry and exit on both legs. Opening and closing once is assumed; rolling the position would cost this again each time. Price moves between settlements still aren't modelled, because venue funding history gives a rate and a time, and almost never a mark price.",
        {
          size: wholeMoney(params.sizeUsd),
          long: formatBps(params.longTakerBps),
          short: formatBps(params.shortTakerBps),
        },
      );
}

/** Rate limited. Says plainly that cached results are never limited, so the advice is actionable. */
export function tooMany(path: string, now: number): string {
  return layout({
    title: tr("Too many requests"),
    description: tr("Too many backtests from this address."),
    path,
    now,
    body: `<h1>${tr("Too many requests")}</h1>
<p class="lede">${tr("That is more backtests than one address may run in a minute. Wait a moment and try again. Results already computed are served from the cache and are never limited, so a combination someone has run before still loads immediately.")}</p>
<p><a href="/screener">${tr("Back to the screener")}</a></p>`,
  });
}

export function notFound(path: string, now: number, message?: string): string {
  return layout({
    title: tr("Not found"),
    description: tr("Page not found."),
    path,
    now,
    body: `<h1>${tr("Not found")}</h1><p class="lede">${esc(message ?? tr("Nothing lives at {path}.", { path }))}</p><p><a href="/">${tr("See today's widest spreads")}</a></p>`,
  });
}

/** A stick-figure runner; the legs and arms swing in CSS (layout.ts), so it needs no script. */
const runnerSvg =
  () => `<svg class="runner" viewBox="0 0 120 90" role="img" aria-label="${tr("A runner sprinting")}">
<line class="ground" x1="0" y1="84" x2="120" y2="84"/>
<g class="body">
<circle class="head" cx="62" cy="14" r="7"/>
<line x1="62" y1="22" x2="58" y2="46"/>
<g class="limb" style="transform-origin:61px 26px">
<line x1="61" y1="26" x2="61" y2="38"/><g class="shin" style="transform-origin:61px 38px"><line x1="61" y1="38" x2="61" y2="50"/></g>
</g>
<g class="limb lag" style="transform-origin:61px 26px">
<line x1="61" y1="26" x2="61" y2="38"/><g class="shin" style="transform-origin:61px 38px"><line x1="61" y1="38" x2="61" y2="50"/></g>
</g>
<g class="limb" style="transform-origin:58px 46px">
<line x1="58" y1="46" x2="58" y2="62"/><g class="shin" style="transform-origin:58px 62px"><line x1="58" y1="62" x2="58" y2="78"/></g>
</g>
<g class="limb lag" style="transform-origin:58px 46px">
<line x1="58" y1="46" x2="58" y2="62"/><g class="shin" style="transform-origin:58px 62px"><line x1="58" y1="62" x2="58" y2="78"/></g>
</g>
</g>
</svg>`;

export function unavailable(path: string, now: number): string {
  return layout({
    title: tr("Data center busy"),
    description: tr("The data center is too busy and a runner is on it. Try again later."),
    path,
    now,
    body: `<div class="busy" role="status">${runnerSvg()}<h1>${tr("The data center is getting too busy and is currently sprinting in circles")}</h1><p class="lede" style="margin-inline:auto">${tr("Every server is screaming, the funding rates are on fire, and one intern is running the whole thing on foot. Go touch grass and try again later.")}</p><p><a href="${esc(path)}">${tr("Try again")}</a></p></div>`,
  });
}

export { DEFAULT_FILTERS };
