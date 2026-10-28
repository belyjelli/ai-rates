import type {
  BtcOdds,
  HolderSum,
  Holdings,
  MacroOdds,
  PredictionMarket,
  Predictions,
} from "../app/data";
import { lazyPlaceholder } from "./chart-skeleton";
import { esc } from "./format";
import { tr } from "./i18n";
import { ladder } from "./macro";
import { ladderMedian, optionsAbove, optionsMedian, smiles } from "./option-odds";

/**
 * The Rates page's prediction-market tabs (collector migration 055, internal/predict).
 *
 * PREDICTION MARKETS sets Polymarket's macro questions beside Kalshi's (macro_odds): each FOMC
 * meeting's decision on both venues, the next unemployment and GDP prints, and the year's questions
 * only Polymarket asks (how many cuts, the year-end rate, recession, the year's peaks). A move in the
 * crowd's rate or recession odds is a change in what the market expects, which is why it is here
 * beside funding: every price is shown with its change over a day and a week.
 *
 * CROWD VS OPTIONS sets Polymarket's "Bitcoin above $X on <date>" ladders beside what Deribit's
 * option chain implies for the same price and moment (web/option-odds.ts). The two are bets on the
 * same thing by different crowds; where they part, one of them is paying for it.
 *
 * Each tab loads by itself (`?panel=crowd`, `?panel=btcodds`), as the macro tabs do.
 */

export const CROWD_PANELS = ["crowd", "btcodds"] as const;
export type CrowdPanel = (typeof CROWD_PANELS)[number];

export const isCrowdPanel = (value: string | null): value is CrowdPanel =>
  value !== null && (CROWD_PANELS as readonly string[]).includes(value);

/** The tab bar's entries, after the macro tabs. */
export const crowdTabs = (): { id: CrowdPanel; label: string; shortLabel: string }[] => [
  { id: "crowd", label: tr("Prediction markets"), shortLabel: tr("Predictions") },
  { id: "btcodds", label: tr("BTC: crowd vs options"), shortLabel: tr("BTC odds") },
];

const MINUS = "−";
const dash = `<span class="dim">–</span>`;
const h3 = (text: string) => `<h3 class="cvd-h2 wm-h2">${text}</h3>`;
const empty = (text: string) => `<p class="empty">${text}</p>`;
/** A probability as a whole percent, a sliver as "<1%". */
const prob = (p: number | null) =>
  p === null ? dash : p > 0 && p < 0.005 ? "&lt;1%" : `${Math.round(p * 100)}%`;
/** A change in percentage points, signed and toned. */
const ppChange = (now: number, then: number | null) => {
  if (then === null) return `<td class="num">${dash}</td>`;
  const d = Math.round((now - then) * 100);
  return `<td class="num${d > 0 ? " mc-up" : d < 0 ? " mc-down" : ""}">${d === 0 ? "0" : `${d > 0 ? "+" : MINUS}${Math.abs(d)}`}</td>`;
};
const bpText = (v: number) =>
  `${v > 0.5 ? "+" : v < -0.5 ? MINUS : ""}${Math.abs(Math.round(v))} ${tr("bp")}`;
const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const tile = (eyebrow: string, big: string, dim: string, cls = "") =>
  `<div class="cvd-tile"><p class="eyebrow">${eyebrow}</p><p class="cvd-big${cls ? ` ${cls}` : ""}">${big}</p><p class="dim">${dim}</p></div>`;

const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec".split("|");
/** A New York calendar date as "Oct 28": when a US release or FOMC meeting happens. */
const nyDate = (d: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
};
const dayName = (d: Date) => {
  const n = nyDate(d);
  return `${MONTHS[n.m - 1]} ${n.d}`;
};
const monthKey = (d: Date) => {
  const n = nyDate(d);
  return `${n.y}-${String(n.m).padStart(2, "0")}`;
};

// ---- Prediction markets -------------------------------------------------------------------------

/** The five FOMC outcomes, by their move in basis points, as both venues price them. */
const DECISIONS = [-50, -25, 0, 25, 50] as const;
const decisionNames = () => [
  tr("Cut &gt;25"),
  tr("Cut 25"),
  tr("Hold"),
  tr("Hike 25"),
  tr("Hike &gt;25"),
];

