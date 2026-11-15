/**
 * Hyperliquid's own public reads, for the member "Top traders" tab on /liquidations
 * (web/trader.ts): who won the most over a day, a week, a month or all time, and for one of them,
 * what they hold and every recent fill and order.
 *
 * WHY HYPERLIQUID. It is the one large perp exchange where every account is public: its leaderboard
 * ranks every account by profit, and its info endpoint answers any address with its positions, its
 * last 2,000 fills and its last 2,000 orders. Nothing here needs a key or touches the database.
 *
 * THE LEADERBOARD IS ~39 MB (47,649 accounts on 2026-11-15, pretty-printed), too big to parse in one
 * piece inside a Worker's 128 MB (about 1 s of CPU and 24 MB of heap the streamed way, measured), so `readLeaderboard` reads it as a stream, one account at a time, and keeps only
 * the top of each window. The result is a few kilobytes, kept LEADERS_FRESH_MS in this isolate and
 * in the colo's cache; a stale copy is still served while a new one is read behind it, so only a
 * colo's first member after LEADERS_KEEP_MS waits for the download.
 *
 * ONE TRADER IS READ WHEN OPENED: five info requests (about 80 of an IP's 1,200 weight a minute),
 * and the page cache keeps the render 30 s for every member who opens the same one.
 */

export const LEADERBOARD_URL = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard";
export const INFO_URL = "https://api.hyperliquid.xyz/info";

/** The leaderboard's windows, in its own names and order. */
export const PNL_WINDOWS = ["day", "week", "month", "allTime"] as const;
export type PnlWindow = (typeof PNL_WINDOWS)[number];

/** How many accounts each window keeps: the tab lists fewer, and the rest let a trader page name its rank. */
export const LEADERS_KEPT = 100;
/** A leaderboard read younger than this is served as it is. */
export const LEADERS_FRESH_MS = 30 * 60_000;
/** An older one is still served, and read again behind it, up to this age. */
export const LEADERS_KEEP_MS = 6 * 3_600_000;
const LEADERS_CACHE_KEY = "https://airrates.internal/hyperliquid/leaderboard?v=1";
const LEADERBOARD_TIMEOUT_MS = 9_000;
const INFO_TIMEOUT_MS = 8_000;

/** One account on the leaderboard. Figures are by PNL_WINDOWS index. */
export interface Leader {
  /** Lowercase. */
  address: string;
  /** The name the account set on Hyperliquid, if any: the account's own words, so escape it. */
  name: string | null;
  accountValue: number;
  pnl: number[];
  roi: number[];
  volume: number[];
}

export interface LeaderBoard {
  readAt: number;
  /** How many accounts the board ranked. */
  ranked: number;
  /** Each window's best, by profit, most first. */
  top: Record<PnlWindow, Leader[]>;
}

const num = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function leaderOf(row: unknown): Leader | null {
  if (!row || typeof row !== "object") return null;
  const r = row as {
    ethAddress?: unknown;
    accountValue?: unknown;
    displayName?: unknown;
    windowPerformances?: unknown;
  };
  if (typeof r.ethAddress !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(r.ethAddress)) return null;
  const pnl = [0, 0, 0, 0];
  const roi = [0, 0, 0, 0];
  const volume = [0, 0, 0, 0];
  if (Array.isArray(r.windowPerformances)) {
    for (const entry of r.windowPerformances) {
      if (!Array.isArray(entry)) continue;
      const at = (PNL_WINDOWS as readonly unknown[]).indexOf(entry[0]);
      const perf = entry[1] as { pnl?: unknown; roi?: unknown; vlm?: unknown } | undefined;
      if (at < 0 || !perf) continue;
      pnl[at] = num(perf.pnl);
      roi[at] = num(perf.roi);
      volume[at] = num(perf.vlm);
    }
  }
  const name = typeof r.displayName === "string" && r.displayName.trim() ? r.displayName : null;
  return {
    address: r.ethAddress.toLowerCase(),
    name: name === null ? null : name.slice(0, 40),
    accountValue: num(r.accountValue),
    pnl,
    roi,
    volume,
  };
}

