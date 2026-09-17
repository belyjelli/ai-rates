package stream

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"math"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// Every fixture in this file was CAPTURED LIVE on 2026-09-18 by the probe described in
// internal/stream/events.go, not written by hand from documentation. Where a venue's meaning was
// ambiguous the probe also measured it, and the side tests below pin the answer so a future edit
// cannot quietly invert a venue's longs and shorts — which is the one error in this package that
// would be invisible in aggregate and fatal to the study reading the table.

const (
	// Bybit, allLiquidation. Both directions, from the same run that measured the side mapping
	// against bybit's own order book.
	bybitLiqBuy  = `{"topic":"allLiquidation.ICPUSDT","type":"snapshot","ts":1789670094412,"data":[{"T":1789670094099,"s":"ICPUSDT","S":"Buy","v":"19.7","p":"2.585"}]}`
	bybitLiqSell = `{"topic":"allLiquidation.MARSCOINUSDT","type":"snapshot","ts":1789670278264,"data":[{"T":1789670278053,"s":"MARSCOINUSDT","S":"Sell","v":"2380","p":"0.12734"}]}`

	// Binance, !forceOrder@arr, from fstream.binancefuture.com.
	binanceLiqBuy = `{"e":"forceOrder","E":1789672236702,"o":{"s":"COTIUSDT","S":"BUY","o":"LIMIT","f":"IOC","q":"288183","p":"0.0220482","ap":"0.0219120","X":"FILLED","l":"288183","z":"288183","T":1789672235690}}`
	// Aster, same stream shape on its own host — the reason one decoder serves both.
	asterLiqSell = `{"e":"forceOrder","E":1789672621589,"o":{"s":"PAIRUSDT","S":"SELL","o":"LIMIT","f":"IOC","q":"28448","p":"0.0040681","ap":"0.0044461","X":"FILLED","l":"12417","z":"28448","T":1789672621550}}`

	// OKX, liquidation-orders instType SWAP. Note posSide and side disagree, as they must.
	okxLiqShort = `{"arg":{"channel":"liquidation-orders","instType":"SWAP"},"data":[{"details":[{"bkLoss":"0","bkPx":"0.4162","ccy":"","posSide":"short","side":"buy","sz":"2137","ts":"1789669898955"}],"instFamily":"CNPY-USDT","instId":"CNPY-USDT-SWAP","instType":"SWAP","uly":"CNPY-USDT"}]}`

	// HTX, public.*.liquidation_orders. Stored uncompressed here; the test gzips it, because the
	// venue gzips every frame and the decoder has to inflate.
	htxLiqBuy = `{"op":"notify","topic":"public.ETH-USDT.liquidation_orders","ts":1789670297217,"data":[{"symbol":"ETH","contract_code":"ETH-USDT","direction":"buy","offset":"close","volume":500,"price":2446.26,"created_at":1789670297212,"amount":5,"trade_turnover":12231.3,"contract_type":"swap","pair":"ETH-USDT","business_type":"swap","trade_partition":"USDT"}]}`

	// dYdX v4 indexer, v4_trades, the LIQUIDATED type among ordinary LIMIT fills.
	dydxLiqSell = `{"type":"channel_data","connection_id":"x","message_id":7,"id":"BTC-USD","channel":"v4_trades","version":"2.4.0","contents":{"trades":[{"id":"064e89330000000200000002","side":"SELL","size":"0.0004","price":"75974","type":"LIQUIDATED","createdAt":"2026-09-17T13:39:47.542Z","createdAtHeight":"105810227"}]}}`
	dydxLimit   = `{"type":"channel_data","connection_id":"x","message_id":8,"id":"BTC-USD","channel":"v4_trades","version":"2.4.0","contents":{"trades":[{"id":"064f03900000000200000005","side":"SELL","size":"0.0002","price":"76467","type":"LIMIT","createdAt":"2026-09-17T19:18:42.257Z","createdAtHeight":"105841552"}]}}`
	dydxDelev   = `{"type":"channel_data","connection_id":"x","message_id":9,"id":"ETH-USD","channel":"v4_trades","version":"2.4.0","contents":{"trades":[{"id":"064e89330000000200000009","side":"BUY","size":"1.5","price":"2460","type":"DELEVERAGED","createdAt":"2026-09-17T13:40:00.000Z","createdAtHeight":"105810230"}]}}`
)

