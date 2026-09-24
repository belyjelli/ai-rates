import type { Overview } from "../app/data";
import { BUILD } from "../build-info";
import { AWAIT_SCRIPT } from "./await";
import { esc, sentimentTone, since } from "./format";
import { LIVE_SCRIPT } from "./live";
import { SHARE_BAR, SHARE_CSS, SHARE_SCRIPT } from "./share";
import { TAB_SCRIPT } from "./tabs";

const NAV = [
  { href: "/", label: "spreads", match: (p: string) => p === "/" },
  { href: "/screener", label: "screener", match: (p: string) => p === "/screener" },
  { href: "/rates", label: "rates", match: (p: string) => p === "/rates" },
  { href: "/arbitrage", label: "arbitrage", match: (p: string) => p === "/arbitrage" },
  // startsWith, like /markets: an asset's priced grid lives under the same address and must keep
  // the nav item lit rather than reading as a page outside the site.
  {
    href: "/liquidations",
    label: "liquidations",
    match: (p: string) => p.startsWith("/liquidations"),
  },
  { href: "/cvd", label: "cvd", match: (p: string) => p.startsWith("/cvd") },
  { href: "/markets", label: "exchanges", match: (p: string) => p.startsWith("/markets") },
];

/**
 * The member area, which lives on its own subdomain and is not served by this Worker.
 *
 * Labelled "login" in the footer because that is where it actually lands: measured 2026-09-16,
 * `member.airrates.net/` answers 303 to `/member` and settles on `/member/login`. It is the one
 * off-origin link in the footer, so it opens in a new tab with rel="noopener" — a reader who is
 * mid-screener keeps their filters rather than losing them to an auth redirect.
 */
const MEMBER_URL = "https://member.airrates.net/";

/**
 * Google Analytics 4 for airrates.net, first thing in <head> as Google asks. The member area on its
 * own subdomain reports to a separate property (G-16FWXNVQ9C), so the two audiences stay apart.
 * The share and cite dialogs report their clicks through the same tag (share.ts).
 */
