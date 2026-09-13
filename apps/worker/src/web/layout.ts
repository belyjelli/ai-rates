import type { Overview } from "../app/data";
import { esc, since } from "./format";
import { LIVE_SCRIPT } from "./live";

const NAV = [
  { href: "/", label: "spreads", match: (p: string) => p === "/" },
  { href: "/screener", label: "screener", match: (p: string) => p === "/screener" },
  { href: "/rates", label: "rates", match: (p: string) => p === "/rates" },
  { href: "/arbitrage", label: "arbitrage", match: (p: string) => p === "/arbitrage" },
  { href: "/markets", label: "exchanges", match: (p: string) => p.startsWith("/markets") },
];

/** Hotkeys shown in the status bar. They are advertised, so they are implemented. */
const KEYS: [string, string, string][] = [
  ["h", "spreads", "/"],
  ["s", "screener", "/screener"],
  ["r", "rates", "/rates"],
  ["a", "arbitrage", "/arbitrage"],
  ["e", "exchanges", "/markets"],
];

/**
 * The key-to-destination map the inline script jumps with, built from KEYS rather than repeated.
 * It used to be written out a second time inside SCRIPT, so a key could be advertised in the
 * status bar and do nothing, or work without being advertised.
 */
const HOTKEY_TARGETS = JSON.stringify(Object.fromEntries(KEYS.map(([key, , href]) => [key, href])));

