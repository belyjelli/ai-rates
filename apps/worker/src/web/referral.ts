import { type Geo, type Referral, referralAllowed } from "../app/geo";
import { esc } from "./format";

/**
 * A venue's referral call-to-action, or nothing.
 *
 * Nothing unless a link is configured for the venue AND the visitor's location allows it (see
 * app/geo.ts). When it does render, the commission disclosure sits beside the link rather than in
 * the footer, because the FTC's guidance is that a footer-only disclosure is not clear and
 * conspicuous. rel="sponsored" tells search engines the link is paid.
 */
export function referralCta(
  venue: { id: string; name: string },
  referral: Referral | undefined,
  geo: Geo,
): string {
  if (!referral || !referralAllowed(venue.id, geo)) return "";
  const code = referral.code ? ` Code <code>${esc(referral.code)}</code>.` : "";
  return `<div class="cta referral">${referralButton(venue.name, referral.url)}<span class="dim">Referral link:${code} airrates may earn a commission if you sign up through it, at no cost to you. <a href="/legal#affiliate">How this works</a></span></div>`;
}

/** The sign-up link itself, marked as paid. Shared by the exchange page and /referrals. */
export function referralButton(venueName: string, url: string): string {
  return `<a class="btn" href="${esc(url)}" rel="sponsored noopener noreferrer" target="_blank">Open a ${esc(venueName)} account <span aria-hidden="true">↗</span></a>`;
}
