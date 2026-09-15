package adapters

// scaleOverrides are markets whose contract is quoted at a power of ten of the asset's price, with no
// venue field that says so. Each value is the multiplier to store, so a market's per-unit price is its
// quoted price divided by it: mkts:US500 quotes 759.9 and is stored as 7,599, the S&P 500 itself.
//
// An entry needs the identity check's evidence, never a price ratio alone. The rule in
// plans/symbol-identity-refactor.md is "merge only on return correlation": a clean power-of-ten
// ratio AND minute-return correlation of at least 0.5 (core TRACKING_CORR) against the pool.
// Measured 2026-09-15 over six hours of minute bars:
//
//	hl-mkts mkts:US500    ratio 0.09988 to hl-xyz xyz:SP500, corr 0.821   identity verdict scale, -1
//	okx OPENAI-USDT-SWAP  ratio 0.10214 to bitget OPENAIUSDT, corr 0.804  identity verdict scale, -1
//
// Considered and NOT added, because the evidence falls short:
//
//	okx ANTHROPIC-USDT-SWAP  ratio 0.103, but corr 0.423 against bitget and 0.173 against binance
//	variational US500        ratio 0.0999, but corr 0.01-0.07 against three references: it barely moves
//
// OKX's own instrument metadata says ctVal 1 OPENAI for OPENAI-USDT-SWAP, so nothing the venue
// publishes explains its scale; 18 of 19 venues quote OPENAI at ~1,470 and OKX alone at ~150.
//
// packages/adapters/src/scale.ts holds the same table for the TypeScript adapters, and
// TestScaleOverridesMatchTypeScript keeps the two identical.
var scaleOverrides = map[string]map[string]float64{
	"hl-mkts": {"mkts:US500": 0.1},
	"okx":     {"OPENAI-USDT-SWAP": 0.1},
}

// ScaleOverride returns the factor applied to a market's multiplier when its contract is quoted at a
// power of ten of the asset, and whether one exists.
func ScaleOverride(venueID, venueSymbol string) (float64, bool) {
	scale, ok := scaleOverrides[venueID][venueSymbol]
	return scale, ok
}
