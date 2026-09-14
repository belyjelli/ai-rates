// Command collector polls perpetual-futures venues and writes what they report into TimescaleDB.
//
// The Go port of apps/collector. It wires one snapshot loop per venue onto the shared store, serves
// a health endpoint, and shuts down cleanly on SIGTERM.
//
// MEMORY. The Bun collector this replaces peaked at 537 MB against a 512 MB container cap, hit that
// cap 1,508 times in a single boot, and restarted roughly every 50 minutes — which silently starved
// every job that waits an hour after boot, so the nightly pair backtests and the ranking job simply
// never ran. The fix there was to raise the limit; the fix here is that the runtime is told what
// the limit IS.
//
// GOMEMLIMIT is a SOFT limit: the garbage collector works harder as the heap approaches it, instead
// of the kernel killing the process at a hard ceiling. Set it a little under the container's
// mem_limit (900MiB against 1g) and memory pressure becomes slower cycles rather than a restart
// that loses every warmed cache and re-runs migrations. The runtime reads the environment variable
// itself; this binary only reports the effective value, so a misconfiguration is visible in the
// first log line rather than inferred from a crash three hours later.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/belyjelli/ai-rates/collector/internal/adapters/aevo"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/apex"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/arcus"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/backpack"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/binancefapi"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/bingx"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/bitget"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/bitmart"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/bluefin"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/bybit"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/coinw"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/dydx"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/edgexv2"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/extended"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/gate"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/grvt"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/hibachi"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/hotcoin"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/htx"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/hyperliquid"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/kucoin"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/lbank"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/lighter"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/mexc"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/nado"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/okx"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/ondo"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/orderly"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/pacifica"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/paradex"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/perpl"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/phoenix"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/pionex"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/polymarket"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/reya"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/risex"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/sodex"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/standx"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/toobit"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/variational"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/velocity"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/zero1"
	"github.com/belyjelli/ai-rates/collector/internal/catalog"
	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
	"github.com/belyjelli/ai-rates/collector/internal/migrate"
	"github.com/belyjelli/ai-rates/collector/internal/store"
)

const (
	shutdownGrace = 15 * time.Second
	// warmUpMaxAge bounds how stale a stored market may be and still seed an adapter. A day is well
	// past any restart while still excluding anything genuinely delisted.
	warmUpMaxAge = 24 * time.Hour
	// alertCheckEvery matches the Bun collector's ALERT_CHECK_MS.
	alertCheckEvery = time.Minute

	// Where the Dockerfile puts the two files the binary reads from the repository.
	defaultMigrationsDir = "/usr/local/share/airates/migrations"
	defaultVenueCatalog  = "/usr/local/share/airates/catalog.json"
)

type config struct {
	databaseURL string
	interval    time.Duration
	healthPort  int
	venues      []string
	// migrationsDir holds packages/db/migrations; venueCatalog is packages/venues/catalog.json.
	migrationsDir string
	venueCatalog  string
	// alertWebhookURL is a Slack- or Discord-style incoming webhook. Empty disables stale-venue alerts.
	alertWebhookURL string
}

func loadConfig(env func(string) string) (config, error) {
	cfg := config{}

	cfg.databaseURL = env("DATABASE_URL")
	if cfg.databaseURL == "" {
		return cfg, errors.New("DATABASE_URL is required")
	}

	intervalMs, err := intFromEnv(env, "COLLECT_INTERVAL_MS", 60_000)
	if err != nil {
		return cfg, err
	}
	// The same floor the TypeScript collector enforces: below this the venues' own rate limits bite
	// before anything useful is gained.
	if intervalMs < 10_000 {
		return cfg, errors.New("COLLECT_INTERVAL_MS must be at least 10000")
	}
	cfg.interval = time.Duration(intervalMs) * time.Millisecond

	cfg.healthPort, err = intFromEnv(env, "HEALTH_PORT", 8080)
	if err != nil {
		return cfg, err
	}

	for _, venue := range strings.Split(env("COLLECT_VENUES"), ",") {
		if trimmed := strings.TrimSpace(venue); trimmed != "" {
			cfg.venues = append(cfg.venues, trimmed)
		}
	}

	cfg.migrationsDir = env("MIGRATIONS_DIR")
	if cfg.migrationsDir == "" {
		cfg.migrationsDir = defaultMigrationsDir
	}
	cfg.venueCatalog = env("VENUE_CATALOG")
	if cfg.venueCatalog == "" {
		cfg.venueCatalog = defaultVenueCatalog
	}

	cfg.alertWebhookURL = strings.TrimSpace(env("ALERT_WEBHOOK_URL"))
	if cfg.alertWebhookURL != "" &&
		!strings.HasPrefix(cfg.alertWebhookURL, "http://") && !strings.HasPrefix(cfg.alertWebhookURL, "https://") {
		return cfg, errors.New("ALERT_WEBHOOK_URL must be an http(s) URL")
	}
	return cfg, nil
}

