import type { BetAnswer, BetEvent, BetLine, BetsRead, BetVenue } from "../app/bet-types";
import { chartSkeleton } from "./chart-skeleton";
import { esc, formatUsd } from "./format";
import { helpButton, helpPanel } from "./help";
import { tr, trMsg } from "./i18n";
import { timeTag } from "./localtime";
import { MONTHS } from "./slot-chart";

/**
 * The homepage's "What the crowd is betting on" (app/bets.ts): prediction markets on Polymarket and
 * Kalshi. Two events lead, each with its answers' chances, their change over the day and a chart of
 * the odds since the market opened -- the one the owner pinned (app/bets.ts PINS) and the most traded
 * of the last 24 hours on either venue -- and the next most traded follow in a table. Sports and the
 * self-repeating short questions are left out.
 *
 * WHY ON THE HOMEPAGE. Owner, 2026-11-18: a section for the bets people are most interested in, with
 * Jensen Huang's return to NVIDIA (Polymarket's busiest non-sports question that day, $2.0M in 24
 * hours) pinned for a week, Kalshi beside Polymarket, above the widest spreads. Where the money goes
 * on these markets is a read of what traders are watching, beside what they pay in funding.
 *
 * LOADED AFTER THE PAGE. The homepage is the database's page; the venues are a second, slower source
 * (about 2 s for a cold read), so the section ships as THE loading animation (chart-skeleton.ts) and
 * BETS_SCRIPT fetches its contents from BETS_PATH. A failed read leaves the rest of the page as it is.
 */

export const BETS_PATH = "/data/bets";

const MINUS = "−";
/** The chart's lines, in the funding chart's order: none is the long or short colour. */
const COLOURS = ["var(--accent)", "var(--warn)", "var(--em)", "var(--cyan)"];
const DAY_MS = 86_400_000;
const VENUE_NAME: Record<BetVenue, string> = { polymarket: "Polymarket", kalshi: "Kalshi" };
const VENUE_HOME: Record<BetVenue, string> = {
  polymarket: "https://polymarket.com/",
  kalshi: "https://kalshi.com/",
};

/** A probability as a whole percent, a sliver as "<1%". */
const prob = (p: number) =>
  p > 0 && p < 0.005 ? "&lt;1%" : p < 1 && p > 0.995 ? "&gt;99%" : `${Math.round(p * 100)}%`;
/** A change in percentage points, signed. */
const pp = (change: number | null): { text: string; tone: string } => {
  if (change === null) return { text: "–", tone: "dim" };
  const d = Math.round(change * 100);
  if (d === 0) return { text: "0", tone: "dim" };
  return { text: `${d > 0 ? "+" : MINUS}${Math.abs(d)}`, tone: d > 0 ? "mc-up" : "mc-down" };
};
const outLink = (href: string, inner: string) =>
  `<a href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>`;
const venueLinks = () =>
  (["polymarket", "kalshi"] as const)
    .map((v) => outLink(VENUE_HOME[v], `${VENUE_NAME[v]} ↗`))
    .join(" · ");
/** An answer's label; a single Yes/No market's one answer is the word Yes, in the page's language. */
const answerLabel = (event: BetEvent, a: BetAnswer) =>
  event.answers.length === 1 && a.label === "Yes" ? tr("Yes") : esc(a.label);
const day = (ms: number) => {
  const d = new Date(ms);
  return `${trMsg(MONTHS[d.getUTCMonth()] ?? "")} ${d.getUTCDate()}`;
};

/** The homepage's section: its heading and help, and the placeholder BETS_SCRIPT fills. */
export function betsSection(): string {
  return `<section class="bets">
<div class="section-head"><h2 class="has-help">${tr("What the crowd is betting on")}${helpButton("bets")}</h2><span class="bets-venues">${venueLinks()}</span></div>
${helpPanel(
  "bets",
  `<p>${tr("Prediction markets on Polymarket and Kalshi: the question we pinned, the one with the most money traded over the last 24 hours on either venue, and the next ones, at least three from each venue. Sports are left out, and so are the short questions that repeat every day or week (today's Bitcoin range, tomorrow's weather, a week of tweets).")}</p><p>${tr("A price is the crowd's chance: a Yes share at 9¢ pays $1 if it happens, so the crowd puts it at 9%. Kalshi counts its volume in contracts that pay $1; here it is contracts times their price, the dollars paid, as Polymarket counts it. The charts are each venue's own price history. Read every five minutes.")}</p>`,
)}
<div class="bets-box" data-bets-src="${BETS_PATH}" aria-busy="true">${chartSkeleton(
    `<span class="lazy-msg">${tr("Loading…")}</span><noscript><a href="${BETS_PATH}">${tr("Prediction markets")}</a> · ${venueLinks()}</noscript>`,
    {
      className: "lazy-wait",
      attrs: ` data-fail="${esc(tr("The prediction markets could not be read just now."))}" data-retry="${esc(tr("Try again"))}"`,
    },
  )}</div>
</section>`;
}

