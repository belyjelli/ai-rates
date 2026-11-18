import type { PinCandidate } from "./pin-finder";

/**
 * The automatic pin (app/pin-finder.ts) as one decision for every location: which story is pinned,
 * since when and until when. The section is read in every Cloudflare location on its own, each from
 * its own copy of Polymarket's answer; left to themselves, two locations could pin two stories, and
 * one could flip between two close ones every five minutes. One Durable Object instance ("current")
 * holds the pin instead, and every location's read asks it.
 *
 * THE RULES (decidePin):
 *   - A candidate is pinned for AUTO_PIN_MS when nothing is.
 *   - While a pin lasts, the same story's newer reading refreshes its figures (reasons, score) but
 *     keeps its question: the card does not jump between a story's questions.
 *   - Another story takes the pin before its time only when it scores REPLACE_RATIO times the pinned
 *     story's latest score: news big enough to push the last one aside.
 *   - When the pin's time is up it ends; the story is pinned again only if it is still the clear
 *     winner, for another AUTO_PIN_MS.
 *
 * A Durable Object rather than KV, D1 or Postgres for the reason ReferralStoreDO gives: nothing to
 * create outside the deploy (the database role the Worker has is read-only anyway). The object
 * itself is app/pin-store-do.ts; the rules are here, apart from the runtime, so tests can run them.
 */

/** How long an automatic pin lasts. */
export const AUTO_PIN_MS = 3 * 86_400_000;
/** How many times the pinned story's score another needs to take its place early. */
export const REPLACE_RATIO = 2;

export interface AutoPin extends PinCandidate {
  since: number;
  until: number;
}

export interface AutoPinStore {
  /** The pin after weighing `candidate` (null: no clear winner this read); null when none stands. */
  decide(candidate: PinCandidate | null, now: number): Promise<AutoPin | null>;
}

/** The rules, apart from the storage: the pin that stands, and whether it differs from `current`. */
export function decidePin(
  current: AutoPin | null,
  candidate: PinCandidate | null,
  now: number,
): { pin: AutoPin | null; changed: boolean } {
  const standing = current && now < current.until ? current : null;
  const expired = current !== null && standing === null;
  if (!candidate) return { pin: standing, changed: expired };
  if (!standing)
    return { pin: { ...candidate, since: now, until: now + AUTO_PIN_MS }, changed: true };
  if (candidate.story === standing.story)
    return {
      pin: { ...standing, score: candidate.score, reasons: candidate.reasons },
      changed: true,
    };
  if (candidate.score >= REPLACE_RATIO * standing.score)
    return { pin: { ...candidate, since: now, until: now + AUTO_PIN_MS }, changed: true };
  return { pin: standing, changed: expired };
}
