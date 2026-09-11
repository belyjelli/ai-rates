import { describe, expect, test } from "bun:test";
import { railPosition, railScale, renderRail } from "./rail";

describe("railScale (linear)", () => {
  test("always includes zero, with padding", () => {
    const scale = railScale([5, 20]);
    expect(scale.min).toBeLessThan(0);
    expect(scale.max).toBeGreaterThan(20);
  });

  test("clips outliers once there are enough values", () => {
    const values = [...Array.from({ length: 30 }, (_, i) => i - 5), 1224];
    const scale = railScale(values);
    expect(scale.max).toBeLessThan(40);
    expect(railPosition(1224, scale)).toEqual({ pct: 100, clipped: true });
  });

  test("has a sensible default with no data", () => {
    expect(railScale([null])).toEqual({ min: -10, max: 10, mode: "linear" });
  });
});

describe("railScale (log)", () => {
  // Real funding on the same page: distressed coins near −964% next to BTC around +5%.
  const values = [-964, -738, -292, -0.1, 4.7, 10.9, 458, 760];
  const scale = railScale(values, "log");

  test("keeps every value on the axis", () => {
    for (const v of values) expect(railPosition(v, scale).clipped).toBe(false);
  });

  test("preserves order", () => {
    const positions = [-964, -10, 0, 10, 760].map((v) => railPosition(v, scale).pct);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test("leaves visible room for ordinary rates next to extremes", () => {
    const wide = railScale([-1000, 1000], "log");
    const room = railPosition(10, wide).pct - railPosition(0, wide).pct;
    expect(room).toBeGreaterThan(5); // a linear axis would give 10% about 0.5 points
    expect(railPosition(0, wide).pct).toBeCloseTo(50, 6);
  });
});

describe("railPosition", () => {
  test("maps APR linearly onto a linear axis", () => {
    const scale = { min: -10, max: 30 };
    expect(railPosition(-10, scale)).toEqual({ pct: 0, clipped: false });
    expect(railPosition(10, scale)).toEqual({ pct: 50, clipped: false });
    expect(railPosition(-50, scale)).toEqual({ pct: 0, clipped: true });
  });
});

describe("renderRail", () => {
  test("renders zero tick, spread bar and escaped, labelled marks", () => {
    const html = renderRail({
      scale: { min: -10, max: 30 },
      marks: [
        { apr: -10, tone: "long", label: "Long <Gate>" },
        { apr: 30, tone: "short", label: "Short OKX" },
      ],
      bar: [-10, 30],
    });
    expect(html).toContain('class="rail-zero" style="left:25.00%"');
    expect(html).toContain('class="rail-bar" style="left:0.00%;width:100.00%"');
    expect(html).toContain('class="rail-mark long"');
    expect(html).toContain('class="rail-mark short"');
    expect(html).toContain("Long &lt;Gate&gt; −10.0%, Short OKX +30.0%");
    expect(html).not.toContain("<Gate>");
  });
});