/**
 * The leaderboard's best `keep` accounts in each window, read from its body as a stream.
 *
 * The body is `{"leaderboardRows":[{...},{...}]}`. A scanner follows the nesting (and skips braces
 * inside strings), cuts out each row as the object that opens at depth three, and parses that row
 * alone, so the whole file is never one string or one object tree.
 */
export async function readLeaderboard(
  body: ReadableStream<Uint8Array>,
  keep = LEADERS_KEPT,
): Promise<{ ranked: number; top: Record<PnlWindow, Leader[]> }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const leaders: Leader[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let inRow = false;
  let row = "";
  for (;;) {
    const { done, value } = await reader.read();
    const chunk = done ? decoder.decode() : decoder.decode(value, { stream: true });
    let from = inRow ? 0 : -1;
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk.charCodeAt(i);
      if (inString) {
        if (escaped) escaped = false;
        else if (c === 92) escaped = true;
        else if (c === 34) inString = false;
        continue;
      }
      if (c === 34) {
        inString = true;
      } else if (c === 123 || c === 91) {
        depth++;
        if (depth === 3 && c === 123) {
          inRow = true;
          from = i;
          row = "";
        }
      } else if (c === 125 || c === 93) {
        if (depth === 3 && c === 125 && inRow) {
          row += chunk.slice(from, i + 1);
          try {
            const leader = leaderOf(JSON.parse(row));
            if (leader) leaders.push(leader);
          } catch {
            // One unreadable row costs that account, not the board.
          }
          inRow = false;
          row = "";
          from = -1;
        }
        depth--;
      }
    }
    if (inRow && from >= 0) row += chunk.slice(from);
    if (done) break;
  }
  const top = {} as Record<PnlWindow, Leader[]>;
  PNL_WINDOWS.forEach((window, at) => {
    top[window] = [...leaders]
      .sort((a, b) => (b.pnl[at] as number) - (a.pnl[at] as number))
      .slice(0, keep);
  });
  return { ranked: leaders.length, top };
}

/** One open position, as Hyperliquid reports it. */
export interface TraderPosition {
  coin: string;
  /** Signed: positive long, negative short. */
  size: number;
  entry: number | null;
  value: number;
  /** The position's value over its size: the mark the value was taken at. */
  mark: number | null;
  upnl: number;
  /** Unrealized profit over the margin, as Hyperliquid computes it. */
  roe: number | null;
  leverage: number | null;
  leverageType: string | null;
  liquidation: number | null;
  margin: number | null;
  /** Funding the position has paid since it opened: positive paid, negative received. */
  fundingSinceOpen: number | null;
}

export interface TraderState {
  accountValue: number;
  notional: number;
  marginUsed: number;
  withdrawable: number | null;
  positions: TraderPosition[];
}

export interface TraderFill {
  time: number;
  coin: string;
  /** Hyperliquid's own words: "Open Long", "Close Short", "Long > Short", "Buy", "Sell". */
  dir: string;
  side: "B" | "A";
  price: number;
  size: number;
  fee: number;
  closedPnl: number;
  oid: number;
  /** True when this fill was the account being liquidated. */
  liquidation: boolean;
}

export interface TraderOrder {
  /** When the order reached this status. */
  time: number;
  placed: number;
  coin: string;
  side: "B" | "A";
  /** "Limit", "Market", "Stop Market", "Take Profit Limit", ... */
  type: string;
  tif: string | null;
  size: number;
  /** What was left unfilled at this status. */
  left: number;
  price: number | null;
  trigger: number | null;
  reduceOnly: boolean;
  tpsl: boolean;
  /** "filled", "open", "canceled", "triggered", "rejected", "marginCanceled", ... */
  status: string;
  oid: number;
}

export interface PortfolioWindow {
  value: [number, number][];
  pnl: [number, number][];
  volume: number;
}

/** One trader as Hyperliquid answered: each part null when its own request failed. */
export interface TraderRead {
  address: string;
  readAt: number;
  state: TraderState | null;
  portfolio: Record<PnlWindow, PortfolioWindow> | null;
  fills: TraderFill[] | null;
  orders: TraderOrder[] | null;
  open: TraderOrder[] | null;
  /** True when Hyperliquid throttled a request (429): say so rather than "could not be read". */
  busy: boolean;
}

