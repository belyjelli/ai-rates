import type { Overview } from "../app/data";
import { BUILD } from "../build-info";
import { awaitScript } from "./await";
import { durationStrings, esc, sentimentLabel, sentimentTone, since } from "./format";
import { HELP_CSS, HELP_SCRIPT } from "./help";
import { hotkeyLegend, hotkeyScript, keyboardIcon } from "./hotkeys";
import {
  currentLocale,
  htmlLang,
  LOCALE_INFO,
  LOCALES,
  type Locale,
  msg,
  scriptStrings,
  switchHref,
  tr,
  trMsg,
} from "./i18n";
import { ICON_CSS, iconMask } from "./icons";
import { INSTALL_CSS, INSTALL_HEAD } from "./install";
import { LIVE_SCRIPT } from "./live";
import { localTimeScript } from "./localtime";
import { ROW_LINK_SCRIPT } from "./row-link";
import { SHARE_CSS, shareBar, shareScript } from "./share";
import { SHARE_CARD_ALT, SHARE_CARD_HEIGHT, SHARE_CARD_PATH, SHARE_CARD_WIDTH } from "./share-card";
import { TAB_SCRIPT } from "./tabs";
import { WEBMCP_SCRIPT } from "./webmcp";

const NAV = [
  { href: "/", label: msg("spreads"), match: (p: string) => p === "/" },
  { href: "/screener", label: msg("screener"), match: (p: string) => p === "/screener" },
  { href: "/rates", label: msg("rates"), match: (p: string) => p === "/rates" },
  { href: "/arbitrage", label: msg("arbitrage"), match: (p: string) => p === "/arbitrage" },
  // startsWith, like /markets: an asset's priced grid lives under the same address and must keep
  // the nav item lit rather than reading as a page outside the site.
  {
    href: "/liquidations",
    label: msg("liquidations"),
    match: (p: string) => p.startsWith("/liquidations"),
  },
  { href: "/cvd", label: msg("cvd"), match: (p: string) => p.startsWith("/cvd") },
  { href: "/whales", label: msg("whales"), match: (p: string) => p.startsWith("/whales") },
  { href: "/markets", label: msg("exchanges"), match: (p: string) => p.startsWith("/markets") },
];

/**
 * The member area, which lives on its own subdomain and is not served by this Worker.
 *
 * Labelled "login" in the footer because that is where it actually lands: measured 2026-09-16,
 * `member.airrates.net/` answers 303 to `/member` and settles on `/member/login`. It is off-origin,
 * so it opens in a new tab with rel="noopener" — a reader who is mid-screener keeps their filters
 * rather than losing them to an auth redirect.
 */
export const MEMBER_URL = "https://member.airrates.net/";

/** The airrates Telegram group, @airratesnet: off-origin like the member area, so a new tab too. */
export const TELEGRAM_URL = "https://t.me/airratesnet";

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

/** The one origin pages name as their own, so a copy found elsewhere points back here. */
export const SITE_ORIGIN = "https://airrates.net";

/** Open Graph wants a language_TERRITORY locale, not the html lang: zh-Hans is zh_CN to Facebook. */
const OG_LOCALE: Readonly<Record<Locale, string>> = {
  en: "en_US",
  zh: "zh_CN",
  ja: "ja_JP",
  ko: "ko_KR",
  ru: "ru_RU",
};

/** Pages that are a dataset in their own right, for the structured data below. */
const DATASET_PATHS = [
  "/rates",
  "/arbitrage",
  "/cvd",
  "/liquidations",
  "/sentiment",
  "/markets",
  "/whales",
];

/**
 * What a crawler needs to credit the page: its canonical address (the path alone, so ?tf= and ?ref=
 * variants fold into one), social-card tags, and JSON-LD naming the site and its publisher. The
 * data pages also declare a Dataset with this site as creator and a citation line.
 */
function discoverability(title: string, description: string, path: string): string {
  const url = `${SITE_ORIGIN}${path === "/" ? "/" : path.replace(/\/$/, "")}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#site`,
      url: `${SITE_ORIGIN}/`,
      name: "airrates",
      publisher: { "@id": `${SITE_ORIGIN}/#org` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#org`,
      name: "airrates",
      url: `${SITE_ORIGIN}/`,
    },
  ];
  if (DATASET_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    graph.push({
      "@type": "Dataset",
      name: `${title} · airrates`,
      description,
      url,
      creator: { "@id": `${SITE_ORIGIN}/#org` },
      isAccessibleForFree: true,
      citation: `airrates, ${url}`,
    });
  }
  // "<" is escaped so no field can close the script element.
  const ld = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(
    /</g,
    "\\u003c",
  );
  // The card's address is absolute: Facebook and X fetch it from their own servers, not from the page.
  const image = `${SITE_ORIGIN}${SHARE_CARD_PATH}`;
  const locale = currentLocale();
  const alternates = LOCALES.filter((other) => other !== locale)
    .map((other) => `\n<meta property="og:locale:alternate" content="${OG_LOCALE[other]}">`)
    .join("");
  return `<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="airrates">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)} · airrates">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:locale" content="${OG_LOCALE[locale]}">${alternates}
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${SHARE_CARD_WIDTH}">
<meta property="og:image:height" content="${SHARE_CARD_HEIGHT}">
<meta property="og:image:alt" content="${esc(SHARE_CARD_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<meta name="twitter:image:alt" content="${esc(SHARE_CARD_ALT)}">
<script type="application/ld+json">${ld}</script>`;
}

// A terminal, not a printout: black ground, one monospace stack, no radius anywhere, 12px rows.
// Long stays blue and short stays red as they always were, lifted to values legible on black.
const CARET = iconMask("caret");
const SORT_UP = iconMask("up");
const SORT_DOWN = iconMask("down");

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
/* A button (a click flips it to UTC) that must not look like one: the global button rule styles hover too. */
.clock,.clock:hover{color:var(--ink);background:none;border:0;padding:0;font:inherit;letter-spacing:normal;text-transform:none;cursor:pointer}
.keys{margin-left:auto;display:flex;gap:12px;color:var(--dim);border:0}
.keys:hover{color:var(--muted)}
.keys [hidden]{display:none}
.kb-link .kb-icon{margin-right:5px;vertical-align:-2px}
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
/* A row that opens as a whole (row-link.ts) shows it before it is clicked. */
.sheet tbody tr:has(a[data-row-link]){cursor:pointer}
.sheet .num{text-align:right}
.sheet th a{border:0;color:inherit}
.sheet th a:hover{color:var(--accent)}
.sheet th[aria-sort] a{color:var(--ink)}
.sheet th[aria-sort] a::after{content:"";display:inline-block;width:.7em;height:.7em;margin-left:.35em;background:currentColor;-webkit-mask:${SORT_DOWN} center/contain no-repeat;mask:${SORT_DOWN} center/contain no-repeat}
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
   Like .sheet-wrap.stick above, on a wide screen it scrolls with the page rather than in a box of its
   own: the header row sticks under the masthead, the asset column sticks to the left edge, and a grid
   wider than the screen scrolls the page sideways. No overflow on the wrapper, for the reason given
   there. Phones are the exception, below. */
.heat-wrap{border:1px solid var(--rule);width:max-content;min-width:100%}
/* A grid wider than the screen widens the page, so the page scrolls sideways. Only the grid should move:
   on pages holding one, the page and its main column grow to the grid's width, and everything outside
   the grid (masthead, title, controls, pager, footer) sticks to the left edge at the viewport's width.
   Sticky rather than a scroll box around the grid, so the column header still sticks under the masthead
   on the one page scroll; --vw is the viewport width without its scrollbar, set by the script below.
   The screener's sheet does the same.
   Only where there is room for it, though. On a phone a page that is 1,500px wide is a poor thing (the
   rates grid alone is over 3,000px): some browsers shrink it to fit, and the rest pan the masthead, title
   and controls along with the table. Below 861px the sheet and the heatmap each scroll in a box of their
   own instead, both ways, with the header row and the asset column stuck inside the box. */
