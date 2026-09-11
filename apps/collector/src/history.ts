import type { HttpClient, VenueAdapter } from "@ai-rates/adapters";
import type { FundingEvent } from "@ai-rates/core";
import { describeError } from "./scheduler";

const HOUR_MS = 3_600_000;

export interface HistoryStore {
  /** Markets seen by the snapshot loop since `seenSince`. */
  activeMarkets(
    venueId: string,
    seenSince: number,
  ): Promise<{ venueSymbol: string; intervalHours: number | null }[]>;
  /** Latest stored settlement per market (recent window only). */
  latestSettledByMarket(venueId: string): Promise<Map<string, number>>;
  recordHistory(venueId: string, events: readonly FundingEvent[]): Promise<void>;
}

export interface HistorySweepOptions {
  now?: () => number;
  /** How far back to fetch for a market with no stored settlements. */
  initialLookbackMs?: number;
  /** Wait this long past an expected settlement before asking for it. */
  settleGraceMs?: number;
  /** Checked before each market so a long sweep can end early on shutdown. */
  shouldStop?: () => boolean;
  log?: (message: string) => void;
}

export interface HistorySweepResult {
  markets: number;
  fetched: number;
  events: number;
  errors: number;
}

/**
 * Pulls settled funding for every active market that is due a new settlement. Requests go through the
 * venue's shared HttpClient, so its spacing and circuit breaker also cover the snapshot loop.
 */
export async function sweepVenueHistory(
  adapter: VenueAdapter,
  client: HttpClient,
  store: HistoryStore,
  options: HistorySweepOptions = {},
): Promise<HistorySweepResult> {
  const result: HistorySweepResult = { markets: 0, fetched: 0, events: 0, errors: 0 };
  if (!adapter.fetchFundingHistory) return result;

  const now = options.now ?? Date.now;
  const lookbackMs = options.initialLookbackMs ?? 7 * 24 * HOUR_MS;
  const graceMs = options.settleGraceMs ?? 5 * 60_000;
  const venueId = adapter.venueId;

  const markets = await store.activeMarkets(venueId, now() - 2 * HOUR_MS);
  const latest = await store.latestSettledByMarket(venueId);
  result.markets = markets.length;

  for (const market of markets) {
    if (options.shouldStop?.() || client.circuit().open) break;
    const last = latest.get(market.venueSymbol) ?? null;
    const intervalMs = (market.intervalHours ?? 1) * HOUR_MS;
    const at = now();
    if (last !== null && at - last < intervalMs + graceMs) continue;

    try {
      const from = last === null ? at - lookbackMs : last + 1;
      const events = await adapter.fetchFundingHistory(client, market.venueSymbol, from, at);
      result.fetched++;
      if (events.length > 0) {
        await store.recordHistory(venueId, events);
        result.events += events.length;
      }
    } catch (error) {
      result.errors++;
      options.log?.(`${venueId} ${market.venueSymbol}: history failed: ${describeError(error)}`);
    }
  }
  return result;
}

/** Repeats history sweeps for one venue, pausing between them. */
export class HistoryLoop {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private current: Promise<void> | null = null;

  constructor(
    private readonly adapter: VenueAdapter,
    private readonly client: HttpClient,
    private readonly store: HistoryStore,
    private readonly pauseMs: number,
    private readonly options: HistorySweepOptions & {
      onSweep?: (r: HistorySweepResult) => void;
    } = {},
  ) {}

  start(initialDelayMs = 0): void {
    if (!this.adapter.fetchFundingHistory) return;
    this.stopped = false;
    this.timer = setTimeout(() => this.tick(), initialDelayMs);
  }

  /** Stops scheduling and resolves once the in-flight sweep has finished its current market. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.current;
  }

  private tick(): void {
    this.current = this.sweep().finally(() => {
      this.current = null;
    });
  }

  private async sweep(): Promise<void> {
    if (this.stopped) return;
    try {
      const result = await sweepVenueHistory(this.adapter, this.client, this.store, {
        ...this.options,
        shouldStop: () => this.stopped,
      });
      this.options.onSweep?.(result);
    } catch (error) {
      this.options.log?.(`${this.adapter.venueId}: history sweep failed: ${describeError(error)}`);
    }
    if (!this.stopped) this.timer = setTimeout(() => this.tick(), this.pauseMs);
  }
}
