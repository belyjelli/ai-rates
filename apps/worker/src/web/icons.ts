/**
 * The site's icons, drawn as SVG.
 *
 * WHY NOT GLYPHS. A glyph (⇪, ❝, ×, ▾, ▲, ⇄, →) is drawn by whichever font the reader's system picks
 * for it, at that font's weight, width and baseline, so the masthead's buttons and a table's sort mark
 * looked different on every machine; an emoji favicon is a different picture on every platform. An
 * SVG is the same lines everywhere. Each icon here is a 24-unit drawing in currentColor at 1em, so it
 * takes the text's colour and size, and is aria-hidden: the words beside it carry the meaning, and a
 * control with no words carries an aria-label.
 *
 * Arrows and signs that are part of a figure -- "↑ 3.1", a move's "↓ 12%", "1375×" -- are not icons:
 * they are read with the number (live.ts parses them as its sign) and stay text.
 */
const PATHS = {
  /** Share the chart as an image: out of the tray. */
  share: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 14v6h16v-6"/>',
  /** Cite: a pair of quotation marks. */
  quote:
    '<path fill="currentColor" stroke="none" d="M3 19c3.5-1 5.5-3.9 5.5-7.8V5H3v6.6h3c-.1 2.5-1.2 4.1-3 4.7zm10.5 0c3.5-1 5.5-3.9 5.5-7.8V5h-5.5v6.6h3c-.1 2.5-1.2 4.1-3 4.7z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  /** Leaves the site. */
  external: '<path d="M7 17L17 7M9 7h8v8"/>',
  /** Opens a menu below. */
  caret: '<path d="M6 9l6 6 6-6"/>',
  /** A sort, or what lies beyond the chart's top or bottom edge. */
  up: '<path fill="currentColor" stroke="none" d="M12 5l8 13H4z"/>',
  down: '<path fill="currentColor" stroke="none" d="M12 19L4 6h16z"/>',
  swap: '<path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/>',
  left: '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  right: '<path d="M4 12h16M14 6l6 6-6 6"/>',
} as const;

export type IconName = keyof typeof PATHS;

const svg = (name: IconName, attrs: string) =>
  `<svg ${attrs}viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;

/** An icon inline in the text, for markup. */
export function icon(name: IconName): string {
  return svg(name, 'class="ico" width="1em" height="1em" aria-hidden="true" focusable="false" ');
}

/**
 * An icon as a CSS mask image, for a ::before or ::after that cannot hold markup: paint the box with
 * `background: currentColor` (or a colour) and mask it with this. The page's img-src allows data:.
 */
export function iconMask(name: IconName): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg(name, 'xmlns="http://www.w3.org/2000/svg" ').replace(/currentColor/g, "#000"))}")`;
}

/**
 * Styles every page carries for the icons: on the text's baseline, the size of a capital. The charts
 * size every svg inside them to fill the plot (.fchart svg, .curve svg), which once stretched a whale
 * chart's edge marker over the whole figure; these selectors outrank those, so an icon stays a glyph's
 * size wherever it sits. Size one with font-size.
 */
export const ICON_CSS = `svg.ico,.fchart svg.ico,.curve svg.ico{display:inline-block;position:static;inset:auto;width:1em;height:1em;overflow:hidden;vertical-align:-.125em;flex-shrink:0}`;

/**
 * The tab's icon: the installed app's own drawing (app-icon.ts) -- the accent line, the rail with its
 * zero tick, the bar running long to short and the two markers -- in the same units, as SVG. It
 * replaced a 📟 emoji, which every platform drew differently and some not at all.
 */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="b"><stop offset="0" stop-color="#5f87ff"/><stop offset="1" stop-color="#ff5f5f"/></linearGradient></defs><rect width="100" height="100" fill="#000"/><g transform="translate(8 56.72) scale(.84)"><rect y="-30" width="100" height="4" fill="#c8f5a8"/><rect y="-1" width="100" height="2" fill="#494949"/><rect x="48.8" y="-14" width="2.4" height="28" fill="#494949"/><rect x="14" y="-4" width="72" height="8" fill="url(#b)"/><rect x="6" y="-9" width="16" height="18" fill="#5f87ff"/><rect x="78" y="-9" width="16" height="18" fill="#ff5f5f"/></g></svg>`;

export const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
