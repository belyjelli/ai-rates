import type { LiquidationFeedRow, VenueStatus } from "../app/data";
import { ageText, esc, formatUsd, since } from "./format";
import { venueName } from "./venues";

/**
 * Which venues publish forced closes, which were proven not to, and what each feed has actually
 * stored today.
 *
 * WHY A TABLE OF NEGATIVES, and not only of what works. "gate and okx" was the whole liquidation
 * story for five days because nobody had written down which other venues had been tried; the same
 * sentence then had to be corrected in three places when the fleet grew. A venue that publishes
 * nothing is a finding, it cost a 20-minute probe to establish, and it is the first thing a reader
 * asks when a venue they trade on is missing from /liquidations.
 *
 * EVERY VERDICT CARRIES ITS EVIDENCE AND ITS DATE, for the same reason the rest of the site quotes
 * measurements rather than adjectives: "no feed" that cannot be re-run is an opinion. Each negative
 * below was measured with a CONTROL channel on the same socket -- a channel known to push -- so a
 * quiet market and a host that sends us nothing are distinguishable, which is exactly the mistake
 * the htx bug made on 2026-09-18 (connected, subscribed, delivering nothing, reported healthy).
 */

export type FeedVerdict = "live" | "none" | "unresolved" | "partial";

export interface FeedEntry {
  venueId: string;
  verdict: FeedVerdict;
  /** How it is read, for a venue we ingest. Empty for one we do not. */
  transport: string;
  /** The measurement, in one line. Shown in the table, so it stays short and concrete. */
  evidence: string;
}

/** Measured 2026-09-18 from hklab and from a development machine; see commit 727d489 and 154faf1. */
export const FEEDS: readonly FeedEntry[] = [
  {
    venueId: "okx",
    verdict: "live",
    transport: "socket + REST",
    evidence: "liquidation-orders, one topic for every swap; 4.5 events/min measured",
  },
  {
    venueId: "binance",
    verdict: "live",
    transport: "socket",
    evidence: "!forceOrder@arr; 2.7/min. One order per symbol per second is the venue's own cap",
  },
  {
    venueId: "bybit",
    verdict: "live",
    transport: "socket",
    evidence: "allLiquidation per symbol, 805 topics over 5 frames; 2.2/min",
  },
  {
    venueId: "gate",
    verdict: "live",
    transport: "REST",
    evidence:
      "Its socket works too, but the two shapes differ in time precision, so one is read to avoid storing a close twice",
  },
  {
    venueId: "htx",
    verdict: "live",
    transport: "socket",
    evidence: "public.*.liquidation_orders, wildcard, unauthenticated; 0.23/min",
  },
  {
    venueId: "aster",
    verdict: "live",
    transport: "socket",
    evidence: "binance-shaped forced-order stream on its own host; 0.08/min",
  },
  {
    venueId: "dydx",
    verdict: "live",
    transport: "REST",
    evidence:
      "Public trades carry type LIQUIDATED, with months of history: a cold sweep read back to April",
  },
  {
    venueId: "bitget",
    verdict: "none",
    transport: "",
    evidence:
      "Its liquidation channel acked all 790 USDT-futures symbols with no error, then pushed nothing in 22 min while the control delivered 2,247 trades",
  },
  {
    venueId: "mexc",
    verdict: "none",
    transport: "",
    evidence:
      "No liquidation channel answers at all; only the trade stream acked, 1,624 control messages. REST is 403 from our region",
  },
  {
    venueId: "bingx",
    verdict: "none",
    transport: "",
    evidence:
      "12 liquidation channel spellings rejected with 'dataType not support' while its trade channel was accepted; REST says the endpoint does not exist",
  },
  {
    venueId: "kucoin",
    verdict: "none",
    transport: "",
    evidence:
      "Every liquidation topic answers '404 topic does not exist'; its execution feed works",
  },
  {
    venueId: "hyperliquid",
    verdict: "none",
    transport: "",
    evidence:
      "No liquidations subscription exists, and its trades carry no marker: 550 inspected, and the zero-hash lead was chased and disproved",
  },
  {
    venueId: "backpack",
    verdict: "none",
    transport: "",
    evidence: "liquidation streams rejected as an invalid stream; its trade stream works",
  },
  {
    venueId: "pacifica",
    verdict: "none",
    transport: "",
    evidence: "648 trades delivered, with no type, cause or event field on any of them",
  },
  {
    venueId: "paradex",
    verdict: "unresolved",
    transport: "",
    evidence:
      "Its trades carry a trade_type, but only FILL and RPI occurred in 24 min; the documented LIQUIDATION value was never seen",
  },
  {
    venueId: "lighter",
    verdict: "partial",
    transport: "",
    evidence:
      "Its trades do mark liquidations and carry a ready-made USD size, but only long closes were ever observed, so the short side is unmapped",
  },
];

const VERDICT_TITLE: Record<FeedVerdict, string> = {
  live: "Ingested: forced closes from this venue land in the table",
  none: "Probed with a control channel on the same socket, and it publishes nothing",
  unresolved: "The venue documents a liquidation marker that never occurred while we watched",
  partial: "Enough is published to see liquidations, but not enough to map them safely",
};

/** Feeds first, and within them the busiest, then the venues that publish nothing. */
const VERDICT_ORDER: FeedVerdict[] = ["live", "partial", "unresolved", "none"];

