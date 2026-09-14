package adapters

import (
	"encoding/json"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

func TestNumDecodesBothWireForms(t *testing.T) {
	// Venues send numerics as quoted strings, as bare numbers, as empty strings and as null, often
	// within one response. All four must decode, and only a real value may read as present.
	cases := []struct {
		raw  string
		val  float64
		ok   bool
		what string
	}{
		{`"0.00004936"`, 0.00004936, true, "quoted"},
		{`0.00004936`, 0.00004936, true, "bare"},
		{`"-0.00022725"`, -0.00022725, true, "negative"},
		{`""`, 0, false, "empty string"},
		{`null`, 0, false, "null"},
		{`"not a number"`, 0, false, "garbage"},
		{`"0"`, 0, true, "a real zero is present, not absent"},
	}
	for _, c := range cases {
		var n Num
		if err := json.Unmarshal([]byte(c.raw), &n); err != nil {
			t.Errorf("%s: unexpected error %v", c.what, err)
			continue
		}
		if n.OK != c.ok || (c.ok && n.Val != c.val) {
			t.Errorf("%s: got {%v %v}, want {%v %v}", c.what, n.Val, n.OK, c.val, c.ok)
		}
	}
}

func TestNumAbsentIsNotZero(t *testing.T) {
	// The distinction that matters: an absent open interest must not read as "this market has no
	// open interest", which is how a whole venue once vanished behind the default OI filter.
	var missing Num
	if missing.Ptr() != nil {
		t.Error("an unset Num must produce a nil pointer, not a zero")
	}
	var zero Num
	if err := json.Unmarshal([]byte(`0`), &zero); err != nil {
		t.Fatal(err)
	}
	if zero.Ptr() == nil || *zero.Ptr() != 0 {
		t.Error("a decoded zero must be present with value 0")
	}
}

func TestMulIsAbsentIfAnyFactorIs(t *testing.T) {
	size, price := 0.181, 77766.7
	if got := Mul(&size, &price); got == nil || *got != size*price {
		t.Errorf("got %v, want %v", got, size*price)
	}
	// Reporting the known half would be worse than reporting nothing: a size column exists to say
	// how thin a quote is.
	if got := Mul(&size, nil); got != nil {
		t.Errorf("got %v, want nil when a factor is absent", got)
	}
	if got := Mul(); got == nil || *got != 1 {
		t.Errorf("empty product: got %v, want 1", got)
	}
}

func TestPositiveMsTreatsZeroAsAbsent(t *testing.T) {
	// Venues send 0 for "no next funding" rather than omitting the field.
	var zero, real Num
	_ = json.Unmarshal([]byte(`"0"`), &zero)
	_ = json.Unmarshal([]byte(`"1789171200000"`), &real)

	if zero.PositiveMs() != nil {
		t.Error("zero must read as absent")
	}
	if got := real.PositiveMs(); got == nil || *got != 1_789_171_200_000 {
		t.Errorf("got %v, want 1789171200000", got)
	}
}

func TestSelectRefreshBatchTakesUnfetchedFirstThenStalest(t *testing.T) {
	const maxAge = int64(5 * 60_000)
	now := int64(10_000_000)

	symbols := []string{"A", "B", "C", "D"}
	cache := map[string]int64{
		"A": now - maxAge - 2_000, // stale, and the older of the two
		"B": now - 1_000,          // fresh
		"C": now - maxAge - 1_000, // stale
		// D has never been fetched.
	}
	lookup := func(symbol string) (int64, bool) {
		at, ok := cache[symbol]
		return at, ok
	}

	// Never-fetched first, whatever the venue's ordering, then the stalest.
	got := SelectRefreshBatch(symbols, lookup, now, 10, maxAge)
	want := []string{"D", "A", "C"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}

	// The budget is what keeps one cycle from stalling on hundreds of per-symbol calls.
	if got := SelectRefreshBatch(symbols, lookup, now, 1, maxAge); len(got) != 1 || got[0] != "D" {
		t.Errorf("budget 1: got %v, want [D]", got)
	}
	if got := SelectRefreshBatch(symbols, lookup, now, 0, maxAge); got != nil {
		t.Errorf("budget 0: got %v, want nothing", got)
	}

	// Nothing stale and nothing new means no requests at all.
	allFresh := func(string) (int64, bool) { return now, true }
	if got := SelectRefreshBatch(symbols, allFresh, now, 10, maxAge); len(got) != 0 {
		t.Errorf("all fresh: got %v, want nothing", got)
	}
}

func TestBasisHoursFromGaps(t *testing.T) {
	t0 := int64(1_789_027_200_000)
	const hour = int64(3_600_000)

	show := func(values []*float64) []float64 {
		out := make([]float64, len(values))
		for i, v := range values {
			if v == nil {
				out[i] = -1
				continue
			}
			out[i] = *v
		}
		return out
	}
	same := func(label string, got []float64, want ...float64) {
		t.Helper()
		if len(got) != len(want) {
			t.Fatalf("%s: got %v, want %v", label, got, want)
		}
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("%s: got %v, want %v", label, got, want)
				return
			}
		}
	}

	same("regular 8h", show(BasisHoursFromGaps([]int64{t0, t0 + 8*hour, t0 + 24*hour, t0 + 32*hour}, nil)), 8, 8, 8, 8)
	// The rule that matters: taking the NEAREST neighbour's gap means a missed settlement cannot
	// double its neighbour's basis. Here the interval genuinely shortens to 4h and every row after
	// the change reads 4, not 8.
	same("shortening", show(BasisHoursFromGaps([]int64{t0, t0 + 8*hour, t0 + 12*hour, t0 + 16*hour}, nil)), 8, 4, 4, 4)

	four := 4.0
	same("lone settlement with a fallback", show(BasisHoursFromGaps([]int64{t0}, &four)), 4)
	// No gap and no stated interval: absent, never invented.
	same("lone settlement with none", show(BasisHoursFromGaps([]int64{t0}, nil)), -1)
}

