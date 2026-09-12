import type { CollectorRun } from "./scheduler";

export interface VenueHealth {
  venueId: string;
  lastRunAt: number | null;
  lastSuccessAt: number | null;
  markets: number;
  error: string | null;
  stale: boolean;
}

/**
 * In-memory view of each venue's latest cycle. A venue is stale when it hasn't succeeded within
 * `staleAfterIntervals` intervals (counted from startup until its first success).
 */
export class CollectorStatus {
  private readonly last = new Map<string, CollectorRun>();
  private readonly lastSuccess = new Map<string, CollectorRun>();

  constructor(
    private readonly venueIds: readonly string[],
    private readonly intervalMs: number,
    private readonly startedAt: number,
    private readonly staleAfterIntervals = 3,
  ) {}

  record(run: CollectorRun): void {
    this.last.set(run.venueId, run);
    if (run.error === null) this.lastSuccess.set(run.venueId, run);
  }

  /**
   * `ok` stays true through the startup grace period on purpose: a venue that has never succeeded
   * is measured from `startedAt`, so a restart does not page anyone.
   *
   * But that window is indistinguishable from a collector that will NEVER collect — the state the
   * 2026-09-13 deploy showed, where every venue read `markets: 0, lastRunAt: null` and `/health`
   * still answered 200. `starting` says which of the two it is, so a monitor can treat "not yet"
   * differently from "healthy" without a restart being reported as an outage.
   */
  snapshot(now: number): { ok: boolean; starting: boolean; venues: VenueHealth[] } {
    const staleAfterMs = this.intervalMs * this.staleAfterIntervals;
    const venues = this.venueIds.map((venueId): VenueHealth => {
      const last = this.last.get(venueId) ?? null;
      const success = this.lastSuccess.get(venueId) ?? null;
      const reference = success?.startedAt ?? this.startedAt;
      return {
        venueId,
        lastRunAt: last?.startedAt ?? null,
        lastSuccessAt: success?.startedAt ?? null,
        markets: success?.markets ?? 0,
        error: last?.error ?? null,
        stale: now - reference > staleAfterMs,
      };
    });
    // Starting means no venue has ever reported a successful cycle. Once any has, the fleet is
    // past startup and a silent venue is a real problem rather than a slow boot.
    const starting = this.lastSuccess.size === 0;
    return { ok: venues.every((v) => !v.stale), starting, venues };
  }
}
