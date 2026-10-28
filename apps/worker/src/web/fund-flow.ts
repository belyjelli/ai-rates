import type { AssetClass } from "@ai-rates/core";
import { FUND_WINDOWS, FUTURES_TAKER_VENUES, SPOT_TAKER_VENUES } from "../app/data";
import { esc } from "./format";
import { tr } from "./i18n";
import { icon } from "./icons";
import { venueName } from "./venues";

/** Where the panel reads its figures: one asset's windows as JSON, kept a minute at the edge. */
export const FUND_FLOW_PATH = "/data/fund-flow";

/** A window's name in the first column: 5m, 1H, 1D, as valuescan's tables write them. */
export function windowLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${minutes / 60}H`;
  return `${minutes / 1440}D`;
}

function table(side: "spot" | "futures", title: string, source: string): string {
  const rows = FUND_WINDOWS.map(
    (m) =>
      `<tr data-m="${m}"><th scope="row">${windowLabel(m)}</th><td data-c="in">–</td><td data-c="out">–</td><td data-c="net">–</td><td data-c="chg">–</td><td data-c="cap">–</td></tr>`,
  ).join("");
  return `<section class="cvd-fund-side" data-side="${side}">
<h3>${title} <small class="dim">${source}</small></h3>
<p class="cvd-fund-none dim" hidden>${side === "spot" ? tr("No spot book for this asset on the collected exchanges.") : tr("No futures flow for this asset yet.")}</p>
<div class="cvd-fund-scroll"><table class="cvd-fund-table">
<thead><tr><th scope="col">${tr("Time")}</th><th scope="col" title="${esc(tr("Taker buys in the window, in dollars"))}">${tr("Inflow ($)")}</th><th scope="col" title="${esc(tr("Taker sells in the window, in dollars"))}">${tr("Outflow ($)")}</th><th scope="col" title="${esc(tr("Inflow less outflow"))}">${tr("Net inflow ($)")}</th><th scope="col" title="${esc(tr("Net inflow against the window of the same length before it"))}">${tr("Net inflow change")}</th><th scope="col" title="${esc(tr("Net inflow as a share of the asset's market cap"))}">${tr("F/M cap ratio")}</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>
</section>`;
}

/**
 * The fund-flow dropdown beside the Chart page's asset picker: spot and futures taker flow over every
 * window from 5 minutes to 30 days, as two tables. The markup carries every label and an empty cell
 * for each figure; FUND_SCRIPT reads FUND_FLOW_PATH when it is first opened (and again after a minute)
 * and fills the cells, so a page view that never opens it costs no query.
 */
export function fundPanel(asset: string, assetClass: AssetClass): string {
  const src = `${FUND_FLOW_PATH}?asset=${encodeURIComponent(asset)}&class=${assetClass}`;
  const spot =
    assetClass === "crypto"
      ? table(
          "spot",
          tr("Spot fund"),
          tr("Spot books on {venues}", { venues: SPOT_TAKER_VENUES.map(venueName).join(", ") }),
        )
      : "";
  const futures = table(
    "futures",
    tr("Futures fund"),
    tr("Perpetuals on {venues}", { venues: FUTURES_TAKER_VENUES.map(venueName).join(", ") }),
  );
  return `<details class="cvd-fund" data-fund="${esc(src)}">
