package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"runtime/debug"
	"slices"
	"sort"
	"strings"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"

	"github.com/belyjelli/ai-rates/collector/internal/catalog"
	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
	"github.com/belyjelli/ai-rates/collector/internal/migrate"
	"github.com/belyjelli/ai-rates/collector/internal/store"
)

// The command tree. Configuration stays in the environment, exactly as the container sets it, so
// `docker exec airates-collector-go collector <command>` sees the same DATABASE_URL, catalog and
// migrations as the running process with nothing to pass. Flags only choose what a command does.

// execute runs the command line and returns the process exit code.
func execute(args []string, stdout, stderr io.Writer) int {
	root := newRootCmd(stdout, stderr)
	root.SetArgs(args)
	if err := root.Execute(); err != nil {
		// A command that has already reported its own verdict (an unhealthy /health, a failed job) exits
		// 1 without cobra printing "Error:" over it a second time.
		var quiet quietError
		if !errors.As(err, &quiet) {
			fmt.Fprintln(stderr, "Error:", err)
		}
		return 1
	}
	return 0
}

// quietError is a failure the command has already explained on stdout.
type quietError struct{ error }

func newRootCmd(stdout, stderr io.Writer) *cobra.Command {
	root := &cobra.Command{
		Use:   "collector",
		Short: "Polls perpetual-futures venues into TimescaleDB, and the tools to operate it",
		Long: `collector polls perpetual-futures venues and writes what they report into TimescaleDB.

With no command it runs the collector, which is what the container's ENTRYPOINT does.
Configuration comes from the environment (DATABASE_URL, COLLECT_VENUES, ...), the same
variables the running service reads, so inside the container every command needs no flags:

  docker exec airates-collector-go collector health`,
		// No arguments means run: the image's ENTRYPOINT has always been the bare binary.
		RunE:          func(*cobra.Command, []string) error { return run(newLogger(stdout)) },
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.SetOut(stdout)
	root.SetErr(stderr)
	root.AddCommand(
		&cobra.Command{
			Use:   "run",
			Short: "Run the collector (the default when no command is given)",
			Args:  cobra.NoArgs,
			RunE:  func(*cobra.Command, []string) error { return run(newLogger(stdout)) },
		},
		newMigrateCmd(),
		newVenuesCmd(),
		newFetchCmd(),
		newJobsCmd(),
		newHealthCmd(),
		newVersionCmd(),
	)
	addDebugCommands(root)
	return root
}

func newLogger(w io.Writer) *slog.Logger {
	log := slog.New(slog.NewJSONHandler(w, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)
	return log
}

// signalContext is cancelled on Ctrl-C or SIGTERM, so a long job or fetch stops cleanly.
func signalContext() (context.Context, context.CancelFunc) {
	return signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
}

func newMigrateCmd() *cobra.Command {
	var status bool
	cmd := &cobra.Command{
		Use:   "migrate",
		Short: "Apply pending database migrations, or list them with --status",
		Long: `Apply every migration in MIGRATIONS_DIR that schema_migrations does not record yet.

The collector already does this on every boot; this runs it on its own, e.g. to check a
migration applies before restarting the service. --status changes nothing.`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
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

			dir := os.DirFS(cfg.migrationsDir)
			out := cmd.OutOrStdout()
			if status {
				result, err := migrate.Pending(ctx, pool, dir)
				if err != nil {
					return err
				}
				fmt.Fprintf(out, "%d applied, %d pending (%s)\n", len(result.Skipped), len(result.Applied), cfg.migrationsDir)
				for _, name := range result.Applied {
					fmt.Fprintf(out, "  pending  %s\n", name)
				}
				return nil
			}
			result, err := migrate.Apply(ctx, pool, dir)
			if err != nil {
				return err
			}
			if len(result.Applied) == 0 {
				fmt.Fprintf(out, "nothing to apply; %d already applied\n", len(result.Skipped))
				return nil
			}
			for _, name := range result.Applied {
				fmt.Fprintf(out, "  applied  %s\n", name)
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&status, "status", false, "list applied and pending migrations without applying any")
	return cmd
}

func newVenuesCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "venues",
		Short: "List every venue: its adapter, whether it is selected, and its stream and liquidation feeds",
		Long: `List every venue the binary has an adapter for, with what the current environment makes
of it: whether COLLECT_VENUES selects it for snapshots, whether it has a quote stream
(STREAM_VENUES) and a liquidation feed (LIQUIDATION_VENUES). Needs no database.`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			cfg, err := loadConfig(os.Getenv)
			if err != nil {
				return err
			}
			// The catalog only adds names and types. The image carries it; a checkout does not have it
			// at the image path, so a missing one degrades the table rather than failing the command.
			names := map[string]catalog.Venue{}
			if venues, err := catalog.Load(cfg.venueCatalog); err == nil {
				for _, venue := range venues {
					names[venue.ID] = venue
				}
			}
			chosen := map[string]bool{}
			for _, id := range selectedVenueIDs(cfg) {
				chosen[id] = true
			}
			liquidations := map[string]bool{}
			for _, id := range cfg.liquidationVenues {
				liquidations[id] = liquidationProtocol(cfg, id) != nil
			}

			w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "VENUE\tNAME\tTYPE\tSNAPSHOTS\tSTREAM\tLIQUIDATIONS")
			for _, c := range registry() {
				venue := names[c.id]
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n", c.id, dash(venue.Name), dash(venue.Type),
					yesNo(chosen[c.id]), streamState(cfg, c.id), yesNo(liquidations[c.id]))
			}
			return w.Flush()
		},
	}
}

