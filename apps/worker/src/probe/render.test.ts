import { describe, expect, test } from "bun:test";
import { VENUES } from "@ai-rates/venues";
import { renderProbePage } from "./render";

describe("renderProbePage", () => {
  const html = renderProbePage(VENUES.slice(0, 2), [], Date.UTC(2026, 9, 8));

  test("wears the site's own header, so the brand sits where it does on every page", () => {
    expect(html).toContain('<header class="mast">');
    expect(html).toContain('<a class="brand" href="/">airrates');
    expect(html).toContain("<title>Venue geo-probe · airrates</title>");
  });

  test("puts its description behind the ? beside the title, not under it", () => {
    expect(html).toMatch(/<h1[^>]*>Venue geo-probe/);
    expect(html).toContain('popovertarget="help-probe"');
    expect(html).toContain("Reachability, not data");
    // The old standalone page said it carried no site navigation; it now does.
    expect(html).not.toContain("renders on its own");
  });

  test("reads no database, so the header claims no venue status", () => {
    expect(html).not.toContain("no venue has reported");
  });
});
