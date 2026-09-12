/** The part of a tier that decides whether a size belongs to it. */
export interface TierBounds {
  lowerNotionalUsd: number;
  upperNotionalUsd: number | null;
}

/**
 * The tier a position of `sizeUsd` falls into, or null when no tier covers it.
 *
 * Bounds are half-open `[lower, upper)`, so a size sitting exactly on a boundary belongs to the
 * higher tier, which is how the venues apply them. Order-independent, so a ladder does not have to
 * arrive sorted.
 *
 * A size above every tier returns null rather than the top tier. Where the venue publishes a cap
 * that size cannot be opened at all, and quoting the top tier's margin would imply it could.
 *
 * Generic over the row shape so a caller holding database rows can use the one implementation of
 * the half-open rule rather than restating it.
 */
export function tierForSize<T extends TierBounds>(tiers: readonly T[], sizeUsd: number): T | null {
  return (
    tiers.find(
      (tier) =>
        sizeUsd >= tier.lowerNotionalUsd &&
        (tier.upperNotionalUsd === null || sizeUsd < tier.upperNotionalUsd),
    ) ?? null
  );
}

/**
 * What a delta-neutral pair ties up. Both legs are open at once on different exchanges and margin
 * independently, so each posts its own initial margin against the same notional.
 *
 * This is the one definition of the formula. Earlier revisions used `max(imr_long, imr_short)`,
 * which is a single leg's margin and halves the true figure.
 */
export function pairCapitalUsd(sizeUsd: number, longImr: number, shortImr: number): number {
  return sizeUsd * (longImr + shortImr);
}