func gzipFixture(t *testing.T, body string) []byte {
	t.Helper()
	var buf bytes.Buffer
	writer := gzip.NewWriter(&buf)
	if _, err := writer.Write([]byte(body)); err != nil {
		t.Fatalf("gzip write: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}
	return buf.Bytes()
}

func decodeOne(t *testing.T, proto EventProtocol, msg []byte) LiquidationEvent {
	t.Helper()
	events, err := proto.DecodeEvents(msg, time.Unix(0, 0).UTC())
	if err != nil {
		t.Fatalf("DecodeEvents: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("want 1 event, got %d", len(events))
	}
	return events[0]
}

func nearly(a, b float64) bool { return math.Abs(a-b) < 1e-9 || math.Abs(a-b)/math.Abs(b) < 1e-9 }

// TestLiquidationSidesAreThePositionNotTheOrder is the single most important test here.
//
// `liquidations.side` is the side of the POSITION that was closed (migration 012), and the five
// venues express that in three different ways: okx names it outright, bybit's `S` names the
// position (measured against its own book, 30 of 30 — see liqbybit.go), and binance, aster, htx and
// dydx all report the ORDER, which is always the opposite. A refactor that "tidies" any of these
// into one shared rule silently inverts a venue, so each direction is pinned against a live capture.
func TestLiquidationSidesAreThePositionNotTheOrder(t *testing.T) {
	cases := []struct {
		name  string
		proto EventProtocol
		msg   []byte
		want  string
		why   string
	}{
		{"bybit Buy is a liquidated long", BybitLiquidations{}, []byte(bybitLiqBuy), "long",
			"measured: S=Buy printed below the bid 21 of 21 times, i.e. an aggressive sell closing a long"},
		{"bybit Sell is a liquidated short", BybitLiquidations{}, []byte(bybitLiqSell), "short",
			"measured: S=Sell printed above the ask 9 of 9 times"},
		{"binance BUY order closes a short", NewBinanceLiquidations(""), []byte(binanceLiqBuy), "short",
			"o.S is the liquidation order's own side; buying closes a short"},
		{"aster SELL order closes a long", NewAsterLiquidations(""), []byte(asterLiqSell), "long",
			"aster mirrors binance's stream, so the same inversion applies"},
		{"okx posSide is already the position", NewOKXLiquidations(nil), []byte(okxLiqShort), "short",
			"posSide short with side buy: okx states the position and the order separately"},
		{"htx buy-to-close closes a short", HTXLiquidations{}, gzipFixture(t, htxLiqBuy), "short",
			"direction buy with offset close can only be closing a short"},
		{"dydx SELL taker closes a long", DydxLiquidations{}, []byte(dydxLiqSell), "long",
			"the liquidation order is the taker; selling closes a long"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := decodeOne(t, c.proto, c.msg)
			if got.Side != c.want {
				t.Fatalf("side = %q, want %q (%s)", got.Side, c.want, c.why)
			}
		})
	}
}

// TestLiquidationNotionalsAreRealDollars checks the conversion per venue against the live record's
// own arithmetic. The units genuinely differ — base coin on binance, aster, bybit and dydx,
// contracts against ctVal on okx, and a turnover htx hands over ready-made — so a single shared
// formula would be wrong on at least two of them.
func TestLiquidationNotionalsAreRealDollars(t *testing.T) {
	t.Run("bybit base coin times price", func(t *testing.T) {
		got := decodeOne(t, BybitLiquidations{}, []byte(bybitLiqBuy))
		want := 19.7 * 2.585 // $50.93
		if got.NotionalUSD == nil || !nearly(*got.NotionalUSD, want) {
			t.Fatalf("notional = %v, want %v", got.NotionalUSD, want)
		}
		if got.SizeContracts != 19.7 || got.FillPrice != 2.585 {
			t.Fatalf("size/price = %v/%v, want 19.7/2.585", got.SizeContracts, got.FillPrice)
		}
	})

	t.Run("binance uses the average fill price, not the limit price", func(t *testing.T) {
		got := decodeOne(t, NewBinanceLiquidations(""), []byte(binanceLiqBuy))
		// ap is 0.0219120 and p is 0.0220482; fill_price means what it actually closed at.
		if got.FillPrice != 0.0219120 {
			t.Fatalf("fill price = %v, want ap 0.021912", got.FillPrice)
		}
		want := 288183 * 0.0219120 // $6,314.7
		if got.NotionalUSD == nil || !nearly(*got.NotionalUSD, want) {
			t.Fatalf("notional = %v, want %v", got.NotionalUSD, want)
		}
	})

	t.Run("htx prefers the venue's own turnover over any computation", func(t *testing.T) {
		got := decodeOne(t, HTXLiquidations{}, gzipFixture(t, htxLiqBuy))
		// 500 CONTRACTS, not 500 ETH: ETH-USDT is 0.01 ETH apiece, so amount is 5 and the turnover
		// is 12,231.3. Multiplying the contract count by the price would give $1.2M, a 100x error.
		if got.SizeContracts != 500 {
			t.Fatalf("size = %v, want the raw contract count 500", got.SizeContracts)
		}
		if got.NotionalUSD == nil || !nearly(*got.NotionalUSD, 12231.3) {
			t.Fatalf("notional = %v, want 12231.3", got.NotionalUSD)
		}
		if naive := got.SizeContracts * got.FillPrice; nearly(*got.NotionalUSD, naive) {
			t.Fatalf("notional must not be contracts x price (%v)", naive)
		}
	})

	t.Run("dydx base asset times price", func(t *testing.T) {
		got := decodeOne(t, DydxLiquidations{}, []byte(dydxLiqSell))
		want := 0.0004 * 75974
		if got.NotionalUSD == nil || !nearly(*got.NotionalUSD, want) {
			t.Fatalf("notional = %v, want %v", got.NotionalUSD, want)
		}
	})

	t.Run("okx without contract metadata stores nil rather than a contract count", func(t *testing.T) {
		// Prepare has not run, so ctVal is unknown. A raw `sz` of 2137 must NOT be passed off as
		// dollars: on a real instrument that is wrong by orders of magnitude, and migration 012's
		// whole point is that a null stays recoverable while a wrong number does not.
		got := decodeOne(t, NewOKXLiquidations(nil), []byte(okxLiqShort))
		if got.NotionalUSD != nil {
			t.Fatalf("notional = %v, want nil when ctVal is unknown", *got.NotionalUSD)
		}
		if got.SizeContracts != 2137 {
			t.Fatalf("size = %v, want the raw contract count 2137", got.SizeContracts)
		}
	})

	t.Run("okx converts contracts with ctVal once Prepare has run", func(t *testing.T) {
		proto := NewOKXLiquidations(nil)
		proto.contract = map[string]float64{"CNPY-USDT-SWAP": 10} // 10 CNPY per contract
		got := decodeOne(t, proto, []byte(okxLiqShort))
		want := 2137 * 10 * 0.4162
		if got.NotionalUSD == nil || !nearly(*got.NotionalUSD, want) {
			t.Fatalf("notional = %v, want %v", got.NotionalUSD, want)
		}
	})

	t.Run("okx inverse contracts are already dollars and skip the price", func(t *testing.T) {
		proto := NewOKXLiquidations(nil)
		// Prepare marks an inverse (ctValCcy USD) contract by storing its size NEGATIVE.
		proto.contract = map[string]float64{"CNPY-USDT-SWAP": -100}
		got := decodeOne(t, proto, []byte(okxLiqShort))
		want := 2137.0 * 100 // NOT multiplied by 0.4162
		if got.NotionalUSD == nil || !nearly(*got.NotionalUSD, want) {
			t.Fatalf("notional = %v, want %v (an inverse contract must not be multiplied by the price)",
				got.NotionalUSD, want)
		}
	})
}

func TestLiquidationTimestampsComeFromTheVenue(t *testing.T) {
	now := time.Unix(1, 0).UTC()
	cases := []struct {
		name  string
		proto EventProtocol
		msg   []byte
		want  time.Time
	}{
		{"bybit epoch ms", BybitLiquidations{}, []byte(bybitLiqBuy), time.UnixMilli(1789670094099).UTC()},
		{"binance trade time, not event time", NewBinanceLiquidations(""), []byte(binanceLiqBuy), time.UnixMilli(1789672235690).UTC()},
		{"okx string epoch ms", NewOKXLiquidations(nil), []byte(okxLiqShort), time.UnixMilli(1789669898955).UTC()},
		{"htx created_at", HTXLiquidations{}, gzipFixture(t, htxLiqBuy), time.UnixMilli(1789670297212).UTC()},
		{"dydx RFC3339 string", DydxLiquidations{}, []byte(dydxLiqSell), time.Date(2026, 9, 17, 13, 39, 47, 542000000, time.UTC)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := c.proto.DecodeEvents(c.msg, now)
			if err != nil || len(got) != 1 {
				t.Fatalf("DecodeEvents: %v, %d events", err, len(got))
			}
			if !got[0].At.Equal(c.want) {
				t.Fatalf("at = %s, want %s", got[0].At, c.want)
			}
		})
	}
}

// TestDydxIngestsOnlyLiquidations: an ordinary LIMIT fill is not a forced close, and DELEVERAGED is
// a different event entirely — the insurance fund closing a PROFITABLE position, not a margin call.
// Folding either into this table would contaminate the regressor it exists to feed.
func TestDydxIngestsOnlyLiquidations(t *testing.T) {
	for _, fixture := range []struct{ name, msg string }{
		{"LIMIT", dydxLimit},
		{"DELEVERAGED", dydxDelev},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			got, err := DydxLiquidations{}.DecodeEvents([]byte(fixture.msg), time.Now())
			if err != nil {
				t.Fatalf("DecodeEvents: %v", err)
			}
			if len(got) != 0 {
				t.Fatalf("want no events for a %s trade, got %d", fixture.name, len(got))
			}
		})
	}
}