@media (min-width:861px){
body:has(.heat-wrap,.sheet-wrap.stick){width:max-content;min-width:100%}
body:has(.heat-wrap,.sheet-wrap.stick) .mast,body:has(.heat-wrap,.sheet-wrap.stick) footer{position:sticky;left:0;width:var(--vw,100vw);box-sizing:border-box}
body:has(.heat-wrap,.sheet-wrap.stick) .mast{top:0}
body:has(.heat-wrap,.sheet-wrap.stick) main.wrap{max-width:none;margin:0;width:max-content;min-width:100%;box-sizing:border-box}
body:has(.heat-wrap,.sheet-wrap.stick) main.wrap>:not(.heat-wrap):not(.sheet-wrap){position:sticky;left:10px;max-width:calc(var(--vw,100vw) - 20px);box-sizing:border-box}
}
@media (max-width:860px){
.heat-wrap,.sheet-wrap.stick{overflow:auto;width:auto;min-width:0;max-height:calc(100vh - var(--mast) - 8px);max-height:calc(100dvh - var(--mast) - 8px);-webkit-overflow-scrolling:touch}
/* The heatmap's asset column is stuck at every width (.heat td.asset below); only its header moves to the
   box's top. The extra class outranks .heat th, which comes later. */
.heat-wrap .heat th,.sheet-wrap.stick th{top:0}
.sheet-wrap.stick th:first-child,.sheet-wrap.stick td:first-child{position:sticky;left:0;background:var(--bg)}
.sheet-wrap.stick td:first-child{z-index:1}
.sheet-wrap.stick th:first-child{z-index:3}
.sheet-wrap.stick tbody tr:nth-child(4n+3) td:first-child,.sheet-wrap.stick tbody tr:nth-child(4n+4) td:first-child{background:var(--band)}
.sheet-wrap.stick tbody tr:hover td:first-child{background:#161616}
/* A hairline for the column that stays put, as the grid's collapsed border has scrolled away. */
.sheet-wrap.stick th:first-child,.sheet-wrap.stick td:first-child{box-shadow:inset -1px 0 0 var(--rule)}
.sheet-wrap.stick th:first-child{box-shadow:inset -1px 0 0 var(--rule),inset 0 -1px 0 var(--rule)}
}
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
/* Liquidation panels, one per venue, on shared rows and shared columns -- the comparison is the page.
   Side by side only where two whole grids fit, and stacked otherwise: flex-wrap places each panel at
   its own width, so a pair goes on one line only when both fit there. This was a two-column grid of
   1fr halves, which held a 12-column grid (about 850px) in half of a 1340px screen; the grid spilled
   out of its half and the next venue's panel was drawn on top of its newest columns. The grid's
   container is capped at the viewport (main.wrap's sticky children above), which is what makes the
   wrap happen. A lone panel, or the combined view, grows to the full width. */
.lq-grid{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}
.tf-label{color:var(--dim);padding-right:4px}
.lq-panel{flex:1 1 auto;min-width:0}
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
/* Longs vs shorts: one table, the price column once on the left, longs then shorts. Each half's
   heading spans its columns and carries the side's colour, because in that view the hue is the half
   rather than the cell and the heading is what says so. The heading row scrolls away rather than
   sticking: two sticky header rows would land on the same line under the masthead, and the column row
   below it is the one a reader needs while scrolling. */
.lq-side-long{color:var(--long)}
.lq-side-short{color:var(--short)}
.heat.lq-sides tr.lq-grp th{position:static;text-align:left;text-transform:none;font-weight:600;padding:4px 6px 3px}
.heat.lq-sides tr.lq-grp th.asset{position:sticky;top:auto}
.heat.lq-sides tr.lq-grp th.lq-side-long{box-shadow:inset 0 -2px 0 var(--long)}
.heat.lq-sides tr.lq-grp th.lq-side-short{box-shadow:inset 0 -2px 0 var(--short)}
.heat.lq-sides tr.lq-grp b{color:var(--ink)}
/* The rule between the halves: the short half's first column. */
.heat.lq-sides .lq-split{border-left:2px solid var(--rule)}
/* Two halves of 13 columns run to about 1,530px, wider than a laptop screen, and the table sits in a
   tab panel capped at the viewport, so the page cannot grow sideways around it the way it does for a
   grid that is main's own child: the page scrolled, masthead and chart with it. It scrolls in a box
   of its own instead, the price column stuck inside it. The header then sticks to the box, not under
   the masthead, so its offset is zero; at eleven rows the table never needs it to stick anyway. */
.heat-wrap.lq-box{overflow-x:auto;width:auto;min-width:0}
.heat-wrap.lq-box .heat th{top:0}
/* The Odds tab's two tables are read, not scanned: their row labels and readings are sentences, which
   the no-wrap grid above turned into a column wider than a phone, with the figures off-screen. On a
   phone every cell here wraps. The odds table is half label, half figures: the label column is half the
   screen and stays put, and the four horizons (4 hours to 1 week) scroll sideways beside it, 64px each,
   which is room for a move cell's up and down halves stacked. Half the screen is the box's width, as the
   page's side padding is 10px. The theories table has no horizons, so it wraps to fit and never scrolls.
   A group heading is one cell across every column, so its text sticks instead of the cell. */
@media (max-width:860px){
.heat-wrap.lq-read{max-height:none;border:0}
.heat-wrap.lq-read .heat{table-layout:fixed;width:100%;min-width:0;border-spacing:0}
.heat-wrap.lq-read .heat th,.heat-wrap.lq-read .heat td{position:static;white-space:normal;overflow-wrap:anywhere;padding:3px 4px;vertical-align:top}
.heat-wrap.lq-read .lq-odds{min-width:calc(50vw - 10px + 256px)}
.heat-wrap.lq-read .lq-odds thead th:first-child{width:calc(50vw - 10px)}
.heat-wrap.lq-read .lq-odds th.asset{position:sticky;left:0;z-index:3;background:var(--bg);box-shadow:inset -1px 0 0 var(--rule),inset 0 -1px 0 var(--rule)}
.heat-wrap.lq-read .lq-odds tr.lq-grp th.asset{position:static;box-shadow:inset 0 -1px 0 var(--rule)}
.heat-wrap.lq-read .lq-gt{position:sticky;left:0;display:block;max-width:calc(100vw - 28px)}
.heat-wrap.lq-read .lq-theories thead th:nth-child(1){width:24%}
.heat-wrap.lq-read .lq-theories thead th:nth-child(2){width:34%}
.heat-wrap.lq-read .lq-theories thead th:nth-child(3){width:12%}
.heat-wrap.lq-read .lq-theories td{text-align:left}
.heat-wrap.lq-read .lq-mv{display:block}
.heat-wrap.lq-read .lq-sep{display:none}
}
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
.lqc-body{display:flex;align-items:flex-start}
.lqc-body .lqc-plot{flex:1 1 0;min-width:0}
/* Modeled pending strip: rows are 1% price bands, shorts above the price line, longs below. Same
   height and vertical margins as the plot beside it so zero and the price line meet. */
.lqp{position:relative;flex:0 0 clamp(96px,22%,220px);height:260px;margin:6px 56px 20px 14px;border-left:1px dashed var(--muted)}
.lqp-now{position:absolute;left:8px;top:100%;padding-top:3px;color:var(--ink)}
.lqp-rows{position:relative;height:100%;display:grid;grid-template-rows:repeat(20,minmax(0,1fr));padding-left:6px}
.lqp-row{display:flex;align-items:stretch;padding:1px 0;min-height:0}
.lqp-row i{display:block;box-sizing:border-box;min-width:1px}
.lqp-short{border:1px solid var(--short);background:repeating-linear-gradient(45deg,var(--short) 0 2px,transparent 2px 4px)}
.lqp-long{border:1px solid var(--long);background:repeating-linear-gradient(45deg,var(--long) 0 2px,transparent 2px 4px)}
.lqp-row:hover i{filter:brightness(1.35)}
.lqp-mark{position:absolute;left:0;right:0;top:50%;border-top:1px dashed var(--ink);pointer-events:none}
.lqp-mark b{position:absolute;left:100%;top:0;transform:translateY(-50%);padding-left:6px;color:var(--ink);font-weight:600;white-space:nowrap}
.lqp-y{position:absolute;left:100%;transform:translateY(-50%);padding-left:6px;color:var(--dim);white-space:nowrap;pointer-events:none}
.lqp-cap{position:absolute;left:10px;right:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;text-shadow:0 0 3px var(--bg),0 0 3px var(--bg)}
.lqp-cap-s{top:0;color:var(--short)}.lqp-cap-l{bottom:0;color:var(--long)}
.lqp-x{position:absolute;left:6px;right:0;top:100%;height:0;pointer-events:none}
.lqp-x span{position:absolute;top:4px;transform:translateX(-50%);color:var(--dim);white-space:nowrap}
.lqp-x span:last-child{transform:translateX(-100%)}
.lqp-x span::before{content:"";position:absolute;left:50%;top:-4px;height:3px;border-left:1px solid var(--muted)}
.lqp-x span:last-child::before{left:auto;right:0}
.lqp-key-short,.lqp-key-long{box-sizing:border-box}
.lqp-key-short{border:1px solid var(--short);background:repeating-linear-gradient(45deg,var(--short) 0 2px,transparent 2px 4px)}
.lqp-key-long{border:1px solid var(--long);background:repeating-linear-gradient(45deg,var(--long) 0 2px,transparent 2px 4px)}
.lqc-foot{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;justify-content:space-between;margin-top:6px}
.lqc-foot .tf{margin:0}
/* The range switch sits beside Pending on/off; the note takes the far end. */
.lqc-foot .tf+.tf{margin-right:auto}
.lqc-warn{margin:0;color:var(--warn)}
/* A phone has no room for the strip beside the bars (it would leave them under 100px), so it drops
   underneath at full width with the same rows and the same labels. */
@media (max-width:640px){
.lqc-body{flex-direction:column}
.lqc-body .lqc-plot{flex:none;width:calc(100% - 56px)}
.lqp{flex:none;width:calc(100% - 112px);margin:26px 56px 20px 56px;height:240px}
.lqp-now{left:0;top:-22px;padding:0}
}
/* CVD: buying is the long colour and selling the short one, the same direction-of-pressure reading
   the liquidation page uses. Price is ink and CVD the accent, so neither can be read as a side. */
.cvd-up{color:var(--long)}.cvd-down{color:var(--short)}
/* Whale orders (web/whales.ts): a bid wall is the long colour and an ask wall the short one, as
   everywhere. Candles are ink and dim, so the walls read first; an ended wall fades, a pulled one is
   also dashed. */
.wh-controls{align-items:center;gap:10px 16px}.wh-controls .tf{margin:0}
.wh-pick{position:relative}
.wh-pick-btn{display:flex;gap:10px;align-items:baseline;cursor:pointer;list-style:none;padding:5px 10px;border:1px solid var(--rule);background:var(--panel);min-width:220px}
.wh-pick-btn::-webkit-details-marker{display:none}
.wh-pick-btn::after{content:"";width:10px;height:10px;flex-shrink:0;background:var(--muted);-webkit-mask:${CARET} center/contain no-repeat;mask:${CARET} center/contain no-repeat;margin-left:auto}
.wh-pick[open] .wh-pick-btn,.wh-pick-btn:hover{border-color:var(--muted)}
.wh-pick-btn b{font-size:15px;color:var(--ink)}
.wh-pick-more{font-size:11px}
.wh-pick-panel{position:absolute;z-index:20;top:calc(100% + 4px);left:0;width:min(720px,calc(100vw - 20px));max-height:min(70vh,560px);display:flex;flex-direction:column;border:1px solid var(--muted);background:var(--bg);box-shadow:0 8px 24px rgba(0,0,0,.6)}
.wh-pick-q{margin:8px;padding:5px 8px;font:13px var(--mono);color:var(--ink);background:var(--band);border:1px solid var(--rule)}
.wh-pick-q:focus{outline:none;border-color:var(--accent)}
.wh-pick-head,.wh-pick-row{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) 70px minmax(0,1.8fr) minmax(0,1fr);gap:10px;align-items:center;padding:4px 10px}
.wh-pick-head{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--rule)}
.wh-pick-list{overflow-y:auto}
.wh-pick-row{border:0;color:var(--ink);min-height:34px}
.wh-pick-row:hover,.wh-pick-row:focus{background:var(--band);outline:none}
.wh-pick-row.on{background:var(--band);box-shadow:inset 2px 0 0 var(--accent)}
.wh-pick-row[hidden]{display:none}
.wh-pick-sym{display:flex;gap:6px;align-items:baseline;min-width:0;white-space:nowrap;overflow:hidden}
.wh-pick-sym .dim{width:1.6em;text-align:right;font-size:10px}
.wh-pick-sym small{color:var(--muted);font-size:10px}
.wh-pick-book{display:flex;flex-direction:column;gap:2px;font-size:11px}
.wh-pick-bar{display:flex;height:4px;background:var(--rule)}
.wh-pick-bid{background:var(--long)}.wh-pick-ask{background:var(--short)}
.wh-pick-sum{white-space:nowrap}
.wh-pick-none{padding:8px 10px}
@media (max-width:640px){.wh-pick{flex:1 1 100%}.wh-pick-btn{min-width:0}.wh-pick-panel{width:calc(100vw - 20px)}.wh-pick:not(.cvd-pick):not(.gx-pick) .wh-pick-head,.wh-pick:not(.cvd-pick):not(.gx-pick) .wh-pick-row{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.4fr);gap:8px}.wh-pick:not(.cvd-pick):not(.gx-pick) .wh-pick-head span:nth-child(3),.wh-pick:not(.cvd-pick):not(.gx-pick) .wh-pick-row>span:nth-child(3),.wh-pick:not(.cvd-pick):not(.gx-pick) .wh-pick-head span:nth-child(5),.wh-pick:not(.cvd-pick):not(.gx-pick) .wh-pick-row>span:nth-child(5){display:none}}
/* The CVD screener as a picker (cvd.ts assetPicker): the whales picker with the screener's eight
   columns, a search form for a box, and headings that sort. A phone keeps the asset, the change, the
   CVD and the signal. */
