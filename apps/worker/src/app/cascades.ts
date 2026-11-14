import type { CvdBar } from "./data";

/**
 * Liquidation cascades: the bursts in which one asset's forced closes piled up within minutes, and
 * what its price did once they stopped.
 *
 * WHAT COUNTS AS ONE (2026-11-15). The asset's own pace sets the bar, never a dollar figure for every
 * asset: BTC force-closes about $200k a minute on a 7-day average and SNDK a few thousand, so a
 * single threshold would find a cascade in BTC every minute and never one in a stock. A minute is HOT
 * when its closes ran at CASCADE_PACE times the asset's 7-day average pace or more (and at least
 * CASCADE_MINUTE_FLOOR); hot minutes with no more than CASCADE_GAP_MINUTES quiet ones between them are
 * one cascade; and a cascade counts only if it packed at least CASCADE_HOUR_WORTH minutes of that
 * average pace -- an hour's worth of the usual flow in a few minutes -- and CASCADE_FLOOR in all.
 *
 * WHY THE 7-DAY AVERAGE AND NOT THE WINDOW'S. On a crash day the window's own average is the crash,
 * and against it nothing stands out. The week is long enough to hold calm days and short enough to
 * follow an asset whose market has grown or faded.
 *
 * WHAT THE PRICE DID is read from the asset's busiest market in 5-minute candles (the Chart page's
 * bars), not from the liquidations' own fill prices: a fill is one venue's price at its worst moment,
 * and some venues quote a multiple of the coin (1000PEPE), which the bars have already divided out.
 */

/** A minute at this many times the asset's 7-day average pace, or more, is hot. */
export const CASCADE_PACE = 10;
/** ...and never less than this, so a stock with a near-zero average is not hot on one small close. */
export const CASCADE_MINUTE_FLOOR = 10_000;
/** Quiet minutes allowed between hot ones inside one cascade. */
export const CASCADE_GAP_MINUTES = 2;
/** A cascade packs at least this many minutes' worth of the average pace... */
export const CASCADE_HOUR_WORTH = 60;
/** ...and at least this much in all. */
export const CASCADE_FLOOR = 100_000;
/** The average pace is taken over this many hours. */
export const CASCADE_BASELINE_HOURS = 168;
/** The bars the reaction is read from. */
export const CASCADE_BAR_MINUTES = 5;
/** How long after a cascade the price is read again, in minutes. */
export const CASCADE_AFTER = [60, 240] as const;

const MINUTE = 60_000;
const BAR = CASCADE_BAR_MINUTES * MINUTE;

/** One hot minute as the data layer reads it: every venue's closes of the asset in that minute. */
export interface HotMinute {
  minute: Date;
  long_usd: number;
  short_usd: number;
  events: number;
  /** The venues that closed something in it, comma-joined. */
  venues: string;
}

/** What liquidationCascades reads: the asset's average pace, and its hot minutes in the window. */
export interface CascadeRead {
  /** Dollars force-closed per minute on average over CASCADE_BASELINE_HOURS. */
  per_minute: number;
  /** Oldest first. */
  minutes: HotMinute[];
}

export interface Cascade {
  /** The first hot minute's start. */
  start: Date;
  /** The last hot minute's start: where the price is read "after" from. */
  last: Date;
  /** From the first hot minute's start to the last one's end, in minutes. */
  minutes: number;
  long_usd: number;
  short_usd: number;
  events: number;
  venues: string[];
}

/** The hot minutes folded into cascades, newest first; the ones too small to count are dropped. */
export function findCascades(read: CascadeRead): Cascade[] {
  const least = Math.max(read.per_minute * CASCADE_HOUR_WORTH, CASCADE_FLOOR);
  const found: Cascade[] = [];
  let open: (Cascade & { venueSet: Set<string> }) | null = null;
  const close = () => {
    if (open && open.long_usd + open.short_usd >= least) {
      const { venueSet, ...cascade } = open;
      found.push({ ...cascade, venues: [...venueSet].sort() });
    }
    open = null;
  };
  // Oldest first, as the query sends them; sorted again so no caller can hand them over otherwise.
  const minutes = [...read.minutes].sort((a, b) => a.minute.getTime() - b.minute.getTime());
  for (const hot of minutes) {
    const at = hot.minute.getTime();
    if (open && at - open.last.getTime() > (CASCADE_GAP_MINUTES + 1) * MINUTE) close();
    if (!open) {
      open = {
        start: hot.minute,
        last: hot.minute,
        minutes: 0,
        long_usd: 0,
        short_usd: 0,
        events: 0,
        venues: [],
        venueSet: new Set(),
      };
    }
    open.last = hot.minute;
    open.minutes = (at - open.start.getTime()) / MINUTE + 1;
    open.long_usd += hot.long_usd;
    open.short_usd += hot.short_usd;
    open.events += hot.events;
    for (const venue of hot.venues.split(",")) if (venue) open.venueSet.add(venue);
  }
  close();
  return found.reverse();
}

