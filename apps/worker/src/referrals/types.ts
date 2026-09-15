/**
 * Plain types for the referral store, kept apart from store-do.ts. That file imports
 * `cloudflare:workers` and the Worker's `Env`, which the Bun test typecheck does not know. Anything a
 * test imports must reach only this file.
 */

/** What the admin form saved: the REFERRAL_LINKS-shaped JSON, and when and by whom. */
export interface StoredReferrals {
  json: string;
  updatedAt: number;
  updatedBy: string;
}

/** The store's interface, so the admin page and the loader can be tested without a Durable Object. */
export interface ReferralStore {
  read(): Promise<StoredReferrals | null>;
  write(json: string, updatedBy: string): Promise<StoredReferrals>;
}
