import { describe, expect, test } from "bun:test";
import { referralCta } from "../web/referral";
import {
  type Geo,
  geoCacheBucket,
  globallyBlocked,
  parseReferralLinks,
  type Referral,
  referralAllowed,
  requestGeo,
  type VenueCtaRules,
} from "./geo";

const at = (country: string | null, region: string | null = null): Geo => ({ country, region });

const withCf = (cf: unknown): Request => {
  const request = new Request("https://www.airrates.net/");
  Object.defineProperty(request, "cf", { value: cf });
  return request;
};

describe("requestGeo", () => {
  test("reads Cloudflare's country and region", () => {
    expect(requestGeo(withCf({ country: "SG", regionCode: "01" }))).toEqual(at("SG", "01"));
  });

  test("anything Cloudflare could not place is unknown", () => {
    expect(requestGeo(new Request("https://www.airrates.net/"))).toEqual(at(null));
    expect(requestGeo(withCf({ country: "XX" })).country).toBeNull();
    expect(requestGeo(withCf({ country: "T1" })).country).toBeNull(); // Tor
    expect(requestGeo(withCf({ country: "" })).country).toBeNull();
  });
});

describe("referralAllowed", () => {
  test("an unknown location shows nothing, for any venue", () => {
    expect(referralAllowed("hyperliquid", at(null))).toBe(false);
  });

  test("the global list blocks every venue, including by region", () => {
    for (const country of ["US", "CA", "GB", "IR", "KP", "CU", "SY", "RU", "BY"]) {
      expect(referralAllowed("hyperliquid", at(country))).toBe(false);
    }
    expect(referralAllowed("hyperliquid", at("UA", "43"))).toBe(false); // Crimea
    expect(referralAllowed("hyperliquid", at("UA", "30"))).toBe(true); // Kyiv
  });

  test("a venue whose restrictions are not written down shows nothing", () => {
    expect(referralAllowed("bybit", at("SG"))).toBe(false);
  });

  test("a venue's own list applies on top of the global one", () => {
    expect(referralAllowed("kucoin", at("MY"))).toBe(false);
    expect(referralAllowed("kucoin", at("TH"))).toBe(true);
    expect(referralAllowed("okx", at("IN"))).toBe(false);
  });

  test("venues trading under another's terms inherit its rules", () => {
    expect(referralAllowed("hl-xyz", at("SG"))).toBe(true);
    expect(referralAllowed("bullpen", at("SG"))).toBe(true);
    expect(referralAllowed("lighter-rh", at("TH"))).toBe(true);
    expect(referralAllowed("lighter-rh", at("GB"))).toBe(false);
  });

  test("EEA visitors see a CTA only for a MiCA-authorised venue", () => {
    expect(referralAllowed("hyperliquid", at("DE"))).toBe(false);
    const authorised: Record<string, VenueCtaRules> = {
      okx: { restricted: [], micaAuthorised: true },
    };
    expect(referralAllowed("okx", at("DE"), authorised)).toBe(true);
  });

  test("a region code matches only its own country", () => {
    const rules: Record<string, VenueCtaRules> = { demo: { restricted: ["AU-NSW"] } };
    expect(referralAllowed("demo", at("AU", "NSW"), rules)).toBe(false);
    expect(referralAllowed("demo", at("AU", "VIC"), rules)).toBe(true);
    expect(referralAllowed("demo", at("AU"), rules)).toBe(true);
  });
});

describe("parseReferralLinks", () => {
  test("keeps https links and drops everything else", () => {
    expect(
      parseReferralLinks(
        JSON.stringify({
          hyperliquid: "https://app.hyperliquid.xyz/join/AIRRATES",
          gate: "http://gate.com/ref/1",
          okx: 42,
          mexc: "not a url",
        }),
      ),
    ).toEqual({ hyperliquid: { url: "https://app.hyperliquid.xyz/join/AIRRATES", code: null } });
  });

  test("an entry may carry a code, and a malformed code is dropped while the link is kept", () => {
    expect(
      parseReferralLinks(
        JSON.stringify({
          hyperliquid: { url: "https://app.hyperliquid.xyz/join/AIRRATES", code: " AIRRATES " },
          kucoin: { url: "https://www.kucoin.com/r/af/AIR", code: "has spaces in it" },
          gate: { code: "NOURL" },
          okx: { url: "http://www.okx.com/join/1", code: "OK" },
          mexc: null,
        }),
      ),
    ).toEqual({
      hyperliquid: { url: "https://app.hyperliquid.xyz/join/AIRRATES", code: "AIRRATES" },
      kucoin: { url: "https://www.kucoin.com/r/af/AIR", code: null },
    });
  });

  test("absent or malformed configuration means no links, never an exception", () => {
    expect(parseReferralLinks(undefined)).toEqual({});
    expect(parseReferralLinks("{")).toEqual({});
    expect(parseReferralLinks('["https://x.test"]')).toEqual({});
    expect(parseReferralLinks("null")).toEqual({});
  });
});

describe("geoCacheBucket", () => {
  test("with no links configured every visitor shares the cache", () => {
    expect(geoCacheBucket(at("SG"), false)).toBe("any");
    expect(geoCacheBucket(at("US"), false)).toBe("any");
  });

  test("with links, visitors who can see no CTA share one bucket and the rest split by country", () => {
    expect(geoCacheBucket(at(null), true)).toBe("none");
    expect(geoCacheBucket(at("US"), true)).toBe("none");
    expect(geoCacheBucket(at("SG", "01"), true)).toBe("SG");
    expect(geoCacheBucket(at("UA", "30"), true)).toBe("UA-30");
  });
});

describe("globallyBlocked", () => {
  test("an unknown or globally blocked location, and nothing else", () => {
    expect(globallyBlocked(at(null))).toBe(true);
    expect(globallyBlocked(at("GB"))).toBe(true);
    expect(globallyBlocked(at("UA", "43"))).toBe(true);
    expect(globallyBlocked(at("UA", "30"))).toBe(false);
    // A venue's own exclusion is not global: kucoin bars MY, but MY is not blocked for everyone.
    expect(globallyBlocked(at("MY"))).toBe(false);
  });
});

describe("referralCta", () => {
  const venue = { id: "hyperliquid", name: "Hyperliquid" };
  const url = "https://app.hyperliquid.xyz/join/AIRRATES";
  const referral: Referral = { url, code: null };

  test("renders nothing without a link or where it is not allowed", () => {
    expect(referralCta(venue, undefined, at("SG"))).toBe("");
    expect(referralCta(venue, referral, at("GB"))).toBe("");
    expect(referralCta(venue, referral, at(null))).toBe("");
  });

  test("where allowed, it is marked sponsored and disclosed beside the link", () => {
    const html = referralCta(venue, referral, at("SG"));
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain('rel="sponsored noopener noreferrer"');
    expect(html).toContain("may earn a commission");
    expect(html).toContain('href="/legal#affiliate"');
    expect(html).not.toContain("<code>");
  });

  test("a code, when the venue has one, is shown beside the link", () => {
    expect(referralCta(venue, { url, code: "AIRRATES" }, at("SG"))).toContain(
      "Code <code>AIRRATES</code>.",
    );
  });
});
