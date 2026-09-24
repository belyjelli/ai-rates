package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/spf13/cobra"

	"github.com/belyjelli/ai-rates/collector/internal/catalog"
	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
	"github.com/belyjelli/ai-rates/collector/internal/migrate"
	"github.com/belyjelli/ai-rates/collector/internal/store"
	"github.com/belyjelli/ai-rates/collector/internal/stream"
)

// The debugging commands. Every one of them is READ-ONLY: they read the database or a venue and print,
// and none writes a row, so each is safe beside the running service and from a laptop. `status` and
// `runs` need DATABASE_URL; `watch`, `liqs` and `history` talk to venues directly and need nothing.

func addDebugCommands(root *cobra.Command) {
	root.AddCommand(newStatusCmd(), newRunsCmd(), newWatchCmd(), newLiqsCmd(), newHistoryCmd(), newDoctorCmd())
}

// suspiciousLiquidationUSD is the average liquidation above which a feed is flagged. The honest feeds
// average $150-$9,000; Binance's testnet leak averaged $611k on 2026-09-18 and put single $85M rows in
// production. An average this far out is a units bug or a wrong host far more often than a market.
const suspiciousLiquidationUSD = 100_000

// venueStatus is one feed's row in `collector status`, built from the database alone.
type venueStatus struct {
	id                  string
	liveMarkets, total  int
	freshest            *time.Time
	runsOK, runsFailed  int
	lastRun, lastOK     *time.Time
	lastError           string
	lastRunFailed       bool
	liq24h              int
	liqLast             *time.Time
	liqAvgUSD, liqSumUS float64
}

// state classifies a feed the way /status does, from its own runs: a feed whose newest run failed is
// failing; one with no success in the stale window is stale; one with no runs at all is silent.
func (v venueStatus) state(now time.Time, staleAfter time.Duration) string {
	switch {
	case v.lastRun == nil:
		return "silent"
	case v.lastRunFailed:
		return "failing"
	case v.lastOK == nil || now.Sub(*v.lastOK) > staleAfter:
		return "stale"
	}
	return "ok"
}

func (v venueStatus) note() string {
	if v.liq24h > 0 && v.liqAvgUSD > suspiciousLiquidationUSD {
		return fmt.Sprintf("avg liquidation $%.0f: check units or host", v.liqAvgUSD)
	}
	if v.lastError != "" {
		return truncate(v.lastError, 70)
	}
	return ""
}

