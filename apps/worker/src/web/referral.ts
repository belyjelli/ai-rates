import type { Geo, Referral } from "../app/geo";
import { referralsFor } from "../referrals/policy";
import { esc } from "./format";
import { tr } from "./i18n";

/**
 * A venue's referral call-to-action, or nothing.
 *
 * Nothing unless a link is configured for the venue, it is offered to the public, AND the visitor's
 * location allows it. This page has no reader identity, so it asks for the public audience only: a
 * members-only code must never appear on the open site (referrals/policy.ts).
 *
 * When it does render, the commission disclosure sits beside the link rather than in the footer,
 * because the FTC's guidance is that a footer-only disclosure is not clear and conspicuous.
 * rel="sponsored" tells search engines the link is paid.
 */
export function referralCta(
  venue: { id: string; name: string },
  referral: Referral | undefined,
  geo: Geo,
): string {
  if (!referral) return "";
  if (!referralsFor({ [venue.id]: referral }, "public", geo)[venue.id]) return "";
  const how = `<a href="/legal#affiliate">${tr("How this works")}</a>`;
  const disclosure = referral.code
    ? tr(
        "Referral link: Code {code}. airrates may earn a commission if you sign up through it, at no cost to you. {how}",
        { code: `<code>${esc(referral.code)}</code>`, how },
      )
    : tr(
        "Referral link: airrates may earn a commission if you sign up through it, at no cost to you. {how}",
        { how },
      );
  return `<div class="cta referral">${referralButton(venue.name, referral.url)}<span class="dim">${disclosure}</span></div>`;
}

/** The sign-up link itself, marked as paid. Shared by the exchange page and /referrals. */
export function referralButton(venueName: string, url: string): string {
  return `<a class="btn" href="${esc(url)}" rel="sponsored noopener noreferrer" target="_blank">${tr("Open a {venue} account", { venue: esc(venueName) })} <span aria-hidden="true">↗</span></a>`;
}
