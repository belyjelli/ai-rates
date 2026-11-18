import type { BetEvent, BetLine, BetsRead, BetVenue } from "./bet-types";
import { kalshiBusiest, kalshiEvent, kalshiLines } from "./kalshi";
import { findStories, pinCandidate } from "./pin-finder";
import type { AutoPin, AutoPinStore } from "./pin-store";
import { polymarketEvent, polymarketLines, polymarketRead } from "./polymarket";

/**
 * The homepage's prediction-market section (web/bets.ts), from Polymarket (app/polymarket.ts) and
 * Kalshi (app/kalshi.ts) together: the pinned event, the most traded event of the last 24 hours on
 * either venue, and the next ones in a table. Dollars traded rank the two venues as one.
 *
 * THE PIN is the owner's while one of PINS lasts; otherwise the pin finder's (app/pin-finder.ts): the
 * biggest new story, held for every location by app/pin-store.ts. With neither, nothing is pinned.
 *
 * One read is about 3 MB from Polymarket and 1 MB from Kalshi, and a few dozen kilobytes of price
 * history for the two charts. The result is a few kilobytes, kept BETS_FRESH_MS in this isolate and
 * in the colo's cache, shared by every language's copy of the page; a stale copy is still served
 * while a new one is read behind it, up to BETS_KEEP_MS. One venue failing leaves the other's.
 */

/** An event shown first, with its chart, until `untilMs`; it then drops back among the rest. */
export interface Pin {
  venue: BetVenue;
  /** Polymarket's event slug or Kalshi's event ticker. */
  id: string;
  untilMs: number;
}

/**
 * Owner, 2026-11-18: pin "Jensen Huang rejoins NVIDIA by...?" for a week. NVIDIA announced on
 * November 12 that he had resigned as President, CEO and director; it was Polymarket's busiest
 * question outside sports that day ($2.0M in 24 hours).
 */
export const PINS: readonly Pin[] = [
  {
    venue: "polymarket",
    id: "jensen-huang-rejoins-nvidia-byptptpt",
    // Owner, 2026-11-18: through November 25, then the pin finder takes over.
    untilMs: Date.parse("2026-11-25T23:59:59Z"),
  },
];

/** How many events the table shows after the featured ones. */
export const TABLE_ROWS = 8;
/**
 * The table's rows from each venue at least, while it has that many. Kalshi trades far fewer dollars
 * than Polymarket outside a few questions (2026-11-18: its NVIDIA CEO question $0.9M, its next ones
 * $17k to $291k, against Polymarket's eighth at $0.5M), so a ranking by dollars alone would leave
 * Kalshi one row.
 */
export const MIN_PER_VENUE = 3;
/** A read younger than this is served as it is. */
export const BETS_FRESH_MS = 5 * 60_000;
/** An older one is still served, and read again behind it, up to this age. */
export const BETS_KEEP_MS = 2 * 3_600_000;
const BETS_CACHE_KEY = "https://airrates.internal/predictions/bets?v=3";

/** The owner's pin in force at `now`, the first if several are. */
export const activePin = (now: number, pins: readonly Pin[] = PINS): Pin | null =>
  pins.find((p) => p.untilMs > now) ?? null;

const isPinned = (e: BetEvent, pin: Pin | null) =>
  pin !== null && e.venue === pin.venue && e.id === pin.id;

/** Both venues' events in one ranking, by dollars traded over 24 hours. */
export function rankEvents(lists: BetEvent[][]): BetEvent[] {
  return lists.flat().sort((a, b) => b.volume24h - a.volume24h);
}

/**
 * What the section shows from the ranked events and the pinned one: the pinned event, the busiest
 * other one, and the table after it. A pinned event that could not be read on its own is taken
 * from the ranking when it is there.
 */
export function arrange(
  ranked: BetEvent[],
  pin: Pin | null,
  pinnedRead: BetEvent | null,
): { pinned: BetEvent | null; busiest: BetEvent | null; table: BetEvent[] } {
  const pinned = pin ? (pinnedRead ?? ranked.find((e) => isPinned(e, pin)) ?? null) : null;
  const rest = ranked.filter((e) => !isPinned(e, pin));
  return { pinned, busiest: rest[0] ?? null, table: tableRows(rest.slice(1)) };
}

/**
 * The table: the TABLE_ROWS most traded, with each venue's next ones swapped in for the other's least
 * traded until each has MIN_PER_VENUE (or all it has), still in order of dollars traded.
 */
export function tableRows(ranked: BetEvent[], rows = TABLE_ROWS, min = MIN_PER_VENUE): BetEvent[] {
  const chosen = ranked.slice(0, rows);
  const count = (venue: BetVenue) => chosen.filter((e) => e.venue === venue).length;
  for (const venue of ["polymarket", "kalshi"] as const) {
    const waiting = ranked.filter((e) => e.venue === venue && !chosen.includes(e));
    while (count(venue) < min && waiting.length > 0) {
      let drop = -1;
      for (let i = chosen.length - 1; i >= 0 && drop < 0; i--) {
        const other = (chosen[i] as BetEvent).venue;
        if (other !== venue && count(other) > min) drop = i;
      }
      if (drop < 0 && chosen.length >= rows) break;
      if (drop >= 0) chosen.splice(drop, 1);
      chosen.push(waiting.shift() as BetEvent);
    }
  }
  return chosen.sort((a, b) => b.volume24h - a.volume24h);
}

export interface BetsSource {
  /** The section's read, or null when it could not be read and no copy is kept. */
  bets(): Promise<BetsRead | null>;
}