func streamState(cfg config, venueID string) string {
	switch {
	case streamProtocol(venueID) == nil:
		return "-"
	case slices.Contains(cfg.streamVenues, venueID):
		return "on"
	default:
		return "off"
	}
}

func newFetchCmd() *cobra.Command {
	var limit int
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "fetch <venue>",
		Short: "Fetch one live snapshot from a venue and print it, writing nothing",
		Long: `Run one snapshot fetch for one venue against its live API, exactly as a collection cycle
would, and print what came back. Nothing is written to the database, so this is safe to
run beside the service. It is the first thing to try when a venue shows empty on /status.

A few adapters learn things over several cycles (MEXC's settlement intervals, for example)
and are seeded from the database on boot; a one-off fetch has neither, so it can list fewer
markets or leave those fields empty.`,
		Example: `  collector fetch bybit
  collector fetch hyperliquid --limit 5
  collector fetch okx --json`,
		Args: cobra.ExactArgs(1),
		ValidArgsFunction: func(*cobra.Command, []string, string) ([]string, cobra.ShellCompDirective) {
			return venueIDs(), cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			venueID := args[0]
			c, known := candidateFor(venueID)
			if !known {
				return fmt.Errorf("no adapter for %q; `collector venues` lists them", venueID)
			}
			ctx, stop := signalContext()
			defer stop()

			key := c.group
			if key == "" {
				key = c.id
			}
			fetcher := c.build(httpclient.New(key, httpclient.Options{MinInterval: c.spacing}))
			started := time.Now()
			batch, err := fetcher.FetchSnapshots(ctx, started)
			took := time.Since(started)
			if err != nil {
				return fmt.Errorf("%s: %w (after %s, %d requests)", venueID, err, took.Round(time.Millisecond), fetcher.RequestCount())
			}

			rows := batch.Snapshots
			sort.Slice(rows, func(i, j int) bool { return rows[i].VenueSymbol < rows[j].VenueSymbol })
			out := cmd.OutOrStdout()
			if asJSON {
				enc := json.NewEncoder(out)
				enc.SetIndent("", "  ")
				return enc.Encode(batch)
			}
			fmt.Fprintf(out, "%s: %d markets, %d settled events, %d requests, %s\n",
				venueID, len(rows), len(batch.Settled), fetcher.RequestCount(), took.Round(time.Millisecond))
			if len(rows) == 0 {
				return nil
			}
			w := tabwriter.NewWriter(out, 0, 0, 2, ' ', tabwriter.AlignRight)
			fmt.Fprintln(w, "SYMBOL\tBASE\tRATE\tBASIS h\tAPR %\tMARK\tOPEN INTEREST\t")
			shown := rows
			if limit > 0 && len(shown) > limit {
				shown = shown[:limit]
			}
			for _, row := range shown {
				fmt.Fprintf(w, "%s\t%s\t%.6f\t%g\t%.2f\t%s\t%s\t\n", row.VenueSymbol, row.Base, row.Rate, row.BasisHours,
					row.Rate/row.BasisHours*876000, optFloat(row.MarkPrice, "%.6g"), optFloat(row.OpenInterestUSD, "$%.0f"))
			}
			if err := w.Flush(); err != nil {
				return err
			}
			if len(shown) < len(rows) {
				fmt.Fprintf(out, "... %d more (--limit 0 shows all)\n", len(rows)-len(shown))
			}
			return nil
		},
	}
	cmd.Flags().IntVar(&limit, "limit", 20, "markets to print; 0 prints all")
	cmd.Flags().BoolVar(&asJSON, "json", false, "print the whole batch as JSON")
	return cmd
}

