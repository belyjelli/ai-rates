import { describe, expect, test } from "bun:test";
import {
  aprTone,
  esc,
  formatApr,
  formatDuration,
  formatGapBps,
  formatInterval,
  formatPrice,
  formatUsd,
  since,
  until,
} from "./format";

describe("formatApr", () => {
  test("signs values and trims decimals as magnitude grows", () => {
    expect(formatApr(4.7712)).toBe("+4.77%");
    expect(formatApr(-10.95)).toBe("−10.9%");
    expect(formatApr(120.45)).toBe("+120%");
    expect(formatApr(0)).toBe("0.00%");
    expect(formatApr(-0.001)).toBe("0.00%");
    expect(formatApr(null)).toBe("–");
  });
});

describe("formatUsd", () => {
  test("compacts to k/M/B", () => {
    expect(formatUsd(4_142_076_932)).toBe("$4.1B");
    expect(formatUsd(912_400_000)).toBe("$912M");
    expect(formatUsd(25_000)).toBe("$25.0k");
    expect(formatUsd(640)).toBe("$640");
    expect(formatUsd(null)).toBe("–");
  });
});

describe("formatGapBps", () => {
  test("keeps one decimal at every magnitude, since the distribution sits at zero", () => {
    expect(formatGapBps(269.64)).toBe("269.6");
    // The median comparable asset. It must not render as a bare "0" that reads like no quote.
    expect(formatGapBps(0)).toBe("0.0");
    expect(formatGapBps(0.04)).toBe("0.0");
    expect(formatGapBps(null)).toBe("–");
    // Losing directions are shown, with the site's minus sign rather than a hyphen.
    expect(formatGapBps(-283.51)).toBe("−283.5");
    // A value that rounds to zero must not acquire a sign it cannot justify.
    expect(formatGapBps(-0.04)).toBe("0.0");
  });
});

describe("formatPrice", () => {
  test("adapts precision to size", () => {
    expect(formatPrice(77766.71)).toBe("77,766.7");
    expect(formatPrice(2.57331)).toBe("2.5733");
    expect(formatPrice(0.000123456)).toBe("0.0001235");
  });
});

describe("formatInterval and formatDuration", () => {
  test("format settlement intervals and countdowns", () => {
    expect(formatInterval(8)).toBe("8h");
    expect(formatInterval(0.5)).toBe("30m");
    expect(formatInterval(null)).toBe("–");
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(725)).toBe("12m");
    expect(formatDuration(3 * 3600 + 5 * 60)).toBe("3h 05m");
  });
});

describe("time elements", () => {
  test("render machine-readable timestamps for the page script", () => {
    const now = Date.parse("2026-09-12T10:00:00Z");
    expect(since(new Date(now - 12_000), now)).toContain('data-since="');
    expect(since(new Date(now - 12_000), now)).toContain(">12s ago<");
    expect(until(new Date(now + 90_000), now)).toContain(">1m<");
    expect(until(new Date(now - 1), now)).toContain(">settling<");
    expect(since(null, now)).toBe("–");
  });
});

describe("esc and aprTone", () => {
  test("escape markup and classify who gets paid", () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
    expect(aprTone(5)).toBe("shorts-paid");
    expect(aprTone(-5)).toBe("longs-paid");
    expect(aprTone(0)).toBe("flat");
  });
});