/** A meeting's outcome probabilities (normalised to one), its expected move, and a day ago's. */
function meetingOdds(
  rows: readonly { strike: number | null; p: number; p1: number | null }[],
): { buckets: number[]; expected: number; expected1: number | null } | null {
  const raw = DECISIONS.map((bps) => rows.find((r) => r.strike === bps));
  const total = raw.reduce((a, r) => a + (r?.p ?? 0), 0);
  if (!(total > 0)) return null;
  const buckets = raw.map((r) => (r?.p ?? 0) / total);
  const expected = buckets.reduce((a, p, i) => a + p * (DECISIONS[i] as number), 0);
  const total1 = raw.reduce((a, r) => a + (r?.p1 ?? 0), 0);
  const expected1 =
    raw.every((r) => r === undefined || r.p1 !== null) && total1 > 0
      ? raw.reduce((a, r, i) => a + ((r?.p1 ?? 0) / total1) * (DECISIONS[i] as number), 0)
      : null;
  return { buckets, expected, expected1 };
}

function fedSection(data: Predictions): { html: string; next: string } {
  // Meetings by their New York month: Polymarket's markets end the night of the decision, Kalshi's
  // the morning after, and both name the same meeting.
  const meetings = new Map<string, { at: Date; pm: PredictionMarket[]; kalshi: MacroOdds[] }>();
  for (const m of data.polymarket.filter((x) => x.kind === "fed_decision")) {
    const key = monthKey(m.ends_at);
    const e = meetings.get(key) ?? { at: m.ends_at, pm: [], kalshi: [] };
    e.pm.push(m);
    meetings.set(key, e);
  }
  for (const o of data.kalshi.filter((x) => x.series === "KXFEDDECISION")) {
    const key = o.period;
    const e = meetings.get(key) ?? { at: o.closes_at, pm: [], kalshi: [] };
    e.kalshi.push(o);
    if (o.closes_at < e.at) e.at = o.closes_at;
    meetings.set(key, e);
  }
  const list = [...meetings.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 4);
  if (list.length === 0) return { html: "", next: "" };
  const names = decisionNames();
  const heads = names
    .map((n, i) => `<th class="num"><i class="mc-sw mc-dec-${i}"></i>${n}</th>`)
    .join("");
  let next = "";
  const rows = list
    .map(([key, e], index) => {
      const venues: [string, ReturnType<typeof meetingOdds>][] = [
        [
          "Polymarket",
          meetingOdds(e.pm.map((m) => ({ strike: m.strike, p: m.yes, p1: m.yes_1d }))),
        ],
        [
          "Kalshi",
          meetingOdds(
            e.kalshi.map((o) => ({
              strike: o.strike,
              p: o.probability,
              p1: data.kalshiPast[o.market]?.d1 ?? null,
            })),
          ),
        ],
      ];
      const [year, month] = key.split("-");
      const label = `${MONTHS[Number(month) - 1]} ${year}`;
      if (index === 0) {
        const pm = venues[0]?.[1];
        const k = venues[1]?.[1];
        const likely = (o: NonNullable<ReturnType<typeof meetingOdds>>) => {
          const i = o.buckets.indexOf(Math.max(...o.buckets));
          return `${names[i]} ${prob(o.buckets[i] ?? 0)}`;
        };
        next = tile(
          tr("Next FOMC decision"),
          label,
          [pm ? `Polymarket: ${likely(pm)}` : "", k ? `Kalshi: ${likely(k)}` : ""]
            .filter(Boolean)
            .join(" · "),
        );
      }
      return venues
        .map(([venue, o], v) => {
          const lead = v === 0 ? `<td rowspan="2">${label}</td>` : "";
          if (!o)
            return `<tr>${lead}<td class="dim">${venue}</td><td colspan="8" class="dim">${tr("not listed")}</td></tr>`;
          const cells = o.buckets
            .map((b) => `<td class="num${b >= 0.5 ? " mc-hi" : ""}">${prob(b)}</td>`)
            .join("");
          const bar = o.buckets
            .map((b, i) =>
              b > 0
                ? `<span class="mc-dec mc-dec-${i}" style="width:${(b * 100).toFixed(1)}%"></span>`
                : "",
            )
            .join("");
          const change =
            o.expected1 === null
              ? `<td class="num">${dash}</td>`
              : `<td class="num${o.expected - o.expected1 > 0.5 ? " mc-up" : o.expected - o.expected1 < -0.5 ? " mc-down" : ""}">${bpText(o.expected - o.expected1)}</td>`;
          return `<tr>${lead}<td>${venue}</td>${cells}<td class="mc-bar-cell"><span class="mc-stack">${bar}</span></td><td class="num">${bpText(o.expected)}</td>${change}</tr>`;
        })
        .join("");
    })
    .join("");
  const html = `${h3(tr("Each FOMC meeting, both venues"))}<div class="sheet-wrap"><table class="sheet mc-table mc-fed cr-fed">
<thead><tr><th>${tr("Meeting")}</th><th>${tr("Venue")}</th>${heads}<th></th><th class="num" title="${esc(tr("Each outcome's move times its chance, added up"))}">${tr("Expected move")}</th><th class="num" title="${esc(tr("Change in the expected move over the last day"))}">${tr("1d change")}</th></tr></thead>
<tbody data-live="crowd-fed">${rows}</tbody></table></div>`;
  return { html, next };
}