func TestResolveDeclaredBase(t *testing.T) {
	cases := []struct {
		coin, name, want, why string
	}{
		{"BTC", "", "BTC", "no display name keeps the code"},
		{"BTC", "BTC", "BTC", "identical name keeps the code"},
		// The rename that matters: the contract code is MUSTOCK, the underlying is MU.
		{"MUSTOCK", "MU", "MU", "a clean ticker wins"},
		// Prose carries the canonical ticker in the parenthetical.
		{"GOLD", "GOLD(XAU)", "XAU", "parenthesised ticker is preferred"},
		{"OIL", "OIL(WTI)", "WTI", "parenthesised ticker is preferred"},
		// A display name that is neither a ticker nor parenthesised falls back to the code.
		{"LOBSTER", "龙虾", "LOBSTER", "CJK prose falls back to the code"},
		{"X", "some long description", "X", "prose falls back to the code"},
		{" BTC ", " BTC ", "BTC", "both sides are trimmed"},
	}
	for _, c := range cases {
		if got := ResolveDeclaredBase(c.coin, c.name); got != c.want {
			t.Errorf("%s: ResolveDeclaredBase(%q, %q) = %q, want %q", c.why, c.coin, c.name, got, c.want)
		}
	}
}

func TestMarketRefOverridesAndRefinement(t *testing.T) {
	// A declared base still goes through the alias map, or it re-splits the very pools that map
	// exists to join: MEXC declares the S&P 500 as SP500, which has to reach US500.
	declared := "SP500"
	ref := MarketRefFor("mexc", "SP500_USDT", Overrides{Base: &declared})
	if ref.Base != "US500" {
		t.Errorf("declared base: got %q, want US500", ref.Base)
	}

	// An explicitly nil quote is a VALUE, not an absence: Hyperliquid HIP-3 dexes and Lighter never
	// set one, and restoring a parsed quote there would invent a settlement currency.
	ref = MarketRefFor("hl-xyz", "xyz:XYZ100", Overrides{HasQuote: true, Quote: nil})
	if ref.Quote != nil {
		t.Errorf("explicit nil quote: got %v, want nil", *ref.Quote)
	}
	if ref.Dex == nil || *ref.Dex != "xyz" {
		t.Errorf("dex: got %v, want xyz", ref.Dex)
	}

	// Crypto is final: a venue's declaration is never overridden from the ticker. SPX is the
	// SPX6900 token at ~$0.486, not the S&P 500 index.
	crypto := core.ClassCrypto
	ref = MarketRefFor("bybit", "SPXUSDT", Overrides{AssetClass: &crypto})
	if ref.AssetClass != crypto || ref.Base != "SPX" {
		t.Errorf("got %s:%s, want crypto:SPX", ref.AssetClass, ref.Base)
	}
}
