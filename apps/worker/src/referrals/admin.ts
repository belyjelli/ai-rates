import { VENUES, type Venue } from "@ai-rates/venues";
import { hasCtaRules, parseReferralLinks, REFERRAL_CODE } from "../app/geo";
import { esc } from "../web/format";
import { type AdminCredentials, askForCredentials, authorized } from "./auth";
import { AUDIENCE_LABEL, AUDIENCES, type Audience, DEFAULT_AUDIENCE, isAudience } from "./policy";
import type { ReferralStore, StoredReferrals } from "./types";

export interface AdminDeps {
  store: ReferralStore;
  /** Null when ADMIN_USER or ADMIN_PASSWORD is unset or too weak: /admin then refuses everyone. */
  credentials: AdminCredentials | null;
  /** Throttles login attempts; resolves false when this client has made too many. */
  rateLimit?: (key: string) => Promise<boolean>;
  /** Identifies the client for that throttle, usually its IP address. */
  clientKey?: string;
  /** Called after a save, so this instance's cached links are dropped. */
  onSaved?: () => void;
  venues?: readonly Venue[];
}

const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "x-frame-options": "DENY",
  "referrer-policy": "same-origin",
};

const text = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: { ...HEADERS, "content-type": "text/plain; charset=utf-8" },
  });

/**
 * /admin/referrals: the form the site owner fills in with each exchange's referral link and code.
 *
 * A username and password on the Worker (see auth.ts), which is all a one-person admin page needs
 * over HTTPS. Three things keep it honest:
 *   1. no credentials configured means nobody gets in, rather than everybody;
 *   2. attempts are rate-limited by the caller, so the password cannot be guessed at speed;
 *   3. a POST must carry this site's Origin, so another site cannot submit the form through the
 *      owner's browser while it holds the login.
 *
 * Standalone HTML, not the site layout: the layout's live refresh reloads pages when a new build
 * ships, which would throw away a half-typed form.
 */
export async function handleAdmin(request: Request, deps: AdminDeps): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) return null;
  if (url.pathname.replace(/\/+$/, "") !== "/admin/referrals") return text("Not found", 404);

  if (!deps.credentials) {
    return text(
      "The admin area is not configured. Set ADMIN_USER and ADMIN_PASSWORD on the Worker; the password must be at least 12 characters.",
      503,
    );
  }
  if (deps.rateLimit && !(await deps.rateLimit(`admin:${deps.clientKey ?? "anonymous"}`))) {
    return text("Too many attempts. Wait a minute and try again.", 429);
  }
  if (!(await authorized(request, deps.credentials))) return askForCredentials();

  // Every venue that can be collected: CEXs, DEXs and HIP-3 dexes alike. A HIP-3 dex trades under
  // Hyperliquid's terms but can carry its own link, so it gets its own row.
  const venues = (deps.venues ?? VENUES)
    .filter((venue) => !venue.aliasOf && !venue.retired)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  if (request.method === "GET" || request.method === "HEAD") {
    return page(form({ venues, record: await deps.store.read(), user: deps.credentials.user }));
  }

  if (request.method === "POST") {
    if (request.headers.get("origin") !== url.origin) {
      return text("Forbidden: the form must be submitted from this site", 403);
    }
    const { entries, problems } = readForm(await request.formData(), venues);
    const record = await deps.store.write(JSON.stringify(entries), deps.credentials.user);
    deps.onSaved?.();
    return page(form({ venues, record, user: deps.credentials.user, saved: true, problems }));
  }

  return text("Method not allowed", 405);
}

/** The saved entries from the form, and a plain-English line for every field it could not accept. */
export function readForm(
  data: FormData,
  venues: readonly Venue[],
): {
  entries: Record<string, { url: string; code?: string; audience: Audience }>;
  problems: string[];
} {
  const entries: Record<string, { url: string; code?: string; audience: Audience }> = {};
  const problems: string[] = [];
  for (const venue of venues) {
    const link = String(data.get(`url:${venue.id}`) ?? "").trim();
    const code = String(data.get(`code:${venue.id}`) ?? "").trim();
    const chosen = data.get(`audience:${venue.id}`);
    // An unknown audience means a stale form or a hand-made post; the safe reading is the narrowest
    // offer we know, not the widest.
    const audience: Audience = isAudience(chosen)
      ? chosen
      : chosen === null
        ? DEFAULT_AUDIENCE
        : (AUDIENCES.at(-1) as Audience);
    if (!link) {
      if (code) problems.push(`${venue.name}: a code without a link was not saved.`);
      continue;
    }
    let https = false;
    try {
      https = new URL(link).protocol === "https:";
    } catch {
      // Not a URL.
    }
    if (!https) {
      problems.push(`${venue.name}: the link must be a full https:// address; not saved.`);
      continue;
    }
    if (code && !REFERRAL_CODE.test(code)) {
      problems.push(
        `${venue.name}: the code may only use letters, digits, - and _; saved the link without it.`,
      );
      entries[venue.id] = { url: link, audience };
      continue;
    }
    entries[venue.id] = code ? { url: link, code, audience } : { url: link, audience };
  }
  return { entries, problems };
}

