import { VENUES } from "@ai-rates/venues";
import type { BookQualityData, BookQualityRow, ExchangeSummary } from "../app/data";
import { RETAIL_TAKER_BPS } from "../app/retail-fees";

/**
 * Each exchange's trading cost, slippage and depth, and a grade, for the Exchanges page.
 *
 * WHERE THE NUMBERS COME FROM. The collector reads every measured venue's public order book for twelve
 * majors every ten minutes (collector/internal/books, migration 040) and keeps each market's
 * seven-day medians: the spread, what a $10k and a $100k market order would pay beyond the mid, the
 * dollars resting within 1%. Those are the books' promises, not fills: nothing here sees a trade, so
 * markouts and effective spreads, which DefiLlama measures from its own tick data, are not shown.
 *
 * ONE PORTFOLIO FOR EVERY VENUE. An asset counts in a venue's figures by its open interest across all
 * venues, so every venue is priced on the same mix and a venue is not flattered by listing only the
 * cheap books. A venue missing an asset is priced on the rest, and its coverage says how much of the
 * mix that is.
 *
 * THE GRADE is this site's own, from what it measures, on a 0-100 score:
 *   - Execution, half: what $10k costs all in (the venue's published standard taker fee plus the
 *     book's slippage), three tenths of it, and what $100k pays beyond the mid, seven tenths, each
 *     against the cheapest venue on a log scale (SLOPE).
 *   - Liquidity, three tenths: the depth within 0.1% across the basket -- the band every measured
 *     venue's published book reaches, where the 1% figure partly measures how many levels each API
 *     returns -- against the deepest venue, on the same scale, scaled down for missing assets. Depth is
 *     credited up to a tenth of each market's open interest, and a venue's total up to 2% of its daily
 *     volume: displayed size beyond that is not size anyone trades against (BingX showed $576M within
 *     0.1% across the basket on 2026-10-17, 13% of its day's volume, where Binance showed 0.2%).
 *   - Activity, a fifth: open interest, and volume credited up to five times it, against the leaders.
 * S from 85, A from 70, B from 55, C from 40, D below. Fixed bands, so a new venue does not reshuffle
 * the rest. No reserves, no reputation, nothing self-reported enters it.
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

export type Grade = "S" | "A" | "B" | "C" | "D";

export interface VenueQuality {
  id: string;
  /** Basket assets measured, and their share of the basket's open interest. */
  assets: number;
  coverage: number;
  /** Weighted medians, basis points beyond the mid. */
  spreadBps: number;
  slip10kBps: number;
  slip100kBps: number;
  /** Assets where $100k could not fill in most snapshots. */
  unfilled: number;
  /** Dollars within 1% and within 0.1% of the mid, summed over the basket, as the books show them. */
  depthUsd: number;
  depthNearUsd: number;
  /** The near depth the grade credits, after the open-interest and volume caps. */
  depthCreditedUsd: number;
  /** The taker fee used, and whether it is the venue's published one or the site's default. */
  feeBps: number;
  feeVerified: boolean;
  /** Dollars a $10k market order costs all in, and a $100k one pays beyond the mid. */
  cost10kUsd: number;
  slip10kUsd: number;
  slip100kUsd: number;
  execution: number;
  liquidity: number;
  activity: number;
  score: number;
  grade: Grade;
  /** The oldest and newest snapshots behind the medians. */
  since: Date;
  latest: Date;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
/**
 * A value against the best one on a log scale: equal scores 100, twice as bad 85, ten times as bad 50.
 * Steeper than DefiLlama's (ten times scores 70 there): the largest venues sit within a factor of
 * three of each other on every measure, and a gentler scale gave five of them an S.
 */
const SLOPE = 50;
const versusBest = (value: number, best: number) => clamp(100 - SLOPE * Math.log10(value / best));
const versusLeader = (value: number, leader: number) =>
  value > 0 && leader > 0 ? clamp(100 + SLOPE * Math.log10(value / leader)) : 0;

