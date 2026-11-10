import type { Overview } from "../app/data";
import { helpHeading } from "./help";
import { tr } from "./i18n";
import { layout } from "./layout";

/**
 * /glossary, from the footer menu (owner, 2026-11-10): the order-flow and volume-profile words, each
 * in the one line the owner wrote for it. Each term has its own id, so a page or a chat can link
 * straight to one (/glossary#cvd) and the term lights up when it is the target.
 *
 * The same day the owner added the words the rest of the site leans on (lines drafted and approved in
 * chat): options and gamma, which the market narrator in the masthead uses in every line, funding and
 * perps, and liquidations and whales. Delta is two terms, the order-flow one and the option greek the
 * Rates page has a tab for, so each says which it is.
 *
 * Where the site shows a term, a line under it says where. Only those: VPOC, value area, LVN and
 * single prints are not drawn on any public page yet, and a link to where they are not would mislead.
 */
interface Term {
  id: string;
  /** The term as written. Acronyms stay Latin in every language, as CVD does. */
  name: string;
  /** What an acronym stands for, or "" for a plain word. */
  long: string;
  text: string;
  /** Where the site shows it, as markup, or "". */
  see: string;
}

function groups(): { id: string; title: string; terms: Term[] }[] {
  return [
    {
      id: "order-flow",
      title: tr("Order flow"),
      terms: [
        {
          id: "delta",
          name: tr("Delta (order flow)"),
          long: "",
          text: tr("Aggressive buying minus aggressive selling."),
          see: "",
        },
        {
          id: "cvd",
          name: "CVD",
          long: tr("cumulative volume delta"),
          text: tr("Delta added up through the session."),
          see: tr(
            'Shown on the <a href="/chart">Chart</a> page, spot and futures apart, summed across exchanges.',
          ),
        },
        {
          id: "imbalance",
          name: tr("Imbalance"),
          long: "",
          text: tr("One side trading 3x or more the other at a price."),
          see: "",
        },
        {
          id: "absorption",
          name: tr("Absorption"),
          long: "",
          text: tr("Heavy aggression, no progress."),
          see: tr(
            'Read on the <a href="/liquidations#odds">Liquidations</a> page’s Odds tab, as initiative vs absorption.',
          ),
        },
        {
          id: "initiative",
          name: tr("Initiative"),
          long: "",
          text: tr("Aggression that moves price; the opposite of absorption."),
          see: tr(
            'Read on the <a href="/liquidations#odds">Liquidations</a> page’s Odds tab, as initiative vs absorption.',
          ),
        },
        {
          id: "taker-flow",
          name: tr("Taker flow"),
          long: "",
          text: tr("The trades CVD is added up from, buys against sells."),
          see: tr(
            'Shown on the <a href="/chart">Chart</a> page, spot and futures apart, summed across exchanges.',
          ),
        },
      ],
    },
    {
      id: "volume-profile",
      title: tr("Volume profile"),
      terms: [
        {
          id: "vpoc",
          name: "VPOC",
          long: tr("volume point of control"),
          text: tr("The price with the most volume."),
          see: "",
        },
        {
          id: "value-area",
          name: tr("Value area"),
          long: "",
          text: tr("Where 70% of the volume traded."),
          see: "",
        },
        {
          id: "lvn",
          name: "LVN",
          long: tr("low-volume node"),
          text: tr("A thin price the market moved through fast."),
          see: "",
        },
        {
          id: "single-prints",
          name: tr("Single prints"),
          long: "",
          text: tr("A zone only one 30-minute period traded."),
          see: "",
        },
      ],
    },
    {
      id: "options",
      title: tr("Options and gamma"),
      terms: [
        {
          id: "gex",
          name: "GEX",
          long: tr("gamma exposure"),
          text: tr("How much dealers must buy or sell for each 1% move."),
          see: tr(
            'Shown on the <a href="/rates#gamma">Rates</a> page’s Gamma Exposure tab, and told as it moves by the market narrator at the top of every page.',
          ),
        },
        {
          id: "gamma-flip",
          name: tr("Gamma flip"),
          long: "",
          text: tr("The price where dealers' net gamma changes sign."),
          see: tr(
            'Marked on the <a href="/rates#gamma">Gamma Exposure</a> tab, and the line the market narrator reads every price against.',
          ),
        },
        {
          id: "long-short-gamma",
          name: tr("Long / short gamma"),
          long: "",
          text: tr(
            "Long: dealers' hedging sells rises and buys dips, damping moves. Short: it chases price, adding to moves.",
          ),
          see: tr('Shaded in the zones view of the <a href="/rates#gamma">Gamma Exposure</a> tab.'),
        },
        {
          id: "walls",
          name: tr("Call wall / put wall"),
          long: "",
          text: tr(
            "The strike holding the most call or put gamma; it tends to cap or floor price.",
          ),
          see: tr(
            'Shown on the <a href="/rates#gamma">Gamma Exposure</a> tab and in every market narrator line.',
          ),
        },
        {
          id: "option-delta",
          name: tr("Delta (options)"),
          long: "",
          text: tr("How much an option's price moves per point of the underlying."),
          see: tr('By strike on the <a href="/rates#delta">Rates</a> page’s Delta tab.'),
        },
        {
          id: "vega",
          name: tr("Vega"),
          long: "",
          text: tr("How much an option's price moves per point of implied volatility."),
          see: tr('By strike on the <a href="/rates#vega">Rates</a> page’s Vega tab.'),
        },
        {
          id: "theta",
          name: tr("Theta"),
          long: "",
          text: tr("What an option loses in value each day as expiry nears."),
          see: tr('By strike on the <a href="/rates#theta">Rates</a> page’s Theta tab.'),
        },
        {
          id: "iv",
          name: "IV",
          long: tr("implied volatility"),
          text: tr("The size of move the option prices expect, per year."),
          see: tr('Drawn as walls on the <a href="/rates#ivwalls">Rates</a> page’s IV Walls tab.'),
        },
        {
          id: "one-sigma",
          name: tr("1σ move"),
          long: "",
          text: tr("The day's expected move from the options: one standard deviation either side."),
          see: tr(
            'The IV walls on the <a href="/rates#ivwalls">Rates</a> page, and the IV move on <a href="/whales">Whales</a>.',
          ),
        },
        {
          id: "max-pain",
          name: tr("Max pain"),
          long: "",
          text: tr("The strike where option buyers lose the most at expiry."),
          see: tr(
            'Marked on the <a href="/rates#levels">Rates</a> page’s Ceiling &amp; Floor tab.',
          ),
        },
        {
          id: "reaction-zone",
          name: tr("Reaction zone"),
          long: "",
          text: tr("Where an IV wall and a gamma wall line up."),
          see: tr(
            'In full on the <a href="/rates#ivwalls">IV Walls</a> and <a href="/rates#levels">Ceiling &amp; Floor</a> tabs, folded on the other option tabs.',
          ),
        },
      ],
    },
    {
      id: "funding",
      title: tr("Funding and perps"),
      terms: [
        {
          id: "funding-rate",
          name: tr("Funding rate"),
          long: "",
          text: tr("What longs pay shorts, or shorts pay longs, to keep a perp near spot."),
          see: tr('Every exchange side by side on the <a href="/rates">Rates</a> page.'),
        },
        {
          id: "apr",
          name: "APR",
          long: tr("annual percentage rate"),
          text: tr("A funding rate scaled to a year, so different settlement intervals compare."),
          see: tr('The unit the <a href="/screener">Screener</a> shows by default.'),
        },
        {
          id: "settlement-interval",
          name: tr("Settlement interval"),
          long: "",
          text: tr("How often funding is paid: every 1, 4 or 8 hours."),
          see: tr('In each leg of a <a href="/screener">Screener</a> row.'),
        },
        {
          id: "funding-spread",
          name: tr("Funding spread / carry"),
          long: "",
          text: tr("Long where funding is cheap, short where it is rich, and collect the gap."),
          see: tr(
            'The pairs the <a href="/">home page</a> and the <a href="/screener">Screener</a> rank.',
          ),
        },
        {
          id: "oi",
          name: "OI",
          long: tr("open interest"),
          text: tr("Contracts still open: money in the market, not traded volume."),
          see: tr(
            'In each leg of a <a href="/screener">Screener</a> row, and per asset on the <a href="/chart">Chart</a> page.',
          ),
        },
        {
          id: "basis",
          name: tr("Basis"),
          long: "",
          text: tr("A perp or future's price minus spot."),
          see: "",
        },
        {
          id: "mark-index",
          name: tr("Mark / index price"),
          long: "",
          text: tr("Mark is the price used for liquidations; index is the spot average it tracks."),
          see: tr(
            'Each pair’s page, opened from a row on <a href="/arbitrage">Arbitrage</a>, charts the mark prices hourly.',
          ),
        },
        {
          id: "taker-maker",
          name: tr("Taker / maker"),
          long: "",
          text: tr(
            "A taker crosses the spread and pays the higher fee; a maker rests an order and waits.",
          ),
          see: tr(
            'The <a href="/markets">Exchanges</a> page prices a $10k market order with each exchange’s taker fee.',
          ),
        },
      ],
    },
    {
      id: "liquidations",
      title: tr("Liquidations and whales"),
      terms: [
        {
          id: "liquidation",
          name: tr("Liquidation"),
          long: "",
          text: tr("A position the exchange closes because its margin ran out."),
          see: tr('Every exchange’s, live, on the <a href="/liquidations">Liquidations</a> page.'),
        },
        {
          id: "whale-order",
          name: tr("Whale order"),
          long: "",
          text: tr("A resting order big enough to show on the depth chart."),
          see: tr(
            'Binance walls and Hyperliquid whale orders on the <a href="/whales">Whales</a> page.',
          ),
        },
      ],
    },
  ];
}

