import { DurableObject } from "cloudflare:workers";
import type { PinCandidate } from "./pin-finder";
import { type AutoPin, type AutoPinStore, decidePin } from "./pin-store";

/** The automatic pin's one instance (app/pin-store.ts has the rules and why it is one). */
export class PinStoreDO extends DurableObject<Env> {
  async decide(candidate: PinCandidate | null, now: number): Promise<AutoPin | null> {
    const current = (await this.ctx.storage.get<AutoPin>("pin")) ?? null;
    const { pin, changed } = decidePin(current, candidate, now);
    if (changed) {
      if (pin) await this.ctx.storage.put("pin", pin);
      else await this.ctx.storage.delete("pin");
    }
    return pin;
  }
}

/** The single instance every location asks. */
export function pinStore(env: Env): AutoPinStore {
  const namespace = env.PINS;
  return namespace.get(namespace.idFromName("current")) as unknown as AutoPinStore;
}
