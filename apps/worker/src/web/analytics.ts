/**
 * Google Analytics 4 for airrates.net: the tag, first thing in <head> as Google asks, and the script
 * that reports what a reader does on a page beyond opening it.
 *
 * Two properties take the same data. G-XCSJH74QFF has counted the site since bdbb2f4; the owner added
 * G-PJNK8JFLTQ on 2026-11-15. gtag.js loads once and sends every hit to each configured property. The
 * member area on its own subdomain reports to a third (G-16FWXNVQ9C), so the two audiences stay apart.
 *
 * Every page_view carries content_group, the address's first segment (liquidations, chart, rates;
 * home for /), so a section's many asset pages add up in one row. Every hit carries the user property
 * member (yes / no) from MEMBER_COOKIE. The member site reports to G-PJNK8JFLTQ as well, and both
 * sites share Google's cookie on airrates.net, so a reader's path from a page here to signing up there
 * is one journey in that property; its sign_up and login events come from there.
 *
 * Opening a page is a page_view on its own. Most of what happens after that is not: a tab switch
 * only rewrites the #hash (tabs.ts), a picker or window strip swaps a panel in place, the Cmd+K search
 * never loads a page. INTERACTION_SCRIPT reports those, with one listener per event type on the
 * document, so a control added later is counted without touching this file:
 *   select_tab       a tab in any tab bar: tab_group (the bar's data-tabs), tab_id, member_tab
 *   language_change  the dock's language menu: language
 *   member_link      a link into the member site (sign up, log in, alerts, the dock's login), the
 *                    funnel's middle step: member_target, ui_area, ui_label
 *   ui_click         any other link, button, disclosure, search result or clickable table row:
 *                    ui_area (where on the page), ui_kind, ui_label (its visible name), link_url
 *   ui_change        a dropdown, checkbox, radio, slider or date: ui_area, ui_label, ui_value
 *   search           what was typed into Cmd+K, once typing pauses: search_term
 * share.ts and install.ts send their own named events through the same gtag as before.
 *
 * What it never sends: anything typed into a text field other than the site search, and the query
 * string of a link off the site. legal.ts says what is collected; change both together.
 *
 * Inline scripts are allowed by hash (app/security-headers.ts), computed from each page as it is
 * rendered, so editing either script here needs no policy change.
 */

export const GA_IDS = ["G-XCSJH74QFF", "G-PJNK8JFLTQ"] as const;

/**
 * Set by the member site at sign-in for all of airrates.net and cleared at log-out (profitlock-member
 * src/session.ts), holding only "1": it lets both sites tell a member from a visitor, as the GA user
 * property `member`. The session itself stays in the member site's own HttpOnly cookie.
 */
export const MEMBER_COOKIE = "airrates_member";

export const GA_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_IDS[0]}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('set', 'user_properties', { member: /(?:^|; )${MEMBER_COOKIE}=1/.test(document.cookie) ? 'yes' : 'no' });
  var section = location.pathname.split('/')[1] || 'home';