.cvd-pick .wh-pick-panel{width:min(960px,calc(100vw - 20px))}
.cvd-pick .wh-pick-head,.cvd-pick .wh-pick-row{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) 72px minmax(0,1fr) 92px minmax(0,1fr) 56px 100px}
.cvd-pick .wh-pick-rank{width:2.2em}
.wh-pick-find{display:flex;gap:6px;margin:8px}
.wh-pick-find .wh-pick-q{flex:1;min-width:0;margin:0}
.wh-pick-sort{border:0;color:var(--dim)}
.wh-pick-sort:hover,.wh-pick-sort.on{color:var(--ink)}
.wh-pick-sort i{font-style:normal}
.srt-up,.srt-down{display:inline-block;width:.7em;height:.7em;margin-left:.35em;background:currentColor;-webkit-mask:${SORT_DOWN} center/contain no-repeat;mask:${SORT_DOWN} center/contain no-repeat}.srt-up{-webkit-mask-image:${SORT_UP};mask-image:${SORT_UP}}
${ICON_CSS}
@media (max-width:640px){.cvd-pick .wh-pick-head,.cvd-pick .wh-pick-row{grid-template-columns:minmax(0,1.2fr) 64px minmax(0,1fr) 96px;gap:8px}.cvd-pick .wh-pick-head>:is(:nth-child(2),:nth-child(5),:nth-child(6),:nth-child(7)),.cvd-pick .wh-pick-row>:is(:nth-child(2),:nth-child(5),:nth-child(6),:nth-child(7)){display:none}}
/* The three tables (resting, ended, largest trades): one element, two shapes (whales.ts BOOK_SCRIPT).
   These first rules are the phone's, and any browser's without popovers: the tables in the page,
   under the chart, with every style a popover is born with taken back off. From 861px it is a panel
   instead, opened by the button beside the picker, each table scrolling under its own heading:
   resting on the left with the other two stacked beside it, or all three side by side from 1360px,
   where live prices fit with room to spare. A rounded book stays two across at any width: its tables
   carry more columns than three abreast have room for. The --wh-* values are the script's; without
   it the panel still opens, pinned to the top of the screen. */
.wh-book-btn{display:none}
.wh-book{display:block;position:static;inset:auto;width:auto;height:auto;max-width:none;max-height:none;margin:0;padding:0;border:0;overflow:visible;color:inherit;background:none}
@media (min-width:861px){@supports selector(:popover-open){
.wh-book-btn{display:flex;gap:10px;align-items:baseline;padding:5px 10px;font:12px/1.35 var(--mono);letter-spacing:0;text-transform:none;color:var(--ink);background:var(--panel);border:1px solid var(--rule)}
.wh-book-btn::after{content:"";width:10px;height:10px;flex-shrink:0;align-self:center;background:var(--muted);-webkit-mask:${CARET} center/contain no-repeat;mask:${CARET} center/contain no-repeat}
.wh-book-btn:hover,main:has(.wh-book:popover-open) .wh-book-btn{background:var(--panel);border-color:var(--muted)}
.wh-book-btn b{font-size:15px}
.wh-book-btn .dim{font-size:11px}
.wh-book{display:none;position:var(--wh-pos,fixed);top:var(--wh-top,12px);left:var(--wh-left,10px);width:var(--wh-width,calc(100vw - 20px));max-height:var(--wh-max,calc(100vh - 24px));overflow:hidden;color:var(--ink);background:var(--bg);border:1px solid var(--muted);border-top:2px solid var(--accent);box-shadow:0 14px 44px rgba(0,0,0,.75);
opacity:0;transform:translateY(-4px);transition:opacity .14s ease-out,transform .14s ease-out,overlay .14s allow-discrete,display .14s allow-discrete}
.wh-book:popover-open{display:grid;grid-template-columns:repeat(2,minmax(0,auto));grid-template-rows:minmax(0,1fr);opacity:1;transform:none}
@starting-style{.wh-book:popover-open{opacity:0;transform:translateY(-4px)}}
.wh-book::backdrop{background:transparent}
/* The stacked pair shares the panel's height: each takes what its rows need, up to half. */
.wh-book-side{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,auto));align-content:start;min-width:0;min-height:0;border-left:1px solid var(--rule)}
.wh-book-side>.wh-book-col+.wh-book-col{border-top:1px solid var(--rule)}
.wh-book-col{display:flex;flex-direction:column;min-width:0;min-height:0;padding:8px 10px 10px}
.wh-book-col>*{flex:none}
.wh-book-col>.cvd-h2{margin-bottom:6px}
.wh-book-col>.sheet-wrap{flex:0 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain}
.wh-book-col .sheet th{position:sticky;top:0;z-index:1;background:var(--bg);border-bottom:0;box-shadow:inset 0 -1px 0 var(--rule)}
.wh-book-col .sheet th,.wh-book-col .sheet td{padding-left:6px;padding-right:6px}
@media (min-width:1360px){
.wh-book:not(.wh-book-wide):popover-open{grid-template-columns:repeat(3,minmax(0,auto))}
.wh-book:not(.wh-book-wide) .wh-book-side{display:contents}
.wh-book:not(.wh-book-wide) .wh-book-side>.wh-book-col{border-top:0;border-left:1px solid var(--rule)}
}
@media (prefers-reduced-motion:reduce){.wh-book{transition:none;transform:none}}
}}
.wh-addr{border:0;color:var(--muted)}.wh-addr:hover{color:var(--accent)}
.wh-toggle{margin-left:14px;border:0;color:var(--muted)}
.wh-toggle.on{color:var(--accent)}
.cvd-chart.wh-chart .fchart-plot{margin:6px 128px 0 64px}
.wh-chart .wh-plot{height:380px}
/* Candles in the trading-chart monochrome -- rising hollow, falling filled -- so they read apart from
   the blue and red walls drawn under them. */