func intFromEnv(env func(string) string, name string, fallback int) (int, error) {
	raw := env(name)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", name)
	}
	return value, nil
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	if err := run(log); err != nil {
		log.Error("collector exited", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	// Reported BEFORE the config is read, and that order matters. The memory limit is a property of
	// the process, not of the configuration, and an earlier version reported it afterwards — so a
	// missing DATABASE_URL suppressed the line entirely and the one thing this binary says about
	// its own memory behaviour was invisible in exactly the case someone would be debugging.
	//
	// SetMemoryLimit(-1) only reports; the runtime has already applied GOMEMLIMIT from the
	// environment. math.MaxInt64 means "unset", which is worth saying out loud on a container with
	// a hard cap, because that is the configuration that produced the restart loop.
	if limit := debug.SetMemoryLimit(-1); limit == math.MaxInt64 {
		log.Warn("GOMEMLIMIT is unset; the runtime will not back off before the container cap")
	} else {
		log.Info("memory limit", "bytes", limit)
	}

	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		return err
	}

	// Read before connecting, so a missing or malformed catalog fails the boot before anything is written.
	venues, err := catalog.Load(cfg.venueCatalog)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	poolCfg, err := pgxpool.ParseConfig(cfg.databaseURL)
	if err != nil {
		return fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	// Matching the TypeScript collector's pool size. The database is shared with other tenants, so
	// the ceiling is a courtesy as much as a tuning choice.
	poolCfg.MaxConns = 10
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping: %w", err)
	}

	// Migrations first, as the Bun collector ran them on every boot: nothing below may touch a table a
	// pending migration is about to change. A failure stops the boot rather than collecting into an
	// old schema.
	migrated, err := migrate.Apply(ctx, pool, os.DirFS(cfg.migrationsDir))
	if err != nil {
		return fmt.Errorf("migrations from %s: %w", cfg.migrationsDir, err)
	}
	log.Info("migrations", "applied", migrated.Applied, "already_applied", len(migrated.Skipped))

	// Curated leverage for venues that publish none; a figure a venue states always wins over it.
	db := store.New(pool, catalog.CuratedMaxLeverage(venues))

	// Every catalogued venue gets its row before any loop writes a market that references it.
	venueRows := make([]store.VenueRow, len(venues))
	for i, venue := range venues {
		venueRows[i] = store.VenueRow{ID: venue.ID, Name: venue.Name, Type: venue.Type}
	}
	if err := db.UpsertVenues(ctx, venueRows); err != nil {
		return err
	}

	venueIDs := selectedVenueIDs(cfg)
	if len(venueIDs) == 0 {
		return errors.New("no adapters match COLLECT_VENUES")
	}

	// Status is built BEFORE the loops, and that order is load-bearing. LoopOptions is copied by
	// value into each VenueLoop, so an OnRun attached afterwards would be written to a struct
	// nothing reads: collection would work while /health reported every venue as never having run,
	// permanently stale. A silent health lie is worse than a loud failure.
	status := collector.NewStatus(venueIDs, cfg.interval, time.Now(), 3)
	loops := buildLoops(cfg, db, log, status)

	// Seed adapters that need it BEFORE any loop starts. Some venues emit a market only once the
	// adapter has learned something no bulk call returns — MEXC's settlement interval refilled at 40
	// per cycle, so most of the venue was missing from the screener for half an hour after every
	// restart. A failed seed is logged and skipped: it costs a slow warm-up, not a broken cycle.
	for _, loop := range loops {
		warmer, needsSeed := loop.fetcher.(collector.WarmUpper)
		if !needsSeed {
			continue
		}
		known, err := db.ActiveMarkets(ctx, loop.venueID, time.Now().Add(-warmUpMaxAge))
		if err != nil {
			log.Warn("warm-up skipped", "venue", loop.venueID, "error", err)
			continue
		}
		warmer.WarmUp(known)
		log.Info("warmed", "venue", loop.venueID, "markets", len(known))
	}

	for _, loop := range loops {
		loop.loop.Start(ctx)
		log.Info("venue loop started", "venue", loop.venueID)
	}

	// Tasks beside the venue loops, stopped with them at shutdown.
	tasks := startSideTasks(ctx, cfg, loops, db, log)
	if cfg.alertWebhookURL != "" {
		alerter := collector.NewStaleVenueAlerter(
			collector.WebhookSink(cfg.alertWebhookURL, nil),
			func(message string) { log.Warn("stale venue alert", "message", message) },
		)
		alerts := collector.NewPeriodicTask("stale venue alerts", alertCheckEvery,
			func(ctx context.Context) error { return alerter.Check(ctx, status.Snapshot(time.Now())) },
			func(message string) { log.Warn(message) })
		alerts.Start(ctx, alertCheckEvery)
		tasks = append(tasks, alerts)
		log.Info("stale venue alerts enabled")
	} else {
		log.Info("stale venue alerts disabled (set ALERT_WEBHOOK_URL)")
	}

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.healthPort),
		Handler:           healthHandler(status),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("health server", "error", err)
		}
	}()

	log.Info("collecting", "venues", len(loops), "interval", cfg.interval.String(), "health_port", cfg.healthPort)

	<-ctx.Done()
	log.Info("shutting down")

	// Let in-flight cycles finish writing before the pool closes, bounded so a hung venue cannot
	// hold the process open indefinitely.
	graceCtx, cancel := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancel()
	for _, loop := range loops {
		if err := loop.loop.Stop(graceCtx); err != nil {
			log.Warn("loop did not stop within the grace period", "venue", loop.venueID, "error", err)
		}
	}
	for _, task := range tasks {
		if err := task.Stop(graceCtx); err != nil {
			log.Warn("task did not stop within the grace period", "error", err)
		}
	}
	_ = server.Shutdown(graceCtx)
	return nil
}

