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
  /* Same terminal as the public pages: black ground, one monospace stack, no radius, tight rows.
     Verdicts borrow the site tokens rather than a palette of their own, so green reads healthy
     here exactly as it does everywhere else. */
  :root { color-scheme: dark;
    --bg:#000; --band:#0e0e0e; --ink:#d8d8d8; --muted:#7a7a7a; --dim:#494949; --rule:#242424;
    --long:#5f87ff; --short:#ff5f5f; --accent:#c8f5a8; --warn:#e5e500;
    --mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace; }
  * { box-sizing:border-box; border-radius:0; }
  body { margin:0; background:var(--bg); color:var(--ink); font:12px/1.35 var(--mono);
    font-variant-numeric:tabular-nums; -webkit-font-smoothing:antialiased; }
  header { padding:12px 10px 10px; display:flex; gap:0 16px; align-items:baseline; flex-wrap:wrap; }
  h1 { font:700 15px/1.2 var(--mono); text-transform:uppercase; letter-spacing:.04em; margin:0; }
  p { margin:0; color:var(--muted); max-width:96ch; }
  button { font:700 12px var(--mono); text-transform:uppercase; letter-spacing:.04em;
    color:var(--bg); background:var(--ink); border:1px solid var(--ink); padding:2px 10px; cursor:pointer; }
  button:hover { background:var(--accent); border-color:var(--accent); }
  :focus-visible { outline:1px solid var(--accent); outline-offset:1px; }
  .wrap { overflow:auto; max-height:calc(100vh - 110px); margin:0 10px 24px; border:1px solid var(--rule); }
  table { border-collapse:collapse; width:auto; min-width:100%; }
  th, td { padding:2px 8px; text-align:left; white-space:nowrap; }
  th { position:sticky; top:0; z-index:2; background:var(--bg); font-weight:400;
    text-transform:lowercase; letter-spacing:0; color:var(--muted);
    border-bottom:1px solid var(--rule); vertical-align:bottom; }
  td.venue, th:first-child { position:sticky; left:0; z-index:3; background:var(--bg); }
  thead th:first-child { z-index:4; }
  tbody tr:nth-child(4n+3), tbody tr:nth-child(4n+4) { background:var(--band); }
  tbody tr:nth-child(4n+3) td.venue, tbody tr:nth-child(4n+4) td.venue { background:var(--band); }
  tbody tr:hover td, tbody tr:hover td.venue { background:#161616; }
  th > div:first-child { color:var(--ink); }
  .sub { color:var(--dim); }
  #msg { color:var(--muted); }
  .type { display:inline-block; width:38px; color:var(--dim); text-transform:uppercase; }
  .unverified { color:var(--warn); }
  .cell { cursor:help; }
  .n { color:var(--dim); }
  .v-ok { color:var(--accent); }
  .v-geo_blocked { color:var(--short); font-weight:700; }
  .v-waf_challenge { color:var(--warn); font-weight:700; }
  .v-rate_limited { color:var(--warn); }
  .v-timeout, .v-network_error { color:var(--muted); }
  .v-http_error, .v-not_found, .v-bad_body { color:var(--long); }
  .v-unconfigured, .none { color:var(--dim); }
</style>
</head>
<body>
<header>
  <h1>Venue geo-probe</h1>
  <p>Which Cloudflare locations can reach each venue's public API. Hover a cell for per-endpoint detail.</p>
  <button id="run" type="button">Run probes now</button>
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
