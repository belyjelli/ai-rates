import { describe, expect, test } from "bun:test";
import {
  type FundingBucket,
  type FundingHistory,
  fundingSeries,
  renderFundingChart,
  spreadPoints,
} from "./funding-chart";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const FROM = Date.UTC(2026, 8, 6);

const bucket = (
  venue_id: string,
  venue_symbol: string,
  hoursIn: number,
  rate: number,
  basis = 8,
): FundingBucket => ({
  venue_id,
  venue_symbol,
  atMs: FROM + hoursIn * HOUR,
  rate_sum: rate,
  basis_hours_sum: basis,
});

const hourly = (buckets: FundingBucket[]): FundingHistory => ({
  grain: "hour",
  fromMs: FROM,
  toMs: FROM + 7 * DAY,
  buckets,
});

describe("fundingSeries", () => {
  test("annualizes each bucket, puts the legs first, and names a symbol only when it is needed", () => {
    const series = fundingSeries(
      hourly([
        bucket("mexc", "BTC_USDT", 8, 0.0001),
        bucket("mexc", "BTC_USDC", 8, 0.0002),
        bucket("okx", "BTC-USDT-SWAP", 0, 0.0001),
        bucket("gate", "BTC_USDT", 0, -0.0001),
      ]),
      {
        long: { venue_id: "gate", venue_symbol: "BTC_USDT" },
        short: { venue_id: "okx", venue_symbol: "BTC-USDT-SWAP" },
      },
    );

    expect(series.map((s) => [s.role, s.label])).toEqual([
      ["long", "Gate"],
      ["short", "OKX"],
      // MEXC lists the asset twice, so only its labels carry the symbol.
      ["other", "MEXC BTC_USDC"],
      ["other", "MEXC BTC_USDT"],
    ]);
    // 0.01% over an 8-hour basis is 0.00125% an hour, 10.95% a year.
    expect(series[1]?.points[0]?.[1]).toBeCloseTo(10.95, 9);
    expect(series[0]?.points[0]?.[1]).toBeCloseTo(-10.95, 9);
  });

  test("a bucket with no hours behind it is skipped rather than divided by zero", () => {
    const series = fundingSeries(hourly([bucket("okx", "X", 0, 0.0001, 0)]), {});
    expect(series).toEqual([]);
  });
});

describe("spreadPoints", () => {
  test("each leg holds its last rate until it settles again, and nothing is drawn before both have", () => {
    const long = {
      key: "l",
      label: "L",
      role: "long" as const,
      points: [
        [0, -5],
        [8 * HOUR, -7],
      ] as [number, number][],
    };
    const short = {
      key: "s",
      label: "S",
      role: "short" as const,
      points: [[4 * HOUR, 10]] as [number, number][],
    };
    expect(spreadPoints(long, short)).toEqual([
      [4 * HOUR, 15],
      [8 * HOUR, 17],
    ]);
  });
});

describe("renderFundingChart", () => {
  test("says so when the chart cannot be read, or has nothing to draw", () => {
    expect(renderFundingChart(null, {})).toContain("The funding chart is unavailable right now");
    expect(renderFundingChart(hourly([]), {})).toContain("No stored funding for this window yet");
  });

  test("breaks a line across a day with no data instead of drawing a rate through it", () => {
    const html = renderFundingChart(
      hourly([
        bucket("okx", "X", 0, 0.0001),
        bucket("okx", "X", 8, 0.0001),
        // Three days later: a hole, so a second subpath starts.
        bucket("okx", "X", 80, 0.0002),
      ]),
      {},
    );
    // With no pair chosen the line carries its own colour, so other attributes sit before `d`.
    const path = html.match(/data-series="okx\|X"[^>]* d="([^"]+)"/)?.[1] ?? "";
    expect(path.match(/M/g)).toHaveLength(2);
  });

  test("a label reaching the embedded data cannot close its script tag", () => {
    const html = renderFundingChart(hourly([bucket("okx", "</script><b>", 0, 0.0001)]), {});
    const data = html.match(
      /<script type="application\/json" class="fchart-data">([\s\S]*?)<\/script>/,
    )?.[1];
    expect(data).toBeDefined();
    expect(data).not.toContain("<");
    expect(JSON.parse(data as string).series[0].key).toBe("okx|</script><b>");
  });
});
