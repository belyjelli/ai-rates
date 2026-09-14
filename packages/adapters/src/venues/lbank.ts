import {
  type AssetClass,
  canonicalBase,
  classifyNonCrypto,
  type FundingSnapshot,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, num } from "../parse";
import type { VenueAdapter } from "../types";
import { declaredMarketBase } from "./aster";

/**
 * LBank USDT-margined perpetuals (`productGroup=SwapU`).
 *
 * Measured from this machine on 2026-09-13 22:10–22:20 UTC (docs: lbank.com/docs/contract.html):
 *
 * - **Two endpoints.** `marketData` (300 KB) every cycle for funding, prices and volume;
 *   `instrument` (350 KB) hourly for the settle coin, declared base and `needSuspend`. The same 834
 *   symbols on both. `openInterest`, `fundingRate` and anything else under `/pub` answer 403, and the
 *   docs list only getTime, instrument, marketData and marketOrder: **no open interest and no
 *   funding history**, so `openInterestUsd` is null and there is no `fetchFundingHistory`.
 * - **`fundingRate` is the estimate for the period in progress**, so `kind: "predicted"`. It moved
 *   on 126 of 834 symbols between reads a minute apart (BTCUSDT 0.00007692 then 0.00007709), which a
 *   settled rate never does; that second BTC read equals WEEX's live `forecastFundingRate` exactly,
 *   and 444 of 609 shared symbols equal Binance's current estimate. Binance's 16:00 settlement for
 *   BTCUSDT was 0.0000645, which LBank showed nowhere. Polled every 5 minutes up to settlement, 198
 *   to 266 symbols moved on every read, and BTCUSDT's 23:55 read, 0.00007157, is exactly what Binance
 *   settled at 00:00. `positionFeeRate` equals `fundingRate` on
 *   every row. BTCUSDT 0.00007709 over 8h is 8.4% APR; Binance's estimate was 0.00007727.
 * - **Interval**: `positionFeeTime` in SECONDS — {28800: 338, 14400: 492, 3600: 4}. The four 3600s
 *   (VRT, STORJ, B3, IOST) are exactly the four whose `nextFeeTime` (epoch ms) was 23:00 UTC rather
 *   than 00:00, so it is the settlement interval.
 * - **Units**: `volume` is base units and `turnover` its USDT value: `turnover` / (`volume` × last) has
 *   median 1.010 over all traded rows. BTCUSDT turned over $240M against Binance's $4.71bn.
 *   `volumeMultiple` is 1 on every instrument. `underlyingPrice` is the index: median 0.0bp from
 *   `instrument.indexPrice`, where `markedPrice` sits 14.9bp away.
 * - **Tradability**: `instrumentStatus` is "2" on all 834 (undocumented; every one of them traded in
 *   the eight minutes before the read), and "2" is required. `clearCurrency` is USDT on all 834.
 *   Seven rows send no `fundingRate` or `positionFeeRate` at all (10TAUSDT, CRTUSDT, GUSDTUSDT, JMP,
 *   TICS, OBOL, 10001000SATS, all untraded in 24h) and are skipped: 827 markets collected.
 * - **Class**: LBank declares no category. `needSuspend` is 1 on nine instruments -- CEG, FIG,
 *   SUGAR, COCOA, COTTON, WHEAT, SOYBEAN, XZN, XAL -- every one a share or a commodity, and on no
 *   crypto, so it is read as "this market keeps trading hours: not crypto", with the class left to
 *   `classifyNonCrypto`. The other 825 declare nothing and are crypto, INCLUDING the tradfi names
 *   LBank lists without that flag: GOLDUSDT, SILVERUSDT, XPTUSDT, XCUUSDT, XTIUSDT, MUSTOCKUSDT,
 *   METASTOCKUSDT and others. That is LBank's declaration, not ours to correct from the ticker.
 * - **Base**: `baseCurrency` is declared. The parser agrees with it on all 834 except six
 *   contract-size prefixes (1000BTTC, 1000000BABYDOGE…), which it reads as multipliers.
 *   `symbolAlias` is a display name (`GOLD(XAU)`, `哈基米`, CROSS shown as `ONE`) and is not used.
 * - **Rate limit**: undocumented; ccxt costs these endpoints 2.5 against a 20ms unit, i.e. 20/s.
 *   Two requests a cycle, spaced at 100ms.
 */

const VENUE_ID = "lbank";
export const LBANK_API = "https://lbkperp.lbank.com/cfd/openApi/v1/pub";
const PRODUCT_GROUP = "SwapU";
/** The instrument list is 350 KB and only says what trades, so hourly. */
export const INSTRUMENTS_MAX_AGE_MS = 60 * 60_000;
/** The only `instrumentStatus` observed, on all 834 live instruments. */
const TRADING_STATUS = "2";
const SETTLE_COINS: ReadonlySet<string> = new Set(["USDT", "USDC"]);

export interface LbankEnvelope<T> {
  data: T;
  error_code: number;
  msg: string;
  success: boolean;
}