/** A round step for a chance axis whose top is `top`. */
const chanceStep = (top: number) => (top > 0.5 ? 0.2 : top > 0.2 ? 0.1 : top > 0.1 ? 0.05 : 0.02);

/** An event's odds, one line an answer, in the funding chart's frame (.fchart). */
function oddsChart(event: BetEvent, lines: BetLine[]): string {
  const all = lines.flatMap((l) => l.points);
  const from = Math.min(...all.map((p) => p[0]));
  const to = Math.max(...all.map((p) => p[0]));
  const peak = Math.max(...all.map((p) => p[1]));
  const step = chanceStep(peak * 1.12);
  const hi = Math.min(1, Math.max(step, Math.ceil((peak * 1.12) / step) * step));
  const x = (ms: number) => ((ms - from) / (to - from || 1)) * 1000;
  const y = (p: number) => 1000 - (p / hi) * 1000;
  const ticks: number[] = [];
  for (let v = 0; v <= hi + 1e-9; v += step) ticks.push(v);
  const grid = ticks
    .map(
      (v) =>
        `<line class="fchart-grid" x1="0" x2="1000" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"></line>`,
    )
    .join("");
  const yLabels = ticks
    .map(
      (v) =>
        `<span class="fchart-y" style="top:${(y(v) / 10).toFixed(2)}%">${Math.round(v * 100)}%</span>`,
    )
    .join("");
  // A label a day (UTC midnight), thinned to about five across; every other one is dropped on a
  // phone or a half-width card, where five dates would overlap.
  const every = Math.max(1, Math.round((to - from) / DAY_MS / 5)) * DAY_MS;
  const xLabels: string[] = [];
  for (let ms = Math.ceil(from / every) * every; ms <= to; ms += every)
    xLabels.push(
      `<span class="fchart-x${xLabels.length % 2 ? " bets-x2" : ""}" style="left:${(x(ms) / 10).toFixed(2)}%">${day(ms)}</span>`,
    );
  const paths = lines
    .map((l, i) => {
      const d = l.points
        .map(([ms, p], j) => `${j === 0 ? "M" : "L"}${x(ms).toFixed(1)} ${y(p).toFixed(1)}`)
        .join("");
      return `<path class="fchart-line bets-line" style="stroke:${COLOURS[i % COLOURS.length]}" d="${d}"></path>`;
    })
    .join("");
  const payload = JSON.stringify({
    from,
    to,
    lines: lines.map((l) => ({ label: l.label, points: l.points })),
  }).replace(/</g, "\\u003c");
  return `<figure class="fchart bets-chart">
<div class="fchart-head"><p class="fchart-title">${tr("Chance of Yes since {date}", { date: day(from) })}</p></div>
<div class="fchart-plot bets-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="${esc(tr("{question}: the chance of each answer over time", { question: event.title }))}">${grid}${paths}<line class="fchart-cursor off" x1="0" x2="0" y1="0" y2="1000"></line></svg>${yLabels}${xLabels.join("")}</div>
<p class="fchart-read">${tr("Hover or tap the chart to read a point.")}</p>
<script type="application/json" class="bets-data">${payload}</script>
</figure>`;
}

