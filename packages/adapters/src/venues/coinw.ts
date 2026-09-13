import {
  type AssetClass,
  classifyNonCrypto,
  type FundingEvent,
  type FundingSnapshot,
  type MarketRef,
} from "@ai-rates/core";
import { CircuitOpenError, type HttpClient } from "../http";
import { marketRef, num, selectRefreshBatch } from "../parse";
import type { VenueAdapter } from "../types";
import { declaredMarketBase } from "./aster";

/**
 * CoinW USDT-margined perpetuals. ONLY THE LAST SETTLED RATE IS PUBLISHED, and only per contract,
 * so every snapshot is `kind: "settled"` and funding is refreshed on a rotating budget.
 *
 * Measured from this machine on 2026-09-13 22:28–22:40 UTC (docs: coinw.com/api-doc):
 *
 * - **Settled, not predicted.** `/v1/perpum/fundingRate?instrument=` is documented as "Get Last
 *   Settlement Funding Fee Rate" and answers `{ts, value}` with `ts` the settlement: BTC 0.0000645
 *   at 16:00 UTC and ETH -0.00004585 at 16:00, which are Binance's 16:00 settlements to the digit;
 *   TRB (4h) 0.00000463 at 20:00, Binance's 20:00. Binance's estimate for 00:00 was 0.00006548 at
 *   the same moment. No REST endpoint carries an estimate: `/perpumPublic/fundingRate`, `/index`,
 *   `/openInterest` and `/fundingRateHistory` are 404, and `/perpum/openInterest` and
 *   `/perpum/fundingRateHistory` answer 402 "param required" whatever the instrument (signed). The
 *   estimate exists only on the websocket funding channel, which a polling collector doesn't hold.
 * - **Interval** is declared per instrument in `settledPeriod` (239 at 8h, 174 at 4h) and a settled
 *   value covers that period: BTC's 0.0000645 over 8h is Binance's own 8h rate. `settledAt` on the
 *   instrument is the NEXT settlement (00:00 UTC on all 413).
 * - **Budget.** 8 requests a second per IP on this endpoint, and the collector abandons a cycle at
 *   45s. `FUNDING_REFRESH_BUDGET` 120 calls at 150ms is 18s a cycle and 6.7 requests a second. A
 *   settled rate is stale the moment the next settlement passes, so entries whose settlement period
 *   has elapsed are refreshed first and hidden until they are; everything else is re-read every 10
 *   minutes regardless. 411 contracts is four cycles from cold, or after every 00:00/08:00/16:00
 *   boundary, and about 41 requests a cycle between boundaries. Restoring the stored interval would
 *   show nothing sooner, since the rate itself is what's missing, so there is no `warmUp`.
 * - **Prices and units.** `/perpumPublic/tickers` is bulk. Its `fair_price` is documented as an
 *   "index price reference", but sampled three times against Binance's premiumIndex over 354 shared
 *   symbols it sat a median 2.5e-4 from Binance's mark and 1.0e-3 from its index, and BTCUSDT and
 *   BTCUSDC share one value: a mark, which is how it is published. There is no index price.
 *   `total_volume` is not a 24h figure (BTCUSDT 0.19, then 0.349 two minutes later), and nothing
 *   public reports open interest, so both are null.
 * - **Tradability.** 413 instruments: 401 `online` USDT, 10 `preOffline` USDT (stocks such as LRCX
 *   and SMCI, closing at `closeTime`; still settling, collected until then) and 2 USDC. The USDC
 *   pair has no public funding: `BTC_USDC`, `btc_usdc`, `BTCUSDC` and `BTC-USDC` all answer 9001
 *   "Contract not found", and `instrument=BTC&quote=usdc` silently answers the USDT contract. So 411
 *   are collected. The ticker also lists 15 `…PROPWUSDT` contracts with no instrument; the join is
 *   on contract id, which keeps them out.
 * - **Class.** `tradfiTag` is "" on all 413, stocks and SP500 included, and `partitionIds` are
 *   unlabelled numbers that don't track them (2033 is SHELL, MUBARAK, CAKE). CoinW declares nothing,
 *   so everything is crypto.
 * - **Base.** The venue symbol is the ticker's `name` (BTCUSDT). The declared `base` agrees with the
 *   parser on all 411 except six contract-size prefixes (1000PEPE…), read as multipliers, and SP500,
 *   which both sides canonicalise to US500.
 * - **History.** None public, so no `fetchFundingHistory`; each newly seen settlement is returned
 *   in `settled` instead.
 */

