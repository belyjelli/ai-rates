import { DurableObject } from "cloudflare:workers";
import type { Verdict } from "./classify";
import { catalogJobs, type StoredRun, workerFetch } from "./execute";
import { fetchEgressTrace, runJobs } from "./runner";

/** Finished runs kept per runner; hourly cron means two days of history. */
const KEEP_RUNS = 48;

/**
 * Fetches per alarm invocation. The Free plan allows 50 subrequests and ~10ms CPU per invocation,
 * so a run is spread over several back-to-back alarms instead of one big one.
 */
const JOBS_PER_ALARM = 8;

/** An unfinished run older than this is abandoned so a new one can start. */
const STALE_RUN_MS = 30 * 60_000;

type RunRow = {
  id: number;
  runner: string;
  started_at: number;
  finished_at: number;
  colo: string | null;
  egress_ip: string | null;
  loc: string | null;
};

type ResultRow = {
  venue_id: string;
  label: string;
  url: string | null;
  verdict: string;
  status: number | null;
  latency_ms: number | null;
  bytes: number | null;
  detail: string | null;
};

/** One instance per probe runner; each probes the catalog from wherever it was placed. */
export class ProbeDO extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // v1 tables stored whole runs at once; runs are now written incrementally.
    this.sql.exec("DROP TABLE IF EXISTS runs");
    this.sql.exec("DROP TABLE IF EXISTS results");
    this.sql.exec(`CREATE TABLE IF NOT EXISTS probe_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      runner TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      cursor INTEGER NOT NULL DEFAULT 0,
      colo TEXT,
      egress_ip TEXT,
      loc TEXT
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS probe_results (
      run_id INTEGER NOT NULL,
      venue_id TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT,
      verdict TEXT NOT NULL,
      status INTEGER,
      latency_ms INTEGER,
      bytes INTEGER,
      detail TEXT
    )`);
    this.sql.exec("CREATE INDEX IF NOT EXISTS probe_results_run ON probe_results (run_id)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
  }

  /** Starts a run in this object's location. Returns false if a run is already in progress. */
  async schedule(runner: string): Promise<boolean> {
    const active = this.activeRun();
    if (active && Date.now() - active.started_at < STALE_RUN_MS) return false;
    if (active) this.deleteRun(active.id);

    this.sql.exec("INSERT INTO probe_runs (runner, started_at) VALUES (?, ?)", runner, Date.now());
    await this.ctx.storage.setAlarm(Date.now());
    return true;
  }

  override async alarm(): Promise<void> {
    const run = this.activeRun();
    if (!run) return;

    const jobs = catalogJobs();
    const chunk = jobs.slice(run.cursor, run.cursor + JOBS_PER_ALARM);
    const [trace, results] = await Promise.all([
      run.cursor === 0 ? fetchEgressTrace(workerFetch) : null,
      runJobs(chunk, { fetch: workerFetch }),
    ]);

    if (trace) {
      this.sql.exec(
        "UPDATE probe_runs SET colo = ?, egress_ip = ?, loc = ? WHERE id = ?",
        trace.colo,
        trace.ip,
        trace.loc,
        run.id,
      );
    }
    for (const r of results) {
      this.sql.exec(
        "INSERT INTO probe_results (run_id, venue_id, label, url, verdict, status, latency_ms, bytes, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        run.id,
        r.venueId,
        r.label,
        r.url,
        r.verdict,
        r.status,
        r.latencyMs,
        r.bytes,
        r.detail,
      );
    }

    const cursor = run.cursor + chunk.length;
    if (cursor < jobs.length) {
      this.sql.exec("UPDATE probe_runs SET cursor = ? WHERE id = ?", cursor, run.id);
      await this.ctx.storage.setAlarm(Date.now());
      return;
    }

    this.sql.exec(
      "UPDATE probe_runs SET cursor = ?, finished_at = ? WHERE id = ?",
      cursor,
      Date.now(),
      run.id,
    );
    this.sql.exec("DELETE FROM probe_results WHERE run_id <= ?", run.id - KEEP_RUNS);
    this.sql.exec("DELETE FROM probe_runs WHERE id <= ?", run.id - KEEP_RUNS);
  }

  latest(): StoredRun | null {
    const run = this.sql
      .exec<RunRow>(
        "SELECT id, runner, started_at, finished_at, colo, egress_ip, loc FROM probe_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1",
      )
      .toArray()[0];
    if (!run) return null;

    const results = this.sql
      .exec<ResultRow>(
        "SELECT venue_id, label, url, verdict, status, latency_ms, bytes, detail FROM probe_results WHERE run_id = ?",
        run.id,
      )
      .toArray()
      .map((row) => ({
        venueId: row.venue_id,
        label: row.label,
        url: row.url,
        verdict: row.verdict as Verdict,
        status: row.status,
        latencyMs: row.latency_ms,
        bytes: row.bytes,
        detail: row.detail,
      }));

    return {
      runner: run.runner,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      trace: { colo: run.colo, ip: run.egress_ip, loc: run.loc },
      results,
    };
  }

  /** Returns true (and starts the cooldown) if `key` hasn't been claimed in the last `ms`. */
  claimCooldown(key: string, ms: number): boolean {
    const now = Date.now();
    const last = Number(this.getKv(`cooldown:${key}`) ?? 0);
    if (now - last < ms) return false;
    this.setKv(`cooldown:${key}`, String(now));
    return true;
  }

  private activeRun(): { id: number; started_at: number; cursor: number } | undefined {
    return this.sql
      .exec<{ id: number; started_at: number; cursor: number }>(
        "SELECT id, started_at, cursor FROM probe_runs WHERE finished_at IS NULL ORDER BY id DESC LIMIT 1",
      )
      .toArray()[0];
  }

  private deleteRun(id: number): void {
    this.sql.exec("DELETE FROM probe_results WHERE run_id = ?", id);
    this.sql.exec("DELETE FROM probe_runs WHERE id = ?", id);
  }

  private getKv(key: string): string | null {
    return (
      this.sql.exec<{ v: string }>("SELECT v FROM kv WHERE k = ?", key).toArray()[0]?.v ?? null
    );
  }

  private setKv(key: string, value: string): void {
    this.sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)", key, value);
  }
}
