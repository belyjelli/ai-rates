import { describe, expect, test } from "bun:test";
import { backtestFeesFrom, type FeeSchedule, gapCost, venueFees } from "./fees";

const schedule: FeeSchedule = {
  gate: { takerBps: 5, withdrawalUsd: 5 },
  bybit: { takerBps: 5.5 },
  // A venue that genuinely rebates takers. Zero is an answer, not an absence.
  rebate: { takerBps: 0 },
};

describe("venueFees", () => {
  test("an unlisted venue is unknown, not free", () => {
    expect(venueFees(schedule, "okx")).toBeNull();
    expect(venueFees(null, "gate")).toBeNull();
    expect(venueFees(undefined, "gate")).toBeNull();
  });

  test("zero is kept, because some venues really do rebate takers", () => {
    expect(venueFees(schedule, "rebate")?.takerBps).toBe(0);
  });

  test("an unusable number is treated as unknown", () => {
    expect(venueFees({ broken: { takerBps: Number.NaN } }, "broken")).toBeNull();
  });
});

describe("gapCost", () => {
  test("charges two fills, not four", () => {
    const cost = gapCost({ gapBps: 256, buyVenueId: "gate", sellVenueId: "bybit", fees: schedule });
    // 5 + 5.5 once each. backtestPair's four-fill model would have charged 21 and understated it.
    expect(cost.takerBps).toBe(10.5);
    expect(cost.netBps).toBeCloseTo(245.5, 10);
  });

  test("an unknown venue makes the net figure null rather than flattering", () => {
    const cost = gapCost({ gapBps: 256, buyVenueId: "gate", sellVenueId: "okx", fees: schedule });
    expect(cost.takerBps).toBeNull();
    expect(cost.netBps).toBeNull();
    // The gross figure survives: it is quoted, not computed from fees.
    expect(cost.gapBps).toBe(256);
  });

  test("a transfer cost needs a size, and is charged against the venue bought on", () => {
    const withSize = gapCost({
      gapBps: 256,
      buyVenueId: "gate",
      sellVenueId: "bybit",
      fees: schedule,
      sizeUsd: 10_000,
    });
    // $5 on $10,000 is 5 bps.
    expect(withSize.transferBps).toBeCloseTo(5, 10);
    expect(withSize.netBps).toBeCloseTo(240.5, 10);

    const noSize = gapCost({
      gapBps: 256,
      buyVenueId: "gate",
      sellVenueId: "bybit",
      fees: schedule,
    });
    expect(noSize.transferBps).toBeNull();
  });

  test("an unconfigured withdrawal leaves net computed without it, and says so", () => {
    // Bought on bybit, which has no withdrawalUsd. The net is still worth showing, but the caller
    // has to disclose that the transfer is not in it -- transferBps null is that signal.
    const cost = gapCost({
      gapBps: 256,
      buyVenueId: "bybit",
      sellVenueId: "gate",
      fees: schedule,
      sizeUsd: 10_000,
    });
    expect(cost.transferBps).toBeNull();
    expect(cost.netBps).toBeCloseTo(245.5, 10);
  });
});

describe("backtestFeesFrom", () => {
  test("resolves both legs through the same rule the price views use", () => {
    expect(backtestFeesFrom(schedule, "gate", "bybit")).toEqual({
      longTakerBps: 5,
      shortTakerBps: 5.5,
    });
  });

  test("one unknown leg yields null, so backtestPair keeps its costs-unknown path", () => {
    expect(backtestFeesFrom(schedule, "gate", "okx")).toBeNull();
    expect(backtestFeesFrom(null, "gate", "bybit")).toBeNull();
  });
});