// venueLoop pairs a loop with its venue id so the shutdown path can name what it is waiting on, and
// keeps the fetcher so the warm-up phase can ask whether it wants seeding.
type venueLoop struct {
	venueID string
	loop    *collector.VenueLoop
	fetcher collector.Fetcher
	// client is the venue's shared HTTP client: the side loops send through it so its spacing and
	// circuit breaker cover them too, and read its circuit to stop early when the venue is down.
	client *httpclient.Client
	// offset is the loop's position within each interval, reused so side loops stay staggered.
	offset time.Duration
}

type candidate struct {
	id    string
	build func(*httpclient.Client) collector.Fetcher
	// spacing is the minimum gap between request starts for this venue's client.
	spacing time.Duration
	// group names the HTTP client this venue shares. Empty means its own.
	//
	// This exists because Hyperliquid rate-limits by IP, not by venue: its core dex and all ten
	// HIP-3 dexes are one budget of 1200 weight a minute, and info requests weigh about 20. Eleven
	// separate clients would each think they had the whole allowance, spend eleven times the
	// intended rate, and give the circuit breaker eleven partial views of one failing venue.
	group string
}

// registry is every venue this binary can collect.
//
// Each is a mechanical port of an adapter that already exists in TypeScript, validated against the
// same __fixtures__ JSON its twin is pinned to — so a port either produces identical numbers or
// fails its own test.
//
// MIGRATION STATE: 56 venues wired, matching the 56 the TypeScript collector runs. The port is at
// parity as of 2026-09-15; no venue is dropped.
//
// `blofin` is absent from BOTH collectors, and deliberately: packages/adapters/src/registry.ts
// records that it answers a development machine but returns HTTP 403 to the collector's host
// (measured 2026-09-13 22:53Z, its first production run), so it was left out rather than left
// failing every run on /status. Re-adding it is one entry here and one there.
//
// PARITY IS NOT PERMISSION TO RUN BOTH. Both collectors write market_latest and funding_snapshots,
// and two writers on one venue race over the same rows with the observed_at guard arbitrating
// unpredictably — the loser is silent, because both writes succeed. Whichever runs second must have
// COLLECT_VENUES set to a disjoint set, or be the only one running.
func registry() []candidate {
	// One annotations response and one spotMeta response serve EVERY HIP-3 dex, so the caches are
	// built once here and shared by all ten. Per-dex caches would send ten identical requests per
	// sweep against the shared budget above.
	annotations := hyperliquid.NewAnnotationCache()
	spotTokens := hyperliquid.NewSpotTokenCache()

	candidates := []candidate{
		{
			id:      bybit.VenueID,
			spacing: 100 * time.Millisecond,
			build:   func(c *httpclient.Client) collector.Fetcher { return bybit.NewAdapter(c) },
		},
		// The binance-fapi family: one base, four venues, differing only in how each declares a
		// market's class and where its interval and open interest come from.
		{
			id:      "aster",
			spacing: binancefapi.DefaultSpacing,
			build:   func(c *httpclient.Client) collector.Fetcher { return binancefapi.Aster(c) },
		},
		{
			id:      "binance",
			spacing: binancefapi.DefaultSpacing,
			build:   func(c *httpclient.Client) collector.Fetcher { return binancefapi.Binance(c) },
		},
		{
			id:      "weex",
			spacing: binancefapi.WeexSpacing,
			build:   func(c *httpclient.Client) collector.Fetcher { return binancefapi.Weex(c) },
		},
		{
			id:      "bullet",
			spacing: binancefapi.DefaultSpacing,
			build:   func(c *httpclient.Client) collector.Fetcher { return binancefapi.Bullet(c) },
		},
		// Standalone venues.
		{
			id:      paradex.VenueID,
			spacing: paradex.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return paradex.NewAdapter(c) },
		},
		{
			id:      dydx.VenueID,
			spacing: dydx.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return dydx.NewAdapter(c) },
		},
		{
			id: reya.VenueID,
			// Reya's package exports no spacing constant; 100ms is its documented rate limit.
			spacing: 100 * time.Millisecond,
			build:   func(c *httpclient.Client) collector.Fetcher { return reya.NewAdapter(c) },
		},
		{
			id:      variational.VenueID,
			spacing: variational.MinIntervalMs * time.Millisecond,
			build:   func(c *httpclient.Client) collector.Fetcher { return variational.NewAdapter(c) },
		},
		{
			id:      hibachi.VenueID,
			spacing: hibachi.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return hibachi.NewAdapter(c) },
		},
		{
			id:      bluefin.VenueID,
			spacing: bluefin.MinIntervalMs * time.Millisecond,
			build:   func(c *httpclient.Client) collector.Fetcher { return bluefin.NewAdapter(c) },
		},
		{
			id:      okx.VenueID,
			spacing: okx.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return okx.NewAdapter(c) },
		},
		{
			id:      sodex.VenueID,
			spacing: sodex.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return sodex.NewAdapter(c) },
		},
		{
			id:      extended.VenueID,
			spacing: extended.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return extended.NewAdapter(c) },
		},
		{
			id:      aevo.VenueID,
			spacing: aevo.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return aevo.NewAdapter(c) },
		},
		{
			id: backpack.VenueID,
			// Two seconds, far wider than any other venue here. That is the venue's own documented
			// limit, not a guess, and it is why spacing is per-candidate rather than a constant.
			spacing: backpack.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return backpack.NewAdapter(c) },
		},
		{
			id:      gate.VenueID,
			spacing: gate.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return gate.NewAdapter(c) },
		},
		{
			id:      bitget.VenueID,
			spacing: bitget.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return bitget.NewAdapter(c) },
		},
		{
			id:      bingx.VenueID,
			spacing: bingx.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return bingx.NewAdapter(c) },
		},
		{
			id:      htx.VenueID,
			spacing: htx.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return htx.NewAdapter(c) },
		},
		// The second venue needing WarmUp, after MEXC: its interval cache is memory-only, so an
		// unseeded restart hides markets until each one's settlement interval is re-learned.
		{
			id:      pionex.VenueID,
			spacing: pionex.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return pionex.NewAdapter(c) },
		},
		{
			id:      kucoin.VenueID,
			spacing: kucoin.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return kucoin.NewAdapter(c) },
		},
		// MEXC is the first venue needing WarmUp: it emits a market only once it knows the
		// settlement interval, and that cache refills at 40 per cycle. Unseeded, most of the venue
		// is missing from the screener for about half an hour after every restart.
		{
			id:      mexc.VenueID,
			spacing: mexc.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return mexc.NewAdapter(c) },
		},
		// Lighter's two deployments are separate venues on separate hosts, and they are deliberately
		// NOT in a shared rate-limit group: their market ids disagree (RH's market 42 is OPENAI,
		// mainnet's is SPX), so each keeps its own id cache and its own budget. Contrast hyperliquid,
		// whose eleven venues share one client because the limit there is per IP.
		{
			id:      lighter.VenueID,
			spacing: lighter.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return lighter.NewMainnetAdapter(c) },
		},
		{
			id:      lighter.VenueIDRH,
			spacing: lighter.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return lighter.NewRHAdapter(c) },
		},
		// The twenty ported on 2026-09-15, which bring the Go registry to parity with the
		// TypeScript collector. Each was ported against the same __fixtures__ JSON its TypeScript
		// twin asserts on, so a divergence fails a test rather than reaching the database.
		{
			id:      orderly.VenueID,
			spacing: orderly.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return orderly.NewAdapter(c) },
		},
		{
			id:      bitmart.VenueID,
			spacing: bitmart.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return bitmart.NewAdapter(c) },
		},
		{
			id:      lbank.VenueID,
			spacing: lbank.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return lbank.NewAdapter(c) },
		},
		{
			id:      toobit.VenueID,
			spacing: toobit.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return toobit.NewAdapter(c) },
		},
		// The third venue needing WarmUp, after MEXC and Pionex: its interval cache is memory-only.
		{
			id:      hotcoin.VenueID,
			spacing: hotcoin.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return hotcoin.NewAdapter(c) },
		},
		{
			id:      coinw.VenueID,
			spacing: coinw.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return coinw.NewAdapter(c) },
		},
		{
			id:      apex.VenueID,
			spacing: apex.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return apex.NewAdapter(c) },
		},
		{
			id:      grvt.VenueID,
			spacing: grvt.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return grvt.NewAdapter(c) },
		},
		{
			id: arcus.VenueID,
			// Three seconds, the widest spacing in the registry after backpack's two. The venue's
			// own documented limit, not a guess.
			spacing: arcus.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return arcus.NewAdapter(c) },
		},
		{
			id:      ondo.VenueID,
			spacing: ondo.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return ondo.NewAdapter(c) },
		},
		{
			id:      standx.VenueID,
			spacing: standx.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return standx.NewAdapter(c) },
		},
		{
			id:      velocity.VenueID,
			spacing: velocity.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return velocity.NewAdapter(c) },
		},
		{
			// The package is edgexv2 but the venue id is "edgex-v2": the v1 book is dead and the
			// id carries the version, so the two spellings differ on purpose.
			id:      edgexv2.VenueID,
			spacing: edgexv2.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return edgexv2.NewAdapter(c) },
		},
		{
			id:      polymarket.VenueID,
			spacing: polymarket.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return polymarket.NewAdapter(c) },
		},
		{
			id:      perpl.VenueID,
			spacing: perpl.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return perpl.NewAdapter(c) },
		},
		{
			id:      nado.VenueID,
			spacing: nado.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return nado.NewAdapter(c) },
		},
		{
			id: pacifica.VenueID,
			// Six seconds, the widest in the registry. The venue's own limit.
			spacing: pacifica.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return pacifica.NewAdapter(c) },
		},
		{
			id:      phoenix.VenueID,
			spacing: phoenix.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return phoenix.NewAdapter(c) },
		},
		{
			id:      risex.VenueID,
			spacing: risex.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return risex.NewAdapter(c) },
		},
		{
			id:      zero1.VenueID,
			spacing: zero1.MinInterval,
			build:   func(c *httpclient.Client) collector.Fetcher { return zero1.NewAdapter(c) },
		},
		// Hyperliquid core, sharing one client with every HIP-3 dex below.
		{
			id:      "hyperliquid",
			spacing: hyperliquid.MinInterval,
			group:   hyperliquid.RateLimitGroup,
			build:   func(c *httpclient.Client) collector.Fetcher { return hyperliquid.NewCoreAdapter(c) },
		},
	}

	// The HIP-3 builder-deployed dexes. Six of these currently list only delisted assets and return
	// zero markets, which /status reports as `empty` — running cleanly and serving nothing is a
	// state worth seeing, not a reason to drop them from the registry.
	for _, dex := range []string{"xyz", "flx", "hyna", "vntl", "km", "abcd", "cash", "para", "io", "mkts"} {
		candidates = append(candidates, candidate{
			id:      "hl-" + dex,
			spacing: hyperliquid.MinInterval,
			group:   hyperliquid.RateLimitGroup,
			build: func(c *httpclient.Client) collector.Fetcher {
				return hyperliquid.NewHip3Adapter(c, dex, annotations, spotTokens)
			},
		})
	}
	return candidates
}