.wh-wick{stroke:var(--muted);stroke-width:1;vector-effect:non-scaling-stroke}
.wh-up{fill:var(--bg);stroke:var(--ink);stroke-width:1;vector-effect:non-scaling-stroke}.wh-down{fill:var(--ink)}
.wh-chart .wh-volume{height:64px;margin-top:4px}
.wh-vol.wh-up{fill:#3a3a3a;stroke:none}.wh-vol.wh-down{fill:#262626}
.wh-edge{margin:2px 0 4px;font-size:11px;color:var(--muted)}.wh-edge span{white-space:nowrap}.wh-edge-bottom{margin-top:24px}
.wh-wall{vector-effect:non-scaling-stroke}
line.wh-bid{stroke:var(--long)}line.wh-ask{stroke:var(--short)}
.wh-open{opacity:.9}.wh-filled{opacity:.45}.wh-pulled{opacity:.35;stroke-dasharray:4 3}.wh-expired{opacity:.25}
.wh-last{stroke:var(--accent);stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}
.wh-yr{position:absolute;right:-128px;width:124px;text-align:left;transform:translateY(-50%);white-space:nowrap;pointer-events:none;font-size:11px}
.wh-bid-t{color:var(--long)}.wh-ask-t{color:var(--short)}
.wh-filled-t{color:var(--muted)}.wh-pulled-t{color:var(--warn)}.wh-expired-t{color:var(--dim)}
.wh-key-bid{background:var(--long)}.wh-key-ask{background:var(--short)}.wh-key-ended{background:var(--dim)}.wh-key-last{background:var(--accent)}
.wh-trade{position:absolute;border-radius:50%;transform:translate(-50%,-50%);border:1px solid;opacity:.85}
.wh-buy{border-color:var(--long);background:rgba(95,135,255,.3)}.wh-sell{border-color:var(--short);background:rgba(255,95,95,.3)}
.wh-trade:hover{opacity:1;z-index:1}
.wh-chart .fchart-keys i.wh-key-buy,.wh-chart .fchart-keys i.wh-key-sell{width:9px;height:9px;border-radius:50%}
.wh-key-buy{background:var(--long)}.wh-key-sell{background:var(--short)}
.cvd-tiles.wh-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:640px){.wh-chart .wh-plot{height:300px}.cvd-chart.wh-chart .fchart-plot{margin:6px 8px 0 56px}.wh-yr{display:none}.cvd-tiles.wh-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
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
.kc-host{margin:2px 0 22px}
.kc-canvas{position:relative;height:460px}
.kc-on .slot-area,.kc-on .slot-modes{display:none!important}
.kc-bar{margin:0 0 4px;min-height:16px;font-size:11px;line-height:16px}
.kc-note{color:var(--ink)}
.kc-note:not([hidden])+.kc-hint{display:none}
@media (max-width:640px){.kc-canvas{height:380px}.kc-hint{display:none}}
.cvd-chart .fchart-plot{margin:6px 64px 0 64px}
.cvd-chart .fchart-note{margin-top:22px}
.cvd-chart .cvd-plot{height:260px}
.cvd-chart .cvd-strip{height:90px;margin-top:14px;margin-bottom:22px}
/* THE chart loading animation (chart-skeleton.ts), the only one: bars rising and falling in the long and
   short colours behind a spinner and a label. A tab loading itself shows it (.lazy-wait), and so does
   every chart an in-place switch is about to replace -- the CVD interval and asset, the Gamma book,
   the Liquidations choices -- while the figures around it pulse, the tiles a step apart, until the new
   copy is in (.chart-switching). A failed load stills it. Reduced motion keeps the shape and drops
   the movement. */
.chart-skel{position:relative;display:flex;flex-direction:column;justify-content:flex-end;height:100%;min-height:260px;padding:10px 64px 28px;border:1px solid var(--rule);background:var(--panel);box-sizing:border-box}
.chart-skel-bars{display:flex;align-items:center;gap:3px;height:200px}
.chart-skel-bars i{flex:1;min-width:2px;border-radius:1px;opacity:.28;animation:chart-skel 1.1s ease-in-out infinite alternate}
.chart-skel-long{background:var(--long)}.chart-skel-short{background:var(--short)}
@keyframes chart-skel{from{transform:scaleY(.35);opacity:.15}to{transform:scaleY(1);opacity:.45}}
.chart-skel-msg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;margin:0;padding:5px 12px;width:max-content;max-width:calc(100% - 16px);color:var(--ink);background:var(--bg);border:1px solid var(--rule);box-sizing:border-box}
.chart-skel-msg .spin{margin-right:0;color:var(--accent)}
.chart-switching :is(.cvd-tile,.cvd-pick,[data-live=cvd-asof],.notes,.cvd-h2,.sheet-wrap){pointer-events:none;animation:chart-wait .8s ease-in-out infinite alternate}
.chart-switching .cvd-tile:nth-child(2){animation-delay:-.2s}.chart-switching .cvd-tile:nth-child(3){animation-delay:-.4s}.chart-switching .cvd-tile:nth-child(4){animation-delay:-.6s}
@keyframes chart-wait{from{opacity:.45}to{opacity:.15}}
.lazy-failed .chart-skel-bars i{animation:none;opacity:.1}
@media (prefers-reduced-motion:reduce){.chart-skel-bars i{animation:none}.chart-switching :is(.cvd-tile,.cvd-pick,[data-live=cvd-asof],.notes,.cvd-h2,.sheet-wrap){animation:none;opacity:.35}}
@media (max-width:640px){.chart-skel{padding:10px 8px 28px}}
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
.cvd-h2{font-size:13px;margin:0;text-transform:uppercase;letter-spacing:.04em}
.cvd-badge{font-size:11px;font-weight:700;text-transform:uppercase;padding:0 6px;border:1px solid currentColor}
.cvd-badge-bullish{color:var(--long)}.cvd-badge-bearish{color:var(--short)}
/* The whale map (whale-map.ts): Hyperliquid's large positions by the price they liquidate at, longs
   below the dashed mark and shorts above, and the running total from the mark out to each band. */
.wm-chart .wm-plot{height:300px}
.wm-long{fill:var(--long)}.wm-short{fill:var(--short)}
.wm-cum-l,.wm-cum-s{fill:none;stroke-width:1.5;vector-effect:non-scaling-stroke}
.wm-cum-l{stroke:var(--long)}.wm-cum-s{stroke:var(--short)}
.wm-mark{stroke:var(--ink);stroke-width:1;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}
.wm-chart .fchart-keys i.wm-key-l,.wm-chart .fchart-keys i.wm-key-s{width:10px;height:10px}
.wm-key-l{background:var(--long)}.wm-key-s{background:var(--short)}
.wm-chart .fchart-keys i.wm-key-cum{height:0;border-top:2px solid var(--muted)}
.wm-x-mark{color:var(--ink)}
.wm-h2{margin:18px 0 8px}
.wm-venues{margin:-4px 0 12px;font-size:12px}.wm-venues b{color:var(--ink);font-weight:500}.wm-venues span{white-space:nowrap}
/* The Gamma Exposure tab (gamma.ts): each strike band's calls above the zero line and puts below it,
   the net were the spot there as a line on its own right-hand scale, the spot dashed, the flip dashed
   in yellow. */
.gx-chart .gx-plot{height:320px}
.gx-x-end{transform:translateX(-100%)}
.gx-call{fill:var(--long)}.gx-put{fill:var(--short)}
.gx-curve{fill:none;stroke:var(--accent);stroke-width:1.6;vector-effect:non-scaling-stroke}
.gx-spot{stroke:var(--ink);stroke-width:1;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}
.gx-flip{stroke:var(--warn);stroke-width:1;stroke-dasharray:2 3;vector-effect:non-scaling-stroke}
.gx-chart .fchart-keys i.gx-key-call,.gx-chart .fchart-keys i.gx-key-put{width:10px;height:10px}
.gx-key-call{background:var(--long)}.gx-key-put{background:var(--short)}
.gx-chart .fchart-keys i.gx-key-curve{height:0;border-top:2px solid var(--accent)}
.gx-chart .fchart-keys i.gx-key-spot{height:0;border-top:1px dashed var(--ink)}
.gx-chart .fchart-keys i.gx-key-flip{height:0;border-top:1px dashed var(--warn)}
.gx-yr{color:var(--accent)}
/* The view switch (gamma.ts): the page opens on calls/puts, and only ever hides what a view leaves out. */
html:not([data-gxview=net]):not([data-gxview=zones]) .gx-v-net,html:not([data-gxview=zones]) .gx-v-zone,html[data-gxview=net] .gx-v-split,html[data-gxview=zones] .gx-v-split{display:none}
.gx-zone-short{fill:var(--short);opacity:.13}.gx-zone-long{fill:var(--long);opacity:.09}
/* The Exchanges page (exchanges.ts): a grade badge per venue, and cells that carry a second line --
   the fee under the cost, the $100k slippage under the $10k. */
