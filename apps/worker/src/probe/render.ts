import type { Venue } from "@ai-rates/venues";
import type { Verdict } from "./classify";
import type { StoredRun } from "./execute";
import type { ProbeResult } from "./runner";
import type { RunnerDef } from "./runners";

export interface RunnerSnapshot {
  runner: RunnerDef;
  run: StoredRun | null;
}

const SEVERITY: Record<Verdict, number> = {
  ok: 0,
  unconfigured: 1,
  bad_body: 2,
  not_found: 3,
  http_error: 4,
  network_error: 5,
  timeout: 6,
  rate_limited: 7,
  waf_challenge: 8,
  geo_blocked: 9,
};

export function renderProbePage(
  venues: readonly Venue[],
  snapshots: readonly RunnerSnapshot[],
  now: number,
): string {
  const header = snapshots
    .map(({ runner, run }) => {
      const where = run ? `${run.trace.colo ?? "?"} · ${run.trace.loc ?? "?"}` : "no run yet";
      const when = run ? ago(now - run.finishedAt) : "";
      const okCount = run ? run.results.filter((r) => r.verdict === "ok").length : 0;
      const summary = run ? `${okCount}/${run.results.length} ok` : "";
      return `<th title="${esc(runner.description)}"><div>${esc(runner.name)}</div><div class="sub">${esc(where)}<br>${esc(when)} ${esc(summary)}</div></th>`;
    })
    .join("");

  const rows = venues
    .map((venue) => {
      const cells = snapshots.map(({ run }) =>
        cell(run?.results.filter((r) => r.venueId === venue.id)),
      );
      const flag = venue.verified
        ? ""
        : ` <span class="unverified" title="Endpoints not verified">?</span>`;
      return `<tr><td class="venue"><span class="type">${venue.type}</span>${esc(venue.name)}${flag}</td>${cells.join("")}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>ai-rates · venue geo-probe</title>
<style>
  :root { color-scheme: dark; --bg:#0b0d10; --panel:#12161b; --line:#232a33; --text:#d8dee6; --dim:#7b8794; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
  header { padding:20px 24px 12px; display:flex; gap:16px; align-items:baseline; flex-wrap:wrap; }
  h1 { font-size:16px; margin:0; font-weight:600; }
  p { margin:0; color:var(--dim); }
  button { background:var(--panel); color:var(--text); border:1px solid var(--line); border-radius:6px; padding:6px 10px; font:inherit; cursor:pointer; }
  .wrap { overflow-x:auto; padding:0 24px 24px; }
  table { border-collapse:collapse; min-width:100%; }
  th, td { border-bottom:1px solid var(--line); padding:6px 10px; text-align:left; white-space:nowrap; }
  th { position:sticky; top:0; background:var(--bg); font-weight:600; vertical-align:bottom; }
  .sub { color:var(--dim); font-weight:400; font-size:11px; }
  .type { display:inline-block; width:38px; color:var(--dim); text-transform:uppercase; font-size:10px; }
  .unverified { color:#d7a54a; }
  .cell { cursor:help; }
  .n { color:var(--dim); font-size:11px; }
  .v-ok { color:#4cc38a; }
  .v-geo_blocked { color:#ff6369; font-weight:600; }
  .v-waf_challenge { color:#ff9f43; font-weight:600; }
  .v-rate_limited { color:#f5d90a; }
  .v-timeout, .v-network_error { color:#a8b3bf; }
  .v-http_error, .v-not_found, .v-bad_body { color:#b69cff; }
  .v-unconfigured, .none { color:#4a5563; }
</style>
</head>
<body>
<header>
  <h1>Venue geo-probe</h1>
  <p>Which Cloudflare locations can reach each venue's public API. Hover a cell for per-endpoint detail.</p>
  <button id="run" type="button">Run hinted probes now</button>
  <span id="msg" class="sub"></span>
</header>
<div class="wrap">
<table>
<thead><tr><th>Venue</th>${header}</tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
<script>
  document.getElementById("run").addEventListener("click", async () => {
    const msg = document.getElementById("msg");
    const res = await fetch("/v1/probe/run", { method: "POST" });
    msg.textContent = res.ok ? "Scheduled. Results appear in a minute or two; reload." : "Cooldown active, try again later.";
  });
</script>
</body>
</html>`;
}

function cell(results: readonly ProbeResult[] | undefined): string {
  if (!results || results.length === 0) return `<td class="none">–</td>`;
  const worst = results.reduce((a, b) => (SEVERITY[b.verdict] > SEVERITY[a.verdict] ? b : a));
  const okCount = results.filter((r) => r.verdict === "ok").length;
  const title = results
    .map((r) => {
      const parts = [`${r.label}: ${r.verdict}`];
      if (r.status !== null) parts.push(String(r.status));
      if (r.latencyMs !== null) parts.push(`${r.latencyMs}ms`);
      if (r.detail) parts.push(`— ${r.detail}`);
      return parts.join(" ");
    })
    .join("\n");
  const label = worst.verdict.replace("_", " ");
  return `<td class="cell v-${worst.verdict}" title="${esc(title)}">${esc(label)} <span class="n">${okCount}/${results.length}</span></td>`;
}

function ago(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