export function parseState(raw: unknown): TraderState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as {
    marginSummary?: Record<string, unknown>;
    withdrawable?: unknown;
    assetPositions?: { position?: Record<string, unknown> }[];
  };
  if (!r.marginSummary) return null;
  const positions: TraderPosition[] = [];
  for (const entry of r.assetPositions ?? []) {
    const p = entry?.position;
    if (!p || typeof p.coin !== "string") continue;
    const size = num(p.szi);
    if (size === 0) continue;
    const value = num(p.positionValue);
    const leverage = p.leverage as { type?: unknown; value?: unknown } | undefined;
    const funding = p.cumFunding as { sinceOpen?: unknown } | undefined;
    positions.push({
      coin: p.coin,
      size,
      entry: numOrNull(p.entryPx),
      value,
      mark: value > 0 ? value / Math.abs(size) : null,
      upnl: num(p.unrealizedPnl),
      roe: numOrNull(p.returnOnEquity),
      leverage: numOrNull(leverage?.value),
      leverageType: typeof leverage?.type === "string" ? leverage.type : null,
      liquidation: numOrNull(p.liquidationPx),
      margin: numOrNull(p.marginUsed),
      fundingSinceOpen: numOrNull(funding?.sinceOpen),
    });
  }
  positions.sort((a, b) => b.value - a.value);
  return {
    accountValue: num(r.marginSummary.accountValue),
    notional: num(r.marginSummary.totalNtlPos),
    marginUsed: num(r.marginSummary.totalMarginUsed),
    withdrawable: numOrNull(r.withdrawable),
    positions,
  };
}

export function parsePortfolio(raw: unknown): Record<PnlWindow, PortfolioWindow> | null {
  if (!Array.isArray(raw)) return null;
  const points = (list: unknown): [number, number][] =>
    Array.isArray(list)
      ? list
          .filter((p): p is [unknown, unknown] => Array.isArray(p) && p.length >= 2)
          .map((p) => [num(p[0]), num(p[1])] as [number, number])
          .filter((p) => p[0] > 0)
      : [];
  const out = {} as Record<PnlWindow, PortfolioWindow>;
  for (const entry of raw) {
    if (!Array.isArray(entry) || !(PNL_WINDOWS as readonly unknown[]).includes(entry[0])) continue;
    const w = entry[1] as { accountValueHistory?: unknown; pnlHistory?: unknown; vlm?: unknown };
    out[entry[0] as PnlWindow] = {
      value: points(w?.accountValueHistory),
      pnl: points(w?.pnlHistory),
      volume: num(w?.vlm),
    };
  }
  return PNL_WINDOWS.every((w) => out[w]) ? out : null;
}

export function parseFills(raw: unknown): TraderFill[] | null {
  if (!Array.isArray(raw)) return null;
  const out: TraderFill[] = [];
  for (const f of raw as Record<string, unknown>[]) {
    if (!f || typeof f.coin !== "string") continue;
    out.push({
      time: num(f.time),
      coin: f.coin,
      dir: typeof f.dir === "string" ? f.dir : "",
      side: f.side === "B" ? "B" : "A",
      price: num(f.px),
      size: num(f.sz),
      fee: num(f.fee),
      closedPnl: num(f.closedPnl),
      oid: num(f.oid),
      liquidation: f.liquidation !== undefined && f.liquidation !== null,
    });
  }
  return out.sort((a, b) => b.time - a.time);
}

function orderOf(o: Record<string, unknown>, status: string, time: number): TraderOrder | null {
  if (!o || typeof o.coin !== "string") return null;
  const trigger = o.isTrigger === true ? numOrNull(o.triggerPx) : null;
  const price = numOrNull(o.limitPx);
  return {
    time,
    placed: num(o.timestamp),
    coin: o.coin,
    side: o.side === "B" ? "B" : "A",
    type: typeof o.orderType === "string" ? o.orderType : "Limit",
    tif: typeof o.tif === "string" && o.tif ? o.tif : null,
    size: num(o.origSz),
    left: num(o.sz),
    price: price === 0 && trigger !== null ? null : price,
    trigger,
    reduceOnly: o.reduceOnly === true,
    tpsl: o.isPositionTpsl === true,
    status,
    oid: num(o.oid),
  };
}