/** One Polymarket question's outcomes with their changes; buckets under 1% are folded away. */
function questionTable(title: string, markets: readonly PredictionMarket[], note = ""): string {
  if (markets.length === 0) return "";
  const shown = markets.filter((m) => m.yes >= 0.01 || markets.length <= 3);
  const rest = markets.length - shown.length;
  const rows = shown
    .map(
      (m) =>
        `<tr><td>${esc(m.label || m.question)}</td><td class="num${m.yes >= 0.5 ? " mc-hi" : ""}">${prob(m.yes)}</td><td class="mc-bar-cell"><span class="cr-bar" style="width:${(m.yes * 100).toFixed(1)}%"></span></td>${ppChange(m.yes, m.yes_1d)}${ppChange(m.yes, m.yes_7d)}</tr>`,
    )
    .join("");
  return `<div class="cr-q"><p class="mc-ladder-t">${title}${note ? ` <span class="dim">${note}</span>` : ""}</p><table class="sheet mc-table cr-table"><thead><tr><th></th><th class="num">${tr("Chance")}</th><th></th><th class="num" title="${esc(tr("Percentage points over the last day"))}">${tr("1d")}</th><th class="num" title="${esc(tr("Percentage points over the last week"))}">${tr("7d")}</th></tr></thead><tbody>${rows}</tbody></table>${rest > 0 ? `<p class="dim cr-more">${tr("{n} more outcomes under 1%", { n: rest })}</p>` : ""}</div>`;
}

/** A Polymarket bucket question's median bucket: where the outcomes, in strike order, pass one half. */
function medianBucket(markets: readonly PredictionMarket[]): PredictionMarket | null {
  const sorted = markets
    .filter((m) => m.strike !== null)
    .sort((a, b) => (a.strike ?? 0) - (b.strike ?? 0));
  const total = sorted.reduce((a, m) => a + m.yes, 0);
  if (!(total > 0)) return null;
  let run = 0;
  for (const m of sorted) {
    run += m.yes / total;
    if (run >= 0.5) return m;
  }
  return sorted[sorted.length - 1] ?? null;
}

/** The next print a series asks about, on Kalshi: its event's markets. */
function kalshiNext(odds: readonly MacroOdds[], series: string): MacroOdds[] {
  const first = odds
    .filter((o) => o.series === series)
    .sort((a, b) => +a.closes_at - +b.closes_at)[0];
  return first ? odds.filter((o) => o.event === first.event) : [];
}