func loadStatuses(ctx context.Context, pool *pgxpool.Pool) (map[string]*venueStatus, error) {
	out := map[string]*venueStatus{}
	get := func(id string) *venueStatus {
		if out[id] == nil {
			out[id] = &venueStatus{id: id}
		}
		return out[id]
	}

	rows, err := pool.Query(ctx, `
		SELECT venue_id,
		       count(*) FILTER (WHERE error IS NULL)::int,
		       count(*) FILTER (WHERE error IS NOT NULL)::int,
		       max(started_at),
		       max(started_at) FILTER (WHERE error IS NULL),
		       (array_agg(error ORDER BY started_at DESC))[1]
		FROM collector_runs
		WHERE started_at > now() - interval '24 hours'
		GROUP BY 1`)
	if err != nil {
		return nil, fmt.Errorf("collector_runs: %w", err)
	}
	for rows.Next() {
		var id string
		var ok, failed int
		var lastRun, lastOK *time.Time
		var newestError *string
		if err := rows.Scan(&id, &ok, &failed, &lastRun, &lastOK, &newestError); err != nil {
			rows.Close()
			return nil, err
		}
		v := get(id)
		v.runsOK, v.runsFailed, v.lastRun, v.lastOK = ok, failed, lastRun, lastOK
		if newestError != nil {
			v.lastRunFailed, v.lastError = true, *newestError
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = pool.Query(ctx, `
		SELECT venue_id,
		       count(*) FILTER (WHERE observed_at > now() - interval '5 minutes')::int,
		       count(*)::int, max(observed_at)
		FROM market_latest GROUP BY 1`)
	if err != nil {
		return nil, fmt.Errorf("market_latest: %w", err)
	}
	for rows.Next() {
		var id string
		var live, total int
		var freshest *time.Time
		if err := rows.Scan(&id, &live, &total, &freshest); err != nil {
			rows.Close()
			return nil, err
		}
		v := get(id)
		v.liveMarkets, v.total, v.freshest = live, total, freshest
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Liquidations are keyed by the venue, but a socket feed records its runs under "<venue>:liq", so
	// the counts land on that row when it exists: that is the feed that produced them.
	rows, err = pool.Query(ctx, `
		SELECT venue_id, count(*)::int, max(liquidated_at),
		       coalesce(avg(notional_usd), 0)::float8, coalesce(sum(notional_usd), 0)::float8
		FROM liquidations WHERE liquidated_at > now() - interval '24 hours' GROUP BY 1`)
	if err != nil {
		return nil, fmt.Errorf("liquidations: %w", err)
	}
	for rows.Next() {
		var id string
		var n int
		var last *time.Time
		var avg, sum float64
		if err := rows.Scan(&id, &n, &last, &avg, &sum); err != nil {
			rows.Close()
			return nil, err
		}
		target := id
		if _, feed := out[id+":liq"]; feed {
			target = id + ":liq"
		}
		v := get(target)
		v.liq24h, v.liqLast, v.liqAvgUSD, v.liqSumUS = n, last, avg, sum
	}
	rows.Close()
	return out, rows.Err()
}

func newStatusCmd() *cobra.Command {
	var all bool
	cmd := &cobra.Command{
		Use:   "status [venue]",
		Short: "Each venue's health from the database: markets, runs, last error, liquidations",
		Long: `Read each feed's state from the database, the same tables /status is drawn from, so it works
from any machine with DATABASE_URL and needs no running collector. Problems first; --all
includes the healthy ones. With a venue, prints its card and its recent runs.

A liquidation feed whose 24-hour average is over $100k is flagged: honest feeds average
$150-$9,000, and an outlier average has so far always meant wrong units or a wrong host.`,
		Example: `  collector status
  collector status --all
  collector status bingx`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := loadConfig(os.Getenv)
			if err != nil {
				return err
			}
			ctx, stop := signalContext()
			defer stop()
			pool, err := openPool(ctx, cfg)
			if err != nil {
				return err
			}
			defer pool.Close()

			statuses, err := loadStatuses(ctx, pool)
			if err != nil {
				return err
			}
			now := time.Now()
			// Three missed cycles, the same allowance /health gives before calling a venue stale.
			staleAfter := 3 * cfg.interval
			out := cmd.OutOrStdout()

			if len(args) == 1 {
				return printVenueCard(ctx, out, pool, args[0], statuses, now, staleAfter)
			}

			ids := make([]string, 0, len(statuses))
			for id := range statuses {
				ids = append(ids, id)
			}
			rank := map[string]int{"failing": 0, "stale": 1, "silent": 2, "ok": 3}
			sort.Slice(ids, func(i, j int) bool {
				a, b := statuses[ids[i]], statuses[ids[j]]
				ra, rb := rank[a.state(now, staleAfter)], rank[b.state(now, staleAfter)]
				if a.note() != "" && ra == 3 {
					ra = 2 // healthy but flagged sorts with the problems
				}
				if b.note() != "" && rb == 3 {
					rb = 2
				}
				if ra != rb {
					return ra < rb
				}
				return ids[i] < ids[j]
			})

			counts := map[string]int{}
			w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "FEED\tSTATE\tLIVE MKTS\tLAST OK\tRUNS 24H\tLIQ 24H\tLIQ AVG\tNOTE")
			shown := 0
			for _, id := range ids {
				v := statuses[id]
				state := v.state(now, staleAfter)
				counts[state]++
				if !all && state == "ok" && v.note() == "" {
					continue
				}
				shown++
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%d/%d\t%s\t%s\t%s\n", id, state, markets(v), ago(v.lastOK, now),
					v.runsOK, v.runsOK+v.runsFailed, liqCount(v), liqAvg(v), v.note())
			}
			fmt.Fprintf(out, "%d feeds: %d ok, %d failing, %d stale, %d silent\n",
				len(ids), counts["ok"], counts["failing"], counts["stale"], counts["silent"])
			if shown == 0 {
				fmt.Fprintln(out, "nothing to report; --all lists every feed")
				return nil
			}
			return w.Flush()
		},
	}
	cmd.Flags().BoolVar(&all, "all", false, "list healthy feeds too, not only problems")
	return cmd
}

