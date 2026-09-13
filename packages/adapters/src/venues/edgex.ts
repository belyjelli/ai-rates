import {
  type AssetClass,
  type FundingEvent,
  type FundingSnapshot,
  parseVenueSymbol,
} from "@ai-rates/core";
import type { HttpClient } from "../http";
import { marketRef, mul, num, selectRefreshBatch } from "../parse";
import type { SnapshotBatch, VenueAdapter } from "../types";

/**
 * edgeX V2 (catalog id `edgex-v2`).
 *
 * WHY ONLY V2: edgeX V1 (`pro.edgex.exchange/api/v1`, catalog id `edgex`) is not collected. On
 * 2026-09-13 its `getMetaData` still listed 189 tradeable contracts, but every data call came back
 * empty: `getLatestFundingRate` with and without `contractId=10000001`, `getTicker`, `getKline`,
 * `getDepth` and `getFundingRatePage` all returned `data: []`. The docs describe V2 as "transitioning
 * from our successful V1 foundation" (https://edgex-1.gitbook.io/edgeX-documentation/edgex-v2), and
 * the web app at pro.edgex.exchange now trades the V2 `*USDC` contracts. There is no V1 book left.
 *
 * REQUESTS per cycle: one `getLatestFundingRate` carrying every live contract id, plus up to
 * `TICKER_BUDGET` per-contract `getTicker` calls for open interest and volume, plus `getMetaData` and
 * `contract-labels` once an hour.
 * - The funding call takes `contractId` as an array (https://edgex-1.gitbook.io/edgeX-documentation/
 *   api-v2/public-api/funding-api) with no documented maximum; all 173 ids comma-joined answered 173
 *   rows in one call (115 KB). Ids are still chunked at 200 so a larger listing cannot build one URL.
 * - `getTicker` is the only public source of open interest, and it answers one contract at a time:
 *   comma-joined ids and no id both return `data: []`, and the `getTickerSummary` the docs show is
 *   404. So tickers refresh round-robin, `TICKER_BUDGET` per cycle, and a value older than
 *   `TICKER_MAX_AGE_MS` is dropped rather than shown.
 * - No rate limit is published ("Rate Limits Apply"); 80 sequential `getTicker` calls at ~4.4/s all
 *   returned 200 on 2026-09-13, so 300ms spacing leaves headroom.
 *
 * FUNDING, decided from the docs and successive live reads on 2026-09-13:
 * - Interval 4h. `fundingRateIntervalMin` is 240 on all 173 contracts, the settlement-only history
 *   (`filterSettlementFundingRate=true`) has BTC rows at 12:00, 16:00 and 20:00Z, and the ticker's
 *   `nextFundingTime` is `fundingTime` + 4h. The docs' "settlement occurs every 8 hours" (history
 *   filter) and "exchanged every hour" (Funding Fees page) are V1 text.
 * - Basis = the interval: rates are per 4h. ETH read 0.00005, the interest floor
 *   (`predictedFundingRate`, "interestRate/frequency" = 0.0003 / 6), which is 0.0000125/h and 10.95%
 *   APR -- Hyperliquid's ETH read exactly 0.0000125/h the same minute. An hourly reading would be
 *   43.8%. BTC -0.00005233/4h is -0.0000131/h against Hyperliquid's +0.0000117/h: the same size, and
 *   the sign is edgeX's own discount (impact bid 76,690.6 under index 76,740.8).
 * - `forecastFundingRate` is the snapshot, `predicted`, due at `fundingTime` + interval. It moved
 *   -0.00005233 -> -0.00005234 -> -0.00005592 over three reads while `fundingTime` stayed 20:00Z,
 *   and the ticker (the app's own field) shows that same value against `nextFundingTime`.
 * - `fundingRate` is the last settlement, emitted as `settled` at `fundingTime`: it held at
 *   -0.00005067 across the same reads and equals the history row flagged `isSettlement: true` at
 *   20:00Z. The field doc's example ("finalized at 08:00, and used for settlement at 09:00") could
 *   be read as paying it one interval later; the venue's own settlement flag is what is followed.
 *
 * UNITS, checked live: the funding row carries `markPrice` and `indexPrice`. Ticker `openInterest` is
 * base units (BTC 3,284.957 x 76,773.6 = $252M) and `value` is the 24h quote volume (BTC 211,555,185
 * over `size` 2,748.205 averages 76,979, inside that day's 76,453-77,404 range).
 *
 * TRADABILITY: `enableTrade`, `enableOpenPosition` and `enableDisplay`. 170 of 173 on 2026-09-13; the
 * three tradeable but hidden contracts are ZROUSDC, JPYUSDC and EURUSDC.
 *
 * QUOTE: the settlement coin the metadata declares, `coinList` entry `quoteCoinId` 1000, which is
 * USDC for every V2 contract (and `global.collateralCoinId` is 1000). V1 named the same id "USD".
 *
 * BASE: the parser's reading of `contractName` matched the declared base coin (`baseCoinId`, with
 * `1000PEPE` read as PEPE x1000) on 171 of 173. The two that differ are named in CJK: 哈基米USDC
 * declares HAJIMI and 牛来USDC declares NIULAI, and the declaration is passed.
 */