function printsSection(data: Predictions): string {
  const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;
  const kalshiMedian = (series: string, show: (v: number) => string) => {
    const l = ladder(kalshiNext(data.kalshi, series));
    if (l.middle === null) return dash;
    return l.below
      ? tr("below {value}", { value: show(l.middle) })
      : l.above
        ? tr("above {value}", { value: show(l.middle) })
        : show(l.middle);
  };
  const pmNext = (kind: string) => {
    const list = data.polymarket.filter((m) => m.kind === kind);
    const first = list[0];
    return first ? list.filter((m) => m.event_slug === first.event_slug) : [];
  };
  const pmMedian = (kind: string) => {
    const m = medianBucket(pmNext(kind));
    return m ? esc(m.label) : dash;
  };
  const when = (kind: string, series: string) => {
    const pm = pmNext(kind)[0];
    const k = kalshiNext(data.kalshi, series)[0];
    const at = pm?.ends_at ?? k?.closes_at;
    return at ? dayName(at) : dash;
  };
  const row = (name: string, kind: string | null, series: string, show: (v: number) => string) =>
    `<tr><td>${name}</td><td>${kind ? when(kind, series) : kalshiNext(data.kalshi, series)[0] ? dayName((kalshiNext(data.kalshi, series)[0] as MacroOdds).closes_at) : dash}</td><td class="num">${kind ? pmMedian(kind) : `<span class="dim">${tr("not listed")}</span>`}</td><td class="num">${kalshiMedian(series, show)}</td></tr>`;
  return `${h3(tr("The next prints, both venues"))}<div class="sheet-wrap"><table class="sheet mc-table cr-prints">
<thead><tr><th>${tr("Print")}</th><th>${tr("Settles")}</th><th class="num" title="${esc(tr("The outcome bucket where Polymarket's chances, in order, pass one half"))}">${tr("Polymarket median")}</th><th class="num" title="${esc(tr("Where Kalshi's ladder of above-X chances crosses one half"))}">${tr("Kalshi median")}</th></tr></thead>
<tbody>${row(tr("Unemployment rate"), "unemployment", "KXU3", (v) => pct(v))}${row(tr("GDP growth, the quarter"), "gdp", "KXGDP", (v) => pct(v))}${row(tr("CPI, on the month"), null, "KXCPI", (v) => pct(v))}${row(tr("CPI, year on year"), null, "KXCPIYOY", (v) => pct(v))}</tbody></table></div>`;
}

// ---- Smart money ---------------------------------------------------------------------------------

/** A dollar amount in short form: "$12k", "$1.4M". */
const usdShort = (v: number) => {
  const a = Math.abs(v);
  const t =
    a >= 1e6
      ? `${(a / 1e6).toFixed(1)}M`
      : a >= 1e3
        ? `${Math.round(a / 1e3)}k`
        : `${Math.round(a)}`;
  return `${v < 0 ? MINUS : ""}$${t}`;
};

/** The smart wallets' dollars on Yes and on No in a market, at its current price. */
function smartDollars(
  m: PredictionMarket,
  sums: readonly [HolderSum | null, HolderSum | null] | undefined,
) {
  if (!sums) return null;
  const yes = (sums[0]?.smart_shares ?? 0) * m.yes;
  const no = (sums[1]?.smart_shares ?? 0) * (1 - m.yes);
  const wallets = (sums[0]?.smart_holders ?? 0) + (sums[1]?.smart_holders ?? 0);
  return { yes, no, wallets };
}

/**
 * Each question's smart-money reading: for a question of several outcomes, the outcome holding the
 * most of the smart wallets' Yes dollars and its share of them; for a yes-or-no question, the share
 * of their dollars on Yes. With the crowd's price beside it, and the share a day before.
 */
function smartRow(title: string, markets: readonly PredictionMarket[], holdings: Holdings): string {
  if (markets.length === 0) return "";
  const share = (when: "now" | "d1") => {
    if (markets.length === 1) {
      const m = markets[0] as PredictionMarket;
      const d = smartDollars(m, holdings[m.market_id]?.[when]);
      if (!d || d.yes + d.no <= 0) return null;
      // The side holding more of the smart dollars, with the crowd's price for that side.
      const yes = d.yes >= d.no;
      return {
        label: yes ? tr("Yes") : tr("No"),
        m,
        crowd: yes ? m.yes : 1 - m.yes,
        share: (yes ? d.yes : d.no) / (d.yes + d.no),
        dollars: d.yes + d.no,
        wallets: d.wallets,
      };
    }
    const each = markets.map((m) => ({ m, d: smartDollars(m, holdings[m.market_id]?.[when]) }));
    const total = each.reduce((a, e) => a + (e.d?.yes ?? 0), 0);
    if (!(total > 0)) return null;
    const best = each.reduce((a, e) => ((e.d?.yes ?? 0) > (a.d?.yes ?? 0) ? e : a));
    const wallets = each.reduce((a, e) => a + (e.d?.wallets ?? 0), 0);
    return {
      label: best.m.label,
      m: best.m,
      crowd: best.m.yes,
      share: (best.d?.yes ?? 0) / total,
      dollars: total,
      wallets,
    };
  };
  const now = share("now");
  if (!now) return "";
  const before = share("d1");
  const change =
    before && before.label === now.label
      ? ppChange(now.share, before.share)
      : `<td class="num">${dash}</td>`;
  return `<tr><td>${title}</td><td>${esc(now.label)}</td><td class="num">${prob(now.share)}</td><td class="num">${prob(now.crowd)}</td>${change}<td class="num">${now.wallets}</td><td class="num">${usdShort(now.dollars)}</td></tr>`;
}

