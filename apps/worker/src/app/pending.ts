/**
 * Rows each side of the mark in the modeled pending strip, one percent each.
 *
 * The model itself is the collector's (collector/internal/store/pending.go, migration 027): it states
 * every assumption and writes one row per asset. The page only draws what it reads, so nothing here
 * computes a figure.
 */
export const PENDING_ROWS = 10;

/**
 * Percent per row above and below the mark, by zoom. "near" is ±10% in 1% rows. "wide" is the
 * zoomed-out view, ±50% in 5% rows. Until 2026-10-29 it ran from half the mark to double it, 10% rows
 * above and 5% below, which drew the shorts about twice as heavy as the same longs; rows are equal
 * both ways now. These must match the collector's binning (pendingWideBelowPct / pendingWideAbovePct).
 */
export const PENDING_ZOOMS = {
  near: { above: 1, below: 1 },
  wide: { above: 5, below: 5 },
} as const;

export type PendingZoom = keyof typeof PENDING_ZOOMS;