const GA_ID = "G-XCSJH74QFF";
export const GA_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${GA_ID}');
</script>`;

/** Hotkeys shown in the status bar. They are advertised, so they are implemented. */
const KEYS: [string, string, string][] = [
  ["h", "spreads", "/"],
  ["s", "screener", "/screener"],
  ["r", "rates", "/rates"],
  ["a", "arbitrage", "/arbitrage"],
  ["l", "liquidations", "/liquidations"],
  ["c", "cvd", "/cvd"],
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
:root{--mast:45px;--bg:#000;--band:#0e0e0e;--panel:#0a0a0a;--ink:#d8d8d8;--muted:#7a7a7a;--dim:#494949;--rule:#242424;
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
/* The nav row scrolls sideways instead of clipping. .bar's overflow:hidden cut it at the viewport, and
   at 390px wide that left "cvd" half drawn and "exchanges" unreachable: a destination a phone reader
   could not get to at all. No visible scrollbar, since the row is one line and a swipe is the gesture. */
.bar2{overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.bar2::-webkit-scrollbar{display:none}
.mast nav{display:flex;gap:2px;flex-shrink:0}
.mast nav a{border:0;color:var(--muted);text-transform:uppercase;padding:0 6px}
.mast nav a[aria-current=page]{background:var(--ink);color:var(--bg)}
.mast nav a:hover{color:var(--accent)}
.status{margin-left:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--muted)}
.status.stale{color:var(--warn)}
/* The header's fear/greed badge, and the same tones used on /sentiment's headline and chart. */
.sent-badge{flex-shrink:0;border:1px solid var(--rule);padding:0 6px;text-transform:uppercase;letter-spacing:.04em;font-weight:700}
.sent-badge:hover{border-color:var(--accent)}
.sent-long{color:var(--long)}
.sent-short{color:var(--short)}
.sent-ink{color:var(--ink)}
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
/* A verified headline is what a pair paid, not a gap between rates: toned as the pair page's headline is. */
.hero-spread.up{color:var(--long)}
.hero-spread span{display:block;color:var(--muted);font-size:12px;font-weight:400;text-align:right;margin-top:4px}
/* The big rail hangs its "0%" label 16px below itself (.rail-big .rail-zero::after), so the bottom
   margin has to clear that label or it lands in the legs row; the asset page's rail had the same fix. */
.hero .rail-big{margin:18px 0 26px}
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
/* A long sheet scrolls with the page, and its header row sticks under the masthead. It used to scroll
   inside a box of its own, which gave every wheel two scrollbars to move. The wrapper takes no
   overflow at all: any overflow, even overflow-x alone, makes it a scroll container, and sticky would
   bind to it instead of the page. It grows to the table's width instead, so a table wider than the
   screen scrolls the page sideways with its border still around it. --mast is the masthead's height,
   measured by the page script. The inset shadow stands in for the border a collapsed table scrolls away. */
.sheet-wrap.stick{overflow:visible;width:max-content;min-width:100%}
.sheet-wrap.stick th{position:sticky;top:var(--mast);z-index:2;background:var(--bg);border-bottom:0;box-shadow:inset 0 -1px 0 var(--rule)}
/* The heatmap is a wide matrix, so it sizes to its content rather than the 100% table.sheet uses.
   Like .sheet-wrap.stick above, it scrolls with the page rather than in a box of its own: the header
   row sticks under the masthead, the asset column sticks to the left edge, and a grid wider than the
   screen scrolls the page sideways. No overflow on the wrapper, for the reason given there. */
.heat-wrap{border:1px solid var(--rule);width:max-content;min-width:100%}
/* A grid wider than the screen widens the page, so the page scrolls sideways. Only the grid should move:
   on pages holding one, the page and its main column grow to the grid's width, and everything outside
   the grid (masthead, title, controls, pager, footer) sticks to the left edge at the viewport's width.
   Sticky rather than a scroll box around the grid, so the column header still sticks under the masthead
   on the one page scroll; --vw is the viewport width without its scrollbar, set by the script below. */
body:has(.heat-wrap,.sheet-wrap.stick){width:max-content;min-width:100%}
body:has(.heat-wrap,.sheet-wrap.stick) .mast,body:has(.heat-wrap,.sheet-wrap.stick) footer{position:sticky;left:0;width:var(--vw,100vw);box-sizing:border-box}
body:has(.heat-wrap,.sheet-wrap.stick) .mast{top:0}
body:has(.heat-wrap,.sheet-wrap.stick) main.wrap{max-width:none;margin:0;width:max-content;min-width:100%;box-sizing:border-box}
body:has(.heat-wrap,.sheet-wrap.stick) main.wrap>:not(.heat-wrap):not(.sheet-wrap){position:sticky;left:10px;max-width:calc(var(--vw,100vw) - 20px);box-sizing:border-box}
table.heat{border-collapse:collapse;width:auto;min-width:100%}
.heat th{font-weight:400;text-transform:lowercase;letter-spacing:0;color:var(--muted);text-align:right;padding:3px 6px;border-bottom:0;box-shadow:inset 0 -1px 0 var(--rule);white-space:nowrap;position:sticky;top:var(--mast);background:var(--bg);z-index:2}
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
/* Liquidation map. Two panels side by side, one per venue, on shared rows and shared columns --
   the comparison is the page. They stack below 1100px rather than scrolling as one 24-column sheet,
   because a grid you cannot see both halves of is a list. */
.lq-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
/* One panel takes the full width rather than half of a two-column grid: the combined view and a
   single venue are one grid, and half a screen would scroll them for no reason. */
.lq-grid-one{grid-template-columns:1fr}
/* Three feeds or more wrap instead of shrinking past readable: each panel keeps a usable minimum. */
@media (min-width:1101px){.lq-grid{grid-template-columns:repeat(auto-fit,minmax(520px,1fr))}}
.tf-label{color:var(--dim);padding-right:4px}
@media (max-width:1100px){.lq-grid{grid-template-columns:1fr}}
.lq-panel{min-width:0}
.lq-venue{font-size:13px;margin:0 0 2px;font-weight:600}
.lq-sum{color:var(--muted);margin:0 0 6px}
.lq-sum b{color:var(--ink)}
.lq-controls{display:flex;flex-wrap:wrap;gap:16px;align-items:baseline;margin-bottom:10px}
.lq-legend{display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:var(--muted)}
.lq-legend-title{color:var(--dim)}
.lq-key{display:inline-flex;align-items:center;gap:3px}
.lq-key i{width:9px;height:9px;display:inline-block}
.lq-hue{margin-left:6px}
.lq-ink-l{color:var(--long)}
.lq-ink-s{color:var(--short)}
/* Separate borders, so a cell reads as a TILE rather than as part of a sheet. Collapsed borders made
   the grid one continuous wash in which a $95k cell and a $1.7M cell beside it were hard to tell
   apart at a glance, which is the one thing this page exists to do. */
.heat.lq{border-collapse:separate;border-spacing:2px}
.heat.lq td,.heat.lq th{border:0}
/* Six steps, on a LOG scale: the measured cell range is $0 to $12.9M, so even steps would paint one
   cell and leave the rest black. Hue is the side closed -- blue long, red short, the same tokens the
   rest of the site uses -- and a cell that closed as much of each takes the neutral ink. The top two
   steps carry dark text: at this saturation --ink on the fill is the pairing that fails contrast. */
.heat.lq td.lq-l1{background:rgba(95,135,255,.10)}.heat.lq td.lq-l2{background:rgba(95,135,255,.20)}
.heat.lq td.lq-l3{background:rgba(95,135,255,.34)}.heat.lq td.lq-l4{background:rgba(95,135,255,.5)}
.heat.lq td.lq-l5{background:rgba(95,135,255,.72)}.heat.lq td.lq-l6{background:rgba(95,135,255,.95)}
.heat.lq td.lq-s1{background:rgba(255,95,95,.10)}.heat.lq td.lq-s2{background:rgba(255,95,95,.20)}
.heat.lq td.lq-s3{background:rgba(255,95,95,.34)}.heat.lq td.lq-s4{background:rgba(255,95,95,.5)}
.heat.lq td.lq-s5{background:rgba(255,95,95,.72)}.heat.lq td.lq-s6{background:rgba(255,95,95,.95)}
.heat.lq td.lq-b1,.heat.lq td.lq-b2,.heat.lq td.lq-b3{background:rgba(216,216,216,.12)}
.heat.lq td.lq-b4,.heat.lq td.lq-b5{background:rgba(216,216,216,.26)}
.heat.lq td.lq-b6{background:rgba(216,216,216,.42)}
.heat.lq td.lq-l5,.heat.lq td.lq-l6,.heat.lq td.lq-s5,.heat.lq td.lq-s6{color:#0a0a0a}
.heat.lq td.lq-l5 .lq-n,.heat.lq td.lq-l6 .lq-n,.heat.lq td.lq-s5 .lq-n,
.heat.lq td.lq-s6 .lq-n{color:rgba(0,0,0,.62)}
/* A hovered row's cells go black (below), so the dark text of the top two steps turns back to ink
   there; otherwise those values vanish into the black exactly while the reader is looking at them. */
.heat.lq tbody tr:hover td.lq-l5,.heat.lq tbody tr:hover td.lq-l6,
.heat.lq tbody tr:hover td.lq-s5,.heat.lq tbody tr:hover td.lq-s6{color:var(--ink)}
.heat.lq tbody tr:hover td.lq-l5 .lq-n,.heat.lq tbody tr:hover td.lq-l6 .lq-n,
.heat.lq tbody tr:hover td.lq-s5 .lq-n,.heat.lq tbody tr:hover td.lq-s6 .lq-n{color:var(--muted)}
/* The row hover must not repaint the fill: on every other grid the hover IS the only colour, here it
   would erase the reading. An outline says the same thing and keeps the cell's value visible. */
.heat.lq tbody tr:hover td{background:inherit}
.heat.lq tbody tr:hover td.lq-l1,.heat.lq tbody tr:hover td.lq-l2,.heat.lq tbody tr:hover td.lq-l3,
.heat.lq tbody tr:hover td.lq-l4,.heat.lq tbody tr:hover td.lq-l5,.heat.lq tbody tr:hover td.lq-l6,
.heat.lq tbody tr:hover td.lq-s1,.heat.lq tbody tr:hover td.lq-s2,.heat.lq tbody tr:hover td.lq-s3,
.heat.lq tbody tr:hover td.lq-s4,.heat.lq tbody tr:hover td.lq-s5,.heat.lq tbody tr:hover td.lq-s6,
.heat.lq tbody tr:hover td.lq-b1,.heat.lq tbody tr:hover td.lq-b2,.heat.lq tbody tr:hover td.lq-b3,
.heat.lq tbody tr:hover td.lq-b4,.heat.lq tbody tr:hover td.lq-b5,.heat.lq tbody tr:hover td.lq-b6{
box-shadow:inset 0 0 0 1px var(--ink)}
.heat.lq tbody tr:hover th.asset{color:var(--accent)}
/* The mark line: a dotted rule under the band the current price sits in, so a reader can see at a
   glance which liquidations happened above the price and which below. The reference layout this
   grid follows draws the same line, and it is the one row boundary that means something. */
.heat.lq-asset tr.lq-mark td,.heat.lq-asset tr.lq-mark th{border-bottom:1px dashed var(--muted)}
.heat.lq-asset th.asset{color:var(--muted);white-space:nowrap}
/* Longs vs shorts: the panel heading carries the side's colour, because in that view the hue is the
   panel rather than the cell and the heading is what says so. */
.lq-side-long{color:var(--long)}
.lq-side-short{color:var(--short)}
/* Longs vs shorts over time: the funding chart's frame, with bars mirrored around one zero line. */
.lqc .lqc-plot{height:260px}
.lqc-grid{stroke:var(--rule);stroke-width:1;vector-effect:non-scaling-stroke}
.lqc-zero{stroke:var(--muted);stroke-dasharray:none}
.lqc-long{fill:var(--long)}.lqc-short{fill:var(--short)}
.lqc-now .lqc-long,.lqc-now .lqc-short{opacity:.5}
.lqc .fchart-keys span{display:flex;align-items:center;gap:5px;color:var(--muted)}
.lqc .fchart-keys b{color:var(--ink);font-weight:600}
.lqc .fchart-keys i{width:10px;height:10px}
.lqc-key-long{background:var(--long)}.lqc-key-short{background:var(--short)}
.lqc-y,.lqc-x{position:absolute;color:var(--dim);white-space:nowrap;pointer-events:none}
.lqc-y{left:-56px;width:50px;text-align:right;transform:translateY(-50%)}
.lqc-x{top:100%;padding-top:3px;transform:translateX(-50%)}
.lqc-day{color:var(--muted)}
.lqc .fchart-plot{margin-left:56px}
/* CVD: buying is the long colour and selling the short one, the same direction-of-pressure reading
   the liquidation page uses. Price is ink and CVD the accent, so neither can be read as a side. */
.cvd-up{color:var(--long)}.cvd-down{color:var(--short)}
.cvd-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px}
@media (max-width:860px){.cvd-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
.cvd-tile{border:1px solid var(--rule);background:var(--panel);padding:8px 10px}
.cvd-tile .eyebrow{margin-bottom:4px}
.cvd-big{font:700 clamp(22px,3.4vw,32px)/1.1 var(--mono);margin:0 0 4px}
.cvd-flows{font-weight:700;margin:0 0 4px;line-height:1.5}
.cvd-flows a{border:0}
/* Every asset link targets #cvd-chart, which wraps the chart or the note that replaces it. The offset
   keeps the sticky masthead from covering the chart's title when the page jumps there. */
.cvd-anchor{scroll-margin-top:calc(var(--mast) + 8px)}
.cvd-chart .fchart-plot{margin:6px 64px 0 64px}
.cvd-chart .fchart-note{margin-top:22px}
.cvd-chart .cvd-plot{height:260px}
.cvd-chart .cvd-strip{height:90px;margin-top:14px;margin-bottom:22px}
.cvd-grid{stroke:var(--rule);stroke-width:1;vector-effect:non-scaling-stroke}
.cvd-zero{stroke:var(--dim);stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}
.cvd-area{fill:rgba(200,245,168,.07)}
.cvd-line{fill:none;stroke:var(--accent);stroke-width:1.6;vector-effect:non-scaling-stroke}
.cvd-price{fill:none;stroke:var(--ink);stroke-width:1.4;vector-effect:non-scaling-stroke}
.cvd-buy{fill:var(--long)}.cvd-sell{fill:var(--short)}
.cvd-buy.cvd-now,.cvd-sell.cvd-now{opacity:.5}
.cvd-yl,.cvd-yr,.cvd-x{position:absolute;color:var(--dim);white-space:nowrap;pointer-events:none}
.cvd-yl{left:-64px;width:58px;text-align:right;transform:translateY(-50%)}
.cvd-yr{right:-64px;width:58px;text-align:left;transform:translateY(-50%)}
.cvd-x{top:100%;padding-top:3px;transform:translateX(-50%)}
@media (max-width:640px){.cvd-x.x-alt,.lqc-x.x-alt{display:none}}
.cvd-day{color:var(--muted)}
.cvd-chart .fchart-keys span{display:flex;align-items:center;gap:5px;color:var(--muted)}
.cvd-chart .fchart-keys b{font-weight:600}
.cvd-chart .fchart-keys i{display:inline-block;width:12px;height:3px}
.cvd-key-price{background:var(--ink)}.cvd-key-cvd{background:var(--accent)}
.cvd-key-buy{background:var(--long);height:10px!important;width:10px!important}
.cvd-key-sell{background:var(--short);height:10px!important;width:10px!important}
.cvd-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px 16px;margin-top:18px}
.cvd-h2{font-size:13px;margin:0;text-transform:uppercase;letter-spacing:.04em}
.cvd-search{display:flex;gap:6px;align-items:center}
.cvd-search input{font:12px var(--mono);color:var(--ink);background:var(--band);border:1px solid var(--rule);padding:2px 6px;width:160px}
.cvd-search a{color:var(--muted)}
.cvd-table tr.cvd-on td{background:#141a10}
.cvd-table tr.cvd-on .asset a{color:var(--accent)}
.cvd-badge{font-size:11px;font-weight:700;text-transform:uppercase;padding:0 6px;border:1px solid currentColor}
.cvd-badge-bullish{color:var(--long)}.cvd-badge-bearish{color:var(--short)}
/* Slot readout (slot-chart.ts), shared by the CVD and longs-vs-shorts charts. The readout sits in the
   header across the full width, and below desktop width it reserves the two to four lines its longest reading
   wraps to (measured at 1024, 600 and 390px), so the plot below does not jump while a finger scrubs. pan-y leaves vertical scrolling to the
   page and gives a sideways drag to the chart. */
.slot-area{touch-action:pan-y;cursor:crosshair;-webkit-tap-highlight-color:transparent}
.slot-area:focus{outline:0}.slot-area:focus-visible{outline:1px solid var(--accent);outline-offset:2px}
.slot-band{fill:rgba(216,216,216,.08)}
.slot-mark.fchart-cursor{stroke:var(--ink);stroke-dasharray:3 3}
.slot-read{flex-basis:100%;color:var(--muted)}
/* The tooltip beside a mouse cursor (slot-chart.ts). The figure is its positioning box, so it moves
   with the chart when the page scrolls. pointer-events:none keeps it from stealing the hover it shows. */
.lqc,.cvd-chart{position:relative}
.slot-tip{position:absolute;z-index:3;pointer-events:none;padding:5px 8px;background:var(--bg);border:1px solid var(--muted);color:var(--muted);white-space:nowrap;line-height:1.5;box-shadow:0 2px 10px rgba(0,0,0,.6)}
.slot-tip[hidden]{display:none}
.slot-tip div:first-child{color:var(--ink);margin-bottom:2px}
.slot-tip b{font-weight:600;color:var(--ink)}
.slot-tip b.cvd-up,.slot-tip b.lq-ink-l{color:var(--long)}.slot-tip b.cvd-down,.slot-tip b.lq-ink-s{color:var(--short)}
.slot-read b{font-weight:600;color:var(--ink)}
.slot-read b.cvd-up,.slot-read b.lq-ink-l{color:var(--long)}.slot-read b.cvd-down,.slot-read b.lq-ink-s{color:var(--short)}
@media (max-width:1180px){.fchart .slot-read{min-height:2.7em}}
@media (max-width:640px){.fchart .slot-read{min-height:4.05em}}
@media (max-width:420px){.fchart .slot-read{min-height:5.4em}}
/* The row's own total, on the right: with price on the rows, "how much died in this band" is the
   question the grid raises and a reader should not have to add a row up by eye. */
.heat.lq-sides td.lq-rowsum,.heat.lq-sides th.lq-rowsum{border-left:1px solid var(--rule);color:var(--muted)}
.lq-legend i.lq-l1,.lq-legend i.lq-l2,.lq-legend i.lq-l3,.lq-legend i.lq-l4,.lq-legend i.lq-l5,
.lq-legend i.lq-l6{background:rgba(95,135,255,.7)}
.lq-legend i.lq-l1{opacity:.14}.lq-legend i.lq-l2{opacity:.28}.lq-legend i.lq-l3{opacity:.45}
.lq-legend i.lq-l4{opacity:.62}.lq-legend i.lq-l5{opacity:.82}.lq-legend i.lq-l6{opacity:1}
.lq-legend i.lq-s1,.lq-legend i.lq-s2,.lq-legend i.lq-s3,.lq-legend i.lq-s4,.lq-legend i.lq-s5,
.lq-legend i.lq-s6{background:rgba(255,95,95,.7)}
.lq-legend i.lq-s1{opacity:.14}.lq-legend i.lq-s2{opacity:.28}.lq-legend i.lq-s3{opacity:.45}
.lq-legend i.lq-s4{opacity:.62}.lq-legend i.lq-s5{opacity:.82}.lq-legend i.lq-s6{opacity:1}
/* The event count under the money, as the reference design carries its address count: the two
   together are what separate one whale from four hundred small closes. */
.heat.lq td{padding:2px 5px;line-height:1.15}
.heat.lq .lq-n{display:block;color:var(--muted);font-size:10px}
.heat.lq td.none .lq-n{display:none}
.heat.lq th.lq-now{color:var(--warn)}
.heat.lq tr.lq-other td,.heat.lq tr.lq-other th{color:var(--muted)}
.heat.lq tr.lq-total td,.heat.lq tr.lq-total th{border-top:1px solid var(--rule);font-weight:600}
.tf{display:flex;gap:2px;margin:0 0 8px;color:var(--muted)}
.tf a{border:0;color:var(--muted);padding:0 6px}
.tf a[aria-current]{background:var(--ink);color:var(--bg)}
.tf a:hover{color:var(--accent)}
.pager{display:flex;gap:16px;margin-top:10px;color:var(--muted)}
.sheet .asset a{font-weight:700;border:0}
.sheet .asset a:hover{color:var(--accent)}
.gap-pos{color:#00ff88}
.qmix{color:var(--warn);border-bottom:1px dotted var(--warn)}
.cls{margin-left:.4em;font-size:.68em;font-weight:500;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);vertical-align:.12em}
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
/* Collector state. "empty" is deliberately a warning colour, not a neutral one: a venue answering
   cleanly while returning no markets is the fault a pass/fail reading calls healthy.
   No backticks in here: this CSS is a JS template literal, and one would end the string. */
.st{text-transform:uppercase;letter-spacing:.04em}
.st-live{color:var(--accent)}
.st-empty,.st-stale{color:var(--warn)}
.st-failing{color:var(--short)}
.st-silent{color:var(--dim)}
.st-planned{color:var(--dim)}
/* Liquidation-feed states. A feed with nothing to report is not a fault -- the thinnest measured one
   averages a close every twelve minutes -- so "quiet" is dim, while a venue that publishes no feed at
   all is a settled finding rather than a warning. Only "failing" (the socket cycling) is alarming. */
.st-quiet{color:var(--muted)}
.st-none{color:var(--dim)}
.st-partial,.st-unresolved,.st-blocked{color:var(--warn)}
/* The evidence column is prose, so it wraps rather than pushing the table into a horizontal scroll;
   every other cell on the site is a figure and stays on one line. */
.sheet td.feed-why{white-space:normal;min-width:34ch;color:var(--muted)}
/* Price-verification verdicts. "mismatch" gets the alarm colour because it means two different
   assets are sharing one name; "scale" is a real market in different units, which is a correction
   to make rather than a fault; "unverified" is dim because a thin market is not an accusation. */
.vd-mismatch{color:var(--short)}
.vd-scale,.vd-tracks{color:var(--warn)}
.vd-unverified{color:var(--dim)}
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
.actions{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
/* A link button beside a submit button: the same height, so the row reads as one set of buttons. */
.actions a.btn{padding:2px 10px}
button{font:700 12px var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--bg);background:var(--ink);border:1px solid var(--ink);padding:2px 10px;cursor:pointer}
button:hover{background:var(--accent);border-color:var(--accent)}
/* A link that starts a feature rather than continuing a sentence: styled as the form buttons are. */
.cta{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:4px 0 12px}
.cta:empty{display:none}
a.btn{display:inline-block;font:700 12px var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--bg);background:var(--ink);border:1px solid var(--ink);padding:4px 12px;text-decoration:none}
a.btn:hover{color:var(--bg);background:var(--accent);border-color:var(--accent)}
/* A button whose report is being built (await.ts): accent-filled, with a spinner before its label. */
a.btn[aria-busy=true],button[aria-busy=true]{color:var(--bg);background:var(--accent);border-color:var(--accent);cursor:progress;white-space:nowrap}
.spin{display:inline-block;box-sizing:border-box;width:1em;height:1em;margin-right:7px;vertical-align:-.15em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spin{animation:none;border-right-color:currentColor;opacity:.55}}
input[type=checkbox]{accent-color:var(--accent)}
.actions a:not(.btn){color:var(--muted)}
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
.sent-guide{stroke:var(--rule);stroke-width:1;stroke-dasharray:2 3;vector-effect:non-scaling-stroke}
.sent-label{text-transform:uppercase;letter-spacing:.04em;font-size:.5em;vertical-align:middle;color:var(--muted)}
.sent-table{width:100%;border-collapse:collapse;margin:0 0 14px;color:var(--muted)}
.sent-table th{text-align:left;color:var(--dim);text-transform:uppercase;letter-spacing:.04em;font-weight:400;padding:4px 12px 4px 0;border-bottom:1px solid var(--rule)}
.sent-table td{padding:4px 12px 4px 0;border-bottom:1px solid var(--rule);color:var(--ink)}
.sent-table td:first-child{color:var(--muted)}
/* Pair page funding comparison. The plot stretches its SVG to the box, so strokes stay hairline with
   non-scaling-stroke and the axis labels are HTML placed by percentage rather than SVG text. */
.fchart{margin:0 0 12px;padding:8px 10px 6px;border:1px solid var(--rule);background:var(--panel)}
.fchart-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 16px;margin-bottom:8px}
.fchart-title{color:var(--muted)}
.fchart-keys{display:flex;flex-wrap:wrap;gap:2px 12px}
.fchart-keys label{display:flex;align-items:center;gap:5px;color:var(--muted);cursor:pointer}
.fchart-keys input{accent-color:var(--accent);margin:0}
.fchart-keys i{display:inline-block;width:12px;height:2px}
.fchart-plot{position:relative;height:220px;margin:6px 0 20px 48px}
.fchart svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.fchart-grid{stroke:var(--rule);stroke-width:1;vector-effect:non-scaling-stroke}
.fchart-zero{stroke:var(--zero);stroke-dasharray:2 3}
.fchart-line{fill:none;stroke-width:1.2;vector-effect:non-scaling-stroke}
.fchart-line.long{stroke:var(--long);stroke-width:2}.fchart-line.short{stroke:var(--short);stroke-width:2}
.fchart-line.spread{stroke:var(--ink);stroke-width:1;stroke-dasharray:4 3}
.fchart-cursor{stroke:var(--muted);stroke-width:1;vector-effect:non-scaling-stroke}
.fchart .off{display:none}
.fchart-y,.fchart-x{position:absolute;color:var(--dim);white-space:nowrap;pointer-events:none}
.fchart-y{left:-48px;width:42px;text-align:right;transform:translateY(-50%)}
.fchart-x{top:100%;padding-top:3px;transform:translateX(-50%)}
.fchart-read{color:var(--muted);min-height:1.35em}
.fchart-note{color:var(--dim);margin-top:4px;max-width:100ch}
.facts{display:flex;flex-wrap:wrap;gap:4px 24px;color:var(--muted);margin:0 0 14px}
.facts b{font-weight:700;color:var(--ink)}
.notes{margin-top:14px;color:var(--muted);max-width:100ch;line-height:1.5}
/* Tab section header, ported from Morpheum's TabLayoutHeaderToolBar. The layout is the original's:
   tabs left, actions right, one border under the whole row, and an absolute 1px indicator that the
   script slides. Colours are airrates' own tokens rather than the other system's, so the control
   reads as part of this terminal instead of a transplant from another one. */
.tabbar{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:1px solid var(--rule);margin:14px 0 10px}
.tabbar-tabs{position:relative;display:flex;gap:0;overflow-x:auto;scrollbar-width:none}
.tabbar-tabs::-webkit-scrollbar{display:none}
.btn-tab{display:flex;align-items:center;gap:6px;cursor:pointer;padding:5px 10px;border:0;border-bottom:1px solid transparent;background:transparent;font:700 12px/1.35 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);white-space:nowrap;transition:color .12s,background .12s}
.btn-tab:hover{background:var(--band);color:var(--ink)}
/* Underlined even before the script runs, so a reader with no JavaScript still sees which section
   is which. .tabbar-tabs--js clears it the moment the sliding indicator takes over. */
.btn-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.tabbar-tabs--js .btn-tab.active{border-bottom-color:transparent}
.tab-badge{font-weight:400;color:var(--warn)}
.tab-underline{position:absolute;bottom:0;left:0;height:1px;background:var(--accent);pointer-events:none;opacity:0;transform:translateX(0);transition:transform .18s,width .18s,opacity .12s;will-change:transform,width}
.tabbar-actions{display:flex;align-items:center;gap:12px;color:var(--muted);white-space:nowrap}
.tab-label--short{display:none}
[hidden]{display:none}
/* The original's own fallback: no sliding, a static underline instead. */
@media (prefers-reduced-motion:reduce){.tabbar-tabs--js .btn-tab.active{border-bottom-color:var(--accent)}.tab-underline{display:none}}
@media (max-width:560px){.tab-label--full{display:none}.tab-label--short{display:inline}}
footer{border-top:1px solid var(--rule);margin-top:24px;padding:8px 0 24px;color:var(--dim);line-height:1.6}
footer .sig{display:flex;justify-content:space-between;gap:16px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
/* About page: the changelog reads as prose, so it gets a measure and some line height. */
.about-log{display:grid;gap:16px;max-width:96ch;margin-top:6px}
.about-log h2{margin:0 0 6px}
.about-log ul{margin:0;padding-left:18px;line-height:1.5}
.about-log li+li{margin-top:4px}
/* Reduced motion: a still outline in place of the live-refresh fade, cleared on the next refresh. */
.chg{outline:1px solid var(--muted);outline-offset:-1px}.chg-up{outline-color:#00ff88}.chg-down{outline-color:#ff4757}
/* The hotkey legend needs ~1,190px beside the nav since cvd joined it; below that it was clipped
   mid-word ("lliquidations"), so it goes rather than half-shows. The keys still work. */
@media (max-width:1240px){.keys{display:none}}
@media (max-width:860px){.status{font-size:11px}.legs .short{text-align:left}}
`;

