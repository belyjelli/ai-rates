package stream

import (
	"context"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

// Live checks for the liquidation feeds, against the venues' real sockets.
//
// Skipped unless LIQ_LIVE=1, for the reason internal/adapters/bybit/live_test.go gives: a test that
// reaches the internet must never run in an ordinary `go test ./...`.
//
// WHY THESE EXIST AT ALL, when every decoder is already pinned to a recorded fixture. A fixture
// proves the PARSER is faithful and proves nothing about whether the venue will keep the connection
// open — and that is exactly the failure that reached production on 2026-09-18: htx accepted the
// subscribe and then hung up with "Bye" every ~30 seconds from the Hong Kong server, while the same
// endpoint held for 22 minutes from a laptop. A keepalive contract cannot be unit-tested; it has to
// be held open against the real venue, from the machine that will run it.
//
// Run one venue for two minutes and it will tell you whether the connection SURVIVES:
//
//	LIQ_LIVE=1 go test ./internal/stream/ -run TestLiveLiquidationFeed/htx -v -timeout 5m
func TestLiveLiquidationFeed(t *testing.T) {
	if os.Getenv("LIQ_LIVE") != "1" {
		t.Skip("set LIQ_LIVE=1 to run the live feed check")
	}
	window := 2 * time.Minute
	if raw := os.Getenv("LIQ_LIVE_SECONDS"); raw != "" {
		seconds, err := strconv.Atoi(raw)
		if err != nil {
			t.Fatalf("LIQ_LIVE_SECONDS: %v", err)
		}
		window = time.Duration(seconds) * time.Second
	}

	venues := map[string]EventProtocol{
		"binance": NewBinanceLiquidations(os.Getenv("BINANCE_LIQUIDATION_WS_URL")),
		"aster":   NewAsterLiquidations(""),
		"bybit":   BybitLiquidations{},
		"okx":     NewOKXLiquidations(httpclient.New("okx:liq", httpclient.Options{MinInterval: 100 * time.Millisecond})),
		"htx":     HTXLiquidations{},
		"lighter": NewLighterLiquidations(httpclient.New("lighter:liq", httpclient.Options{MinInterval: time.Second})),
		"nado":    NewNadoLiquidations(httpclient.New("nado:liq", httpclient.Options{MinInterval: time.Second})),
	}
	symbols := map[string][]string{
		"bybit":   {"BTCUSDT", "ETHUSDT", "SOLUSDT", "DOGEUSDT"},
		"lighter": {"BTC", "ETH", "SOL", "DOGE"},
	}

	for name, proto := range venues {
		t.Run(name, func(t *testing.T) {
			var mu sync.Mutex
			var runs []collector.Run

			feed := NewEventFeed(proto, DialerFor(proto), liveSink{}, symbols[name], Options{
				FlushEvery: 5 * time.Second,
				OnFlush: func(run collector.Run) {
					mu.Lock()
					runs = append(runs, run)
					mu.Unlock()
				},
				Log: func(message string) { t.Log(message) },
			})

			ctx, cancel := context.WithTimeout(context.Background(), window)
			defer cancel()
			feed.Start(ctx)
			<-ctx.Done()
			if err := feed.Stop(context.Background()); err != nil {
				t.Fatalf("Stop: %v", err)
			}

			mu.Lock()
			defer mu.Unlock()
			var faulted int
			var lastErr error
			for _, run := range runs {
				if run.Err != nil {
					faulted++
					lastErr = run.Err
				}
			}
			t.Logf("%s: %d flushes, %d reporting a fault, %d rows stored",
				name, len(runs), faulted, totalMarkets(runs))
			// THE ASSERTION IS ABOUT THE CONNECTION, NOT ABOUT EVENTS. A venue may legitimately
			// produce no liquidations in two minutes; it may not legitimately keep hanging up.
			if faulted > 0 {
				t.Fatalf("%s reported %d faulted flushes in %s, last: %v", name, faulted, window, lastErr)
			}
		})
	}
}

func totalMarkets(runs []collector.Run) int {
	total := 0
	for _, run := range runs {
		total += run.Markets
	}
	return total
}

// liveSink counts instead of writing: a live check must not need a database.
type liveSink struct{}

func (liveSink) RecordLiquidations(_ context.Context, _ string, rows []core.Liquidation) (int, error) {
	return len(rows), nil
}
