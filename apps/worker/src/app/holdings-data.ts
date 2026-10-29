import type postgres from "postgres";

/**
 * The Holdings section's reads (web/holdings.ts): what well-known investors hold, from the tables the
 * holdings worker writes (collector migration 058). Each read follows plans/holdings/queries.sql, with
 * every numeric cast to float8 and every date to text: under Hyperdrive's fetch_types: false a numeric
 * arrives as a string and a date as a Date at midnight UTC, and neither is what a page prints.
 *
 * Before the migration is applied, or before the site's role is granted the tables, every read
 * answers "nothing yet" (missingOrRefused), so the page says so instead of answering 503.
 */

/** One card on the idea grid. */
export interface PortfolioCard {
  portfolio: string;
  name: string;
  summary: string;
  title: string;
  style: string;
  /** The latest period's last day, YYYY-MM-DD; null before anything is derived. */
  period: string | null;
  filed_on: string | null;
  value_usd: number | null;
  value_change_pct: number | null;
  positions: number | null;
  crypto_positions: number | null;
  /** Every current holding's ticker, heaviest first, space separated: the card's Copy button. */
  tickers: string | null;
  return_3y_pct: number | null;
  return_1y_pct: number | null;
  /** Each week's last index value over the three years, [YYYY-MM-DD, index], oldest first. */
  sparkline: [string, number][] | null;
}

/** An account the holder is known by, with its newest follower count. */
export interface PortfolioSocial {
  platform: string;
  handle: string;
  /** The platform's own id (X's numeric user id), which survives a rename. */
  account_id: string | null;
  url: string;
  followers: number | null;
  as_of: string | null;
}

/** A company the holder controls (chair, CEO, founder, controlling holder). */
export interface PortfolioCompany {
  holder: string;
  name: string;
  role: string;
  stake_pct: number | null;
  since: string | null;
  /** Its own listing (NYSE:BRK.B), when listed. */
  security: string | null;
  /** The company's own idea page, when it has one. */
  portfolio: string | null;
  source_url: string;
}

/** The latest period's summary: the Holdings summary tiles. */
export interface PortfolioSummary {
  period: string;
  filed_on: string | null;
  value_usd: number;
  value_change_pct: number | null;
  turnover_pct: number | null;
  positions: number;
  crypto_positions: number;
  new_positions: number;
  closed_positions: number;
  top10_weight_pct: number;
  /** What the 13F lists besides shares, left out of value_usd: options (at the shares' value) and bonds. */
  options_usd: number;
  debt_usd: number;
  dividend_income_usd: number | null;
  look_through_earnings_usd: number | null;
  value_now_usd: number | null;
}

/** One horizon of the price performance table, holder method. */
export interface PortfolioPerformance {
  horizon: "1y" | "3y" | "5y";
  from_day: string;
  to_day: string;
  portfolio_pct: number;
  benchmark_pct: number;
  relative_pct: number;
}

/** One position of the latest period (an exit keeps a row with amount 0), with its newest figures. */
export interface PortfolioHolding {
  security: string;
  ticker: string;
  name: string;
  kind: string | null;
  sector: string | null;
  site_base: string | null;
  site_class: string | null;
  source: string;
  amount: number;
  prev_amount: number;
  change: "new" | "added" | "reduced" | "closed" | "unchanged";
  change_usd: number;
  value_usd: number;
  weight_pct: number;
  close: number | null;
  market_cap_usd: number | null;
  pe_ttm: number | null;
  pb: number | null;
  dividend_yield_pct: number | null;
  beta_5y: number | null;
  perf_1m_pct: number | null;
  pullback_1m_pct: number | null;
  piotroski: number | null;
  revenue_growth_pct: number | null;
  fair_value_upside_pct: number | null;
  analyst_upside_pct: number | null;
  graham_upside_pct: number | null;
}

/** One holding on the pullback chart: its month of daily closes and its 1-month (intraday) high. */
export interface PortfolioPullback {
  security: string;
  ticker: string;
  name: string;
  weight_pct: number;
  close: number;
  high_1m: number;
  pullback_1m_pct: number;
  closes: [string, number][];
}

