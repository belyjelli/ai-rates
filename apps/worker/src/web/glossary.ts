import type { Overview } from "../app/data";
import { helpHeading } from "./help";
import { tr } from "./i18n";
import { layout } from "./layout";

/**
 * /glossary, from the footer menu (owner, 2026-11-10): the order-flow and volume-profile words, each
 * in the one line the owner wrote for it. Each term has its own id, so a page or a chat can link
 * straight to one (/glossary#cvd) and the term lights up when it is the target.
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
          name: tr("Delta"),
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
      "Order-flow and volume-profile terms in one line each: delta, CVD, imbalance, absorption, VPOC, value area, LVN and single prints.",
    ),
    path: "/glossary",
    overview: data.overview,
    now: data.now,
    body: `<style>${CSS}</style>
${helpHeading("h1", tr("Terminology"), "glossary", `<p>${tr("The words traders use to read order flow and the volume profile, each in one line. Every term has its own link to share: /glossary#cvd opens this page at CVD.")}</p>`)}
<div class="gl">${body}</div>`,
  });
}
