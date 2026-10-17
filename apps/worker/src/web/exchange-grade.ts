import { VENUES, type VenueType } from "@ai-rates/venues";
import type {
  BookQualityData,
  BookQualityRow,
  ExchangeReserveRow,
  ExchangeSummary,
} from "../app/data";
import { RETAIL_TAKER_BPS } from "../app/retail-fees";

/**
 * Each exchange's trading cost, slippage, depth and reserves, and a grade, for the Exchanges page.
 *
 * WHERE THE NUMBERS COME FROM. The collector reads every measured venue's public order book for twelve
 * majors every ten minutes (collector/internal/books, migration 040) and keeps each market's
 * seven-day medians: the spread, what a $10k and a $100k market order would pay beyond the mid, the
 * dollars resting within 1% and 0.1%. Those are the books' promises, not fills: nothing here sees a
 * trade. Reserves are DefiLlama's (collector/internal/reserves, migration 043): a centralized
 * exchange's wallets tracked on-chain, all of it and "clean" (without its own token), and a
 * decentralized exchange's protocol collateral, its bridge or vault -- a floor, since a market maker's
 * money can sit elsewhere.
 *
 * ONE PORTFOLIO FOR EVERY VENUE. An asset counts in a venue's figures by its open interest across all
 * venues, so every venue is priced on the same mix and a venue is not flattered by listing only the
 * cheap books.
 *
 * THE GRADE follows DefiLlama's REAL score (defillama.com/exchanges/methodology, as of 2026-10-16): a
 * weighted mean of four pillars, each 0-100 -- Reserves 30, Execution 30, Activity 20, Liquidity 20.
 * A pillar this site cannot measure for a venue is null, never zero, and its weight goes to the
 * others. Sizes are on a log scale where a tenth of the leader scores 70 (SIZE_SLOPE). Fixed bands, so
 * a new venue does not reshuffle the rest: S from 85 (only with execution measured), A from 70, B from
 * 55, C from 40, D below. Where this differs from DefiLlama's, it is because this site reads books, not
 * trades:
 *   - Reserves: two thirds magnitude (clean reserves against the largest), one third consistency --
 *     custody (the clean share) and backing: open interest, a day's volume and the book shown within 1%
 *     across the basket, each against the reserves, free up to a limit (BACKING_LIMITS) and marked down
 *     beyond it. A CEX with no wallets on DefiLlama scores 0, as its peers publish; a DEX whose
 *     collateral is not identified scores the median of the measured DEXes.
 *   - Execution: DefiLlama's cost to trade (21) and slippage at size (36), from the book: the published
 *     standard taker fee plus the book's walk for $10k, and what $10k and $100k pay beyond the mid,
 *     against the cheapest venue (EXECUTION_SLOPE). Its markouts (43) and its check of fills against
 *     the quote need trades, which this site does not record; their weight goes to these two.
 *   - Activity: open interest, credited up to three times clean reserves, three fifths; a day's volume,
 *     credited up to five times open interest, two fifths. DefiLlama's steadiness term is not computed.
 *   - Liquidity: three quarters the depth within 0.1% -- the band every measured book reaches --
 *     credited up to a tenth of each market's open interest, 2% of the venue's daily volume and 5% of
 *     its clean reserves (DefiLlama credits its 2% band up to all of them; this band is a twentieth as
 *     wide); one quarter breadth, the basket markets holding $100k within 0.1%. Halved for a CEX that
 *     publishes no reserves.
 * Nothing self-reported that cannot be checked enters it: no reputation, age, brand or listings count.
 */

/** The assets the collector measures each venue on: collector/internal/books Basket. */
export const BOOK_BASKET = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "DOGE",
  "BNB",
  "HYPE",
  "SUI",
  "ADA",
  "LINK",
  "AVAX",
  "LTC",
] as const;

/** A $100k order that could not fill in most snapshots is priced at this many basis points. */
export const UNFILLED_PENALTY_BPS = 50;

/** The most of a market's open interest its depth within 0.1% is credited for. */
export const DEPTH_OI_CAP = 0.1;
/** The most of a venue's 24-hour volume its depth within 0.1% is credited for. */
export const DEPTH_VOLUME_CAP = 0.02;
/** The most of a venue's clean reserves its depth within 0.1% is credited for. */
export const DEPTH_RESERVES_CAP = 0.05;
/** Open interest is credited up to this many times a venue's clean reserves. */
export const OI_RESERVES_CAP = 3;
/** A market holding this much within 0.1% counts toward breadth. */
export const BREADTH_USD = 100_000;