// A terminal, not a printout: black ground, one monospace stack, no radius anywhere, 12px rows.
// Long stays blue and short stays red as they always were, lifted to values legible on black.
const CSS = `
:root{--bg:#000;--band:#0e0e0e;--panel:#0a0a0a;--ink:#d8d8d8;--muted:#7a7a7a;--dim:#494949;--rule:#242424;
--long:#5f87ff;--short:#ff5f5f;--zero:#494949;--accent:#c8f5a8;--warn:#e5e500;
--mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace;
--display:var(--mono);--body:var(--mono);--data:var(--mono)}
*{box-sizing:border-box;border-radius:0}
html{background:var(--bg);color:var(--ink)}
body{margin:0;font:12px/1.35 var(--mono);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none;border-bottom:1px solid var(--rule)}
a:hover{color:var(--accent);border-bottom-color:var(--accent)}
:focus-visible{outline:1px solid var(--accent);outline-offset:1px}
.wrap{max-width:1600px;margin:0 auto;padding:0 10px}
.mast{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--rule)}
.bar{display:flex;align-items:center;gap:0 16px;height:22px;white-space:nowrap;overflow:hidden}
.bar2{border-top:1px solid var(--rule)}
.brand{font-weight:700;text-transform:uppercase;letter-spacing:.04em;border:0}
.brand small{margin-left:8px;font-weight:400;color:var(--muted);text-transform:none;letter-spacing:0}
.mast nav{display:flex;gap:2px}
.mast nav a{border:0;color:var(--muted);text-transform:uppercase;padding:0 6px}
.mast nav a[aria-current=page]{background:var(--ink);color:var(--bg)}
.mast nav a:hover{color:var(--accent)}
.status{margin-left:auto;color:var(--muted)}
.status.stale{color:var(--warn)}
.clock{color:var(--ink)}
.keys{margin-left:auto;display:flex;gap:12px;color:var(--dim)}
.keys b{margin-right:5px;padding:0 4px;background:var(--dim);color:var(--bg);font-weight:700}
main.wrap{padding-top:12px;padding-bottom:32px}
h1{font:700 15px/1.2 var(--mono);text-transform:uppercase;letter-spacing:.04em;margin:0 0 4px}
h2{font:700 12px/1.2 var(--mono);text-transform:uppercase;letter-spacing:.06em;margin:0}
p{margin:0}
.lede{color:var(--muted);max-width:96ch;margin:0 0 14px}
.eyebrow{color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.eyebrow a{border-bottom-color:var(--dim)}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin:14px 0 6px}
.hero{padding:2px 0 14px;margin-bottom:14px;border-bottom:1px solid var(--rule)}
.hero-head{display:flex;align-items:flex-end;justify-content:space-between;gap:6px 24px;flex-wrap:wrap}
.hero-asset{font:700 clamp(28px,6vw,56px)/1 var(--mono);letter-spacing:-.02em;border:0}
.hero-asset:hover{color:var(--accent)}
.hero-spread{font:700 clamp(20px,4vw,36px)/1 var(--mono);color:var(--short)}
.hero-spread span{display:block;color:var(--muted);font-size:12px;font-weight:400;text-align:right;margin-top:4px}
.hero .rail-big{margin:18px 0 8px}
/* On the asset page the table follows the rail directly, so leave room for the "0%" label to clear it. */
.asset-rail .rail-big{margin:14px 0 30px}
.legs{display:flex;justify-content:space-between;gap:4px 24px;flex-wrap:wrap;margin-bottom:10px}
.legs .long b{color:var(--long)}.legs .short b{color:var(--short)}.legs .short{text-align:right}
.rail{position:relative;display:block;height:14px;min-width:150px}
.rail::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px solid var(--rule)}
.rail-zero{position:absolute;top:2px;bottom:2px;width:1px;background:var(--zero)}
/* Long-to-short gradient, as the hero rail already uses, so the bar reads directionally in the
   table too rather than as one flat block. */
.rail-bar{position:absolute;top:50%;height:3px;transform:translateY(-50%);background:linear-gradient(90deg,var(--long),var(--short))}
.rail-mark{position:absolute;top:50%;width:7px;height:7px;transform:translate(-50%,-50%);background:var(--bg);border:1px solid var(--muted)}
.rail-mark.long{background:var(--long);border-color:var(--long)}
.rail-mark.short{background:var(--short);border-color:var(--short)}
.rail-mark.clipped{width:3px}
.rail-big{height:52px}
.rail-big .rail-zero::after{content:"0%";position:absolute;top:100%;left:50%;transform:translateX(-50%);color:var(--muted);padding-top:2px}
.rail-big .rail-bar{height:6px;background:linear-gradient(90deg,var(--long),var(--short))}
.rail-big .rail-mark{width:14px;height:14px;border-width:2px}
.rail-big .rail-mark.venue{width:8px;height:8px;border-width:1px}
.sheet-wrap{overflow-x:auto;border:1px solid var(--rule)}
table.sheet{border-collapse:collapse;width:100%}
.sheet th{font-weight:400;text-transform:lowercase;letter-spacing:0;color:var(--muted);text-align:left;padding:3px 8px;border-bottom:1px solid var(--rule);white-space:nowrap}
.sheet td{padding:2px 8px;white-space:nowrap}
.sheet tbody tr:nth-child(4n+3),.sheet tbody tr:nth-child(4n+4){background:var(--band)}
.sheet tbody tr:hover{background:#161616}
.sheet .num{text-align:right}
.sheet th a{border:0;color:inherit}
.sheet th a:hover{color:var(--accent)}
.sheet th[aria-sort] a{color:var(--ink)}
.sheet th[aria-sort] a::after{content:" ↓"}
.sheet .rail-cell{width:20%;min-width:170px}
/* A long sheet scrolls inside its own box so its header row can stick. Sticky against the page would
   not work: overflow-x:auto already makes .sheet-wrap a scroll container, the same trap .heat-wrap
   notes below. The inset shadow stands in for the border, which a collapsed table scrolls away. */
.sheet-wrap.stick{overflow:auto;max-height:calc(100vh - 170px)}
.sheet-wrap.stick th{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:0;box-shadow:inset 0 -1px 0 var(--rule)}
/* The heatmap is a wide matrix, so it sizes to its content rather than the 100% table.sheet uses.
   It scrolls on both axes inside its own box: overflow-x alone would coerce overflow-y to auto and
   anchor the sticky header to that box while the page scrolled past it. */
.heat-wrap{overflow:auto;max-height:calc(100vh - 170px);border:1px solid var(--rule)}
table.heat{border-collapse:collapse;width:auto;min-width:100%}
.heat th{font-weight:400;text-transform:lowercase;letter-spacing:0;color:var(--muted);text-align:right;padding:3px 6px;border-bottom:1px solid var(--rule);white-space:nowrap;position:sticky;top:0;background:var(--bg);z-index:2}
.heat td{padding:2px 6px;text-align:right;white-space:nowrap;color:var(--ink)}
.heat th.asset,.heat td.asset{text-align:left;position:sticky;left:0;background:var(--bg);z-index:3}
.heat thead th.asset{z-index:4}
.heat tbody tr:hover td{background:#161616}
.heat td.none{color:var(--dim)}
.heat td.hm-z{color:var(--muted)}
/* Positive funding red, negative blue, matching aprTone on every other page: longs paying is a
   short's gain. Text stays --ink so the darkest tints remain readable. */
.heat td.hm-p1{background:rgba(255,95,95,.08)}.heat td.hm-p2{background:rgba(255,95,95,.16)}
.heat td.hm-p3{background:rgba(255,95,95,.26)}.heat td.hm-p4{background:rgba(255,95,95,.38)}
.heat td.hm-p5{background:rgba(255,95,95,.52)}
.heat td.hm-n1{background:rgba(95,135,255,.08)}.heat td.hm-n2{background:rgba(95,135,255,.16)}
.heat td.hm-n3{background:rgba(95,135,255,.26)}.heat td.hm-n4{background:rgba(95,135,255,.38)}
.heat td.hm-n5{background:rgba(95,135,255,.52)}
.tf{display:flex;gap:2px;margin:0 0 8px;color:var(--muted)}
.tf a{border:0;color:var(--muted);padding:0 6px}
.tf a[aria-current]{background:var(--ink);color:var(--bg)}
.tf a:hover{color:var(--accent)}
.pager{display:flex;gap:16px;margin-top:10px;color:var(--muted)}
.sheet .asset a{font-weight:700;border:0}
.sheet .asset a:hover{color:var(--accent)}
.sheet .spread{font-weight:700}
.leg{display:grid;gap:0}
.leg .venue{border:0}
.leg .meta{color:var(--muted)}
.long-leg .venue{color:var(--long)}.short-leg .venue{color:var(--short)}
/* Buy and sell are a direction of trade, not a funding polarity, so they deliberately do NOT reuse
   --long/--short: on every other page those colours answer "who pays whom". Accent for the side
   money leaves, plain ink for the side it returns to. */
.buy-leg .venue{color:var(--accent)}.sell-leg .venue{color:var(--ink)}
.shorts-paid{color:var(--short)}.longs-paid{color:var(--long)}.flat{color:var(--muted)}
.dim{color:var(--muted)}
.empty{padding:16px 10px;color:var(--muted)}
form.filters{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:flex-end;margin:0 0 10px;padding:8px 10px;border:1px solid var(--rule)}
.field{display:grid;gap:3px;color:var(--muted);text-transform:lowercase}
.field select{font:12px var(--mono);color:var(--ink);background:var(--band);border:1px solid var(--rule);padding:2px 4px;min-width:110px}
/* Fees are typed, not picked: same box as a select so the row still reads as one control strip. */
.field input[type=number]{font:12px var(--mono);color:var(--ink);background:var(--band);border:1px solid var(--rule);padding:2px 4px;width:110px}
.field input[type=number]::placeholder{color:var(--dim)}
fieldset.field{border:0;margin:0;padding:0;display:grid}
fieldset.field legend{padding:0;margin-bottom:3px}
.checks{display:flex;gap:12px}
.checks label{display:flex;align-items:center;gap:5px;color:var(--ink);text-transform:none}
.actions{display:flex;gap:12px;align-items:center}
button{font:700 12px var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--bg);background:var(--ink);border:1px solid var(--ink);padding:2px 10px;cursor:pointer}
button:hover{background:var(--accent);border-color:var(--accent)}
input[type=checkbox]{accent-color:var(--accent)}
.actions a{color:var(--muted)}
.headline{font:700 clamp(24px,5vw,44px)/1 var(--mono);margin:0}
.headline.up{color:var(--long)}.headline.down{color:var(--short)}
.headline+.eyebrow{margin-top:6px}
.pair-legs{display:flex;flex-wrap:wrap;gap:4px 28px;margin:0 0 12px}
.pair-legs .long b{color:var(--long)}.pair-legs .short b{color:var(--short)}
.curve{margin:0 0 12px;padding:8px 10px 4px;border:1px solid var(--rule);background:var(--panel)}
.curve svg{display:block;width:100%;height:120px}
.curve-area{fill:var(--long);opacity:.14}
.curve.down .curve-area{fill:var(--short)}
.curve-line{fill:none;stroke:var(--long);stroke-width:1.5;vector-effect:non-scaling-stroke}
.curve.down .curve-line{stroke:var(--short)}
.curve-zero{stroke:var(--zero);stroke-width:1;stroke-dasharray:2 3;vector-effect:non-scaling-stroke}
.curve figcaption{color:var(--muted);padding-top:6px}
.facts{display:flex;flex-wrap:wrap;gap:4px 24px;color:var(--muted);margin:0 0 14px}
.facts b{font-weight:700;color:var(--ink)}
.notes{margin-top:14px;color:var(--muted);max-width:100ch;line-height:1.5}
footer{border-top:1px solid var(--rule);margin-top:24px;padding:8px 0 24px;color:var(--dim);line-height:1.6}
footer .sig{display:flex;justify-content:space-between;gap:16px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
/* Reduced motion: a still outline in place of the live-refresh fade, cleared on the next refresh. */
.chg{outline:1px solid var(--muted);outline-offset:-1px}.chg-up{outline-color:#00ff88}.chg-down{outline-color:#ff4757}
@media (max-width:860px){.keys{display:none}.status{font-size:11px}.legs .short{text-align:left}}
`;

