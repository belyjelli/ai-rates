import { SHARE_CARD_PNG } from "./share-card.generated";

/**
 * The image a link to airrates shows on Facebook, X, Telegram and the rest (og:image / twitter:image).
 *
 * Without one, Facebook draws a bare text card and its sharing debugger flags the page. One card for
 * every page: drawing per page would spend the Worker's CPU on every crawler fetch, and a crawler
 * caches the card for weeks, so a live number on it would be stale on most shares anyway. The design
 * is scripts/share-card.html; scripts/share-card.ts renders it into share-card.generated.ts.
 */
export const SHARE_CARD_PATH = "/share-card.png";
export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 630;
export const SHARE_CARD_ALT =
  "airrates: what settled, not what might. Funding spreads, liquidations and CVD across perpetual futures exchanges.";

let decoded: Uint8Array<ArrayBuffer> | null = null;

/** The card's PNG bytes, decoded once per isolate. */
export function shareCardBytes(): Uint8Array<ArrayBuffer> {
  decoded ??= Uint8Array.from(atob(SHARE_CARD_PNG), (c) => c.charCodeAt(0));
  return decoded;
}

/** The card, or null for any other address. Needs no database. */
export function shareCardAsset(path: string): Response | null {
  if (path !== SHARE_CARD_PATH) return null;
  return new Response(shareCardBytes(), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
  });
}
