import { describe, expect, test } from "bun:test";
import type { Venue } from "@ai-rates/venues";
import type { AccessIdentity } from "../app/access";
import { type AdminDeps, handleAdmin } from "./admin";
import type { ReferralStore, StoredReferrals } from "./types";

const ORIGIN = "https://www.airrates.net";
const owner: AccessIdentity = { email: "owner@example.com", subject: "user-1" };

const venues = [
  { id: "hyperliquid", name: "Hyperliquid", type: "dex", verified: true, probes: [] },
  { id: "kucoin", name: "KuCoin", type: "cex", verified: true, probes: [] },
  { id: "bybit", name: "Bybit", type: "cex", verified: true, probes: [] },
  { id: "okx", name: "OKX", type: "cex", verified: true, probes: [] },
  { id: "hl-xyz", name: "trade[XYZ]", type: "hip3", hip3Dex: "xyz", verified: true, probes: [] },
] as unknown as Venue[];

function setup(
  options: { identity?: AccessIdentity | null; configured?: boolean; saved?: string } = {},
) {
  let record: StoredReferrals | null = options.saved
    ? {
        json: options.saved,
        updatedAt: Date.parse("2026-09-15T10:00:00Z"),
        updatedBy: "owner@example.com",
      }
    : null;
  const writes: string[] = [];
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
    access:
      options.configured === false
        ? null
        : { teamDomain: "https://t.cloudflareaccess.com", aud: "a" },
    verify: async (token) =>
      token === "valid" ? (options.identity === undefined ? owner : options.identity) : null,
    onSaved: () => forgotten++,
    venues,
  };
  return { deps, writes, forgotten: () => forgotten };
}

const request = (path: string, init: RequestInit & { token?: string | null } = {}) => {
  const headers = new Headers(init.headers);
  if (init.token !== null) headers.set("cf-access-jwt-assertion", init.token ?? "valid");
  return new Request(`${ORIGIN}${path}`, { ...init, headers });
};

const post = (fields: Record<string, string>, origin: string | null = ORIGIN) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return request("/admin/referrals", {
    method: "POST",
    body,
    headers: origin ? { origin } : {},
  });
};

describe("handleAdmin", () => {
  test("anything outside /admin is not its business", async () => {
    expect(await handleAdmin(request("/referrals"), setup().deps)).toBeNull();
    expect(await handleAdmin(request("/administrator"), setup().deps)).toBeNull();
    expect((await handleAdmin(request("/admin/other"), setup().deps))?.status).toBe(404);
  });

  test("an unconfigured Worker refuses everyone", async () => {
    const res = await handleAdmin(request("/admin/referrals"), setup({ configured: false }).deps);
    expect(res?.status).toBe(503);
  });

  test("no valid Access token, no page", async () => {
    expect(
      (await handleAdmin(request("/admin/referrals", { token: null }), setup().deps))?.status,
    ).toBe(403);
    expect(
      (await handleAdmin(request("/admin/referrals", { token: "forged" }), setup().deps))?.status,
    ).toBe(403);
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
    expect(html).toContain("Signed in as owner@example.com");
    expect(html).toContain('name="url:hyperliquid" value="https://app.hyperliquid.xyz/join/AIR"');
    expect(html).toContain('name="code:hyperliquid" value="AIR"');
    // HIP-3 dexes share Hyperliquid's programme, so they get no row of their own.
    expect(html).not.toContain("url:hl-xyz");
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
    const setupResult = setup();
    const res = (await handleAdmin(
      post({
        "url:hyperliquid": " https://app.hyperliquid.xyz/join/AIR ",
        "code:hyperliquid": "AIR",
        "url:kucoin": "http://www.kucoin.com/r/X",
        "code:bybit": "ORPHAN",
        "url:okx": "https://www.okx.com/join/X",
        "code:okx": "has spaces",
      }),
      setupResult.deps,
    )) as Response;
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(JSON.parse(setupResult.writes[0] as string)).toEqual({
      hyperliquid: { url: "https://app.hyperliquid.xyz/join/AIR", code: "AIR" },
      okx: { url: "https://www.okx.com/join/X" },
    });
    expect(setupResult.forgotten()).toBe(1);
    expect(html).toContain("Saved 2 referral links.");
    expect(html).toContain("KuCoin: the link must be a full https:// address; not saved.");
    expect(html).toContain("Bybit: a code without a link was not saved.");
    expect(html).toContain(
      "OKX: the code may only use letters, digits, - and _; saved the link without it.",
    );
    expect(html).toContain("by owner@example.com");
  });

  test("other methods are refused", async () => {
    expect(
      (await handleAdmin(request("/admin/referrals", { method: "PUT" }), setup().deps))?.status,
    ).toBe(405);
  });
});
