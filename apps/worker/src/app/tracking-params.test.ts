import { describe, expect, test } from "bun:test";
import { withoutTracking } from "./tracking-params";

describe("the page cache ignores campaign tags and click ids", () => {
  test("they come off and the rest of the query stays as it was sent", () => {
    const plain = (s: string) => withoutTracking(new URL(s))?.toString() ?? null;
    expect(plain("https://airrates.net/liquidations?utm_source=x&utm_medium=social")).toBe(
      "https://airrates.net/liquidations",
    );
    expect(plain("https://airrates.net/chart?asset=BTC/USDT&fbclid=IwAR0abc&window=4h")).toBe(
      "https://airrates.net/chart?asset=BTC/USDT&window=4h",
    );
    expect(plain("https://airrates.net/rates?UTM_Campaign=launch&gclid=1&_gl=2")).toBe(
      "https://airrates.net/rates",
    );
  });

  test("an address without them, and one with only ref, is left alone", () => {
    expect(withoutTracking(new URL("https://airrates.net/liquidations?window=24h"))).toBeNull();
    expect(withoutTracking(new URL("https://airrates.net/?ref=x"))).toBeNull();
    expect(withoutTracking(new URL("https://airrates.net/"))).toBeNull();
  });
});
