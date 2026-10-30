import { describe, expect, test } from "bun:test";
import type {
  PortfolioCard,
  PortfolioHolding,
  PortfolioPage,
  PortfolioWallet,
  RichList,
  RichListRow,
} from "../app/holdings-data";
import {
  dayText,
  explorerHref,
  holdingsFragment,
  holdingsPage,
  investorsPanel,
  onchainPanel,
  stocksPanel,
  walletTable,
} from "./holdings";
import { bars, histogram, sparkline } from "./holdings-charts";
import { investorPage } from "./holdings-investor";
import {
  fairValueName,
  RANK_SORTS,
  rank,
  signedPct,
  UPSIDE_VIEWS,
  upsideBins,
} from "./holdings-rank";
import { richListPanel, richShareChart } from "./holdings-richlist";
import { withLocale } from "./i18n";

const NOW = Date.parse("2026-10-29T12:00:00Z");

const holding = (over: Partial<PortfolioHolding> = {}): PortfolioHolding => ({
  security: "NASDAQ:AAPL",
  ticker: "AAPL",
  name: "APPLE INC",
  kind: "stock",
  sector: "Electronic Technology",
  site_base: "AAPL",
  site_class: "equity",
  source: "sec_13f",
  amount: 227_917_808,
  prev_amount: 227_917_808,
  change: "unchanged",
  change_usd: 0,
  value_usd: 65_950_296_923,
  weight_pct: 22.04,
  close: 270.37,
  market_cap_usd: 4.0e12,
  pe_ttm: 36.2,
  pb: 54.1,
  dividend_yield_pct: 0.39,
  beta_5y: 1.21,
  perf_1m_pct: 3.1,
  pullback_1m_pct: -0.8,
  piotroski: 9,
  revenue_growth_pct: 6.4,
  fair_value_upside_pct: -47,
  analyst_upside_pct: 4.2,
  graham_upside_pct: -71,
  ...over,
});

const HOLDINGS: PortfolioHolding[] = [
  holding({}),
  holding({
    security: "NYSE:KO",
    ticker: "KO",
    name: "COCA COLA CO",
    value_usd: 32_508_000_000,
    weight_pct: 10.86,
    pe_ttm: 23.4,
    dividend_yield_pct: 2.9,
    beta_5y: 0.32,
    fair_value_upside_pct: -12,
    analyst_upside_pct: 9.5,
    graham_upside_pct: null,
    pullback_1m_pct: -3.4,
  }),
  holding({
    security: "NASDAQ:GOOGL",
    ticker: "GOOGL",
    name: "ALPHABET INC",
    change: "added",
    change_usd: 8_770_349_039,
    value_usd: 28_166_909_394,
    weight_pct: 9.41,
    pe_ttm: null,
    dividend_yield_pct: 0,
    fair_value_upside_pct: 140,
    pullback_1m_pct: -20.4,
  }),
  holding({
    security: "NYSE:BAC",
    ticker: "BAC",
    name: "BANK OF AMER CORP",
    change: "reduced",
    change_usd: -1_722_513_947,
    value_usd: 27_500_000_000,
    weight_pct: 9.2,
    fair_value_upside_pct: -60,
  }),
  // Sold out in the quarter: a row with no shares, in the sells and nowhere else.
  holding({
    security: "NYSE:XYZ",
    ticker: "XYZ",
    name: "GONE CORP",
    amount: 0,
    change: "closed",
    change_usd: -900_000_000,
    value_usd: 0,
    weight_pct: 0,
  }),
];

