import type { FeeSchedule, VenueFees } from "@ai-rates/core";
import { VENUES, type Venue } from "@ai-rates/venues";

/**
 * The fees a public page may assume, for a reader who has not told us anything about their account.
 *
 * `packages/core/src/fees.ts` deliberately carries no default: fees are per ACCOUNT, and a venue its
 * schedule does not mention is *unknown*, which is not the same as free. That rule is right, and this
 * module does not weaken it — it builds a schedule at the call site from an assumption the page then
 * states in words. The library still refuses to invent a number; the page owns the assumption and
 * shows it, which is what makes the figure honest rather than flattering.
 *
 * Two layers, narrowest first:
 *   1. a venue's published standard taker fee, hand-verified into the catalog (`Venue.takerBps`);
 *   2. otherwise RETAIL_TAKER_BPS, the same figure the homepage hero has always named.
 *
 * Neither layer is a member's real rate. VIP tiers, staking and referral discounts all move it, and a
 * signed-in member's own schedule (plans/member-fee-settings.md) supersedes this entirely once member
 * accounts exist. Until then this is the honest public baseline: stated, uniform, and never silent.
 */
export const RETAIL_TAKER_BPS = 5;

/**
 * Withdrawal costs are not modelled here.
 *
 * `gapCost` reports `transferBps: null` when it has none, and leaves the net computed without it.
 * fees.ts requires anything rendering that net to say the transfer is not counted — so every surface
 * using this schedule carries that sentence.
 */
export function retailSchedule(
  venueIds: Iterable<string>,
  catalog: readonly Venue[] = VENUES,
): FeeSchedule {
  const verified = new Map(
    catalog
      .filter((venue) => typeof venue.takerBps === "number" && Number.isFinite(venue.takerBps))
      .map((venue) => [venue.id, venue.takerBps as number]),
  );
  const schedule: Record<string, VenueFees> = {};
  for (const venueId of venueIds) {
    schedule[venueId] = { takerBps: verified.get(venueId) ?? RETAIL_TAKER_BPS };
  }
  return schedule;
}