// TestLiquidationDecodersIgnoreControlTraffic: acks, pongs and heartbeats must yield neither an
// event nor an error, or a feed would log a fault on every keepalive.
func TestLiquidationDecodersIgnoreControlTraffic(t *testing.T) {
	cases := []struct {
		name  string
		proto EventProtocol
		msg   []byte
	}{
		{"bybit subscribe ack", BybitLiquidations{}, []byte(`{"success":true,"ret_msg":"subscribe","op":"subscribe","conn_id":"x"}`)},
		{"bybit pong", BybitLiquidations{}, []byte(`{"success":true,"ret_msg":"pong","op":"ping","conn_id":"x"}`)},
		{"okx pong", NewOKXLiquidations(nil), []byte("pong")},
		{"okx subscribe ack", NewOKXLiquidations(nil), []byte(`{"event":"subscribe","arg":{"channel":"liquidation-orders","instType":"SWAP"},"connId":"x"}`)},
		{"htx subscribe ack", HTXLiquidations{}, gzipFixture(t, `{"op":"sub","cid":"airates-liq","topic":"public.*.liquidation_orders","ts":1789670081489,"err-code":0}`)},
		{"htx repeated subscription is not a fault", HTXLiquidations{}, gzipFixture(t, `{"op":"sub","cid":"probe-1","topic":"public.BTC-USDT.liquidation_orders","err-code":2014,"err-msg":"Repeated subscription.","ts":1789669865635}`)},
		{"htx ping", HTXLiquidations{}, gzipFixture(t, `{"op":"ping","ts":1789670081489}`)},
		{"dydx connected", DydxLiquidations{}, []byte(`{"type":"connected","connection_id":"x","message_id":0}`)},
		{"binance unrelated event", NewBinanceLiquidations(""), []byte(`{"e":"aggTrade","E":1,"s":"BTCUSDT","p":"1","q":"1"}`)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := c.proto.DecodeEvents(c.msg, time.Now())
			if err != nil {
				t.Fatalf("control traffic reported an error: %v", err)
			}
			if len(got) != 0 {
				t.Fatalf("control traffic produced %d events", len(got))
			}
		})
	}
}