func printVenueCard(ctx context.Context, out io.Writer, pool *pgxpool.Pool, id string, statuses map[string]*venueStatus, now time.Time, staleAfter time.Duration) error {
	ids := []string{id, id + ":liq", id + ":ws"}
	found := false
	for _, feed := range ids {
		v, ok := statuses[feed]
		if !ok {
			continue
		}
		found = true
		fmt.Fprintf(out, "%s  %s\n", feed, strings.ToUpper(v.state(now, staleAfter)))
		if v.total > 0 {
			fmt.Fprintf(out, "  markets    %d live of %d stored, freshest %s\n", v.liveMarkets, v.total, ago(v.freshest, now))
		}
		fmt.Fprintf(out, "  runs 24h   %d ok, %d failed; last run %s, last success %s\n",
			v.runsOK, v.runsFailed, ago(v.lastRun, now), ago(v.lastOK, now))
		if v.lastError != "" {
			fmt.Fprintf(out, "  last error %s\n", v.lastError)
		}
		if v.liq24h > 0 {
			fmt.Fprintf(out, "  liq 24h    %d forced closes, $%.0f, avg $%.0f, newest %s\n", v.liq24h, v.liqSumUS, v.liqAvgUSD, ago(v.liqLast, now))
		}
		if note := v.note(); note != "" && !strings.HasPrefix(v.lastError, strings.TrimSuffix(note, "...")) {
			fmt.Fprintf(out, "  note       %s\n", note)
		}
	}
	if !found {
		return fmt.Errorf("no runs, markets or liquidations recorded for %q in 24 hours; `collector venues` lists the ids", id)
	}
	fmt.Fprintln(out, "\nrecent runs:")
	return printRuns(ctx, out, pool, ids, 10, false, now)
}

func newRunsCmd() *cobra.Command {
	var limit int
	var errorsOnly bool
	cmd := &cobra.Command{
		Use:   "runs <venue>",
		Short: "A venue's recent collection runs: duration, markets, requests, error",
		Long: `List a venue's recent runs from collector_runs, newest first, across its funding poll and its
":liq" and ":ws" feeds. --errors keeps only the failures, which is usually the question.`,
		Example: `  collector runs gate
  collector runs bingx --errors --limit 50`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := loadConfig(os.Getenv)
			if err != nil {
				return err
			}
			ctx, stop := signalContext()
			defer stop()
			pool, err := openPool(ctx, cfg)
			if err != nil {
				return err
			}
			defer pool.Close()
			id := args[0]
			return printRuns(ctx, cmd.OutOrStdout(), pool, []string{id, id + ":liq", id + ":ws"}, limit, errorsOnly, time.Now())
		},
	}
	cmd.Flags().IntVar(&limit, "limit", 20, "runs to list")
	cmd.Flags().BoolVar(&errorsOnly, "errors", false, "only failed runs")
	return cmd
}

func printRuns(ctx context.Context, out io.Writer, pool *pgxpool.Pool, ids []string, limit int, errorsOnly bool, now time.Time) error {
	rows, err := pool.Query(ctx, `
		SELECT started_at, venue_id, duration_ms, markets, requests, error
		FROM collector_runs
		WHERE venue_id = ANY($1) AND ($2::bool = false OR error IS NOT NULL)
		ORDER BY started_at DESC LIMIT $3`, ids, errorsOnly, limit)
	if err != nil {
		return fmt.Errorf("collector_runs: %w", err)
	}
	type run struct {
		at                          time.Time
		feed                        string
		duration, markets, requests int
		err                         *string
	}
	runs, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (run, error) {
		var r run
		return r, row.Scan(&r.at, &r.feed, &r.duration, &r.markets, &r.requests, &r.err)
	})
	if err != nil {
		return err
	}
	if len(runs) == 0 {
		fmt.Fprintln(out, "no runs recorded")
		return nil
	}
	w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "WHEN\tFEED\tTOOK\tMARKETS\tREQUESTS\tERROR")
	for _, r := range runs {
		errText := ""
		if r.err != nil {
			errText = truncate(*r.err, 90)
		}
		at := r.at
		fmt.Fprintf(w, "%s\t%s\t%s\t%d\t%d\t%s\n", ago(&at, now), r.feed,
			(time.Duration(r.duration) * time.Millisecond).String(), r.markets, r.requests, errText)
	}
	return w.Flush()
}

// printSink prints what a liquidation feed decodes instead of storing it.
type printSink struct {
	out   io.Writer
	count int
}

