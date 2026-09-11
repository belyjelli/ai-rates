/**
 * Phase 0 spike: estimates VenueHistoryDO SQLite size per venue.
 * Durable Object storage is SQLite, so on-disk page usage here is a close proxy.
 *
 *   bun scripts/estimate-history-size.ts [markets=35]
 *
 * It writes full time spans for a sample of markets and extrapolates linearly by market count.
 */
import { Database } from "bun:sqlite";

const SAMPLE_MARKETS = Number(process.argv[2] ?? 35);
const HOUR_MS = 3_600_000;
const START = Date.UTC(2026, 0, 1);
const DO_LIMIT_BYTES = 10 * 1024 ** 3;

interface TableSpec {
  name: string;
  ddl: string;
  insert: string;
  rowsPerMarket: number;
  row: (asset: string, i: number) => (string | number)[];
}

// Schemas as planned for VenueHistoryDO (plans/development-plan.md, "Settled history").
const TABLES: TableSpec[] = [
  {
    name: "funding_events (1y, hourly settlement)",
    ddl: `CREATE TABLE funding_events (
      asset TEXT NOT NULL, settled_at INTEGER NOT NULL, rate REAL NOT NULL,
      interval_h REAL NOT NULL, mark_px REAL, PRIMARY KEY (asset, settled_at)
    ) WITHOUT ROWID`,
    insert: "INSERT INTO funding_events VALUES (?, ?, ?, ?, ?)",
    rowsPerMarket: 24 * 365,
    row: (asset, i) => [asset, START + i * HOUR_MS, jitter(0.0001, i), 1, 100 + (i % 500) * 0.37],
  },
  {
    name: "snap_5m (30d retention)",
    ddl: `CREATE TABLE snap_5m (
      asset TEXT NOT NULL, ts INTEGER NOT NULL, predicted_rate REAL, mark_px REAL,
      oi_usd REAL, vol24h_usd REAL, PRIMARY KEY (asset, ts)
    ) WITHOUT ROWID`,
    insert: "INSERT INTO snap_5m VALUES (?, ?, ?, ?, ?, ?)",
    rowsPerMarket: 12 * 24 * 30,
    row: (asset, i) => [
      asset,
      START + i * 300_000,
      jitter(0.0001, i),
      100 + (i % 700) * 0.21,
      5e7 + (i % 977) * 1e4,
      2e8 + (i % 1013) * 3e4,
    ],
  },
  {
    name: "rollup_1h (1y)",
    ddl: `CREATE TABLE rollup_1h (
      asset TEXT NOT NULL, hour INTEGER NOT NULL, avg_rate REAL, min_rate REAL, max_rate REAL,
      mark_close REAL, oi_usd REAL, vol_usd REAL, PRIMARY KEY (asset, hour)
    ) WITHOUT ROWID`,
    insert: "INSERT INTO rollup_1h VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    rowsPerMarket: 24 * 365,
    row: (asset, i) => [
      asset,
      START + i * HOUR_MS,
      jitter(0.0001, i),
      jitter(0.00005, i + 1),
      jitter(0.00015, i + 2),
      100 + (i % 500) * 0.37,
      5e7 + (i % 977) * 1e4,
      8e6 + (i % 331) * 2e3,
    ],
  },
];

function jitter(base: number, i: number): number {
  return base * (1 + Math.sin(i * 12.9898) * 0.75);
}

function tableBytes(db: Database, table: string): number {
  // dbstat isn't compiled into every SQLite build, so measure by isolating each table in its own DB.
  const { page_count, page_size } = db
    .query<{ page_count: number; page_size: number }, []>(
      "SELECT (SELECT page_count FROM pragma_page_count()) AS page_count, (SELECT page_size FROM pragma_page_size()) AS page_size",
    )
    .get() as { page_count: number; page_size: number };
  void table;
  return page_count * page_size;
}

const assets = Array.from(
  { length: SAMPLE_MARKETS },
  (_, i) => `ASSET${i.toString().padStart(4, "0")}`,
);
const perMarketBytes: Record<string, number> = {};

for (const spec of TABLES) {
  const db = new Database(":memory:");
  db.run(spec.ddl);
  const insert = db.prepare(spec.insert);
  const empty = tableBytes(db, spec.name);
  db.transaction(() => {
    for (const asset of assets) {
      for (let i = 0; i < spec.rowsPerMarket; i++) insert.run(...spec.row(asset, i));
    }
  })();
  db.run("VACUUM");
  const bytes = tableBytes(db, spec.name) - empty;
  perMarketBytes[spec.name] = bytes / SAMPLE_MARKETS;
  const rows = spec.rowsPerMarket * SAMPLE_MARKETS;
  console.log(
    `${spec.name}: ${(bytes / rows).toFixed(1)} B/row, ${(bytes / SAMPLE_MARKETS / 1024 ** 2).toFixed(2)} MiB/market`,
  );
  db.close();
}

const perMarket = Object.values(perMarketBytes).reduce((a, b) => a + b, 0);
console.log(`\nTotal steady state: ${(perMarket / 1024 ** 2).toFixed(2)} MiB per market`);
for (const markets of [100, 350, 600, 1000]) {
  const gib = (perMarket * markets) / 1024 ** 3;
  console.log(
    `  ${markets} markets: ${gib.toFixed(2)} GiB (${((gib * 1024 ** 3 * 100) / DO_LIMIT_BYTES).toFixed(0)}% of the 10 GiB DO limit)`,
  );
}
console.log(
  `\nMarkets per venue before hitting 10 GiB with 1y funding + 1y hourly rollups: ${Math.floor(DO_LIMIT_BYTES / perMarket)}`,
);
