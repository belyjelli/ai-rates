/**
 * The pre-registered evaluation of the ranking variants: `plans/ranking-evaluation-preregistration.md`.
 *
 * Implements §3, §5 and §6 of that document and nothing else. The specification was committed before
 * this was ever run on real data; if a choice here is not in the specification, it is a bug.
 *
 * Pure: it takes the stored picks and the daily funding fold, and returns per-variant metrics and the
 * decision. This file is the reference implementation; the collector that actually reads the
 * database and runs it (`collector rank-eval`) carries a Go port,
 * `internal/core/ranking_eval.go` in `belyjelli/profitlock-worker`, tested on these same
 * hand-computed cases. Reading the database from here was retired 2026-09-24 (see the
 * pre-registration's §9) along with `scripts/ranking-eval/`.
 */

export const VARIANTS = ["widest", "settled", "shrunk", "hysteresis", "capacity"] as const;
export type Variant = (typeof VARIANTS)[number];

/** Variant A, today's behaviour. */
export const CONTROL: Variant = "widest";

/**
 * The two pre-registered windows, by first run day (§3). W2 was substituted from 2026-09-21 to
 * 2026-09-22 on 2026-09-24, per §9: run day 2026-09-21 has zero candidate rows (a collector outage),
 * which makes the originally-fixed W2 invalid under §5's own rule.
 */
export const WINDOW_STARTS = ["2026-09-14", "2026-09-22"] as const;

/** The runner refuses to start before this: the last held day's fold must be complete (§2, §8). */
export const EARLIEST_EVALUATION_MS = Date.UTC(2026, 8, 29, 6, 0, 0);

export const NIGHTS_PER_WINDOW = 7;
/** Opening or closing one pair, both legs: two taker fills at 5 bps (§3). */
export const HALF_TRIP_COST_PER_DOLLAR = 0.001;
export const TURNOVER_CEILING = 0.3;
/** Gross may fall at most this fraction of |control gross| below the control (§6). */
export const GROSS_FLOOR_FRACTION = 0.25;

const DAY_MS = 86_400_000;

/** One stored row that at least one variant selected. */
export interface Pick {
  /** UTC date, YYYY-MM-DD. */
  runDay: string;
  assetClass: string;
  asset: string;
  variants: readonly Variant[];
  longVenueId: string;
  longSymbol: string;
  shortVenueId: string;
  shortSymbol: string;
  deployableUsd: number;
}

/** One market's settled funding over one UTC day, from market_funding_daily. */
export interface DailyRate {
  venueId: string;
  venueSymbol: string;
  day: string;
  rateSum: number;
}

export interface VariantResult {
  variant: Variant;
  meanDeployedUsd: number;
  grossUsd: number;
  costUsd: number;
  netUsd: number;
  grossPerMillion: number;
  netPerMillion: number;
  turnover: number;
  /** Leg-days with no settled funding in the fold, counted as zero. */
  missingLegDays: number;
  positionDays: number;
}

export interface WindowResult {
  runDays: string[];
  heldDays: string[];
  variants: Record<Variant, VariantResult>;
}

export function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(t)) throw new Error(`not a UTC day: ${day}`);
  return new Date(t + n * DAY_MS).toISOString().slice(0, 10);
}

const assetKey = (p: Pick) => `${p.assetClass}\u0000${p.asset}`;
const pairKey = (p: Pick) =>
  `${p.longVenueId}\u0000${p.longSymbol}\u0000${p.shortVenueId}\u0000${p.shortSymbol}`;
const rateKey = (venueId: string, venueSymbol: string, day: string) =>
  `${venueId}\u0000${venueSymbol}\u0000${day}`;
const sizeOf = (p: Pick) =>
  Number.isFinite(p.deployableUsd) && p.deployableUsd > 0 ? p.deployableUsd : 0;
const perMillion = (value: number, capital: number) =>
  capital > 0 ? (value / capital) * 1_000_000 : Number.NaN;

