/**
 * Markdown for agents: the same page, as an agent that asked for `Accept: text/markdown` reads it.
 * Only the page's <main> is kept (no masthead, scripts or help popovers), links are made absolute,
 * and tables become pipe tables, which is where this site's data is. A small converter for the HTML
 * layout() emits, not a general one.
 *
 * Each copy opens with a short header for the model reading it (owner, 2026-11-18): the page's
 * address, when its data was read, the JSON endpoint or MCP tool with the same figures
 * (web/agent-index.ts), and a line to cite. An assistant quoting a rate needs all four.
 */

import { agentPageFor, filled } from "./agent-index";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};
const decode = (text: string) =>
  text
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** Inline markup inside one block: links, emphasis, code. Other tags are dropped. */
function inline(html: string, origin: string): string {
  return decode(
    html
      .replace(/<a\b[^>]*?href="([^"]*)"[^>]*>(.*?)<\/a>/gis, (_, href: string, text: string) => {
        const label = text.replace(/<[^>]+>/g, "").trim();
        const url = decode(href);
        if (!label) return "";
        return url.startsWith("#")
          ? label
          : `[${label}](${url.startsWith("/") ? origin + url : url})`;
      })
      .replace(/<(b|strong)\b[^>]*>(.*?)<\/\1>/gis, "**$2**")
      .replace(/<code\b[^>]*>(.*?)<\/code>/gis, "`$1`")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<(span|small)\b[^>]*>/gi, " ")
      .replace(/<\/(span|small)>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\)\[/g, ") [")
    .replace(/\s+/g, " ")
    .trim();
}

function table(html: string, origin: string): string {
  const rows = [...html.matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gis)].map((row) =>
    [...(row[1] ?? "").matchAll(/<t[hd]\b[^>]*>(.*?)<\/t[hd]>/gis)].map((cell) =>
      inline(cell[1] ?? "", origin).replace(/\|/g, "\\|"),
    ),
  );
  const [head, ...body] = rows;
  if (!head || head.length === 0) return "";
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return `\n\n${[line(head), line(head.map(() => "---")), ...body.map(line)].join("\n")}\n\n`;
}