/** What the price did around one cascade, as fractions (0.012 is +1.2%); null where it cannot say. */
export interface CascadeReaction {
  /** The last close before the cascade began. */
  before: number | null;
  /** The furthest the price went inside it: the low for a long cascade, the high for a short one. */
  extreme: number | null;
  /** From `before` to `extreme`. */
  into: number | null;
  /** The close of the bar holding the cascade's last minute. */
  end: number | null;
  /**
   * From `end` to the close CASCADE_AFTER minutes after the last minute: "later" until that bar has
   * closed, null when there is no price to read.
   */
  after: (number | "later" | null)[];
}

/** True when more money was closed long than short: forced selling, the price pushed down. */
export const longLed = (cascade: Pick<Cascade, "long_usd" | "short_usd">) =>
  cascade.long_usd >= cascade.short_usd;

/**
 * The price around a cascade from the asset's 5-minute bars, oldest first. A bar's close is its
 * price at `bucket_start + 5 min`; a bar is complete once `now` is past that.
 */
export function cascadeReaction(
  cascade: Cascade,
  bars: readonly CvdBar[],
  now: number,
): CascadeReaction {
  const priced = bars.filter((bar) => bar.price !== null && bar.price > 0);
  const startOf = (bar: CvdBar) => bar.bucket_start.getTime();
  const start = cascade.start.getTime();
  const last = cascade.last.getTime();
  // The last close at or before `at`.
  const closeBy = (at: number): number | null => {
    let found: number | null = null;
    for (const bar of priced) {
      if (startOf(bar) + BAR > at) break;
      found = bar.price;
    }
    return found;
  };
  // The close of the bar holding `at`.
  const closeOfBarAt = (at: number) => closeBy(Math.floor(at / BAR) * BAR + BAR);

  const before = closeBy(start);
  const inside = priced.filter((bar) => startOf(bar) + BAR > start && startOf(bar) <= last);
  const down = longLed(cascade);
  const extreme =
    inside.length === 0
      ? null
      : down
        ? Math.min(
            ...inside.map((bar) =>
              Math.min(bar.low ?? bar.price ?? Infinity, bar.price ?? Infinity),
            ),
          )
        : Math.max(
            ...inside.map((bar) =>
              Math.max(bar.high ?? bar.price ?? -Infinity, bar.price ?? -Infinity),
            ),
          );
  const end = closeOfBarAt(last);
  const change = (from: number | null, to: number | null) =>
    from !== null && to !== null && from > 0 && Number.isFinite(to) ? to / from - 1 : null;
  return {
    before,
    extreme: extreme !== null && Number.isFinite(extreme) ? extreme : null,
    into: change(before, extreme),
    end,
    after: CASCADE_AFTER.map((minutes) => {
      const at = last + minutes * MINUTE;
      const barEnd = Math.floor(at / BAR) * BAR + BAR;
      // Not yet: the bar that answers it is still filling.
      if (barEnd > now) return "later";
      return change(end, closeOfBarAt(at));
    }),
  };
}

/** What the Cascades tab draws: the pace, each cascade with its reaction, and the price's source. */
export interface CascadeView {
  per_minute: number;
  rows: { cascade: Cascade; reaction: CascadeReaction }[];
  /** The market the bars price, or null when the asset has none. */
  price_venue: string | null;
  price_symbol: string | null;
}

export function cascadeView(
  read: CascadeRead,
  found: readonly Cascade[],
  bars: readonly CvdBar[],
  now: number,
): CascadeView {
  const reference = bars.find((bar) => bar.price_venue !== null);
  return {
    per_minute: read.per_minute,
    rows: found.map((cascade) => ({ cascade, reaction: cascadeReaction(cascade, bars, now) })),
    price_venue: reference?.price_venue ?? null,
    price_symbol: reference?.price_symbol ?? null,
  };
}

/**
 * How long a read of bars must reach back to price every cascade: from an hour before the oldest one
 * to now, in whole hours. Zero when there is nothing to price.
 */
export function barHoursFor(found: readonly Cascade[], now: number): number {
  const oldest = found.at(-1);
  return oldest ? Math.ceil((now - oldest.start.getTime()) / 3_600_000) + 1 : 0;
}
