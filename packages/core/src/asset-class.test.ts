import { describe, expect, test } from "bun:test";
import { classifyNonCrypto, refineAssetClass } from "./asset-class";

describe("refineAssetClass", () => {
  test("a venue's crypto declaration is never overridden from the ticker", () => {
    // SPX is SPX6900 and STX is Stacks: correctly named crypto that collides with tradfi tickers.
    expect(refineAssetClass("crypto", "US500")).toBe("crypto");
    expect(refineAssetClass("crypto", "XAU")).toBe("crypto");
    expect(refineAssetClass("crypto", "STX")).toBe("crypto");
  });

  test("settles equity against index, which venues use interchangeably", () => {
    // OKX files US500 as a stock; gate files it as an index. Both must land in one pool.
    expect(refineAssetClass("equity", "US500")).toBe("index");
    expect(refineAssetClass("index", "US500")).toBe("index");
    // MEXC and WEEX call ETFs indices; five other venues call them stocks.
    expect(refineAssetClass("index", "SPY")).toBe("equity");
    expect(refineAssetClass("equity", "STX")).toBe("equity");
  });

  test("tokenised gold is crypto whatever the venue files it under", () => {
    expect(refineAssetClass("commodity", "PAXG")).toBe("crypto");
    expect(refineAssetClass("commodity", "XAUT")).toBe("crypto");
    expect(refineAssetClass("fx", "USDC")).toBe("crypto");
  });

  test("keeps commodity and fx as declared", () => {
    expect(refineAssetClass("commodity", "XAU")).toBe("commodity");
    expect(refineAssetClass("fx", "JPY")).toBe("fx");
  });
});

describe("classifyNonCrypto", () => {
  test("splits a bare not-crypto signal by the tables, defaulting to a single name", () => {
    expect(classifyNonCrypto("XAU")).toBe("commodity");
    expect(classifyNonCrypto("CL")).toBe("commodity");
    expect(classifyNonCrypto("EURUSD")).toBe("fx");
    expect(classifyNonCrypto("US100")).toBe("index");
    expect(classifyNonCrypto("MSTR")).toBe("equity");
    expect(classifyNonCrypto("PAXG")).toBe("crypto");
  });
});