export interface BetsOptions {
  fetch: typeof fetch;
  /** The colo's cache (caches.default); null in tests and local dev. */
  cache?: Cache | null;
  waitUntil?: (promise: Promise<unknown>) => void;
  now: () => number;
  log?: (line: string) => void;
  /** The pins; PINS unless a test says otherwise. */
  pins?: readonly Pin[];
  /** The automatic pin's store (app/pin-store.ts); absent in tests and local dev: no automatic pin. */
  autoPins?: AutoPinStore;
}

/**
 * This isolate's last finished read. Only a FINISHED answer is shared between requests: a promise
 * still in flight, shared, hangs the requests that wait on it once the one that started it ends
 * (2026-10, member paper/signals).
 */
let memo: BetsRead | null = null;
/** When this isolate last started a read behind a stale copy: one such read at a time. */
let refreshedAt = 0;

/** Tests start from no kept read. */
export function forgetBets(): void {
  memo = null;
  refreshedAt = 0;
}

export function betsSource(options: BetsOptions): BetsSource {
  const { fetch: get, cache = null, waitUntil, now, log, pins = PINS, autoPins } = options;

  const lines = (event: BetEvent, at: number): Promise<BetLine[]> =>
    (event.venue === "kalshi"
      ? kalshiLines(get, event, at)
      : polymarketLines(get, event, at)
    ).catch((err) => {
      log?.(`${event.venue} history not read for ${event.id}: ${String(err)}`);
      return [];
    });

  const eventById = (pin: Pin, at: number): Promise<BetEvent | null> =>
    pin.venue === "kalshi" ? kalshiEvent(get, pin.id, at) : polymarketEvent(get, pin.id, at);

  const read = async (): Promise<BetsRead> => {
    const at = now();
    const manual = activePin(at, pins);
    const [poly, kalshi, manualRead] = await Promise.allSettled([
      polymarketRead(get, at),
      kalshiBusiest(get, at),
      manual ? eventById(manual, at) : Promise.resolve(null),
    ]);
    if (poly.status === "rejected") log?.(`polymarket not read: ${String(poly.reason)}`);
    if (kalshi.status === "rejected") log?.(`kalshi not read: ${String(kalshi.reason)}`);
    if (manualRead.status === "rejected")
      log?.(`pinned event not read: ${String(manualRead.reason)}`);
    const kalshiEvents = kalshi.status === "fulfilled" ? kalshi.value : [];
    const ranked = rankEvents([poly.status === "fulfilled" ? poly.value.events : [], kalshiEvents]);
    // The pin finder weighs every read, a hand pin or not, so the store's pin is current when the
    // hand pin ends; without Polymarket's answer it has nothing to weigh and the standing pin stays.
    let auto: AutoPin | null = null;
    if (autoPins) {
      const candidate =
        poly.status === "fulfilled"
          ? pinCandidate(findStories(poly.value.signals, kalshiEvents, at), at)
          : null;
      auto = await autoPins.decide(candidate, at).catch((err) => {
        log?.(`automatic pin not read: ${String(err)}`);
        return null;
      });
    }
    const pin: Pin | null =
      manual ?? (auto ? { venue: auto.venue, id: auto.id, untilMs: auto.until } : null);
    let pinnedRead = manualRead.status === "fulfilled" ? manualRead.value : null;
    if (!manual && pin) {
      pinnedRead = await eventById(pin, at).catch((err) => {
        log?.(`automatic pin's event not read: ${String(err)}`);
        return null;
      });
    }
    const { pinned, busiest, table } = arrange(ranked, pin, pinnedRead);
    if (!pinned && !busiest) throw new Error("no open event on either venue");
    const [pinnedLines, busiestLines] = await Promise.all([
      pinned ? lines(pinned, at) : Promise.resolve([]),
      busiest ? lines(busiest, at) : Promise.resolve([]),
    ]);
    const result: BetsRead = {
      readAt: at,
      pinned:
        pinned && pin
          ? {
              event: pinned,
              lines: pinnedLines,
              untilMs: pin.untilMs,
              auto: manual || !auto ? null : auto.reasons,
            }
          : null,
      busiest: busiest ? { event: busiest, lines: busiestLines } : null,
      events: table,
    };
    memo = result;
    if (cache) {
      await cache
        .put(
          BETS_CACHE_KEY,
          new Response(JSON.stringify(result), {
            headers: {
              "content-type": "application/json",
              "cache-control": `max-age=${Math.round(BETS_KEEP_MS / 1000)}`,
            },
          }),
        )
        .catch(() => {});
    }
    return result;
  };

  const bets = async (): Promise<BetsRead | null> => {
    const at = now();
    let held = memo;
    if (!held && cache) {
      const hit = await cache.match(BETS_CACHE_KEY).catch(() => undefined);
      if (hit) {
        try {
          held = (await hit.json()) as BetsRead;
          memo = held;
        } catch {
          held = null;
        }
      }
    }
    // A kept read made while a pin was in force is not served once the pin is over.
    const pinOver = held?.pinned ? held.pinned.untilMs <= at : false;
    if (held && !pinOver && at - held.readAt < BETS_FRESH_MS) return held;
    if (held && !pinOver && at - held.readAt < BETS_KEEP_MS && waitUntil) {
      // Stale: served as it is, read again behind it, once a minute at most from this isolate.
      if (at - refreshedAt > 60_000) {
        refreshedAt = at;
        waitUntil(read().catch((err) => log?.(`prediction markets not read: ${String(err)}`)));
      }
      return held;
    }
    try {
      return await read();
    } catch (err) {
      log?.(`prediction markets not read: ${String(err)}`);
      return held && at - held.readAt < BETS_KEEP_MS ? held : null;
    }
  };

  return { bets };
}
