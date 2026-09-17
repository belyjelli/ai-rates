package stream

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

type doerFunc func(*http.Request) (*http.Response, error)

func (f doerFunc) Do(r *http.Request) (*http.Response, error) { return f(r) }

func jsonClient(t *testing.T, venueID, body string) *httpclient.Client {
	t.Helper()
	return httpclient.New(venueID, httpclient.Options{Doer: doerFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Request:    r,
		}, nil
	})})
}

// --- gate ---------------------------------------------------------------------------------------

func TestGateSizesAreContractsTimesQuantoTimesPrice(t *testing.T) {
	// BTC_USDT is 0.0001 BTC a contract, which is the example migration 013 and the REST adapter
	// both use.
	g := NewGate(jsonClient(t, "gate", `[{"name":"BTC_USDT","quanto_multiplier":"0.0001"}]`))
	if err := g.Prepare(context.Background(), nil); err != nil {
		t.Fatalf("Prepare: %v", err)
	}
	// 2,776 contracts at 77,766.70 is 0.2776 BTC, about $21.6k — the number migration 013 records
	// for this exact book.
	usd := g.SizeUSD("BTC_USDT", 77_766.7, 2_776)
	if usd == nil {
		t.Fatal("size unknown for a prepared symbol")
	}
	if want := 2_776 * 0.0001 * 77_766.7; *usd != want {
		t.Fatalf("size = %v, want %v", *usd, want)
	}
	if *usd < 21_000 || *usd > 22_500 {
		t.Fatalf("size = %v, want roughly the $21.6k migration 013 measured", *usd)
	}
	// An unprepared symbol is unknown, NOT a raw contract count: 2,776 read as dollars is four
	// orders of magnitude wrong, and a null fails the depth floor instead.
	if g.SizeUSD("NOTPREPARED_USDT", 1, 2_776) != nil {
		t.Fatal("an unknown symbol produced a size")
	}
}

func TestGateDecodeReadsBothSidesOfBookTicker(t *testing.T) {
	msg := `{"time":1789147120,"channel":"futures.book_ticker","event":"update","error":null,` +
		`"result":{"t":1789147120123,"s":"BTC_USDT","b":"77766.7","B":2776,"a":"77766.8","A":1200}}`
	updates, err := (&Gate{}).Decode([]byte(msg), time.Now())
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if len(updates) != 1 {
		t.Fatalf("%d updates, want 1", len(updates))
	}
	u := updates[0]
	if u.Symbol != "BTC_USDT" || *u.Bid != 77_766.7 || *u.Ask != 77_766.8 {
		t.Fatalf("update = %+v", u)
	}
	// Sizes arrive as JSON NUMBERS here and as strings on the other two venues; parseFloat has to
	// take both or gate's depth column would be silently null.
	if *u.BidQty != 2_776 || *u.AskQty != 1_200 {
		t.Fatalf("quantities = %v/%v, want 2776/1200", *u.BidQty, *u.AskQty)
	}
	if !u.At.Equal(time.UnixMilli(1_789_147_120_123).UTC()) {
		t.Fatalf("At = %v, want the message's own t", u.At)
	}
}

func TestGateDecodeReportsASubscribeError(t *testing.T) {
	msg := `{"time":1789147120,"channel":"futures.book_ticker","event":"subscribe",` +
		`"error":{"code":2,"message":"unknown contract"}}`
	if _, err := (&Gate{}).Decode([]byte(msg), time.Now()); err == nil {
		t.Fatal("a rejected subscribe decoded without an error")
	}
}

func TestGateDecodeIgnoresItsOwnAcks(t *testing.T) {
	for _, msg := range []string{
		`{"time":1789147120,"channel":"futures.book_ticker","event":"subscribe","error":null,"result":{"status":"success"}}`,
		`{"time":1789147120,"channel":"futures.pong","event":"update"}`,
	} {
		updates, err := (&Gate{}).Decode([]byte(msg), time.Now())
		if err != nil || len(updates) != 0 {
			t.Fatalf("Decode(%s) = %d updates, %v", msg, len(updates), err)
		}
	}
}

// --- okx ----------------------------------------------------------------------------------------

