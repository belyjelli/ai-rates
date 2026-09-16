import { describe, expect, test } from "bun:test";
import type { Geo, Referral } from "../app/geo";
import { AUDIENCES, audienceSees, isAudience, referralsFor } from "./policy";

const at = (country: string | null, region: string | null = null): Geo => ({ country, region });
const link = (venue: string, audience: Referral["audience"]): Referral => ({
  url: `https://${venue}.test/join/AIR`,
  code: null,
  audience,
});

describe("audienceSees", () => {
  test("a wider offer reaches a narrower viewer, never the other way", () => {
    expect(audienceSees("public", "public")).toBe(true);
    expect(audienceSees("public", "member")).toBe(false);
    expect(audienceSees("public", "vip")).toBe(false);

    expect(audienceSees("member", "public")).toBe(true);
    expect(audienceSees("member", "member")).toBe(true);
    expect(audienceSees("member", "vip")).toBe(false);

    for (const offered of AUDIENCES) expect(audienceSees("vip", offered)).toBe(true);
  });
});

describe("isAudience", () => {
  test("only the known names", () => {
    expect(isAudience("member")).toBe(true);
    expect(isAudience("platinum")).toBe(false);
    expect(isAudience(undefined)).toBe(false);
    expect(isAudience(2)).toBe(false);
  });
});

describe("referralsFor", () => {
  const links = {
    hyperliquid: link("hyperliquid", "public"),
    kucoin: link("kucoin", "member"),
    okx: link("okx", "vip"),
  };

  test("an anonymous reader sees only public offers", () => {
    expect(Object.keys(referralsFor(links, "public", at("TH")))).toEqual(["hyperliquid"]);
  });

  test("a member sees public and member offers, a VIP member sees all three", () => {
    expect(Object.keys(referralsFor(links, "member", at("TH")))).toEqual(["hyperliquid", "kucoin"]);
    expect(Object.keys(referralsFor(links, "vip", at("TH")))).toEqual([
      "hyperliquid",
      "kucoin",
      "okx",
    ]);
  });

  test("the country rules still apply, whatever the audience", () => {
    // Everything is barred in the UK, and KuCoin's own terms bar Singapore.
    expect(referralsFor(links, "vip", at("GB"))).toEqual({});
    expect(referralsFor(links, "vip", at(null))).toEqual({});
    expect(Object.keys(referralsFor(links, "vip", at("SG")))).toEqual(["hyperliquid", "okx"]);
  });
});