.xg{display:inline-block;min-width:20px;padding:1px 4px;text-align:center;font-weight:700;border:1px solid currentColor;line-height:1.2}
.xg-S{color:#000;background:var(--accent);border-color:var(--accent)}.xg-A{color:var(--accent)}.xg-B{color:#5fd7ff}.xg-C{color:#ff9f43}.xg-D{color:var(--muted)}.xg-none{color:var(--dim);border-color:var(--rule)}
.xc-table td{vertical-align:top;padding-top:4px;padding-bottom:4px}
.xc-sub{display:block;font-size:11px;color:var(--muted)}
.xc-slip span{display:block;white-space:nowrap}.xc-slip i{font-style:normal;color:var(--muted);margin-right:4px}
.xc-type{font-size:10px;color:var(--muted);border:1px solid var(--rule);padding:0 3px;margin-left:4px}
.xc-warn{color:#ff9f43;text-decoration:none;border:0;cursor:help}
.xc-grade{text-align:center}
button.xg{font:inherit;font-weight:700;line-height:1.2;cursor:pointer;background:transparent}
button.xg.xg-S{background:var(--accent)}
button.xg:hover,button.xg:focus-visible,button.xg[aria-expanded=true]{outline:1px solid var(--ink);outline-offset:1px}
.xc-score{display:block;margin-top:2px;font-size:11px;color:var(--muted)}
.xg-pop{width:min(44ch,calc(100vw - 24px))}
/* A phone has no room beside the badge: the card opens centred, as a popover is born. */
@media (max-width:860px){.help-pop.xg-pop{inset:0;margin:auto;height:fit-content}}
.xg-top{display:flex;align-items:baseline;gap:8px;margin:0 0 10px}
.xg-top b{font-size:18px;color:var(--ink)}
.xg-rank{margin-left:auto;color:var(--muted)}
.xg-bars{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:max-content 1fr 3ch;gap:0 10px;align-items:center}
.xg-bars li{display:contents}
.xg-pn i{font-style:normal;color:var(--muted)}
.xg-bar{position:relative;height:6px;background:var(--rule)}
.xg-bar b{position:absolute;top:0;bottom:0;left:0;background:var(--ink)}
.xg-pv{text-align:right;font-weight:700;color:var(--ink)}
.xg-why{grid-column:1/-1;margin:1px 0 7px;font-size:11px;color:var(--muted)}
.xg-note{margin:6px 0 0;font-size:11px;color:var(--muted)}
.xg-card{max-width:560px;margin:0 0 18px;padding:10px 14px 12px;border:1px solid var(--rule);border-top:2px solid var(--accent);font:12px/1.55 var(--mono)}
.xg-method{margin-top:22px}
.xg-pillars{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:10px 0}
.xg-pillar{padding:10px 12px;border:1px solid var(--rule)}
.xg-pillar h3{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:13px}
.xg-pillar h3 i{margin-left:auto;font-style:normal;font-weight:400;font-size:11px;color:var(--muted)}
.xg-letter{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;color:#000;background:var(--accent);font-weight:700}
.xg-pillar p{margin:0;font-size:12px;line-height:1.5;color:var(--muted)}
.xc-tiles .cvd-big{font-size:clamp(20px,3vw,28px)}
/* The macro tabs (macro.ts): each line its own colour, set once as --c and read by its stroke, its
   bar and its key; the reference lines (the Fed's 2% target) dotted in yellow. Long and short keep
   their blue and red for who-pays-whom; nothing here is either. */
.mc-a{--c:#c8f5a8}.mc-b{--c:#5fd7ff}.mc-c{--c:#b69cff}.mc-d{--c:#ff9f43}.mc-e{--c:#a8b3bf}
.mc-chart .fchart-plot{margin:6px 14px 0 58px}
.mc-chart .mc-plot{height:240px}
.mc-chart .slot-area{padding-bottom:20px}
.mc-chart .fchart-note{margin-top:2px}
.mc-line{fill:none;stroke:var(--c);stroke-width:1.6;vector-effect:non-scaling-stroke}
.mc-dashed{stroke-dasharray:5 4}
.mc-bar{fill:var(--c)}.mc-bar.mc-neg{fill:#ff9f43}.mc-bar.mc-e{opacity:.55}
.mc-ref{stroke:var(--warn);stroke-width:1;stroke-dasharray:2 4;vector-effect:non-scaling-stroke}
.mc-ref-l{position:absolute;right:4px;transform:translateY(-115%);color:var(--warn);font-size:11px;white-space:nowrap;pointer-events:none}
.mc-x-start{transform:none}
.mc-chart .fchart-keys i.mc-key{width:12px;height:0;border-top:2px solid var(--c)}
.mc-chart .fchart-keys i.mc-key-dash{border-top-style:dashed}
.mc-chart .fchart-keys i.mc-key-bar{width:10px;height:10px;border:0;background:var(--c)}
.mc-up{color:var(--accent)}.mc-down{color:#ff9f43}
.mc-head{display:flex;align-items:center;gap:8px;margin:4px 0 10px}
.mc-cal{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 18px;margin:-2px 0 12px}
.mc-cal .eyebrow{margin:0}
.mc-cal b{font-weight:600}
.mc-ladders{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;margin:0 0 16px}
.mc-ladder{border:1px solid var(--rule);background:var(--panel);padding:8px 10px}
.mc-ladder-t{margin:0;font-weight:600}
.mc-mid{margin:2px 0 6px}
.mc-ladder table.sheet td{padding:1px 4px}
.mc-ladder .sheet tbody tr:nth-child(n){background:none}
.mc-bar-cell{width:45%;min-width:70px}
.mc-p{display:block;height:8px;background:var(--accent);opacity:.75}
.mc-stack{display:flex;width:150px;height:10px;background:var(--rule)}
.mc-dec{display:block;height:100%}
.mc-dec-0{background:#ff9f43}.mc-dec-1{background:#ffcf9e}.mc-dec-2{background:var(--muted)}.mc-dec-3{background:#a5e6ff}.mc-dec-4{background:#5fd7ff}
.mc-hi{color:var(--ink);font-weight:700}
.mc-tag{font-size:10px;border:1px solid var(--muted);color:var(--muted);padding:0 3px}
.mc-spark{display:block;width:110px;height:20px}
.mc-spark .mc-line{stroke-width:1.2}
@media (max-width:640px){.mc-chart .fchart-plot{margin:6px 6px 0 50px}.mc-chart .mc-plot{height:200px}.mc-stack{width:90px}}
.gx-chart .fchart-keys i.gx-key-zs,.gx-chart .fchart-keys i.gx-key-zl{width:10px;height:10px}
.gx-key-zs{background:color-mix(in srgb,var(--short) 35%,transparent)}.gx-key-zl{background:color-mix(in srgb,var(--long) 30%,transparent)}
.gx-zl{position:absolute;top:4px;z-index:1;transform:translateX(-50%);padding:0 4px;background:rgba(0,0,0,.7);font-size:11px;line-height:16px;white-space:nowrap;pointer-events:none}
.gx-zl-short{color:var(--short)}.gx-zl-long{color:var(--long)}
.gx-controls{align-items:center;gap:10px 16px}.gx-controls .tf{margin:0}
.gx-table tr.gx-out td{opacity:.4}
.gx-stale{color:var(--warn)}
/* The book picker (gamma.ts bookPicker): the whales picker's dropdown, its rows under region headings,
   each a small reading -- spot, net, the calls/puts split as a bar, the flip from the spot, the age. A
   late book's age is in the warning colour. A phone keeps the book, its net and the bar. */
.gx-pick .wh-pick-btn{min-width:280px}
.gx-pick-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:12px}
.gx-pick .wh-pick-panel{width:min(860px,calc(100vw - 20px))}
.gx-pick .wh-pick-head,.gx-pick .wh-pick-row{grid-template-columns:minmax(0,2fr) minmax(0,.9fr) minmax(0,1fr) minmax(0,1fr) 64px minmax(0,1.4fr)}
.gx-pick .wh-pick-bar{height:6px}
.gx-pick .wh-pick-sym small{min-width:0;overflow:hidden;text-overflow:ellipsis}
.wh-pick-group{margin:0;padding:9px 10px 3px;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);border-top:1px solid var(--rule)}
.wh-pick-group:first-child{border-top:0}
.wh-pick-group[hidden]{display:none}
.gx-pick-when{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
.gx-late{color:var(--warn)}
.gx-controls .tf a.gx-none{opacity:.45}
@media (max-width:640px){.gx-pick .wh-pick-btn{min-width:0}.gx-pick .wh-pick-head,.gx-pick .wh-pick-row{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,.8fr);gap:8px}.gx-pick .wh-pick-head>:is(:nth-child(2),:nth-child(5),:nth-child(6)),.gx-pick .wh-pick-row>:is(:nth-child(2),:nth-child(5),:nth-child(6)){display:none}}
@media (max-width:640px){.gx-chart .gx-plot{height:280px}.cvd-chart.gx-chart .fchart-plot{margin:6px 8px 0 56px}.gx-yr{display:none}}
/* Slot readout (slot-chart.ts), shared by the CVD and longs-vs-shorts charts. The readout sits in the
   header across the full width, and below desktop width it reserves the two to four lines its longest reading
   wraps to (measured at 1024, 600 and 390px), so the plot below does not jump while a finger scrubs. pan-y leaves vertical scrolling to the
   page and gives a sideways drag to the chart. */
.slot-area{touch-action:pan-y;cursor:crosshair;-webkit-tap-highlight-color:transparent}
.slot-area:focus{outline:0}.slot-area:focus-visible{outline:1px solid var(--accent);outline-offset:2px}
.slot-band{fill:rgba(216,216,216,.08)}
.slot-mark.fchart-cursor{stroke:var(--ink);stroke-dasharray:3 3}
/* The crosshair (slot-chart.ts, a figure marked data-cursors): the band gives way to a dashed level line
   at the pointer, and the value there sits on each axis in a tag over the axis labels. The reader picks
   bar or cross in the chart's head; the choice is on <html>, so a refreshed chart keeps it. */
:root[data-cursor=cross] [data-cursors] .slot-band{display:none}
.slot-hair{stroke:var(--ink);stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}
.slot-tag{position:absolute;z-index:2;transform:translateY(-50%);padding:0 4px;background:var(--ink);color:var(--bg);font-size:11px;line-height:16px;white-space:nowrap;pointer-events:none}
.slot-tag[hidden]{display:none}
.slot-tag-l{right:calc(100% + 4px)}.slot-tag-r{left:calc(100% + 4px)}
.slot-tag-x{top:100%;z-index:3;margin-top:1px;transform:translateX(-50%);background:#1c1c1c;color:#fff;border:1px solid var(--muted)}
.slot-modes{display:flex;align-items:center;gap:2px;color:var(--dim)}
.slot-modes[hidden]{display:none}
.slot-modes>span{margin-right:4px}
.slot-modes button,.slot-modes button:hover{font:inherit;text-transform:none;letter-spacing:normal;color:var(--muted);background:none;border:0;padding:0 6px}
.slot-modes button:hover{color:var(--accent)}
.slot-modes button[aria-pressed=true]{background:var(--ink);color:var(--bg)}
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
/* Wraps, so a long strip (the liquidation map's fifteen venues) breaks onto a second line rather than
   widening a phone's page past the screen. */
.tf{display:flex;flex-wrap:wrap;gap:2px;margin:0 0 8px;color:var(--muted)}
.tf a{border:0;color:var(--muted);padding:0 6px}
.tf a[aria-current]{background:var(--ink);color:var(--bg)}
/* An option shown but not offered yet (the CVD 7d interval): dimmed, a padlock, no pointer. */
.tf .tf-locked{display:inline-flex;align-items:center;gap:3px;padding:0 6px;color:var(--dim);cursor:not-allowed}
.tf-lock{opacity:.85}
.sheet td.locked{color:var(--dim);cursor:not-allowed}
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
.leg .leg-top{display:flex;justify-content:space-between;gap:12px}
/* A pair whose week of funding paid the wrong way: its fees never come back (pages.ts paybackCell). */
.sheet .never{color:var(--warn)}
/* The screener's control bar (screener-controls.ts): search, period, unit, and three dropdowns. Above
   the table's sticky header, so an open panel is never painted under it. */
form.sx{position:relative;z-index:5;margin:0 0 10px}
.sx-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;padding:8px;border:1px solid var(--rule)}
.sx-search{flex:1 1 220px;display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid var(--rule);background:var(--band);color:var(--muted)}
.sx-search input{flex:1;min-width:0;font:13px var(--mono);color:var(--ink);background:none;border:0;padding:6px 0;outline:none}
.sx-search:focus-within{border-color:var(--accent)}
.seg{display:flex;gap:2px;padding:2px;border:1px solid var(--rule);background:var(--band)}
.seg label{display:block;position:relative}
.seg input{position:absolute;opacity:0;width:1px;height:1px;margin:0}
.seg a,.seg label span{display:block;padding:4px 10px;border:0;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;cursor:pointer}
.seg a:hover,.seg label:hover span{color:var(--ink)}
.seg a[aria-current],.seg input:checked+span{background:var(--accent);color:var(--bg);font-weight:700}
.seg input:focus-visible+span{outline:1px solid var(--accent);outline-offset:1px}
.sx-pop{position:relative}
.sx-btn{display:flex;align-items:center;gap:6px;height:100%;box-sizing:border-box;padding:4px 10px;border:1px solid var(--rule);background:var(--band);color:var(--ink);list-style:none;white-space:nowrap;cursor:pointer}
.sx-btn::-webkit-details-marker{display:none}
.sx-pop[open]>.sx-btn,.sx-btn:hover{border-color:var(--muted)}
.sx-btn b{font-weight:400;color:var(--accent)}
.sx-btn .sx-badge{padding:0 5px;background:var(--accent);color:var(--bg);font-weight:700}
.sx-panel{position:absolute;z-index:30;top:calc(100% + 4px);left:0;width:min(400px,calc(100vw - 20px));max-height:min(78vh,720px);overflow-y:auto;box-sizing:border-box;display:grid;gap:14px;padding:12px;border:1px solid var(--muted);background:var(--bg);box-shadow:0 8px 24px rgba(0,0,0,.6);white-space:normal}
.sx-wide{width:min(560px,calc(100vw - 20px))}
.sx-right{left:auto;right:0}
.sx-panel p{margin:0}
.sx-h,.sx-gh{margin:0 0 6px!important;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.sx-gh{display:flex;justify-content:space-between;gap:8px}
.sx-sect .seg{width:max-content;max-width:100%;flex-wrap:wrap}
.sx-num{width:140px;padding:4px 8px;font:13px var(--mono);color:var(--ink);background:var(--band);border:1px solid var(--rule)}
.sx-num:invalid{border-color:var(--short)}
.sx-note{margin-left:8px;font-size:11px;color:var(--dim)}
.sx-presets .sx-note,.sx-all .sx-note{margin-left:0}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
button.chip{padding:2px 8px;font:12px var(--mono);letter-spacing:0;text-transform:none;color:var(--muted);background:var(--band);border:1px solid var(--rule)}
button.chip:hover,button.chip.on{color:var(--ink);background:var(--band);border-color:var(--accent)}
button.lnk{padding:0;font:inherit;letter-spacing:.04em;color:var(--accent);background:none;border:0}
button.lnk:hover{color:var(--ink);background:none}
button.ghost,a.btn.ghost{color:var(--ink);background:none;border:1px solid var(--rule)}
button.ghost:hover,a.btn.ghost:hover{color:var(--bg);background:var(--accent);border-color:var(--accent)}
.sx-toggles{display:grid;gap:6px}
.sx-toggle{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 10px;border:1px solid var(--rule);background:var(--panel);cursor:pointer}
.sx-toggle>span{display:grid;gap:2px}
.sx-toggle b{font-weight:400;color:var(--ink)}
.sx-toggle small{color:var(--dim)}
.sx-toggle input{appearance:none;-webkit-appearance:none;position:relative;flex-shrink:0;width:34px;height:18px;margin:0;border:1px solid var(--rule);background:var(--band);cursor:pointer}
.sx-toggle input::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;background:var(--muted);transition:left .12s}
.sx-toggle input:checked{border-color:var(--accent)}
.sx-toggle input:checked::after{left:18px;background:var(--accent)}
.sx-toggle input:focus-visible{outline:1px solid var(--accent);outline-offset:2px}
.sx-foot{display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--rule)}
.sx-foot>*{flex:1;padding:5px 10px;text-align:center}
.sx-all{display:flex;justify-content:space-between;align-items:center;gap:8px}
.sx-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}
.sx-tile{display:flex;align-items:center;gap:8px;min-width:0;padding:5px 8px;border:1px solid var(--rule);background:var(--panel);cursor:pointer}
.sx-tile:has(input:checked){border-color:#3a5a32;background:#0c140a}
.sx-tile input{margin:0;accent-color:var(--accent)}
.sx-tile .mono{display:inline-grid;place-items:center;flex-shrink:0;width:18px;height:18px;border-radius:50%;background:var(--rule);font-size:10px;font-weight:700;color:var(--ink)}
.sx-tile .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sx-presets{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.sx-preset{display:inline-flex;align-items:center;gap:2px}
.sx-save{display:flex;gap:6px;margin-top:8px}
.sx-save input{flex:1;min-width:0;padding:4px 8px;font:13px var(--mono);color:var(--ink);background:var(--band);border:1px solid var(--rule)}
.sx-dots{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)}
.sx-card{padding:8px 10px;border:1px solid var(--rule);background:var(--panel)}
.sx-card p+p{margin-top:4px;color:var(--muted)}
/* Steadiness (screener-controls.ts): green, amber and red, deliberately not --long/--short, which
   answer who pays whom. Hollow where a leg has no month of funding to score. */
i.sd{display:inline-block;flex-shrink:0;width:7px;height:7px;margin-right:6px;border-radius:50%;vertical-align:.08em}
.sd-steady{background:#3ddc84}.sd-mixed{background:#f0a030}.sd-erratic{background:#e5484d}
.sd-none{box-sizing:border-box;border:1px solid var(--dim)}
.sd-t-steady{color:#3ddc84}.sd-t-mixed{color:#f0a030}.sd-t-erratic{color:#e5484d}
/* A tile's figure at its right edge: a backtest leg picker shows each exchange's funding now. */
.sx-tile .vp-meta{margin-left:auto;padding-left:6px;white-space:nowrap}
/* The backtest (pages.ts pair): leg pickers in the form, and a bar of window and chart lines above the
   chart, which backtest-swap.ts replaces in place. */
.bt-form .field>span{display:block}
/* .field lowercases its label; an exchange is spelled its own way. */
.bt-form .sx-pop{text-transform:none}
.bt-form .sx-btn{min-width:180px;padding:2px 8px}
.bt-form .sx-btn b{color:var(--ink)}
.bt-bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin:0 0 6px}
.bt-bar .tf{margin:0}
/* A leg's badges beside its ticker (badges.ts). Long and short keep the site's own colours. */
.bdg{display:inline-block;margin-left:4px;padding:0 4px;border:1px solid;font-size:9.5px;font-weight:700;letter-spacing:.05em;line-height:1.45;vertical-align:.08em;white-space:nowrap}
.bdg-long{color:var(--long);border-color:var(--long);background:#0b1020}
.bdg-short{color:var(--short);border-color:var(--short);background:#1c0b0b}
.bdg-outlier{color:var(--warn);border-color:#6a5a12;background:#16120a}
.bdg-noliq{color:var(--muted);border-color:var(--dim);background:var(--band)}
.bdg-offsync{color:var(--muted);border-color:var(--rule);border-style:dashed}
.bdg-viahl{color:#5fd7ff;border-color:#24566a;background:#08141a}
.bdg-row{display:grid;grid-template-columns:76px 1fr;gap:10px;align-items:start}
.bdg-row .bdg{margin:2px 0 0;justify-self:start}
.bdg-row p{margin:0;color:var(--ink)}
.section-head .sx-key{margin-left:auto}
/* The arbitrage rows open a strip beneath them (pages.ts ARB_SCRIPT). */
.sheet tbody tr[data-arb]{cursor:pointer}
.sheet tbody tr.arb-open td{background:var(--band)}
.sheet tbody tr.arb-more td{white-space:normal;padding:8px 10px;background:var(--panel);border-bottom:1px solid var(--rule)}
.arb-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}
.arb-actions button,.arb-actions .btn{padding:3px 10px}
.arb-pairs{margin-top:8px}
.arb-pairs .section-head{margin-top:0}
/* The convergence pair page (convergence-page.ts). */
.pc-form{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 12px}
.pc-pick{display:flex;align-items:center;gap:6px}
.pc-pick .sx-btn{min-width:150px}
.pc-pick .sx-btn b{color:var(--ink)}
.pc-side{font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.pc-long .pc-side{color:var(--long)}.pc-short .pc-side{color:var(--short)}
.pc-swap{padding:3px 8px}
.pc-size{display:flex;align-items:center;gap:6px;color:var(--muted)}
.pc-size input{width:90px;padding:3px 6px;font:13px var(--mono);color:var(--ink);background:var(--band);border:1px solid var(--rule)}
.pc-size input:invalid{border-color:var(--short)}
.pc-window{margin-left:auto}
.pc-warn{margin:0 0 12px;padding:10px 12px;border:1px solid #5a4a12;background:#16120a;color:var(--warn)}
.pc-warn b{display:block;margin-bottom:2px}
.pc-card{margin:0 0 12px;padding:12px 14px;border:1px solid var(--rule);background:var(--panel)}
.pc-card h2{margin:0 0 8px}
.pc-card p{margin:4px 0}
.pc-label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.pc-big{font-size:30px;font-weight:700;line-height:1.1}
.pc-big .pc-sub{font-size:13px;font-weight:400;color:var(--muted)}
.pc-big .pc-sub b{color:var(--ink)}
.pc-inner{margin:8px 0;padding:8px 10px;border:1px solid var(--rule)}
.pc-flag{display:inline-block;padding:0 6px;border:1px solid #5a4a12;color:var(--warn);font-size:11px}
.pc-chip{margin-left:8px;padding:1px 6px;border:1px solid var(--rule);font-size:11px;font-weight:400;color:var(--muted)}
.pc-card .up{color:var(--long)}.pc-card .down{color:var(--short)}
.pc-trades{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 6px}
.pc-trade{display:block;padding:8px 10px;text-align:center;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
a.pc-trade.pc-long{color:var(--long);background:#0b1020;border:1px solid var(--long)}
a.pc-trade.pc-short{color:var(--short);background:#1c0b0b;border:1px solid var(--short)}
a.pc-trade:hover{color:var(--bg)}
a.pc-trade.pc-long:hover{background:var(--long)}a.pc-trade.pc-short:hover{background:var(--short)}
.pc-calc th[scope=row]{color:var(--muted);text-transform:none;text-align:left}
.pc-calc tr.pc-net th,.pc-calc tr.pc-net td{border-top:1px solid var(--rule);color:var(--ink)}
.pc-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px}
.pc-tiles>div{display:grid;gap:2px;padding:8px 10px;border:1px solid var(--rule)}
.pc-tiles span{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.pc-tiles b{font-size:15px}
.pc-tiles small{color:var(--dim)}
.pc-chart .fchart-line.spread{stroke:#3ddc84;stroke-width:1.4;stroke-dasharray:none}
.pc-ref{stroke:var(--muted);stroke-width:1;stroke-dasharray:3 4;vector-effect:non-scaling-stroke}
.pc-ref-label{position:absolute;left:4px;transform:translateY(-110%);padding:0 4px;font-size:10px;color:var(--bg);background:var(--muted);pointer-events:none}
.pc-key-long{background:var(--long)}.pc-key-short{background:var(--short)}.pc-key-spread{background:#3ddc84}
.pc-legs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 12px}
.pc-leg{padding:12px 14px;border:1px solid var(--rule);background:var(--panel)}
.pc-leg-head{margin:0 0 8px;font-size:15px}
.pc-leg-head a{font-weight:700;border:0}
.pc-row{display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-bottom:1px solid var(--rule)}
.pc-row span{color:var(--muted)}
.pc-row b{font-weight:400;text-align:right}
.pc-leg .pc-trade{margin-top:10px}
@media (max-width:640px){.pc-trades,.pc-legs{grid-template-columns:1fr}.pc-window{margin-left:0}.pc-big{font-size:24px}}
/* On a phone a panel may open from a button at the right edge: it spans the screen instead. */
@media (max-width:640px){
.sx-search{flex-basis:100%}
.sx-panel,.sx-wide{position:fixed;top:calc(var(--mast) + 8px);left:10px;right:10px;width:auto;max-height:calc(100vh - var(--mast) - 20px);max-height:calc(100dvh - var(--mast) - 20px)}
.sx-dots{display:none}
}
/* A leg quoted the other way round (pages.ts invertedMark): the side to take on its own contract. */
.leg .leg-inv{color:var(--warn);font-size:11px}
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
.st-planned,.st-unknown{color:var(--dim)}
.outage{margin:0 0 14px;color:var(--warn);max-width:100ch;line-height:1.5}
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
/* The "data center is busy" page (pages.unavailable): a stick-figure runner, all CSS-driven. */
.busy{text-align:center;padding:28px 0}
.runner{width:200px;max-width:70%;height:auto;color:var(--accent);overflow:visible}
.runner *{fill:none;stroke:currentColor;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round}
.runner .head{fill:currentColor;stroke:none}
.runner .limb{animation:run-swing .6s ease-in-out infinite alternate}
.runner .shin{animation:run-knee .6s ease-in-out infinite alternate}
.runner .lag{animation-delay:-.6s;animation-direction:alternate-reverse}
.runner .lag .shin,.runner .lag.shin{animation-direction:alternate-reverse}
.runner .body{animation:run-bob .3s ease-in-out infinite alternate}
.runner .ground{stroke:var(--dim);stroke-width:2;stroke-dasharray:10 14;animation:run-ground .45s linear infinite}
@keyframes run-swing{from{transform:rotate(-45deg)}to{transform:rotate(45deg)}}
@keyframes run-knee{from{transform:rotate(5deg)}to{transform:rotate(70deg)}}
@keyframes run-bob{to{transform:translateY(-2px)}}
@keyframes run-ground{to{stroke-dashoffset:-24}}
@media (prefers-reduced-motion:reduce){.runner *{animation:none!important}}
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
.fchart-keys .fchart-key{display:flex;align-items:center;gap:5px;color:var(--muted)}
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
/* A tab that failed to load itself (tabs.ts): the loading chart stills, the label turns to the warning
   and a retry button joins it. */
.lazy-failed .spin{display:none}
.lazy-failed .lazy-msg{color:var(--warn)}
.lazy-retry{font:700 12px var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--ink);background:transparent;border:1px solid var(--rule);padding:3px 10px;cursor:pointer}
.lazy-retry:hover{border-color:var(--accent);color:var(--accent)}
footer{border-top:1px solid var(--rule);margin-top:24px;padding:8px 0 24px;color:var(--dim);line-height:1.6}
footer .sig{display:flex;justify-content:space-between;gap:16px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
/* The language switch: each language in its own script, the one in use lit as the nav's current page is. */
.langs{display:flex;flex-wrap:wrap;gap:2px 4px;align-items:baseline;margin-bottom:6px;color:var(--dim)}
.langs a{border:0;color:var(--muted);padding:0 6px}
.langs a[aria-current]{background:var(--ink);color:var(--bg)}
.langs a:hover{color:var(--accent)}
/* About page: the changelog reads as prose, so it gets a measure and some line height. */
.about-log{display:grid;gap:16px;max-width:96ch;margin-top:6px}
.about-log h2{margin:0 0 6px}
.about-log ul{margin:0;padding-left:18px;line-height:1.5}
.about-log li+li{margin-top:4px}
/* Reduced motion: a still outline in place of the live-refresh fade, cleared on the next refresh. */
.chg{outline:1px solid var(--muted);outline-offset:-1px}.chg-up{outline-color:#00ff88}.chg-down{outline-color:#ff4757}
/* The hotkey legend needs ~1,250px beside the nav since "? keyboard map" joined it; below that it was
   clipped mid-word ("lliquidations"), so it goes rather than half-shows. The keys still work. */
@media (max-width:1300px){.keys{display:none}}
@media (max-width:860px){.status{font-size:11px}.legs .short{text-align:left}}
`;

// Live "… ago" and countdowns and the clock; the hotkeys are hotkeys.ts's own script. The
// duration words come from format.ts in the page's language, so a ticking age reads as the server
// wrote it. The language links get the page's query string, so switching keeps a screener's filters.
// The clock reads the visitor's own time zone, which only the browser knows (the page is cached for
// everyone); a click flips it to UTC, the clock funding settles by, and the choice is remembered.
// The click also tells localtime.ts, whose script redraws every chart time in the same zone.
const pageScript = () =>
  `(()=>{const L=${scriptStrings({ ...durationStrings(), ...clockStrings() })};for(const a of document.querySelectorAll("a[data-lang]"))a.href=a.pathname+"?back="+encodeURIComponent(location.pathname+location.search);const m=document.querySelector(".mast"),ms=()=>{const d=document.documentElement;d.style.setProperty("--vw",d.clientWidth+"px");m&&d.style.setProperty("--mast",m.offsetHeight+"px")};ms();addEventListener("resize",ms);const p=n=>String(n).padStart(2,"0");const f=s=>{s=Math.max(0,Math.round(s));return s<60?L.s.replace("{s}",s):s<3600?L.m.replace("{m}",Math.floor(s/60)):L.hm.replace("{h}",Math.floor(s/3600)).replace("{m}",p(Math.floor(s%3600/60)))};const t=()=>{const n=Date.now();for(const e of document.querySelectorAll("[data-since]"))e.textContent=L.ago.replace("{time}",f((n-e.dataset.since)/1e3));for(const e of document.querySelectorAll("[data-until]")){const d=(e.dataset.until-n)/1e3;e.textContent=d>0?f(d):L.settling}if(c){const d=new Date(),o=u?0:-d.getTimezoneOffset(),a=Math.abs(o);c.textContent=(u?[d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()]:[d.getHours(),d.getMinutes(),d.getSeconds()]).map(p).join(":")+" UTC"+(o?(o>0?"+":"-")+Math.floor(a/60)+(a%60?":"+p(a%60):""):"");c.title=u?L.utc:L.local.replace("{zone}",z)}};const c=document.getElementById("clock");let u=false,z="";try{u=localStorage.getItem("clock")==="utc"}catch{}try{z=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch{}c&&c.addEventListener("click",()=>{u=!u;try{localStorage.setItem("clock",u?"utc":"local")}catch{}t();dispatchEvent(new Event("airrates:clock"))});t();setInterval(t,1e3);})();`;

/** The clock's tooltips, for the page script: the zone is the browser's, filled in there. */
const clockStrings = () => ({
  local: tr("Your local time ({zone}). Click for UTC."),
  utc: tr("UTC, the clock funding settles by. Click for your local time."),
});

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
      `<a href="${item.href}"${item.match(path) ? ' aria-current="page"' : ""}>${trMsg(item.label)}</a>`,
  ).join("");
  // A page that reads no database (the geo-probe, the error pages) passes no overview: it has no
  // status to report, which is not the same as "no venue has reported".
  const status =
    overview === undefined
      ? ""
      : overview && overview.markets > 0
        ? tr("{markets} markets · {venues} venues · updated {ago}", {
            markets: overview.markets.toLocaleString("en-US"),
            venues: overview.venues,
            ago: since(overview.updated_at, now),
          })
        : tr("no venue has reported in five minutes");
  const sentimentBadge =
    overview && overview.sentiment_score !== null
      ? `<a class="sent-badge sent-${sentimentTone(overview.sentiment_score)}" href="/sentiment" title="${tr("Fear &amp; greed: click for the chart")}">${overview.sentiment_score.toFixed(0)} ${sentimentLabel(overview.sentiment_label)}</a>`
      : "";
  // Every language by its own name, the one in use marked; a plain link each, so it needs no script.
  const languages = LOCALES.map(
    (locale) =>
      `<a href="${switchHref(locale, path)}" data-lang hreflang="${LOCALE_INFO[locale].htmlLang}" lang="${LOCALE_INFO[locale].htmlLang}"${locale === currentLocale() ? ' aria-current="true"' : ""}>${LOCALE_INFO[locale].name}</a>`,
  ).join("");

  return `<!doctype html>
<html lang="${htmlLang()}">
<head>
${GA_TAG}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · airrates</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📟</text></svg>">
<meta name="description" content="${esc(description)}">
${discoverability(title, description, path)}
${INSTALL_HEAD}
<style>${CSS}${SHARE_CSS}${INSTALL_CSS}${HELP_CSS}</style>
</head>
<body data-rendered="${now}" data-build="${esc(BUILD.commit ?? "")}">
<header class="mast">
<div class="wrap bar"><a class="brand" href="/">airrates<small>${tr("What settled. Not what might.")}</small></a><span class="status" data-live="status">${status}</span>${sentimentBadge}${shareBar()}<button type="button" class="clock" id="clock">--:--:--</button></div>
<div class="wrap bar bar2"><nav aria-label="Main">${nav}</nav><a class="keys" href="/keys" title="${tr("Keyboard shortcuts: change them on the keyboard page")}">${hotkeyLegend()}</a></div>
</header>
<main class="wrap" data-loading="${esc(tr("Loading…"))}">${body}</main>
<footer><div class="wrap">
<p class="sig"><span><a href="${MEMBER_URL}" target="_blank" rel="noopener">${tr("login")}</a> · <a href="${TELEGRAM_URL}" target="_blank" rel="noopener" title="${tr("Join the airrates group on Telegram: @airratesnet")}">${tr("telegram")}</a> · <a href="/status">${tr("status")}</a> · <a href="/probe">${tr("geo-probe")}</a> · <a href="/about">${tr("about")}</a> · <a class="kb-link" href="/keys">${keyboardIcon()}${tr("keyboard")}</a> · <a href="/referrals">${tr("referral links")}</a> · <a href="/legal">${tr("legal &amp; privacy")}</a> · <a href="/tos">${tr("terms")}</a></span><span>airrates</span></p>
<nav class="langs" aria-label="${tr("Language")}"><span>${tr("language:")}</span>${languages}</nav>
<p>${tr("Not financial advice. Data may be delayed or inaccurate. Not affiliated with or endorsed by any exchange.")}</p>
</div></footer>
<script>${pageScript()}</script>
<script>${localTimeScript()}</script>
<script>${hotkeyScript()}</script>
<script>${HELP_SCRIPT}</script>
<script>${LIVE_SCRIPT}</script>
<script>${awaitScript()}</script>
<script>${TAB_SCRIPT}</script>
<script>${ROW_LINK_SCRIPT}</script>
<script>${shareScript()}</script>
<script>${WEBMCP_SCRIPT}</script>
</body>
</html>`;
}
