import { esc, formatUsd } from "./format";
import { tr } from "./i18n";
import { icon } from "./icons";
import { VENUE_BY_ID } from "./venues";

/**
 * The small tags beside a leg's ticker on the price pages (the arbitrage table and an asset's quotes),
 * and the key that explains them. Each says one thing a reader would otherwise have to work out:
 * which side to take, and why a price might not be what it seems.
 *
 *   LONG / SHORT  the cheapest and the dearest venue: the legs to buy and to sell
 *   OUTLIER       a price the mark-agreement guard excludes (migration 005/016)
 *   NO LIQ        under NO_LIQ_USD of 24h turnover: a quote with almost no trading behind it
 *   OFF-SYNC      quoted more than OFF_SYNC_MS apart from the rest, so pairing it would read the
 *                 asset's own move in the meantime as a spread
 *   VIA HL        a HIP-3 market: deployed by a third party and settled on Hyperliquid
 */
export type BadgeKind = "long" | "short" | "outlier" | "noliq" | "offsync" | "viahl";

/** 24h turnover below which a quote has "no meaningful liquidity" behind it. */
export const NO_LIQ_USD = 10_000;
/** How far apart two quotes may be seen before pairing them compares two different moments. */
export const OFF_SYNC_MS = 60_000;

function label(kind: BadgeKind): string {
  switch (kind) {
    case "long":
      return tr("LONG");
    case "short":
      return tr("SHORT");
    case "outlier":
      return tr("OUTLIER");
    case "noliq":
      return tr("NO LIQ");
    case "offsync":
      return tr("OFF-SYNC");
    case "viahl":
      return tr("VIA HL");
  }
}

export function badge(kind: BadgeKind, title = ""): string {
  return `<span class="bdg bdg-${kind}"${title ? ` title="${esc(title)}"` : ""}>${label(kind)}</span>`;
}

/**
 * The context badges a leg carries beside its side: NO LIQ, OFF-SYNC against the quote it is paired
 * with or measured against (null for none), VIA HL. Unknown turnover is not "no liquidity".
 */
export function legBadges(leg: {
  venueId: string;
  volume24hUsd: number | null;
  quotedAt: Date;
  against: Date | null;
}): string {
  const out: string[] = [];
  if (leg.volume24hUsd !== null && leg.volume24hUsd < NO_LIQ_USD) {
    out.push(
      badge(
        "noliq",
        tr("{volume} traded in 24 hours: a price with almost no trading behind it", {
          volume: formatUsd(leg.volume24hUsd),
        }),
      ),
    );
  }
  if (leg.against && leg.against.getTime() - leg.quotedAt.getTime() > OFF_SYNC_MS) {
    out.push(
      badge(
        "offsync",
        tr("Quoted {seconds}s before the price it is compared with", {
          seconds: Math.round((leg.against.getTime() - leg.quotedAt.getTime()) / 1000),
        }),
      ),
    );
  }
  if (VENUE_BY_ID.get(leg.venueId)?.type === "hip3") {
    out.push(
      badge(
        "viahl",
        tr("A HIP-3 market: listed by a third-party deployer and settled on Hyperliquid"),
      ),
    );
  }
  return out.join("");
}

/** The key: a dropdown in the price pages' bar, styled as the screener's steadiness key. */
export function badgeKey(): string {
  const row = (kind: BadgeKind, text: string) =>
    `<div class="bdg-row">${badge(kind)}<p>${text}</p></div>`;
  return `<details class="sx-pop sx-key"><summary class="sx-btn">${icon("info")} ${tr("Badges")}</summary>
<div class="sx-panel sx-right">
<p class="sx-h">${tr("What the badges mean")}</p>
${row("long", tr("The cheapest venue: the leg you buy."))}
${row("short", tr("The dearest venue: the leg you sell."))}
${row("outlier", tr("Left out of the gap: its price disagrees with the asset's deepest market by more than a real arbitrage ever does, so it is a different instrument. Hover it for how far out."))}
${row("noliq", tr("Under {volume} traded in 24 hours: a price with almost no trading behind it, which you may not be able to fill.", { volume: formatUsd(NO_LIQ_USD) }))}
${row("offsync", tr("Quoted more than a minute before the price it is compared with. Pairing the two would read the asset's own move in the meantime as a gap."))}
${row("viahl", tr("A HIP-3 market: listed by a third-party deployer and settled on Hyperliquid, with its own book and its own risks."))}
<p class="sx-note">${tr("A row offers a trade only with a LONG and a SHORT leg. Everything else is context.")}</p>
</div></details>`;
}
