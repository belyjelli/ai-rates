import { describe, expect, test } from "bun:test";
import { SHARE_SCRIPT } from "./share";

/**
 * The share script runs in the browser, so these read it as text. What each guards was a real fault: the
 * sentiment page's chart is a bare <svg>, and the card came out with an empty plot and the caption as its title.
 */
describe("the masthead's chart button", () => {
  test("parses, and holds no template literal for the page to interpolate by accident", () => {
    expect(() => new Function(SHARE_SCRIPT)).not.toThrow();
    expect(SHARE_SCRIPT).not.toContain("${");
  });

  test("judges an element visible by its box, since an SVG has no offsetWidth", () => {
    const shown = SHARE_SCRIPT.slice(
      SHARE_SCRIPT.indexOf("const shown ="),
      SHARE_SCRIPT.indexOf("const W = 1600"),
    );
    expect(shown).toContain("getBoundingClientRect()");
    expect(shown).not.toContain("offsetWidth");
  });

  test("a chart can name itself and hand over its y-axis, and its caption becomes the subtitle", () => {
    expect(SHARE_SCRIPT).toContain("fig.dataset.shareTitle");
    expect(SHARE_SCRIPT).toContain("fig.dataset.shareY");
    expect(SHARE_SCRIPT).toContain('$("figcaption", fig)');
  });

  test("only HTML labels are laid over a plot: an SVG's own shapes are not labels", () => {
    expect(SHARE_SCRIPT).toContain("l instanceof HTMLElement");
    expect(SHARE_SCRIPT).not.toContain('for (const l of $$(":scope > :not(svg)", p))');
  });
});
