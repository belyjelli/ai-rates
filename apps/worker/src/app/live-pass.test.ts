import { beforeEach, describe, expect, test } from "bun:test";
import { forgetLivePasses, isLiveRequest, livePassValid, sha256Hex } from "./live-pass";

const PASS = "A".repeat(43);
const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);

describe("which requests the live refresh serves", () => {
  const req = (
    path: string,
    headers: Record<string, string> = { "x-live-pass": PASS },
    method = "GET",
  ) => new Request(`https://airrates.net${path}`, { headers, method });

  test("the whales tab on its own, with a pass", () => {
    expect(isLiveRequest(req("/liquidations?panel=whales"))).toBe(true);
    expect(isLiveRequest(req("/liquidations/ETH?whale=100k&panel=whales"))).toBe(true);
  });

  test("nothing else, and nothing without the header", () => {
    expect(isLiveRequest(req("/liquidations?panel=whales", {}))).toBe(false);
    expect(isLiveRequest(req("/liquidations?panel=sides"))).toBe(false);
    expect(isLiveRequest(req("/liquidations"))).toBe(false);
    expect(isLiveRequest(req("/whales?panel=whales"))).toBe(false);
    expect(isLiveRequest(req("/liquidationsX?panel=whales"))).toBe(false);
    expect(isLiveRequest(req("/liquidations?panel=whales", { "x-live-pass": PASS }, "POST"))).toBe(
      false,
    );
  });
});

describe("checking a pass", () => {
  beforeEach(forgetLivePasses);

  test("a current pass is good, looked up by its hash and remembered until it expires", async () => {
    const asked: string[] = [];
    const lookup = async (hash: string) => {
      asked.push(hash);
      return NOW + 120_000;
    };
    let now = NOW;
    expect(await livePassValid(PASS, lookup, () => now)).toBe(true);
    expect(asked).toEqual([await sha256Hex(PASS)]);
    now += 60_000;
    expect(await livePassValid(PASS, lookup, () => now)).toBe(true);
    expect(asked.length).toBe(1);
    // Past its expiry it is looked up again, and the database says no.
    now += 61_000;
    expect(
      await livePassValid(
        PASS,
        async () => null,
        () => now,
      ),
    ).toBe(false);
  });

  test("an unknown or malformed pass is refused, a malformed one without a lookup", async () => {
    let looked = 0;
    const none = async () => {
      looked++;
      return null;
    };
    expect(await livePassValid(PASS, none, () => NOW)).toBe(false);
    expect(looked).toBe(1);
    for (const bad of [null, "", "short", `${"A".repeat(42)}=`, `${PASS}A`]) {
      expect(await livePassValid(bad, none, () => NOW)).toBe(false);
    }
    expect(looked).toBe(1);
  });

  test("a lookup that fails throws, so the caller can tell it from a refusal", async () => {
    const down = async (): Promise<number | null> => {
      throw new Error("database down");
    };
    await expect(livePassValid(PASS, down, () => NOW)).rejects.toThrow("database down");
  });
});
