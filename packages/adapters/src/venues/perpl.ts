import type { FundingEvent, FundingSnapshot } from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, num } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * Perpl (Monad), public REST at https://app.perpl.xyz/api/v1.
 *
 * Measured from this machine on 2026-09-13 22:29–22:45 UTC, against https://docs.perpl.xyz/llms-full.txt
 * and the app's own bundle (https://app.perpl.xyz/assets/index-*.js).
 *
 * REQUESTS: one per cycle, `GET /pub/context` (11.6 KB). It carries every market's config, live state
 * (mark, oracle, OI, 24h volume) and latest funding event, so nothing else is needed. The catalog's
 * "10 req/min" is the WebSocket; the REST reference gives "REST public ~100 req/min" for `/api/v1/pub/*`
 * and the response is served `cache-control: max-age=10`. One call a minute is a hundredth of the
 * budget, so there is no skipping of cycles. No REST endpoint publishes market funding history (the
 * only funding history is the signed, per-account `/trading/account-history`), so there is no
 * `fetchFundingHistory`: history accrues forward from the settled events below.
 *
 * FUNDING — what `funding` is. The docs define no REST or WebSocket shape for it ("MarketFundingUpdate
 * ... payload shapes are not defined"), so the fields are read the way the app reads them:
 * `fundingRateValue: rate, fundingIndexPrice: idx, fundingSum: sum, fundingSumDivider: div,
 * fundingBlock: feb`, with the next event at `feb + funding_interval_blocks`. `funding.at.b` equals
 * `feb`, and the object describes one event, with `sum` already including it. Polled every 20s
 * across the 22:36:40 UTC event, the object switched once, at the event, and was then constant; it
 * first showed while the chain head was 16 blocks (~5s) short of the event block. The docs say the
 * rate is "set at a fixed time prior to the funding event" and "can be set up to 143 blocks in advance
 * (1 minute)", so a forecast is visible for at most a minute before each event. What REST shows is
 * the applied rate: snapshots are `kind: "settled"`, and each is also returned as a settled event.
 * `funding.at.t` read 1789339000946 once and 1789339000000 afterwards for the same event, so the
 * settlement time is floored to whole seconds, or one event would be stored twice.
 *
 * FUNDING — the scale. `rate` is micros (1e-6) of the index price per funding event:
 * - the contract's `FundingEventCompleted` carries `actualRatePct100k`, `fundingPricePNS` and
 *   `fundingPaymentPNS`, and `ppl` is that payment: on every market `ppl = idx x rate x 1e-6 x div`,
 *   truncated (BTC 773,036 x 40e-6 = 30.9 -> 30; ETH 250,899 x -40e-6 = -10.0 -> -10, then
 *   248,018 x -20e-6 = -4.96 -> -4; LIT x div 10 -> -170; MON x div 100 -> 92);
 * - the app values premium PnL as (entry sum - current sum) x size / div, in price units, and across
 *   the 22:36 event `sum` moved by that event's `ppl` (BTC -40,179 -> -40,149, ETH 1,013 -> 1,009).
 *   So a BTC long paid 3.0 USD per BTC at an index of 76,801.7: 3.9e-5, i.e. 40 micros.
 * Positive means longs pay: a positive rate gives a positive `ppl`, `sum` rises by it, and a rising sum
 * is a loss to longs in the app's formula. The rate moves in coarse steps of 10 micros: across 24
 * reads on 2026-09-13 every market read -40, -20, 0, +10 or +40.
 * Cross-check with Hyperliquid at 22:39 UTC: BTC +40 micros per 43 min is 5.6e-5/h here against
 * 1.25e-5/h there, ETH -5.6e-5/h against +1.25e-5/h. The same order of magnitude, with Perpl's rate
 * sitting at its clamp; a 1e6 error would read 40 (4,000%) or 4e-11.
 *
 * FUNDING — the interval. `funding_interval_sec` is 2580 on every market and is what the app counts
 * down. Events are really 8,571 blocks apart (`funding_interval_blocks`; the docs' "approximately once
 * per hour" assumes 0.42s blocks, Monad runs ~0.31s): the 22:36:40 event came 8,571 blocks and 2,632s
 * after the one before, 2% longer than declared. The declared 2580s = 0.7167h is used as basis and
 * interval, and `nextFundingAt` is one declared interval after the last event, so it runs about a
 * minute early.
 *
 * UNITS. Prices are integers over 10^`price_decimals`; `oi` and `dv` over 10^`size_decimals`
 * (BTC oi 1,086,858 = 10.87 BTC). `dva`, the day's volume "amount", is in the collateral token's own
 * decimals: BTC 291,977,473,222,361 / 1e6 = $291.98M against dv 3,786.23 BTC x ~77,000, and ETH
 * 2,335,278,221,490 / 1e6 = $2.34M against 936 ETH x 2,480, where price+size decimals would be 1e5.
 * Mark is `mrk`, index is `orl` (the oracle), and OI x mark is USD.
 *
 * TRADABILITY: `config.is_open`. QUOTE: the instance's collateral token, AUSD. CLASS: Perpl declares
 * none, and its eight markets are crypto. BASE: `name` (BTC, MON, ETH ...) parses as itself; `symbol`
 * is empty on BTC and MON.
 */

const VENUE = "perpl";
export const PERPL_API = "https://app.perpl.xyz/api/v1";
const MICROS = 1e-6;
const HOUR_MS = 3_600_000;

export interface PerplTimestamp {
  /** Block number. */
  b: number;
  /** Epoch ms. */
  t: number;
}

export interface PerplToken {
  id: number;
  symbol: string;
  decimals: number;
}

export interface PerplInstance {
  id: number;
  collateral_token_id: number;
}

export interface PerplMarket {
  id: number;
  instance_id: number;
  name: string;
  funding_interval_sec: number;
  funding_interval_blocks?: number;
  config: { is_open: boolean; price_decimals: number; size_decimals: number };
  state: {
    at: PerplTimestamp;
    /** Oracle price. */
    orl: number;
    /** Mark price. */
    mrk: number;
    /** Open interest, size-scaled. */
    oi: number;
    /** 24h volume in the collateral token's decimals. */
    dva?: string;
  };
  funding?: {
    at: PerplTimestamp;
    /** Block of the funding event this describes. */
    feb: number;
    /** Micros of the index price per funding event. */
    rate: number;
    /** Index price at the event, price-scaled. */
    idx: number;
  } | null;
}

export interface PerplContext {
  instances: PerplInstance[];
  tokens: PerplToken[];
  markets: PerplMarket[];
}

function scaled(value: unknown, decimals: number): number | null {
  const n = num(value);
  return n === null ? null : n / 10 ** decimals;
}

export function parsePerplContext(context: PerplContext, now: number): SnapshotBatch {
  const tokens = new Map(context.tokens.map((t) => [t.id, t]));
  const collateral = new Map(
    context.instances.map((i) => [i.id, tokens.get(i.collateral_token_id)]),
  );
  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];

  for (const market of context.markets) {
    const funding = market.funding;
    const rateMicros = num(funding?.rate);
    const eventMs = num(funding?.at?.t);
    // The same event is served with and without its milliseconds; see the header.
    const settledAt = eventMs === null ? null : Math.floor(eventMs / 1000) * 1000;
    const intervalSec = num(market.funding_interval_sec);
    if (
      !market.config?.is_open ||
      !funding ||
      rateMicros === null ||
      settledAt === null ||
      settledAt <= 0 ||
      intervalSec === null ||
      intervalSec <= 0
    ) {
      continue;
    }

    const token = collateral.get(market.instance_id);
    // Perpl declares no asset class; every market it lists is crypto.
    const ref = marketRef(VENUE, market.name, { quote: token?.symbol ?? null });
    const { price_decimals: priceDecimals, size_decimals: sizeDecimals } = market.config;
    const markPrice = scaled(market.state?.mrk, priceDecimals);
    const openInterest = scaled(market.state?.oi, sizeDecimals);
    const hours = intervalSec / 3600;
    const rate = rateMicros * MICROS;

    snapshots.push({
      ...ref,
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: settledAt + hours * HOUR_MS,
      kind: "settled",
      markPrice,
      indexPrice: scaled(market.state?.orl, priceDecimals),
      openInterestUsd:
        openInterest !== null && markPrice !== null ? openInterest * markPrice : null,
      volume24hUsd: token ? scaled(market.state?.dva, token.decimals) : null,
    });
    settled.push({ ...ref, settledAt, rate, basisHours: hours, markPrice: null });
  }
  return { snapshots, settled };
}

export function createPerplAdapter(): VenueAdapter {
  return {
    venueId: VENUE,
    // ~100 public requests a minute; one per cycle is used.
    minIntervalMs: 1000,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      const context = await client.getJson<PerplContext>(`${PERPL_API}/pub/context`);
      if (
        !Array.isArray(context?.markets) ||
        !Array.isArray(context.tokens) ||
        !Array.isArray(context.instances)
      ) {
        throw new Error(`${VENUE}: unexpected pub/context response`);
      }
      return parsePerplContext(context, now);
    },

    // No fetchFundingHistory: Perpl publishes no public market funding history.
  };
}

export const perplAdapter: VenueAdapter = createPerplAdapter();
