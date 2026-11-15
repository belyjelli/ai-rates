import { describe, expect, test } from "bun:test";
import { contentSecurityPolicy, inlineScripts } from "../app/security-headers";
import { GA_IDS, GA_TAG, INTERACTION_SCRIPT } from "./analytics";
import { layout } from "./layout";

/**
 * Just enough of a DOM to run INTERACTION_SCRIPT for real: elements with attributes, parents,
 * closest/matches over the simple selectors the script uses (tag, #id, .class, [attr], [attr=value],
 * comma lists and one descendant step), and a document that keeps its listeners.
 */
class El {
  parent: El | null = null;
  children: El[] = [];
  value = "";
  checked = false;
  labels: El[] = [];
  constructor(
    readonly tagName: string,
    readonly attrs: Record<string, string> = {},
    readonly text = "",
  ) {}
  add(...kids: El[]): this {
    for (const kid of kids) {
      kid.parent = this;
      this.children.push(kid);
    }
    return this;
  }
  get id(): string {
    return this.attrs.id ?? "";
  }
  get type(): string {
    return this.attrs.type ?? "";
  }
  get textContent(): string {
    return this.text + this.children.map((c) => c.textContent).join("");
  }
  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const steps = part.trim().split(/\s+/);
      if (!one(this, steps[steps.length - 1] ?? "")) return false;
      if (steps.length === 1) return true;
      for (let up = this.parent; up; up = up.parent) if (one(up, steps[0] ?? "")) return true;
      return false;
    });
  }
  closest(selector: string): El | null {
    for (let el: El | null = this; el; el = el.parent) if (el.matches(selector)) return el;
    return null;
  }
  querySelector(selector: string): El | null {
    for (const kid of this.children) {
      if (kid.matches(selector)) return kid;
      const deeper = kid.querySelector(selector);
      if (deeper) return deeper;
    }
    return null;
  }
}

