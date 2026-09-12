import { describe, expect, test } from "bun:test";
import { changes, LIVE_SCRIPT, parseShown } from "./live";

describe("parseShown", () => {
  test("reads every figure the formatters produce", () => {
    expect(parseShown("+12.3%")).toBe(12.3);
    expect(parseShown("−0.55%")).toBe(-0.55);
    expect(parseShown("0.00%")).toBe(0);
    expect(parseShown("$912M")).toBe(912e6);
    expect(parseShown("$25.0k")).toBe(25_000);
    expect(parseShown("−$640")).toBe(-640);
    expect(parseShown("77,766.7")).toBe(77_766.7);
    expect(parseShown("8h")).toBe(8);
    expect(parseShown("30m")).toBe(30);
    expect(parseShown("73%")).toBe(73);
    expect(parseShown("0.85")).toBe(0.85);
  });

  test("momentum arrows carry the sign", () => {
    expect(parseShown("↓ 3.2")).toBe(-3.2);
    expect(parseShown("↑ 1.0")).toBe(1);
    expect(parseShown("flat")).toBe(0);
  });

  test("anything that is not one figure is text", () => {
    expect(parseShown("–")).toBeNull();
    expect(parseShown("Binance BTCUSDT · 8h · OI $4.1B")).toBeNull();
    expect(parseShown("1000PEPE")).toBeNull();
    expect(parseShown("")).toBeNull();
  });
});

describe("changes", () => {
  const map = (entries: Record<string, string>) => new Map(Object.entries(entries));

  test("direction follows the displayed number", () => {
    expect(
      changes(
        map({ a: "+1.00%", b: "−1.00%", c: "$4.1B" }),
        map({ a: "+2.00%", b: "−2.00%", c: "$4.1B" }),
        parseShown,
      ),
    ).toEqual([
      ["a", "up"],
      ["b", "down"],
    ]);
  });

  test("text changes and figures that cannot be compared are neutral", () => {
    expect(changes(map({ a: "Gate", b: "–" }), map({ a: "OKX", b: "+3.00%" }), parseShown)).toEqual(
      [
        ["a", "text"],
        ["b", "text"],
      ],
    );
  });

  test("a new key is new, a vanished key is nothing", () => {
    expect(changes(map({ a: "1", gone: "2" }), map({ a: "1", b: "3" }), parseShown)).toEqual([
      ["b", "new"],
    ]);
  });

  test("an empty region never lights up wholesale", () => {
    expect(changes(new Map(), map({ a: "+1.00%" }), parseShown)).toEqual([]);
  });
});

describe("LIVE_SCRIPT", () => {
  test("is valid JavaScript once the helpers are embedded", () => {
    expect(() => new Function(LIVE_SCRIPT)).not.toThrow();
  });

  test("cannot close its own script tag", () => {
    expect(LIVE_SCRIPT.toLowerCase()).not.toContain("</script");
  });
});
