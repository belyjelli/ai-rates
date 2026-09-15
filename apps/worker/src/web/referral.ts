import { type Geo, referralAllowed } from "../app/geo";
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
  url: string | undefined,
  geo: Geo,
): string {
  if (!url || !referralAllowed(venue.id, geo)) return "";
  return `<div class="cta referral"><a class="btn" href="${esc(url)}" rel="sponsored noopener noreferrer" target="_blank">Open a ${esc(venue.name)} account <span aria-hidden="true">↗</span></a><span class="dim">Referral link: airrates may earn a commission if you sign up through it, at no cost to you. <a href="/legal#affiliate">How this works</a></span></div>`;
}
