import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { SQL } from "bun";

export const MIGRATIONS_DIR = join(import.meta.dir, "..", "migrations");

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/** Applies `migrations/*.sql` in filename order, each in its own transaction, recording them in schema_migrations. */
export async function migrate(sql: SQL, dir = MIGRATIONS_DIR): Promise<MigrationResult> {
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const done = new Set(
    (await sql`SELECT version FROM schema_migrations`).map(
      (row: { version: string }) => row.version,
    ),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const result: MigrationResult = { applied: [], skipped: [] };

  for (const file of files) {
    if (done.has(file)) {
      result.skipped.push(file);
      continue;
    }
    const text = await Bun.file(join(dir, file)).text();
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`INSERT INTO schema_migrations (version) VALUES (${file})`;
    });
    result.applied.push(file);
  }
  return result;
}