/** One SEC document behind a period. */
export interface PortfolioFiling {
  accession: string;
  form: string;
  filed_on: string;
  url: string;
  amendment_type: string | null;
}

/** One period of the filing history, newest first. */
export interface PortfolioPeriod {
  period: string;
  filed_on: string | null;
  value_usd: number;
  value_change_pct: number | null;
  turnover_pct: number | null;
  positions: number;
  new_positions: number;
  closed_positions: number;
  filings: PortfolioFiling[];
}

/** One coin in a wallet's newest balances. */
export interface WalletCoin {
  security: string;
  amount: number;
  value_usd: number;
}

/** A traced wallet: its evidence and its newest balances. */
export interface PortfolioWallet {
  chain: string;
  /** An address, or 'set:<name>' for a set of outputs with no address of their own. */
  address: string;
  wallet_group: string;
  label: string;
  evidence: string;
  evidence_url: string;
  confidence: string;
  /** For a set: how many outputs it holds. */
  outputs: number;
  day: string | null;
  value_usd: number;
  coins: WalletCoin[];
}

/** Everything the investor page shows. */
export interface PortfolioPage {
  portfolio: string;
  holder: string;
  name: string;
  kind: string;
  country: string | null;
  summary_text: string;
  title: string;
  style: string;
  benchmark: string;
  /** The SEC filer CIKs behind the portfolio, for the EDGAR links. */
  ciks: string[];
  socials: PortfolioSocial[];
  companies: PortfolioCompany[];
  summary: PortfolioSummary | null;
  performance: PortfolioPerformance[];
  holdings: PortfolioHolding[];
  pullback: PortfolioPullback[];
  history: PortfolioPeriod[];
  wallets: PortfolioWallet[];
}

/** The Stocks topic: a security across the listed portfolios' latest periods. */
export interface HeldStock {
  security: string;
  ticker: string;
  name: string;
  site_base: string | null;
  site_class: string | null;
  holders: number;
  buyers: number;
  sellers: number;
  value_usd: number;
  net_change_usd: number;
}

/** One portfolio holding (or that sold out of) a stock. */
export interface StockHolder {
  portfolio: string;
  name: string;
  title: string;
  period: string;
  amount: number;
  value_usd: number;
  weight_pct: number;
  change: string;
  change_usd: number;
}

/** A stock's page: who holds it, with its newest figures. */
export interface StockPage {
  security: string;
  ticker: string;
  name: string;
  kind: string;
  sector: string | null;
  industry: string | null;
  site_base: string | null;
  site_class: string | null;
  close: number | null;
  market_cap_usd: number | null;
  pe_ttm: number | null;
  dividend_yield_pct: number | null;
  perf_1m_pct: number | null;
  holders: StockHolder[];
}

/** The Moves topic: one filing with its biggest buy and sell. */
export interface PortfolioMove {
  portfolio: string;
  name: string;
  period: string;
  filed_on: string;
  value_usd: number;
  value_change_pct: number | null;
  turnover_pct: number | null;
  top_buy: string | null;
  top_buy_usd: number | null;
  top_sell: string | null;
  top_sell_usd: number | null;
}

/** The On chain topic: a holder with traced wallets. */
export interface OnchainHolder {
  holder: string;
  name: string;
  kind: string;
  portfolio: string | null;
  addresses: number;
  chains: string;
  evidence: string;
  value_usd: number;
  coins: { security: string; value_usd: number }[];
}

const missingOrRefused = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "42P01" || code === "42501";
};

/** A read's rows, or none while the tables do not exist or are not granted. */
async function rowsOrNone<T>(read: Promise<readonly T[]>): Promise<readonly T[]> {
  try {
    return await read;
  } catch (error) {
    if (missingOrRefused(error)) return [];
    throw error;
  }
}