const VENUE_ID = "coinw";
export const COINW_API = "https://api.coinw.com/v1";
const HOUR_MS = 3_600_000;
/** Instruments are 550 KB; the list and intervals change rarely, so hourly. */
export const INSTRUMENTS_MAX_AGE_MS = HOUR_MS;
export const FUNDING_REFRESH_BUDGET = 120;
export const FUNDING_MAX_AGE_MS = 10 * 60_000;
/** A contract CoinW doesn't know, or one with nothing settled yet, is asked again after this long. */
const FUNDING_RETRY_MS = 30 * 60_000;
const OK = 0;
const CONTRACT_NOT_FOUND = 9001;

export interface CoinwEnvelope<T> {
  code: number;
  data: T;
  msg?: string;
}

export interface CoinwInstrument {
  id: number;
  /** What the funding endpoint takes: `BTC`, `1000PEPE`, `BTC_USDC`. */
  name: string;
  base: string;
  quote: string;
  status: string;
  /** Settlement interval, hours. */
  settledPeriod: number;
  /** Next settlement, epoch ms. */
  settledAt?: number;
  maxLeverage?: number;
  /** "" on every instrument today. */
  tradfiTag?: string;
  /** Present on `preOffline` instruments: when trading stops. */
  closeTime?: number;
}

export interface CoinwTicker {
  contract_id: number;
  /** `BTCUSDT`. */
  name: string;
  /** Mark price; see the header. */
  fair_price: number;
  last_price: number;
  quote_coin: string;
}

export interface CoinwFundingRate {
  /** The settlement this rate was paid at. */
  ts: number;
  value: number;
}

export interface CoinwFundingEntry {
  rate: number | null;
  settledAt: number | null;
  fetchedAt: number;
}

/**
 * Contracts collected: USDT-margined and either online or winding down before their `closeTime`.
 * USDC contracts have no public funding endpoint (see the header).
 */
export function isCoinwCollectable(instrument: CoinwInstrument, now: number): boolean {
  if (instrument.quote?.toLowerCase() !== "usdt") return false;
  const period = num(instrument.settledPeriod);
  if (period === null || period <= 0) return false;
  if (instrument.status === "online") return true;
  const closeTime = num(instrument.closeTime);
  return instrument.status === "preOffline" && closeTime !== null && closeTime > now;
}

/** CoinW declares no class today; a tag would be tradfi of a kind we can't read. */
export function coinwAssetClass(instrument: CoinwInstrument, base: string): AssetClass {
  return instrument.tradfiTag?.trim() ? classifyNonCrypto(base) : "crypto";
}

export function coinwRef(instrument: CoinwInstrument, venueSymbol: string): MarketRef {
  const quote = instrument.quote.toUpperCase();
  const declared = declaredMarketBase({
    symbol: venueSymbol,
    contractType: "",
    baseAsset: instrument.base.toUpperCase(),
    quoteAsset: quote,
  });
  const overrides = { quote, ...(declared ? { base: declared } : {}) };
  const { base } = marketRef(VENUE_ID, venueSymbol, overrides);
  return marketRef(VENUE_ID, venueSymbol, {
    ...overrides,
    assetClass: coinwAssetClass(instrument, base),
  });
}

/** True once the settlement after `entry` should have happened, so its rate is no longer the latest. */
export function isCoinwEntryOverdue(
  entry: CoinwFundingEntry,
  periodHours: number,
  now: number,
): boolean {
  return entry.settledAt !== null && entry.settledAt + periodHours * HOUR_MS <= now;
}

/** Reads one funding answer; null for a contract CoinW doesn't know. Throws on any other error. */
export function parseCoinwFundingRate(
  json: CoinwEnvelope<CoinwFundingRate | null>,
): { rate: number | null; settledAt: number | null } | null {
  if (json?.code === CONTRACT_NOT_FOUND) return null;
  if (json?.code !== OK) throw new Error(`coinw funding rate: ${json?.code} ${json?.msg ?? ""}`);
  const settledAt = num(json.data?.ts);
  return {
    rate: num(json.data?.value),
    settledAt: settledAt !== null && settledAt > 0 ? settledAt : null,
  };
}

export interface CoinwSnapshotInput {
  instruments: readonly CoinwInstrument[];
  tickers: readonly CoinwTicker[];
  funding: ReadonlyMap<string, CoinwFundingEntry>;
}

/**
 * Collectable contracts whose latest settlement is known and still the latest, with a mark price.
 * Funding is keyed by instrument `name`.
 */
