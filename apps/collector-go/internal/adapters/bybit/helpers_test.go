package bybit

import "github.com/belyjelli/ai-rates/collector/internal/adapters"

// adaptersNum builds a present Num for tests that construct wire structs directly rather than
// decoding them. Kept in its own file so bybit_test.go reads as assertions only.
func adaptersNum(v float64) adapters.Num {
	return adapters.Num{Val: v, OK: true}
}
