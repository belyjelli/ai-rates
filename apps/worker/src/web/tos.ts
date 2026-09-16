import type { Overview } from "../app/data";
import { layout } from "./layout";

/** When the text below last changed. Update it with any edit a reader would notice. */
const UPDATED = "16 September 2026";

/**
 * Terms of service, linked from /legal.
 *
 * Deliberately not merged into /legal: that page is disclosure — what airrates is not, what it earns
 * and what it records — and this one is the agreement for using it. Keeping them apart means the
 * privacy text stays readable without scrolling past liability clauses.
 *
 * Every factual claim here must stay true of the code, and changes with it:
 *   - the backtest rate limit: BACKTEST_LIMITER in wrangler.jsonc and withinRate in app/app.ts;
 *   - the read-only surface, GET and HEAD only: the 405 in app/app.ts;
 *   - what a page view records: app/visits.ts, described in full on /legal.
 *
 * Two things counsel must settle before launch, marked in the text rather than invented here:
 * the governing law and the entity these terms are offered by. plans/phase0-referrals-legal.md §3
 * still has entity setup open, so naming a jurisdiction would be a guess with legal effect.
 * Drafted from that checklist for counsel to review; it is not legal advice.
 */
export function tos(data: { overview: Overview; now: number }): string {
  return layout({
    title: "Terms of service",
    description: "The terms for using airrates, and the limits of what it promises.",
    path: "/tos",
    overview: data.overview,
    now: data.now,
    body: `<h1>Terms of service</h1>
<p class="lede">Last updated ${UPDATED}. These terms cover your use of this site. What airrates records about you, and how it earns money, are set out separately on <a href="/legal">Legal and privacy</a>.</p>
<div class="about-log">
<article id="acceptance">
<h2>Using this site</h2>
<ul>
<li>By using airrates you accept these terms. If you do not accept them, do not use the site.</li>
<li>These terms apply to <b>airrates.net</b> and its API. The member area on its own subdomain is a separate service; where it presents its own terms, those govern it rather than these.</li>
<li>You are responsible for complying with the laws that apply where you are. Perpetual futures are restricted or prohibited in some places, and airrates does not check your eligibility to trade anywhere.</li>
</ul>
</article>
<article id="service">
<h2>What airrates is</h2>
<ul>
<li>airrates reads funding rates, prices, open interest and volumes from exchanges' own public APIs, folds them into comparable figures, and displays them. It is a read-only information service: it holds no funds, places no orders, and has no access to any trading account of yours.</li>
<li>It is not an exchange, a broker, a dealer, an adviser or a custodian, and it does not execute, route or introduce trades.</li>
<li>Nothing on airrates is financial, investment, legal or tax advice, or an offer, solicitation or recommendation. The full disclaimer is on <a href="/legal#disclaimer">Legal and privacy</a>.</li>
</ul>
</article>
<article id="data">
<h2>Data, and what it is worth</h2>
<ul>
<li>Every figure comes from a third-party exchange. It may be delayed, incomplete, mis-scaled or plainly wrong, and exchanges disclaim the accuracy of their own data. airrates does not warrant that any figure is accurate, current or fit for any purpose.</li>
<li>Spreads, annualised rates and backtests are calculations over that data. Backtests replay past settlements; they are not predictions, and past funding does not promise future funding.</li>
<li>Figures are shown before trading fees, slippage, borrowing costs and price moves unless a page says otherwise. Check each exchange's own numbers before acting on anything here.</li>
<li>Do not use airrates as the sole basis for a trading decision, and do not treat it as a system of record. Verify anything that matters against the exchange itself.</li>
</ul>
</article>
<article id="use">
<h2>Acceptable use</h2>
<ul>
<li>You may read the site and call its <code>/v1</code> API for your own use, including automated requests at a courteous rate.</li>
<li>The backtest endpoints are rate limited to <b>20 requests a minute</b> per client at each Cloudflare location. Do not work around that limit, or any other technical measure, by distributing requests to evade it.</li>
<li>Do not impose an unreasonable load on the service, interfere with its operation, probe or attack its infrastructure, or attempt to gain access to anything not deliberately made public.</li>
<li>Do not resell airrates data as a data product, or redistribute it in bulk as a substitute for the site or its API. Quoting figures with attribution, or building on the API for your own use, is fine.</li>
<li>Do not present airrates as your own service, imply that it endorses you, or use it to mislead anyone about what the data shows.</li>
</ul>
</article>
<article id="ip">
<h2>Ownership</h2>
<ul>
<li>The site's design, text, code and the calculations it performs belong to the project. Exchange names, tickers and trademarks belong to their owners and are used only to identify where data comes from, as the <a href="/legal#independence">independence notice</a> records.</li>
<li>The underlying market data belongs to the exchanges that publish it and remains subject to their terms.</li>
</ul>
</article>
<article id="third-party">
<h2>Exchanges and outbound links</h2>
<ul>
<li>airrates links to exchanges. Those are independent services with their own terms, fees, risks and eligibility rules, and airrates is not responsible for them, for their data, or for anything that happens on them.</li>
<li>Some exchange links may be referral links that earn airrates a commission. Each is labelled where it appears, and the arrangement never affects rankings — see <a href="/legal#affiliate">Referral links</a>.</li>
</ul>
</article>
<article id="availability">
<h2>Availability and changes to the site</h2>
<ul>
<li>airrates is offered as it is, without any promise of uptime. Pages, figures, endpoints and whole features may change, break or be withdrawn without notice, and data may be missing while a collector or an exchange is unavailable.</li>
<li>Access may be limited or withdrawn where it is necessary to protect the service, or where use breaches these terms.</li>
</ul>
</article>
<article id="liability">
<h2>No warranty, and limits on liability</h2>
<ul>
<li>The site and its data are provided <b>"as is" and "as available"</b>, without warranties of any kind, express or implied, including fitness for a particular purpose, accuracy and non-infringement.</li>
<li>To the fullest extent the law allows, airrates and anyone working on it are not liable for any trading loss, lost profit, lost opportunity, or any indirect or consequential loss arising from use of the site or reliance on any figure on it.</li>
<li>Nothing in these terms excludes liability that cannot lawfully be excluded.</li>
</ul>
</article>
<article id="changes">
<h2>Changes to these terms</h2>
<ul>
<li>These terms may change. The date at the top says when the text last changed, and continuing to use the site after a change means you accept the revised terms.</li>
</ul>
</article>
<article id="law">
<h2>Governing law</h2>
<ul>
<li><b>To be completed before launch.</b> The governing law and the entity offering these terms are not yet settled, and naming either here before that is decided would be inaccurate rather than merely incomplete.</li>
</ul>
</article>
<article id="contact">
<h2>Questions</h2>
<ul>
<li>Open an issue at the <a href="https://github.com/belyjelli/ai-rates/issues">project's repository</a>.</li>
</ul>
</article>
</div>`,
  });
}
