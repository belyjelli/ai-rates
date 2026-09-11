import {
  createAdapters,
  createHttpClient,
  type HttpClient,
  type VenueAdapter,
} from "@ai-rates/adapters";
import { migrate } from "@ai-rates/db";
import { VENUES } from "@ai-rates/venues";
import { SQL } from "bun";
import { loadConfig } from "./config";
import { CollectorStatus } from "./health";
import { HistoryLoop } from "./history";
import { PeriodicTask } from "./periodic";
import { VenueLoop } from "./scheduler";
import { PgStore } from "./store";

const HISTORY_PAUSE_MS = 5 * 60_000;
const STATS_REFRESH_MS = 10 * 60_000;
const SHUTDOWN_GRACE_MS = 15_000;

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

const config = loadConfig(process.env);
const sql = new SQL({ url: config.databaseUrl, max: 10 });
const store = new PgStore(sql);

const migration = await migrate(sql);
log(`migrations applied: ${migration.applied.join(", ") || "none"}`);
await store.upsertVenues(VENUES.map(({ id, name, type }) => ({ id, name, type })));

const adapters = createAdapters(VENUES).filter(
  (adapter) => config.venues === null || config.venues.includes(adapter.venueId),
);
if (adapters.length === 0) throw new Error("no adapters match COLLECT_VENUES");

const status = new CollectorStatus(
  adapters.map((adapter) => adapter.venueId),
  config.intervalMs,
  Date.now(),
);
const loops: { stop(): Promise<void> }[] = [];

// One client per rate-limit group (usually one venue), shared by its snapshot and history loops.
// Run request counts are approximate for groups, since the counter is shared.
const groupOf = (adapter: VenueAdapter) => adapter.rateLimitGroup ?? adapter.venueId;
const groupSpacing = new Map<string, number>();
for (const adapter of adapters) {
  const group = groupOf(adapter);
  groupSpacing.set(group, Math.max(groupSpacing.get(group) ?? 0, adapter.minIntervalMs));
}
const clients = new Map<string, HttpClient>();
function clientFor(adapter: VenueAdapter): HttpClient {
  const group = groupOf(adapter);
  let client = clients.get(group);
  if (!client) {
    client = createHttpClient(group, { minIntervalMs: groupSpacing.get(group) ?? 0 });
    clients.set(group, client);
  }
  return client;
}

adapters.forEach((adapter, index) => {
  const client = clientFor(adapter);
  const offsetMs = Math.round((index / adapters.length) * config.intervalMs);

  const snapshots = new VenueLoop(adapter, client, store, {
    intervalMs: config.intervalMs,
    offsetMs,
    log,
    onRun: (run) => {
      status.record(run);
      if (run.error) log(`${run.venueId}: ${run.error}`);
    },
  });
  snapshots.start();

  const history = new HistoryLoop(adapter, client, store, HISTORY_PAUSE_MS, {
    log,
    onSweep: (r) => {
      if (r.fetched > 0 || r.errors > 0) {
        log(
          `${adapter.venueId}: history ${r.fetched}/${r.markets} markets, ${r.events} events, ${r.errors} errors`,
        );
      }
    },
  });
  // Start once the snapshot loop has populated the venue's markets.
  history.start(2 * config.intervalMs + offsetMs);

  loops.push(snapshots, history);
});

// Settled 24h/7d averages for the screener; the first run waits for history sweeps to start landing.
const stats = new PeriodicTask(
  "funding stats refresh",
  STATS_REFRESH_MS,
  async () => {
    const markets = await store.refreshFundingStats();
    log(`funding stats refreshed for ${markets} markets`);
  },
  log,
);
stats.start(3 * config.intervalMs);
loops.push(stats);

const server = Bun.serve({
  port: config.healthPort,
  routes: {
    "/health": () => {
      const snapshot = status.snapshot(Date.now());
      return Response.json(snapshot, { status: snapshot.ok ? 200 : 503 });
    },
    "/v1/latest": async (request) => {
      const base = new URL(request.url).searchParams.get("base")?.toUpperCase();
      if (!base) return Response.json({ error: "base is required" }, { status: 400 });
      return Response.json(await store.latestByBase(base));
    },
  },
  fetch: () => Response.json({ error: "not_found" }, { status: 404 }),
});

log(
  `collecting ${adapters.length} venues every ${config.intervalMs / 1000}s; health on :${server.port}`,
);

async function shutdown(signal: string): Promise<void> {
  log(`${signal}: shutting down`);
  // Let in-flight cycles finish writing before the pool closes.
  await Promise.race([Promise.all(loops.map((loop) => loop.stop())), Bun.sleep(SHUTDOWN_GRACE_MS)]);
  server.stop();
  await sql.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
