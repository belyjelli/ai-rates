import { beforeEach, describe, expect, test } from "bun:test";
import { forgetReferrals, loadReferrals, REFERRALS_TTL_MS } from "./load";
import type { ReferralStore, StoredReferrals } from "./types";

const T0 = Date.parse("2026-09-15T12:00:00Z");

function fakeStore(json: string | null) {
  const calls = { read: 0 };
  let record: StoredReferrals | null =
    json === null ? null : { json, updatedAt: T0, updatedBy: "owner" };
  let failing = false;
  const store: ReferralStore = {
    read: async () => {
      calls.read++;
      if (failing) throw new Error("durable object unavailable");
      return record;
    },
    write: async (next, by) => {
      record = { json: next, updatedAt: T0, updatedBy: by };
      return record;
    },
  };
  return { store, calls, fail: () => (failing = true) };
}

beforeEach(() => forgetReferrals());

describe("loadReferrals", () => {
  test("nothing saved means no links", async () => {
    expect(await loadReferrals(fakeStore(null).store, T0)).toEqual({});
  });

  test("reads once per minute per instance, and a save's forget is seen at once", async () => {
    const { store, calls } = fakeStore(
      JSON.stringify({ hyperliquid: "https://app.hyperliquid.xyz/join/A" }),
    );
    expect(await loadReferrals(store, T0)).toEqual({
      hyperliquid: { url: "https://app.hyperliquid.xyz/join/A", code: null, audience: "public" },
    });
    await loadReferrals(store, T0 + REFERRALS_TTL_MS - 1);
    expect(calls.read).toBe(1);
    await loadReferrals(store, T0 + REFERRALS_TTL_MS);
    expect(calls.read).toBe(2);

    await store.write(JSON.stringify({}), "owner");
    forgetReferrals();
    expect(await loadReferrals(store, T0 + REFERRALS_TTL_MS + 1)).toEqual({});
  });

  test("a failed read keeps the last links it had, and shows none if it never had any", async () => {
    const empty = fakeStore(JSON.stringify({ hyperliquid: "https://app.hyperliquid.xyz/join/A" }));
    empty.fail();
    const logged: string[] = [];
    expect(await loadReferrals(empty.store, T0, (m) => logged.push(m))).toEqual({});
    expect(logged[0]).toContain("durable object unavailable");

    forgetReferrals();
    const later = fakeStore(JSON.stringify({ hyperliquid: "https://app.hyperliquid.xyz/join/A" }));
    await loadReferrals(later.store, T0);
    later.fail();
    const kept = await loadReferrals(later.store, T0 + REFERRALS_TTL_MS);
    expect(Object.keys(kept)).toEqual(["hyperliquid"]);
  });
});