func (p *printSink) RecordLiquidations(_ context.Context, _ string, rows []core.Liquidation) (int, error) {
	for _, row := range rows {
		p.count++
		notional := "-"
		if row.NotionalUSD != nil {
			notional = fmt.Sprintf("$%.2f", *row.NotionalUSD)
		}
		fmt.Fprintf(p.out, "%s  %-5s  %-22s size %-14g price %-14g %s\n",
			time.UnixMilli(row.LiquidatedAt).UTC().Format("15:04:05.000"), row.Side, row.VenueSymbol,
			row.SizeContracts, row.FillPrice, notional)
	}
	return len(rows), nil
}

func newWatchCmd() *cobra.Command {
	var seconds int
	var symbols string
	cmd := &cobra.Command{
		Use:   "watch <venue>",
		Short: "Connect to a venue's liquidation socket and print each forced close live, writing nothing",
		Long: `Open the venue's liquidation socket exactly as the collector does (same URL, subscribe frames,
keepalive and decoder) and print every liquidation as it is decoded, plus connection events.
Nothing is written. It is the socket counterpart of "fetch": it shows at once whether a feed
connects, what it delivers, and which side it reads — a wrong host or an inverted side is visible
in the first few rows.

A venue with one topic per market (bybit, lighter) needs markets to subscribe: pass --symbols,
or set DATABASE_URL and the active ones are read from the database.`,
		Example: `  collector watch okx
  collector watch lighter --symbols BTC,ETH,SOL --seconds 120
  collector watch nado --seconds 600`,
		Args: cobra.ExactArgs(1),
		ValidArgsFunction: func(*cobra.Command, []string, string) ([]string, cobra.ShellCompDirective) {
			return []string{"okx", "bybit", "binance", "htx", "aster", "lighter", "nado"}, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := loadConfig(os.Getenv)
			if err != nil {
				return err
			}
			venueID := args[0]
			proto := liquidationProtocol(cfg, venueID)
			if proto == nil {
				return fmt.Errorf("%q has no liquidation socket; polled venues are read with `collector liqs %s`", venueID, venueID)
			}
			ctx, stop := signalContext()
			defer stop()
			ctx, cancel := context.WithTimeout(ctx, time.Duration(seconds)*time.Second)
			defer cancel()

			var subjects []string
			if proto.NeedsSymbols() {
				subjects, err = watchSubjects(ctx, cfg, venueID, symbols)
				if err != nil {
					return err
				}
			}

			out := cmd.OutOrStdout()
			sink := &printSink{out: out}
			feed := stream.NewEventFeed(proto, stream.DialerFor(proto), sink, subjects, stream.Options{
				FlushEvery: time.Second,
				Log:        func(message string) { fmt.Fprintf(out, "-- %s\n", message) },
			})
			fmt.Fprintf(out, "watching %s (%s) for %ds; Ctrl-C to stop\n", venueID, proto.URL(), seconds)
			feed.Start(ctx)
			<-ctx.Done()
			stopCtx, done := context.WithTimeout(context.Background(), 5*time.Second)
			defer done()
			_ = feed.Stop(stopCtx)
			fmt.Fprintf(out, "%d liquidations in %ds\n", sink.count, seconds)
			return nil
		},
	}
	cmd.Flags().IntVar(&seconds, "seconds", 60, "how long to watch")
	cmd.Flags().StringVar(&symbols, "symbols", "", "comma-separated markets, for venues with one topic per market")
	return cmd
}

func watchSubjects(ctx context.Context, cfg config, venueID, flag string) ([]string, error) {
	if flag != "" {
		var out []string
		for _, symbol := range strings.Split(flag, ",") {
			if s := strings.TrimSpace(symbol); s != "" {
				out = append(out, s)
			}
		}
		return out, nil
	}
	if cfg.databaseURL == "" {
		return nil, errors.New("this venue subscribes per market: pass --symbols, or set DATABASE_URL to use its active markets")
	}
	pool, err := openPool(ctx, cfg)
	if err != nil {
		return nil, err
	}
	defer pool.Close()
	venues, _ := catalog.Load(cfg.venueCatalog)
	return liquidationSymbols(ctx, newStore(pool, venues), venueID)
}