// Live "… ago" and countdowns, a UTC clock, and the hotkeys advertised in the status bar.
const SCRIPT = `(()=>{const p=n=>String(n).padStart(2,"0");const f=s=>{s=Math.max(0,Math.round(s));return s<60?s+"s":s<3600?Math.floor(s/60)+"m":Math.floor(s/3600)+"h "+p(Math.floor(s%3600/60))+"m"};const t=()=>{const n=Date.now();for(const e of document.querySelectorAll("[data-since]"))e.textContent=f((n-e.dataset.since)/1e3)+" ago";for(const e of document.querySelectorAll("[data-until]")){const d=(e.dataset.until-n)/1e3;e.textContent=d>0?f(d):"settling"}const c=document.getElementById("clock");if(c){const d=new Date();c.textContent=p(d.getUTCHours())+":"+p(d.getUTCMinutes())+":"+p(d.getUTCSeconds())+" UTC"}};t();setInterval(t,1e3);addEventListener("keydown",e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;const n=e.target&&e.target.tagName;if(n==="INPUT"||n==="SELECT"||n==="TEXTAREA")return;if(e.key==="/"){const q=document.querySelector("form.filters select,form.filters input");if(q){e.preventDefault();q.focus()}return}const g=${HOTKEY_TARGETS}[e.key];if(g){e.preventDefault();location.href=g}})})();`;