/**
 * How a live feed is doing right now.
 *
 * SILENCE IS NOT A FAULT HERE, which is the opposite of the collector table's rule. Measured rates
 * run from 4.5 events a minute (okx) to one every twelve minutes (aster), so an hour with nothing
 * is an ordinary hour on the thin feeds. What IS a fault is the feed's own run health: a socket that
 * connects, is dropped and reconnects forever reports through the venue row the feed writes under
 * `<venue>:liq`, and that is what colours this column.
 */
export function feedState(
  entry: FeedEntry,
  row: LiquidationFeedRow | undefined,
  health: VenueStatus | undefined,
  now: number,
): { state: string; title: string } {
  if (entry.verdict !== "live") {
    return { state: entry.verdict, title: VERDICT_TITLE[entry.verdict] };
  }
  if (health?.last_error) {
    return { state: "failing", title: health.last_error };
  }
  if (!row || row.events_24h === 0) {
    return {
      state: "silent",
      title: "Connected, but nothing has been stored in 24 hours — check this one",
    };
  }
  const age = row.last_at ? now - row.last_at.getTime() : Number.POSITIVE_INFINITY;
  // Six hours: longer than any gap the thinnest measured feed (one event every 12 minutes) should
  // produce, and short enough that a feed the venue has stopped serving surfaces the same day.
  if (age > 6 * 3_600_000) {
    return { state: "quiet", title: `Last forced close ${ageText(row.last_at, now)}` };
  }
  return { state: "live", title: VERDICT_TITLE.live };
}

export function liquidationFeedTable(data: {
  feeds: LiquidationFeedRow[] | null;
  venues: VenueStatus[];
  now: number;
}): string {
  const { feeds, venues, now } = data;
  const byVenue = new Map((feeds ?? []).map((row) => [row.venue_id, row]));
  const byHealth = new Map(venues.map((venue) => [venue.venue_id, venue]));

  const ranked = [...FEEDS].sort(
    (a, b) =>
      VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict) ||
      (byVenue.get(b.venueId)?.events_24h ?? 0) - (byVenue.get(a.venueId)?.events_24h ?? 0) ||
      venueName(a.venueId).localeCompare(venueName(b.venueId)),
  );

  const body = ranked
    .map((entry) => {
      const row = byVenue.get(entry.venueId);
      const health = byHealth.get(`${entry.venueId}:liq`);
      const { state, title } = feedState(entry, row, health, now);
      const longs =
        row && row.events_24h > 0
          ? `${Math.round((row.longs_24h / row.events_24h) * 100)}%`
          : '<span class="dim">–</span>';
      return `<tr data-k="${esc(entry.venueId)}">
<td><div class="leg"><a class="venue" href="/markets/${esc(entry.venueId)}">${esc(venueName(entry.venueId))}</a><span class="meta">${esc(entry.transport || "no public feed")}</span></div></td>
<td><span class="st st-${state}" title="${esc(title)}">${state}</span></td>
<td class="num">${row ? row.events_24h.toLocaleString("en-US") : '<span class="dim">–</span>'}</td>
<td class="num dim">${row ? row.events_1h.toLocaleString("en-US") : ""}</td>
<td class="num">${row ? formatUsd(row.notional_24h) : '<span class="dim">–</span>'}</td>
<td class="num dim">${row ? row.markets_24h.toLocaleString("en-US") : ""}</td>
<td class="num">${longs}</td>
<td class="dim">${row?.last_at ? since(row.last_at, now) : "never"}</td>
<td class="feed-why">${esc(entry.evidence)}</td>
</tr>`;
    })
    .join("");

  const live = FEEDS.filter((feed) => feed.verdict === "live").length;
  const none = FEEDS.filter((feed) => feed.verdict === "none").length;
  const events = (feeds ?? []).reduce((sum, row) => sum + row.events_24h, 0);

  return `<h2>Liquidation feeds</h2>
<p class="lede">Which exchanges publish forced closes, and which were tested and publish none. Every venue here was probed with a <b>control channel on the same connection</b> — a channel known to be pushing — so a quiet market and a venue that sends us nothing are different findings. Silence in the count below is not a fault by itself: the measured rates run from 4.5 a minute to one every twelve minutes. A feed that connects and is repeatedly dropped is a fault, and reports as one.</p>
<p class="facts" data-live="liqfeed-facts"><span><b>${live}</b> feeds ingested</span><span><b>${none}</b> publish nothing</span><span><b>${events.toLocaleString("en-US")}</b> forced closes in 24h</span></p>
${
  feeds === null
    ? '<p class="notes">The liquidation table could not be read, so the counts below are missing rather than zero.</p>'
    : ""
}
<div class="sheet-wrap"><table class="sheet">
<thead><tr><th>Exchange</th><th>Feed</th><th class="num">24h</th><th class="num" title="Forced closes stored in the last hour">1h</th><th class="num" title="Notional of the last 24 hours, where the venue's size could be converted to dollars">Money</th><th class="num" title="Distinct markets that liquidated in the last 24 hours">Markets</th><th class="num" title="Share of the last 24 hours that closed a long position">Longs</th><th>Last close</th><th>Evidence</th></tr></thead>
<tbody data-live="liqfeeds">${body}</tbody>
</table></div>
<p class="notes">Rates were measured on 2026-09-18 over 20–24 minutes per venue. A venue publishing nothing today may publish tomorrow; these verdicts are dated, not permanent.</p>`;
}
