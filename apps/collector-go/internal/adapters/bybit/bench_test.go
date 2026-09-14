package bybit

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"testing"
)

// These benchmarks exist because the whole justification for this collector is allocation
// behaviour, and an architectural claim that carries no numbers is an opinion. Run them with:
//
//	make bench
//
// BenchmarkDecodeStreaming vs BenchmarkDecodeBuffered is the direct measurement of the change the
// httpclient package makes: json.Decoder reading straight off the response body, against the
// read-the-whole-body-then-unmarshal shape the TypeScript client uses (`await response.text()` then
// `JSON.parse(text)`), which holds each bulk body twice at peak.
//
// The fixture is small (a handful of markets). The gap is what matters, not the absolute figures —
// in production these bodies carry up to ~1,200 markets and arrive from 56 venues every minute.

func BenchmarkDecodeStreaming(b *testing.B) {
	raw := fixtureBytes(b, "tickers")
	b.SetBytes(int64(len(raw)))
	b.ReportAllocs()
	b.ResetTimer()

	for b.Loop() {
		var env Envelope[Ticker]
		// bytes.Reader stands in for resp.Body: the decoder pulls from the stream and the body is
		// never materialised as one contiguous decoded string.
		if err := json.NewDecoder(bytes.NewReader(raw)).Decode(&env); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkDecodeBuffered(b *testing.B) {
	raw := fixtureBytes(b, "tickers")
	b.SetBytes(int64(len(raw)))
	b.ReportAllocs()
	b.ResetTimer()

	for b.Loop() {
		// The shape being replaced: drain the whole body first, then unmarshal the buffer.
		body, err := io.ReadAll(bytes.NewReader(raw))
		if err != nil {
			b.Fatal(err)
		}
		var env Envelope[Ticker]
		if err := json.Unmarshal(body, &env); err != nil {
			b.Fatal(err)
		}
	}
}

// syntheticTickers builds a wire-shaped tickers response with n markets, with the numeric fields
// QUOTED as the venues actually send them, so the decode does the same string-to-float work a real
// body demands. Written by hand rather than marshalled, because Num decodes from both forms but
// does not encode.
func syntheticTickers(n int) []byte {
	var b bytes.Buffer
	b.WriteString(`{"retCode":0,"retMsg":"OK","result":{"category":"linear","list":[`)
	for i := 0; i < n; i++ {
		if i > 0 {
			b.WriteByte(',')
		}
		fmt.Fprintf(&b, `{"symbol":"SYM%06dUSDT","fundingRate":"0.00004936","nextFundingTime":"1789171200000",`+
			`"markPrice":"77766.70","indexPrice":"77797.59","openInterestValue":"4142076932.53",`+
			`"turnover24h":"6285417277.3039","bid1Price":"77766.70","bid1Size":"0.181",`+
			`"ask1Price":"77766.80","ask1Size":"2.763"}`, i)
	}
	b.WriteString(`]}}`)
	return b.Bytes()
}

// The decode comparison at production scale.
//
// The small-fixture pair above measured BUFFERED as both faster and leaner, which contradicted the
// claim in the httpclient package doc. These run the same comparison at the body sizes that
// actually arrive — bybit lists ~830 linear perps and MEXC ~1,200 — because json.Decoder's internal
// buffer growth amortises differently with size, and a design decision taken on a 5.6 KB fixture
// would be exactly the assume-rather-than-measure mistake this project keeps correcting.

func benchDecode(b *testing.B, raw []byte, streaming bool) {
	b.SetBytes(int64(len(raw)))
	b.ReportAllocs()
	b.ResetTimer()

	for b.Loop() {
		var env Envelope[Ticker]
		if streaming {
			if err := json.NewDecoder(bytes.NewReader(raw)).Decode(&env); err != nil {
				b.Fatal(err)
			}
			continue
		}
		body, err := io.ReadAll(bytes.NewReader(raw))
		if err != nil {
			b.Fatal(err)
		}
		if err := json.Unmarshal(body, &env); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkDecodeStreamingVenueScale(b *testing.B) { benchDecode(b, syntheticTickers(830), true) }
func BenchmarkDecodeBufferedVenueScale(b *testing.B)  { benchDecode(b, syntheticTickers(830), false) }
func BenchmarkDecodeStreamingLarge(b *testing.B)      { benchDecode(b, syntheticTickers(5000), true) }
func BenchmarkDecodeBufferedLarge(b *testing.B)       { benchDecode(b, syntheticTickers(5000), false) }

// BenchmarkParseSnapshots measures the parse path itself on the real fixture.
func BenchmarkParseSnapshots(b *testing.B) {
	var tickers Envelope[Ticker]
	var instruments Envelope[Instrument]
	loadFixture(b, "tickers", &tickers)
	loadFixture(b, "instruments", &instruments)

	b.ReportAllocs()
	b.ResetTimer()

	for b.Loop() {
		if _, err := ParseSnapshots(tickers, instruments.Result.List, NOW); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkParseSnapshotsAtVenueScale repeats the fixture's markets up to roughly the size of a real
// bybit response (~830 linear perps), so the per-market cost is visible rather than lost in fixed
// overhead. Symbols are made unique, because the instrument join is a map lookup and reusing one
// symbol would collapse the work.
func BenchmarkParseSnapshotsAtVenueScale(b *testing.B) {
	var tickers Envelope[Ticker]
	var instruments Envelope[Instrument]
	loadFixture(b, "tickers", &tickers)
	loadFixture(b, "instruments", &instruments)

	const target = 830
	bigTickers := Envelope[Ticker]{RetCode: 0}
	bigInstruments := make([]Instrument, 0, target)

	src := instruments.Result.List
	bySymbol := make(map[string]Instrument, len(src))
	for _, instrument := range src {
		bySymbol[instrument.Symbol] = instrument
	}

	for i := 0; len(bigInstruments) < target; i++ {
		for _, ticker := range tickers.Result.List {
			instrument, ok := bySymbol[ticker.Symbol]
			if !ok {
				continue
			}
			suffix := string(rune('A'+i%26)) + string(rune('A'+(i/26)%26))
			ticker.Symbol += suffix
			instrument.Symbol += suffix
			bigTickers.Result.List = append(bigTickers.Result.List, ticker)
			bigInstruments = append(bigInstruments, instrument)
			if len(bigInstruments) >= target {
				break
			}
		}
	}

	b.ReportAllocs()
	b.ResetTimer()

	for b.Loop() {
		batch, err := ParseSnapshots(bigTickers, bigInstruments, NOW)
		if err != nil {
			b.Fatal(err)
		}
		if len(batch.Snapshots) == 0 {
			b.Fatal("no snapshots parsed")
		}
	}
}