func selected(cfg config) []candidate {
	if len(cfg.venues) == 0 {
		return registry()
	}
	wanted := make(map[string]bool, len(cfg.venues))
	for _, id := range cfg.venues {
		wanted[id] = true
	}
	chosen := make([]candidate, 0, len(cfg.venues))
	for _, c := range registry() {
		if wanted[c.id] {
			chosen = append(chosen, c)
		}
	}
	return chosen
}

func selectedVenueIDs(cfg config) []string {
	chosen := selected(cfg)
	ids := make([]string, 0, len(chosen))
	for _, c := range chosen {
		ids = append(ids, c.id)
	}
	return ids
}

// buildLoops constructs one snapshot loop per selected venue.
//
// Offsets are spread across the interval so venues do not all fire on the same second — the
// database sees a steady trickle of transactions rather than a stampede once a minute.
func buildLoops(cfg config, db *store.Store, log *slog.Logger, status *collector.Status) []*venueLoop {
	chosen := selected(cfg)
	loops := make([]*venueLoop, 0, len(chosen))

	// One client per rate-limit group, so venues behind a single IP-limited API share their spacing
	// and their circuit breaker. A group's spacing is the widest any member asks for.
	clients := make(map[string]*httpclient.Client, len(chosen))
	spacing := make(map[string]time.Duration, len(chosen))
	for _, c := range chosen {
		key := c.group
		if key == "" {
			key = c.id
		}
		if c.spacing > spacing[key] {
			spacing[key] = c.spacing
		}
	}

	for i, c := range chosen {
		key := c.group
		if key == "" {
			key = c.id
		}
		client, built := clients[key]
		if !built {
			client = httpclient.New(key, httpclient.Options{MinInterval: spacing[key]})
			clients[key] = client
		}
		offset := time.Duration(int64(cfg.interval) * int64(i) / int64(max(len(chosen), 1)))

		fetcher := c.build(client)
		loop := collector.NewVenueLoop(fetcher, db, collector.LoopOptions{
			Interval: cfg.interval,
			Offset:   offset,
			OnRun:    status.Record,
			Log:      func(message string) { log.Info(message) },
		})
		loops = append(loops, &venueLoop{venueID: c.id, loop: loop, fetcher: fetcher, client: client, offset: offset})
	}
	return loops
}

