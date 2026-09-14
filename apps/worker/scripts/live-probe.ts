/**
 * Probes every catalog endpoint once from this machine, using the same runner as the Worker.
 * Useful as a smoke test for schema/host drift before deploying catalog changes.
 *
 *   bun run probe:local
 */
import { VENUES } from "@ai-rates/venues";
import { planJobs, runJobs } from "../src/probe/runner";

// Retired venues are dead on purpose; probing them could only fail the nightly run for nothing.
const venues = VENUES.filter((venue) => !venue.retired);
const jobs = planJobs(venues.map((venue) => ({ venueId: venue.id, endpoints: venue.probes })));
const started = Date.now();
const results = await runJobs(jobs, { fetch: (input, init) => fetch(input, init) });

const counts: Record<string, number> = {};
for (const result of results) counts[result.verdict] = (counts[result.verdict] ?? 0) + 1;
console.log(`${venues.length} venues, ${jobs.length} jobs in ${Date.now() - started}ms`, counts);

for (const r of results.filter((r) => r.verdict !== "ok")) {
  console.log(
    `  ${r.venueId} ${r.label} ${r.verdict} ${r.status ?? ""} ${(r.detail ?? "").slice(0, 80)}`,
  );
}

const largest = [...results].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).slice(0, 5);
console.log(
  "largest:",
  largest.map((r) => `${r.venueId}/${r.label} ${Math.round((r.bytes ?? 0) / 1024)}KB`).join(", "),
);

process.exitCode = results.some((r) => !["ok", "unconfigured"].includes(r.verdict)) ? 1 : 0;
