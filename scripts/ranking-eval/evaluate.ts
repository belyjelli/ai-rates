/**
 * Runs the pre-registered ranking evaluation: plans/ranking-evaluation-preregistration.md.
 *
 *   bun scripts/ranking-eval/evaluate.ts picks.csv rates.csv
 *
 * Reads the two CSVs produced by extract-picks.sql and extract-rates.sql (see README.md), evaluates
 * both windows, and prints each variant's figures and the decision. It changes nothing anywhere.
 *
 * It refuses to start before 2026-09-29 06:00Z, when the last held day's fold is complete. There is no
 * override: running early would be looking before the windows close, which the pre-registration exists
 * to prevent.
 */
import { readFileSync } from "node:fs";
import {
  type DailyRate,
  decide,
  EARLIEST_EVALUATION_MS,
  evaluateWindow,
  type Pick,
  VARIANTS,
  type Variant,
  WINDOW_STARTS,
} from "../../packages/core/src/ranking-eval";

/** RFC 4180 CSV, as PostgreSQL's COPY writes it: quoted fields may hold commas, quotes and newlines. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])));
}

const FLAGS: Record<Variant, string> = {
  widest: "chosen_widest",
  settled: "chosen_settled",
  shrunk: "chosen_shrunk",
  hysteresis: "chosen_hysteresis",
  capacity: "chosen_capacity",
};

function main(): void {
  if (Date.now() < EARLIEST_EVALUATION_MS) {
    console.error(
      `refusing to run before ${new Date(EARLIEST_EVALUATION_MS).toISOString()}: the pre-registered windows are not complete`,
    );
    process.exit(2);
  }
  const [picksPath, ratesPath] = process.argv.slice(2);
  if (!picksPath || !ratesPath) {
    console.error("usage: bun scripts/ranking-eval/evaluate.ts picks.csv rates.csv");
    process.exit(2);
  }

  const picks: Pick[] = parseCsv(readFileSync(picksPath, "utf8")).map((r) => ({
    runDay: r.run_day as string,
    assetClass: r.asset_class as string,
    asset: r.asset as string,
    longVenueId: r.long_venue_id as string,
    longSymbol: r.long_symbol as string,
    shortVenueId: r.short_venue_id as string,
    shortSymbol: r.short_symbol as string,
    deployableUsd: Number(r.deployable_usd),
    variants: VARIANTS.filter((v) => r[FLAGS[v]] === "t"),
  }));
  const rates: DailyRate[] = parseCsv(readFileSync(ratesPath, "utf8")).map((r) => ({
    venueId: r.venue_id as string,
    venueSymbol: r.venue_symbol as string,
    day: r.day as string,
    rateSum: r.rate_sum === "" ? Number.NaN : Number(r.rate_sum),
  }));

  const windows = WINDOW_STARTS.map((start) => evaluateWindow(start, picks, rates));
  const usd = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "n/a";

  windows.forEach((window, i) => {
    console.log(`\nW${i + 1}: run days ${window.runDays[0]} to ${window.runDays.at(-1)}`);
    console.log("variant      net/$1M   gross/$1M  turnover  mean capital   missing leg-days");
    for (const variant of VARIANTS) {
      const r = window.variants[variant];
      console.log(
        `${variant.padEnd(11)} ${usd(r.netPerMillion).padStart(9)} ${usd(r.grossPerMillion).padStart(11)}  ${(r.turnover * 100).toFixed(1).padStart(7)}%  ${usd(r.meanDeployedUsd).padStart(12)}   ${r.missingLegDays}`,
      );
    }
  });

  const decision = decide(windows);
  console.log("\nDecision (§6):");
  for (const v of decision.verdicts) {
    console.log(
      `  ${v.variant.padEnd(11)} beats control ${v.beatsControl.join("/")}  turnover ok ${v.turnoverOk.join("/")}  gross ok ${v.grossOk.join("/")}  -> ${v.eligible ? "eligible" : "not eligible"}`,
    );
  }
  console.log(
    decision.winner
      ? `\nWinner: ${decision.winner}. Promote it, and only it, to /carry (design §6 Sprint 3).`
      : "\nNo variant is eligible. Nothing is promoted; report that result as it stands.",
  );
}

main();
