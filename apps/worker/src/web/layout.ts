import type { Overview } from "../app/data";
import { esc, since } from "./format";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Martian+Mono:wdth,wght@75..112.5,400..800&family=Public+Sans:wght@400;600&family=Red+Hat+Mono:wght@400;500&display=swap";

const NAV = [
  { href: "/", label: "Spreads", match: (p: string) => p === "/" },
  { href: "/screener", label: "Screener", match: (p: string) => p === "/screener" },
  { href: "/markets", label: "Exchanges", match: (p: string) => p.startsWith("/markets") },
];

// Green-bar printout paper: pale bands every two rows help the eye along wide numeric rows.
// Cobalt marks the long leg (longs are paid when funding is negative), oxblood the short leg.
const CSS = `
:root{--paper:#F4F8F3;--band:#E3EFE1;--ink:#17241D;--muted:#5E6E64;--rule:#C6D6C4;--long:#2F4AA0;--short:#A3354A;--zero:#8FA596;
--display:"Martian Mono",ui-monospace,Menlo,monospace;--body:"Public Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--data:"Red Hat Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box}
html{background:var(--paper);color:var(--ink)}
body{margin:0;font:15px/1.5 var(--body);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit;text-decoration-color:var(--rule);text-underline-offset:3px}
a:hover{text-decoration-color:currentColor}
:focus-visible{outline:2px solid var(--long);outline-offset:2px;border-radius:2px}
.wrap{max-width:1280px;margin:0 auto;padding:0 20px}
.mast{border-bottom:1px solid var(--rule)}
.mast .wrap{display:flex;align-items:baseline;gap:8px 28px;padding-top:14px;padding-bottom:12px;flex-wrap:wrap}
.brand{font:800 19px/1 var(--display);font-stretch:87.5%;letter-spacing:-.03em;text-decoration:none}
.brand small{font:400 12px var(--data);letter-spacing:0;color:var(--muted);margin-left:10px}
.mast nav{display:flex;gap:18px}
.mast nav a{font:500 13px var(--data);color:var(--muted);text-decoration:none;padding:2px 0}
.mast nav a[aria-current=page]{color:var(--ink);box-shadow:inset 0 -2px 0 var(--ink)}
.status{margin:0 0 0 auto;font:400 12px var(--data);color:var(--muted)}
main.wrap{padding-top:28px;padding-bottom:56px}
h1{font:700 30px/1.1 var(--display);font-stretch:87.5%;letter-spacing:-.03em;margin:0 0 8px}
h2{font:700 17px/1.2 var(--display);font-stretch:87.5%;letter-spacing:-.02em;margin:0}
p{margin:0}
.lede{color:var(--muted);max-width:72ch;margin:0 0 22px}
.eyebrow{font:500 12px var(--data);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:10px}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin:0 0 12px}
.section-head a{font:500 13px var(--data)}
.hero{padding:6px 0 30px;margin-bottom:30px;border-bottom:1px solid var(--rule)}
.hero-head{display:flex;align-items:flex-end;justify-content:space-between;gap:8px 24px;flex-wrap:wrap}
.hero-asset{font:800 clamp(44px,9vw,104px)/.9 var(--display);font-stretch:75%;letter-spacing:-.05em;text-decoration:none}
.hero-spread{font:700 clamp(30px,5vw,56px)/1 var(--display);font-stretch:87.5%;letter-spacing:-.03em;color:var(--short)}
.hero-spread span{display:block;font:400 12px var(--data);letter-spacing:.04em;color:var(--muted);text-align:right;margin-top:6px}
.hero .rail-big{margin:34px 0 14px}
.legs{display:flex;justify-content:space-between;gap:8px 24px;flex-wrap:wrap;font:400 14px var(--data);margin-bottom:18px}
.legs b{font:600 14px var(--body)}
.legs .long b{color:var(--long)}.legs .short b{color:var(--short)}.legs .short{text-align:right}
.rail{position:relative;display:block;height:18px;min-width:160px}
.rail::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px dashed var(--rule)}
.rail-zero{position:absolute;top:1px;bottom:1px;width:1px;background:var(--zero)}
.rail-bar{position:absolute;top:50%;height:4px;transform:translateY(-50%);background:var(--ink);opacity:.2}
.rail-mark{position:absolute;top:50%;width:9px;height:9px;border-radius:50%;transform:translate(-50%,-50%);background:var(--paper);border:1.5px solid var(--muted)}
.rail-mark.long{background:var(--long);border-color:var(--long)}
.rail-mark.short{background:var(--short);border-color:var(--short)}
.rail-mark.clipped{border-radius:1px}
.rail-big{height:64px}
.rail-big .rail-zero::after{content:"0%";position:absolute;top:100%;left:50%;transform:translateX(-50%);font:400 11px var(--data);color:var(--muted);padding-top:2px}
.rail-big .rail-bar{height:10px;opacity:1;background:linear-gradient(90deg,var(--long),var(--short))}
.rail-big .rail-mark{width:20px;height:20px;border-width:3px;background:var(--paper)}
.rail-big .rail-mark.venue{width:12px;height:12px;border-width:2px}
.sheet-wrap{overflow-x:auto;border:1px solid var(--rule);border-radius:3px}
table.sheet{border-collapse:collapse;width:100%;font:400 13px/1.35 var(--data);font-variant-numeric:tabular-nums}
.sheet th{font:500 11px var(--data);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--rule);white-space:nowrap}
.sheet td{padding:8px 12px;vertical-align:middle;white-space:nowrap}
.sheet tbody tr:nth-child(4n+3),.sheet tbody tr:nth-child(4n+4){background:var(--band)}
.sheet tbody tr:hover{box-shadow:inset 3px 0 0 var(--ink)}
.sheet .num{text-align:right}
.sheet .rail-cell{width:22%;min-width:180px}
.sheet .asset a{font:700 14px var(--display);font-stretch:87.5%;text-decoration:none}
.sheet .spread{font:700 15px var(--display);font-stretch:87.5%}
.leg{display:grid;gap:1px}
.leg .venue{font:600 13px var(--body)}
.leg .meta{font-size:12px;color:var(--muted)}
.long-leg .venue{color:var(--long)}.short-leg .venue{color:var(--short)}
.shorts-paid{color:var(--short)}.longs-paid{color:var(--long)}.flat{color:var(--muted)}
.dim{color:var(--muted)}
.empty{padding:28px 16px;color:var(--muted);font:400 14px var(--body)}
form.filters{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-end;margin:0 0 16px;padding:14px 16px;border:1px solid var(--rule);border-radius:3px}
.field{display:grid;gap:5px;font:500 11px var(--data);text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.field select{font:400 14px var(--body);color:var(--ink);background:#fff;border:1px solid var(--rule);border-radius:3px;padding:6px 8px;min-width:120px}
fieldset.field{border:0;margin:0;padding:0;display:grid}
fieldset.field legend{padding:0;margin-bottom:5px}
.checks{display:flex;gap:14px}
.checks label{display:flex;align-items:center;gap:6px;font:400 14px var(--body);text-transform:none;letter-spacing:0;color:var(--ink)}
.actions{display:flex;gap:14px;align-items:center}
button{font:600 14px var(--body);color:var(--paper);background:var(--ink);border:1px solid var(--ink);border-radius:3px;padding:7px 16px;cursor:pointer}
input[type=checkbox]{accent-color:var(--ink)}
.actions a{font:400 13px var(--data);color:var(--muted)}
.headline{font:700 clamp(30px,5vw,52px)/1 var(--display);font-stretch:87.5%;letter-spacing:-.03em;margin:0}
.headline.up{color:var(--long)}.headline.down{color:var(--short)}
.headline+.eyebrow{margin-top:8px}
.pair-legs{display:flex;flex-wrap:wrap;gap:10px 32px;font:400 13px var(--data);margin:0 0 20px}
.pair-legs b{font:600 13px var(--body)}
.pair-legs .long b{color:var(--long)}.pair-legs .short b{color:var(--short)}
.curve{margin:0 0 22px;padding:12px 14px 8px;border:1px solid var(--rule);border-radius:3px;background:#fff}
.curve svg{display:block;width:100%;height:136px}
.curve-area{fill:var(--long);opacity:.12}
.curve.down .curve-area{fill:var(--short)}
.curve-line{fill:none;stroke:var(--long);stroke-width:2;vector-effect:non-scaling-stroke}
.curve.down .curve-line{stroke:var(--short)}
.curve-zero{stroke:var(--zero);stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}
.curve figcaption{font:400 12px var(--data);color:var(--muted);padding-top:8px}
.facts{display:flex;flex-wrap:wrap;gap:6px 28px;font:400 13px var(--data);color:var(--muted);margin:0 0 22px}
.facts b{font-weight:500;color:var(--ink)}
.notes{margin-top:28px;font:400 13px/1.6 var(--body);color:var(--muted);max-width:80ch}
footer{border-top:1px solid var(--rule);padding:18px 0 42px;font:400 12px/1.7 var(--data);color:var(--muted)}
@media (max-width:720px){.status{margin-left:0;width:100%}.legs .short{text-align:left}main{padding-top:20px}}
`;