/** §3 for one window. Throws on any §5 invalidity rather than estimating around it. */
export function evaluateWindow(
  start: string,
  picks: readonly Pick[],
  rates: readonly DailyRate[],
): WindowResult {
  const runDays = Array.from({ length: NIGHTS_PER_WINDOW }, (_, i) => addDays(start, i));
  const heldDays = runDays.map((day) => addDays(day, 1));

  // run day -> variant -> asset -> pick
  const book = new Map<string, Map<Variant, Map<string, Pick>>>();
  for (const day of runDays) book.set(day, new Map(VARIANTS.map((v) => [v, new Map()])));
  for (const pick of picks) {
    const night = book.get(pick.runDay);
    if (!night) continue;
    for (const variant of pick.variants) {
      const byAsset = night.get(variant) as Map<string, Pick>;
      const key = assetKey(pick);
      if (byAsset.has(key)) {
        throw new Error(
          `window invalid: duplicate ${variant} pick for ${pick.assetClass}:${pick.asset} on ${pick.runDay}`,
        );
      }
      byAsset.set(key, pick);
    }
  }

  for (const day of runDays) {
    const night = book.get(day) as Map<Variant, Map<string, Pick>>;
    const control = night.get(CONTROL) as Map<string, Pick>;
    for (const variant of VARIANTS) {
      const byAsset = night.get(variant) as Map<string, Pick>;
      if (byAsset.size === 0) {
        throw new Error(`window invalid: run day ${day} has no picks for variant ${variant}`);
      }
      if (byAsset.size !== control.size || [...byAsset.keys()].some((k) => !control.has(k))) {
        throw new Error(
          `window invalid: on ${day} every variant must pick for the same assets, and ${variant} does not match ${CONTROL}`,
        );
      }
    }
  }

  const rateSums = new Map<string, number>();
  const daysWithRates = new Set<string>();
  for (const rate of rates) {
    if (!Number.isFinite(rate.rateSum)) continue;
    rateSums.set(rateKey(rate.venueId, rate.venueSymbol, rate.day), rate.rateSum);
    daysWithRates.add(rate.day);
  }
  for (const day of heldDays) {
    if (!daysWithRates.has(day)) {
      throw new Error(
        `window invalid: held day ${day} has no settled funding at all; the fold is incomplete`,
      );
    }
  }

  const variants = {} as Record<Variant, VariantResult>;
  for (const variant of VARIANTS) {
    let gross = 0;
    let cost = 0;
    let deployedTotal = 0;
    let missing = 0;
    let positionDays = 0;
    const turnovers: number[] = [];

    runDays.forEach((day, i) => {
      const held = heldDays[i] as string;
      const current = (book.get(day) as Map<Variant, Map<string, Pick>>).get(variant) as Map<
        string,
        Pick
      >;

      for (const pick of current.values()) {
        const size = sizeOf(pick);
        const long = rateSums.get(rateKey(pick.longVenueId, pick.longSymbol, held));
        const short = rateSums.get(rateKey(pick.shortVenueId, pick.shortSymbol, held));
        if (long === undefined) missing++;
        if (short === undefined) missing++;
        gross += size * ((short ?? 0) - (long ?? 0));
        deployedTotal += size;
        positionDays++;
      }

      if (i === 0) return; // formation night: no costs, no turnover
      const previous = (book.get(runDays[i - 1] as string) as Map<Variant, Map<string, Pick>>).get(
        variant,
      ) as Map<string, Pick>;

      let continuing = 0;
      let changed = 0;
      for (const [key, pick] of current) {
        const before = previous.get(key);
        if (!before) {
          cost += HALF_TRIP_COST_PER_DOLLAR * sizeOf(pick);
          continue;
        }
        continuing++;
        if (pairKey(before) !== pairKey(pick)) {
          changed++;
          cost +=
            HALF_TRIP_COST_PER_DOLLAR * sizeOf(before) + HALF_TRIP_COST_PER_DOLLAR * sizeOf(pick);
        }
      }
      for (const [key, before] of previous) {
        if (!current.has(key)) cost += HALF_TRIP_COST_PER_DOLLAR * sizeOf(before);
      }
      turnovers.push(continuing > 0 ? changed / continuing : 0);
    });

    const meanDeployed = deployedTotal / NIGHTS_PER_WINDOW;
    const net = gross - cost;
    variants[variant] = {
      variant,
      meanDeployedUsd: meanDeployed,
      grossUsd: gross,
      costUsd: cost,
      netUsd: net,
      grossPerMillion: perMillion(gross, meanDeployed),
      netPerMillion: perMillion(net, meanDeployed),
      turnover: turnovers.reduce((a, b) => a + b, 0) / turnovers.length,
      missingLegDays: missing,
      positionDays,
    };
  }

  return { runDays, heldDays, variants };
}

export interface VariantVerdict {
  variant: Variant;
  beatsControl: boolean[];
  turnoverOk: boolean[];
  grossOk: boolean[];
  eligible: boolean;
  meanNetPerMillion: number;
  meanDeployedUsd: number;
}

export interface Decision {
  winner: Variant | null;
  verdicts: VariantVerdict[];
}

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** §6. A variant must pass every criterion in every window; no eligible variant means no promotion. */
export function decide(windows: readonly WindowResult[]): Decision {
  if (windows.length < 2) {
    throw new Error("the decision needs at least two non-overlapping windows");
  }

  const verdicts: VariantVerdict[] = VARIANTS.filter((v) => v !== CONTROL).map((variant) => {
    const beatsControl: boolean[] = [];
    const turnoverOk: boolean[] = [];
    const grossOk: boolean[] = [];
    for (const window of windows) {
      const control = window.variants[CONTROL];
      const result = window.variants[variant];
      beatsControl.push(result.netPerMillion > control.netPerMillion);
      turnoverOk.push(result.turnover <= TURNOVER_CEILING);
      grossOk.push(
        result.grossPerMillion >=
          control.grossPerMillion - GROSS_FLOOR_FRACTION * Math.abs(control.grossPerMillion),
      );
    }
    return {
      variant,
      beatsControl,
      turnoverOk,
      grossOk,
      eligible: [...beatsControl, ...turnoverOk, ...grossOk].every(Boolean),
      meanNetPerMillion: mean(windows.map((w) => w.variants[variant].netPerMillion)),
      meanDeployedUsd: mean(windows.map((w) => w.variants[variant].meanDeployedUsd)),
    };
  });

  // Strictly greater, iterating in A-E order: an exact tie keeps the earlier, simpler variant.
  let winner: VariantVerdict | null = null;
  for (const verdict of verdicts) {
    if (!verdict.eligible) continue;
    if (
      !winner ||
      verdict.meanNetPerMillion > winner.meanNetPerMillion ||
      (verdict.meanNetPerMillion === winner.meanNetPerMillion &&
        verdict.meanDeployedUsd > winner.meanDeployedUsd)
    ) {
      winner = verdict;
    }
  }
  return { winner: winner?.variant ?? null, verdicts };
}