function page(body: string): Response {
  return new Response(body, { status: 200, headers: HEADERS });
}

function form(data: {
  venues: readonly Venue[];
  record: StoredReferrals | null;
  user: string;
  saved?: boolean;
  problems?: readonly string[];
}): string {
  const { venues, record, user, saved = false, problems = [] } = data;
  const links = parseReferralLinks(record?.json);
  const rows = venues
    .map((venue) => {
      const link = links[venue.id];
      const rules = hasCtaRules(venue.id)
        ? '<span class="ok">recorded</span>'
        : '<span class="warn">not recorded: hidden on the site until added</span>';
      const audience = link?.audience ?? DEFAULT_AUDIENCE;
      const options = AUDIENCES.map(
        (value) =>
          `<option value="${value}"${value === audience ? " selected" : ""}>${esc(AUDIENCE_LABEL[value])}</option>`,
      ).join("");
      return `<tr>
<td>${esc(venue.name)}<small>${esc(venue.id)}</small></td>
<td><input type="url" name="url:${esc(venue.id)}" value="${esc(link?.url ?? "")}" placeholder="https://" autocomplete="off"></td>
<td><input type="text" name="code:${esc(venue.id)}" value="${esc(link?.code ?? "")}" maxlength="64" autocomplete="off"></td>
<td><select name="audience:${esc(venue.id)}">${options}</select></td>
<td>${rules}</td>
</tr>`;
    })
    .join("");
  const last = record
    ? `Last saved ${esc(new Date(record.updatedAt).toISOString().replace("T", " ").slice(0, 16))} UTC by ${esc(record.updatedBy)}.`
    : "Nothing saved yet.";
  const count = Object.keys(links).length;
  const banner = saved
    ? `<p class="saved">Saved ${count} referral ${count === 1 ? "link" : "links"}. The public page updates within a minute.</p>`
    : "";
  const issues =
    problems.length > 0
      ? `<ul class="problems">${problems.map((problem) => `<li>${esc(problem)}</li>`).join("")}</ul>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Referral links · admin · airrates</title>
<style>
body{margin:0;padding:16px;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;background:#0a0a0a;color:#d8d8d8}
h1{font-size:16px;margin:0 0 6px}p{margin:6px 0;max-width:100ch}a{color:#c8f5a8}
.saved{color:#c8f5a8}.problems{color:#e5e500}.ok{color:#7a7a7a}.warn{color:#e5e500}
.wrap{overflow-x:auto;margin-top:12px}table{border-collapse:collapse;min-width:720px}
th,td{border-bottom:1px solid #242424;padding:5px 8px;text-align:left;vertical-align:middle}
th{color:#7a7a7a;font-weight:400}small{display:block;color:#494949}
input{width:100%;box-sizing:border-box;background:#000;color:#d8d8d8;border:1px solid #333;padding:4px 6px;font:inherit}
td:nth-child(2){min-width:320px}td:nth-child(3){min-width:140px}td:nth-child(4){min-width:150px}
select{background:#000;color:#d8d8d8;border:1px solid #333;padding:4px 6px;font:inherit}
button{margin-top:12px;padding:6px 16px;font:inherit;background:#c8f5a8;color:#000;border:0;cursor:pointer}
</style>
</head>
<body>
<h1>Referral links</h1>
<p>Signed in as ${esc(user)}. ${last}</p>
${banner}${issues}
<p>Add the link, and the code if the exchange uses one, for each exchange you have a referral for. Leave a row empty to skip that exchange. The public <a href="/referrals">referral links page</a> shows a row only for exchanges with a link, and only to visitors whose country allows it.</p>
<p><b>Offered to</b> decides who sees a link. <i>Everyone</i> shows it on the public page. <i>Members only</i> and <i>VIP members only</i> keep it off the public site and reserve it for member.airrates.net, which will ask for the audience each signed-in person may see.</p>
<form method="post" action="/admin/referrals">
<div class="wrap"><table>
<thead><tr><th>Exchange</th><th>Referral link</th><th>Code (optional)</th><th>Offered to</th><th>Country rules</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>
<button type="submit">Save</button>
</form>
</body>
</html>`;
}