/** The page at `url` as Markdown, or null when it has no <main> to read. */
export function htmlToMarkdown(html: string, url: string): string | null {
  const origin = new URL(url).origin;
  const title = /<title>(.*?)<\/title>/is.exec(html)?.[1];
  // A tab loaded on its own (`/rates?panel=gamma`, `/liquidations?panel=largest`) is a fragment with
  // no document around it: all of it is the content. A whole page without <main> has nothing to read.
  const fragment = !/<html\b/i.test(html);
  const main = fragment ? html : /<main\b[^>]*>(.*)<\/main>/is.exec(html)?.[1];
  if (main === undefined) return null;
  const body = main
    // A page's brief for assistants (web/agent-brief.ts) is the one template whose content is read.
    .replace(/<template data-agent>(.*?)<\/template>/gis, "$1")
    // The asset pickers (liquidations, whales, chart, option books): hundreds of rows that are a
    // control, not content; the brief lists the same assets with their labels. Its button stays: it
    // names the asset or option book the page is showing.
    .replace(
      /<details class="wh-pick\b[^"]*"[^>]*>\s*<summary\b[^>]*>(.*?)<\/summary>.*?<\/details>/gis,
      (_, shown: string) => `<p>${shown}</p>`,
    )
    // Forms are controls (the screener's and arbitrage page's filters, the price-pair picker), and
    // HTML forms never nest, so one non-greedy match is the whole form.
    .replace(/<form\b.*?<\/form>/gis, "")
    .replace(/<(script|style|svg|button|template)\b.*?<\/\1>/gis, "")
    .replace(/<div class="help-pop".*?<\/div><\/div>/gis, "")
    .replace(/<span hidden\b.*?<\/span>/gis, "")
    .replace(/<table\b[^>]*>(.*?)<\/table>/gis, (_, inner: string) => table(inner, origin))
    .replace(
      /<h([1-6])\b[^>]*>(.*?)<\/h\1>/gis,
      (_, level: string, text: string) =>
        `\n\n${"#".repeat(Number(level))} ${inline(text, origin)}\n\n`,
    )
    .replace(/<li\b[^>]*>(.*?)<\/li>/gis, (_, text: string) => `\n- ${inline(text, origin)}`)
    // A definition list (the glossary): each term in bold before its definition.
    .replace(
      /<dt\b[^>]*>(.*?)<\/dt>\s*<dd\b[^>]*>(.*?)<\/dd>/gis,
      (_, term: string, text: string) =>
        `\n\n**${inline(term, origin)}**: ${inline(text, origin)}\n\n`,
    )
    .replace(/<\/(p|div|section|article|ul|ol|form|figure|details|summary)>/gi, "\n\n")
    .replace(/<(p|ul|ol|br)\b[^>]*>/gi, "\n");
  // Table cells and list items are already converted; the rest of the markup is inline.
  const text = body
    .split("\n")
    .map((line) =>
      line.startsWith("|") || line.startsWith("#") || line.startsWith("- ")
        ? line
        : inline(line, origin),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${header(html, url, title ? decode(title) : null)}${text}\n\n---\nSource: ${url}\n`;
}

/**
 * The copy's header, as YAML front matter: title, address, data time (layout's `data-as-of` meta,
 * when the page read the database), the API and MCP equivalents, and a citation line.
 */
function header(html: string, url: string, title: string | null): string {
  const address = new URL(url);
  // The address as read, query and all: ?window=7d and ?gex=ETH are other figures than the bare page.
  const page = `${address.origin}${address.pathname}${address.search}`;
  const asOf = /<meta name="data-as-of" content="([^"]+)"/.exec(html)?.[1];
  // A tab read on its own (?panel=) has its own figures; the page's API and tool are not its own.
  const entry = address.searchParams.has("panel") ? undefined : agentPageFor(address.pathname);
  const when = asOf ? `${asOf.slice(0, 16).replace("T", " ")} UTC` : null;
  const lines = [
    title ? `title: ${yaml(title)}` : null,
    `url: ${page}`,
    asOf ? `data_as_of: ${asOf}` : null,
    entry?.api ? `json: ${address.origin}${filled(entry.api, address.pathname)}` : null,
    entry?.mcp ? `mcp: ${entry.mcp} (server ${address.origin}/mcp)` : null,
    `cite: ${yaml(`airrates, ${page}${when ? `, data as of ${when}` : ""}`)}`,
    "note: figures as exchanges reported them; not financial advice",
  ].filter((line): line is string => line !== null);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

/** A YAML scalar: quoted when it holds anything YAML would read as structure. */
const yaml = (text: string) => (/^[\w .,·()/-]+$/.test(text) ? text : JSON.stringify(text));

/** True when the caller prefers Markdown to HTML: it lists text/markdown, and not after text/html. */
export function wantsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const lower = accept.toLowerCase();
  const md = lower.indexOf("text/markdown");
  if (md === -1) return false;
  const html = lower.indexOf("text/html");
  return html === -1 || md < html;
}

/** Addresses that end in .md and are files of their own, not a page's Markdown copy. */
const OWN_MARKDOWN = new Set(["/auth.md"]);

/**
 * `<page>.md` is that page as Markdown (`/index.md` for the home page), for the assistants and tools
 * that fetch a link as given and cannot send `Accept: text/markdown`. Returns the request for the page
 * with that header set, or null for any other address. The query string goes with it.
 */
export function markdownAddress(request: Request): Request | null {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.endsWith(".md") || path.startsWith("/.well-known/") || OWN_MARKDOWN.has(path)) {
    return null;
  }
  if (path === "/.md" || path.endsWith("/.md")) return null;
  url.pathname = path === "/index.md" ? "/" : path.slice(0, -3);
  // Built from the original so the Worker's `cf` (country, network) comes along: the visit count and
  // the load shedding read it.
  const page = new Request(url.toString(), request);
  page.headers.set("accept", "text/markdown");
  return page;
}
