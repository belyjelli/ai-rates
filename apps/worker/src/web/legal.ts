import type { Overview } from "../app/data";
import { layout } from "./layout";

/** When the text below last changed. Update it with any edit a reader would notice. */
const UPDATED = "15 September 2026";

/**
 * Disclaimer, affiliate disclosure, independence notice and privacy policy, on one page so the footer
 * needs one link.
 *
 * Every factual claim about data handling here must stay true of the code, and changes with it:
 *   - what a page view records: app/visits.ts;
 *   - the one sessionStorage value: web/live.ts;
 *   - the IP-keyed backtest limiter: withinRate in app/app.ts and BACKTEST_LIMITER in wrangler.jsonc;
 *   - where referral links can appear: app/geo.ts and web/referral.ts.
 * Drafted from plans/phase0-referrals-legal.md §3 for counsel to review; it is not legal advice.
 */
export function legal(data: { overview: Overview; now: number }): string {
  return layout({
    title: "Legal and privacy",
    description: "Disclaimer, affiliate disclosure and privacy policy for airrates.",
    path: "/legal",
    overview: data.overview,
    now: data.now,
    body: `<h1>Legal and privacy</h1>
<p class="lede">Last updated ${UPDATED}. The agreement for using the site is separate: see the <a href="/tos">Terms of service</a>.</p>
<div class="about-log">
<article id="disclaimer">
<h2>Not advice</h2>
<ul>
<li>airrates is an information service. Nothing on it is financial, investment, legal or tax advice, or an offer, solicitation or recommendation to buy, sell or hold anything.</li>
<li>Funding rates, prices, open interest, volumes and backtests come from each exchange's public data. They may be delayed, incomplete or wrong, and exchanges disclaim the accuracy of their own data.</li>
<li>Spreads and backtest results are before trading fees, slippage, borrowing costs and price moves. Past funding does not predict future funding, and no figure on this site promises any return.</li>
<li>Perpetual futures are leveraged, and you can lose more than your initial margin. Check each exchange's own figures, and whether it serves where you live, before you trade.</li>
</ul>
</article>
<article id="affiliate">
<h2>Referral links</h2>
<ul>
<li>Some exchange links on airrates may be referral links. If you open an account through one, airrates may receive a commission from that exchange, at no extra cost to you.</li>
<li>Every referral link is labelled as one, beside the link itself.</li>
<li>Referral arrangements never affect which markets appear, how they are ranked, or what the numbers say. Rankings are computed from market data alone.</li>
<li>Referral links appear only where both the exchange's terms and local rules allow them, and never when your location is unknown. Visitors in the United States, Canada, the United Kingdom and sanctioned jurisdictions do not see them, and nor do visitors in the European Economic Area unless the exchange holds the authorisation required there.</li>
<li>Every referral link airrates offers where you are is listed on <a href="/referrals">Referral links</a>, sorted by exchange name.</li>
</ul>
</article>
<article id="independence">
<h2>Independence</h2>
<ul>
<li>airrates is not affiliated with, endorsed by or sponsored by any exchange it lists. Exchange names only identify where data comes from, and trademarks belong to their owners.</li>
</ul>
</article>
<article id="privacy">
<h2>Privacy</h2>
<ul>
<li>airrates has no accounts and sets no cookies. It loads no advertising, tracking or third-party scripts, fonts or images.</li>
<li><b>Page views.</b> When you open a page, airrates records the page's path, the country Cloudflare associates with the request, and the short source tag in the link you followed if it has one (for example <code>?ref=x</code>). It does not record your IP address or any identifier, so it cannot tell visitors apart or follow anyone from page to page. These counts are stored in Cloudflare Workers Analytics Engine, which keeps them for three months.</li>
<li><b>Backtest limits.</b> To stop one client overloading the backtester, its requests are counted per IP address for one minute at the Cloudflare location that served them. airrates does not store these counts.</li>
<li><b>Location.</b> Your country, as Cloudflare reports it, also decides whether a referral link may be shown to you. It is not kept beyond the page-view count above.</li>
<li><b>Hosting.</b> The site runs on Cloudflare, which processes requests, including IP addresses, to deliver and protect it, under <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a>.</li>
</ul>
</article>
<article id="storage">
<h2>Storage in your browser</h2>
<ul>
<li>airrates keeps one value in your browser's session storage: the version of the site it last loaded, so that a page reloads once, rather than repeatedly, after a new version is released. It is deleted when you close the tab and is never sent to airrates or anyone else.</li>
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
