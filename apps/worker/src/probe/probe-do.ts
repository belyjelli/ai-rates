import { DurableObject } from "cloudflare:workers";
import type { Verdict } from "./classify";
import { executeProbe, type StoredRun } from "./execute";

/** Runs kept per runner; hourly cron means two days of history. */
const KEEP_RUNS = 48;

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

/**
 * One instance per probe runner. Hinted instances run the probe from their own location via an
 * alarm; the un-hinted "cron" instance only stores results produced inline by the scheduled handler.
 */
export class ProbeDO extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      runner TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER NOT NULL,
      colo TEXT,
      egress_ip TEXT,
      loc TEXT
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS results (
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
    this.sql.exec("CREATE INDEX IF NOT EXISTS results_run ON results (run_id)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
  }

  /** Queues a probe run in this object's location. No-op if one is already pending. */
  async schedule(runner: string): Promise<void> {
    this.setKv("runner", runner);
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now());
    }
  }

  override async alarm(): Promise<void> {
    const runner = this.getKv("runner");
    if (runner) this.recordRun(await executeProbe(runner));
  }

  recordRun(run: StoredRun): void {
    const { id } = this.sql
      .exec<{ id: number }>(
        "INSERT INTO runs (runner, started_at, finished_at, colo, egress_ip, loc) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        run.runner,
        run.startedAt,
        run.finishedAt,
        run.trace.colo,
        run.trace.ip,
        run.trace.loc,
      )
      .one();
    for (const r of run.results) {
      this.sql.exec(
        "INSERT INTO results (run_id, venue_id, label, url, verdict, status, latency_ms, bytes, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
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
    this.sql.exec("DELETE FROM results WHERE run_id <= ?", id - KEEP_RUNS);
    this.sql.exec("DELETE FROM runs WHERE id <= ?", id - KEEP_RUNS);
  }

  latest(): StoredRun | null {
    const run = this.sql
      .exec<RunRow>(
        "SELECT id, runner, started_at, finished_at, colo, egress_ip, loc FROM runs ORDER BY id DESC LIMIT 1",
      )
      .toArray()[0];
    if (!run) return null;

    const results = this.sql
      .exec<ResultRow>(
        "SELECT venue_id, label, url, verdict, status, latency_ms, bytes, detail FROM results WHERE run_id = ?",
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

  private getKv(key: string): string | null {
    return (
      this.sql.exec<{ v: string }>("SELECT v FROM kv WHERE k = ?", key).toArray()[0]?.v ?? null
    );
  }

  private setKv(key: string, value: string): void {
    this.sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)", key, value);
  }
}