func candidateFor(venueID string) (candidate, bool) {
	for _, c := range registry() {
		if c.id == venueID {
			return c, true
		}
	}
	return candidate{}, false
}

func venueIDs() []string {
	ids := make([]string, 0, 64)
	for _, c := range registry() {
		ids = append(ids, c.id)
	}
	return ids
}

// jobKeys maps each job's name, as registerJobs declares it, to the short name the CLI takes.
var jobKeys = map[string]string{
	"funding stats refresh":   "stats",
	"long funding windows":    "windows",
	"verified pair backtests": "backtests",
	"price hourly rollup":     "prices",
	"identity checks":         "identity",
	"ranked pair candidates":  "ranked",
}

// namedJob is one fleet-wide job as registerJobs declares it.
type namedJob struct {
	name, key    string
	pause, delay time.Duration
	run          func(context.Context) error
}

func collectJobs(cfg config, db *store.Store, log *slog.Logger) []namedJob {
	var jobs []namedJob
	registerJobs(cfg, db, log, func(name string, pause, delay time.Duration, job func(context.Context) error) {
		jobs = append(jobs, namedJob{name: name, key: jobKeys[name], pause: pause, delay: delay, run: job})
	})
	return jobs
}

func newJobsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "jobs",
		Short: "List or run the fleet-wide jobs (stats, windows, backtests, prices, identity, ranked)",
	}
	cmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List the jobs, how often the collector runs each, and how long after boot the first run waits",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			cfg, err := loadConfig(os.Getenv)
			if err != nil {
				return err
			}
			// Listing needs no database: the store is only reached when a job runs.
			w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "KEY\tJOB\tEVERY\tFIRST RUN AFTER BOOT")
			for _, job := range collectJobs(cfg, nil, newLogger(io.Discard)) {
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", job.key, job.name, job.pause, job.delay)
			}
			return w.Flush()
		},
	})
	cmd.AddCommand(&cobra.Command{
		Use:   "run <job>... | all",
		Short: "Run jobs now, in order, instead of waiting for the collector's timer",
		Long: `Run one or more fleet-wide jobs now against DATABASE_URL, in the order given, and stop at the
first failure. "all" runs every job in the order the collector registers them, which is
also the order their inputs require: backtests and ranking read what "windows" folds.

The jobs are the collector's own refreshes, idempotent upserts, so running one beside the
service repeats work rather than corrupting it. Useful after a migration, instead of
waiting up to a day for the nightly jobs.`,
		Example: `  collector jobs run windows
  collector jobs run windows backtests ranked
  collector jobs run all`,
		Args: cobra.MinimumNArgs(1),
		ValidArgsFunction: func(*cobra.Command, []string, string) ([]string, cobra.ShellCompDirective) {
			keys := []string{"all"}
			for _, key := range jobKeys {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			return keys, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := loadConfig(os.Getenv)
			if err != nil {
				return err
			}
			// Resolved before connecting, so a typo fails without touching the database.
			all := collectJobs(cfg, nil, nil)
			var picked []string
			if len(args) == 1 && args[0] == "all" {
				for _, job := range all {
					picked = append(picked, job.key)
				}
			} else {
				for _, key := range args {
					if !slices.ContainsFunc(all, func(job namedJob) bool { return job.key == key }) {
						return fmt.Errorf("unknown job %q; `collector jobs list` shows them", key)
					}
					picked = append(picked, key)
				}
			}

			ctx, stop := signalContext()
			defer stop()
			pool, err := openPool(ctx, cfg)
			if err != nil {
				return err
			}
			defer pool.Close()
			venues, _ := catalog.Load(cfg.venueCatalog) // curated leverage only; the jobs do not read it
			db := store.New(pool, catalog.CuratedMaxLeverage(venues))
			jobs := collectJobs(cfg, db, newLogger(cmd.ErrOrStderr()))

			out := cmd.OutOrStdout()
			for _, key := range picked {
				i := slices.IndexFunc(jobs, func(job namedJob) bool { return job.key == key })
				started := time.Now()
				if err := jobs[i].run(ctx); err != nil {
					fmt.Fprintf(out, "FAIL  %-9s %s after %s: %v\n", key, jobs[i].name, time.Since(started).Round(time.Millisecond), err)
					return quietError{err}
				}
				fmt.Fprintf(out, "ok    %-9s %s in %s\n", key, jobs[i].name, time.Since(started).Round(time.Millisecond))
			}
			return nil
		},
	})
	return cmd
}