const VENUE = "edgex-v2";
export const EDGEX_V2_API = "https://edgex-prod-v2.edgex.exchange/api/v2/public";
const MINUTE_MS = 60_000;
const META_TTL_MS = 60 * MINUTE_MS;
const FUNDING_BATCH = 200;
export const TICKER_BUDGET = 15;
/** 173 contracts at 15 a cycle is a full sweep every ~12 cycles. */
const TICKER_REFRESH_MS = 15 * MINUTE_MS;
const TICKER_MAX_AGE_MS = 45 * MINUTE_MS;
const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 50;
const SUCCESS = "SUCCESS";

export interface EdgexResponse<T> {
  code: string;
  data: T;
  msg?: string | null;
}

export interface EdgexCoin {
  coinId: string;
  coinName: string;
}

export interface EdgexContract {
  contractId: string;
  contractName: string;
  baseCoinId: string;
  quoteCoinId: string;
  enableTrade: boolean;
  enableDisplay: boolean;
  enableOpenPosition: boolean;
  isStock?: boolean;
  isFx?: boolean;
  fundingRateIntervalMin?: string;
  displayMaxLeverage?: string;
}

export interface EdgexMetaData {
  coinList: EdgexCoin[];
  contractList: EdgexContract[];
}

export interface EdgexFundingRate {
  contractId: string;
  /** Epoch ms of the latest settlement. */
  fundingTime: string;
  fundingTimestamp?: string;
  markPrice?: string;
  indexPrice?: string;
  /** The rate settled at `fundingTime`. */
  fundingRate: string;
  /** Running estimate for the next settlement; empty on history rows. */
  forecastFundingRate?: string;
  isSettlement?: boolean;
  fundingRateIntervalMin?: string;
}

export interface EdgexTicker {
  contractId: string;
  /** Base units. */
  openInterest?: string;
  /** 24h quote volume. */
  value?: string;
}

export interface EdgexContractLabel {
  name: string;
  multiLanguageKey: string;
  productCategory: string;
  contracts: { contractId: string; contractName: string }[];
}

export interface EdgexFundingPage {
  dataList: EdgexFundingRate[];
  nextPageOffsetData: string;
}

/** Metadata indexed for parsing: contracts by id, coin names by id, and label-declared classes. */
export interface EdgexMarkets {
  contracts: Map<string, EdgexContract>;
  coins: Map<string, string>;
  labels: Map<string, AssetClass>;
}

/** The label set the V2 app files its markets under; `AppTradFi` is another app's, and puts JPM under Commodities. */
const V2_LABELS = "PrepV2";
const LABEL_CLASSES: Record<string, AssetClass> = {
  "tabs.commodities": "commodity",
  "tabs.stocks": "equity",
  "tabs.etf": "equity",
  "tabs.pre-ipo": "equity",
};

/**
 * Classes declared by the app's market tabs (`/api/v2/public/contract-labels`, undocumented, read by
 * the web app at pro.edgex.exchange). Only the tradfi tabs are kept; Layer 1, Meme, AI and the like
 * say nothing about class.
 */
export function edgexLabelClasses(labels: readonly EdgexContractLabel[]): Map<string, AssetClass> {
  const classes = new Map<string, AssetClass>();
  for (const label of labels) {
    const assetClass = LABEL_CLASSES[label.multiLanguageKey];
    if (label.productCategory !== V2_LABELS || !assetClass) continue;
    for (const contract of label.contracts) classes.set(contract.contractId, assetClass);
  }
  return classes;
}