export interface LbankInstrument {
  symbol: string;
  baseCurrency: string;
  priceCurrency: string;
  /** The settlement currency. */
  clearCurrency: string;
  /** 1 on the instruments that keep trading hours; see the header. */
  needSuspend?: number;
  maxLeverage?: number;
}

export interface LbankMarketData {
  symbol: string;
  /** Estimate for the period in progress, a fraction per `positionFeeTime`. */
  fundingRate: string;
  positionFeeRate?: string;
  /** Settlement interval in seconds. */
  positionFeeTime: number;
  /** Next settlement, epoch ms. */
  nextFeeTime: number;
  markedPrice: string;
  /** The index price. */
  underlyingPrice: string;
  /** 24h turnover in the quote currency. */
  turnover: string;
  instrumentStatus: string;
}

export interface LbankTradable {
  quote: string;
  assetClass: AssetClass;
  /** Declared base where the parser disagrees with it; null keeps the parsed base. */
  base: string | null;
  maxLeverage: number | null;
}

function unwrap<T>(body: LbankEnvelope<T> | null | undefined, what: string): T {
  if (!body?.success || body.error_code !== 0 || !Array.isArray(body.data)) {
    throw new Error(
      `lbank: unexpected ${what} response: ${body?.error_code ?? ""} ${body?.msg ?? ""}`,
    );
  }
  return body.data;
}

/** LBank's declared class: `needSuspend` 1 is not crypto, and nothing else is declared. */
export function lbankAssetClass(instrument: LbankInstrument): AssetClass {
  return instrument.needSuspend === 1
    ? classifyNonCrypto(canonicalBase(instrument.baseCurrency))
    : "crypto";
}

/** Instruments settled in a dollar stablecoin, by symbol. */
export function tradableLbankInstruments(
  instruments: readonly LbankInstrument[],
): Map<string, LbankTradable> {
  return new Map(
    instruments
      .filter((i) => SETTLE_COINS.has(i.clearCurrency))
      .map((i) => [
        i.symbol,
        {
          quote: i.clearCurrency,
          assetClass: lbankAssetClass(i),
          base: declaredMarketBase({
            symbol: i.symbol,
            contractType: "",
            baseAsset: i.baseCurrency,
            quoteAsset: i.priceCurrency,
          }),
          // 10TAUSDT, which has not traded in 24h, declares a max leverage of 0: no figure at all.
          maxLeverage: (num(i.maxLeverage) ?? 0) > 0 ? num(i.maxLeverage) : null,
        },
      ]),
  );
}

export function parseLbankSnapshots(
  rows: readonly LbankMarketData[],
  tradable: ReadonlyMap<string, LbankTradable>,
  now: number,
): FundingSnapshot[] {
  const snapshots: FundingSnapshot[] = [];
  for (const row of rows) {
    const instrument = tradable.get(row.symbol);
    const rate = num(row.fundingRate) ?? num(row.positionFeeRate);
    const seconds = num(row.positionFeeTime);
    if (!instrument || row.instrumentStatus !== TRADING_STATUS) continue;
    if (rate === null || seconds === null || seconds <= 0) continue;

    const hours = seconds / 3600;
    const next = num(row.nextFeeTime);
    snapshots.push({
      ...marketRef(VENUE_ID, row.symbol, {
        quote: instrument.quote,
        assetClass: instrument.assetClass,
        ...(instrument.base ? { base: instrument.base } : {}),
      }),
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: next !== null && next > 0 ? next : null,
      kind: "predicted",
      markPrice: num(row.markedPrice),
      indexPrice: num(row.underlyingPrice),
      openInterestUsd: null,
      volume24hUsd: num(row.turnover),
      maxLeverage: instrument.maxLeverage,
    });
  }
  return snapshots;
}

export function createLbankAdapter(): VenueAdapter {
  let instruments: { fetchedAt: number; tradable: Map<string, LbankTradable> } | null = null;

  return {
    venueId: VENUE_ID,
    minIntervalMs: 100,

    async fetchSnapshots(client: HttpClient, now: number) {
      if (!instruments || now - instruments.fetchedAt >= INSTRUMENTS_MAX_AGE_MS) {
        const rows = unwrap(
          await client.getJson<LbankEnvelope<LbankInstrument[]>>(
            `${LBANK_API}/instrument?productGroup=${PRODUCT_GROUP}`,
          ),
          "instrument",
        );
        instruments = { fetchedAt: now, tradable: tradableLbankInstruments(rows) };
      }
      const rows = unwrap(
        await client.getJson<LbankEnvelope<LbankMarketData[]>>(
          `${LBANK_API}/marketData?productGroup=${PRODUCT_GROUP}`,
        ),
        "marketData",
      );
      return { snapshots: parseLbankSnapshots(rows, instruments.tradable, now), settled: [] };
    },
  };
}

export const lbankAdapter: VenueAdapter = createLbankAdapter();
