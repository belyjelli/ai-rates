import { type Geo, type Referral, referralAllowed } from "../app/geo";

/**
 * Who a referral is offered to.
 *
 * The first product is the public page: every code the owner enters is offered to anyone who may see
 * it. The member area at member.airrates.net will want narrower offers — a code held back for members,
 * or for members on a paid tier — so the audience travels with each referral from the start rather
 * than being retrofitted once codes are already saved.
 *
 * PROVISIONAL, deliberately. There is no member area yet, so these names are ours and not the member
 * system's. When it exists, rename here and in the admin form's labels; nothing else reads the strings.
 * The stored value of an entry with no audience is "public", so older saved data keeps working.
 */
export const AUDIENCES = ["public", "member", "vip"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const DEFAULT_AUDIENCE: Audience = "public";

/** How each audience is described to the owner in the admin form. */
export const AUDIENCE_LABEL: Record<Audience, string> = {
  public: "Everyone",
  member: "Members only",
  vip: "VIP members only",
};

export function isAudience(value: unknown): value is Audience {
  return typeof value === "string" && (AUDIENCES as readonly string[]).includes(value);
}

/**
 * Whether one audience may see what was offered to another: wider offers reach narrower viewers.
 *
 * A VIP member sees VIP, member and public codes; a member sees member and public; an anonymous
 * reader sees only public. The order is the array's own, so adding a tier between existing ones is a
 * change in one line.
 */
export function audienceSees(viewer: Audience, offered: Audience): boolean {
  return AUDIENCES.indexOf(offered) <= AUDIENCES.indexOf(viewer);
}

/**
 * The referrals this viewer may be shown: the offer must reach their audience, and the venue must be
 * allowed where they are.
 *
 * This is the one function every surface calls -- the public page, the exchange pages, and whatever
 * the member site asks on a member's behalf -- so a policy change lands in one place rather than in
 * each page's own filter.
 */
export function referralsFor(
  links: Readonly<Record<string, Referral>>,
  viewer: Audience,
  geo: Geo,
): Readonly<Record<string, Referral>> {
  const visible: Record<string, Referral> = {};
  for (const [venueId, referral] of Object.entries(links)) {
    if (!audienceSees(viewer, referral.audience)) continue;
    if (!referralAllowed(venueId, geo)) continue;
    visible[venueId] = referral;
  }
  return visible;
}
