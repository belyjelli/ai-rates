/**
 * Whole-row links for tables whose rows each lead somewhere.
 *
 * A row that carries a link marked `data-row-link` opens that link from a click anywhere on the row,
 * not only on its text: the row is what a reader points at, and a symbol a few characters wide is a
 * small target in a wide table. The marked link stays the real one -- it is what the keyboard tabs
 * to, what a screen reader announces, and what opens in a new tab -- and this only lends its address
 * to the rest of the row.
 *
 * Left alone: a click on anything else in the row that acts by itself (another link, such as a venue
 * name, a button, a field), and a click that ends a text selection, so numbers can still be copied.
 * A modified click (cmd, ctrl, shift, alt) opens the row in a new tab, as it would on the link.
 *
 * One delegated listener on the document, for the reason slot-chart.ts gives: live.ts swaps table
 * bodies every 30 seconds, and a listener bound to a row would die with it. The CVD screener does not
 * use this -- its rows switch the chart in place (cvd.ts) -- and marks its links differently.
 */
export const ROW_LINK_SCRIPT = `(() => {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || !event.target.closest) return;
    const row = event.target.closest("tbody tr");
    if (!row || event.target.closest("a, button, input, select, textarea, label, summary, [data-help]")) return;
    const link = row.querySelector("a[data-row-link]");
    if (!link) return;
    if (String(getSelection ? getSelection() : "").trim()) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      window.open(link.href, "_blank", "noopener");
      return;
    }
    location.href = link.href;
  });
})();`;
