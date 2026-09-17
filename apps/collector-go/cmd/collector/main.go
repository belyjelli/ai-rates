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
	"slices"
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
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
	"github.com/belyjelli/ai-rates/collector/internal/migrate"
	"github.com/belyjelli/ai-rates/collector/internal/store"
	"github.com/belyjelli/ai-rates/collector/internal/stream"
)

const (
	shutdownGrace = 15 * time.Second
	// warmUpMaxAge bounds how stale a stored market may be and still seed an adapter. A day is well
	// past any restart while still excluding anything genuinely delisted.
	warmUpMaxAge = 24 * time.Hour
	// alertCheckEvery matches the Bun collector's ALERT_CHECK_MS.
	alertCheckEvery = time.Minute
	// streamSubjectsRefresh is how often a feed's subscription set is re-read. Listings and
	// delistings are the thing it tracks, and neither is urgent enough to pay a reconnect for more
	// often than this.
	streamSubjectsRefresh = 15 * time.Minute

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
	// alertWebhookURL is a Slack- or Discord-style incoming webhook.
	alertWebhookURL string
	// telegramBotToken and telegramChatID send alerts to one Telegram chat. The token is a credential:
	// it lives only in the server's .env and must never be logged.
	telegramBotToken string
	telegramChatID   string
	// streamVenues are the venues whose top of book is kept current over a WebSocket between polls.
	// EMPTY BY DEFAULT: the feed is off until someone turns it on, so a deploy of this code changes
	// nothing about what the collector does.
	streamVenues []string
	// streamFlush is how often a feed writes its in-memory book. The floor on how old a streamed
	// quote can be.
	streamFlush time.Duration
	// streamMinOpenInterestUSD drops thin markets from the subscription set. Zero subscribes to
	// every pairable market on the venue.
	streamMinOpenInterestUSD float64
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

	// Both or neither: a token without a chat has nowhere to send, and failing at boot is kinder than
	// discovering it on the first outage.
	cfg.telegramBotToken = strings.TrimSpace(env("TELEGRAM_BOT_TOKEN"))
	cfg.telegramChatID = strings.TrimSpace(env("TELEGRAM_CHAT_ID"))
	if (cfg.telegramBotToken == "") != (cfg.telegramChatID == "") {
		return cfg, errors.New("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set together")
	}

	// STREAM_VENUES follows COLLECT_VENUES' shape, and its default is the opposite: empty means no
	// feed at all rather than all of them. A quote feed writes to rows the funding path owns, so it
	// is opt-in per venue and per deploy.
	for _, venue := range strings.Split(env("STREAM_VENUES"), ",") {
		if trimmed := strings.TrimSpace(venue); trimmed != "" {
			cfg.streamVenues = append(cfg.streamVenues, trimmed)
		}
	}
	flushMs, err := intFromEnv(env, "STREAM_FLUSH_MS", 5_000)
	if err != nil {
		return cfg, err
	}
	// A floor, for the same reason COLLECT_INTERVAL_MS has one: below a second the writes stop being
	// a flush and start being per-tick inserts on a database shared with sixteen other tenants.
	if flushMs < 1_000 {
		return cfg, errors.New("STREAM_FLUSH_MS must be at least 1000")
	}
	cfg.streamFlush = time.Duration(flushMs) * time.Millisecond

	minOI, err := intFromEnv(env, "STREAM_MIN_OI_USD", 0)
	if err != nil {
		return cfg, err
	}
	if minOI < 0 {
		return cfg, errors.New("STREAM_MIN_OI_USD must not be negative")
	}
	cfg.streamMinOpenInterestUSD = float64(minOI)
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
	// UTC for every session, whatever the server's own time zone. The jobs fold settlements into UTC
	// days (`AT TIME ZONE 'UTC'`) but cut their windows with `(now() - interval '7 days')::date`, which
	// casts in the SESSION zone. On a server at +07 that cutoff lands a day late, the 7-of-7 charging
	// floor sees six days, and the verified backtests and ranking silently come back empty — found
	// when exactly that happened against a local PostgreSQL. The TypeScript SQL has the same
	// dependency; pinning the session makes both halves of the arithmetic agree by construction.
	poolCfg.ConnConfig.RuntimeParams["timezone"] = "UTC"
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
	// A quote feed reports its health under its own id, so it needs its own venues row: /status is
	// driven from that table rather than from the runs, precisely so a collector that has stopped
	// running still appears. See stream.Feed.VenueID for why the feed is not "bybit".
	//
	// It never writes market_latest rows under this id, so it cannot appear on /exchanges (that
	// query inner-joins market_latest) or add a market to any count. It appears on /status, which
	// is where a thing that can fail belongs.
	for _, venue := range venues {
		if !slices.Contains(cfg.streamVenues, venue.ID) {
			continue
		}
		venueRows = append(venueRows, store.VenueRow{
			ID:   venue.ID + ":ws",
			Name: venue.Name + " (stream)",
			Type: venue.Type,
		})
	}
	if err := db.UpsertVenues(ctx, venueRows); err != nil {
		return err
	}

	venueIDs := selectedVenueIDs(cfg)
	if len(venueIDs) == 0 {
		return errors.New("no adapters match COLLECT_VENUES")
	}
	// The feeds' ids join the health snapshot here, before Status is built: Status renders only the
	// ids it was constructed with, so one added afterwards would record runs nothing ever displays.
	// The same ordering trap the comment below describes, one layer out.
	for _, venue := range cfg.streamVenues {
		venueIDs = append(venueIDs, venue+":ws")
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

	// Quote feeds, if any venue was opted in. Started after the venue loops because the subscription
	// set is read from what those loops have already collected.
	feeds, feedRefreshers, err := startFeeds(ctx, cfg, db, status, log)
	if err != nil {
		return err
	}

	// Tasks beside the venue loops, stopped with them at shutdown.
	tasks := startSideTasks(ctx, cfg, loops, db, log)
	tasks = append(tasks, feedRefreshers...)
	jobWatch := collector.NewJobWatch(time.Now())
	tasks = append(tasks, startJobs(ctx, cfg, db, log, jobWatch)...)

	// Alerts go to every configured channel: Telegram, a Slack- or Discord-style webhook, or both.
	if sink := alertSink(cfg); sink != nil {
		alerter := collector.NewStaleVenueAlerter(sink,
			func(message string) { log.Warn("alert", "message", message) })
		alerts := collector.NewPeriodicTask("alerts", alertCheckEvery, func(ctx context.Context) error {
			now := time.Now()
			err := alerter.Check(ctx, status.Snapshot(now))
			for _, payload := range jobWatch.Check(now) {
				log.Warn("alert", "message", payload.Text)
				err = errors.Join(err, sink(ctx, payload))
			}
			return err
		}, func(message string) { log.Warn(message) })
		alerts.Start(ctx, alertCheckEvery)
		tasks = append(tasks, alerts)

		// A boot is itself an event worth seeing: every deploy, every crash-restart, every host reboot.
		// Sent off the boot path, so a slow or unreachable chat cannot delay collection.
		bootText := fmt.Sprintf("airates collector started: %d venues, %d jobs watched, migrations applied %d (already %d)",
			len(loops), len(jobWatchNames), len(migrated.Applied), len(migrated.Skipped))
		go func() {
			sendCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()
			if err := sink(sendCtx, collector.AlertPayload{Text: bootText, OK: true}); err != nil {
				log.Warn("boot alert failed", "error", err)
			}
		}()
		log.Info("alerts enabled", "telegram", cfg.telegramBotToken != "", "webhook", cfg.alertWebhookURL != "")
	} else {
		log.Info("alerts disabled (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, or ALERT_WEBHOOK_URL)")
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
	// Feeds last: each one flushes what it is holding on the way out, and those quotes are free.
	for _, feed := range feeds {
		if err := feed.Stop(graceCtx); err != nil {
			log.Warn("feed did not stop within the grace period", "venue", feed.VenueID(), "error", err)
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

// streamProtocol returns the wire format for a venue, or nil where no feed is written yet.
//
// Gate and okx take an HTTP client because their sizes are quoted in CONTRACTS and only the venue's
// own metadata says what a contract holds — one bulk call before each subscribe. It is a client of
// their own rather than the snapshot loop's: the loop's is built inside buildLoops and sharing it
// would mean threading it out through a map keyed by rate-limit group, to save one request per
// reconnect. The spacing constant is the venue's own either way, so the two clients cannot together
// exceed what one venue asked for by more than that single call.
func streamProtocol(venueID string) stream.Protocol {
	switch venueID {
	case "bybit":
		return stream.Bybit{}
	case "gate":
		return stream.NewGate(httpclient.New("gate:ws", httpclient.Options{MinInterval: gate.MinInterval}))
	case "okx":
		return stream.NewOKX(httpclient.New("okx:ws", httpclient.Options{MinInterval: okx.MinInterval}))
	default:
		return nil
	}
}

// startFeeds starts one quote feed per venue named in STREAM_VENUES.
//
// A feed that cannot be built stops the boot rather than being skipped: STREAM_VENUES is explicit
// configuration, and silently not running what an operator asked for is how a feature gets believed
// to be live for a week. A feed with no subjects is the one exception — it means the funding path
// has not collected that venue yet, which is a state the next cycle fixes on its own.
func startFeeds(ctx context.Context, cfg config, db *store.Store, status *collector.Status, log *slog.Logger) ([]*stream.Feed, []*collector.PeriodicTask, error) {
	if len(cfg.streamVenues) == 0 {
		return nil, nil, nil
	}
	feeds := make([]*stream.Feed, 0, len(cfg.streamVenues))
	refreshers := make([]*collector.PeriodicTask, 0, len(cfg.streamVenues))
	for _, venueID := range cfg.streamVenues {
		proto := streamProtocol(venueID)
		if proto == nil {
			return nil, nil, fmt.Errorf("STREAM_VENUES names %q, which has no stream protocol", venueID)
		}
		subjects, err := db.StreamSubjects(ctx, venueID, cfg.streamMinOpenInterestUSD)
		if err != nil {
			return nil, nil, err
		}
		// A feed with no subjects still STARTS. The alternative — skipping it — leaves an id
		// registered in the health snapshot that nothing will ever report against, so /health goes
		// false three minutes after boot and stays there until someone restarts the process. A
		// started feed with nothing to subscribe to waits quietly and picks up the set the refresh
		// task hands it, which on a fresh database is the difference between a cold start and a page.
		if len(subjects) == 0 {
			log.Warn("stream feed starting with no subjects yet",
				"venue", venueID, "min_oi_usd", cfg.streamMinOpenInterestUSD)
		}
		picked := make([]stream.Subject, len(subjects))
		for i, s := range subjects {
			picked[i] = stream.Subject{VenueSymbol: s.VenueSymbol, Multiplier: s.Multiplier}
		}
		feed := stream.New(proto, stream.Dial, db, picked, stream.Options{
			FlushEvery: cfg.streamFlush,
			OnFlush:    status.Record,
			Log:        func(message string) { log.Info(message) },
		})
		feed.Start(ctx)
		feeds = append(feeds, feed)
		log.Info("stream feed started",
			"venue", feed.VenueID(), "subjects", feed.Subjects(), "flush", cfg.streamFlush.String())

		// The subscription set is read from what the funding loops have collected, so it goes stale
		// in both directions as markets are listed and delisted. Refreshed on its own task rather
		// than at every reconnect: re-running the query on a venue that is dropping connections
		// would put database load exactly where the trouble already is.
		refresh := collector.NewPeriodicTask("stream-subjects:"+venueID, streamSubjectsRefresh,
			func(ctx context.Context) error {
				subjects, err := db.StreamSubjects(ctx, venueID, cfg.streamMinOpenInterestUSD)
				if err != nil {
					return err
				}
				picked := make([]stream.Subject, len(subjects))
				for i, s := range subjects {
					picked[i] = stream.Subject{VenueSymbol: s.VenueSymbol, Multiplier: s.Multiplier}
				}
				if added, removed := feed.SetSubjects(picked); added > 0 || removed > 0 {
					log.Info("stream subjects changed", "venue", feed.VenueID(),
						"added", added, "removed", removed, "subjects", feed.Subjects())
				}
				return nil
			}, func(message string) { log.Warn(message) })
		// A feed that started empty is refreshed sooner: the ordinary cadence tracks listings, but a
		// cold start is waiting on the first collection cycle, which is a minute away, not fifteen.
		firstRefresh := streamSubjectsRefresh
		if len(subjects) == 0 {
			firstRefresh = time.Minute
		}
		refresh.Start(ctx, firstRefresh)
		refreshers = append(refreshers, refresh)
	}
	return feeds, refreshers, nil
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

// Fleet-wide job cadences, matching apps/collector/src/main.ts.
const (
	statsRefresh         = 10 * time.Minute
	longWindowsRefresh   = time.Hour
	pairBacktestsRefresh = 24 * time.Hour
	identityRefresh      = time.Hour
	rankedPairsRefresh   = 24 * time.Hour
	priceHourlyRefresh   = time.Hour
)

// startJobs starts the fleet-wide jobs that turn stored funding into what the site reads: settled
// 24h/7d averages, the daily and hourly folds with the 30/60-day windows and stability scores, the
// verified 7-day pair backtests behind the homepage, the price identity checks behind /status, and
// the nightly ranked-pair candidates.
//
// All ran in the Bun collector and none in the Go port until 2026-09-15, so each of those surfaces
// had been serving whatever the last Bun boot left. Order and start delays match main.ts, and the
// order is load-bearing: the backtests and the ranking read market_funding_daily, so they start only
// after the long-windows job has folded it once. On a cold database every pair would otherwise fail
// the 7-of-7 charging floor and the first ranking would be empty.
func startJobs(ctx context.Context, cfg config, db *store.Store, log *slog.Logger, watch *collector.JobWatch) []*collector.PeriodicTask {
	var tasks []*collector.PeriodicTask
	start := func(name string, pause, delay time.Duration, job func(context.Context) error) {
		// Every outcome feeds the job watch, which is what reports a job that fails or stops running.
		// A run cut short by shutdown is not an outcome.
		watch.Expect(name, delay, pause)
		watched := func(ctx context.Context) error {
			err := job(ctx)
			if ctx.Err() == nil {
				watch.Record(name, time.Now(), err)
			}
			return err
		}
		task := collector.NewPeriodicTask(name, pause, watched, func(message string) { log.Warn(message) })
		task.Start(ctx, delay)
		tasks = append(tasks, task)
	}

	start("funding stats refresh", statsRefresh, 3*cfg.interval, func(ctx context.Context) error {
		markets, err := db.RefreshFundingStats(ctx)
		if err == nil {
			log.Info("funding stats refreshed", "markets", markets)
		}
		return err
	})

	// One fold feeds the 30/60-day windows and the stability scores alike, so they share a pass.
	start("long funding windows", longWindowsRefresh, 5*cfg.interval, func(ctx context.Context) error {
		days, err := db.RefreshDailyFunding(ctx, store.DailyFundingLookbackDays)
		if err != nil {
			return err
		}
		markets, err := db.RefreshLongWindows(ctx)
		if err != nil {
			return err
		}
		scored, err := db.RefreshStability(ctx)
		if err != nil {
			return err
		}
		hours, err := db.RefreshHourlyFunding(ctx, store.HourlyFundingRetainDays)
		if err != nil {
			return err
		}
		log.Info("long funding windows", "day_rows", days, "markets", markets, "scored", scored, "hour_rows", hours)
		return nil
	})

	start("verified pair backtests", pairBacktestsRefresh, longWindowsRefresh+6*cfg.interval, func(ctx context.Context) error {
		pairs, err := db.RefreshPairBacktests(ctx, store.PairBacktestSizeUSD, store.PairBacktestRetainDays)
		if err == nil {
			log.Info("verified pair backtests", "pairs", pairs)
		}
		return err
	})

	// Last of the hourly jobs, at 9 cycles, because it is the only one that scans funding_snapshots
	// -- the largest table here -- and the others should have had their turn first. It reads no other
	// job's output, so nothing waits on it.
	start("price hourly rollup", priceHourlyRefresh, 9*cfg.interval, func(ctx context.Context) error {
		hours, err := db.RefreshPriceHourly(ctx, store.PriceHourlyLookbackHours, store.PriceHourlyRetainDays)
		if err == nil {
			log.Info("price hourly rollup", "hour_rows", hours)
		}
		return err
	})

	start("identity checks", identityRefresh, 7*cfg.interval, func(ctx context.Context) error {
		checked, err := db.RefreshIdentityChecks(ctx, store.IdentityCheckWindowHours)
		if err == nil {
			log.Info("identity checks", "diverging", checked)
		}
		return err
	})

	start("ranked pair candidates", rankedPairsRefresh, longWindowsRefresh+8*cfg.interval, func(ctx context.Context) error {
		rows, err := db.RefreshRankedPairs(ctx, store.RankedPairsSizeUSD, store.RankedPairsRetainDays,
			core.DefaultParticipation, store.RankedPairsSwitchCostPerDollar)
		if err == nil {
			log.Info("ranked pair candidates", "candidates", rows)
		}
		return err
	})
	return tasks
}

// jobWatchNames are the fleet-wide jobs startJobs registers with the job watch, for the boot message
// and for the test that keeps the two in step.
var jobWatchNames = []string{
	"funding stats refresh", "long funding windows", "verified pair backtests", "price hourly rollup",
	"identity checks", "ranked pair candidates",
}

// alertSink is every configured alert channel, or nil when none is.
func alertSink(cfg config) collector.AlertSink {
	var sinks []collector.AlertSink
	if cfg.telegramBotToken != "" {
		sinks = append(sinks, collector.TelegramSink(cfg.telegramBotToken, cfg.telegramChatID, nil))
	}
	if cfg.alertWebhookURL != "" {
		sinks = append(sinks, collector.WebhookSink(cfg.alertWebhookURL, nil))
	}
	switch len(sinks) {
	case 0:
		return nil
	case 1:
		return sinks[0]
	}
	return collector.FanOut(sinks...)
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