func newHealthCmd() *cobra.Command {
	var url string
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "health",
		Short: "Show the running collector's /health, and exit 1 when it is not OK",
		Long: `Read /health from the running collector and print it as a table, problems first.
Exits 1 when the collector reports itself unhealthy, so it works as a check:

  docker exec airates-collector-go collector health`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if url == "" {
				cfg, err := loadConfig(os.Getenv)
				if err != nil {
					return err
				}
				url = fmt.Sprintf("http://127.0.0.1:%d/health", cfg.healthPort)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			if err != nil {
				return err
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return fmt.Errorf("is the collector running? %w", err)
			}
			defer resp.Body.Close()
			var snapshot collector.Snapshot
			if err := json.NewDecoder(resp.Body).Decode(&snapshot); err != nil {
				return fmt.Errorf("read %s (HTTP %d): %w", url, resp.StatusCode, err)
			}

			out := cmd.OutOrStdout()
			if asJSON {
				enc := json.NewEncoder(out)
				enc.SetIndent("", "  ")
				if err := enc.Encode(snapshot); err != nil {
					return err
				}
			} else {
				printHealth(out, snapshot, time.Now())
			}
			if !snapshot.OK {
				return quietError{errors.New("collector unhealthy")}
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&url, "url", "", "health endpoint (default http://127.0.0.1:$HEALTH_PORT/health)")
	cmd.Flags().BoolVar(&asJSON, "json", false, "print the raw snapshot")
	return cmd
}

func printHealth(out io.Writer, snapshot collector.Snapshot, now time.Time) {
	venues := slices.Clone(snapshot.Venues)
	// Problems first: an error, then stale, then everything healthy by name.
	rank := func(v collector.VenueHealth) int {
		switch {
		case v.Error != nil:
			return 0
		case v.Stale:
			return 1
		}
		return 2
	}
	sort.SliceStable(venues, func(i, j int) bool {
		if rank(venues[i]) != rank(venues[j]) {
			return rank(venues[i]) < rank(venues[j])
		}
		return venues[i].VenueID < venues[j].VenueID
	})

	verdict := "OK"
	switch {
	case snapshot.Starting:
		verdict = "STARTING"
	case !snapshot.OK:
		verdict = "UNHEALTHY"
	}
	var failing, stale int
	for _, v := range venues {
		if v.Error != nil {
			failing++
		} else if v.Stale {
			stale++
		}
	}
	fmt.Fprintf(out, "%s: %d feeds, %d failing, %d stale\n", verdict, len(venues), failing, stale)

	w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "FEED\tSTATE\tMARKETS\tLAST SUCCESS\tERROR")
	for _, v := range venues {
		state := "ok"
		if v.Error != nil {
			state = "failing"
		} else if v.Stale {
			state = "stale"
		}
		errText := ""
		if v.Error != nil {
			errText = *v.Error
			if len(errText) > 80 {
				errText = errText[:77] + "..."
			}
		}
		fmt.Fprintf(w, "%s\t%s\t%d\t%s\t%s\n", v.VenueID, state, v.Markets, ago(v.LastSuccessAt, now), errText)
	}
	_ = w.Flush()
}

func newVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print the Go version and build details",
		Args:  cobra.NoArgs,
		Run: func(cmd *cobra.Command, _ []string) {
			out := cmd.OutOrStdout()
			fmt.Fprintf(out, "collector (%s, %s/%s)\n", runtime.Version(), runtime.GOOS, runtime.GOARCH)
			info, ok := debug.ReadBuildInfo()
			if !ok {
				return
			}
			// The image builds from a copy of apps/collector-go without .git, so vcs.* is absent there
			// and present in a local build; print whichever the binary carries.
			for _, setting := range info.Settings {
				switch setting.Key {
				case "vcs.revision", "vcs.time", "vcs.modified":
					fmt.Fprintf(out, "%s %s\n", strings.TrimPrefix(setting.Key, "vcs."), setting.Value)
				}
			}
		},
	}
}

func ago(at *time.Time, now time.Time) string {
	if at == nil {
		return "never"
	}
	d := now.Sub(*at).Round(time.Second)
	if d < 0 {
		d = 0
	}
	return d.String() + " ago"
}

func optFloat(v *float64, format string) string {
	if v == nil {
		return "-"
	}
	return fmt.Sprintf(format, *v)
}

func dash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

func yesNo(b bool) string {
	if b {
		return "yes"
	}
	return "-"
}