/**
 * The class edgeX declares for a contract.
 *
 * `isFx` and `isStock` are flags on the contract itself; on 2026-09-13 they marked 2 and 93 of 173.
 * Commodities carry neither flag -- XAU, XAG, CL, BZ, COPPER, NATGAS, XPD and XPT are all
 * `isStock: false, isFx: false` -- so their only declaration is the app's Commodities tab. The flags
 * win over a tab. ETFs (SPY, QQQ, SOXL) are `isStock` and pass as equity. Anything else is crypto.
 */
export function edgexAssetClass(
  contract: Pick<EdgexContract, "isStock" | "isFx">,
  labelled: AssetClass | undefined,
): AssetClass {
  if (contract.isFx) return "fx";
  if (contract.isStock) return "equity";
  return labelled ?? "crypto";
}

export function edgexIsLive(contract: EdgexContract): boolean {
  return contract.enableTrade && contract.enableOpenPosition && contract.enableDisplay;
}

export function indexEdgexMarkets(
  meta: EdgexMetaData,
  labels: readonly EdgexContractLabel[],
): EdgexMarkets {
  return {
    contracts: new Map(meta.contractList.map((c) => [c.contractId, c])),
    coins: new Map(meta.coinList.map((c) => [c.coinId, c.coinName])),
    labels: edgexLabelClasses(labels),
  };
}

function ref(contract: EdgexContract, markets: EdgexMarkets) {
  const declared = markets.coins.get(contract.baseCoinId);
  const parsed = parseVenueSymbol(contract.contractName);
  const parsedCode = parsed.multiplier === 1 ? parsed.base : `${parsed.multiplier}${parsed.base}`;
  const overrides = declared && declared !== parsedCode ? { base: declared } : {};
  return marketRef(VENUE, contract.contractName, {
    ...overrides,
    quote: markets.coins.get(contract.quoteCoinId) ?? null,
    assetClass: edgexAssetClass(contract, markets.labels.get(contract.contractId)),
  });
}

function intervalMinutes(row: EdgexFundingRate, contract: EdgexContract): number | null {
  const minutes = num(row.fundingRateIntervalMin) ?? num(contract.fundingRateIntervalMin);
  return minutes !== null && minutes > 0 ? minutes : null;
}

export function parseEdgexSnapshots(
  markets: EdgexMarkets,
  rates: readonly EdgexFundingRate[],
  tickers: ReadonlyMap<string, { ticker: EdgexTicker | null; fetchedAt: number }>,
  now: number,
): SnapshotBatch {
  const snapshots: FundingSnapshot[] = [];
  const settled: FundingEvent[] = [];
  for (const row of rates) {
    const contract = markets.contracts.get(row.contractId);
    if (!contract || !edgexIsLive(contract)) continue;
    const minutes = intervalMinutes(row, contract);
    const rate = num(row.forecastFundingRate);
    if (minutes === null || rate === null) continue;

    const hours = minutes / 60;
    const base = ref(contract, markets);
    const fundingTime = num(row.fundingTime);
    const markPrice = num(row.markPrice);
    const cached = tickers.get(row.contractId);
    const ticker = cached && now - cached.fetchedAt <= TICKER_MAX_AGE_MS ? cached.ticker : null;

    snapshots.push({
      ...base,
      observedAt: now,
      rate,
      basisHours: hours,
      intervalHours: hours,
      nextFundingAt: fundingTime !== null ? fundingTime + minutes * MINUTE_MS : null,
      kind: "predicted",
      markPrice,
      indexPrice: num(row.indexPrice),
      openInterestUsd: mul(num(ticker?.openInterest), markPrice),
      volume24hUsd: num(ticker?.value),
      maxLeverage: num(contract.displayMaxLeverage),
    });

    const applied = num(row.fundingRate);
    if (applied !== null && fundingTime !== null) {
      settled.push({
        ...base,
        settledAt: fundingTime,
        rate: applied,
        basisHours: hours,
        markPrice: null,
      });
    }
  }
  return { snapshots, settled };
}

/** Settlement rows within [fromMs, toMs], oldest first; the mark is the one recorded at settlement. */
export function parseEdgexFundingHistory(
  rows: readonly EdgexFundingRate[],
  contract: EdgexContract,
  markets: EdgexMarkets,
  fromMs: number,
  toMs: number,
): FundingEvent[] {
  const base = ref(contract, markets);
  const bySettlement = new Map<number, FundingEvent>();
  for (const row of rows) {
    const settledAt = num(row.fundingTime);
    const rate = num(row.fundingRate);
    const minutes = intervalMinutes(row, contract);
    if (row.isSettlement !== true || settledAt === null || rate === null || minutes === null) {
      continue;
    }
    if (settledAt < fromMs || settledAt > toMs) continue;
    bySettlement.set(settledAt, {
      ...base,
      settledAt,
      rate,
      basisHours: minutes / 60,
      markPrice: num(row.markPrice),
    });
  }
  return [...bySettlement.values()].sort((a, b) => a.settledAt - b.settledAt);
}