export async function portfolioCards(sql: postgres.Sql): Promise<PortfolioCard[]> {
  const rows = await rowsOrNone(
    sql<PortfolioCard[]>`
      WITH latest AS (
        SELECT DISTINCT ON (portfolio) * FROM portfolio_periods ORDER BY portfolio, period DESC
      ),
      held AS (
        -- Real tickers only: a company with no listing today (taken over since the filing) keeps its
        -- CUSIP as its ticker, which is no use on a card or on a clipboard.
        SELECT portfolio, string_agg(ticker, ' ' ORDER BY weight_pct DESC, ticker) AS tickers
        FROM portfolio_holdings_now
        WHERE amount > 0 AND put_call = '' AND NOT (security LIKE 'CUSIP:%' AND ticker = substr(security, 7))
        GROUP BY portfolio
      ),
      nav AS (
        SELECT DISTINCT ON (portfolio) portfolio, day, nav FROM portfolio_nav
        WHERE method = 'holder' ORDER BY portfolio, day DESC
      ),
      nav_1y AS (
        SELECT DISTINCT ON (n.portfolio) n.portfolio, n.nav
        FROM portfolio_nav n JOIN nav ON nav.portfolio = n.portfolio
        WHERE n.method = 'holder' AND n.day <= nav.day - 365
        ORDER BY n.portfolio, n.day DESC
      ),
      nav_3y AS (
        SELECT DISTINCT ON (n.portfolio) n.portfolio, n.day, n.nav
        FROM portfolio_nav n JOIN nav ON nav.portfolio = n.portfolio
        WHERE n.method = 'holder' AND n.day <= nav.day - interval '3 years'
        ORDER BY n.portfolio, n.day DESC
      ),
      spark AS (
        SELECT w.portfolio,
               json_agg(json_build_array(w.day::text, round(w.nav::numeric, 2)) ORDER BY w.day) AS points
        FROM (
          SELECT DISTINCT ON (n.portfolio, date_trunc('week', n.day)) n.portfolio, n.day, n.nav
          FROM portfolio_nav n JOIN nav_3y s ON s.portfolio = n.portfolio
          WHERE n.method = 'holder' AND n.day >= s.day
          ORDER BY n.portfolio, date_trunc('week', n.day), n.day DESC
        ) w
        GROUP BY w.portfolio
      )
      SELECT pf.portfolio, h.name, h.summary, pf.title, pf.style,
             l.period::text AS period, l.filed_on::text AS filed_on, l.value_usd::float8 AS value_usd,
             l.value_change_pct::float8 AS value_change_pct, l.positions::int AS positions,
             l.crypto_positions::int AS crypto_positions, held.tickers,
             (100 * (nav.nav / nav_3y.nav - 1))::float8 AS return_3y_pct,
             (100 * (nav.nav / nav_1y.nav - 1))::float8 AS return_1y_pct,
             spark.points AS sparkline
      FROM portfolios pf
      JOIN holders h ON h.holder = pf.holder
      LEFT JOIN latest l ON l.portfolio = pf.portfolio
      LEFT JOIN held ON held.portfolio = pf.portfolio
      LEFT JOIN nav ON nav.portfolio = pf.portfolio
      LEFT JOIN nav_1y ON nav_1y.portfolio = pf.portfolio
      LEFT JOIN nav_3y ON nav_3y.portfolio = pf.portfolio
      LEFT JOIN spark ON spark.portfolio = pf.portfolio
      WHERE pf.listed
      ORDER BY pf.sort_order, l.value_usd DESC NULLS LAST, pf.portfolio`,
  );
  return [...rows];
}

