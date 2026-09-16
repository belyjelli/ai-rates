import { describe, expect, test } from "bun:test";
import type { Venue } from "@ai-rates/venues";
import { type AdminDeps, handleAdmin } from "./admin";
import type { ReferralStore, StoredReferrals } from "./types";

const ORIGIN = "https://www.airrates.net";
const USER = "owner";
const PASSWORD = "correct horse battery";
const AUTH = { authorization: `Basic ${btoa(`${USER}:${PASSWORD}`)}` };

const venues = [
  { id: "hyperliquid", name: "Hyperliquid", type: "dex", verified: true, probes: [] },
  { id: "kucoin", name: "KuCoin", type: "cex", verified: true, probes: [] },
  { id: "bybit", name: "Bybit", type: "cex", verified: true, probes: [] },
  { id: "okx", name: "OKX", type: "cex", verified: true, probes: [] },
  { id: "hl-xyz", name: "trade[XYZ]", type: "hip3", hip3Dex: "xyz", verified: true, probes: [] },
] as unknown as Venue[];

function setup(options: { configured?: boolean; saved?: string; allowAttempt?: boolean } = {}) {
  let record: StoredReferrals | null = options.saved
    ? {
        json: options.saved,
        updatedAt: Date.parse("2026-09-15T10:00:00Z"),
        updatedBy: USER,
      }
    : null;
  const writes: string[] = [];
  const limited: string[] = [];
  let forgotten = 0;
  const store: ReferralStore = {
    read: async () => record,
    write: async (json, by) => {
      writes.push(json);
      record = { json, updatedAt: Date.parse("2026-09-15T12:00:00Z"), updatedBy: by };
      return record;
    },
  };
  const deps: AdminDeps = {
    store,
    credentials: options.configured === false ? null : { user: USER, password: PASSWORD },
    rateLimit: async (key) => {
      limited.push(key);
      return options.allowAttempt !== false;
    },
    clientKey: "203.0.113.7",
    onSaved: () => forgotten++,
    venues,
  };
  return { deps, writes, limited, forgotten: () => forgotten };
}

const request = (path: string, init: RequestInit = {}) =>
  new Request(`${ORIGIN}${path}`, { ...init, headers: { ...AUTH, ...init.headers } });

const post = (fields: Record<string, string>, origin: string | null = ORIGIN) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return request("/admin/referrals", { method: "POST", body, headers: origin ? { origin } : {} });
};

