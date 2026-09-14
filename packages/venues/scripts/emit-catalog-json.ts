/**
 * Writes packages/venues/catalog.json, the catalog slice the Go collector reads.
 *
 *   bun packages/venues/scripts/emit-catalog-json.ts
 *
 * Run it after changing a venue's id, name, type, maxLeverage or retired field; catalog.test.ts fails
 * until you do.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalogJson } from "../src/catalog-json";

const path = join(import.meta.dir, "..", "catalog.json");
writeFileSync(path, catalogJson());
console.log(`wrote ${path}`);
