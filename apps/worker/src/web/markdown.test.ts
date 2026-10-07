import { describe, expect, test } from "bun:test";
import { htmlToMarkdown, wantsMarkdown } from "./markdown";

const page = `<!doctype html><html><head><title>Rates · airrates</title><script>var x=1</script></head>
<body><header class="mast"><a href="/">airrates</a></header>
<main class="wrap"><h1 class="has-help">Rates<button type="button" class="help">?</button></h1>
<div class="help-pop" id="h" popover><p class="help-head">About</p><div class="help-body"><p>hidden help</p></div></div>
<p>Funding is <b>annualised</b> &amp; shown as <code>APR</code>. See <a href="/about">about</a>.</p>
<table><thead><tr><th>asset</th><th>spread</th></tr></thead><tbody><tr><td><a href="/markets/asset/BTC">BTC</a></td><td><span hidden data-cite="x"></span>+40.6%</td></tr></tbody></table>
<ul><li>one</li><li><a href="https://example.com/">two</a></li></ul>
</main><script>track()</script></body></html>`;

describe("htmlToMarkdown", () => {
  const md = htmlToMarkdown(page, "https://airrates.net/rates") ?? "";

  test("keeps the main content and drops the chrome", () => {
    expect(md).toContain("# Rates");
    expect(md).not.toContain("airrates](");
    expect(md).not.toContain("track()");
    expect(md).not.toContain("hidden help");
    expect(md).not.toContain("?");
  });

  test("makes links absolute and inline markup readable", () => {
    expect(md).toContain(
      "Funding is **annualised** & shown as `APR`. See [about](https://airrates.net/about).",
    );
    expect(md).toContain("- [two](https://example.com/)");
  });

  test("keeps adjacent links apart", () => {
    const two = htmlToMarkdown(
      '<main><div><a href="/a">a</a><a href="/b">b</a></div></main>',
      "https://airrates.net/",
    );
    expect(two).toContain("[a](https://airrates.net/a) [b](https://airrates.net/b)");
  });

  test("turns tables into pipe tables", () => {
    expect(md).toContain(
      "| asset | spread |\n| --- | --- |\n| [BTC](https://airrates.net/markets/asset/BTC) | +40.6% |",
    );
  });

  test("ends with the source, and gives nothing for a page without <main>", () => {
    expect(md.trimEnd().endsWith("Source: https://airrates.net/rates")).toBe(true);
    expect(htmlToMarkdown("<html><body>x</body></html>", "https://airrates.net/")).toBeNull();
  });
});

describe("wantsMarkdown", () => {
  test("only when markdown is asked for ahead of html", () => {
    expect(wantsMarkdown("text/markdown")).toBe(true);
    expect(wantsMarkdown("text/markdown, text/html;q=0.5")).toBe(true);
    expect(wantsMarkdown("text/html, text/markdown")).toBe(false);
    expect(wantsMarkdown("text/html,application/xhtml+xml,*/*")).toBe(false);
    expect(wantsMarkdown(null)).toBe(false);
  });
});