func newLiqsCmd() *cobra.Command {
	var limit int
	cmd := &cobra.Command{
		Use:   "liqs <venue>",
		Short: "Run a polled venue's liquidation fetch once and print the rows, writing nothing",
		Long: `Call the venue's REST liquidation fetch once, as the 5-minute poll does, and print what it
returns. Nothing is written. For venues whose liquidations are polled: gate, okx, dydx,
orderly, bluefin. Socket venues are read with "collector watch".`,
		Example: `  collector liqs orderly
  collector liqs bluefin --limit 0`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			fetcher, err := fetcherFor(args[0])
			if err != nil {
				return err
			}
			liquidator, ok := fetcher.(collector.LiquidationFetcher)
			if !ok {
				return fmt.Errorf("%s has no polled liquidation fetch; try `collector watch %s`", args[0], args[0])
			}
			ctx, stop := signalContext()
			defer stop()
			started := time.Now()
			rows, complete, err := liquidator.FetchLiquidations(ctx)
			if err != nil {
				return err
			}
			out := cmd.OutOrStdout()
			sort.Slice(rows, func(i, j int) bool { return rows[i].LiquidatedAt > rows[j].LiquidatedAt })
			var sum float64
			for _, row := range rows {
				if row.NotionalUSD != nil {
					sum += *row.NotionalUSD
				}
			}
			fmt.Fprintf(out, "%s: %d liquidations, $%.0f, complete=%v, %d requests, %s\n", args[0], len(rows), sum,
				complete, fetcher.RequestCount(), time.Since(started).Round(time.Millisecond))
			shown := rows
			if limit > 0 && len(shown) > limit {
				shown = shown[:limit]
			}
			sink := &printSink{out: out}
			_, _ = sink.RecordLiquidations(ctx, args[0], shown)
			if len(shown) < len(rows) {
				fmt.Fprintf(out, "... %d more (--limit 0 shows all)\n", len(rows)-len(shown))
			}
			return nil
		},
	}
	cmd.Flags().IntVar(&limit, "limit", 20, "rows to print; 0 prints all")
	return cmd
}

func newHistoryCmd() *cobra.Command {
	var days int
	cmd := &cobra.Command{
		Use:   "history <venue> <symbol>",
		Short: "Fetch one market's settled funding history from the venue and print it, writing nothing",
		Long: `Fetch settled funding payments for one market over the last --days, exactly as the history
sweep does, and print them oldest first. Nothing is written. The symbol is the venue's own, as
"collector fetch <venue>" prints it.`,
		Example: `  collector history bybit BTCUSDT
  collector history gate BTC_USDT --days 7`,
		Args: cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			fetcher, err := fetcherFor(args[0])
			if err != nil {
				return err
			}
			historian, ok := fetcher.(collector.HistoryFetcher)
			if !ok {
				return fmt.Errorf("%s publishes no funding history the collector reads", args[0])
			}
			ctx, stop := signalContext()
			defer stop()
			to := time.Now()
			from := to.Add(-time.Duration(days) * 24 * time.Hour)
			events, err := historian.FetchFundingHistory(ctx, args[1], from.UnixMilli(), to.UnixMilli())
			if err != nil {
				return err
			}
			out := cmd.OutOrStdout()
			fmt.Fprintf(out, "%s %s: %d settlements in %d days, %d requests\n", args[0], args[1], len(events), days, fetcher.RequestCount())
			w := tabwriter.NewWriter(out, 0, 0, 2, ' ', tabwriter.AlignRight)
			fmt.Fprintln(w, "SETTLED (UTC)\tRATE\tBASIS h\tAPR %\t")
			for _, e := range events {
				apr := 0.0
				if e.BasisHours > 0 {
					apr = e.Rate / e.BasisHours * 876000
				}
				fmt.Fprintf(w, "%s\t%.6f\t%g\t%.2f\t\n", time.UnixMilli(e.SettledAt).UTC().Format("2006-01-02 15:04"), e.Rate, e.BasisHours, apr)
			}
			return w.Flush()
		},
	}
	cmd.Flags().IntVar(&days, "days", 3, "how far back to read")
	return cmd
}

// fetcherFor builds one venue's adapter with its production client settings.
func fetcherFor(venueID string) (collector.Fetcher, error) {
	c, known := candidateFor(venueID)
	if !known {
		return nil, fmt.Errorf("no adapter for %q; `collector venues` lists them", venueID)
	}
	key := c.group
	if key == "" {
		key = c.id
	}
	return c.build(httpclient.New(key, httpclient.Options{MinInterval: c.spacing})), nil
}

func newDoctorCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "doctor",
		Short: "Check config, catalog, database, migrations and the running collector, one line each",
		Long: `Run every check a deploy depends on and print one line each, then exit 1 if any failed. The
database checks are skipped without DATABASE_URL, and the running-collector check is skipped
when nothing answers on HEALTH_PORT, so it is useful from a laptop as well as in the container.`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			out := cmd.OutOrStdout()
			failed := 0
			check := func(name string, err error, detail string) {
				switch {
				case err == nil:
					fmt.Fprintf(out, "  ok    %-20s %s\n", name, detail)
				case errors.Is(err, errSkipped):
					fmt.Fprintf(out, "  skip  %-20s %s\n", name, detail)
				default:
					failed++
					fmt.Fprintf(out, "  FAIL  %-20s %v\n", name, err)
				}
			}

			cfg, err := loadConfig(os.Getenv)
			check("config", err, fmt.Sprintf("interval %s, %d liquidation feeds", cfg.interval, len(cfg.liquidationVenues)))
			if err != nil {
				return quietError{err}
			}

			venues, err := catalog.Load(cfg.venueCatalog)
			check("catalog", err, fmt.Sprintf("%d venues from %s", len(venues), cfg.venueCatalog))
			if err == nil {
				missing := 0
				byID := map[string]bool{}
				for _, v := range venues {
					byID[v.ID] = true
				}
				for _, c := range registry() {
					if !byID[c.id] {
						missing++
					}
				}
				var regErr error
				if missing > 0 {
					regErr = fmt.Errorf("%d registered adapters have no catalog row", missing)
				}
				check("registry", regErr, fmt.Sprintf("%d adapters, all catalogued", len(registry())))
			}

			ctx, stop := signalContext()
			defer stop()
			ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			if cfg.databaseURL == "" {
				check("database", errSkipped, "DATABASE_URL not set")
			} else {
				pool, err := openPool(ctx, cfg)
				check("database", err, "reachable")
				if err == nil {
					pending, err := migrate.Pending(ctx, pool, os.DirFS(cfg.migrationsDir))
					if err == nil && len(pending.Applied) > 0 {
						err = fmt.Errorf("%d pending: %s", len(pending.Applied), strings.Join(pending.Applied, ", "))
					}
					check("migrations", err, fmt.Sprintf("%d applied, none pending", len(pending.Skipped)))

					statuses, err := loadStatuses(ctx, pool)
					if err == nil {
						var bad []string
						for id, v := range statuses {
							if s := v.state(time.Now(), 3*cfg.interval); s == "failing" || s == "stale" {
								bad = append(bad, id)
							}
						}
						sort.Strings(bad)
						if len(bad) > 0 {
							err = fmt.Errorf("%d feeds failing or stale: %s (see `collector status`)", len(bad), strings.Join(bad, ", "))
						}
					}
					check("feeds", err, fmt.Sprintf("%d feeds ok by the database", len(statuses)))
					pool.Close()
				}
			}

			url := fmt.Sprintf("http://127.0.0.1:%d/health", cfg.healthPort)
			req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			resp, err := (&http.Client{Timeout: 3 * time.Second}).Do(req)
			switch {
			case err != nil:
				check("running collector", errSkipped, "nothing answering on "+url)
			default:
				resp.Body.Close()
				var healthErr error
				if resp.StatusCode != http.StatusOK {
					healthErr = fmt.Errorf("/health answered %d (see `collector health`)", resp.StatusCode)
				}
				check("running collector", healthErr, "/health OK")
			}

			if failed > 0 {
				return quietError{fmt.Errorf("%d checks failed", failed)}
			}
			return nil
		},
	}
}

var errSkipped = errors.New("skipped")

// newStore is the store the collector builds, with the catalog's curated leverage.
func newStore(pool *pgxpool.Pool, venues []catalog.Venue) *store.Store {
	return store.New(pool, catalog.CuratedMaxLeverage(venues))
}

func markets(v *venueStatus) string {
	if v.total == 0 {
		return "-"
	}
	return fmt.Sprintf("%d/%d", v.liveMarkets, v.total)
}

func liqCount(v *venueStatus) string {
	if v.liq24h == 0 {
		return "-"
	}
	return fmt.Sprintf("%d", v.liq24h)
}

func liqAvg(v *venueStatus) string {
	if v.liq24h == 0 {
		return "-"
	}
	return fmt.Sprintf("$%.0f", v.liqAvgUSD)
}

func truncate(s string, n int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) <= n {
		return s
	}
	return s[:n-3] + "..."
}