export function layout(options: {
  title: string;
  description: string;
  path: string;
  body: string;
  overview?: Overview | null;
  now: number;
}): string {
  const { title, description, path, body, overview, now } = options;
  const nav = NAV.map(
    (item) =>
      `<a href="${item.href}"${item.match(path) ? ' aria-current="page"' : ""}>${item.label}</a>`,
  ).join("");
  const keys = KEYS.map(([key, label]) => `<span><b>${key}</b>${label}</span>`).join("");
  const status =
    overview && overview.markets > 0
      ? `${overview.markets.toLocaleString("en-US")} markets · ${overview.venues} venues · updated ${since(overview.updated_at, now)}`
      : "no venue has reported in five minutes";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · airrates</title>
<meta name="description" content="${esc(description)}">
<style>${CSS}</style>
</head>
<body data-rendered="${now}">
<header class="mast">
<div class="wrap bar"><a class="brand" href="/">airrates<small>funding carry sheet</small></a><span class="status" data-live="status">${status}</span><time class="clock" id="clock">--:--:-- UTC</time></div>
<div class="wrap bar bar2"><nav aria-label="Main">${nav}</nav><span class="keys">${keys}<span><b>/</b>filter</span></span></div>
</header>
<main class="wrap">${body}</main>
<footer><div class="wrap">
<p class="sig"><span>read only · public venue APIs</span><span>airrates</span></p>
<p>Funding rates come from each venue's public API and refresh every minute. They are estimates for each venue's next settlement and change before it. Spreads are before trading fees, slippage and price moves.</p>
<p>Not financial advice. Not affiliated with any exchange.</p>
</div></footer>
<script>${SCRIPT}</script>
<script>${LIVE_SCRIPT}</script>
</body>
</html>`;
}
