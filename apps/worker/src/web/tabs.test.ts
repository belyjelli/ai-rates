import { describe, expect, test } from "bun:test";

import { TAB_SCRIPT, type Tab, tabBar } from "./tabs";

const TABS: Tab[] = [
  { id: "collector", label: "Collector", shortLabel: "Health" },
  { id: "verification", label: "Price verification", shortLabel: "Prices", badge: 3 },
];

const render = (tabs: Tab[] = TABS, activeId = "collector", actions?: string) =>
  tabBar({ name: "status", tabs, activeId, actions });

describe("tabBar", () => {
  test("marks exactly one tab active and wires each button to its own panel", () => {
    const html = render();

    expect(html).toContain('data-tabs="status"');
    expect(html).toContain('role="tablist"');
    // The active one is reachable by tab key; the rest are reached with the arrow keys, which is
    // what a tablist is expected to do and why only one carries tabindex 0.
    expect(html).toContain(
      '<button type="button" role="tab" id="tab-status-collector" class="btn-tab active" data-tab="collector" aria-selected="true" aria-controls="panel-status-collector" tabindex="0">',
    );
    expect(html).toContain('data-tab="verification"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('tabindex="-1"');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  });

  test("one sliding underline per bar, and actions only when given", () => {
    const plain = render();
    expect(plain.match(/class="tab-underline"/g)).toHaveLength(1);
    expect(plain).toContain('<span class="tab-underline" aria-hidden="true"></span>');
    expect(plain).not.toContain("tabbar-actions");

    expect(render(TABS, "collector", "<span>57 collected</span>")).toContain(
      '<div class="tabbar-actions"><span>57 collected</span></div>',
    );
  });

  test("a badge appears only above zero, so nothing to report renders as nothing", () => {
    expect(render()).toContain('<span class="tab-badge">3</span>');
    expect(render([{ id: "a", label: "A", badge: 0 }], "a")).not.toContain("tab-badge");
    expect(render([{ id: "a", label: "A" }], "a")).not.toContain("tab-badge");
    // Grouped, because a four-figure count of diverging markets is a number a reader reads.
    expect(render([{ id: "a", label: "A", badge: 1234 }], "a")).toContain(
      '<span class="tab-badge">1,234</span>',
    );
  });

  test("a short label is rendered beside the full one only when it differs", () => {
    const html = render();
    expect(html).toContain('<span class="tab-label--full">Collector</span>');
    expect(html).toContain('<span class="tab-label--short" aria-hidden="true">Health</span>');
    // Nothing to swap in: one plain label, and no duplicate for a screen reader to read twice.
    const same = render([{ id: "a", label: "Same", shortLabel: "Same" }], "a");
    expect(same).toContain('<span class="tab-label">Same</span>');
    expect(same).not.toContain("tab-label--short");
  });

  test("escapes the name, ids and labels it is handed", () => {
    const html = render([{ id: "a", label: '<b>"x" & y</b>', shortLabel: "<i>s</i>" }], "a");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<i>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;");
  });

  test("an active id matching no tab leaves every tab unselected rather than guessing one", () => {
    const html = render(TABS, "nope");
    expect(html).not.toContain('aria-selected="true"');
    expect(html).not.toContain("btn-tab active");
  });
});

describe("TAB_SCRIPT", () => {
  // The same two guards await.ts and live.ts carry: this ships on every page, so a serialisation
  // slip would break all of them at once rather than one.
  test("parses as JavaScript when embedded", () => {
    expect(() => new Function(TAB_SCRIPT)).not.toThrow();
  });

  test("cannot close its own script tag", () => {
    expect(TAB_SCRIPT.toLowerCase()).not.toContain("</script");
  });

  test("does nothing on a page with no tab bar, since it ships on all of them", () => {
    expect(TAB_SCRIPT).toContain("[data-tabs]");
    expect(TAB_SCRIPT).toContain("return");
  });
});
