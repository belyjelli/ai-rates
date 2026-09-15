package adapters

import (
	"os"
	"regexp"
	"strconv"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

func TestMarketRefAppliesScaleOverrides(t *testing.T) {
	cases := []struct {
		venue, symbol string
		base          string
		multiplier    float64
	}{
		{"hl-mkts", "mkts:US500", "US500", 0.1},
		{"okx", "OPENAI-USDT-SWAP", "OPENAI", 0.1},
		// Neighbours stay unscaled: the table is keyed by exact market, never by base or venue.
		{"hl-xyz", "xyz:SP500", "US500", 1},
		{"okx", "ANTHROPIC-USDT-SWAP", "ANTHROPIC", 1},
		{"okx", "BTC-USDT-SWAP", "BTC", 1},
	}
	for _, c := range cases {
		ref := MarketRefFor(c.venue, c.symbol, Overrides{})
		if ref.Base != c.base || ref.Multiplier != c.multiplier {
			t.Errorf("%s %s: base %q multiplier %v, want %q and %v", c.venue, c.symbol, ref.Base, ref.Multiplier, c.base, c.multiplier)
		}
	}

	// The per-unit price the store writes is what joins the market to its pool.
	ref := MarketRefFor("hl-mkts", "mkts:US500", Overrides{})
	quoted := 759.89
	if got := *core.PerUnitPrice(&quoted, ref.Multiplier); got < 7598 || got > 7599.1 {
		t.Errorf("per-unit price %v, want the index level ~7,598.9", got)
	}
}

// TestScaleOverridesMatchTypeScript keeps this table and packages/adapters/src/scale.ts identical, by
// reading the TypeScript source: Go cannot import it, and a scale applied on one side only would make
// the two collectors store the same market at prices ten times apart.
func TestScaleOverridesMatchTypeScript(t *testing.T) {
	const path = "../../../../packages/adapters/src/scale.ts"
	source, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		t.Skipf("%s not found; this check needs the whole repository", path)
	}
	if err != nil {
		t.Fatal(err)
	}

	venue := regexp.MustCompile(`(?m)^\s*"?([a-z0-9-]+)"?:\s*\{([^}]*)\}`)
	entry := regexp.MustCompile(`"([^"]+)":\s*([0-9.]+)`)
	want := map[string]map[string]float64{}
	for _, v := range venue.FindAllStringSubmatch(string(source), -1) {
		for _, e := range entry.FindAllStringSubmatch(v[2], -1) {
			value, err := strconv.ParseFloat(e[2], 64)
			if err != nil {
				t.Fatalf("%s %s: %v", v[1], e[1], err)
			}
			if want[v[1]] == nil {
				want[v[1]] = map[string]float64{}
			}
			want[v[1]][e[1]] = value
		}
	}
	if len(want) == 0 {
		t.Fatal("found no entries in scale.ts; the pattern no longer matches its layout")
	}

	count := func(m map[string]map[string]float64) int {
		n := 0
		for _, symbols := range m {
			n += len(symbols)
		}
		return n
	}
	if count(want) != count(scaleOverrides) {
		t.Errorf("TypeScript has %d scale overrides, Go has %d", count(want), count(scaleOverrides))
	}
	for venueID, symbols := range want {
		for symbol, value := range symbols {
			if got, ok := ScaleOverride(venueID, symbol); !ok || got != value {
				t.Errorf("%s %s: TypeScript %v, Go %v (present %v)", venueID, symbol, value, got, ok)
			}
		}
	}
}
