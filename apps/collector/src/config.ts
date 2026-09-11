export interface CollectorConfig {
  databaseUrl: string;
  intervalMs: number;
  healthPort: number;
  /** Venue ids to collect; null means every venue with an adapter. */
  venues: string[] | null;
  /** Slack- or Discord-style incoming webhook for stale-venue alerts; null disables them. */
  alertWebhookUrl: string | null;
}

export function loadConfig(env: Record<string, string | undefined>): CollectorConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const intervalMs = int(env.COLLECT_INTERVAL_MS, 60_000, "COLLECT_INTERVAL_MS");
  if (intervalMs < 10_000) throw new Error("COLLECT_INTERVAL_MS must be at least 10000");

  const venues = env.COLLECT_VENUES?.split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const alertWebhookUrl = env.ALERT_WEBHOOK_URL?.trim() || null;
  if (alertWebhookUrl && !/^https?:\/\//.test(alertWebhookUrl))
    throw new Error("ALERT_WEBHOOK_URL must be an http(s) URL");

  return {
    databaseUrl,
    intervalMs,
    healthPort: int(env.HEALTH_PORT, 8080, "HEALTH_PORT"),
    venues: venues && venues.length > 0 ? venues : null,
    alertWebhookUrl,
  };
}

function int(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}
