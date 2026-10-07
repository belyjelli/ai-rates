/**
 * Rows each side of the mark in the modeled pending strip, one percent each.
 *
 * The model itself is the collector's (collector/internal/store/pending.go, migration 027): it states
 * every assumption and writes one row per asset. The page only draws what it reads, so nothing here
 * computes a figure.
 */
export const PENDING_ROWS = 10;
