import { esc } from "./format";
import { tr } from "./i18n";

/**
 * THE loading animation for a chart, and the only one: bars rising and falling in the long and
 * short colours behind a spinner and a label ("Loading…", "Loading 1h bars…", "Loading NK225…").
 * Everything that waits on a chart shows it --
 *   - a tab the render left unfilled (lazyPlaceholder: Liquidations, Gamma, the macro tabs), until
 *     tabs.ts loads it;
 *   - an in-place switch, in each chart it is about to replace (CHART_SKELETON_JS: the CVD interval
 *     and asset, the Gamma book and range, the Liquidations choices), while the figures around it
 *     pulse (.chart-switching in layout.ts).
 * Styled by .chart-skel in layout.ts. Reduced motion keeps the shape and drops the movement.
 */

/** A fixed wave, not random: the same placeholder every time, so it reads as "loading", not data. */
const BARS = Array.from({ length: 48 }, (_, i) => {
  const height =
    18 + Math.round(30 * Math.abs(Math.sin(i * 0.55)) + 12 * Math.abs(Math.cos(i * 1.7)));
  return `<i class="${i % 3 === 0 ? "chart-skel-short" : "chart-skel-long"}" style="height:${height}%;animation-delay:${i * 40}ms"></i>`;
}).join("");

/** The placeholder's markup; `message` is HTML, after the spinner. role=status announces it. */
export function chartSkeleton(
  message: string,
  extra: { className?: string; attrs?: string } = {},
): string {
  return `<div class="chart-skel${extra.className ? ` ${extra.className}` : ""}" role="status"${extra.attrs ?? ""}><div class="chart-skel-bars" aria-hidden="true">${BARS}</div><p class="chart-skel-msg"><span class="spin" aria-hidden="true"></span>${message}</p></div>`;
}

/**
 * A tab this render did not fill, until tabs.ts replaces it with the tab's own markup. The words
 * tabs.ts needs on a failure ride on the element, translated here, because the script is one string
 * for every language; without JavaScript nothing would load the tab, so there is a plain link to it.
 */
export function lazyPlaceholder(href: string): string {
  return chartSkeleton(
    `<span class="lazy-msg">${tr("Loading…")}</span><noscript><a href="${esc(href)}">${tr("Open this tab")}</a></noscript>`,
    {
      className: "lazy-wait",
      attrs: ` data-fail="${esc(tr("This tab did not load."))}" data-retry="${esc(tr("Try again"))}"`,
    },
  );
}

/**
 * The same placeholder for a switch script, as a snippet for inside its IIFE (not a script of its
 * own). It defines `chartSkeleton(label)`, the element, and `skeletonInto(el, label)`, which puts one
 * in place of a chart's contents at the chart's height. The label defaults to <main data-loading>,
 * "Loading…" in the page's language.
 */
export const CHART_SKELETON_JS = `const chartSkeleton = (label) => {
    const t = document.createElement("template");
    t.innerHTML = ${JSON.stringify(chartSkeleton(""))};
    const skel = t.content.firstElementChild;
    const main = document.querySelector("main[data-loading]");
    skel.querySelector(".chart-skel-msg").append(label || (main ? main.dataset.loading : ""));
    return skel;
  };
  const skeletonInto = (el, label) => {
    const skel = chartSkeleton(label);
    const height = el.offsetHeight;
    if (height) el.style.minHeight = skel.style.minHeight = height + "px";
    el.replaceChildren(skel);
  };`;