// TestLiquidationDecodersSurfaceVenueRejections: the opposite case. A venue saying "no" must reach
// the feed as an error so it lands on /status, rather than being swallowed as an unknown message.
func TestLiquidationDecodersSurfaceVenueRejections(t *testing.T) {
	cases := []struct {
		name  string
		proto EventProtocol
		msg   []byte
		want  string
	}{
		{"bybit rejection", BybitLiquidations{}, []byte(`{"success":false,"ret_msg":"Invalid symbol","op":"subscribe"}`), "Invalid symbol"},
		{"okx error", NewOKXLiquidations(nil), []byte(`{"event":"error","code":"60012","msg":"Invalid request"}`), "60012"},
		{"htx rejection", HTXLiquidations{}, gzipFixture(t, `{"op":"sub","topic":"public.*.liquidation_orders","err-code":1002,"err-msg":"not authorized"}`), "not authorized"},
		{"dydx error", DydxLiquidations{}, []byte(`{"type":"error","message":"Invalid channel","connection_id":"x"}`), "Invalid channel"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := c.proto.DecodeEvents(c.msg, time.Now())
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("err = %v, want it to mention %q", err, c.want)
			}
		})
	}
}

// TestHTXRespondsToTheVenuesPing: htx drives the keepalive, so a missing pong is a dropped
// connection. The reply has to echo the venue's own timestamp, which is why it is a Responder and
// not a ticker.
func TestHTXRespondsToTheVenuesPing(t *testing.T) {
	reply := HTXLiquidations{}.Respond(gzipFixture(t, `{"op":"ping","ts":1789670081489}`))
	if string(reply) != `{"op":"pong","ts":1789670081489}` {
		t.Fatalf("reply = %s", reply)
	}
	// Parenthesised because Go reads a bare composite literal in an if-header as the start of the
	// statement's block.
	if other := (HTXLiquidations{}).Respond(gzipFixture(t, htxLiqBuy)); other != nil {
		t.Fatalf("a liquidation must not be answered: %s", other)
	}
}