function one(el: El, compound: string): boolean {
  const tag = /^[a-z]+/i.exec(compound)?.[0];
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  for (const [, id] of compound.matchAll(/#([\w-]+)/g)) if (el.id !== id) return false;
  for (const [, cls] of compound.matchAll(/\.([\w-]+)/g)) {
    if (!(el.attrs.class ?? "").split(/\s+/).includes(cls ?? "")) return false;
  }
  for (const [, name, value] of compound.matchAll(/\[([\w-]+)(?:=([\w-]+))?\]/g)) {
    const got = el.attrs[name ?? ""];
    if (got === undefined || (value !== undefined && got !== value)) return false;
  }
  return true;
}

const el = (tag: string, attrs: Record<string, string> = {}, text = "") =>
  new El(tag.toUpperCase(), attrs, text);

function run() {
  const listeners: Record<string, (e: unknown) => void> = {};
  const sent: [string, Record<string, unknown>][] = [];
  const timers: (() => void)[] = [];
  const window = {
    gtag: (_kind: string, name: string, params: Record<string, unknown>) =>
      sent.push([name, params]),
  };
  const document = {
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
  };
  new Function("window", "document", "location", "setTimeout", "clearTimeout", INTERACTION_SCRIPT)(
    window,
    document,
    { href: "https://airrates.net/liquidations", origin: "https://airrates.net" },
    (fn: () => void) => timers.push(fn),
    () => timers.splice(0),
  );
  const fire = (type: string, target: El) => listeners[type]?.({ target, button: 0 });
  return { sent, fire, timers };
}

describe("the Google tag", () => {
  test("loads gtag.js once and configures both properties", () => {
    expect(GA_IDS).toEqual(["G-XCSJH74QFF", "G-PJNK8JFLTQ"]);
    expect(GA_TAG.match(/gtag\/js\?id=/g)).toHaveLength(1);
    expect(GA_TAG).toContain("gtag('config', 'G-XCSJH74QFF');");
    expect(GA_TAG).toContain("gtag('config', 'G-PJNK8JFLTQ');");
  });

  test("every page carries the tag and the interaction script, and the policy lets both run", () => {
    const html = layout({ title: "t", description: "d", path: "/x", body: "<p>x</p>", now: 0 });
    expect(html).toContain("gtag('config', 'G-PJNK8JFLTQ');");
    const scripts = inlineScripts(html);
    expect(scripts).toContain(INTERACTION_SCRIPT);
    // The policy is built from the hashes of these scripts, so a page's own copy is always allowed.
    expect(contentSecurityPolicy(["'sha256-x'"])).toContain("https://*.googletagmanager.com");
  });
});

describe("what a reader does on a page", () => {
  test("parses, and does nothing when Google's tag is blocked", () => {
    expect(() => new Function(INTERACTION_SCRIPT)).not.toThrow();
    const listeners: Record<string, (e: unknown) => void> = {};
    new Function("window", "document", INTERACTION_SCRIPT)(
      {},
      { addEventListener: (t: string, f: (e: unknown) => void) => (listeners[t] = f) },
    );
    const button = el("button", {}, "Copy");
    expect(() => listeners.click?.({ target: button, button: 0 })).not.toThrow();
  });

  test("a tab is select_tab, with its bar and whether it is a member tab", () => {
    const { sent, fire } = run();
    const lock = el("span", { class: "tab-lock" });
    const winners = el("button", { role: "tab", "data-tab": "winners" }, "Top traders").add(lock);
    el("div", { "data-tabs": "liq" }).add(el("div", { role: "tablist" }).add(winners));
    fire("click", lock);
    expect(sent).toEqual([
      ["select_tab", { tab_group: "liq", tab_id: "winners", member_tab: "yes" }],
    ]);
  });

  test("a link says where it was and where it goes; a link off the site loses its query", () => {
    const { sent, fire } = run();
    const strip = el("a", { href: "?window=24h#largest" }, "24h");
    const out = el("a", { href: "https://www.binance.com/en/futures?ref=ABC123" }, "Binance");
    el("div", { "data-tab-panel": "largest" }).add(strip, out);
    fire("click", strip);
    fire("click", out);
    expect(sent).toEqual([
      [
        "ui_click",
        {
          ui_area: "panel:largest",
          ui_kind: "link",
          ui_label: "24h",
          link_url: "/liquidations?window=24h#largest",
        },
      ],
      [
        "ui_click",
        {
          ui_area: "panel:largest",
          ui_kind: "link",
          ui_label: "Binance",
          link_url: "https://www.binance.com/en/futures",
        },
      ],
    ]);
  });

  test("buttons, the dock's language menu and a clickable table row are each reported", () => {
    const { sent, fire } = run();
    const help = el("button", { "aria-label": "What is this?" }, "?");
    el("header").add(help);
    const zh = el("a", { href: "/zh/liquidations", "data-lang": "", hreflang: "zh-Hans" }, "中文");
    el("footer", { class: "dock" }).add(zh);
    const cell = el("td", {}, "$701M");
    const asset = el("a", { href: "/liquidations/BTC", "data-row-link": "" }, "BTC");
    el("section", { id: "largest" }).add(el("tbody").add(el("tr").add(el("td").add(asset), cell)));
    fire("click", help);
    fire("click", zh);
    fire("click", cell);
    expect(sent).toEqual([
      ["ui_click", { ui_area: "masthead", ui_kind: "button", ui_label: "What is this?" }],
      ["language_change", { language: "zh-Hans" }],
      [
        "ui_click",
        {
          ui_area: "section:largest",
          ui_kind: "row",
          ui_label: "BTC",
          link_url: "/liquidations/BTC",
        },
      ],
    ]);
  });

  test("a picker or checkbox is ui_change; a text field other than search is never sent", () => {
    const { sent, fire } = run();
    const asset = el("select", { name: "asset" });
    asset.value = "ETH";
    const box = el("input", { type: "checkbox", "aria-label": "Only longs" });
    box.checked = true;
    const note = el("input", { type: "text", name: "note" });
    note.value = "my email is someone@example.com";
    el("div", { "data-tab-panel": "whales" }).add(asset, box, note);
    fire("change", asset);
    fire("change", box);
    fire("change", note);
    fire("input", note);
    expect(sent).toEqual([
      ["ui_change", { ui_area: "panel:whales", ui_label: "asset", ui_value: "ETH" }],
      ["ui_change", { ui_area: "panel:whales", ui_label: "Only longs", ui_value: "on" }],
    ]);
  });

  test("Cmd+K sends what was searched once typing pauses, not per key", () => {
    const { sent, fire, timers } = run();
    const input = el("input", { type: "text", role: "combobox" });
    el("div", { id: "cmdk" }).add(el("label").add(input));
    for (const typed of ["h", "hy", "hyp", "hype"]) {
      input.value = typed;
      fire("input", input);
    }
    expect(timers).toHaveLength(1);
    timers[0]?.();
    expect(sent).toEqual([["search", { search_term: "hype" }]]);
  });
});
