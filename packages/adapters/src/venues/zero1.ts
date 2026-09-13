import { type FundingEvent, type FundingSnapshot, parseVenueSymbol } from "@ai-rates/core";
import { marketRef, mul, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * N1 / 01 Exchange (Nord engine, `zo-mainnet.n1.xyz`).
 *
 * REQUESTS: `GET /markets/live` every cycle, plus `GET /info` once an hour. The catalog probes the
 * per-market `/market/{id}/stats`, but the engine's own OpenAPI (`/openapi.json`, "nord" 20.0.0)
 * lists `/markets/live` -- "Live market info such as index price, funding rate, and so on" -- for
 * every market in one ~20 KB call. No rate limit is documented; two requests a minute at 250ms
 * spacing is far below anything the per-market route would have needed (39 calls).
 *
 * FUNDING -- which field. `perpetuals.projectedFundingRate` is "the projected funding rate for the
 * next funding time", so it is `predicted`. The catalog's `perpStats.funding_rate` is NOT that: sampled
 * together on 2026-09-13 22:35-22:38 UTC, BTC's stats `funding_rate` read -0.000001 every minute and
 * equalled `historical.perpetuals.lastSettledFundingRate`, while the projection read +0.000001.
 * Storing the stats value as predicted would label a settled rate predicted.
 *
 * FUNDING -- units and period. A fraction per ONE hour, positive = longs pay. Settlement is
 * "locked to the hour" (`nextFundingTime`), and `/market/{id}/history/PT1H` rows are an hour apart.
 * The unit is proved from the funding index, which the spec defines as "basis points numerator x
 * market price mantissa" in per-million steps: BTC's `fundingIndex` rose 3,090,324 at the 20:00
 * settlement, which is exactly the settled 4e-6 x 1e6 x the index price mantissa 772,581
 * (77,258.1 at 1 price decimal). So the published 4e-6 is what a unit of notional paid that hour --
 * a fraction, not percent. BTC settles near zero here (-1e-6 at 22:00) against Hyperliquid's
 * +0.0000114/h: N1 has no interest-rate floor, so a small book sits on either side of zero.
 * ETH's settled 0.00002 (20:00) and 0.000009 (21:00) are Hyperliquid-sized hourly numbers.
 *
 * The projection is what settles: at 22:59 UTC BTC projected 0.000002 and ETH -0.000006, and the
 * 23:00 history rows are exactly 0.000002 and -0.000006. It "becomes null right after funding is
 * paid"; by 23:00:32 BTC already projected the next hour again, and at 23:01 the only null among
 * 39 markets was frozen IPUSD. A market caught in that gap is skipped for the cycle rather than shown
 * with its settled rate under a predicted label.
 *
 * UNITS: `openInterest` is base units (BTC 3.87 x 76,795 = $297k); `volumeQuote24h` is quote (USDC),
 * BTC $1.45M against 18.8 BTC base volume.
 *
 * TRADABILITY: in `/info` and not `frozen` ("admin can freeze market ... or if market permanently
 * delisted"), with a mark and a projection. On 2026-09-13: 39 markets, 26 CLOB and 13 RFQ-mode, all
 * regime normal; one frozen (IPUSD, no book since 2026-09-08). RFQ markets trade and accrue funding
 * like the rest, so they are kept.
 *
 * CLASS: N1 declares none; every market is crypto (PAXG is the gold token).
 *
 * QUOTE: the `quoteTokenId` token from `/info`, which is USDC (token 0) on every market.
 *
 * BASE: the parser splits two of 39 symbols wrongly -- `ARBUSD` as AR/BUSD and `BNBUSD` as BN/BUSD
 * -- because BUSD is a quote it knows. N1 declares no base field (every market's `baseTokenId` is 0,
 * the USDC token), so the base comes from its symbol grammar: `<base>USD`, as every one of the 39
 * symbols is spelt. The remainder still goes through the parser, so `kPEPE` reads as PEPE x1000,
 * as it does on Hyperliquid.
 */

const VENUE = "zero1";
export const ZERO1_API = "https://zo-mainnet.n1.xyz";
const SYMBOL_SUFFIX = "USD";
const FUNDING_HOURS = 1;
export const INFO_MAX_AGE_MS = 60 * 60_000;
/** `pageSize` is a uint8; 255 is the most a page holds (measured). */
const HISTORY_PAGE_SIZE = 255;
const HISTORY_MAX_PAGES = 40;

export interface Zero1MarketInfo {
  marketId: number;
  symbol: string;
  quoteTokenId: number;
  mode?: string;
  regime?: string;
}

export interface Zero1Info {
  markets: Zero1MarketInfo[];
  tokens: { tokenId: number; symbol: string }[];
}

export interface Zero1MarketLive {
  marketId: number;
  frozen?: boolean;
  indexPrice?: number | null;
  perpetuals?: {
    markPrice?: number | null;
    projectedFundingRate?: number | null;
    nextFundingTime?: string;
    openInterest?: number;
  } | null;
  historical?: {
    volumeQuote24h?: number;
    perpetuals?: { lastSettledFundingRate?: number } | null;
  } | null;
}

export interface Zero1HistoryRow {
  marketId: number;
  time: string;
  fundingRate: number;
  markPrice?: number;
}

export interface Zero1HistoryPage {
  items: Zero1HistoryRow[];
  nextStartInclusive?: number | null;
}

/** Base and multiplier from N1's `<base>USD` symbol, or null for a symbol not in that form. */
export function zero1Base(symbol: string): { base: string; multiplier: number } | null {
  if (!symbol.endsWith(SYMBOL_SUFFIX) || symbol.length <= SYMBOL_SUFFIX.length) return null;
  const parsed = parseVenueSymbol(symbol.slice(0, -SYMBOL_SUFFIX.length));
  return { base: parsed.base, multiplier: parsed.multiplier };
}

function ref(market: Zero1MarketInfo, tokens: ReadonlyMap<number, string>) {
  const declared = zero1Base(market.symbol);
  if (!declared) return null;
  return marketRef(VENUE, market.symbol, {
    ...declared,
    quote: tokens.get(market.quoteTokenId) ?? null,
  });
}

export function parseZero1Snapshots(
  info: Zero1Info,
  live: readonly Zero1MarketLive[],
  now: number,
): FundingSnapshot[] {
  const markets = new Map(info.markets.map((m) => [m.marketId, m]));
  const tokens = new Map(info.tokens.map((t) => [t.tokenId, t.symbol]));
  const snapshots: FundingSnapshot[] = [];
  for (const row of live) {
    const market = markets.get(row.marketId);
    const perp = row.perpetuals;
    const rate = num(perp?.projectedFundingRate);
    const markPrice = num(perp?.markPrice);
    const marketRefValue = market ? ref(market, tokens) : null;
    if (!marketRefValue || row.frozen || !perp || rate === null || markPrice === null) continue;
    const next = perp.nextFundingTime ? Date.parse(perp.nextFundingTime) : Number.NaN;
    snapshots.push({
      ...marketRefValue,
      observedAt: now,
      rate,
      basisHours: FUNDING_HOURS,
      intervalHours: FUNDING_HOURS,
      nextFundingAt: Number.isFinite(next) ? next : null,
      kind: "predicted",
      markPrice,
      indexPrice: num(row.indexPrice),
      openInterestUsd: mul(num(perp.openInterest), markPrice),
      volume24hUsd: num(row.historical?.volumeQuote24h),
    });
  }
  return snapshots;
}

/**
 * Hourly settlements within [fromMs, toMs], oldest first. `time` carries the settlement run's jitter
 * (`22:00:00.333152Z`) and is kept as published, as Extended's and dYdX's are.
 */
export function parseZero1Funding(
  rows: readonly Zero1HistoryRow[],
  market: Zero1MarketInfo,
  info: Pick<Zero1Info, "tokens">,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(market, new Map(info.tokens.map((t) => [t.tokenId, t.symbol])));
  if (!base) return [];
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const settledAt = Date.parse(row.time);
    const rate = num(row.fundingRate);
    if (!Number.isFinite(settledAt) || rate === null || settledAt < fromMs || settledAt > toMs) {
      continue;
    }
    bySettlement.set(settledAt, {
      ...base,
      settledAt,
      rate,
      basisHours: FUNDING_HOURS,
      markPrice: num(row.markPrice),
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

export function createZero1Adapter(): VenueAdapter {
  let info: { fetchedAt: number; body: Zero1Info } | null = null;

  async function loadInfo(client: Parameters<VenueAdapter["fetchSnapshots"]>[0], now: number) {
    if (info && now - info.fetchedAt < INFO_MAX_AGE_MS) return info.body;
    const body = await client.getJson<Zero1Info>(`${ZERO1_API}/info`);
    if (!Array.isArray(body?.markets) || !Array.isArray(body?.tokens)) {
      throw new Error(`${VENUE}: unexpected info response`);
    }
    info = { fetchedAt: now, body };
    return body;
  }

  return {
    venueId: VENUE,
    minIntervalMs: 250,

    async fetchSnapshots(client, now): Promise<SnapshotBatch> {
      const markets = await loadInfo(client, now);
      const live = await client.getJson<{ markets: Zero1MarketLive[] }>(
        `${ZERO1_API}/markets/live`,
      );
      if (!Array.isArray(live?.markets))
        throw new Error(`${VENUE}: unexpected markets/live response`);
      return { snapshots: parseZero1Snapshots(markets, live.markets, now), settled: [] };
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const body = await loadInfo(client, Date.now());
      const market = body.markets.find((m) => m.symbol === venueSymbol);
      if (!market) return [];
      // Newest first, cursor by action id; stop once a page reaches back past fromMs.
      const rows: Zero1HistoryRow[] = [];
      let cursor: number | null = null;
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const url: string = `${ZERO1_API}/market/${market.marketId}/history/PT1H?pageSize=${HISTORY_PAGE_SIZE}${cursor === null ? "" : `&startInclusive=${cursor}`}`;
        const result: Zero1HistoryPage = await client.getJson<Zero1HistoryPage>(url);
        if (!Array.isArray(result?.items)) throw new Error(`${VENUE}: unexpected history response`);
        rows.push(...result.items);
        const oldest = Math.min(...result.items.map((r: Zero1HistoryRow) => Date.parse(r.time)));
        cursor = result.nextStartInclusive ?? null;
        if (cursor === null || result.items.length === 0 || oldest < fromMs) break;
      }
      return parseZero1Funding(rows, market, body, fromMs, toMs);
    },
  };
}

export const zero1Adapter: VenueAdapter = createZero1Adapter();