func TestBybitLiquidationFramesChunkUnderTheArgsBudget(t *testing.T) {
	symbols := make([]string, 805) // the live count on 2026-09-18
	for i := range symbols {
		symbols[i] = "SYMBOL" + strings.Repeat("X", 6) + "USDT"
	}
	frames := BybitLiquidations{}.Frames(symbols)
	if len(frames) != 5 {
		t.Fatalf("frames = %d, want 5 for 805 symbols at 200 a frame", len(frames))
	}
	for i, frame := range frames {
		// Bybit documents 21,000 characters of args per REQUEST; the live run measured 5,358.
		if len(frame) > 21_000 {
			t.Fatalf("frame %d is %d chars, over bybit's 21,000 budget", i, len(frame))
		}
		var decoded struct {
			Op   string   `json:"op"`
			Args []string `json:"args"`
		}
		if err := json.Unmarshal(frame, &decoded); err != nil {
			t.Fatalf("frame %d is not JSON: %v", i, err)
		}
		if decoded.Op != "subscribe" || !strings.HasPrefix(decoded.Args[0], "allLiquidation.") {
			t.Fatalf("frame %d = %s", i, frame)
		}
	}
}

func TestAllSymbolsVenuesNeedNoSubjects(t *testing.T) {
	// Which venues need a symbol list is load-bearing: NeedsSymbols false is what stops the
	// connector treating an empty subject set as a cold start and refusing to dial.
	for _, c := range []struct {
		proto EventProtocol
		want  bool
	}{
		{NewBinanceLiquidations(""), false},
		{NewAsterLiquidations(""), false},
		{NewOKXLiquidations(nil), false},
		{HTXLiquidations{}, false},
		{BybitLiquidations{}, true},
		{DydxLiquidations{}, true},
	} {
		if got := c.proto.NeedsSymbols(); got != c.want {
			t.Fatalf("%s NeedsSymbols = %v, want %v", c.proto.VenueID(), got, c.want)
		}
	}
}

// --- feed-level tests -------------------------------------------------------

type recordingSink struct {
	mu    sync.Mutex
	calls [][]core.Liquidation
	err   error
}

func (s *recordingSink) RecordLiquidations(_ context.Context, _ string, rows []core.Liquidation) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return 0, s.err
	}
	s.calls = append(s.calls, rows)
	return len(rows), nil
}

func (s *recordingSink) rows() []core.Liquidation {
	s.mu.Lock()
	defer s.mu.Unlock()
	var all []core.Liquidation
	for _, call := range s.calls {
		all = append(all, call...)
	}
	return all
}

func (s *recordingSink) batches() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.calls)
}

// TestEventFeedBatchesEveryEventInOneWrite is the reason EventFeed exists at all rather than reusing
// Feed: a book collapses to one row per market, events must not. Three liquidations on the SAME
// market in one window have to reach the store as three rows, in ONE statement.
func TestEventFeedBatchesEveryEventInOneWrite(t *testing.T) {
	sink := &recordingSink{}
	feed := NewEventFeed(BybitLiquidations{}, nil, sink, []string{"ICPUSDT"}, Options{})

	// Same market, three distinct events — exactly what a collapsing map would destroy.
	for _, msg := range []string{
		`{"topic":"allLiquidation.ICPUSDT","data":[{"T":1789670094099,"s":"ICPUSDT","S":"Buy","v":"19.7","p":"2.585"}]}`,
		`{"topic":"allLiquidation.ICPUSDT","data":[{"T":1789670094599,"s":"ICPUSDT","S":"Buy","v":"3.1","p":"2.584"}]}`,
		`{"topic":"allLiquidation.ICPUSDT","data":[{"T":1789670095099,"s":"ICPUSDT","S":"Sell","v":"7.5","p":"2.590"}]}`,
	} {
		if err := feed.handle([]byte(msg), time.Now()); err != nil {
			t.Fatalf("handle: %v", err)
		}
	}
	feed.Flush(context.Background())

	rows := sink.rows()
	if len(rows) != 3 {
		t.Fatalf("stored %d rows, want 3 — events must not collapse per market", len(rows))
	}
	if sink.batches() != 1 {
		t.Fatalf("made %d writes, want 1 batched statement", sink.batches())
	}
	var longs, shorts int
	for _, row := range rows {
		if row.VenueID != "bybit" || row.VenueSymbol != "ICPUSDT" {
			t.Fatalf("row = %+v", row)
		}
		switch row.Side {
		case "long":
			longs++
		case "short":
			shorts++
		}
	}
	if longs != 2 || shorts != 1 {
		t.Fatalf("longs/shorts = %d/%d, want 2/1", longs, shorts)
	}
}