// Keeps "updated … ago" and funding countdowns live without refetching. Matches formatDuration in format.ts.
const SCRIPT = `(()=>{const f=s=>{s=Math.max(0,Math.round(s));return s<60?s+"s":s<3600?Math.floor(s/60)+"m":Math.floor(s/3600)+"h "+String(Math.floor(s%3600/60)).padStart(2,"0")+"m"};const t=()=>{const n=Date.now();for(const e of document.querySelectorAll("[data-since]"))e.textContent=f((n-e.dataset.since)/1e3)+" ago";for(const e of document.querySelectorAll("[data-until]")){const d=(e.dataset.until-n)/1e3;e.textContent=d>0?f(d):"settling"}};t();setInterval(t,1e3)})();`;

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
  const status =
    overview && overview.markets > 0
      ? `${overview.markets.toLocaleString("en-US")} markets · ${overview.venues} venues · updated ${since(overview.updated_at, now)}`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · airates</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${CSS}</style>
</head>
<body>
<header class="mast"><div class="wrap">
<a class="brand" href="/">airates<small>funding carry sheet</small></a>
<nav aria-label="Main">${nav}</nav>
<p class="status">${status}</p>
</div></header>
<main class="wrap">${body}</main>
<footer><div class="wrap">
<p>Funding rates come from each venue's public API and refresh every minute. They are estimates for each venue's next settlement and change before it. Spreads are before trading fees, slippage and price moves.</p>
<p>Not financial advice. Not affiliated with any exchange.</p>
</div></footer>
<script>${SCRIPT}</script>
</body>
</html>`;
}