export function gradeOf(score: number): Grade {
  return score >= 85 ? "S" : score >= 70 ? "A" : score >= 55 ? "B" : score >= 40 ? "C" : "D";
}

/** A venue's published taker fee, or the site's stated default where the catalog has none. */
export function takerFee(venueId: string): { bps: number; verified: boolean } {
  const bps = VENUES.find((v) => v.id === venueId)?.takerBps;
  return typeof bps === "number" && Number.isFinite(bps)
    ? { bps, verified: true }
    : { bps: RETAIL_TAKER_BPS, verified: false };
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
  for (const r of rows) {
    const weight = weights[r.base] ?? 0;
    if (weight <= 0 || r.slip_10k_bps === null) continue;
    const big =
      r.unfilled_100k > 0.5 || r.slip_100k_bps === null
        ? UNFILLED_PENALTY_BPS
        : Math.min(r.slip_100k_bps, UNFILLED_PENALTY_BPS);
    if (r.unfilled_100k > 0.5 || r.slip_100k_bps === null) unfilled++;
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
  };
}

/**
 * Every measured venue's figures, scores and grade, best first. `summaries` gives each venue's open
 * interest and volume; a venue with book rows but no summary (not reporting right now) is left out.
 */
export function venueQualities(
  data: BookQualityData,
  summaries: readonly ExchangeSummary[],
): VenueQuality[] {
  const byVenue = new Map<string, BookQualityRow[]>();
  for (const r of data.rows) {
    const list = byVenue.get(r.venue_id) ?? [];
    list.push(r);
    byVenue.set(r.venue_id, list);
  }
  const summary = new Map(summaries.map((s) => [s.id, s]));
  const measured = [...byVenue.entries()]
    .map(([id, rows]) => {
      const s = summary.get(id);
      const figures = weigh(rows, data.weights);
      if (!s || !figures) return null;
      const fee = takerFee(id);
      return {
        id,
        rows,
        s,
        figures,
        fee,
        cost: fee.bps + figures.slip10kBps,
        credit: Math.min(s.volume_24h_usd, 5 * s.open_interest_usd),
        depthCredited:
          s.volume_24h_usd > 0
            ? Math.min(figures.creditedUsd, DEPTH_VOLUME_CAP * s.volume_24h_usd)
            : figures.creditedUsd,
      };
    })
    .filter((v) => v !== null);
  if (measured.length === 0) return [];
  // The floors keep a near-free venue from making everyone else's scores collapse: below 1 bp all in,
  // or a quarter of a bp at $100k, cost no longer separates venues a reader would choose between.
  const bestCost = Math.max(1, Math.min(...measured.map((v) => v.cost)));
  const bestSlip = Math.max(0.25, Math.min(...measured.map((v) => v.figures.slip100kBps)));
  const deepest = Math.max(...measured.map((v) => v.depthCredited));
  const topOi = Math.max(...measured.map((v) => v.s.open_interest_usd));
  const topCredit = Math.max(...measured.map((v) => v.credit));
  return measured
    .map((v) => {
      const execution =
        0.3 * versusBest(Math.max(v.cost, bestCost), bestCost) +
        0.7 * versusBest(Math.max(v.figures.slip100kBps, bestSlip), bestSlip);
      const liquidity = versusLeader(v.depthCredited, deepest) * (0.5 + 0.5 * v.figures.coverage);
      const activity =
        0.6 * versusLeader(v.s.open_interest_usd, topOi) + 0.4 * versusLeader(v.credit, topCredit);
      const score = 0.5 * execution + 0.3 * liquidity + 0.2 * activity;
      const times = v.rows.map((r) => r.first_at.getTime());
      const lasts = v.rows.map((r) => r.last_at.getTime());
      return {
        id: v.id,
        assets: v.rows.filter((r) => r.slip_10k_bps !== null).length,
        coverage: v.figures.coverage,
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
        execution,
        liquidity,
        activity,
        score,
        grade: gradeOf(score),
        since: new Date(Math.min(...times)),
        latest: new Date(Math.max(...lasts)),
      };
    })
    .sort((a, b) => b.score - a.score);
}
