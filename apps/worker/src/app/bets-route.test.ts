import { describe, expect, test } from "bun:test";
import { handleApp } from "./app";
import type { BetsRead } from "./bet-types";
import type { BetsSource } from "./bets";
import type { DataSource } from "./data";

const NOW = Date.parse("2026-11-18T05:00:00Z");

/** A data source that fails every read: the route must not touch the database. */
const noDatabase = new Proxy({} as DataSource, {
  get: () => async () => {
    throw new Error("the prediction-market route read the database");
  },
});

const READ: BetsRead = {
  readAt: NOW,
  pinned: null,
  busiest: {
    event: {
      venue: "kalshi",
      id: "KXNVDACEO-29JAN",
      url: "https://kalshi.com/markets/kxnvdaceo",
      series: "KXNVDACEO",
      title: "Who will be the next CEO of NVIDIA?",
      context: null,
      volume24h: 918_792,
      volume: null,
      startMs: NOW - 5 * 86_400_000,
      answers: [{ label: "Rene Haas", price: 0.23, change1d: 0.04, ref: "r", endMs: null }],
      ladder: false,
    },
    lines: [],
  },
  events: [],
};

const call = (bets: BetsSource | undefined) =>
  handleApp(new Request("https://airrates.net/data/bets"), {
    data: noDatabase,
    now: () => NOW,
    bets,
  });

describe("/data/bets", () => {
  test("answers the section's contents from the venues, kept five minutes", async () => {
    const res = await call({ bets: async () => READ });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await res.text()).toContain("Who will be the next CEO of NVIDIA?");
  });

  test("a failed read is a 503 the edge cache does not keep", async () => {
    for (const bets of [
      undefined,
      { bets: async () => null },
      { bets: () => Promise.reject(new Error("x")) },
    ]) {
      const res = await call(bets);
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});