${GA_IDS.map((id) => `  gtag('config', '${id}', { content_group: section });`).join("\n")}
</script>`;

/**
 * Plain text rather than a serialised function, as tabs.ts explains: this Worker's tsconfig has no DOM
 * lib. It must not throw on any page, and it does nothing at all when the GA tag is blocked.
 */
export const INTERACTION_SCRIPT = `(() => {
  const MEMBER_SITE = "https://member.airrates.net";
  const send = (name, params) => { try { if (window.gtag) window.gtag("event", name, params); } catch (e) {} };
  const clip = (s, n) => String(s || "").replace(/\\s+/g, " ").trim().slice(0, n);
  // Where on the page, from the nearest landmark that names itself; stable across languages.
  const area = (el) => {
    const bar = el.closest("[data-tabs]");
    if (bar) return "tabs:" + bar.getAttribute("data-tabs");
    const panel = el.closest("[data-tab-panel]");
    if (panel) return "panel:" + panel.getAttribute("data-tab-panel");
    if (el.closest("#cmdk")) return "search";
    if (el.closest(".narr")) return "narrator";
    if (el.closest("footer.dock")) return "dock";
    if (el.closest("header")) return "masthead";
    if (el.closest("[role=dialog]")) return "dialog";
    const box = el.closest("section[id],article[id],form[id]");
    return box ? "section:" + box.id : "page";
  };
  const label = (el) =>
    clip(el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent, 80);
  // A link on the site keeps its query and hash (they name the asset, window and tab); a link off it
  // keeps only its address, so nothing a referral or another site put in the query is sent on.
  const where = (a) => {
    try {
      const u = new URL(a.getAttribute("href"), location.href);
      return clip(u.origin === location.origin ? u.pathname + u.search + u.hash : u.origin + u.pathname, 100);
    } catch (e) { return ""; }
  };

  document.addEventListener("click", (event) => {
    const t = event.target;
    if (!t || !t.closest || event.button !== 0) return;
    const tab = t.closest("[role=tab][data-tab]");
    if (tab) {
      const bar = tab.closest("[data-tabs]");
      send("select_tab", {
        tab_group: bar ? bar.getAttribute("data-tabs") : "",
        tab_id: tab.getAttribute("data-tab"),
        member_tab: tab.querySelector(".tab-lock") ? "yes" : "no",
      });
      return;
    }
    const lang = t.closest("a[data-lang]");
    if (lang) {
      send("language_change", { language: lang.getAttribute("hreflang") || "" });
      return;
    }
    // A way into the member site: the step between reading and signing up, for the sign-up funnel.
    const anchor = t.closest("a[href]");
    const href = anchor ? anchor.getAttribute("href") : "";
    const toMember = href === MEMBER_SITE || href.startsWith(MEMBER_SITE + "/") ? anchor : null;
    if (toMember) {
      const path = new URL(href).pathname;
      const target = path.startsWith("/member/signup") ? "signup"
        : path.startsWith("/member/login") ? "login"
        : path.startsWith("/member/alerts") ? "alerts"
        : path.startsWith("/member") ? "member"
        : path === "/" ? "home"
        : path.split("/")[1] || "other";
      send("member_link", { member_target: target, ui_area: area(toMember), ui_label: label(toMember) });
      return;
    }
    const el = t.closest("a[href],button,summary,[role=button],[role=option]");
    if (el) {
      const kind = el.tagName === "A" ? "link"
        : el.tagName === "SUMMARY" ? "disclosure"
        : el.getAttribute("role") === "option" ? "result"
        : "button";
      const params = { ui_area: area(el), ui_kind: kind, ui_label: label(el) };
      if (el.tagName === "A") params.link_url = where(el);
      send("ui_click", params);
      return;
    }
    // A table row that opens its asset (row-link.ts) is a link the reader never sees as one.
    const row = t.closest("tbody tr");
    const rowLink = row && !t.closest("input,select,textarea,label") ? row.querySelector("a[data-row-link]") : null;
    if (rowLink) send("ui_click", { ui_area: area(row), ui_kind: "row", ui_label: label(rowLink), link_url: where(rowLink) });
  }, true);

  document.addEventListener("change", (event) => {
    const el = event.target;
    if (!el || !el.matches || !el.matches("select,input[type=checkbox],input[type=radio],input[type=range],input[type=date]")) return;
    const named = el.getAttribute("aria-label") || el.getAttribute("name") || el.id ||
      (el.labels && el.labels[0] ? el.labels[0].textContent : "");
    const value = el.type === "checkbox" ? (el.checked ? "on" : "off") : el.value;
    send("ui_change", { ui_area: area(el), ui_label: clip(named, 80), ui_value: clip(value, 100) });
  }, true);

  // Cmd+K: the words people look for, sent once typing pauses rather than per key.
  let pause = 0;
  document.addEventListener("input", (event) => {
    const el = event.target;
    if (!el || !el.closest || !el.closest("#cmdk")) return;
    clearTimeout(pause);
    pause = setTimeout(() => {
      const term = clip(el.value, 100);
      if (term.length >= 2) send("search", { search_term: term });
    }, 1200);
  }, true);
})();`;