export function parseCoinwSnapshots(input: CoinwSnapshotInput, now: number): FundingSnapshot[] {
  const tickers = new Map(input.tickers.map((t) => [t.contract_id, t]));
  const snapshots: FundingSnapshot[] = [];
  for (const instrument of input.instruments) {
    if (!isCoinwCollectable(instrument, now)) continue;
    const hours = num(instrument.settledPeriod) as number;
    const entry = input.funding.get(instrument.name);
    const ticker = tickers.get(instrument.id);
    const markPrice = num(ticker?.fair_price);
    if (
      !entry ||
      !ticker ||
      entry.rate === null ||
      entry.settledAt === null ||
      isCoinwEntryOverdue(entry, hours, now) ||
      markPrice === null
    ) {
      continue;
    }
    snapshots.push({
      ...coinwRef(instrument, ticker.name),
      observedAt: now,
      rate: entry.rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: entry.settledAt + hours * HOUR_MS,
      kind: "settled",
      markPrice,
      indexPrice: null,
      openInterestUsd: null,
      volume24hUsd: null,
      maxLeverage: num(instrument.maxLeverage),
    });
  }
  return snapshots;
}

export interface CoinwAdapterOptions {
  fundingRefreshBudget?: number;
}

export function createCoinwAdapter(options: CoinwAdapterOptions = {}): VenueAdapter {
  const budget = options.fundingRefreshBudget ?? FUNDING_REFRESH_BUDGET;
  let instruments: { fetchedAt: number; rows: CoinwInstrument[] } | null = null;
  const funding = new Map<string, CoinwFundingEntry>();

  return {
    venueId: VENUE_ID,
    // 8 requests a second per IP on the funding endpoint, 5 on tickers; 150ms is 6.7.
    minIntervalMs: 150,

    async fetchSnapshots(client: HttpClient, now: number) {
      if (!instruments || now - instruments.fetchedAt >= INSTRUMENTS_MAX_AGE_MS) {
        const json = await client.getJson<CoinwEnvelope<CoinwInstrument[]>>(
          `${COINW_API}/perpum/instruments`,
        );
        if (json?.code !== OK || !Array.isArray(json.data)) {
          throw new Error(`coinw instruments: ${json?.code} ${json?.msg ?? ""}`);
        }
        instruments = { fetchedAt: now, rows: json.data };
      }
      const tickersJson = await client.getJson<CoinwEnvelope<CoinwTicker[]>>(
        `${COINW_API}/perpumPublic/tickers`,
      );
      if (tickersJson?.code !== OK || !Array.isArray(tickersJson.data)) {
        throw new Error(`coinw tickers: ${tickersJson?.code} ${tickersJson?.msg ?? ""}`);
      }

      const collectable = instruments.rows.filter((i) => isCoinwCollectable(i, now));
      const periods = new Map(collectable.map((i) => [i.name, num(i.settledPeriod) as number]));
      for (const name of funding.keys()) {
        if (!periods.has(name)) funding.delete(name);
      }
      // An entry whose settlement period has elapsed counts as never fetched, so it goes first.
      const current = new Map(
        [...funding].filter(
          ([name, entry]) => !isCoinwEntryOverdue(entry, periods.get(name) as number, now),
        ),
      );
      const settled: FundingEvent[] = [];
      const bySymbol = new Map(tickersJson.data.map((t) => [t.contract_id, t]));
      for (const name of selectRefreshBatch(
        collectable.map((i) => i.name),
        current,
        now,
        budget,
        FUNDING_MAX_AGE_MS,
      )) {
        try {
          const parsed = parseCoinwFundingRate(
            await client.getJson<CoinwEnvelope<CoinwFundingRate | null>>(
              `${COINW_API}/perpum/fundingRate?instrument=${encodeURIComponent(name)}`,
            ),
          );
          const previous = funding.get(name);
          if (parsed === null || parsed.rate === null || parsed.settledAt === null) {
            funding.set(name, {
              rate: null,
              settledAt: null,
              fetchedAt: now - FUNDING_MAX_AGE_MS + FUNDING_RETRY_MS,
            });
            continue;
          }
          funding.set(name, { ...parsed, fetchedAt: now });
          const instrument = collectable.find((i) => i.name === name);
          const ticker = instrument ? bySymbol.get(instrument.id) : undefined;
          if (instrument && ticker && previous?.settledAt !== parsed.settledAt) {
            settled.push({
              ...coinwRef(instrument, ticker.name),
              settledAt: parsed.settledAt,
              rate: parsed.rate,
              basisHours: periods.get(name) as number,
              markPrice: null,
            });
          }
        } catch (error) {
          if (error instanceof CircuitOpenError) break;
          // Leave this contract for a later cycle; one bad answer shouldn't fail the batch.
        }
      }

      const snapshots = parseCoinwSnapshots(
        { instruments: collectable, tickers: tickersJson.data, funding },
        now,
      );
      return { snapshots, settled };
    },
  };
}

export const coinwAdapter: VenueAdapter = createCoinwAdapter();
