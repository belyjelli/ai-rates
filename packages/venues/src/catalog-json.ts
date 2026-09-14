import { VENUES } from "./catalog";

/**
 * The slice of the catalog the Go collector reads, as the exact text of packages/venues/catalog.json.
 *
 * Go cannot import this package, and it needs three things from it: every venue's name and type for
 * the `venues` rows that every market table references, and the curated `maxLeverage`. A generated file
 * pinned by a test is one authority; a Go copy of the list would be a second one to drift. `retired`
 * travels too, because a retired venue still needs its row.
 *
 * Regenerate with `bun packages/venues/scripts/emit-catalog-json.ts`.
 */
export function catalogJson(): string {
  const venues = VENUES.map(({ id, name, type, maxLeverage, retired }) => ({
    id,
    name,
    type,
    ...(maxLeverage === undefined ? {} : { maxLeverage }),
    ...(retired === undefined ? {} : { retired }),
  }));
  return `${JSON.stringify(venues, null, 2)}\n`;
}