// TestEventFeedFlushWithNothingStillReportsARun: the opposite of Feed's rule, and the reason a quiet
// liquidation feed does not page anyone. Silence here is a calm market, not a fault.
func TestEventFeedFlushWithNothingStillReportsARun(t *testing.T) {
	var runs []collector.Run
	sink := &recordingSink{}
	feed := NewEventFeed(HTXLiquidations{}, nil, sink, nil, Options{
		OnFlush: func(run collector.Run) { runs = append(runs, run) },
	})
	feed.Flush(context.Background())

	if len(runs) != 1 {
		t.Fatalf("runs = %d, want 1 even with nothing buffered", len(runs))
	}
	if runs[0].Err != nil {
		t.Fatalf("an empty flush must not report an error, got %v", runs[0].Err)
	}
	if runs[0].VenueID != "htx:liq" {
		t.Fatalf("venue = %q, want htx:liq so it cannot satisfy htx's own staleness check", runs[0].VenueID)
	}
	if sink.batches() != 0 {
		t.Fatalf("an empty flush must not touch the database")
	}
}

// TestEventFeedReportsConnectionFaults: a feed that cannot connect must still surface, or the
// "silence is normal" rule above would hide a genuinely dead socket forever.
func TestEventFeedReportsConnectionFaults(t *testing.T) {
	var runs []collector.Run
	feed := NewEventFeed(BybitLiquidations{}, nil, &recordingSink{}, []string{"BTCUSDT"}, Options{
		OnFlush: func(run collector.Run) { runs = append(runs, run) },
	})
	feed.conn.setErr(errors.New("dial: connection refused"))
	feed.Flush(context.Background())

	if len(runs) != 1 || runs[0].Err == nil {
		t.Fatalf("a connection fault must reach the run: %+v", runs)
	}
	if !strings.Contains(runs[0].Err.Error(), "connection refused") {
		t.Fatalf("err = %v", runs[0].Err)
	}
}

// TestEventFeedDropsRatherThanGrowsWithoutBound. A cascade against an unreachable database must not
// take the container's memory with it; what it drops is counted, not swallowed.
func TestEventFeedDropsRatherThanGrowsWithoutBound(t *testing.T) {
	feed := NewEventFeed(BybitLiquidations{}, nil, &recordingSink{}, []string{"BTCUSDT"}, Options{})
	feed.mu.Lock()
	feed.buf = make([]LiquidationEvent, eventBufferCap)
	feed.mu.Unlock()

	if err := feed.handle([]byte(bybitLiqBuy), time.Now()); err != nil {
		t.Fatalf("handle: %v", err)
	}
	feed.mu.Lock()
	buffered, dropped := len(feed.buf), feed.dropped
	feed.mu.Unlock()

	if buffered != eventBufferCap {
		t.Fatalf("buffer grew past its cap: %d", buffered)
	}
	if dropped != 1 {
		t.Fatalf("dropped = %d, want 1 counted drop", dropped)
	}
}

// TestEventFeedRejectsRowsTheTableWouldRefuse. liquidations.side carries a CHECK constraint and the
// primary key spans five columns, so one malformed row would fail the whole batch and lose the good
// ones with it.
func TestEventFeedRejectsRowsTheTableWouldRefuse(t *testing.T) {
	sink := &recordingSink{}
	feed := NewEventFeed(BybitLiquidations{}, nil, sink, []string{"BTCUSDT"}, Options{})
	feed.mu.Lock()
	feed.buf = []LiquidationEvent{
		{VenueSymbol: "BTCUSDT", At: time.Now(), Side: "long", SizeContracts: 1, FillPrice: 2},
		{VenueSymbol: "BTCUSDT", At: time.Now(), Side: "", SizeContracts: 1, FillPrice: 2},
		{VenueSymbol: "BTCUSDT", At: time.Now(), Side: "long", SizeContracts: 0, FillPrice: 2},
		{VenueSymbol: "BTCUSDT", At: time.Time{}, Side: "long", SizeContracts: 1, FillPrice: 2},
	}
	feed.mu.Unlock()
	feed.Flush(context.Background())

	if rows := sink.rows(); len(rows) != 1 {
		t.Fatalf("stored %d rows, want only the one valid row", len(rows))
	}
}

