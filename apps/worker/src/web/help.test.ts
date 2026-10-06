import { describe, expect, test } from "bun:test";
import { HELP_SCRIPT, helpButton, helpHeading } from "./help";
import { withLocale } from "./i18n";

describe("help", () => {
  test("the badge opens its own panel, natively", () => {
    const html = helpHeading("h1", "CVD", "cvd", "<p>Cumulative volume delta.</p>");
    expect(html).toContain('<h1 class="has-help">CVD<button type="button" class="help"');
    expect(html).toContain('popovertarget="help-cvd"');
    expect(html).toContain('id="help-cvd" popover');
    expect(html).toContain("<p>Cumulative volume delta.</p>");
  });

  test("the panel sits after the heading, never inside it", () => {
    const html = helpHeading("h2", "Widest spreads", "spreads", "<p>x</p>");
    expect(html.indexOf("</h2>")).toBeLessThan(html.indexOf('class="help-pop"'));
  });

  test("the label follows the reader's language", () => {
    expect(helpButton("x")).toContain('aria-label="What is this?"');
    expect(withLocale("zh", () => helpButton("x"))).toContain('aria-label="这是什么？"');
  });

  test("the script parses and closes no element early", () => {
    expect(() => new Function(HELP_SCRIPT)).not.toThrow();
    expect(HELP_SCRIPT.toLowerCase()).not.toContain("</script");
  });
});