/**
 * historicalOrders: one entry per status an order passed through (placed "open", then "filled"), so
 * each order is kept once, at its latest status, newest first.
 */
export function parseOrders(raw: unknown): TraderOrder[] | null {
  if (!Array.isArray(raw)) return null;
  const latest = new Map<number, TraderOrder>();
  for (const entry of raw as {
    order?: Record<string, unknown>;
    status?: unknown;
    statusTimestamp?: unknown;
  }[]) {
    if (!entry?.order) continue;
    const order = orderOf(
      entry.order,
      typeof entry.status === "string" ? entry.status : "",
      num(entry.statusTimestamp),
    );
    if (!order) continue;
    const held = latest.get(order.oid);
    if (!held || order.time >= held.time) latest.set(order.oid, order);
  }
  return [...latest.values()].sort((a, b) => b.time - a.time);
}

/** frontendOpenOrders: what rests on the book now. */
export function parseOpenOrders(raw: unknown): TraderOrder[] | null {
  if (!Array.isArray(raw)) return null;
  const out: TraderOrder[] = [];
  for (const o of raw as Record<string, unknown>[]) {
    const order = orderOf(o, "open", num(o?.timestamp));
    if (order) out.push(order);
  }
  return out.sort((a, b) => b.time - a.time);
}

/** One order's fills taken together: what the Trades table lists. */
export interface TraderTrade {
  /** The last fill's time. */
  time: number;
  coin: string;
  dir: string;
  side: "B" | "A";
  /** Size-weighted. */
  price: number;
  size: number;
  value: number;
  fee: number;
  closedPnl: number;
  fills: number;
  liquidation: boolean;
}

/**
 * Fills grouped by their order, newest first: an order that crossed twenty resting orders is one
 * trade, not twenty rows. A fill keeps its own row when it has no order id.
 */
export function tradesOf(fills: readonly TraderFill[]): TraderTrade[] {
  const byOrder = new Map<string, TraderTrade>();
  for (const f of fills) {
    const key = f.oid > 0 ? `${f.coin}|${f.oid}|${f.dir}` : `${f.coin}|t${f.time}|${f.price}`;
    const held = byOrder.get(key);
    if (!held) {
      byOrder.set(key, {
        time: f.time,
        coin: f.coin,
        dir: f.dir,
        side: f.side,
        price: f.price,
        size: f.size,
        value: f.price * f.size,
        fee: f.fee,
        closedPnl: f.closedPnl,
        fills: 1,
        liquidation: f.liquidation,
      });
      continue;
    }
    held.time = Math.max(held.time, f.time);
    held.size += f.size;
    held.value += f.price * f.size;
    held.price = held.size > 0 ? held.value / held.size : held.price;
    held.fee += f.fee;
    held.closedPnl += f.closedPnl;
    held.fills += 1;
    held.liquidation ||= f.liquidation;
  }
  return [...byOrder.values()].sort((a, b) => b.time - a.time);
}

/** Per coin, over the fills read: realized profit before and after fees, and the volume traded. */
export interface CoinResult {
  coin: string;
  trades: number;
  volume: number;
  closedPnl: number;
  fees: number;
}

export function coinResults(fills: readonly TraderFill[]): CoinResult[] {
  const byCoin = new Map<string, CoinResult & { orders: Set<number> }>();
  for (const f of fills) {
    let held = byCoin.get(f.coin);
    if (!held) {
      held = { coin: f.coin, trades: 0, volume: 0, closedPnl: 0, fees: 0, orders: new Set() };
      byCoin.set(f.coin, held);
    }
    held.orders.add(f.oid);
    held.volume += f.price * f.size;
    held.closedPnl += f.closedPnl;
    held.fees += f.fee;
  }
  return [...byCoin.values()]
    .map(({ orders, ...rest }) => ({ ...rest, trades: orders.size }))
    .sort((a, b) => Math.abs(b.closedPnl - b.fees) - Math.abs(a.closedPnl - a.fees));
}

export const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;

export interface HyperliquidSource {
  /** The leaderboard's top, or null when it could not be read and no copy is kept. */
  leaders(): Promise<LeaderBoard | null>;
  /** One account; `address` lowercase and ADDRESS_PATTERN-checked by the caller. */
  trader(address: string): Promise<TraderRead>;
}