describe("handleAdmin", () => {
  test("anything outside /admin is not its business", async () => {
    expect(await handleAdmin(request("/referrals"), setup().deps)).toBeNull();
    expect(await handleAdmin(request("/administrator"), setup().deps)).toBeNull();
    expect((await handleAdmin(request("/admin/other"), setup().deps))?.status).toBe(404);
  });

  test("without credentials configured, nobody gets in", async () => {
    const res = await handleAdmin(request("/admin/referrals"), setup({ configured: false }).deps);
    expect(res?.status).toBe(503);
    expect(await res?.text()).toContain("ADMIN_USER");
  });

  test("a missing or wrong password asks for one", async () => {
    const plain = new Request(`${ORIGIN}/admin/referrals`);
    const asked = (await handleAdmin(plain, setup().deps)) as Response;
    expect(asked.status).toBe(401);
    expect(asked.headers.get("www-authenticate")).toContain("Basic");

    const wrong = new Request(`${ORIGIN}/admin/referrals`, {
      headers: { authorization: `Basic ${btoa(`${USER}:guess`)}` },
    });
    expect((await handleAdmin(wrong, setup().deps))?.status).toBe(401);
  });

  test("attempts are rate-limited by client, before the password is checked", async () => {
    const throttled = setup({ allowAttempt: false });
    const res = await handleAdmin(request("/admin/referrals"), throttled.deps);
    expect(res?.status).toBe(429);
    expect(throttled.limited).toEqual(["admin:203.0.113.7"]);
  });

  test("the form lists each exchange once, prefilled, and flags missing country rules", async () => {
    const { deps } = setup({
      saved: JSON.stringify({
        hyperliquid: { url: "https://app.hyperliquid.xyz/join/AIR", code: "AIR" },
      }),
    });
    const res = (await handleAdmin(request("/admin/referrals"), deps)) as Response;
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(html).toContain(`Signed in as ${USER}.`);
    expect(html).toContain('name="url:hyperliquid" value="https://app.hyperliquid.xyz/join/AIR"');
    expect(html).toContain('name="code:hyperliquid" value="AIR"');
    // A HIP-3 dex trades under Hyperliquid's terms but can carry its own link, so it gets a row.
    expect(html).toContain('name="url:hl-xyz"');
    // Every row offers the link to everyone until the owner narrows it.
    expect(html).toContain('<select name="audience:hyperliquid">');
    expect(html).toContain('<option value="public" selected>Everyone</option>');
    expect(html).toContain('<option value="vip">VIP members only</option>');
    // Bybit has no recorded country rules, so the owner is told it will stay hidden.
    expect(html).toMatch(/Bybit<small>bybit<\/small><\/td>[\s\S]*?not recorded/);
    expect(html.indexOf("url:bybit")).toBeLessThan(html.indexOf("url:hyperliquid"));
  });

  test("a post from another site is refused and saves nothing", async () => {
    const { deps, writes } = setup();
    const evil = await handleAdmin(
      post({ "url:okx": "https://www.okx.com/join/X" }, "https://evil.example"),
      deps,
    );
    expect(evil?.status).toBe(403);
    const noOrigin = await handleAdmin(
      post({ "url:okx": "https://www.okx.com/join/X" }, null),
      deps,
    );
    expect(noOrigin?.status).toBe(403);
    expect(writes).toEqual([]);
  });

  test("saving keeps what is valid, says what was not, and drops this instance's cached links", async () => {
    const saved = setup();
    const res = (await handleAdmin(
      post({
        "url:hyperliquid": " https://app.hyperliquid.xyz/join/AIR ",
        "code:hyperliquid": "AIR",
        "url:kucoin": "http://www.kucoin.com/r/X",
        "code:bybit": "ORPHAN",
        "url:okx": "https://www.okx.com/join/X",
        "code:okx": "has spaces",
      }),
      saved.deps,
    )) as Response;
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(JSON.parse(saved.writes[0] as string)).toEqual({
      hyperliquid: { url: "https://app.hyperliquid.xyz/join/AIR", code: "AIR", audience: "public" },
      okx: { url: "https://www.okx.com/join/X", audience: "public" },
    });
    expect(saved.forgotten()).toBe(1);
    expect(html).toContain("Saved 2 referral links.");
    expect(html).toContain("KuCoin: the link must be a full https:// address; not saved.");
    expect(html).toContain("Bybit: a code without a link was not saved.");
    expect(html).toContain(
      "OKX: the code may only use letters, digits, - and _; saved the link without it.",
    );
    expect(html).toContain(`by ${USER}`);
  });

  test("who a link is offered to is saved, and comes back selected", async () => {
    const saved = setup();
    const res = (await handleAdmin(
      post({
        "url:hyperliquid": "https://app.hyperliquid.xyz/join/AIR",
        "audience:hyperliquid": "member",
        "url:okx": "https://www.okx.com/join/X",
        // A tier this build does not know: the narrowest offer, never the widest.
        "audience:okx": "diamond",
      }),
      saved.deps,
    )) as Response;

    expect(JSON.parse(saved.writes[0] as string)).toEqual({
      hyperliquid: { url: "https://app.hyperliquid.xyz/join/AIR", audience: "member" },
      okx: { url: "https://www.okx.com/join/X", audience: "vip" },
    });
    const html = await res.text();
    expect(html).toContain(
      '<select name="audience:hyperliquid"><option value="public">Everyone</option><option value="member" selected>Members only</option>',
    );
  });

  test("other methods are refused", async () => {
    expect(
      (await handleAdmin(request("/admin/referrals", { method: "PUT" }), setup().deps))?.status,
    ).toBe(405);
  });
});
