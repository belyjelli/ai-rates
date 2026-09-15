import { DurableObject } from "cloudflare:workers";
import type { ReferralStore, StoredReferrals } from "./types";

/**
 * The referral links entered at /admin/referrals, held in one Durable Object instance ("config").
 *
 * A Durable Object rather than KV, D1 or Postgres because it needs no resource created outside the
 * deploy: the class and its migration in wrangler.jsonc are all Cloudflare needs. It is the same
 * SQLite-backed kind as ProbeDO, which already runs on this account.
 */
export class ReferralStoreDO extends DurableObject<Env> {
  async read(): Promise<StoredReferrals | null> {
    return (await this.ctx.storage.get<StoredReferrals>("referrals")) ?? null;
  }

  async write(json: string, updatedBy: string): Promise<StoredReferrals> {
    const record: StoredReferrals = { json, updatedAt: Date.now(), updatedBy };
    await this.ctx.storage.put("referrals", record);
    return record;
  }
}

/** The single store instance every request reads. */
export function referralStore(env: Env): ReferralStore {
  const namespace = env.REFERRALS;
  return namespace.get(namespace.idFromName("config")) as unknown as ReferralStore;
}
