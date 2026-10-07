/**
 * Markdown for agents: the same page, as an agent that asked for `Accept: text/markdown` reads it.
 * Only the page's <main> is kept (no masthead, scripts or help popovers), links are made absolute,
 * and tables become pipe tables, which is where this site's data is. A small converter for the HTML
 * layout() emits, not a general one.
 */

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
  const main = /<main\b[^>]*>(.*)<\/main>/is.exec(html)?.[1];
  if (main === undefined) return null;
  const body = main
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
  const heading = title ? `<!-- ${decode(title).replace(/-->/g, "")} -->\n` : "";
  return `${heading}${text}\n\n---\nSource: ${url}\n`;
}

/** True when the caller prefers Markdown to HTML: it lists text/markdown, and not after text/html. */
export function wantsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const lower = accept.toLowerCase();
  const md = lower.indexOf("text/markdown");
  if (md === -1) return false;
  const html = lower.indexOf("text/html");
  return html === -1 || md < html;
}
