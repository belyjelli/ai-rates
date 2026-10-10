import type { Overview } from "../app/data";
import { currentLocale, tr } from "./i18n";
import { layout } from "./layout";

/** When the text below last changed. Update it with any edit a reader would notice. */
const UPDATED = "9 October 2026";

/**
 * The body of a page that stays in English whatever the reader's language: legal text binds in one
 * language, and a translation would need counsel's review in every language it was offered in (owner's
 * decision, 2026-10-06). A reader in another language gets one line in theirs saying so above it, and
 * the English is marked `lang="en"` so a screen reader and the font fallback read it as English. An
 * English reader gets the body untouched. Shared with tos.ts.
 */
export function englishOnly(body: string): string {
  if (currentLocale() === "en") return body;
  return `<p class="notes">${tr("This page is available in English only. The English text is the binding version.")}</p>
<div lang="en">${body}</div>`;
}

/**
 * Disclaimer, affiliate disclosure, independence notice and privacy policy, on one page so the footer
 * needs one link.
 *
 * Every factual claim about data handling here must stay true of the code, and changes with it:
 *   - what a page view records: app/visits.ts;
 *   - the Google Analytics tag: GA_TAG in web/layout.ts (and probe/render.ts), plus the events in share.ts and install.ts;
 *   - the sessionStorage value in web/live.ts and the localStorage values in web/install.ts and
 *     web/hotkeys.ts;
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
    body: englishOnly(`<h1>Legal and privacy</h1>
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
<li>airrates has no accounts and shows no advertising. It loads no third-party fonts or images. It loads one third-party script: Google Analytics, described below.</li>
<li><b>Google Analytics.</b> To see how the site is used, every page loads Google Analytics 4 (Google Ireland Limited and Google LLC). It sets cookies in your browser (<code>_ga</code> and <code>_ga_*</code>, kept for up to two years), and it receives your IP address, your browser and device details, the page you opened, where you came from, and a few events such as using the share or install buttons. Google uses a cookie identifier to recognise a returning browser, and may process this data in the United States. airrates uses it only for aggregate statistics: it does not use it for advertising, and does not link it to any person. You can block it with your browser's tracking protection, a content blocker or Google's <a href="https://tools.google.com/dlpage/gaoptout">opt-out add-on</a>, and the site works the same without it. See <a href="https://policies.google.com/technologies/partner-sites">how Google uses data from sites that use its services</a>.</li>
<li><b>Page views.</b> Separately from Google Analytics, when you open a page airrates records the page's path, the country Cloudflare associates with the request, the language your browser asks for first (for example <code>ja</code> or <code>en-US</code>), and where you came from. That is the short source tag in the link you followed if it has one (for example <code>?ref=x</code>). Otherwise it is the name of the website that sent you (for example <code>google.com</code>), never the address of its page, or a note that you came from another airrates page or from no link at all. In this count it does not record your IP address or any identifier, so it cannot tell visitors apart or follow anyone from page to page. These counts are stored in Cloudflare Workers Analytics Engine, which keeps them for three months.</li>
<li><b>Backtest limits.</b> To stop one client overloading the backtester, its requests are counted per IP address for one minute at the Cloudflare location that served them. airrates does not store these counts.</li>
<li><b>Location.</b> Your country, as Cloudflare reports it, also decides whether a referral link may be shown to you. airrates keeps it only in the page-view count above; Google Analytics works out its own location from your IP address.</li>
<li><b>Hosting.</b> The site runs on Cloudflare, which processes requests, including IP addresses, to deliver and protect it, under <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a>.</li>
</ul>
</article>
<article id="storage">
<h2>Storage in your browser</h2>
<ul>
<li>Beyond the Google Analytics cookies above, airrates keeps up to three values in your browser, none sent to anyone. In session storage: the version of the site it last loaded, so that a page reloads once, rather than repeatedly, after a new version is released; it is deleted when you close the tab. In local storage: the time you dismissed the offer to install the site as an app, so the offer does not return for a while; it stays until you clear your site data. If you are a member and have remapped the keyboard shortcuts on <a href="/keys">Keyboard</a>, also in local storage: a copy of your keyboard profiles, so every page answers your keys without asking the member area; the profiles themselves are kept on your member account, and the copy is removed when the keyboard page finds you signed out.</li>
</ul>
</article>
<article id="contact">
<h2>Questions</h2>
<ul>
<li>Open an issue at the <a href="https://github.com/belyjelli/ai-rates/issues">project's repository</a>.</li>
</ul>
</article>
</div>`),
  });
}