function smartSection(data: Predictions): string {
  const byEvent = new Map<string, PredictionMarket[]>();
  for (const m of data.polymarket) {
    const list = byEvent.get(m.event_slug) ?? [];
    list.push(m);
    byEvent.set(m.event_slug, list);
  }
  const titled = (kind: string) => [...byEvent.values()].filter((list) => list[0]?.kind === kind);
  const fedMeetings = titled("fed_decision")
    .slice(0, 3)
    .map((list) =>
      smartRow(
        tr("Fed, {meeting}", { meeting: dayName((list[0] as PredictionMarket).ends_at) }),
        list,
        data.holdings,
      ),
    );
  const singles = data.polymarket
    .filter((m) => m.kind === "recession" || m.kind === "fed_hike")
    .map((m) => smartRow(esc(m.question || m.event_title), [m], data.holdings));
  const others = (
    [
      ["fed_cuts", tr("How many Fed cuts in 2026")],
      ["fed_rate_end", tr("The Fed rate at the end of 2026")],
      ["inflation_high", tr("How high inflation gets in 2026")],
      ["unemployment", tr("Unemployment rate")],
      ["gdp", tr("GDP growth, the quarter")],
    ] as const
  ).map(([kind, title]) => {
    const list = titled(kind)[0];
    return list ? smartRow(title, list, data.holdings) : "";
  });
  const rows = [...fedMeetings, ...singles, ...others].join("");
  if (!rows) return "";
  return `${h3(tr("Smart money on Polymarket"))}<div class="sheet-wrap"><table class="sheet mc-table cr-smart">
<thead><tr><th>${tr("Question")}</th><th>${tr("Smart money backs")}</th><th class="num" title="${esc(tr("That outcome's share of the smart wallets' dollars on the question"))}">${tr("Share of smart $")}</th><th class="num" title="${esc(tr("The crowd's price for that outcome"))}">${tr("Crowd")}</th><th class="num" title="${esc(tr("Change in the smart share over the last day, in percentage points"))}">${tr("1d")}</th><th class="num">${tr("Wallets")}</th><th class="num">${tr("Smart $")}</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<p class="notes">${tr("Smart money is the {n} wallets with the most profit on Polymarket's own leaderboard in Economics and in Crypto, over the past month or all time. Each market's top 100 holders per outcome are read every hour; a smart wallet holding less than that is not seen. Where smart money and the crowd's price part, one side is wrong, and the smart side has the better record.", { n: data.smartWallets })}</p>`;
}

export function crowd(data: Predictions | null, _now: number): string {
  if (data === null) return empty(tr("The prediction markets could not be read right now."));
  if (data.polymarket.length === 0 && data.kalshi.length === 0)
    return empty(
      tr(
        "No prediction market has been read yet. The collector reads Polymarket every 15 minutes.",
      ),
    );
  const byKind = (kind: string) => data.polymarket.filter((m) => m.kind === kind);
  const first = (kind: string) => {
    const list = byKind(kind);
    const e = list[0];
    return e ? list.filter((m) => m.event_slug === e.event_slug) : [];
  };
  const fed = fedSection(data);
  const cuts = first("fed_cuts");
  const cutsMedian = medianBucket(cuts);
  const recession = byKind("recession");
  const rateEnd = first("fed_rate_end");
  const rateMedian = medianBucket(rateEnd);
  const tiles = [
    fed.next,
    cutsMedian
      ? tile(tr("Fed cuts in 2026"), esc(cutsMedian.label), tr("Polymarket's median outcome"))
      : "",
    recession[0]
      ? tile(
          tr("US recession"),
          prob(recession[0].yes),
          `${esc(recession[0].event_title)}${recession[0].yes_7d !== null ? ` · ${tr("{change} pp over a week", { change: `${recession[0].yes - recession[0].yes_7d >= 0 ? "+" : MINUS}${Math.abs(Math.round((recession[0].yes - recession[0].yes_7d) * 100))}` })}` : ""}`,
        )
      : "",
    rateMedian
      ? tile(
          tr("Fed rate at the end of 2026"),
          esc(rateMedian.label),
          tr("Polymarket's median outcome"),
        )
      : "",
  ]
    .filter(Boolean)
    .join("");
  const year = [
    questionTable(tr("How many Fed cuts in 2026"), cuts),
    questionTable(tr("The Fed rate at the end of 2026"), rateEnd),
    questionTable(tr("Another Fed hike in 2026"), first("fed_hike")),
    questionTable(tr("US recession"), recession, tr("by the end of each year")),
    questionTable(tr("How high inflation gets in 2026"), first("inflation_high")),
    questionTable(tr("How high US unemployment goes in 2026"), first("unemployment_high")),
    questionTable(tr("US GDP growth in 2026"), first("gdp_year")),
  ].join("");
  return `<div class="cvd-tiles mc-tiles">${tiles}</div>
${fed.html}
${smartSection(data)}
${printsSection(data)}
${h3(tr("The year ahead, on Polymarket"))}<div class="cr-grid">${year}</div>
<p class="notes">${tr("Each price is the chance the venue's traders give the outcome, its Yes price; a fed meeting's outcomes are scaled to add up to one. Changes are in percentage points against the price a day and a week before. Polymarket is read every 15 minutes and kept hourly for good; Kalshi's odds are the Fed, Jobs and Growth tabs' own.")}</p>`;
}

