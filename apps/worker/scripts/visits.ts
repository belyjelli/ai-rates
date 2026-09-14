/**
 * Page views by source, and where outside visits land, from the airrates dataset that
 * app/visits.ts writes.
 *
 *   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… bun apps/worker/scripts/visits.ts [days]
 *
 * The token needs Account Analytics Read. Analytics Engine keeps three months and samples at volume,
 * so every count is weighted by _sample_interval rather than counted row by row.
 */
const days = Math.min(Math.max(Math.round(Number(process.argv[2] ?? 7)) || 7, 1), 90);
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) {
  console.error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Account Analytics Read).");
  process.exit(1);
}

async function query(sql: string): Promise<Record<string, string | number>[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
    { method: "POST", headers: { authorization: `Bearer ${token}` }, body: sql },
  );
  if (!res.ok) throw new Error(`Analytics Engine ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { data: Record<string, string | number>[] }).data;
}

const window = `timestamp > NOW() - INTERVAL '${days}' DAY`;

console.log(`Page views, last ${days} days, by source`);
console.table(
  await query(`SELECT blob1 AS source, SUM(_sample_interval) AS views
    FROM airrates WHERE ${window}
    GROUP BY source ORDER BY views DESC LIMIT 20`),
);

// Arrivals only: "internal" is a reader moving between pages, not a visit a post brought in.
console.log("Where outside visits land");
console.table(
  await query(`SELECT blob1 AS source, blob2 AS page, SUM(_sample_interval) AS views
    FROM airrates WHERE ${window} AND blob1 != 'internal'
    GROUP BY source, page ORDER BY views DESC LIMIT 30`),
);
