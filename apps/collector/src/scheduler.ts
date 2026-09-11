import type { HttpClient, SnapshotBatch, VenueAdapter } from "@ai-rates/adapters";

export interface CollectorRun {
  venueId: string;
  startedAt: number;
  durationMs: number;
  markets: number;
  requests: number;
  error: string | null;
}

export interface CollectorStore {
  recordBatch(venueId: string, batch: SnapshotBatch, observedAt: number): Promise<void>;
  recordRun(run: CollectorRun): Promise<void>;
}

export interface VenueLoopOptions {
  intervalMs: number;
  /** Offset within each interval so venues don't all fire on the same second. */
  offsetMs?: number;
  /** A cycle slower than this is recorded as failed; the loop moves on. */
  timeoutMs?: number;
  now?: () => number;
  onRun?: (run: CollectorRun) => void;
  log?: (message: string) => void;
}

/** Collects one venue on a fixed wall-clock cadence. Cycles never overlap and never throw. */
export class VenueLoop {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = true;
  private current: Promise<unknown> | null = null;

  constructor(
    private readonly adapter: VenueAdapter,
    private readonly client: HttpClient,
    private readonly store: CollectorStore,
    private readonly options: VenueLoopOptions,
  ) {}

  get venueId(): string {
    return this.adapter.venueId;
  }

  /** Runs one collection cycle. Returns null if the previous cycle is still running. */
  async runOnce(): Promise<CollectorRun | null> {
    if (this.running) return null;
    this.running = true;
    const now = this.options.now ?? Date.now;
    const venueId = this.adapter.venueId;
    const startedAt = now();
    const requestsBefore = this.client.requestCount();
    let markets = 0;
    let error: string | null = null;

    try {
      try {
        const batch = await withTimeout(
          this.adapter.fetchSnapshots(this.client, startedAt),
          this.options.timeoutMs ?? 45_000,
        );
        markets = batch.snapshots.length;
        await this.store.recordBatch(venueId, batch, startedAt);
      } catch (e) {
        error = describeError(e);
      }

      const run: CollectorRun = {
        venueId,
        startedAt,
        durationMs: now() - startedAt,
        markets,
        requests: this.client.requestCount() - requestsBefore,
        error,
      };
      try {
        await this.store.recordRun(run);
      } catch (e) {
        this.options.log?.(`${venueId}: failed to record run: ${describeError(e)}`);
      }
      this.options.onRun?.(run);
      return run;
    } finally {
      this.running = false;
    }
  }

  start(): void {
    this.stopped = false;
    this.scheduleNext();
  }

  /** Stops scheduling and resolves once any in-flight cycle has finished. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.current;
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    const now = (this.options.now ?? Date.now)();
    const delay = msUntilNextTick(now, this.options.intervalMs, this.options.offsetMs ?? 0);
    this.timer = setTimeout(() => {
      this.current = this.runOnce().finally(() => {
        this.current = null;
        this.scheduleNext();
      });
    }, delay);
  }
}

/** Milliseconds until the next `k * intervalMs + offsetMs` strictly after `now`. */
export function msUntilNextTick(now: number, intervalMs: number, offsetMs: number): number {
  const phase = (((now - offsetMs) % intervalMs) + intervalMs) % intervalMs;
  return intervalMs - phase;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function describeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}
