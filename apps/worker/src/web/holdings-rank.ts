import type { PortfolioHolding } from "../app/holdings-data";
import { formatUsd } from "./format";
import { tr } from "./i18n";

/**
 * The investor page's ranking tables and upside histogram, as pure functions of the latest period's
 * holdings (web/holdings-investor.ts draws them).
 *
 * THE FOURTEEN SORTS are the owner's list (2026-10-29), each a filter and an order as
 * plans/holdings/README.md "Ranking sorts" defines them. They run here over the rows the page has
 * already read, rather than as fourteen queries: an idea is at most a few hundred positions.
 */

/**
 * The fair value's display name. The owner names it later (2026-10-30), so this is the ONE place the
 * words live: every label that mentions it takes it from here.
 */
export const fairValueName = () => tr("Fair value");

const MINUS = "−";

/** "+13.7%", "−6.3%", "0.0%". */
export function signedPct(value: number, digits = 1): string {
  const text = Math.abs(value).toFixed(digits);
  return `${value > 0 && Number(text) !== 0 ? "+" : value < 0 && Number(text) !== 0 ? MINUS : ""}${text}%`;
}

/** "+$8.8B", "−$1.7B". */
export function signedUsd(value: number): string {
  return value > 0 ? `+${formatUsd(value)}` : formatUsd(value);
}

/** One of the fourteen ranking tables. */
export interface RankSort {
  id: string;
  label: () => string;
  /** The table's figure column, and what the top-10 bars measure. */
  figure: () => string;
  keep: (h: PortfolioHolding) => boolean;
  value: (h: PortfolioHolding) => number | null;
  /** -1: the biggest first. */
  dir: 1 | -1;
  format: (v: number) => string;
}

const held = (h: PortfolioHolding) => h.amount > 0;
const ratio = (v: number) => v.toFixed(v >= 100 ? 0 : 1);

export const RANK_SORTS: readonly RankSort[] = [
  {
    id: "largest",
    label: () => tr("Largest holdings"),
    figure: () => tr("Value"),
    keep: held,
    value: (h) => h.value_usd,
    dir: -1,
    format: formatUsd,
  },
  {
    id: "buys",
    label: () => tr("Biggest buys"),
    figure: () => tr("Bought"),
    keep: (h) => h.change_usd > 0,
    value: (h) => h.change_usd,
    dir: -1,
    format: signedUsd,
  },
  {
    // Exits included: a position sold out of keeps a row with amount 0.
    id: "sells",
    label: () => tr("Biggest sells"),
    figure: () => tr("Sold"),
    keep: (h) => h.change_usd < 0,
    value: (h) => h.change_usd,
    dir: 1,
    format: signedUsd,
  },
  {
    id: "caps",
    label: () => tr("Largest market caps"),
    figure: () => tr("Market cap"),
    keep: held,
    value: (h) => h.market_cap_usd,
    dir: -1,
    format: formatUsd,
  },
  {
    id: "undervalued",
    label: () => tr("Most undervalued"),
    figure: () => tr("Upside to {name}", { name: fairValueName() }),
    keep: held,
    value: (h) => h.fair_value_upside_pct,
    dir: -1,
    format: (v) => signedPct(v),
  },
  {
    id: "targets",
    label: () => tr("Bullish analyst targets"),
    figure: () => tr("Upside to target"),
    keep: held,
    value: (h) => h.analyst_upside_pct,
    dir: -1,
    format: (v) => signedPct(v),
  },
  {
    id: "month",
    label: () => tr("Best 1 month perf"),
    figure: () => tr("1 month"),
    keep: held,
    value: (h) => h.perf_1m_pct,
    dir: -1,
    format: (v) => signedPct(v),
  },
  {
    id: "pullbacks",
    label: () => tr("Recent price pullbacks"),
    figure: () => tr("From 1M high"),
    keep: held,
    value: (h) => h.pullback_1m_pct,
    dir: 1,
    format: (v) => signedPct(v),
  },
  {
    id: "dividends",
    label: () => tr("Highest dividend yields"),
    figure: () => tr("Yield"),
    keep: (h) => held(h) && (h.dividend_yield_pct ?? 0) > 0,
    value: (h) => h.dividend_yield_pct,
    dir: -1,
    format: (v) => `${v.toFixed(2)}%`,
  },
  {
    id: "growth",
    label: () => tr("Fastest growing"),
    figure: () => tr("Revenue growth"),
    keep: held,
    value: (h) => h.revenue_growth_pct,
    dir: -1,
    format: (v) => signedPct(v),
  },
  {
    id: "pe",
    label: () => tr("Lowest price / EPS"),
    figure: () => tr("P/E"),
    keep: (h) => held(h) && (h.pe_ttm ?? 0) > 0,
    value: (h) => h.pe_ttm,
    dir: 1,
    format: ratio,
  },
  {
    id: "pb",
    label: () => tr("Lowest price / book"),
    figure: () => tr("P/B"),
    keep: (h) => held(h) && (h.pb ?? 0) > 0,
    value: (h) => h.pb,
    dir: 1,
    format: (v) => v.toFixed(2),
  },
  {
    id: "piotroski",
    label: () => tr("Best Piotroski score"),
    figure: () => tr("Piotroski"),
    keep: held,
    value: (h) => h.piotroski,
    dir: -1,
    format: (v) => v.toFixed(0),
  },
  {
    // The five-year beta: the one-year one swings (Occidental −1.13 on 2026-10-29).
    id: "beta",
    label: () => tr("Lowest beta"),
    figure: () => tr("Beta (5y)"),
    keep: held,
    value: (h) => h.beta_5y,
    dir: 1,
    format: (v) => v.toFixed(2),
  },
];