// ---- BTC: crowd vs options ----------------------------------------------------------------------

export function btcodds(data: BtcOdds | null, now: number): string {
  if (data === null) return empty(tr("The prediction markets could not be read right now."));
  if (data.markets.length === 0)
    return empty(
      tr("No Bitcoin ladder has been read yet. The collector reads Polymarket every 15 minutes."),
    );
  const list = data.chain ? smiles(data.chain) : [];
  // One ladder per settlement moment, soonest first.
  const ladders = new Map<number, PredictionMarket[]>();
  for (const m of data.markets) {
    if (m.strike === null) continue;
    const at = m.ends_at.getTime();
    const rungs = ladders.get(at) ?? [];
    rungs.push(m);
    ladders.set(at, rungs);
  }
  const expiries = [...ladders.entries()].sort((a, b) => a[0] - b[0]).slice(0, 5);
  const first = expiries[0];
  const spot = data.chain?.spot ?? null;
  const summary = (at: number, rungs: readonly PredictionMarket[]) => {
    const crowd = ladderMedian(rungs.map((m) => ({ strike: m.strike as number, p: m.yes })));
    const options = list.length ? optionsMedian(list, at, now) : null;
    return { crowd, options };
  };
  const s0 = first ? summary(first[0], first[1]) : { crowd: null, options: null };
  // The rung where the two part the most, over every ladder shown.
  let widest: { at: number; strike: number; gap: number } | null = null;
  const tables = expiries
    .map(([at, rungs]) => {
      const { crowd, options } = summary(at, rungs);
      const rows = [...rungs]
        .sort((a, b) => (a.strike as number) - (b.strike as number))
        .map((m) => {
          const o = list.length ? optionsAbove(list, at, m.strike as number, now) : null;
          const gap = o === null ? null : m.yes - o;
          if (gap !== null && (widest === null || Math.abs(gap) > Math.abs(widest.gap)))
            widest = { at, strike: m.strike as number, gap };
          const gapCell =
            gap === null
              ? `<td class="num">${dash}</td>`
              : `<td class="num${Math.round(gap * 100) > 0 ? " mc-up" : Math.round(gap * 100) < 0 ? " mc-down" : ""}">${Math.round(gap * 100) === 0 ? "0" : `${gap > 0 ? "+" : MINUS}${Math.abs(Math.round(gap * 100))}`}</td>`;
          const smart = smartDollars(m, data.holdings[m.market_id]?.now);
          const net = smart ? smart.yes - smart.no : null;
          const smartCell =
            net === null || Math.abs(net) < 1
              ? `<td class="num">${dash}</td>`
              : `<td class="num ${net > 0 ? "mc-up" : "mc-down"}">${net > 0 ? "+" : ""}${usdShort(net)}</td>`;
          return `<tr><td class="num">${usd0(m.strike as number)}</td><td class="num">${prob(m.yes)}</td><td class="num">${prob(o)}</td>${gapCell}${ppChange(m.yes, m.yes_1d)}${smartCell}<td class="num dim">${m.volume === null ? "–" : usd0(m.volume)}</td></tr>`;
        })
        .join("");
      const head = `${dayName(new Date(at))} · ${tr("noon New York")}`;
      return `<div class="cr-q"><p class="mc-ladder-t">${tr("Bitcoin above, {when}", { when: head })} <span class="dim">${tr("crowd median {crowd} · options median {options}", { crowd: crowd === null ? "–" : usd0(crowd), options: options === null ? "–" : usd0(options) })}</span></p>
<table class="sheet mc-table cr-table"><thead><tr><th class="num">${tr("Price")}</th><th class="num">Polymarket</th><th class="num" title="${esc(tr("Deribit's option chain: Black-76 with the smile's slope, between the expiries either side"))}">${tr("Options")}</th><th class="num" title="${esc(tr("Polymarket less options, in percentage points"))}">${tr("Gap")}</th><th class="num" title="${esc(tr("Polymarket's change over the last day, in percentage points"))}">${tr("1d")}</th><th class="num" title="${esc(tr("The smart wallets' dollars on Yes less their dollars on No"))}">${tr("Smart $")}</th><th class="num">${tr("Volume")}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    .join("");
  const w = widest as { at: number; strike: number; gap: number } | null;
  const tiles = [
    tile(
      tr("Bitcoin now"),
      spot === null ? "–" : usd0(spot),
      data.chain ? tr("Deribit index at the option chain's read") : tr("no option chain read yet"),
    ),
    first
      ? tile(
          tr("Next settlement"),
          `${dayName(new Date(first[0]))}`,
          tr("crowd median {crowd} · options median {options}", {
            crowd: s0.crowd === null ? "–" : usd0(s0.crowd),
            options: s0.options === null ? "–" : usd0(s0.options),
          }),
        )
      : "",
    w
      ? tile(
          tr("Widest gap"),
          `${w.gap > 0 ? "+" : MINUS}${Math.abs(Math.round(w.gap * 100))} pp`,
          tr("above {price} on {date}: the crowd is {side} than the options", {
            price: usd0(w.strike),
            date: dayName(new Date(w.at)),
            side: w.gap > 0 ? tr("more bullish") : tr("more bearish"),
          }),
          w.gap > 0 ? "mc-up" : "mc-down",
        )
      : "",
  ]
    .filter(Boolean)
    .join("");
  return `<div class="cvd-tiles mc-tiles">${tiles}</div>
<div class="cr-grid cr-grid-btc">${tables}</div>
<p class="notes">${tr("Polymarket's ladders settle on Binance's BTC/USDT one-minute close at noon New York. The options column is what Deribit's latest BTC chain implies for the same price and moment: each strike's volatility from the smile, the chance of finishing above it with the smile's slope counted, the total variance read between the expiries either side. A positive gap means Polymarket's crowd gives the price better odds than the options do. Smart $ is what the smart wallets (the leaderboard's most profitable, as on the Prediction markets tab) hold on Yes less what they hold on No.")}</p>`;
}

// ---- Panel plumbing -----------------------------------------------------------------------------

/** One tab on its own, for `/rates?panel=<tab>`: what tabs.ts loads into its placeholder. */
export function crowdFragment(
  panel: CrowdPanel,
  data: Predictions | BtcOdds | null,
  now: number,
): string {
  const body =
    panel === "crowd"
      ? crowd(data as Predictions | null, now)
      : btcodds(data as BtcOdds | null, now);
  return `<div class="lazy-body" data-rendered="${now}">${body}</div>`;
}

/** The placeholder for a tab this render did not read. */
export function crowdPlaceholder(panel: CrowdPanel): string {
  return lazyPlaceholder(`/rates?panel=${panel}#${panel}`);
}

/** The tabs' own styles, beside the macro tabs' (mc-*), which they reuse. */
export const CROWD_CSS = `.cr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px 22px;margin-top:6px}
.cr-grid-btc{grid-template-columns:repeat(auto-fill,minmax(420px,1fr))}
.cr-q .mc-ladder-t{margin:0 0 4px}
.cr-table{width:100%}
.cr-table td:first-child{white-space:normal;width:46%}
.cr-table .mc-bar-cell{width:22%}
.cr-grid-btc .cr-table td:first-child{white-space:nowrap}
.cr-bar{display:block;height:6px;background:var(--accent);min-width:1px}
.cr-more{margin:2px 0 0;font-size:11px}
.cr-fed td[rowspan]{vertical-align:middle}
.cr-smart td:first-child{white-space:normal}
@media (max-width:640px){.cr-grid,.cr-grid-btc{grid-template-columns:minmax(0,1fr)}}`;
