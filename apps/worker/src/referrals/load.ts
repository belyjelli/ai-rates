import { parseReferralLinks, type Referral } from "../app/geo";
import type { ReferralStore } from "./types";

/**
 * How long one Worker instance reuses what it read. Every request needs the links (the cache key
 * depends on whether any exist), so without this each request would call the Durable Object. A
 * save therefore reaches every page within a minute; the instance that took the save sees it at once.
 */
export const REFERRALS_TTL_MS = 60_000;

let memo: { links: Readonly<Record<string, Referral>>; loadedAt: number } | null = null;

export async function loadReferrals(
  store: ReferralStore,
  now: number = Date.now(),
  log?: (message: string) => void,
): Promise<Readonly<Record<string, Referral>>> {
  if (memo && now - memo.loadedAt < REFERRALS_TTL_MS) return memo.links;
  try {
    const record = await store.read();
    const links = parseReferralLinks(record?.json);
    memo = { links, loadedAt: now };
    return links;
  } catch (error) {
    log?.(`referral links unavailable: ${error instanceof Error ? error.message : String(error)}`);
    // The last links that were read are still valid links; with none read yet, show none.
    return memo?.links ?? {};
  }
}

/** Drops this instance's cached links, so a save shows on its next request. */
export function forgetReferrals(): void {
  memo = null;
}