// Live "… ago" and countdowns, a UTC clock, and the hotkeys advertised in the status bar.
const SCRIPT = `(()=>{const m=document.querySelector(".mast"),ms=()=>{const d=document.documentElement;d.style.setProperty("--vw",d.clientWidth+"px");m&&d.style.setProperty("--mast",m.offsetHeight+"px")};ms();addEventListener("resize",ms);const p=n=>String(n).padStart(2,"0");const f=s=>{s=Math.max(0,Math.round(s));return s<60?s+"s":s<3600?Math.floor(s/60)+"m":Math.floor(s/3600)+"h "+p(Math.floor(s%3600/60))+"m"};const t=()=>{const n=Date.now();for(const e of document.querySelectorAll("[data-since]"))e.textContent=f((n-e.dataset.since)/1e3)+" ago";for(const e of document.querySelectorAll("[data-until]")){const d=(e.dataset.until-n)/1e3;e.textContent=d>0?f(d):"settling"}const c=document.getElementById("clock");if(c){const d=new Date();c.textContent=p(d.getUTCHours())+":"+p(d.getUTCMinutes())+":"+p(d.getUTCSeconds())+" UTC"}};t();setInterval(t,1e3);addEventListener("keydown",e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;const n=e.target&&e.target.tagName;if(n==="INPUT"||n==="SELECT"||n==="TEXTAREA")return;if(e.key==="/"){const q=document.querySelector("form.filters select,form.filters input,form.cvd-search input[type=search]");if(q){e.preventDefault();q.focus()}return}const g=${HOTKEY_TARGETS}[e.key];if(g){e.preventDefault();location.href=g}})})();`;

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
  const sentimentBadge =
    overview && overview.sentiment_score !== null
      ? `<a class="sent-badge sent-${sentimentTone(overview.sentiment_score)}" href="/sentiment" title="Fear &amp; greed: click for the chart">${overview.sentiment_score.toFixed(0)} ${esc(overview.sentiment_label ?? "")}</a>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
${GA_TAG}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · airrates</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📟</text></svg>">
<meta name="description" content="${esc(description)}">
<style>${CSS}${SHARE_CSS}</style>
</head>
<body data-rendered="${now}" data-build="${esc(BUILD.commit ?? "")}">
<header class="mast">
<div class="wrap bar"><a class="brand" href="/">airrates<small>funding carry sheet</small></a><span class="status" data-live="status">${status}</span>${sentimentBadge}${SHARE_BAR}<time class="clock" id="clock">--:--:-- UTC</time></div>
<div class="wrap bar bar2"><nav aria-label="Main">${nav}</nav><span class="keys">${keys}<span><b>/</b>filter</span></span></div>
</header>
<main class="wrap">${body}</main>
<footer><div class="wrap">
<p class="sig"><span>read only · public venue APIs</span><span><a href="${MEMBER_URL}" target="_blank" rel="noopener">login</a> · <a href="/status">status</a> · <a href="/probe">geo-probe</a> · <a href="/about">about</a> · <a href="/referrals">referral links</a> · <a href="/legal">legal &amp; privacy</a> · <a href="/tos">terms</a></span><span>airrates</span></p>
<p>Funding rates come from each venue's public API and refresh every minute. They are estimates for each venue's next settlement and change before it. Spreads are before trading fees, slippage and price moves.</p>
<p>Not financial advice. Data may be delayed or inaccurate. Not affiliated with or endorsed by any exchange.</p>
</div></footer>
<script>${SCRIPT}</script>
<script>${LIVE_SCRIPT}</script>
<script>${AWAIT_SCRIPT}</script>
<script>${TAB_SCRIPT}</script>
<script>${SHARE_SCRIPT}</script>
</body>
</html>`;
}
