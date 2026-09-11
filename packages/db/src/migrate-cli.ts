import { SQL } from "bun";
import { migrate } from "./migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = new SQL(url);
try {
  const { applied, skipped } = await migrate(sql);
  console.log(`applied: ${applied.join(", ") || "none"}; already applied: ${skipped.length}`);
} finally {
  await sql.close();
}