<summary class="wh-pick-btn cvd-fund-btn">${icon("swap")}<b>${tr("Fund flow")}</b></summary>
<div class="cvd-fund-panel" role="region" aria-label="${esc(tr("Fund flow"))}" aria-busy="true">
<div class="cvd-fund-grid">${spot}${futures}</div>
<p class="cvd-fund-note dim">${tr("Inflow is taker buying and outflow taker selling, summed over each window back from the newest bucket every venue has published. Net inflow change compares the net with the window of the same length before it. F/M cap ratio is the net as a share of the asset's market cap (CoinGecko). A dash means the history does not reach back that far yet.")} <span data-fund-asof data-tf="hm" data-label="${esc(tr("Up to"))}"></span></p>
</div>
</details>`;
}

/**
 * Fills the open panel. Delegated, because CVD_SWITCH_SCRIPT replaces <main> when another asset is
 * picked; a new panel has an empty cache and reads its own asset. Closes on a click outside or Escape.
 */
export const FUND_SCRIPT = `(() => {
  const AGE = 60000;
  const usd = (v, signed) => {
    if (v === null || v === undefined) return "–";
    const a = Math.abs(v);
    const [d, s] = a >= 1e9 ? [1e9, "B"] : a >= 1e6 ? [1e6, "M"] : a >= 1e3 ? [1e3, "K"] : [1, ""];
    const t = (a / d).toFixed(2) + s;
    return (v < 0 ? "-" : signed && v > 0 ? "+" : "") + t;
  };
  const pct = (v) => (v === null ? "–" : (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(v).toFixed(2) + "%");
  // A share of market cap is often tiny: 0.000028% is written 0.0₄28% (four zeros after the point).
  const SUB = "₀₁₂₃₄₅₆₇₈₉";
  const tiny = (v) => {
    if (v === null) return "–";
    const a = Math.abs(v);
    const sign = v > 0 ? "+" : v < 0 ? "-" : "";
    if (a === 0) return "0%";
    if (a >= 0.01) return sign + a.toPrecision(2).replace(/^(\\d+\\.\\d*?)0+$/, "$1").replace(/\\.$/, "") + "%";
    const zeros = Math.floor(-Math.log10(a));
    const digits = Math.round(a * Math.pow(10, zeros + 2)).toString().slice(0, 2);
    if (zeros < 3) return sign + "0." + "0".repeat(zeros) + digits + "%";
    return sign + "0.0" + String(zeros).split("").map((c) => SUB[c]).join("") + digits + "%";
  };
  const tone = (td, v) => {
    td.classList.toggle("up", v !== null && v > 0);
    td.classList.toggle("down", v !== null && v < 0);
  };
  const fill = (panel, side, rows, cap) => {
    const box = panel.querySelector('[data-side="' + side + '"]');
    if (!box) return;
    const none = !rows || rows.every((r) => r.inflow === null);
    box.querySelector(".cvd-fund-none").hidden = !none;
    box.querySelector(".cvd-fund-scroll").hidden = none;
    if (none) return;
    for (const r of rows) {
      const tr = box.querySelector('tr[data-m="' + r.minutes + '"]');
      if (!tr) continue;
      const net = r.inflow === null ? null : r.inflow - r.outflow;
      const chg = net === null || r.prev_net === null || r.prev_net === 0 ? null : ((net - r.prev_net) / Math.abs(r.prev_net)) * 100;
      const ratio = net === null || !cap ? null : (net / cap) * 100;
      const cell = (c) => tr.querySelector('[data-c="' + c + '"]');
      cell("in").textContent = usd(r.inflow);
      cell("out").textContent = usd(r.outflow);
      cell("net").textContent = usd(net, true);
      tone(cell("net"), net);
      cell("chg").textContent = pct(chg);
      tone(cell("chg"), chg);
      cell("cap").textContent = tiny(ratio);
      tone(cell("cap"), ratio);
    }
  };
  const load = async (pick) => {
    const now = Date.now();
    if (pick._fundAt && now - pick._fundAt < AGE) return;
    pick._fundAt = now;
    const panel = pick.querySelector(".cvd-fund-panel");
    try {
      const res = await fetch(pick.dataset.fund, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      fill(panel, "spot", data.spot, data.market_cap_usd);
      fill(panel, "futures", data.futures, data.market_cap_usd);
      const asof = panel.querySelector("[data-fund-asof]");
      if (asof && data.end) {
        // A <time> the page's clock script writes in the reader's zone, as every time on the site.
        const ms = new Date(data.end).getTime();
        const t = document.createElement("time");
        t.dataset.t = String(ms);
        t.dataset.tf = asof.dataset.tf;
        t.dateTime = new Date(ms).toISOString();
        t.textContent = new Date(ms).toISOString().slice(11, 16) + " UTC";
        asof.replaceChildren(asof.dataset.label + " ", t);
      }
    } catch (_) {
      pick._fundAt = 0;
    }
    panel.removeAttribute("aria-busy");
  };
  document.addEventListener("toggle", (e) => {
    const pick = e.target;
    if (pick.matches && pick.matches(".cvd-fund") && pick.open) load(pick);
  }, true);
  document.addEventListener("click", (e) => {
    for (const pick of document.querySelectorAll(".cvd-fund[open]")) if (!pick.contains(e.target)) pick.open = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const pick = e.target.closest && e.target.closest(".cvd-fund[open]");
    if (pick) { pick.open = false; pick.querySelector("summary").focus(); }
  });
})();`;

/** The dropdown's own styles: two tables side by side, one over the other on a narrow screen. */
export const FUND_CSS = `.wh-controls:has(.cvd-fund){position:relative}.cvd-fund{position:static}
.cvd-fund-btn{min-width:0;align-items:center}
.cvd-fund-btn .ico{color:var(--muted)}
.cvd-fund-btn b{font-size:13px}
.cvd-fund[open] .cvd-fund-btn{border-color:var(--muted)}
.cvd-fund-panel{position:absolute;z-index:20;top:calc(100% + 4px);left:0;width:min(1240px,calc(100vw - 20px));max-height:min(78vh,720px);overflow:auto;padding:10px 12px;border:1px solid var(--muted);background:var(--bg);box-shadow:0 8px 24px rgba(0,0,0,.6)}
.cvd-fund-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
.cvd-fund-side h3{margin:0 0 6px;font-size:13px}
.cvd-fund-side h3 small{font-weight:normal;font-size:11px}
.cvd-fund-scroll{overflow-x:auto}
.cvd-fund-table{width:100%;border-collapse:collapse;font:12px var(--mono);font-variant-numeric:tabular-nums}
.cvd-fund-table th,.cvd-fund-table td{padding:5px 6px;text-align:right;white-space:nowrap;border-top:1px solid var(--rule)}
.cvd-fund-table thead th{color:var(--dim);font-weight:normal;font-size:10px;letter-spacing:.04em;text-transform:uppercase;border-top:0;background:var(--band)}
.cvd-fund-table th[scope=row],.cvd-fund-table thead th:first-child{text-align:left;color:var(--muted)}
.cvd-fund-table tbody tr:nth-child(even){background:var(--panel)}
/* The window's name stays put while a narrow table scrolls sideways. */
.cvd-fund-table th:first-child{position:sticky;left:0;background:var(--bg)}
.cvd-fund-table thead th:first-child{background:var(--band)}
.cvd-fund-table tbody tr:nth-child(even) th{background:var(--panel)}
.cvd-fund-table td.up{color:var(--long)}.cvd-fund-table td.down{color:var(--short)}
.cvd-fund-panel[aria-busy] td{color:var(--dim)}
.cvd-fund-note{margin:10px 0 0;font-size:11px;line-height:1.5;max-width:110ch}
@media (max-width:1100px){.cvd-fund-grid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:640px){.cvd-fund{flex:1 1 100%}.cvd-fund-panel{width:calc(100vw - 20px)}}`;
