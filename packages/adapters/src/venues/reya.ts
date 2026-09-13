import { type FundingSnapshot, parseVenueSymbol } from "@ai-rates/core";
import { marketRef, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Reya DEX (API v2).
 *
 * REQUESTS: `GET /v2/perpMarkets/summary` every cycle, plus `GET /v2/marketDefinitions` once an hour.
 * Rate limit is 1,000 requests per 60s per IP across all REST endpoints
 * (https://docs.reya.xyz/developers/rate-limits.md), so 100ms spacing.
 *
 * FUNDING -- the rate. `fundingRate` is the "current hourly funding rate"
 * (https://github.com/Reya-Labs/reya-api-specs, `MarketSummary`), and it is quoted in PERCENT: BTC read
 * 0.00100, which as a fraction would be 876% APR against ~11% on every other venue. Verified from the
 * funding accumulators rather than assumed: across two summaries 204s apart on 2026-09-14, BTC's
 * `longFundingValue` rose by 1.0074e-5 x oracle price per hour, and `fundingRate` averaged 1.0070e-3
 * (i.e. 1.0070e-5 as a fraction). So `rate = fundingRate / 100` over 1 hour.
 *
 * FUNDING -- the sign. Positive means longs pay, as on every other venue. `fundingRateVelocity` had
 * the sign of (long OI - short OI) on 44 of 44 live markets with any skew: the rate climbs while longs
 * outnumber shorts, which only makes sense if longs pay a positive rate. BTC at +0.0010%/h (8.8% APR)
 * matched Extended +11.4%, Arcus +10.95% and Variational +9.1% the same afternoon.
 *
 * FUNDING -- long and short values. `longFundingValue` and `shortFundingValue` are NOT rates. The spec
 * defines each as the "reference value of funding accrued by one unit of exposure; there is one
 * funding value per market and per direction, with short v long funding values differing possibly due
 * to Auto-Deleveraging (ADL)". They are cumulative indices, so neither is stored and they are never
 * averaged. They do say something the single rate does not: over the same 204s, BTC's two values moved
 * almost together (1.007e-5 vs 0.999e-5 per $/h) but SOL's long value rose 1.97e-5 against the short
 * value's 1.07e-5, and LINK's 2.90e-5 against 0.90e-5. Where they differ, shorts are credited less than
 * longs are charged. `fundingRate` is the one number Reya publishes for the market and is what every
 * other venue reports, so it is the rate; that shorts may receive less is a Reya-specific haircut this
 * row cannot carry.
 *
 * INTERVAL: none. Both accumulators moved in proportion to elapsed time between samples minutes apart,
 * so funding accrues continuously, like Paradex: `intervalHours` and `nextFundingAt` are null, and the
 * rate is `predicted` since it drifts with `fundingRateVelocity`. No history endpoint exists.
 *
 * UNITS: `oiQty` is base units ("lots"; BTC 39.36 x 77,071 = $3.03M), `volume24h` is "24-hour trading
 * volume in USD" (BTC $91.2M, 30x its OI: Reya's AMM pool is the counterparty to every trade, so
 * turnover runs high). Mark is the oracle price: "used both as the peg price for prices on Reya, as well as
 * Mark Prices" (https://docs.reya.xyz/llms-full.txt, `Price.oraclePrice`). `throttledPoolPrice` is the
 * AMM's zero-size quote, not the mark.
 *
 * TRADABILITY: a market is live when `marketDefinitions` lists it. On 2026-09-14 the summary had 75
 * rows and definitions 52; the 23 missing (MKR, DOT, TON, FTMUSD, ...) had zero volume and near-zero
 * OI. Of the 52, 32 carried `oiCap` "0", which the spec defines only as "maximum one-sided open
 * interest in units" without saying what zero means; they are kept, not guessed at.
 *
 * QUOTE: RUSD. "All settlement amounts on Reya Network are denominated in rUSD, which is a wrapped
 * version of USDC" (https://docs.reya.xyz/native-stablecoin/srusd.md). `RUSD` is how
 * `/v2/assetDefinitions` spells it, and it is the quote inside every perp symbol.
 *
 * BASE: every symbol defeats the parser -- `BTCRUSDPERP` has no separator, so it parses whole. Reya
 * declares no base field; its symbols follow the grammar the spec's examples show (`BTCRUSDPERP` for
 * perps, `WETHRUSD` for spot, and `/v2/assetDefinitions` pairs each asset with `<asset>RUSD`). The part
 * before `RUSDPERP` is that declared base, and it goes through the parser only so `kPEPE` reads as PEPE
 * x1000. Checked on all 75 symbols: every one ends in `RUSDPERP`, and `SRUSDPERP` is Sonic (S).
 */

const VENUE = "reya";
export const REYA_API = "https://api.reya.xyz/v2";
const PERP_SUFFIX = "RUSDPERP";
const QUOTE = "RUSD";
const DEFINITIONS_TTL_MS = 3_600_000;

export interface ReyaMarketSummary {
  symbol: string;
  updatedAt?: number;
  oiQty?: string;
  longOiQty?: string;
  shortOiQty?: string;
  /** Hourly, in percent. */
  fundingRate?: string;
  /** Cumulative funding per unit of long exposure -- not a rate. */
  longFundingValue?: string;
  /** Cumulative funding per unit of short exposure -- not a rate. */
  shortFundingValue?: string;
  fundingRateVelocity?: string;
  volume24h?: string;
  throttledOraclePrice?: string;
  throttledPoolPrice?: string;
}

export interface ReyaMarketDefinition {
  symbol: string;
  maxLeverage?: number | string;
  oiCap?: string;
}

/** Base and contract multiplier from a Reya perp symbol, or null if it is not one. */
export function reyaPerpBase(symbol: string): { base: string; multiplier: number } | null {
  if (!symbol.endsWith(PERP_SUFFIX) || symbol.length <= PERP_SUFFIX.length) return null;
  const parsed = parseVenueSymbol(symbol.slice(0, -PERP_SUFFIX.length));
  return { base: parsed.base, multiplier: parsed.multiplier };
}

/** Reya's percent-per-hour `fundingRate` as the fraction-per-hour core stores. */
export function reyaHourlyRate(fundingRate: unknown): number | null {
  const percent = num(fundingRate);
  return percent === null ? null : percent / 100;
}

export function parseReyaSnapshots(
  summaries: readonly ReyaMarketSummary[],
  definitions: readonly ReyaMarketDefinition[],
  now: number,
): FundingSnapshot[] {
  const defined = new Map(definitions.map((d) => [d.symbol, d]));
  const snapshots: FundingSnapshot[] = [];
  for (const row of summaries) {
    const definition = defined.get(row.symbol);
    const declared = reyaPerpBase(row.symbol);
    const rate = reyaHourlyRate(row.fundingRate);
    if (!definition || !declared || rate === null) continue;

    const oracle = num(row.throttledOraclePrice);
    const oi = num(row.oiQty);
    snapshots.push({
      // Reya declares no class; every market it lists is crypto (PAXG is the gold token).
      ...marketRef(VENUE, row.symbol, { ...declared, quote: QUOTE }),
      observedAt: now,
      rate,
      basisHours: 1,
      intervalHours: null,
      nextFundingAt: null,
      kind: "predicted",
      markPrice: oracle,
      indexPrice: oracle,
      openInterestUsd: oi !== null && oracle !== null ? oi * oracle : null,
      volume24hUsd: num(row.volume24h),
      maxLeverage: num(definition.maxLeverage),
    });
  }
  return snapshots;
}

export function createReyaAdapter(): VenueAdapter {
  let definitions: ReyaMarketDefinition[] | null = null;
  let definitionsFetchedAt = 0;

  return {
    venueId: VENUE,
    minIntervalMs: 100,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      if (!definitions || now - definitionsFetchedAt >= DEFINITIONS_TTL_MS) {
        const body = await client.getJson<ReyaMarketDefinition[]>(`${REYA_API}/marketDefinitions`);
        if (!Array.isArray(body))
          throw new Error(`${VENUE}: unexpected marketDefinitions response`);
        definitions = body;
        definitionsFetchedAt = now;
      }
      const summaries = await client.getJson<ReyaMarketSummary[]>(
        `${REYA_API}/perpMarkets/summary`,
      );
      if (!Array.isArray(summaries))
        throw new Error(`${VENUE}: unexpected perpMarkets/summary response`);
      return { snapshots: parseReyaSnapshots(summaries, definitions, now), settled: [] };
    },

    // No fetchFundingHistory: Reya publishes no market funding history.
  };
}

export const reyaAdapter: VenueAdapter = createReyaAdapter();
