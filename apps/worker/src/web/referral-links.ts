import { VENUES, type Venue } from "@ai-rates/venues";
import type { Overview } from "../app/data";
import { type Geo, globallyBlocked, type Referral } from "../app/geo";
import { referralsFor } from "../referrals/policy";
import { esc } from "./format";
import { layout } from "./layout";
import { referralButton } from "./referral";

const TYPE_LABEL: Record<string, string> = { cex: "CEX", dex: "DEX", hip3: "HIP-3" };

/**
 * /referrals: every exchange airrates has a referral link for, so a reader without an account can
 * open one through it.
 *
 * Every rule the exchange-page CTA follows applies here too, because a page of referral links is a
 * promotion in exactly the places a single link is:
 *   - a row appears only where app/geo.ts allows that venue for this visitor;
 *   - an unknown or globally blocked location sees a notice and no links at all;
 *   - the commission disclosure sits directly above the table, not in the footer;
 *   - rows sort by exchange name, never by commission (checklist §3);
 *   - links carry rel="sponsored".
 * The links themselves come from REFERRAL_LINKS configuration; until any are set the page says so.
 */
export function referralLinks(data: {
  overview: Overview;
  now: number;
  geo: Geo;
  links: Readonly<Record<string, Referral>>;
  venues?: readonly Venue[];
}): string {
  const { overview, now, geo, links, venues = VENUES } = data;

  // This page has no reader identity, so it shows public offers only; a members-only code is held
  // back for member.airrates.net (referrals/policy.ts).
  const publicLinks = Object.fromEntries(
    Object.entries(links).filter(([, referral]) => referral.audience === "public"),
  );
  const configured = venues
    .filter((venue) => !venue.aliasOf && !venue.retired && publicLinks[venue.id])
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const visible = referralsFor(publicLinks, "public", geo);
  const shown = configured.filter((venue) => visible[venue.id]);
  const blockedHere = globallyBlocked(geo);

  const disclosure = `<p class="notes"><b>Disclosure.</b> airrates may earn a commission if you open an account through a link on this page, at no extra cost to you. Referral links never affect which markets appear or how they are ranked. A listing here is not a recommendation: check that an exchange serves where you live before signing up, and remember that perpetual futures are leveraged and can lose more than your margin. <a href="/legal#affiliate">How referral links work</a></p>`;

  let content: string;
  if (configured.length === 0) {
    content = `<div class="sheet-wrap"><p class="empty">No referral links yet.</p></div>`;
  } else if (blockedHere) {
    content = `<div class="sheet-wrap"><p class="empty">Referral links are not shown in your location.</p></div>`;
  } else if (shown.length === 0) {
    content = `<div class="sheet-wrap"><p class="empty">None of these exchanges' referral links can be shown in your location.</p></div>`;
  } else {
    const rows = shown
      .map((venue) => {
        const referral = publicLinks[venue.id] as Referral;
        const code = referral.code
          ? `<code>${esc(referral.code)}</code>`
          : '<span class="dim" title="The link applies the referral itself">–</span>';
        return `<tr data-k="${esc(venue.id)}">
<td><a href="/markets/exchange/${encodeURIComponent(venue.id)}">${esc(venue.name)}</a></td>
<td class="dim">${TYPE_LABEL[venue.type] ?? esc(venue.type)}</td>
<td>${code}</td>
<td>${referralButton(venue.name, referral.url)}</td>
</tr>`;
      })
      .join("");
    const hidden = configured.length - shown.length;
    content = `<div class="sheet-wrap"><table class="sheet"><thead><tr><th>Exchange</th><th>Type</th><th>Referral code</th><th>Sign up</th></tr></thead><tbody>${rows}</tbody></table></div>${
      hidden > 0
        ? `<p class="notes">${hidden} more ${hidden === 1 ? "exchange's link is" : "exchanges' links are"} not available in your location.</p>`
        : ""
    }`;
  }

  return layout({
    title: "Referral links",
    description:
      "Referral links for the exchanges airrates tracks, for readers opening a new account.",
    path: "/referrals",
    overview,
    now,
    body: `<h1>Referral links</h1>
<p class="lede">The exchanges airrates has a referral link for. If you don't have an account on one yet, you can open it through the link.</p>
${disclosure}
${content}`,
  });
}
