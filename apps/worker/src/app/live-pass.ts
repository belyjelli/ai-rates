import postgres from "postgres";

/**
 * Members' live refresh of the /liquidations whale table. A signed-in member's page holds a live pass
 * from the member site (profitlock-member src/live-pass.ts) and asks for the whales tab every 10 s with
 * it in a header; this checks the pass, and index.ts serves those requests from a cache of their own
 * that keeps a copy 5 s instead of 30. Anyone without a pass gets the ordinary page and its 30 s.
 *
 * The pass is checked against collector table live_watch (migration 048), by its SHA-256 as the member
 * site stores it; the site's role reads only token_hash and expires_at. A pass found good is
 * remembered by this isolate until it expires, so a member's polls cost one lookup per pass, not one
 * per poll.
 */

/** The request header the page sends its pass in. */
export const LIVE_PASS_HEADER = "x-live-pass";
/** How long a member's copy of the table stays fresh. */
export const LIVE_MAX_AGE = 5;
/** randomToken(32) on the member site: 43 base64url characters. */
const PASS = /^[A-Za-z0-9_-]{43}$/;
/** Passes this isolate has found good, by hash, to when they expire. */
const good = new Map<string, number>();
const MAX_REMEMBERED = 1000;

/** Whether the request is one the live refresh serves: the whales tab on its own. */
export function isLiveRequest(request: Request): boolean {
  if (request.method !== "GET" || !request.headers.has(LIVE_PASS_HEADER)) return false;
  const url = new URL(request.url);
  return (
    (url.pathname === "/liquidations" || url.pathname.startsWith("/liquidations/")) &&
    url.searchParams.get("panel") === "whales"
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Whether the pass is current. `lookup` answers when a pass with this hash expires, in epoch ms, or
 * null for none current; it is the database in production and a stub in tests.
 */
export async function livePassValid(
  pass: string | null,
  lookup: (hashHex: string) => Promise<number | null>,
  now: () => number = Date.now,
): Promise<boolean> {
  if (pass === null || !PASS.test(pass)) return false;
  const hash = await sha256Hex(pass);
  const until = good.get(hash);
  if (until !== undefined) {
    if (until > now()) return true;
    good.delete(hash);
  }
  const expires = await lookup(hash);
  if (expires === null || expires <= now()) return false;
  if (good.size >= MAX_REMEMBERED) good.clear();
  good.set(hash, expires);
  return true;
}

/** The database half of `livePassValid`: one short connection, closed behind the response. */
export function databaseLookup(
  connectionString: string,
  waitUntil: (promise: Promise<unknown>) => void,
): (hashHex: string) => Promise<number | null> {
  return async (hashHex) => {
    const sql = postgres(connectionString, {
      max: 1,
      connect_timeout: 10,
      fetch_types: false,
      prepare: true,
    });
    try {
      // now() keeps Hyperdrive from answering from its query cache.
      const rows = await sql<{ until: number }[]>`
        SELECT (extract(epoch FROM expires_at) * 1000)::float8 AS until
        FROM live_watch
        WHERE token_hash = decode(${hashHex}, 'hex') AND expires_at > now()`;
      return rows[0]?.until ?? null;
    } finally {
      waitUntil(sql.end({ timeout: 5 }));
    }
  };
}

/** Forgets every pass; for tests. */
export function forgetLivePasses(): void {
  good.clear();
}