// TestEventFeedSubjectsOnlyMatterWhereTheVenueNeedsThem.
func TestEventFeedSubjectsOnlyMatterWhereTheVenueNeedsThem(t *testing.T) {
	allSymbols := NewEventFeed(NewOKXLiquidations(nil), nil, &recordingSink{}, nil, Options{})
	if added, removed := allSymbols.SetSubjects([]string{"BTC-USDT-SWAP"}); added != 0 || removed != 0 {
		t.Fatalf("an all-symbols venue must not cycle its connection for a subject change")
	}

	perSymbol := NewEventFeed(BybitLiquidations{}, nil, &recordingSink{}, []string{"BTCUSDT"}, Options{})
	if added, removed := perSymbol.SetSubjects([]string{"BTCUSDT", "ETHUSDT"}); added != 1 || removed != 0 {
		t.Fatalf("added/removed = %d/%d, want 1/0", added, removed)
	}
	// An empty set is refused, exactly as for the quote feeds: a query that returned nothing must
	// not unsubscribe a working feed.
	if added, removed := perSymbol.SetSubjects(nil); added != 0 || removed != 0 {
		t.Fatalf("an empty set must be refused, got %d/%d", added, removed)
	}
	if perSymbol.Subjects() != 2 {
		t.Fatalf("subjects = %d, want the previous set kept", perSymbol.Subjects())
	}
}

// TestEventFeedEndToEndOverAScriptedConnection drives a whole feed — dial, subscribe, read, decode,
// buffer, flush — through the same scripted connection the quote-feed tests use. No server, no
// network: this is the integration-shaped check that the connector extracted in conn.go still
// subscribes and delivers when it is an EventFeed rather than a Feed driving it.
func TestEventFeedEndToEndOverAScriptedConnection(t *testing.T) {
	conn := newConn(
		`{"success":true,"ret_msg":"subscribe","op":"subscribe"}`, // an ack must not become a row
		bybitLiqBuy,
		bybitLiqSell,
	)
	sink := &recordingSink{}
	feed := NewEventFeed(BybitLiquidations{}, func(context.Context, string) (Conn, error) { return conn, nil },
		sink, []string{"ICPUSDT", "MARSCOINUSDT"}, Options{
			FlushEvery:  20 * time.Millisecond,
			ReadTimeout: 50 * time.Millisecond,
		})

	ctx, cancel := context.WithCancel(context.Background())
	feed.Start(ctx)
	deadline := time.After(3 * time.Second)
	for len(sink.rows()) < 2 {
		select {
		case <-deadline:
			t.Fatalf("only %d rows arrived", len(sink.rows()))
		case <-time.After(5 * time.Millisecond):
		}
	}
	cancel()
	if err := feed.Stop(context.Background()); err != nil {
		t.Fatalf("Stop: %v", err)
	}

	// The subscribe frames actually went out, carrying the liquidation topic rather than the book's.
	writes := conn.writes()
	if len(writes) == 0 || !strings.Contains(string(writes[0]), "allLiquidation.") {
		t.Fatalf("first write = %s, want an allLiquidation subscribe", writes)
	}

	rows := sink.rows()
	if len(rows) < 2 {
		t.Fatalf("rows = %d", len(rows))
	}
	bySymbol := map[string]core.Liquidation{}
	for _, row := range rows {
		bySymbol[row.VenueSymbol] = row
	}
	if got := bySymbol["ICPUSDT"]; got.Side != "long" {
		t.Errorf("ICPUSDT side = %q, want long", got.Side)
	}
	if got := bySymbol["MARSCOINUSDT"]; got.Side != "short" {
		t.Errorf("MARSCOINUSDT side = %q, want short", got.Side)
	}
	// MarketRefFor has run, so the row carries the venue and a parsed base rather than a bare symbol.
	if got := bySymbol["ICPUSDT"]; got.VenueID != "bybit" || got.Base == "" {
		t.Errorf("row = %+v, want venue bybit and a parsed base", got)
	}
}