export async function portfolioPage(
  sql: postgres.Sql,
  slug: string,
): Promise<PortfolioPage | null> {
  type Head = Omit<
    PortfolioPage,
    "companies" | "summary" | "performance" | "holdings" | "pullback" | "history" | "wallets"
  >;
  const read = await Promise.all([
    sql<Head[]>`
          SELECT pf.portfolio, h.holder, h.name, h.kind, h.country, h.summary AS summary_text, pf.title,
                 pf.style, pf.benchmark,
                 coalesce((SELECT array_to_json(array_agg(s.ref ORDER BY s.ref)) FROM portfolio_sources s
                           WHERE s.portfolio = pf.portfolio AND s.kind = 'sec_13f'), '[]'::json) AS ciks,
                 coalesce((
                   SELECT json_agg(json_build_object('platform', so.platform, 'handle', so.handle,
                                                     'account_id', so.account_id, 'url', so.url,
                                                     'followers', st.followers, 'as_of', st.day::text)
                                   ORDER BY so.platform, so.handle)
                   FROM holder_socials so
                   LEFT JOIN LATERAL (
                     SELECT followers, day FROM holder_social_stats x
                     WHERE x.platform = so.platform AND x.handle = so.handle ORDER BY day DESC LIMIT 1
                   ) st ON true
                   WHERE so.holder = h.holder AND so.official), '[]'::json) AS socials
          FROM portfolios pf
          JOIN holders h ON h.holder = pf.holder
          WHERE pf.portfolio = ${slug}`,
    sql<PortfolioCompany[]>`
          SELECT c.holder, c.name, k.role, k.stake_pct::float8 AS stake_pct, k.since::text AS since,
                 c.security, k.source_url,
                 (SELECT p.portfolio FROM portfolios p WHERE p.holder = c.holder AND p.listed
                  ORDER BY p.sort_order LIMIT 1) AS portfolio
          FROM portfolios pf
          JOIN holder_links k ON k.holder = pf.holder
               AND k.role IN ('chair', 'ceo', 'founder', 'controlling_holder')
          JOIN holders c ON c.holder = k.related
          WHERE pf.portfolio = ${slug} AND (k.until IS NULL OR k.until > current_date)
          ORDER BY k.stake_pct DESC NULLS LAST, c.name`,
    sql<PortfolioSummary[]>`
          SELECT l.period::text AS period, l.filed_on::text AS filed_on, l.value_usd::float8 AS value_usd,
                 l.value_change_pct::float8 AS value_change_pct, l.turnover_pct::float8 AS turnover_pct,
                 l.positions::int AS positions, l.crypto_positions::int AS crypto_positions,
                 l.new_positions::int AS new_positions, l.closed_positions::int AS closed_positions,
                 l.top10_weight_pct::float8 AS top10_weight_pct,
                 l.options_usd::float8 AS options_usd, l.debt_usd::float8 AS debt_usd,
                 (SELECT sum(amount * dps_fy)::float8 FROM portfolio_holdings_now h
                  WHERE h.portfolio = ${slug} AND h.amount > 0 AND h.put_call = '') AS dividend_income_usd,
                 (SELECT sum(amount * eps_ttm)::float8 FROM portfolio_holdings_now h
                  WHERE h.portfolio = ${slug} AND h.amount > 0 AND h.put_call = '') AS look_through_earnings_usd,
                 (SELECT sum(value_now_usd)::float8 FROM portfolio_holdings_now h
                  WHERE h.portfolio = ${slug} AND h.amount > 0 AND h.put_call = '') AS value_now_usd
          FROM portfolio_periods l
          WHERE l.portfolio = ${slug}
          ORDER BY l.period DESC LIMIT 1`,
    sql<PortfolioPerformance[]>`
          WITH last AS (
            SELECT day, nav FROM portfolio_nav
            WHERE portfolio = ${slug} AND method = 'holder' ORDER BY day DESC LIMIT 1
          ),
          h AS (SELECT * FROM (VALUES ('1y', 1), ('3y', 3), ('5y', 5)) v(horizon, years)),
          start AS (
            SELECT h.horizon, h.years, s.day, s.nav
            FROM h CROSS JOIN last
            JOIN LATERAL (
              SELECT day, nav FROM portfolio_nav
              WHERE portfolio = ${slug} AND method = 'holder' AND day <= last.day - make_interval(years => h.years)
              ORDER BY day DESC LIMIT 1
            ) s ON true
          ),
          bench AS (SELECT benchmark FROM portfolios WHERE portfolio = ${slug})
          SELECT start.horizon, start.day::text AS from_day, last.day::text AS to_day,
                 (100 * (last.nav / start.nav - 1))::float8 AS portfolio_pct,
                 (100 * (b1.close / b0.close - 1))::float8 AS benchmark_pct,
                 (100 * ((last.nav / start.nav) / (b1.close / b0.close) - 1))::float8 AS relative_pct
          FROM start CROSS JOIN last CROSS JOIN bench
          JOIN LATERAL (SELECT close FROM security_prices WHERE security = bench.benchmark AND day <= start.day ORDER BY day DESC LIMIT 1) b0 ON true
          JOIN LATERAL (SELECT close FROM security_prices WHERE security = bench.benchmark AND day <= last.day ORDER BY day DESC LIMIT 1) b1 ON true
          ORDER BY start.years`,
    sql<PortfolioHolding[]>`
          SELECT security, coalesce(ticker, security) AS ticker, coalesce(name, security) AS name, kind, sector,
                 site_base, site_class, source, amount::float8 AS amount, prev_amount::float8 AS prev_amount,
                 change, change_usd::float8 AS change_usd, value_usd::float8 AS value_usd,
                 weight_pct::float8 AS weight_pct, close::float8 AS close, market_cap_usd::float8 AS market_cap_usd,
                 pe_ttm::float8 AS pe_ttm, pb::float8 AS pb, dividend_yield_pct::float8 AS dividend_yield_pct,
                 beta_5y::float8 AS beta_5y, perf_1m_pct::float8 AS perf_1m_pct,
                 pullback_1m_pct::float8 AS pullback_1m_pct, piotroski::float8 AS piotroski,
                 revenue_growth_pct::float8 AS revenue_growth_pct,
                 fair_value_upside_pct::float8 AS fair_value_upside_pct,
                 analyst_upside_pct::float8 AS analyst_upside_pct, graham_upside_pct::float8 AS graham_upside_pct
          FROM portfolio_holdings_now
          WHERE portfolio = ${slug} AND put_call = ''
          ORDER BY value_usd DESC, ticker`,
    // The chart's line ends on the holding's newest close; the high is the intraday one, so a
    // close line can stop short of it.
    sql<PortfolioPullback[]>`
          SELECT h.security, coalesce(h.ticker, h.security) AS ticker, coalesce(h.name, h.security) AS name,
                 h.weight_pct::float8 AS weight_pct, h.close::float8 AS close, h.high_1m::float8 AS high_1m,
                 h.pullback_1m_pct::float8 AS pullback_1m_pct,
                 coalesce((SELECT json_agg(json_build_array(p.day::text, p.close) ORDER BY p.day)
                           FROM security_prices p
                           WHERE p.security = h.security
                             AND p.day > (SELECT max(day) FROM security_prices WHERE security = h.security) - 31),
                          '[]'::json) AS closes
          FROM portfolio_holdings_now h
          WHERE h.portfolio = ${slug} AND h.put_call = '' AND h.amount > 0 AND h.pullback_1m_pct IS NOT NULL
          ORDER BY h.pullback_1m_pct, h.ticker
          LIMIT 10`,
    sql<PortfolioPeriod[]>`
          SELECT p.period::text AS period, p.filed_on::text AS filed_on, p.value_usd::float8 AS value_usd,
                 p.value_change_pct::float8 AS value_change_pct, p.turnover_pct::float8 AS turnover_pct,
                 p.positions::int AS positions, p.new_positions::int AS new_positions,
                 p.closed_positions::int AS closed_positions,
                 coalesce((
                   SELECT json_agg(json_build_object('accession', f.accession, 'form', f.form,
                                                     'filed_on', f.filed_on::text, 'url', f.primary_doc_url,
                                                     'amendment_type', f.amendment_type)
                                   ORDER BY f.filed_on, f.accession)
                   FROM sec_13f_filings f WHERE f.accession = ANY (string_to_array(p.accessions, ','))),
                   '[]'::json) AS filings
          FROM portfolio_periods p
          WHERE p.portfolio = ${slug}
          ORDER BY p.period DESC
          LIMIT 40`,
    sql<PortfolioWallet[]>`
          SELECT w.chain, w.address, w.wallet_group, w.label, w.evidence, w.evidence_url, w.confidence,
                 (SELECT count(*) FROM wallet_set_outputs o
                  WHERE o.chain = w.chain AND o.set_address = w.address)::int AS outputs,
                 b.day::text AS day, coalesce(b.value_usd, 0)::float8 AS value_usd,
                 coalesce(b.coins, '[]'::json) AS coins
          FROM portfolios pf
          JOIN holder_wallets w ON w.holder = pf.holder
          LEFT JOIN LATERAL (
            SELECT max(x.day) AS day, sum(x.value_usd) AS value_usd,
                   json_agg(json_build_object('security', x.security, 'amount', x.amount::float8,
                                              'value_usd', x.value_usd) ORDER BY x.value_usd DESC) AS coins
            FROM wallet_balances x
            WHERE x.chain = w.chain AND x.address = w.address
              AND x.day = (SELECT max(day) FROM wallet_balances y WHERE y.chain = w.chain AND y.address = w.address)
          ) b ON true
          WHERE pf.portfolio = ${slug}
          ORDER BY b.value_usd DESC NULLS LAST, w.wallet_group, w.address`,
  ]).catch((error) => {
    if (missingOrRefused(error)) return null;
    throw error;
  });
  if (!read) return null;
  const [heads, companies, summaries, performance, holdings, pullback, history, wallets] = read;
  const [head] = heads;
  if (!head) return null;
  return {
    ...head,
    companies: [...companies],
    summary: summaries[0] ?? null,
    performance: [...performance],
    holdings: [...holdings],
    pullback: [...pullback],
    history: [...history],
    wallets: [...wallets],
  };
}

