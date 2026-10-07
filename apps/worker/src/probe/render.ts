import type { Venue } from "@ai-rates/venues";
import { helpHeading } from "../web/help";
import { layout } from "../web/layout";
import type { Verdict } from "./classify";
import type { StoredRun } from "./execute";
import type { ProbeResult } from "./runner";

export interface RunnerSnapshot {
  /**
   * Only what the page prints. Described here rather than imported from runners.ts, which leans on
   * Worker-only globals (Env, DurableObjectLocationHint) that the test build does not load.
   */
  runner: { name: string; description: string };
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

  // The site's own layout, so the brand, the nav and the clock sit exactly where they do on every
  // other page. The page stays English and unindexed (the route sends noindex), and it reads no
  // database, so the layout is given no overview and its status line stays empty.
  return layout({
    title: "Venue geo-probe",
    description: "Which Cloudflare locations can reach each venue's public API.",
    path: "/probe",
    now,
    body: `${helpHeading(
      "h1",
      "Venue geo-probe",
      "probe",
      `<p>Which Cloudflare locations can reach each venue's public API. Hover a cell for per-endpoint detail.</p><p>Reachability, not data: a venue can answer here and still return no markets.</p>`,
    )}
<div class="probe-controls"><button id="run" type="button">Run probes now</button><span id="msg" class="dim"></span></div>
<style>${PROBE_CSS}</style>
<div class="probe-wrap">
<table class="probe">
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
</script>`,
  });
}

/**
 * The grid's own styles, scoped under .probe so nothing leaks into the site's: sticky venue column
 * and header, banded rows, and verdicts in the site's tokens, so green reads healthy here exactly as
 * it does everywhere else. Shipped with this page only.
 */
const PROBE_CSS = `
.probe-controls{display:flex;align-items:baseline;gap:12px;margin:0 0 10px}
.probe-controls button{font:700 12px var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--bg);background:var(--ink);border:1px solid var(--ink);padding:2px 10px;cursor:pointer}
.probe-controls button:hover{background:var(--accent);border-color:var(--accent)}
.probe-wrap{overflow:auto;max-height:calc(100vh - 170px);border:1px solid var(--rule)}
.probe{border-collapse:collapse;width:auto;min-width:100%}
.probe th,.probe td{padding:2px 8px;text-align:left;white-space:nowrap}
.probe th{position:sticky;top:0;z-index:2;background:var(--bg);font-weight:400;text-transform:lowercase;color:var(--muted);border-bottom:1px solid var(--rule);vertical-align:bottom}
.probe td.venue,.probe th:first-child{position:sticky;left:0;z-index:3;background:var(--bg)}
.probe thead th:first-child{z-index:4}
.probe tbody tr:nth-child(4n+3),.probe tbody tr:nth-child(4n+4),.probe tbody tr:nth-child(4n+3) td.venue,.probe tbody tr:nth-child(4n+4) td.venue{background:#0e0e0e}
.probe tbody tr:hover td{background:#161616}
.probe th>div:first-child{color:var(--ink)}
.probe .sub{color:var(--dim)}
.probe .type{display:inline-block;width:38px;color:var(--dim);text-transform:uppercase}
.probe .unverified{color:var(--warn)}
.probe .cell{cursor:help}
.probe .n{color:var(--dim)}
.probe .v-ok{color:var(--accent)}
.probe .v-geo_blocked{color:var(--short);font-weight:700}
.probe .v-waf_challenge{color:var(--warn);font-weight:700}
.probe .v-rate_limited{color:var(--warn)}
.probe .v-timeout,.probe .v-network_error{color:var(--muted)}
.probe .v-http_error,.probe .v-not_found,.probe .v-bad_body{color:var(--long)}
.probe .v-unconfigured,.probe .none{color:var(--dim)}
`;

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