function unwrap<T>(body: EdgexResponse<T>, what: string): T {
  if (body?.code !== SUCCESS || body.data === undefined || body.data === null) {
    throw new Error(`${VENUE}: ${what} failed: ${body?.code ?? "no body"} ${body?.msg ?? ""}`);
  }
  return body.data;
}

export function createEdgexV2Adapter(): VenueAdapter {
  let markets: EdgexMarkets | null = null;
  let marketsAt = 0;
  /** An empty answer is cached as null, so it waits its turn instead of jumping the queue each cycle. */
  const tickers = new Map<string, { ticker: EdgexTicker | null; fetchedAt: number }>();

  async function loadMarkets(client: HttpClient, now: number): Promise<EdgexMarkets> {
    if (markets && now - marketsAt < META_TTL_MS) return markets;
    const meta = unwrap(
      await client.getJson<EdgexResponse<EdgexMetaData>>(`${EDGEX_V2_API}/meta/getMetaData`),
      "getMetaData",
    );
    const labels = unwrap(
      await client.getJson<EdgexResponse<EdgexContractLabel[]>>(`${EDGEX_V2_API}/contract-labels`),
      "contract-labels",
    );
    if (!Array.isArray(meta.contractList) || !Array.isArray(labels)) {
      throw new Error(`${VENUE}: unexpected metadata`);
    }
    markets = indexEdgexMarkets(meta, labels);
    marketsAt = now;
    return markets;
  }

  return {
    venueId: VENUE,
    minIntervalMs: 300,

    async fetchSnapshots(client: HttpClient, now: number): Promise<SnapshotBatch> {
      const current = await loadMarkets(client, now);
      const ids = [...current.contracts.values()].filter(edgexIsLive).map((c) => c.contractId);

      const rates: EdgexFundingRate[] = [];
      for (let i = 0; i < ids.length; i += FUNDING_BATCH) {
        const batch = ids.slice(i, i + FUNDING_BATCH).join(",");
        const body = await client.getJson<EdgexResponse<EdgexFundingRate[]>>(
          `${EDGEX_V2_API}/funding/getLatestFundingRate?contractId=${batch}`,
        );
        rates.push(...unwrap(body, "getLatestFundingRate"));
      }

      // Open interest and volume are auxiliary: a failed ticker keeps its last value, it never
      // costs the cycle its funding rates.
      for (const id of selectRefreshBatch(ids, tickers, now, TICKER_BUDGET, TICKER_REFRESH_MS)) {
        try {
          const body = await client.getJson<EdgexResponse<EdgexTicker[]>>(
            `${EDGEX_V2_API}/quote/getTicker?contractId=${id}`,
          );
          const ticker = unwrap(body, "getTicker").find((t) => t.contractId === id) ?? null;
          tickers.set(id, { ticker, fetchedAt: now });
        } catch {
          // Retried on a later cycle, oldest first.
        }
      }

      return parseEdgexSnapshots(current, rates, tickers, now);
    },

    async fetchFundingHistory(client, venueSymbol, fromMs, toMs) {
      const current = await loadMarkets(client, Date.now());
      const contract = [...current.contracts.values()].find((c) => c.contractName === venueSymbol);
      if (!contract) return [];

      const rows: EdgexFundingRate[] = [];
      let offset = "";
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const cursor = offset ? `&offsetData=${encodeURIComponent(offset)}` : "";
        const url = `${EDGEX_V2_API}/funding/getFundingRatePage?contractId=${contract.contractId}&size=${HISTORY_PAGE_SIZE}&filterSettlementFundingRate=true&filterBeginTimeInclusive=${fromMs}&filterEndTimeExclusive=${toMs + 1}${cursor}`;
        const data = unwrap(
          await client.getJson<EdgexResponse<EdgexFundingPage>>(url),
          "getFundingRatePage",
        );
        rows.push(...(data.dataList ?? []));
        offset = data.nextPageOffsetData ?? "";
        if (!offset || !data.dataList?.length) break;
      }
      return parseEdgexFundingHistory(rows, contract, current, fromMs, toMs);
    },
  };
}

export const edgexV2Adapter: VenueAdapter = createEdgexV2Adapter();