export async function heldStocks(sql: postgres.Sql): Promise<HeldStock[]> {
  const rows = await rowsOrNone(
    sql<HeldStock[]>`
      SELECT h.security, coalesce(h.ticker, h.security) AS ticker, coalesce(h.name, h.security) AS name,
             h.site_base, h.site_class,
             (count(*) FILTER (WHERE h.amount > 0))::int AS holders,
             (count(*) FILTER (WHERE h.change IN ('new', 'added')))::int AS buyers,
             (count(*) FILTER (WHERE h.change IN ('reduced', 'closed')))::int AS sellers,
             sum(h.value_usd)::float8 AS value_usd, sum(h.change_usd)::float8 AS net_change_usd
      FROM portfolio_holdings_now h JOIN portfolios pf USING (portfolio)
      WHERE pf.listed AND h.put_call = '' AND h.security NOT LIKE 'CRYPTO:%'
      GROUP BY 1, 2, 3, 4, 5
      ORDER BY holders DESC, value_usd DESC
      LIMIT 100`,
  );
  return [...rows];
}

export async function stockPage(sql: postgres.Sql, ticker: string): Promise<StockPage | null> {
  type Head = Omit<StockPage, "holders">;
  const heads = await rowsOrNone(
    sql<Head[]>`
      SELECT s.security, s.ticker, s.name, s.kind, s.sector, s.industry, s.site_base, s.site_class,
             m.close::float8 AS close, m.market_cap_usd::float8 AS market_cap_usd, m.pe_ttm::float8 AS pe_ttm,
             m.dividend_yield_pct::float8 AS dividend_yield_pct, m.perf_1m_pct::float8 AS perf_1m_pct
      FROM securities s
      LEFT JOIN LATERAL (
        SELECT * FROM security_metrics x WHERE x.security = s.security ORDER BY x.day DESC LIMIT 1
      ) m ON true
      WHERE upper(s.ticker) = ${ticker} AND s.kind <> 'crypto'
        AND EXISTS (SELECT 1 FROM portfolio_positions p WHERE p.security = s.security)
      ORDER BY (s.security LIKE 'CUSIP:%'), s.security
      LIMIT 1`,
  );
  const [head] = heads;
  if (!head) return null;
  const holders = await sql<StockHolder[]>`
    SELECT pf.portfolio, hd.name, pf.title, h.period::text AS period, h.amount::float8 AS amount,
           h.value_usd::float8 AS value_usd, h.weight_pct::float8 AS weight_pct, h.change,
           h.change_usd::float8 AS change_usd
    FROM portfolio_holdings_now h
    JOIN portfolios pf USING (portfolio)
    JOIN holders hd ON hd.holder = pf.holder
    WHERE h.security = ${head.security} AND pf.listed AND h.put_call = ''
    ORDER BY h.value_usd DESC, pf.portfolio`;
  return { ...head, holders: [...holders] };
}