const CSS = `
.gl{display:grid;gap:22px;max-width:880px;margin:6px 0 24px}
.gl-group h2{margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink)}
.gl-list{margin:0;border:1px solid var(--rule);background:var(--panel)}
.gl-term{display:grid;grid-template-columns:minmax(140px,13rem) 1fr;gap:4px 18px;padding:10px 14px;border-top:1px solid var(--rule);scroll-margin-top:calc(var(--mast) + 12px)}
.gl-term:first-child{border-top:0}
.gl-term:target{background:var(--raise);box-shadow:inset 2px 0 0 var(--accent)}
.gl-term dt{margin:0;font-weight:700;color:var(--ink)}
.gl-term dt a{color:inherit;border-bottom:0}
.gl-term dt a:hover{color:var(--accent)}
.gl-term dt small{display:block;margin-top:2px;font-weight:400;font-size:11px;color:var(--muted)}
.gl-term dd{margin:0;color:var(--ink)}
.gl-see{display:block;margin-top:4px;font-size:12px;color:var(--muted)}
@media (max-width:640px){.gl-term{grid-template-columns:1fr}}
`;

function termRow(term: Term): string {
  const long = term.long ? `<small>${term.long}</small>` : "";
  const see = term.see ? `<span class="gl-see">${term.see}</span>` : "";
  return `<div class="gl-term" id="${term.id}"><dt><a href="#${term.id}">${term.name}</a>${long}</dt><dd>${term.text}${see}</dd></div>`;
}

export function glossary(data: { overview: Overview; now: number }): string {
  const body = groups()
    .map(
      (group) =>
        `<section class="gl-group" aria-labelledby="gl-${group.id}"><h2 id="gl-${group.id}">${group.title}</h2><dl class="gl-list">${group.terms.map(termRow).join("")}</dl></section>`,
    )
    .join("");
  return layout({
    title: tr("Terminology"),
    description: tr(
      "The site's terms in one line each: order flow, the volume profile, options and gamma, funding and perps, liquidations and whales.",
    ),
    path: "/glossary",
    overview: data.overview,
    now: data.now,
    body: `<style>${CSS}</style>
${helpHeading("h1", tr("Terminology"), "glossary", `<p>${tr("The words the site uses, each in one line: order flow, the volume profile, options and gamma, funding, liquidations. Every term has its own link to share: /glossary#cvd opens this page at CVD.")}</p>`)}
<div class="gl">${body}</div>`,
  });
}