export interface HyperliquidOptions {
  fetch: typeof fetch;
  /** The colo's cache (caches.default); null in tests and local dev. */
  cache?: Cache | null;
  waitUntil?: (promise: Promise<unknown>) => void;
  now: () => number;
  log?: (line: string) => void;
}

/**
 * This isolate's last finished leaderboard read. Only a FINISHED answer is shared between requests:
 * a promise still in flight, shared, hangs the requests that wait on it once the one that started it
 * ends (2026-10, member paper/signals).
 */
let memo: LeaderBoard | null = null;
/** When this isolate last started reading the board behind a stale copy: one such read at a time. */
let refreshedAt = 0;

/** Tests start from no kept leaderboard. */
export function forgetLeaderboard(): void {
  memo = null;
  refreshedAt = 0;
}

class Throttled extends Error {}

export function hyperliquidSource(options: HyperliquidOptions): HyperliquidSource {
  const { fetch: get, cache = null, waitUntil, now, log } = options;

  const readBoard = async (): Promise<LeaderBoard> => {
    const res = await get(LEADERBOARD_URL, {
      signal: AbortSignal.timeout(LEADERBOARD_TIMEOUT_MS),
    });
    if (!res.ok || !res.body) throw new Error(`leaderboard HTTP ${res.status}`);
    const { ranked, top } = await readLeaderboard(res.body);
    if (ranked === 0) throw new Error("empty leaderboard");
    const board: LeaderBoard = { readAt: now(), ranked, top };
    memo = board;
    if (cache) {
      await cache
        .put(
          LEADERS_CACHE_KEY,
          new Response(JSON.stringify(board), {
            headers: {
              "content-type": "application/json",
              "cache-control": `max-age=${Math.round(LEADERS_KEEP_MS / 1000)}`,
            },
          }),
        )
        .catch(() => {});
    }
    return board;
  };

  const leaders = async (): Promise<LeaderBoard | null> => {
    const at = now();
    let held = memo;
    if (!held && cache) {
      const hit = await cache.match(LEADERS_CACHE_KEY).catch(() => undefined);
      if (hit) {
        try {
          held = (await hit.json()) as LeaderBoard;
          memo = held;
        } catch {
          held = null;
        }
      }
    }
    if (held && at - held.readAt < LEADERS_FRESH_MS) return held;
    if (held && at - held.readAt < LEADERS_KEEP_MS && waitUntil) {
      // Stale: served as it is, read again behind it, once a minute at most from this isolate.
      if (at - refreshedAt > 60_000) {
        refreshedAt = at;
        waitUntil(
          readBoard().catch((err) => log?.(`hyperliquid leaderboard not read: ${String(err)}`)),
        );
      }
      return held;
    }
    try {
      return await readBoard();
    } catch (err) {
      log?.(`hyperliquid leaderboard not read: ${String(err)}`);
      return held && at - held.readAt < LEADERS_KEEP_MS ? held : null;
    }
  };

  const info = async (body: Record<string, unknown>): Promise<unknown> => {
    const res = await get(INFO_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(INFO_TIMEOUT_MS),
    });
    if (res.status === 429) throw new Throttled("429");
    if (!res.ok) throw new Error(`info ${String(body.type)} HTTP ${res.status}`);
    return res.json();
  };

  const trader = async (address: string): Promise<TraderRead> => {
    const asked = [
      "clearinghouseState",
      "portfolio",
      "userFills",
      "historicalOrders",
      "frontendOpenOrders",
    ];
    const answers = await Promise.allSettled(asked.map((type) => info({ type, user: address })));
    let busy = false;
    const value = (i: number): unknown => {
      const answer = answers[i] as PromiseSettledResult<unknown>;
      if (answer.status === "fulfilled") return answer.value;
      if (answer.reason instanceof Throttled) busy = true;
      else log?.(`hyperliquid ${asked[i]} not read: ${String(answer.reason)}`);
      return undefined;
    };
    return {
      address,
      readAt: now(),
      state: parseState(value(0)),
      portfolio: parsePortfolio(value(1)),
      fills: parseFills(value(2)),
      orders: parseOrders(value(3)),
      open: parseOpenOrders(value(4)),
      busy,
    };
  };

  return { leaders, trader };
}