// TestEventFeedWaitsRatherThanDiallingWithNoSubjects: on a per-symbol venue an empty set is a cold
// start, not a reason to open a connection there is nothing to say on. The all-symbols venues must
// behave the opposite way, or they would never connect at all.
func TestEventFeedWaitsRatherThanDiallingWithNoSubjects(t *testing.T) {
	var dials int
	var mu sync.Mutex
	dial := func(context.Context, string) (Conn, error) {
		mu.Lock()
		dials++
		mu.Unlock()
		return newConn(), nil
	}

	perSymbol := NewEventFeed(BybitLiquidations{}, dial, &recordingSink{}, nil, Options{
		FlushEvery: 10 * time.Millisecond, ReadTimeout: 20 * time.Millisecond,
	})
	ctx, cancel := context.WithCancel(context.Background())
	perSymbol.Start(ctx)
	time.Sleep(150 * time.Millisecond)
	cancel()
	_ = perSymbol.Stop(context.Background())
	mu.Lock()
	perSymbolDials := dials
	dials = 0
	mu.Unlock()
	if perSymbolDials != 0 {
		t.Fatalf("bybit dialled %d times with no subjects; it should wait", perSymbolDials)
	}

	allSymbols := NewEventFeed(HTXLiquidations{}, dial, &recordingSink{}, nil, Options{
		FlushEvery: 10 * time.Millisecond, ReadTimeout: 20 * time.Millisecond,
	})
	ctx2, cancel2 := context.WithCancel(context.Background())
	allSymbols.Start(ctx2)
	time.Sleep(150 * time.Millisecond)
	cancel2()
	_ = allSymbols.Stop(context.Background())
	mu.Lock()
	allSymbolDials := dials
	mu.Unlock()
	if allSymbolDials == 0 {
		t.Fatal("htx never dialled; an all-symbols venue needs no subjects")
	}
}

// TestOKXLiquidationPrepareMarksInverseContractsNegative pins the one piece of cleverness in this
// package: Prepare stores an INVERSE contract's size as a negative number so a single map can carry
// both cases without a second lookup on the decode path. If that convention is ever changed, every
// inverse swap's notional silently gains a factor of the coin's price.
func TestOKXLiquidationPrepareMarksInverseContractsNegative(t *testing.T) {
	body := `{"code":"0","data":[
		{"instId":"BTC-USDT-SWAP","ctVal":"0.01","ctMult":"1","ctValCcy":"BTC"},
		{"instId":"BTC-USD-SWAP","ctVal":"100","ctMult":"1","ctValCcy":"USD"}
	]}`
	proto := NewOKXLiquidations(jsonClient(t, "okx", body))
	if err := proto.Prepare(context.Background(), nil); err != nil {
		t.Fatalf("Prepare: %v", err)
	}
	if got := proto.contract["BTC-USDT-SWAP"]; got != 0.01 {
		t.Errorf("linear = %v, want a positive 0.01 base units a contract", got)
	}
	if got := proto.contract["BTC-USD-SWAP"]; got != -100 {
		t.Errorf("inverse = %v, want -100, the negative marking dollars a contract", got)
	}

	// And the decode honours it: a linear swap multiplies by the price, an inverse one must not.
	linear := `{"arg":{"channel":"liquidation-orders","instType":"SWAP"},"data":[{"instId":"BTC-USDT-SWAP","details":[{"bkPx":"76000","posSide":"long","side":"sell","sz":"5","ts":"1789670000000"}]}]}`
	if got := decodeOne(t, proto, []byte(linear)); got.NotionalUSD == nil || !nearly(*got.NotionalUSD, 5*0.01*76000) {
		t.Errorf("linear notional = %v, want %v", got.NotionalUSD, 5*0.01*76000)
	}
	inverse := `{"arg":{"channel":"liquidation-orders","instType":"SWAP"},"data":[{"instId":"BTC-USD-SWAP","details":[{"bkPx":"76000","posSide":"long","side":"sell","sz":"5","ts":"1789670000000"}]}]}`
	if got := decodeOne(t, proto, []byte(inverse)); got.NotionalUSD == nil || !nearly(*got.NotionalUSD, 500) {
		t.Errorf("inverse notional = %v, want 500 (5 contracts x $100), NOT multiplied by the price", got.NotionalUSD)
	}
}

// TestEventFeedRequeuesAFailedWrite. Four of the six venues have no REST path behind them, so a
// batch dropped on a database blip is gone for good. It must survive to the next flush instead.
func TestEventFeedRequeuesAFailedWrite(t *testing.T) {
	sink := &recordingSink{err: errors.New("connection reset")}
	feed := NewEventFeed(BybitLiquidations{}, nil, sink, []string{"ICPUSDT"}, Options{})

	if err := feed.handle([]byte(bybitLiqBuy), time.Now()); err != nil {
		t.Fatalf("handle: %v", err)
	}
	feed.Flush(context.Background()) // fails

	feed.mu.Lock()
	buffered := len(feed.buf)
	feed.mu.Unlock()
	if buffered != 1 {
		t.Fatalf("buffered = %d after a failed write, want the event kept for a retry", buffered)
	}

	// The database comes back; the retry lands.
	sink.mu.Lock()
	sink.err = nil
	sink.mu.Unlock()
	feed.Flush(context.Background())

	if rows := sink.rows(); len(rows) != 1 {
		t.Fatalf("stored %d rows on the retry, want 1", len(rows))
	}
}