const sort = (id: string) => {
  const found = RANK_SORTS.find((s) => s.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("the fourteen sorts", () => {
  test("there are fourteen, each with its own id", () => {
    expect(RANK_SORTS.length).toBe(14);
    expect(new Set(RANK_SORTS.map((s) => s.id)).size).toBe(14);
  });

  test("largest holdings leave the exit out; biggest sells keep it", () => {
    expect(rank(HOLDINGS, sort("largest")).map((r) => r.holding.ticker)).toEqual([
      "AAPL",
      "KO",
      "GOOGL",
      "BAC",
    ]);
    expect(rank(HOLDINGS, sort("sells")).map((r) => r.holding.ticker)).toEqual(["BAC", "XYZ"]);
    expect(rank(HOLDINGS, sort("buys")).map((r) => r.holding.ticker)).toEqual(["GOOGL"]);
  });

  test("a sort needs its figure: no P/E, no zero yield", () => {
    expect(rank(HOLDINGS, sort("pe")).map((r) => r.holding.ticker)).toEqual(["KO", "AAPL", "BAC"]);
    expect(rank(HOLDINGS, sort("dividends")).map((r) => r.holding.ticker)).toEqual([
      "KO",
      "AAPL",
      "BAC",
    ]);
  });

  test("pullbacks and beta run lowest first", () => {
    expect(rank(HOLDINGS, sort("pullbacks"))[0]?.holding.ticker).toBe("GOOGL");
    expect(rank(HOLDINGS, sort("beta"))[0]?.holding.ticker).toBe("KO");
  });
});

describe("upside bins", () => {
  test("width_bucket(upside, -50, 100, 15) with an open bin each side", () => {
    const fair = UPSIDE_VIEWS[0];
    const { bins, missing, median, counted } = upsideBins(HOLDINGS, fair);
    expect(bins.length).toBe(17);
    // -60 is below the first edge, 140 at or past the last; -47 and -12 land in [-50,-40), [-20,-10).
    expect(bins[0]?.tickers).toEqual(["BAC"]);
    expect(bins[16]?.tickers).toEqual(["GOOGL"]);
    expect(bins[1]?.tickers).toEqual(["AAPL"]);
    expect(bins[4]?.tickers).toEqual(["KO"]);
    expect(counted).toBe(4);
    expect(missing).toBe(0);
    expect(median).toBe((-47 + -12) / 2);
    // The exit, with no shares, is in no view.
    expect(bins.flatMap((b) => b.tickers)).not.toContain("XYZ");
  });

  test("a holding the view has no value for is counted apart", () => {
    const graham = UPSIDE_VIEWS[2];
    expect(upsideBins(HOLDINGS, graham).missing).toBe(1);
  });
});

describe("charts", () => {
  test("a sparkline needs two points, and falls in the down colour", () => {
    expect(sparkline([["2026-01-02", 100]])).toBe("");
    expect(
      sparkline([
        ["2026-01-02", 100],
        ["2026-01-09", 110],
      ]),
    ).not.toContain("hd-spark-down");
    expect(
      sparkline([
        ["2026-01-02", 110],
        ["2026-01-09", 100],
      ]),
    ).toContain("hd-spark-down");
  });

  test("bars are as long as their figure against the largest, sales in the down colour", () => {
    const html = bars(
      [
        { label: "BAC", value: -1.7e9, text: "−$1.7B" },
        { label: "XYZ", value: -0.85e9, text: "−$850M" },
      ],
      "Top 10",
    );
    expect(html).toContain('style="width:100.0%"');
    expect(html).toContain('style="width:50.0%"');
    expect(html).toContain("hd-bar-neg");
    expect(bars([], "x")).toBe("");
  });

  test("the histogram titles each bar with its range, count and tickers", () => {
    const html = histogram(upsideBins(HOLDINGS, UPSIDE_VIEWS[0]).bins, "Fair value");
    expect(html).toContain("below −50%: 1 holdings, 9.2% of the value · BAC");
    expect(html).toContain("+100% and above: 1 holdings");
    expect(html).toContain('class="hd-hist-bar hd-hist-neg"');
  });

  test("signed percentages use a real minus and no sign at zero", () => {
    expect(signedPct(13.74)).toBe("+13.7%");
    expect(signedPct(-6.3)).toBe("−6.3%");
    expect(signedPct(-0.01)).toBe("0.0%");
  });
});

const card = (over: Partial<PortfolioCard> = {}): PortfolioCard => ({
  portfolio: "warren-buffett",
  name: "Warren Buffett",
  summary: "The stocks Warren Buffett holds in the Berkshire Hathaway portfolio.",
  title: "Berkshire Hathaway",
  style: "value",
  period: "2026-06-30",
  filed_on: "2026-08-14",
  value_usd: 299_253_556_246,
  value_change_pct: 13.74,
  positions: 29,
  crypto_positions: 0,
  tickers: "AAPL AXP KO GOOGL",
  return_3y_pct: 72.05,
  return_1y_pct: 13.82,
  sparkline: [
    ["2023-10-27", 110.67],
    ["2026-10-28", 190.4],
  ],
  ...over,
});

describe("the Investors topic", () => {
  test("a card: the three-year return, the sparkline, and Copy with every ticker", () => {
    const html = investorsPanel([card()]);
    expect(html).toContain('href="/holdings/warren-buffett"');
    expect(html).toContain("+72.0%");
    expect(html).toContain("3 year return");
    expect(html).toContain("29 holdings");
    expect(html).toContain('data-copy="AAPL AXP KO GOOGL"');
    expect(html).toContain('class="hd-spark"');
    // One style: no filter.
    expect(html).not.toContain('name="hd-style"');
  });

  test("a wallet card with no history leads with its value, and 1 holding is singular", () => {
    const html = investorsPanel([
      card({
        portfolio: "satoshi-nakamoto",
        name: "Satoshi Nakamoto",
        style: "crypto",
        positions: 1,
        tickers: "BTC",
        return_3y_pct: null,
        return_1y_pct: null,
        value_change_pct: null,
        sparkline: null,
        value_usd: 1.2e11,
      }),
      card(),
    ]);
    expect(html).toContain("$120B");
    expect(html).toContain("on chain");
    expect(html).toContain("1 holding · ");
    expect(html).toContain('title="Copy the ticker"');
    // Two styles: a filter, one :has() rule a style, and only slug-shaped styles are spliced in.
    expect(html).toContain('id="hd-style-crypto"');
    expect(html).toContain(
      '.hd-grid:has(#hd-style-value:checked) .hd-card:not([data-style="value"])',
    );
    expect(investorsPanel([card({ style: 'x"}' }), card()])).not.toContain('x"}:checked');
  });

  test("no investor yet says so", () => {
    expect(investorsPanel([])).toContain("No investor is listed yet");
  });

  test("a topic loaded later carries no script, and a failed read says so", () => {
    expect(holdingsFragment("investors", { cards: [card()] })).not.toContain("<script");
    expect(holdingsFragment("stocks", null)).toContain("could not be read");
  });
});

const wallet = (over: Partial<PortfolioWallet> = {}): PortfolioWallet => ({
  chain: "ethereum",
  address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  wallet_group: "personal",
  label: "vitalik.eth",
  evidence: "ens",
  evidence_url: "https://app.ens.domains/vitalik.eth",
  confidence: "confirmed",
  outputs: 0,
  day: "2026-10-29",
  value_usd: 23_266,
  coins: [
    { security: "CRYPTO:ETH", amount: 5.78, value_usd: 13_387 },
    { security: "CRYPTO:SPAM", amount: 1, value_usd: 0.2 },
  ],
  ...over,
});

describe("wallets", () => {
  test("an address links to its explorer and shows its evidence; dust is left out", () => {
    const html = walletTable([wallet()]);
    expect(html).toContain(
      'href="https://etherscan.io/address/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"',
    );
    expect(html).toContain("0xd8dA6B…A96045");
    expect(html).toContain("ENS name");
    expect(html).toContain("ETH $13.4k");
    expect(html).not.toContain("SPAM");
  });

  test("Satoshi's set is a set of outputs, not an address link", () => {
    const html = walletTable([
      wallet({
        chain: "bitcoin",
        address: "set:patoshi",
        label: "Patoshi coinbase outputs",
        evidence: "research",
        outputs: 21_953,
      }),
    ]);
    expect(html).toContain("a set of 21,953 coinbase outputs");
    expect(html).not.toContain("mempool.space/address/set:");
    expect(explorerHref("bitcoin", "set:patoshi")).toBeNull();
    expect(explorerHref("xrp", "rHb9")).toBe("https://xrpscan.com/account/rHb9");
  });

  test("the On chain topic says which addresses it shows and why", () => {
    const html = onchainPanel([
      {
        holder: "vitalik-buterin",
        name: "Vitalik Buterin",
        kind: "person",
        portfolio: "vitalik-buterin",
        addresses: 1,
        chains: "ethereum",
        evidence: "ens",
        value_usd: 23_266,
        coins: [{ security: "CRYPTO:ETH", value_usd: 13_387 }],
      },
    ]);
    expect(html).toContain('href="/holdings/vitalik-buterin"');
    expect(html).toContain("Ethereum");
    expect(html).toContain("tying a named person to a large wallet");
  });
});

const PAGE: PortfolioPage = {
  portfolio: "warren-buffett",
  holder: "warren-buffett",
  name: "Warren Buffett",
  kind: "person",
  country: "US",
  summary_text: "Chairman of Berkshire Hathaway, whose stock portfolio this is.",
  title: "Berkshire Hathaway",
  style: "value",
  benchmark: "INDEX:SPX",
  ciks: ["0001067983"],
  socials: [
    {
      platform: "x",
      handle: "WarrenBuffett",
      account_id: "1364930179",
      url: "https://x.com/WarrenBuffett",
      followers: 1_792_381,
      as_of: "2026-10-29",
    },
  ],
  companies: [
    {
      holder: "berkshire-hathaway",
      name: "Berkshire Hathaway Inc",
      role: "chair",
      stake_pct: null,
      since: null,
      security: "NYSE:BRK.B",
      portfolio: null,
      source_url: "https://www.berkshirehathaway.com/",
    },
  ],
  summary: {
    period: "2026-06-30",
    filed_on: "2026-08-14",
    value_usd: 299_253_556_246,
    value_change_pct: 13.74,
    turnover_pct: 1.45,
    positions: 29,
    crypto_positions: 0,
    new_positions: 1,
    closed_positions: 1,
    top10_weight_pct: 88.47,
    options_usd: 0,
    debt_usd: 0,
    dividend_income_usd: 4.07e9,
    look_through_earnings_usd: 1.376e10,
    value_now_usd: 3.147e11,
  },
  performance: [
    {
      horizon: "1y",
      from_day: "2025-10-28",
      to_day: "2026-10-28",
      portfolio_pct: 13.82,
      benchmark_pct: 12.38,
      relative_pct: 1.28,
    },
    {
      horizon: "3y",
      from_day: "2023-10-27",
      to_day: "2026-10-28",
      portfolio_pct: 72.05,
      benchmark_pct: 88.08,
      relative_pct: -8.52,
    },
  ],
  holdings: HOLDINGS,
  pullback: [
    {
      security: "NASDAQ:GOOGL",
      ticker: "GOOGL",
      name: "ALPHABET INC",
      weight_pct: 9.41,
      close: 286.15,
      high_1m: 359.4,
      pullback_1m_pct: -20.4,
      closes: [
        ["2026-09-28", 342.75],
        ["2026-10-28", 286.15],
      ],
    },
  ],
  history: [
    {
      period: "2026-06-30",
      filed_on: "2026-08-14",
      value_usd: 299_253_556_246,
      value_change_pct: 13.74,
      turnover_pct: 1.45,
      positions: 29,
      new_positions: 1,
      closed_positions: 1,
      filings: [
        {
          accession: "0001193125-26-352200",
          form: "13F-HR",
          filed_on: "2026-08-14",
          url: "https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/primary_doc.xml",
          amendment_type: null,
        },
      ],
    },
    {
      period: "2026-03-31",
      filed_on: "2026-05-15",
      value_usd: 263_100_000_000,
      value_change_pct: -4,
      turnover_pct: 5.7,
      positions: 29,
      new_positions: 3,
      closed_positions: 16,
      filings: [],
    },
  ],
  wallets: [],
};

describe("the investor page", () => {
  const html = investorPage({ page: PAGE, overview: null, now: NOW });

  test("the overview: X account with its id and followers, companies, period, filing and SEC links", () => {
    expect(html).toContain('href="https://x.com/WarrenBuffett"');
    expect(html).toContain("id 1364930179");
    expect(html).toContain("1.79M followers");
    expect(html).toContain("Berkshire Hathaway Inc");
    expect(html).toContain("(chair)");
    expect(html).toContain("Jun 30, 2026");
    expect(html).toContain("Aug 14, 2026");
    expect(html).toContain("primary_doc.xml");
    expect(html).toContain("CIK=0001067983");
  });

  test("the summary tiles and the performance table", () => {
    expect(html).toContain("Holdings value (USD)");
    expect(html).toContain("$299B");
    expect(html).toContain("+13.7%");
    expect(html).toContain("1.4%");
    expect(html).toContain("$4.1B");
    expect(html).toContain("+72.0%");
    expect(html).toContain("+88.1%");
    expect(html).toContain("−8.5%");
  });

  test("the rankings: a radio a sort with a figure, a pane each, the first checked", () => {
    expect(html).toContain('id="hd-rank-largest" checked');
    expect(html).toContain('id="hd-rank-sells"');
    expect(html).toContain('data-rank="pullbacks"');
    expect(html).toContain(
      '.hd-rank:has(#hd-rank-buys:checked) .hd-rank-pane[data-rank="buys"]{display:block}',
    );
    expect(html).toContain("sold out −$900M");
    expect(html).toContain("added +$8.8B");
  });

  test("the pullback chart and the histogram's three views", () => {
    expect(html).toContain("Recent price pullbacks");
    expect(html).toContain("−20.4%");
    for (const view of UPSIDE_VIEWS) expect(html).toContain(`id="hd-up-${view.id}"`);
    expect(html).toContain("Ben Graham formula");
    expect(html).toContain("Filing history");
  });

  test("the fair value's name comes from one place", () => {
    expect(fairValueName()).toBe("Fair value");
    expect(html).toContain(`<span>${fairValueName()}</span>`);
  });

  test("a first period compares with nothing: no buys, no sells, no change column", () => {
    const first = investorPage({
      page: { ...PAGE, history: PAGE.history.slice(0, 1) },
      overview: null,
      now: NOW,
    });
    expect(first).not.toContain('id="hd-rank-buys"');
    expect(first).not.toContain('id="hd-rank-sells"');
    expect(first).not.toContain("<th>last quarter</th>");
    expect(first).toContain('id="hd-rank-largest" checked');
  });

  test("no wallets, no On chain section; in another language the labels follow", () => {
    expect(html).not.toContain(">On chain</h2>");
    const zh = withLocale("zh", () => investorPage({ page: PAGE, overview: null, now: NOW }));
    expect(zh).toContain("投资者概览");
    expect(zh).toContain("公允价值");
  });
});

describe("the Stocks topic and dates", () => {
  test("a row per stock, linked to its page and to the chart where the site has it", () => {
    const html = stocksPanel([
      {
        security: "NASDAQ:GOOGL",
        ticker: "GOOGL",
        name: "ALPHABET INC",
        site_base: "GOOGL",
        site_class: "equity",
        holders: 2,
        buyers: 1,
        sellers: 1,
        value_usd: 2.8e10,
        net_change_usd: 7.1e9,
      },
    ]);
    expect(html).toContain('href="/holdings/stock/GOOGL"');
    expect(html).toContain('href="/chart/equity/GOOGL"');
  });

  test("dayText reads YYYY-MM-DD as a date", () => {
    expect(dayText("2026-06-30")).toBe("Jun 30, 2026");
    expect(dayText(null)).toBe("–");
  });
});

const richRow = (over: Partial<RichListRow> = {}): RichListRow => ({
  rank: 1,
  address: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo",
  balance: 248_598,
  value_usd: 248_598 * 78_443,
  is_contract: false,
  entity: "Binance",
  category: "exchange",
  evidence: "reserves",
  evidence_url: "https://www.binance.com/en/proof-of-reserves",
  portfolio: null,
  balance_7d: null,
  balance_30d: null,
  ...over,
});

const richList = (over: Partial<RichList> = {}): RichList => ({
  chain: "bitcoin",
  day: {
    day: "2026-10-30",
    addresses: 2,
    balance: 248_598 + 96_932,
    price_usd: 78_443,
    supply: 19_946_000,
    source: "blockchair-dump",
    as_of: "2026-10-30T00:28Z",
    read_at: "2026-10-30T07:10Z",
  },
  back_7d: null,
  back_30d: null,
  rows: [
    richRow(),
    richRow({
      rank: 2,
      address: "bc1qjasf9z3h7w3jspkhtgatgpyvvzgpa2wwd2lr0eh5",
      balance: 96_932,
      value_usd: 96_932 * 78_443,
      entity: null,
      category: "unlabelled",
      evidence: null,
      evidence_url: null,
    }),
  ],
  categories: [
    { day: "2026-10-30", category: "exchange", addresses: 1, balance: 248_598 },
    { day: "2026-10-30", category: "unlabelled", addresses: 1, balance: 96_932 },
  ],
  ...over,
});

describe("the Rich list topic", () => {
  test("a first day: the tiles, one split bar, and no change columns until there is history", () => {
    const html = richListPanel(richList());
    expect(html).toContain('<div class="rl-body">');
    expect(html).toContain("Top 2 hold");
    expect(html).toContain('345,530 <span class="rl-coin">BTC</span>');
    // Bitcoin's supply is what has been issued, lost coins and all.
    expect(html).toContain("Share of issued bitcoin");
    expect(html).toContain("of 19,946,000 BTC issued to date, lost coins included");
    expect(html).toContain("Blockchair's dump of Oct 30, 2026 00:28 UTC");
    expect(html).not.toContain("deposit contract is left out");
    // Named: Binance's coins of the two addresses' together.
    expect(html).toContain("71.9%");
    expect(html).toContain('class="rl-split"');
    expect(html).not.toContain('<svg viewBox="0 0 1000 300"');
    expect(html).toContain("the list's history starts here");
    expect(html).not.toContain(">7 days<");
    expect(html).toContain("show once the list has a week and a month of history");
    expect(html).not.toContain("<script");
  });

  test("a row: the explorer, the whole address to copy, the name with its category and source", () => {
    const html = richListPanel(richList());
    expect(html).toContain(
      'href="https://mempool.space/address/34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo" rel="noopener" target="_blank" title="34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo">34xp4vRo…4Twseo</a>',
    );
    expect(html).toContain('data-copy="34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo"');
    expect(html).toContain(
      '<span class="rl-name">Binance</span> <span class="rl-chip rl-c-exchange">exchange</span>',
    );
    expect(html).toContain(
      'href="https://www.binance.com/en/proof-of-reserves" rel="noopener" target="_blank">proof of reserves</a>',
    );
    // An unlabelled address is only its chip: no name, no source.
    expect(html).toContain(
      '<td class="rl-who"><span class="rl-chip rl-c-unlabelled">unlabelled</span></td>',
    );
  });

  test("with history: a week's change in coins, a new address says so; a holder links to their card", () => {
    const html = richListPanel(
      richList({
        chain: "ethereum",
        day: {
          day: "2026-11-07",
          addresses: 3,
          balance: 93_197_561,
          price_usd: 2_250,
          supply: 122_174_498,
          source: "blockscout",
          as_of: null,
          read_at: "2026-11-07T06:05Z",
        },
        back_7d: "2026-10-31",
        back_30d: null,
        rows: [
          richRow({
            address: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
            balance: 92_947_561,
            entity: "Ethereum staking deposit contract",
            category: "staking",
            evidence: "official",
            evidence_url: "https://ethereum.org/en/staking/deposit-contract/",
            balance_7d: 92_900_000,
          }),
          richRow({
            rank: 2,
            address: "0x2B6eD29A95753C3Ad948348e3e7b1A251080Ffb9",
            balance: 250_000,
            entity: "Rain Lõhmus",
            category: "holder",
            evidence: "news",
            evidence_url: "https://example.org/report",
            portfolio: "rain-lohmus",
            balance_7d: 250_000,
          }),
          richRow({
            rank: 3,
            address: "0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a",
            balance: 1_000,
            entity: "Bridge",
            category: "contract",
            evidence: "explorer",
            evidence_url: null,
            balance_7d: null,
          }),
        ],
      }),
    );
    expect(html).toContain(
      'href="https://eth.blockscout.com/address/0x00000000219ab540356cBB839Cbe05303d7705Fa"',
    );
    expect(html).toContain(">7 days<");
    expect(html).not.toContain(">30 days<");
    expect(html).toContain("The 30-day change shows once the list has a month of history.");
    expect(html).toContain('<span class="hd-up">+47,561</span>');
    expect(html).toContain('<span class="dim">0</span>');
    expect(html).toContain('<span class="rl-new">new</span>');
    expect(html).toContain(
      '<span class="rl-name"><a href="/holdings/rain-lohmus">Rain Lõhmus</a></span> <span class="rl-chip rl-c-holder">known holder</span>',
    );
    // The address book's words for a holder's evidence; the explorer's name links the explorer.
    expect(html).toContain(">news report</a>");
    expect(html).toContain(">official page</a>");
    expect(html).toContain(
      'href="https://eth.blockscout.com/address/0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a" rel="noopener" target="_blank">explorer label</a>',
    );
    expect(html).toContain("read Nov 7, 2026 06:05 UTC");
    expect(html).toContain("of 122,174,498 ETH, Blockscout's total supply");
    expect(html).toContain("The staking deposit contract is left out");
  });

  test("Tron's read time and supply; a read with no supply has no share tile or column; nothing read yet says so", () => {
    const read = richListPanel(
      richList({
        chain: "tron",
        day: {
          ...(richList().day as NonNullable<RichList["day"]>),
          source: "tronscan",
          as_of: "2026-10-30T07:12Z",
          supply: 94_700_000_000,
        },
      }),
    );
    expect(read).toContain("read Oct 30, 2026 07:12 UTC");
    // A coin's price keeps its cents and below: TRX is not "$0".
    expect(
      richListPanel(
        richList({
          chain: "tron",
          day: { ...(richList().day as NonNullable<RichList["day"]>), price_usd: 0.33162 },
        }),
      ),
    ).toContain("at $0.3316 a coin");
    // A tile's billions of coins are short; the table keeps every digit.
    const billions = richListPanel(
      richList({
        chain: "tron",
        day: { ...(richList().day as NonNullable<RichList["day"]>), balance: 83_479_978_726 },
        rows: [richRow({ balance: 83_479_978_726 })],
      }),
    );
    expect(billions).toContain('83.48B <span class="rl-coin">TRX</span>');
    expect(billions).toContain('<td class="num">83,479,978,726</td>');
    expect(richListPanel(richList())).toContain("$27.1B at $78,443 a coin");
    expect(read).toContain("of 94,700,000,000 TRX in circulation, by Tronscan");
    const tron = richListPanel(
      richList({
        chain: "tron",
        day: { ...(richList().day as NonNullable<RichList["day"]>), supply: null, as_of: null },
        rows: [
          richRow({
            address: "TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb",
            category: "other",
            entity: "Binance-Cold 2",
          }),
        ],
      }),
    );
    expect(tron).not.toContain("Share of supply");
    expect(tron).not.toContain("of supply</th>");
    expect(tron).toContain(
      'href="https://tronscan.org/#/address/TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb"',
    );
    const empty = richListPanel({
      chain: "tron",
      day: null,
      back_7d: null,
      back_30d: null,
      rows: [],
      categories: [],
    });
    expect(empty).toContain("No list read yet for Tron");
    expect(empty).toContain('aria-current="page">Tron</a>');
  });

  test("a category the page does not know is drawn as other; the chain switch links the hub", () => {
    const html = richListPanel(richList({ rows: [richRow({ category: "mystery" })] }));
    expect(html).toContain("rl-chip rl-c-other");
    expect(html).not.toContain("rl-c-mystery");
    expect(html).toContain(
      '<a href="/holdings#richlist" data-rl-swap="bitcoin" aria-current="page">Bitcoin</a>',
    );
    expect(html).toContain(
      '<a href="/holdings?chain=ethereum#richlist" data-rl-swap="ethereum">Ethereum</a>',
    );
  });

  test("the share chart: an area per category over two days and more, stacked to 100%", () => {
    const svg = richShareChart(
      [
        { day: "2026-10-30", category: "exchange", addresses: 50, balance: 30 },
        { day: "2026-10-30", category: "unlabelled", addresses: 450, balance: 70 },
        { day: "2026-10-31", category: "exchange", addresses: 50, balance: 40 },
        { day: "2026-10-31", category: "unlabelled", addresses: 450, balance: 60 },
      ],
      "bitcoin",
    );
    expect(svg).toContain(
      '<path class="rl-c-exchange" d="M0.0 210.0L1000.0 180.0L1000.0 300.0L0.0 300.0Z">',
    );
    expect(svg).toContain(
      '<path class="rl-c-unlabelled" d="M0.0 0.0L1000.0 0.0L1000.0 180.0L0.0 210.0Z">',
    );
    expect(svg).toContain("exchange <b>40.0%</b>");
    expect(richShareChart([], "bitcoin")).toBe("");
  });

  test("the hub: a Rich list tab loaded for the chain asked; another language labels it", () => {
    const hub = holdingsPage({ cards: [], overview: null, now: NOW, chain: "tron" });
    expect(hub).toContain('data-lazy="/holdings?panel=richlist&amp;chain=tron"');
    expect(hub).toContain('id="panel-holdings-richlist"');
    expect(holdingsPage({ cards: [], overview: null, now: NOW })).toContain(
      'data-lazy="/holdings?panel=richlist"',
    );
    const zh = withLocale("zh", () => richListPanel(richList()));
    expect(zh).toContain("交易所");
    expect(zh).toContain("储备证明");
  });
});