export async function portfolioMoves(sql: postgres.Sql): Promise<PortfolioMove[]> {
  const rows = await rowsOrNone(
    sql<PortfolioMove[]>`
      SELECT p.portfolio, hd.name, p.period::text AS period, p.filed_on::text AS filed_on,
             p.value_usd::float8 AS value_usd, p.value_change_pct::float8 AS value_change_pct,
             p.turnover_pct::float8 AS turnover_pct,
             buy.ticker AS top_buy, buy.change_usd::float8 AS top_buy_usd,
             sell.ticker AS top_sell, sell.change_usd::float8 AS top_sell_usd
      FROM portfolio_periods p
      JOIN portfolios pf USING (portfolio)
      JOIN holders hd ON hd.holder = pf.holder
      LEFT JOIN LATERAL (
        SELECT coalesce(s.ticker, x.security) AS ticker, x.change_usd
        FROM portfolio_positions x LEFT JOIN securities s USING (security)
        WHERE x.portfolio = p.portfolio AND x.period = p.period AND x.put_call = '' AND x.change_usd > 0
        ORDER BY x.change_usd DESC LIMIT 1
      ) buy ON true
      LEFT JOIN LATERAL (
        SELECT coalesce(s.ticker, x.security) AS ticker, x.change_usd
        FROM portfolio_positions x LEFT JOIN securities s USING (security)
        WHERE x.portfolio = p.portfolio AND x.period = p.period AND x.put_call = '' AND x.change_usd < 0
        ORDER BY x.change_usd LIMIT 1
      ) sell ON true
      WHERE pf.listed AND p.filed_on IS NOT NULL
      ORDER BY p.filed_on DESC, p.value_usd DESC
      LIMIT 50`,
  );
  return [...rows];
}

