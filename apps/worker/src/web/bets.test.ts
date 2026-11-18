import { describe, expect, test } from "bun:test";
import type { BetEvent, BetsRead } from "../app/bet-types";
import { BETS_PATH, betsFragment, betsResponse, betsSection } from "./bets";
import { withLocale } from "./i18n";

const NOW = Date.parse("2026-11-18T05:00:00Z");
const DAY = 86_400_000;

const event = (over: Partial<BetEvent>): BetEvent => ({
  venue: "polymarket",
  id: "jensen-huang-rejoins-nvidia-byptptpt",
  url: "https://polymarket.com/event/jensen-huang-rejoins-nvidia-byptptpt",
  series: null,
  title: "Jensen Huang rejoins NVIDIA by...?",
  context: "On November 12, 2026, NVIDIA announced that Jensen Huang had resigned.",
  volume24h: 2_036_206,
  volume: 5_153_149,
  startMs: Date.parse("2026-11-12T21:17:08Z"),
  answers: [
    {
      label: "November 30, 2026",
      price: 0.0285,
      change1d: -0.021,
      ref: "a",
      endMs: NOW + 12 * DAY,
    },
    {
      label: "December 31, 2026",
      price: 0.0855,
      change1d: -0.022,
      ref: "b",
      endMs: NOW + 43 * DAY,
    },
    { label: "December 31, 2027", price: 0.335, change1d: 0.03, ref: "c", endMs: NOW + 408 * DAY },
  ],
  ladder: true,
  ...over,
});

const line = (label: string, a: number, b: number) => ({
  label,
  points: [
    [NOW - 5 * DAY, a],
    [NOW, b],
  ] as [number, number][],
});

const READ: BetsRead = {
  readAt: NOW,
  pinned: {
    event: event({}),
    lines: [
      line("November 30, 2026", 0.02, 0.03),
      line("December 31, 2026", 0.06, 0.09),
      line("December 31, 2027", 0.15, 0.34),
    ],
    untilMs: Date.parse("2026-11-25T06:00:00Z"),
    auto: null,
  },
  busiest: {
    event: event({
      id: "fed",
      url: "https://polymarket.com/event/fed",
      title: "Fed Decision in December?",
      context: null,
      volume24h: 1_600_000,
      ladder: false,
      answers: [{ label: "25 bps increase", price: 0.94, change1d: 0.02, ref: "f", endMs: null }],
    }),
    lines: [line("25 bps increase", 0.75, 0.94)],
  },
  events: [
    event({
      venue: "kalshi",
      id: "KXNVDACEO-29JAN",
      url: "https://kalshi.com/markets/kxnvdaceo",
      series: "KXNVDACEO",
      title: "Who will be the next CEO of <NVIDIA>?",
      volume: null,
      volume24h: 918_792,
      ladder: false,
      answers: [
        { label: "Rene Haas", price: 0.23, change1d: 0.04, ref: "r", endMs: null },
        { label: "Ian Buck", price: 0.16, change1d: null, ref: "i", endMs: null },
      ],
    }),
  ],
};

describe("homepage prediction markets", () => {
  test("the section is a placeholder that loads BETS_PATH, with both venues named", () => {
    const html = withLocale("en", () => betsSection());
    expect(html).toContain(`data-bets-src="${BETS_PATH}"`);
    expect(html).toContain("What the crowd is betting on");
    expect(html).toContain("chart-skel");
    expect(html).toContain("https://polymarket.com/");
    expect(html).toContain("https://kalshi.com/");
  });

  test("the pinned card, the busiest card and the table", () => {
    const html = withLocale("en", () => betsFragment(READ));
    expect(html).toContain("Pinned until Nov 25 · Polymarket");
    expect(html).toContain("Most traded in the last 24 hours · Polymarket");
    expect(html.indexOf("Jensen Huang rejoins")).toBeLessThan(html.indexOf("Fed Decision"));
    expect(html.match(/class="fchart bets-chart"/g)).toHaveLength(2);
    // Tiles: the chance, and the day's change in points.
    expect(html).toContain('<p class="bets-big">34%</p>');
    expect(html).toContain('<span class="mc-down">−2</span> pts in 24h');
    expect(html).toContain("Traded since Nov 12 <b>$5.2M</b>");
    // The table: Kalshi named, its question escaped, its leading answer and how many more.
    expect(html).toContain('<td class="bets-venue dim">Kalshi</td>');
    expect(html).toContain("Who will be the next CEO of &lt;NVIDIA&gt;?");
    expect(html).toContain("Rene Haas");
    expect(html).toContain("+1 more");
    expect(html).not.toContain("<NVIDIA>");
  });

  test("an automatic pin says so, and why it was picked", () => {
    const auto = {
      questions: 7,
      venues: ["polymarket", "kalshi"] as ("polymarket" | "kalshi")[],
      volume24h: 4_800_000,
      featuredOrder: 2,
      openedMs: Date.parse("2026-11-12T21:18:08Z"),
    };
    const html = withLocale("en", () =>
      betsFragment({
        ...READ,
        pinned: { ...(READ.pinned as NonNullable<BetsRead["pinned"]>), auto },
      }),
    );
    expect(html).toContain("Picked automatically until Nov 25 · Polymarket");
    expect(html).not.toContain("Pinned until");
    expect(html).toContain('<p class="bets-why"><span>A story across 7 questions</span>');
    expect(html).toContain("<span>On Polymarket and Kalshi</span>");
    expect(html).toContain("<span>$4.8M traded on it in 24h</span>");
    expect(html).toContain("<span>Polymarket's featured #2</span>");
    expect(html).toContain("<span>New since Nov 12</span>");
    // A pin by hand gives no reasons.
    expect(withLocale("en", () => betsFragment(READ))).not.toContain("bets-why");
  });

  test("without a pin the busiest stands alone; with nothing, it says so", () => {
    const alone = withLocale("en", () => betsFragment({ ...READ, pinned: null }));
    expect(alone).not.toContain("Pinned until");
    expect(alone).not.toContain("bets-two");
    const none = withLocale("en", () =>
      betsFragment({ readAt: NOW, pinned: null, busiest: null, events: [] }),
    );
    expect(none).toContain("No open question on Polymarket or Kalshi right now.");
  });

  test("translated: the section's own words follow the page's language", () => {
    const html = withLocale("zh", () => betsFragment(READ));
    expect(html).toContain("置顶至");
    expect(html).toContain("过去 24 小时成交最多");
  });

  test("the response is kept five minutes; a failed read is a 503 nobody keeps", () => {
    const ok = betsResponse("<p>x</p>");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("public, max-age=300");
    const failed = betsResponse(null);
    expect(failed.status).toBe(503);
    expect(failed.headers.get("cache-control")).toBe("no-store");
  });
});