/**
 * What a balance sheet backs without question, as multiples of the clean reserves: open interest, a
 * day's volume, and the book shown within 1% of the mid summed over the basket. On 2026-10-17 every
 * large CEX sat well inside all three (Binance 0.2x, 0.2x, 0.002x); BingX showed 4.1x, 8.2x and 4.0x.
 */
export const BACKING_LIMITS = { openInterest: 3, volume: 3, depth: 0.25 } as const;

export const PILLARS = ["reserves", "execution", "activity", "liquidity"] as const;
export type Pillar = (typeof PILLARS)[number];
export const PILLAR_WEIGHTS: Record<Pillar, number> = {
  reserves: 30,
  execution: 30,
  activity: 20,
  liquidity: 20,
};

export type Grade = "S" | "A" | "B" | "C" | "D";

export interface VenueReserves {
  kind: "wallets" | "collateral";
  totalUsd: number;
  cleanUsd: number;
  day: Date;
}

export interface VenueQuality {
  id: string;
  type: VenueType;
  /** Basket assets measured, their share of the basket's open interest, and how many hold $100k near. */
  assets: number;
  coverage: number;
  broad: number;
  /** Weighted medians, basis points beyond the mid. */
  spreadBps: number;
  slip10kBps: number;
  slip100kBps: number;
  /** Assets where $100k could not fill in most snapshots. */
  unfilled: number;
  /** Dollars within 1% and within 0.1% of the mid, summed over the basket, as the books show them. */
  depthUsd: number;
  depthNearUsd: number;
  /** The near depth the grade credits, after the open-interest, volume and reserves caps. */
  depthCreditedUsd: number;
  /** The taker fee used, and whether it is the venue's published one or the site's default. */
  feeBps: number;
  feeVerified: boolean;
  /** Dollars a $10k market order costs all in, and a $100k one pays beyond the mid. */
  cost10kUsd: number;
  slip10kUsd: number;
  slip100kUsd: number;
  /** What the venue holds; null where DefiLlama has nothing for it, or the read failed. */
  reserves: VenueReserves | null;
  /** Open interest and volume as reported, and as the grade credits them. */
  openInterestUsd: number;
  volumeUsd: number;
  oiCreditedUsd: number;
  volumeCreditedUsd: number;
  /** Each pillar 0-100, null where it is not measured (its weight goes to the others). */
  pillars: Record<Pillar, number | null>;
  score: number;
  grade: Grade;
  /** Place among the graded venues of its kind: CEXes with CEXes, everything else with the DEXes. */
  rank: number;
  of: number;
  /** The oldest and newest snapshots behind the medians. */
  since: Date;
  latest: Date;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
/** Sizes: a tenth of the leader scores 70, a hundredth 40 -- DefiLlama's scale. */
export const SIZE_SLOPE = 30;
/**
 * Costs: twice the cheapest scores 85, ten times 50. Steeper than the size scale: the largest venues
 * sit within a factor of three of each other on every cost, and a gentler scale cannot tell them apart.
 */
export const EXECUTION_SLOPE = 50;
const versusBest = (value: number, best: number) =>
  clamp(100 - EXECUTION_SLOPE * Math.log10(Math.max(value, best) / best));
const versusLeader = (value: number, leader: number) =>
  value > 0 && leader > 0 ? clamp(100 + SIZE_SLOPE * Math.log10(value / leader)) : 0;
/** A ratio inside its limit scores 100; ten times over it, 50. */
const within = (ratio: number, limit: number) =>
  ratio <= limit ? 100 : clamp(100 - EXECUTION_SLOPE * Math.log10(ratio / limit));

export function gradeOf(score: number, executionMeasured = true): Grade {
  return score >= 85 && executionMeasured
    ? "S"
    : score >= 70
      ? "A"
      : score >= 55
        ? "B"
        : score >= 40
          ? "C"
          : "D";
}

/** The weighted mean over the pillars that are measured. */
export function scoreOf(pillars: Record<Pillar, number | null>): number {
  let sum = 0;
  let weight = 0;
  for (const p of PILLARS) {
    const v = pillars[p];
    if (v === null) continue;
    sum += PILLAR_WEIGHTS[p] * v;
    weight += PILLAR_WEIGHTS[p];
  }
  return weight > 0 ? sum / weight : 0;
}

/** A venue's published taker fee, or the site's stated default where the catalog has none. */
export function takerFee(venueId: string): { bps: number; verified: boolean } {
  const bps = VENUES.find((v) => v.id === venueId)?.takerBps;
  return typeof bps === "number" && Number.isFinite(bps)
    ? { bps, verified: true }
    : { bps: RETAIL_TAKER_BPS, verified: false };
}

/** Every venue's newest reserves, by id. */
export function reservesById(rows: readonly ExchangeReserveRow[]): Map<string, VenueReserves> {
  const out = new Map<string, VenueReserves>();
  for (const r of rows) {
    const had = out.get(r.venue_id);
    if (had && had.day >= r.day) continue;
    out.set(r.venue_id, {
      kind: r.kind,
      totalUsd: r.total_usd,
      cleanUsd: r.clean_usd,
      day: r.day,
    });
  }
  return out;
}

/** One venue's figures across its measured basket assets, before the scores. */
function weigh(rows: readonly BookQualityRow[], weights: Record<string, number>) {
  const total = BOOK_BASKET.reduce((sum, b) => sum + (weights[b] ?? 0), 0);
  let w = 0;
  let spread = 0;
  let slip10 = 0;
  let slip100 = 0;
  let depth = 0;
  let near = 0;
  let credited = 0;
  let unfilled = 0;
  let broad = 0;
  for (const r of rows) {
    const weight = weights[r.base] ?? 0;
    if (weight <= 0 || r.slip_10k_bps === null) continue;
    const failed = r.unfilled_100k > 0.5 || r.slip_100k_bps === null;
    const big =
      failed || r.slip_100k_bps === null
        ? UNFILLED_PENALTY_BPS
        : Math.min(r.slip_100k_bps, UNFILLED_PENALTY_BPS);
    if (failed) unfilled++;
    if (r.depth_near_usd >= BREADTH_USD) broad++;
    w += weight;
    spread += weight * r.spread_bps;
    slip10 += weight * r.slip_10k_bps;
    slip100 += weight * big;
    depth += r.depth_usd;
    near += r.depth_near_usd;
    credited +=
      r.open_interest_usd > 0
        ? Math.min(r.depth_near_usd, DEPTH_OI_CAP * r.open_interest_usd)
        : r.depth_near_usd;
  }
  if (w === 0) return null;
  return {
    coverage: total > 0 ? w / total : 0,
    spreadBps: spread / w,
    slip10kBps: slip10 / w,
    slip100kBps: slip100 / w,
    depthUsd: depth,
    depthNearUsd: near,
    creditedUsd: credited,
    unfilled,
    broad,
  };
}

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

const isCex = (type: VenueType) => type === "cex";

/**
 * Every measured venue's figures, pillars and grade, best first. `summaries` gives each venue's open
 * interest and volume; a venue with book rows but no summary (not reporting right now) is left out.
 * `reserves` is every venue's from the collector, or null when that read failed -- then the Reserves
 * pillar is not measured for anyone, rather than zero for everyone.
 */
export function venueQualities(
  data: BookQualityData,
  summaries: readonly ExchangeSummary[],
  reserves: readonly ExchangeReserveRow[] | null = null,
): VenueQuality[] {
  const byVenue = new Map<string, BookQualityRow[]>();
  for (const r of data.rows) {
    const list = byVenue.get(r.venue_id) ?? [];
    list.push(r);
    byVenue.set(r.venue_id, list);
  }
  const held = reserves ? reservesById(reserves) : null;
  const summary = new Map(summaries.map((s) => [s.id, s]));
  const measured = [...byVenue.entries()]
    .map(([id, rows]) => {
      const s = summary.get(id);
      const figures = weigh(rows, data.weights);
      if (!s || !figures) return null;
      const type: VenueType = VENUES.find((v) => v.id === id)?.type ?? (s.type as VenueType);
      const fee = takerFee(id);
      const r = held?.get(id) ?? null;
      const oiCredited = r
        ? Math.min(s.open_interest_usd, OI_RESERVES_CAP * r.cleanUsd)
        : s.open_interest_usd;
      return {
        id,
        type,
        rows,
        s,
        figures,
        fee,
        r,
        cost: fee.bps + figures.slip10kBps,
        oiCredited,
        volumeCredited: Math.min(s.volume_24h_usd, 5 * s.open_interest_usd),
        depthCredited: Math.min(
          figures.creditedUsd,
          s.volume_24h_usd > 0 ? DEPTH_VOLUME_CAP * s.volume_24h_usd : Number.POSITIVE_INFINITY,
          r ? DEPTH_RESERVES_CAP * r.cleanUsd : Number.POSITIVE_INFINITY,
        ),
      };
    })
    .filter((v) => v !== null);
  if (measured.length === 0) return [];

  // The floors keep a near-free venue from making everyone else's scores collapse: below 1 bp all in,
  // half a bp at $10k or a quarter at $100k, cost no longer separates venues a reader would choose between.
  const bestCost = Math.max(1, Math.min(...measured.map((v) => v.cost)));
  const best10 = Math.max(0.5, Math.min(...measured.map((v) => v.figures.slip10kBps)));
  const best100 = Math.max(0.25, Math.min(...measured.map((v) => v.figures.slip100kBps)));
  const deepest = Math.max(...measured.map((v) => v.depthCredited));
  const topOi = Math.max(...measured.map((v) => v.oiCredited));
  const topVolume = Math.max(...measured.map((v) => v.volumeCredited));
  // The largest balance sheet anywhere, measured book or not.
  const largest = held ? Math.max(0, ...[...held.values()].map((r) => r.cleanUsd)) : 0;

  const scored = measured.map((v) => {
    const execution =
      (21 * versusBest(v.cost, bestCost) +
        36 *
          ((versusBest(v.figures.slip10kBps, best10) + versusBest(v.figures.slip100kBps, best100)) /
            2)) /
      57;
    let reservesPillar: number | null = null;
    if (held && v.r) {
      const clean = Math.max(v.r.cleanUsd, 1);
      const backing =
        (within(v.s.open_interest_usd / clean, BACKING_LIMITS.openInterest) +
          within(v.s.volume_24h_usd / clean, BACKING_LIMITS.volume) +
          within(v.figures.depthUsd / clean, BACKING_LIMITS.depth)) /
        3;
      const custody = (100 * v.r.cleanUsd) / v.r.totalUsd;
      reservesPillar =
        (2 / 3) * versusLeader(v.r.cleanUsd, largest) + (1 / 3) * ((custody + 2 * backing) / 3);
    } else if (held && isCex(v.type)) {
      reservesPillar = 0;
    }
    const noReserves = held !== null && v.r === null && isCex(v.type);
    const liquidity =
      (0.75 * versusLeader(v.depthCredited, deepest) +
        (0.25 * 100 * v.figures.broad) / BOOK_BASKET.length) *
      (noReserves ? 0.5 : 1);
    const activity =
      0.6 * versusLeader(v.oiCredited, topOi) + 0.4 * versusLeader(v.volumeCredited, topVolume);
    return { v, pillars: { reserves: reservesPillar, execution, activity, liquidity } };
  });
  // A DEX whose collateral is not identified: the median of the DEXes whose is.
  const dexMedian = median(
    scored
      .filter(({ v, pillars }) => !isCex(v.type) && pillars.reserves !== null)
      .map(({ pillars }) => pillars.reserves as number),
  );
  for (const x of scored)
    if (held && x.pillars.reserves === null && !isCex(x.v.type)) x.pillars.reserves = dexMedian;

  const out = scored.map(({ v, pillars }): VenueQuality => {
    const score = scoreOf(pillars);
    const times = v.rows.map((r) => r.first_at.getTime());
    const lasts = v.rows.map((r) => r.last_at.getTime());
    return {
      id: v.id,
      type: v.type,
      assets: v.rows.filter((r) => r.slip_10k_bps !== null).length,
      coverage: v.figures.coverage,
      broad: v.figures.broad,
      spreadBps: v.figures.spreadBps,
      slip10kBps: v.figures.slip10kBps,
      slip100kBps: v.figures.slip100kBps,
      unfilled: v.figures.unfilled,
      depthUsd: v.figures.depthUsd,
      depthNearUsd: v.figures.depthNearUsd,
      depthCreditedUsd: v.depthCredited,
      feeBps: v.fee.bps,
      feeVerified: v.fee.verified,
      cost10kUsd: v.cost,
      slip10kUsd: v.figures.slip10kBps,
      slip100kUsd: 10 * v.figures.slip100kBps,
      reserves: v.r,
      openInterestUsd: v.s.open_interest_usd,
      volumeUsd: v.s.volume_24h_usd,
      oiCreditedUsd: v.oiCredited,
      volumeCreditedUsd: v.volumeCredited,
      pillars,
      score,
      grade: gradeOf(score, pillars.execution !== null),
      rank: 0,
      of: 0,
      since: new Date(Math.min(...times)),
      latest: new Date(Math.max(...lasts)),
    };
  });
  out.sort((a, b) => b.score - a.score);
  for (const kind of [true, false]) {
    const group = out.filter((q) => isCex(q.type) === kind);
    group.forEach((q, i) => {
      q.rank = i + 1;
      q.of = group.length;
    });
  }
  return out;
}
