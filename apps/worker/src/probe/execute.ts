import { VENUES } from "@ai-rates/venues";
import {
  type EgressTrace,
  type FetchLike,
  fetchEgressTrace,
  type ProbeResult,
  runProbe,
} from "./runner";

export interface StoredRun {
  runner: string;
  startedAt: number;
  finishedAt: number;
  trace: EgressTrace;
  results: ProbeResult[];
}

// Workers throw "Illegal invocation" if the global fetch is called detached from globalThis.
const workerFetch: FetchLike = (input, init) => fetch(input, init);

/** Probes every catalog venue from wherever the current invocation is running. */
export async function executeProbe(runner: string): Promise<StoredRun> {
  const startedAt = Date.now();
  const targets = VENUES.map((venue) => ({ venueId: venue.id, endpoints: venue.probes }));
  const [trace, results] = await Promise.all([
    fetchEgressTrace(workerFetch),
    runProbe(targets, { fetch: workerFetch }),
  ]);
  return { runner, startedAt, finishedAt: Date.now(), trace, results };
}
