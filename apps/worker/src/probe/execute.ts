import { VENUES } from "@ai-rates/venues";
import {
  type EgressTrace,
  type FetchLike,
  type ProbeJob,
  type ProbeResult,
  planJobs,
} from "./runner";

export interface StoredRun {
  runner: string;
  startedAt: number;
  finishedAt: number;
  trace: EgressTrace;
  results: ProbeResult[];
}

// Workers throw "Illegal invocation" if the global fetch is called detached from globalThis.
export const workerFetch: FetchLike = (input, init) => fetch(input, init);

/** Every probe job for the venue catalog, in a stable order so runs can resume by index. */
export function catalogJobs(): ProbeJob[] {
  return planJobs(VENUES.map((venue) => ({ venueId: venue.id, endpoints: venue.probes })));
}