// The case okx.go:453 already documents for liquidations, now for the book: an inverse swap's
// contract is denominated in dollars, and multiplying it by the price inflates the depth by the
// price of the coin — on BTC, by about 77,000x.
func TestOKXInverseContractsAreAlreadyDollars(t *testing.T) {
	o := NewOKX(jsonClient(t, "okx", `{"code":"0","data":[
		{"instId":"BTC-USDT-SWAP","ctVal":"0.01","ctMult":"1","ctValCcy":"BTC"},
		{"instId":"BTC-USD-SWAP","ctVal":"100","ctMult":"1","ctValCcy":"USD"}
	]}`))
	if err := o.Prepare(context.Background(), nil); err != nil {
		t.Fatalf("Prepare: %v", err)
	}

	// Linear: 504.48 contracts of 0.01 BTC at 77,766.70 is about $392k — migration 013's figure.
	linear := o.SizeUSD("BTC-USDT-SWAP", 77_766.7, 504.48)
	if linear == nil {
		t.Fatal("linear size unknown")
	}
	if want := 504.48 * 0.01 * 77_766.7; *linear != want {
		t.Fatalf("linear = %v, want %v", *linear, want)
	}
	if *linear < 380_000 || *linear > 400_000 {
		t.Fatalf("linear = %v, want roughly the $392k migration 013 measured", *linear)
	}

	// Inverse: 5 contracts of $100 is $500, whatever BTC costs.
	inverse := o.SizeUSD("BTC-USD-SWAP", 77_766.7, 5)
	if inverse == nil {
		t.Fatal("inverse size unknown")
	}
	if *inverse != 500 {
		t.Fatalf("inverse = %v, want 500 -- the price must play no part", *inverse)
	}
}

func TestOKXDecodeReadsBboTbt(t *testing.T) {
	msg := `{"arg":{"channel":"bbo-tbt","instId":"BTC-USDT-SWAP"},"data":[{` +
		`"asks":[["77766.8","1.2","0","3"]],"bids":[["77766.7","504.48","0","12"]],"ts":"1789147120123"}]}`
	updates, err := (&OKX{}).Decode([]byte(msg), time.Now())
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if len(updates) != 1 {
		t.Fatalf("%d updates, want 1", len(updates))
	}
	u := updates[0]
	if u.Symbol != "BTC-USDT-SWAP" || *u.Bid != 77_766.7 || *u.BidQty != 504.48 || *u.Ask != 77_766.8 {
		t.Fatalf("update = %+v", u)
	}
	if !u.At.Equal(time.UnixMilli(1_789_147_120_123).UTC()) {
		t.Fatalf("At = %v, want the message's own ts", u.At)
	}
}

// okx answers a ping with the bare string "pong", which is not JSON. Reporting it as an unreadable
// message would put a fault on /status every twenty seconds on a perfectly healthy connection.
func TestOKXDecodeAcceptsTheBarePong(t *testing.T) {
	updates, err := (&OKX{}).Decode([]byte("pong"), time.Now())
	if err != nil {
		t.Fatalf("pong decoded as an error: %v", err)
	}
	if len(updates) != 0 {
		t.Fatalf("%d updates from a pong", len(updates))
	}
}

func TestOKXDecodeReportsAnError(t *testing.T) {
	msg := `{"event":"error","code":"60012","msg":"Invalid request: wrong channel"}`
	if _, err := (&OKX{}).Decode([]byte(msg), time.Now()); err == nil {
		t.Fatal("an error event decoded without an error")
	}
}

// --- framing ------------------------------------------------------------------------------------

func TestEveryProtocolFramesEveryTopicExactlyOnce(t *testing.T) {
	symbols := make([]string, 977) // gate's whole book, the largest of the three
	for i := range symbols {
		symbols[i] = "SYM" + itoa(int64(i)) + "_USDT"
	}
	for _, proto := range []Protocol{Bybit{}, &Gate{}, &OKX{}} {
		seen := map[string]bool{}
		for _, frame := range proto.Frames(symbols) {
			var sub struct {
				Args    []json.RawMessage `json:"args"`
				Payload []string          `json:"payload"`
			}
			if err := json.Unmarshal(frame, &sub); err != nil {
				t.Fatalf("%s: frame is not JSON: %v", proto.VenueID(), err)
			}
			for _, arg := range sub.Args {
				if seen[string(arg)] {
					t.Fatalf("%s: %s subscribed twice", proto.VenueID(), arg)
				}
				seen[string(arg)] = true
			}
			for _, name := range sub.Payload {
				if seen[name] {
					t.Fatalf("%s: %s subscribed twice", proto.VenueID(), name)
				}
				seen[name] = true
			}
		}
		if len(seen) != len(symbols) {
			t.Fatalf("%s: framed %d of %d topics", proto.VenueID(), len(seen), len(symbols))
		}
	}
}
