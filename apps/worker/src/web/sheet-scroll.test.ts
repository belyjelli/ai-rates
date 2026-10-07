import { describe, expect, test } from "bun:test";
import { layout } from "./layout";

const css = layout({ title: "t", description: "d", path: "/screener", body: "", now: 0 });

/** The rules inside one @media block of the page's stylesheet, by its query. */
function media(query: string): string {
  const start = css.indexOf(`@media (${query}){`);
  if (start < 0) throw new Error(`no @media (${query}) block`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error("unbalanced block");
}

describe("the screener's sheet scrolls to suit the screen", () => {
  test("on a phone it scrolls in a box of its own, both ways, with its header and asset column stuck", () => {
    const phone = media("max-width:860px");
    expect(phone).toContain(".sheet-wrap.stick{overflow:auto;width:auto;min-width:0;");
    // A height, so the box scrolls vertically too, and dvh so a phone's moving address bar does not hide the end.
    expect(phone).toMatch(/max-height:calc\(100vh - var\(--mast\)/);
    expect(phone).toMatch(/max-height:calc\(100dvh - var\(--mast\)/);
    expect(phone).toContain(".sheet-wrap.stick th{top:0}");
    expect(phone).toContain("td:first-child{position:sticky;left:0;");
    // The stuck column keeps the row's own stripe and hover, or the stripes tear as it scrolls.
    expect(phone).toContain("td:first-child{background:var(--band)}");
    expect(phone).toContain("td:first-child{background:#161616}");
  });

  test("with room for it, the page scrolls sideways as before; on a phone the page never widens", () => {
    const wide = media("min-width:861px");
    expect(wide).toContain(
      "body:has(.heat-wrap,.sheet-wrap.stick){width:max-content;min-width:100%}",
    );
    expect(wide).toContain("body:has(.heat-wrap,.sheet-wrap.stick) .mast{top:0}");
    // Nothing outside that block widens the page for either grid.
    const outside = css.replace(wide, "");
    expect(outside).not.toMatch(/body:has\([^)]*(sheet|heat)-wrap[^)]*\)/);
  });

  test("the heatmap scrolls in a box of its own on a phone too, its header at the box's top", () => {
    const phone = media("max-width:860px");
    expect(phone).toContain(".heat-wrap,.sheet-wrap.stick{overflow:auto;width:auto;min-width:0;");
    // .heat th sets top:var(--mast) later in the sheet, so the override has to outrank it.
    expect(phone).toContain(".heat-wrap .heat th,");
    // The asset column is stuck at every width, so on a phone it stays put inside the box.
    expect(css).toMatch(/\.heat td\.asset\{[^}]*position:sticky;left:0/);
  });

  test("the Odds tables wrap on a phone: labels take half the screen and the horizons scroll beside them", () => {
    // The stylesheet has more than one phone block; this is the one that holds the Odds rules.
    const at = css.indexOf(".heat-wrap.lq-read{");
    expect(at).toBeGreaterThan(0);
    expect(css.lastIndexOf("@media", at)).toBe(css.lastIndexOf("@media (max-width:860px){", at));
    const phone = css.slice(at, css.indexOf("\n}\n", at));
    // Wrapping cells in a fixed layout, not the heatmap's no-wrap grid.
    expect(phone).toContain(".heat-wrap.lq-read .heat{table-layout:fixed;width:100%;");
    expect(phone).toMatch(/\.lq-read \.heat td\{[^}]*white-space:normal/);
    // The label column is half the box and sticks; the table is as wide as its horizons need.
    expect(phone).toContain(".lq-read .lq-odds thead th:first-child{width:calc(50vw - 10px)}");
    expect(phone).toMatch(/\.lq-read \.lq-odds th\.asset\{position:sticky;left:0;/);
    expect(phone).toContain(".lq-read .lq-odds{min-width:calc(50vw - 10px + 256px)}");
    // The scroll box is the stylesheet's own for .lq-box, which the Odds tables share.
    expect(css).toContain(".heat-wrap.lq-box{overflow-x:auto;");
  });

  test("a long strip of links wraps rather than widening a phone's page", () => {
    expect(css).toMatch(/\n\.tf\{[^}]*flex-wrap:wrap/);
  });
});
