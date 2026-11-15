import { beforeEach, describe, expect, test } from "bun:test";
import {
  coinResults,
  forgetLeaderboard,
  hyperliquidSource,
  INFO_URL,
  LEADERBOARD_URL,
  LEADERS_FRESH_MS,
  parseFills,
  parseOrders,
  readLeaderboard,
  tradesOf,
} from "./hyperliquid";

const row = (address: string, day: number, month: number, name: string | null = null) => ({
  ethAddress: address,
  accountValue: "1000000.5",
  windowPerformances: [
    ["day", { pnl: String(day), roi: "0.01", vlm: "100" }],
    ["week", { pnl: "0", roi: "0", vlm: "0" }],
    ["month", { pnl: String(month), roi: "0.2", vlm: "1000" }],
    ["allTime", { pnl: "5", roi: "0.5", vlm: "9999" }],
  ],
  prize: 0,
  displayName: name,
});

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;

/** The board as Hyperliquid serves it (pretty-printed), cut into chunks of `size` bytes. */
function boardStream(rows: unknown[], size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(JSON.stringify({ leaderboardRows: rows }, null, 2));
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.subarray(i, i + size));
      controller.close();
    },
  });
}

describe("readLeaderboard", () => {
  const rows = [
    row(addr(1), 10, 300),
    // A name full of what a scanner could trip on: braces, brackets, quotes and a backslash.
    row(addr(2), 50, 100, 'The "{[king]}" \\ of ]} perps'),
    row(addr(3), -5, 900),
    { ethAddress: "not an address", windowPerformances: [] },
    row(addr(4).toUpperCase().replace("0X", "0x"), 20, 50),
  ];

  for (const size of [1, 7, 64, 100_000]) {
    test(`reads every row, whatever the chunks (${size} bytes)`, async () => {
      const { ranked, top } = await readLeaderboard(boardStream(rows, size), 2);
      expect(ranked).toBe(4);
      expect(top.day.map((l) => l.address)).toEqual([addr(2), addr(4)]);
      expect(top.month.map((l) => l.address)).toEqual([addr(3), addr(1)]);
      expect(top.day[0]?.name).toBe('The "{[king]}" \\ of ]} perps');
      expect(top.month[0]).toMatchObject({ accountValue: 1000000.5, pnl: [-5, 0, 900, 5] });
    });
  }
});

describe("an account's orders and fills", () => {
  test("an order is kept once, at its latest status, newest first", () => {
    const order = (oid: number, sz: string) => ({
      coin: "BTC",
      side: "A",
      limitPx: "74660.0",
      sz,
      oid,
      timestamp: 1000,
      triggerCondition: "N/A",
      isTrigger: false,
      triggerPx: "0.0",
      isPositionTpsl: false,
      reduceOnly: false,
      orderType: "Limit",
      origSz: "11.0",
      tif: "Gtc",
    });
    const orders = parseOrders([
      { order: order(7, "0.0"), status: "filled", statusTimestamp: 3000 },
      { order: order(7, "11.0"), status: "open", statusTimestamp: 1000 },
      { order: order(8, "11.0"), status: "canceled", statusTimestamp: 2000 },
    ]);
    expect(orders?.map((o) => [o.oid, o.status, o.left])).toEqual([
      [7, "filled", 0],
      [8, "canceled", 11],
    ]);
    expect(parseOrders({ error: "nope" })).toBeNull();
  });

  test("fills group by order into trades; results by coin net their fees", () => {
    const fills = parseFills([
      {
        coin: "BTC",
        px: "100",
        sz: "1",
        side: "A",
        time: 3,
        dir: "Open Short",
        closedPnl: "0",
        oid: 1,
        fee: "1",
      },
      {
        coin: "BTC",
        px: "103",
        sz: "3",
        side: "A",
        time: 4,
        dir: "Open Short",
        closedPnl: "0",
        oid: 1,
        fee: "3",
      },
      {
        coin: "ETH",
        px: "10",
        sz: "5",
        side: "B",
        time: 2,
        dir: "Close Short",
        closedPnl: "40",
        oid: 2,
        fee: "0.5",
        liquidation: { liquidatedUser: addr(9), markPx: "10", method: "market" },
      },
    ]) as NonNullable<ReturnType<typeof parseFills>>;
    const trades = tradesOf(fills);
    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({
      coin: "BTC",
      size: 4,
      price: 102.25,
      fee: 4,
      fills: 2,
      time: 4,
    });
    expect(trades[1]).toMatchObject({ coin: "ETH", closedPnl: 40, liquidation: true });
    expect(coinResults(fills).map((r) => [r.coin, r.trades, r.closedPnl - r.fees])).toEqual([
      ["ETH", 1, 39.5],
      ["BTC", 1, -4],
    ]);
  });
});

describe("hyperliquidSource", () => {
  beforeEach(() => forgetLeaderboard());

  const boardResponse = () => new Response(boardStream([row(addr(1), 1, 2)], 4096));

  test("the leaderboard is read once and kept; a stale copy is served while it is read again", async () => {
    let now = 1_000_000;
    let reads = 0;
    const later: Promise<unknown>[] = [];
    const source = hyperliquidSource({
      fetch: (async (input: string) => {
        expect(input).toBe(LEADERBOARD_URL);
        reads++;
        return boardResponse();
      }) as unknown as typeof fetch,
      waitUntil: (promise) => later.push(promise),
      now: () => now,
    });
    const first = await source.leaders();
    expect(first?.ranked).toBe(1);
    expect(await source.leaders()).toBe(first);
    expect(reads).toBe(1);
    now += LEADERS_FRESH_MS + 1;
    // Stale: the same copy at once, and a read behind it.
    expect(await source.leaders()).toBe(first);
    await Promise.all(later);
    expect(reads).toBe(2);
    expect((await source.leaders())?.readAt).toBe(now);
  });

  test("no board and no copy is null, not a throw", async () => {
    const source = hyperliquidSource({
      fetch: (async () => new Response("busy", { status: 502 })) as unknown as typeof fetch,
      now: () => 1,
    });
    expect(await source.leaders()).toBeNull();
  });

  test("a trader is five info reads; a throttled one marks the read busy and leaves the rest", async () => {
    const asked: string[] = [];
    const source = hyperliquidSource({
      fetch: (async (input: string, init?: RequestInit) => {
        expect(input).toBe(INFO_URL);
        const body = JSON.parse(String(init?.body)) as { type: string; user: string };
        asked.push(body.type);
        expect(body.user).toBe(addr(5));
        if (body.type === "userFills") return new Response("slow down", { status: 429 });
        if (body.type === "clearinghouseState") {
          return Response.json({
            marginSummary: { accountValue: "100", totalNtlPos: "300", totalMarginUsed: "30" },
            withdrawable: "70",
            assetPositions: [
              {
                position: {
                  coin: "ETH",
                  szi: "2",
                  positionValue: "300",
                  unrealizedPnl: "12",
                  entryPx: "144",
                },
              },
            ],
          });
        }
        return Response.json([]);
      }) as unknown as typeof fetch,
      now: () => 9,
    });
    const read = await source.trader(addr(5));
    expect(asked.sort()).toEqual([
      "clearinghouseState",
      "frontendOpenOrders",
      "historicalOrders",
      "portfolio",
      "userFills",
    ]);
    expect(read.busy).toBe(true);
    expect(read.fills).toBeNull();
    expect(read.orders).toEqual([]);
    expect(read.state?.positions[0]).toMatchObject({ coin: "ETH", size: 2, mark: 150, upnl: 12 });
    // An empty portfolio answer is not a portfolio.
    expect(read.portfolio).toBeNull();
  });
});
