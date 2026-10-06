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
    expect(wide).toContain("body:has(.sheet-wrap.stick){width:max-content;min-width:100%}");
    // Nothing outside that block widens the page for the sheet.
    const outside = css.replace(wide, "");
    expect(outside).not.toMatch(/body:has\([^)]*sheet-wrap\.stick[^)]*\)\{width:max-content/);
  });

  test("the heatmap keeps scrolling the page, at every width", () => {
    expect(css).toContain("body:has(.heat-wrap){width:max-content;min-width:100%}");
    expect(css).toContain("body:has(.heat-wrap) .mast{top:0}");
  });
});