export async function onchainHolders(sql: postgres.Sql): Promise<OnchainHolder[]> {
  const rows = await rowsOrNone(
    sql<OnchainHolder[]>`
      WITH latest AS (
        SELECT DISTINCT ON (chain, address) chain, address, day
        FROM wallet_balances ORDER BY chain, address, day DESC
      ),
      bal AS (
        SELECT w.holder, b.security, sum(b.value_usd) AS value_usd
        FROM holder_wallets w
        JOIN latest l ON l.chain = w.chain AND l.address = w.address
        JOIN wallet_balances b ON b.chain = l.chain AND b.address = l.address AND b.day = l.day
        GROUP BY w.holder, b.security
      )
      SELECT h.holder, h.name, h.kind,
             (SELECT p.portfolio FROM portfolios p WHERE p.holder = h.holder AND p.listed
              ORDER BY p.sort_order LIMIT 1) AS portfolio,
             (SELECT count(*) FROM holder_wallets w WHERE w.holder = h.holder)::int AS addresses,
             (SELECT string_agg(DISTINCT w.chain, ' ') FROM holder_wallets w WHERE w.holder = h.holder) AS chains,
             (SELECT string_agg(DISTINCT w.evidence, ' ') FROM holder_wallets w WHERE w.holder = h.holder) AS evidence,
             coalesce((SELECT sum(value_usd) FROM bal WHERE bal.holder = h.holder), 0)::float8 AS value_usd,
             coalesce((SELECT json_agg(json_build_object('security', t.security, 'value_usd', t.value_usd)
                                       ORDER BY t.value_usd DESC)
                       FROM (SELECT security, value_usd FROM bal WHERE bal.holder = h.holder
                             ORDER BY value_usd DESC LIMIT 4) t), '[]'::json) AS coins
      FROM holders h
      WHERE EXISTS (SELECT 1 FROM holder_wallets w WHERE w.holder = h.holder)
      ORDER BY value_usd DESC, h.name`,
  );
  return [...rows];
}