// Side-loop cadences, matching apps/collector/src/main.ts.
const (
	historyPause        = 5 * time.Minute
	backfillPause       = 5 * time.Minute
	backfillBudget      = 20
	tiersRefresh        = 24 * time.Hour
	liquidationsRefresh = 5 * time.Minute
)

// startSideTasks starts, for each venue, whichever of the history sweep, the history backfill, the
// tier sweep and the liquidation poll its adapter supports.
//
// These ran beside every snapshot loop in the Bun collector and were dropped at the Go cutover, which
// stopped settled funding — the input to every 7-day average, fold, backtest and ranking — from
// arriving at all. Start delays match main.ts: each waits until the snapshot loop has listed the
// venue's markets, shifted by the venue's own offset so venues never sweep on the same second.
func startSideTasks(ctx context.Context, cfg config, loops []*venueLoop, db *store.Store, log *slog.Logger) []*collector.PeriodicTask {
	var tasks []*collector.PeriodicTask
	start := func(name string, pause, delay time.Duration, job func(context.Context) error) {
		task := collector.NewPeriodicTask(name, pause, job, func(message string) { log.Warn(message) })
		task.Start(ctx, delay)
		tasks = append(tasks, task)
	}

	for _, loop := range loops {
		venueID, client, offset := loop.venueID, loop.client, loop.offset
		circuitOpen := func() bool { return client.Circuit().Open }
		logInfo := func(message string) { log.Info(message) }

		if fetcher, ok := loop.fetcher.(collector.HistoryFetcher); ok {
			start(venueID+" history", historyPause, 2*cfg.interval+offset, func(ctx context.Context) error {
				sweep, err := collector.SweepVenueHistory(ctx, fetcher, db,
					collector.HistorySweepOptions{CircuitOpen: circuitOpen, Log: logInfo})
				if err != nil {
					return err
				}
				if sweep.Fetched > 0 || sweep.Errors > 0 {
					log.Info("history", "venue", venueID, "fetched", sweep.Fetched, "markets", sweep.Markets,
						"events", sweep.Events, "errors", sweep.Errors)
				}
				return nil
			})

			// Process lifetime is the right scope for "this market has nothing older"; one task owns it.
			exhausted := map[string]bool{}
			budget := backfillBudget
			start(venueID+" history backfill", backfillPause, backfillPause+offset, func(ctx context.Context) error {
				backfill, err := collector.BackfillVenueHistory(ctx, fetcher, db, collector.HistoryBackfillOptions{
					Budget: &budget, Exhausted: exhausted, CircuitOpen: circuitOpen, Log: logInfo,
				})
				if err != nil {
					return err
				}
				if backfill.Fetched > 0 || backfill.Errors > 0 {
					log.Info("backfill", "venue", venueID, "events", backfill.Events, "short", backfill.Pending,
						"exhausted", backfill.Exhausted, "errors", backfill.Errors)
				}
				return nil
			})
		}

		if fetcher, ok := loop.fetcher.(collector.TierFetcher); ok {
			start(venueID+" leverage tiers", tiersRefresh, 4*cfg.interval+offset, func(ctx context.Context) error {
				sweep, err := collector.RefreshVenueLeverageTiers(ctx, fetcher, db, nil)
				if err != nil {
					return err
				}
				if sweep.Tiers > 0 || !sweep.Complete {
					log.Info("leverage tiers", "venue", venueID, "tiers", sweep.Tiers, "markets", sweep.Markets,
						"complete", sweep.Complete)
				}
				return nil
			})
		}

		if fetcher, ok := loop.fetcher.(collector.LiquidationFetcher); ok {
			start(venueID+" liquidations", liquidationsRefresh, 3*cfg.interval+offset, func(ctx context.Context) error {
				sweep, err := collector.RefreshVenueLiquidations(ctx, fetcher, db)
				if err != nil {
					return err
				}
				// Stored far below fetched is the steady state; log only news or lost coverage.
				if sweep.Stored > 0 || !sweep.Complete {
					log.Info("liquidations", "venue", venueID, "stored", sweep.Stored, "fetched", sweep.Fetched,
						"markets", sweep.Markets, "complete", sweep.Complete)
				}
				return nil
			})
		}
	}
	return tasks
}

func healthHandler(status *collector.Status) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		snapshot := status.Snapshot(time.Now())
		code := http.StatusOK
		if !snapshot.OK {
			code = http.StatusServiceUnavailable
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(code)
		writeJSON(w, snapshot)
	})
	return mux
}

func writeJSON(w http.ResponseWriter, value any) {
	_ = json.NewEncoder(w).Encode(value)
}
