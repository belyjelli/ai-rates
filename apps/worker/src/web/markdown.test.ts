import { describe, expect, test } from "bun:test";
import { htmlToMarkdown, markdownAddress, wantsMarkdown } from "./markdown";

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

describe("the header an assistant reads first", () => {
  const html = page.replace(
    "</head>",
    '<meta name="data-as-of" content="2026-11-18T04:21:09Z"></head>',
  );
  const md = htmlToMarkdown(html, "https://airrates.net/rates?tf=7d") ?? "";

  test("names the page, the data time, the API and MCP equivalents, and a citation", () => {
    expect(md.startsWith("---\ntitle: Rates · airrates\nurl: https://airrates.net/rates\n")).toBe(
      true,
    );
    expect(md).toContain("data_as_of: 2026-11-18T04:21:09Z");
    expect(md).toContain("json: https://airrates.net/v1/rates");
    expect(md).toContain("mcp: get_asset_funding (server https://airrates.net/mcp)");
    expect(md).toContain(
      'cite: "airrates, https://airrates.net/rates, data as of 2026-11-18 04:21 UTC"',
    );
  });

  test("fills an asset page's endpoint with its asset, and leaves out what a page lacks", () => {
    const liq = htmlToMarkdown(page, "https://airrates.net/liquidations/equity/SNDK") ?? "";
    expect(liq).toContain("json: https://airrates.net/v1/liquidations?assets=SNDK");
    expect(liq).not.toContain("data_as_of");
    expect(liq).toContain("mcp: get_liquidations (server https://airrates.net/mcp)");
    const about = htmlToMarkdown(page, "https://airrates.net/about") ?? "";
    expect(about).not.toContain("json:");
    expect(about).not.toContain("mcp:");
    expect(about).toContain('cite: "airrates, https://airrates.net/about"\n');
  });
});

describe("markdownAddress", () => {
  const at = (url: string) => markdownAddress(new Request(url, { headers: { accept: "*/*" } }));

  test("turns page.md into the page, asked for as Markdown, query and all", () => {
    const md = at("https://airrates.net/liquidations.md?window=7d");
    expect(md?.url).toBe("https://airrates.net/liquidations?window=7d");
    expect(md?.headers.get("accept")).toBe("text/markdown");
    expect(at("https://airrates.net/index.md")?.url).toBe("https://airrates.net/");
    expect(at("https://airrates.net/chart/equity/NVDA.md")?.url).toBe(
      "https://airrates.net/chart/equity/NVDA",
    );
  });

  test("leaves real files and other addresses alone", () => {
    expect(at("https://airrates.net/auth.md")).toBeNull();
    expect(at("https://airrates.net/.well-known/agent-skills/airrates-api/SKILL.md")).toBeNull();
    expect(at("https://airrates.net/liquidations")).toBeNull();
    expect(at("https://airrates.net/.md")).toBeNull();
  });
});