/** One ranking: the rows that have its figure, in its order (ties by value, then ticker). */
export function rank(
  holdings: readonly PortfolioHolding[],
  sort: RankSort,
): { holding: PortfolioHolding; figure: number }[] {
  const rows: { holding: PortfolioHolding; figure: number }[] = [];
  for (const holding of holdings) {
    if (!sort.keep(holding)) continue;
    const figure = sort.value(holding);
    if (figure === null || !Number.isFinite(figure)) continue;
    rows.push({ holding, figure });
  }
  return rows.sort(
    (a, b) =>
      sort.dir * (a.figure - b.figure) ||
      b.holding.value_usd - a.holding.value_usd ||
      a.holding.ticker.localeCompare(b.holding.ticker),
  );
}

/** The histogram's three views. */
export const UPSIDE_VIEWS = [
  { id: "fair", label: fairValueName, value: (h: PortfolioHolding) => h.fair_value_upside_pct },
  {
    id: "analyst",
    label: () => tr("Analyst price targets"),
    value: (h: PortfolioHolding) => h.analyst_upside_pct,
  },
  {
    id: "graham",
    label: () => tr("Ben Graham formula"),
    value: (h: PortfolioHolding) => h.graham_upside_pct,
  },
] as const;

export type UpsideView = (typeof UPSIDE_VIEWS)[number];

/** One bar: holdings whose upside is in [from, to), with their share of the portfolio's value. */
export interface UpsideBin {
  /** null: the open bin below −50% (from) or at +100% and above (to). */
  from: number | null;
  to: number | null;
  count: number;
  weight_pct: number;
  tickers: string[];
}

/**
 * Holdings by upside in 10-point bins from −50% to +100%, with one open bin each side for the rest:
 * Postgres's width_bucket(upside, −50, 100, 15), as queries.sql `upside` has it. A holding the view
 * has no value for is counted apart, and the median is over those that have one.
 */
export function upsideBins(
  holdings: readonly PortfolioHolding[],
  view: UpsideView,
): { bins: UpsideBin[]; missing: number; median: number | null; counted: number } {
  const bins: UpsideBin[] = Array.from({ length: 17 }, (_, i) => ({
    from: i === 0 ? null : -50 + 10 * (i - 1),
    to: i === 16 ? null : -50 + 10 * i,
    count: 0,
    weight_pct: 0,
    tickers: [],
  }));
  const values: number[] = [];
  let missing = 0;
  for (const h of holdings) {
    if (h.amount <= 0) continue;
    const upside = view.value(h);
    if (upside === null || !Number.isFinite(upside)) {
      missing++;
      continue;
    }
    values.push(upside);
    const index = upside < -50 ? 0 : upside >= 100 ? 16 : Math.floor((upside + 50) / 10) + 1;
    const bin = bins[index] as UpsideBin;
    bin.count++;
    bin.weight_pct += h.weight_pct;
    bin.tickers.push(h.ticker);
  }
  values.sort((a, b) => a - b);
  const mid = values.length / 2;
  const median =
    values.length === 0
      ? null
      : values.length % 2
        ? (values[Math.floor(mid)] as number)
        : ((values[mid - 1] as number) + (values[mid] as number)) / 2;
  return { bins, missing, median, counted: values.length };
}
