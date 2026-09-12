import {
  createAdapters,
  createHttpClient,
  type HttpClient,
  type VenueAdapter,
} from "@ai-rates/adapters";
import { migrate } from "@ai-rates/db";
import { VENUES } from "@ai-rates/venues";
import { SQL } from "bun";
import { StaleVenueAlerter, webhookSink } from "./alerts";
import { loadConfig } from "./config";
import { CollectorStatus } from "./health";
import { backfillVenueHistory, HistoryLoop } from "./history";
import { PeriodicTask } from "./periodic";
import { VenueLoop } from "./scheduler";
import { PgStore } from "./store";
import { refreshVenueLeverageTiers } from "./tiers";

const HISTORY_PAUSE_MS = 5 * 60_000;
const STATS_REFRESH_MS = 10 * 60_000;
const ALERT_CHECK_MS = 60_000;
const BACKFILL_PAUSE_MS = 5 * 60_000;
const BACKFILL_BUDGET = 20;
const TIERS_REFRESH_MS = 24 * 60 * 60_000;
const LONG_WINDOWS_REFRESH_MS = 60 * 60_000;
const SHUTDOWN_GRACE_MS = 15_000;

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

const config = loadConfig(process.env);
const sql = new SQL({ url: config.databaseUrl, max: 10 });
// Aster, Paradex and Lighter publish no leverage at all, so the catalog carries a conservative
// hand-curated figure for them. It is a fallback only: anything a venue reports itself wins.
const curatedMaxLeverage = new Map(
  VENUES.flatMap((venue) => (venue.maxLeverage ? [[venue.id, venue.maxLeverage] as const] : [])),
);
const store = new PgStore(sql, curatedMaxLeverage);

const migration = await migrate(sql);
log(`migrations applied: ${migration.applied.join(", ") || "none"}`);
await store.upsertVenues(VENUES.map(({ id, name, type }) => ({ id, name, type })));

const adapters = createAdapters(VENUES).filter(
  (adapter) => config.venues === null || config.venues.includes(adapter.venueId),
);
if (adapters.length === 0) throw new Error("no adapters match COLLECT_VENUES");

// Markets seen this recently seed adapter caches, so a restart doesn't hide them for many cycles.
const WARM_UP_MAX_AGE_MS = 24 * 60 * 60_000;
for (const adapter of adapters) {
  if (!adapter.warmUp) continue;
  const known = await store.activeMarkets(adapter.venueId, Date.now() - WARM_UP_MAX_AGE_MS);
  adapter.warmUp(known);
  log(`${adapter.venueId}: warmed ${known.length} known markets`);
}

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

  // Deepening history competes with live collection for the same rate limit, so it goes slowly:
  // a few markets every few minutes, converging on the target over hours.
  const exhausted = new Set<string>();
  const backfill = new PeriodicTask(
    `${adapter.venueId} history backfill`,
    BACKFILL_PAUSE_MS,
    async () => {
      const result = await backfillVenueHistory(adapter, client, store, {
        budget: BACKFILL_BUDGET,
        exhausted,
        log,
      });
      if (result.fetched > 0 || result.errors > 0) {
        log(
          `${adapter.venueId}: backfill ${result.events} events, ${result.pending} markets short, ${result.exhausted} exhausted, ${result.errors} errors`,
        );
      }
    },
    log,
  );
  backfill.start(BACKFILL_PAUSE_MS + offsetMs);

  loops.push(snapshots, history, backfill);

  // Risk-limit ladders move only when a venue relists or rebalances risk, so this is daily and
  // whole-venue rather than a budgeted per-symbol rotation. Venues without the hook add no loop.
  if (adapter.fetchLeverageTiers) {
    const tiers = new PeriodicTask(
      `${adapter.venueId} leverage tiers`,
      TIERS_REFRESH_MS,
      async () => {
        const sweep = await refreshVenueLeverageTiers(adapter, client, store);
        if (sweep.tiers > 0 || !sweep.complete) {
          log(
            `${adapter.venueId}: ${sweep.tiers} leverage tiers across ${sweep.markets} markets` +
              (sweep.complete ? "" : " (partial sweep, nothing pruned)"),
          );
        }
      },
      log,
    );
    // Once the snapshot loop has markets, and offset so venues never sweep on the same second.
    tiers.start(4 * config.intervalMs + offsetMs);
    loops.push(tiers);
  }
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

// 30d and 60d windows for the heatmap. Hourly is ample for month-long averages, and they are summed
// from the daily rollup rather than rescanning ~3.5M settlements, so the cost is a day or two of
// events per run. Offset from the 10-minute stats task so the two never contend.
const longWindows = new PeriodicTask(
  "long funding windows",
  LONG_WINDOWS_REFRESH_MS,
  async () => {
    // One fold feeds both: the 30d/60d windows and the stability/momentum scores all read the
    // same daily rollup, so they share a pass rather than scanning it twice.
    const days = await store.refreshDailyFunding();
    const markets = await store.refreshLongWindows();
    const scored = await store.refreshStability();
    log(
      `long funding windows: ${days} day-rows folded, ${markets} markets updated, ${scored} scored`,
    );
  },
  log,
);
longWindows.start(5 * config.intervalMs);
loops.push(longWindows);

// Venues stop collecting quietly: the site keeps serving the last good rows until they age out.
if (config.alertWebhookUrl) {
  const alerter = new StaleVenueAlerter(webhookSink(config.alertWebhookUrl), log);
  const alerts = new PeriodicTask(
    "stale venue alerts",
    ALERT_CHECK_MS,
    () => alerter.check(status.snapshot(Date.now())),
    log,
  );
  alerts.start(ALERT_CHECK_MS);
  loops.push(alerts);
  log("stale venue alerts enabled");
} else {
  log("stale venue alerts disabled (set ALERT_WEBHOOK_URL)");
}

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
