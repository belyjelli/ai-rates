import { describe, expect, test } from "bun:test";
import { venueFees } from "@ai-rates/core";
import type { Venue } from "@ai-rates/venues";
import { RETAIL_TAKER_BPS, retailSchedule } from "./retail-fees";

const catalog = [
  { id: "gate", name: "Gate", type: "cex", takerBps: 7.5, verified: true, probes: [] },
  // Zero is an answer, not an absence: it must survive rather than fall back to the assumption.
  { id: "rebate", name: "Rebate", type: "cex", takerBps: 0, verified: true, probes: [] },
  { id: "okx", name: "OKX", type: "cex", verified: true, probes: [] },
] as unknown as Venue[];

describe("retailSchedule", () => {
  test("a hand-verified fee wins, and a venue without one gets the stated assumption", () => {
    const schedule = retailSchedule(["gate", "okx"], catalog);
    expect(venueFees(schedule, "gate")?.takerBps).toBe(7.5);
    expect(venueFees(schedule, "okx")?.takerBps).toBe(RETAIL_TAKER_BPS);
  });

  test("a verified zero is kept rather than read as missing", () => {
    expect(venueFees(retailSchedule(["rebate"], catalog), "rebate")?.takerBps).toBe(0);
  });

  test("only the venues asked for are in the schedule, so anything else stays unknown", () => {
    const schedule = retailSchedule(["gate"], catalog);
    expect(Object.keys(schedule)).toEqual(["gate"]);
    expect(venueFees(schedule, "okx")).toBeNull();
  });

  test("no withdrawal cost is asserted, so gapCost reports the transfer as uncounted", () => {
    expect(venueFees(retailSchedule(["gate"], catalog), "gate")?.withdrawalUsd).toBeUndefined();
  });
});