/** A featured event: its answers' chances as tiles (keyed to the chart's lines), its chart, its volume. */
function card(eyebrow: string, event: BetEvent, lines: BetLine[]): string {
  const shown = lines.length
    ? lines
        .map((l) => event.answers.find((a) => a.label === l.label))
        .filter((a) => a !== undefined)
    : event.answers.slice(0, 4);
  const tiles = shown
    .map((a, i) => {
      const change = pp(a.change1d);
      const swatch = lines.length
        ? `<i class="bets-key" style="background:${COLOURS[i % COLOURS.length]}"></i>`
        : "";
      return `<div class="bets-tile"><p class="bets-ans">${swatch}${answerLabel(event, a)}</p><p class="bets-big">${prob(a.price)}</p><p class="dim"><span class="${change.tone}">${change.text}</span> ${tr("pts in 24h")}</p></div>`;
    })
    .join("");
  const more = event.answers.length - shown.length;
  const facts = [`<span>${tr("24h volume")} <b>${formatUsd(event.volume24h)}</b></span>`];
  if (event.volume !== null)
    facts.push(
      `<span>${event.startMs ? tr("Traded since {date}", { date: day(event.startMs) }) : tr("Traded")} <b>${formatUsd(event.volume)}</b></span>`,
    );
  if (more > 0)
    facts.push(
      `<span>${tr("{venue} has {n} more", { n: more, venue: VENUE_NAME[event.venue] })}</span>`,
    );
  return `<article class="bets-top">
<p class="eyebrow">${eyebrow} · ${VENUE_NAME[event.venue]}</p>
<h3 class="bets-q">${outLink(event.url, esc(event.title))}</h3>
${event.context ? `<p class="bets-ctx">${esc(event.context)}</p>` : ""}
<div class="bets-tiles">${tiles}</div>
${lines.length ? oddsChart(event, lines) : ""}
<p class="facts">${facts.join("")}</p>
</article>`;
}

/** The next most traded, a row each: the first answer in reading order (orderAnswers) and its chance. */
function table(events: BetEvent[]): string {
  if (events.length === 0) return "";
  const rows = events
    .map((e) => {
      const a = e.answers[0] as BetAnswer;
      const change = pp(a.change1d);
      const more =
        e.answers.length > 1
          ? ` <span class="dim bets-more">${tr("+{n} more", { n: e.answers.length - 1 })}</span>`
          : "";
      return `<tr><td class="bets-qcell" data-venue="${VENUE_NAME[e.venue]}">${outLink(e.url, esc(e.title))}</td><td class="bets-venue dim">${VENUE_NAME[e.venue]}</td><td>${answerLabel(e, a)}${more}</td><td class="num"><b>${prob(a.price)}</b></td><td class="num ${change.tone}">${change.text}</td><td class="num bets-vol">${formatUsd(e.volume24h)}</td></tr>`;
    })
    .join("");
  return `<div class="sheet-wrap"><table class="sheet bets-list">
<thead><tr><th>${tr("Question")}</th><th class="bets-venue">${tr("Venue")}</th><th title="${tr("The likeliest answer; for a question asked by date, the nearest date; for levels that can all come true, the one closest to even odds")}">${tr("Leading answer")}</th><th class="num">${tr("Chance")}</th><th class="num" title="${tr("Change in the chance over the last 24 hours, in percentage points")}">${tr("24h")}</th><th class="num bets-vol">${tr("24h volume")}</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>`;
}

/** What BETS_PATH answers: the section's contents. */
export function betsFragment(read: BetsRead): string {
  const cards: string[] = [];
  if (read.pinned)
    cards.push(
      card(
        tr("Pinned until {date}", { date: day(read.pinned.untilMs) }),
        read.pinned.event,
        read.pinned.lines,
      ),
    );
  if (read.busiest)
    cards.push(
      card(tr("Most traded in the last 24 hours"), read.busiest.event, read.busiest.lines),
    );
  if (cards.length === 0)
    return `<p class="empty">${tr("No open question on Polymarket or Kalshi right now.")}</p>`;
  return `<div class="bets-cards${cards.length > 1 ? " bets-two" : ""}">${cards.join("")}</div>
${table(read.events)}
<p class="notes">${tr("Prices and volumes from Polymarket and Kalshi, read {time}. A chance is the price of a Yes share; it is what the crowd is paying, not a forecast of ours.", { time: timeTag(read.readAt, "hm") })}</p>`;
}

/** BETS_PATH's response: kept five minutes at the edge, as the read behind it is. */
export function betsResponse(html: string | null): Response {
  if (html === null)
    return new Response("", {
      status: 503,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
    });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export const BETS_CSS = `.bets{margin-bottom:6px}
.bets-venues{color:var(--dim)}
.bets-box{min-height:120px}
.bets-cards{display:grid;gap:12px;margin:0 0 12px}
@media (min-width:1100px){.bets-two{grid-template-columns:repeat(2,minmax(0,1fr))}}
.bets-top{border:1px solid var(--rule);background:var(--panel);padding:12px 14px 4px;min-width:0}
.bets-top .eyebrow{margin:0 0 4px}
.bets-q{font-size:18px;margin:0 0 4px;line-height:1.3}
.bets-q a{color:var(--ink)}
.bets-ctx{color:var(--muted);margin:0 0 12px;max-width:100ch;line-height:1.45}
.bets-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:8px 0 12px}
.bets-tile{border:1px solid var(--rule);padding:8px 10px;min-width:0}
.bets-ans{display:flex;align-items:flex-start;gap:6px;color:var(--muted);margin:0 0 2px;overflow-wrap:anywhere}
.bets-ans .bets-key{margin-top:4px}
.bets-big{font:700 clamp(22px,3vw,28px)/1.1 var(--mono);margin:0 0 2px}
.bets-tile .dim{margin:0}
i.bets-key{display:inline-block;flex:none;width:10px;height:10px;border-radius:50%}
.bets-chart{background:none}
.bets-chart .bets-plot{height:220px;margin:6px 6px 22px 44px}
.bets-chart .fchart-y{left:-44px;width:38px}
.bets-line{stroke-width:1.6}
.bets-two .bets-chart .bets-x2{display:none}
.bets-list .bets-qcell{min-width:260px;white-space:normal}
.bets-list td{vertical-align:top}

@media (max-width:640px){.bets-top{padding:10px 10px 2px}.bets-q{font-size:16px}.bets-chart .bets-plot{height:200px}.bets-chart .bets-x2{display:none}.bets-tiles{grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px}.bets-tile{padding:6px 8px}.bets-list .bets-qcell{min-width:150px}.bets-list .bets-vol,.bets-list .bets-more,.bets-list .bets-venue{display:none}.bets-list .bets-qcell::after{content:attr(data-venue);display:block;color:var(--dim)}}`;

/**
 * Loads the section once it is near the screen, and gives each chart a pointer readout: every
 * answer's chance at the nearest point, in the reader's own time. A failed read says so and offers a
 * retry, as a lazy tab does (tabs.ts).
 */
export const BETS_SCRIPT = `(() => {
  const box = document.querySelector("[data-bets-src]");
  if (!box) return;
  const pct = (p) => p > 0 && p < 0.005 ? "<1%" : Math.round(p * 100) + "%";
  const bind = () => {
    for (const chart of box.querySelectorAll(".bets-chart")) {
      const data = JSON.parse(chart.querySelector(".bets-data").textContent);
      const plot = chart.querySelector(".fchart-plot");
      const read = chart.querySelector(".fchart-read");
      const cursor = chart.querySelector(".fchart-cursor");
      const idle = read.textContent;
      const near = (points, at) => {
        let best = points[0];
        for (const p of points) if (Math.abs(p[0] - at) < Math.abs(best[0] - at)) best = p;
        return best;
      };
      const show = (clientX) => {
        const rect = plot.getBoundingClientRect();
        const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        const at = data.from + f * (data.to - data.from);
        cursor.setAttribute("x1", String(f * 1000));
        cursor.setAttribute("x2", String(f * 1000));
        cursor.classList.remove("off");
        const when = new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        read.textContent = when + " · " + data.lines.map((l) => l.label + " " + pct(near(l.points, at)[1])).join(" · ");
      };
      plot.addEventListener("pointermove", (e) => show(e.clientX));
      plot.addEventListener("pointerdown", (e) => show(e.clientX));
      plot.addEventListener("pointerleave", () => { cursor.classList.add("off"); read.textContent = idle; });
    }
  };
  const load = () => {
    fetch(box.getAttribute("data-bets-src"), { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then((html) => {
        box.innerHTML = html;
        box.removeAttribute("aria-busy");
        bind();
      })
      .catch(() => {
        box.removeAttribute("aria-busy");
        const wait = box.querySelector(".lazy-wait");
        if (!wait || wait.querySelector(".lazy-retry")) return;
        wait.classList.add("lazy-failed");
        const msg = wait.querySelector(".lazy-msg");
        if (msg) msg.textContent = wait.getAttribute("data-fail") || "";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "lazy-retry";
        retry.textContent = wait.getAttribute("data-retry") || "Retry";
        retry.addEventListener("click", () => {
          wait.classList.remove("lazy-failed");
          retry.remove();
          box.setAttribute("aria-busy", "true");
          load();
        });
        (wait.querySelector(".chart-skel-msg") || wait).appendChild(retry);
      });
  };
  if (!("IntersectionObserver" in window)) return load();
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    load();
  }, { rootMargin: "400px 0px" });
  io.observe(box);
})();`;
