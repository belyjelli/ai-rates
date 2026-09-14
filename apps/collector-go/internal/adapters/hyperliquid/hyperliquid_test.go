package hyperliquid

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/core"
)

// 2026-09-11T16:38:40Z; the next hourly settlement is 17:00:00Z. The same instants
// hyperliquid.test.ts uses, so both suites pin identical output.
const (
	NOW      int64 = 1_789_147_120_000
	nextHour int64 = 1_789_149_600_000
)

func fixtureDir(tb testing.TB) string {
	tb.Helper()
	dir, err := os.Getwd()
	if err != nil {
		tb.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "packages", "adapters", "__fixtures__", "hyperliquid")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	tb.Fatal("could not find packages/adapters/__fixtures__/hyperliquid above the working directory")
	return ""
}

// The SAME files packages/adapters/src/venues/hyperliquid.test.ts reads.
func load[T any](tb testing.TB, name string, into *T) {
	tb.Helper()
	path := filepath.Join(fixtureDir(tb), name+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("read %s: %v", path, err)
	}
	if err := json.Unmarshal(raw, into); err != nil {
		tb.Fatalf("decode %s: %v", path, err)
	}
}

func eq[T comparable](tb testing.TB, label string, got, want T) {
	tb.Helper()
	if got != want {
		tb.Errorf("%s: got %v, want %v", label, got, want)
	}
}

func f64(tb testing.TB, label string, got *float64) float64 {
	tb.Helper()
	if got == nil {
		tb.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func str(tb testing.TB, label string, got *string) string {
	tb.Helper()
	if got == nil {
		tb.Fatalf("%s: want a value, got nil", label)
	}
	return *got
}

func closeTo(tb testing.TB, label string, got, want, tolerance float64) {
	tb.Helper()
	if diff := got - want; diff > tolerance || diff < -tolerance {
		tb.Errorf("%s: got %v, want %v (within %v)", label, got, want, tolerance)
	}
}

// payloadFor builds a metaAndAssetCtxs for these coins; the ctx numbers are not what the caller
// tests, matching the TypeScript helper of the same name.
func payloadFor(coins []string) MetaAndAssetCtxs {
	payload := MetaAndAssetCtxs{}
	for _, name := range coins {
		payload.Meta.Universe = append(payload.Meta.Universe, UniverseAsset{Name: name})
		var ctx AssetCtx
		_ = ctx.Funding.UnmarshalJSON([]byte(`"0.0000125"`))
		_ = ctx.MarkPx.UnmarshalJSON([]byte(`"1"`))
		payload.Ctxs = append(payload.Ctxs, ctx)
	}
	return payload
}

func symbols(snapshots []core.FundingSnapshot) []string {
	out := make([]string, len(snapshots))
	for i := range snapshots {
		out[i] = snapshots[i].VenueSymbol
	}
	return out
}

// ---- the tuple decoding, which is the Go-specific risk ----

func TestMetaAndAssetCtxsDecodesTheTuple(t *testing.T) {
	var payload MetaAndAssetCtxs
	load(t, "meta-and-asset-ctxs", &payload)

	if len(payload.Meta.Universe) == 0 {
		t.Fatal("universe is empty: the tuple's first element did not decode")
	}
	if len(payload.Ctxs) == 0 {
		t.Fatal("ctxs are empty: the tuple's second element did not decode")
	}
	if len(payload.Meta.MarginTables) == 0 {
		t.Fatal("marginTables did not decode")
	}
	// Each margin table is itself the tuple [id, {marginTiers}].
	for _, table := range payload.Meta.MarginTables {
		if len(table.Tiers) == 0 {
			t.Errorf("margin table %d decoded with no tiers", table.ID)
		}
	}

	// A malformed tuple must fail loudly rather than yield a half-built value.
	var broken MetaAndAssetCtxs
	if err := json.Unmarshal([]byte(`[{"universe":[]}]`), &broken); err == nil {
		t.Error("a 1-element tuple must be rejected")
	}
	if err := json.Unmarshal([]byte(`{"universe":[]}`), &broken); err == nil {
		t.Error("an object must be rejected: metaAndAssetCtxs is a tuple")
	}
}

// ---- core dex ----

func TestParseSnapshotsCoreNormalizesBTCAndSkipsDelisted(t *testing.T) {
	var payload MetaAndAssetCtxs
	load(t, "meta-and-asset-ctxs", &payload)

	usdc := "USDC"
	snapshots := ParseSnapshots("hyperliquid", payload, NOW, &usdc, false, nil)

	got := symbols(snapshots)
	if len(got) != 2 || got[0] != "BTC" || got[1] != "ETH" {
		t.Fatalf("symbols: got %v, want [BTC ETH] — delisted coins must be skipped", got)
	}

	btc := snapshots[0]
	eq(t, "venueId", btc.VenueID, "hyperliquid")
	eq(t, "base", btc.Base, "BTC")
	eq(t, "quote", str(t, "quote", btc.Quote), "USDC")
	eq(t, "multiplier", btc.Multiplier, 1.0)
	eq(t, "assetClass", btc.AssetClass, core.ClassCrypto)
	if btc.Dex != nil {
		t.Errorf("dex: got %v, want nil", *btc.Dex)
	}
	eq(t, "observedAt", btc.ObservedAt, NOW)
	eq(t, "rate", btc.Rate, 0.0000083651)
	// Hyperliquid funding is an hourly rate paid every hour, so basis and interval are both 1h.
	eq(t, "basisHours", btc.BasisHours, 1.0)
	eq(t, "intervalHours", f64(t, "intervalHours", btc.IntervalHours), 1.0)
	if btc.NextFundingAt == nil || *btc.NextFundingAt != nextHour {
		t.Errorf("nextFundingAt: got %v, want %d", btc.NextFundingAt, nextHour)
	}
	eq(t, "kind", btc.Kind, core.KindPredicted)
	eq(t, "markPrice", f64(t, "markPrice", btc.MarkPrice), 77748.0)
	eq(t, "indexPrice", f64(t, "indexPrice", btc.IndexPrice), 77783.3)
	eq(t, "maxLeverage", f64(t, "maxLeverage", btc.MaxLeverage), 40.0)
	closeTo(t, "openInterestUsd", f64(t, "oi", btc.OpenInterestUSD), 35818.6831799999*77748, 0.01)
	closeTo(t, "volume24hUsd", f64(t, "vol", btc.Volume24hUSD), 3571973656.4438381, 0.0001)

	// 0.0000083651 per hour -> 7.3278% simple APR.
	apr, err := core.APRFromRate(btc.Rate, core.UnitFraction, btc.BasisHours)
	if err != nil {
		t.Fatalf("APRFromRate: %v", err)
	}
	closeTo(t, "apr", apr, 7.3278276, 1e-6)
}

// ---- HIP-3 ----

func TestParseSnapshotsHip3KeepsTheMultiplierAdjustedFunding(t *testing.T) {
	var payload MetaAndAssetCtxs
	var spot SpotMeta
	load(t, "xyz-meta-and-asset-ctxs", &payload)
	load(t, "spot-meta", &spot)

	tokens, err := ParseSpotTokenNames(spot)
	if err != nil {
		t.Fatalf("ParseSpotTokenNames: %v", err)
	}
	snapshots := ParseSnapshots("hl-xyz", payload, NOW, Hip3Quote(payload.Meta, tokens), true, nil)

	got := symbols(snapshots)
	if len(got) != 2 || got[0] != "xyz:XYZ100" || got[1] != "xyz:AAPL" {
		t.Fatalf("symbols: got %v, want [xyz:XYZ100 xyz:AAPL]", got)
	}

	first := snapshots[0]
	eq(t, "venueId", first.VenueID, "hl-xyz")
	eq(t, "base", first.Base, "XYZ100")
	// xyz declares collateralToken 0, which spotMeta names USDC.
	eq(t, "quote", str(t, "quote", first.Quote), "USDC")
	eq(t, "dex", str(t, "dex", first.Dex), "xyz")
	// Half the 0.0000125 hourly baseline: xyz's 0.5 funding multiplier is already applied.
	eq(t, "rate", first.Rate, 0.00000625)
	eq(t, "basisHours", first.BasisHours, 1.0)
	closeTo(t, "openInterestUsd", f64(t, "oi", first.OpenInterestUSD), 8837.92*29432, 0.01)

	eq(t, "AAPL rate", snapshots[1].Rate, -0.0000178177)
}

func TestHip3MarketTakesItsDeployersCategoryRefinedByTheBaseTables(t *testing.T) {
	var payload PerpConciseAnnotations
	load(t, "perp-concise-annotations", &payload)
	categories, err := ParsePerpAnnotations(payload)
	if err != nil {
		t.Fatalf("ParsePerpAnnotations: %v", err)
	}

	// Coin names as meta.universe spelt them on 2026-09-14. hyna:GOLD has no annotation.
	coins := []string{
		"xyz:BB", "xyz:QNT", "para:STX", "xyz:SP500", "xyz:GOLD", "xyz:JPY",
		"km:EUR", "para:10Y", "para:AAOI", "io:ANTH", "flx:BTC", "hyna:GOLD",
	}
	snapshots := ParseSnapshots("hl-test", payloadFor(coins), NOW, nil, true, categories)

	want := []struct {
		symbol, base string
		class        core.AssetClass
	}{
		// BlackBerry, Quantinuum and Seagate: named like crypto tickers, declared stocks.
		{"xyz:BB", "BB", core.ClassEquity},
		{"xyz:QNT", "QNT", core.ClassEquity},
		{"para:STX", "STX", core.ClassEquity},
		{"xyz:SP500", "US500", core.ClassIndex},
		{"xyz:GOLD", "XAU", core.ClassCommodity},
		{"xyz:JPY", "JPY", core.ClassFX},
		// Deployers spell freely: "FX" and "stock".
		{"km:EUR", "EUR", core.ClassFX},
		// "rates" is outside the table, so the base tables settle it.
		{"para:10Y", "10Y", core.ClassIndex},
		{"para:AAOI", "AAOI", core.ClassEquity},
		{"io:ANTH", "ANTH", core.ClassEquity},
		{"flx:BTC", "BTC", core.ClassCrypto},
		// No annotation: read as not crypto, never defaulted to crypto.
		{"hyna:GOLD", "XAU", core.ClassCommodity},
	}
	if len(snapshots) != len(want) {
		t.Fatalf("snapshots: got %d, want %d", len(snapshots), len(want))
	}
	for i, w := range want {
		eq(t, w.symbol+" symbol", snapshots[i].VenueSymbol, w.symbol)
		eq(t, w.symbol+" base", snapshots[i].Base, w.base)
		eq(t, w.symbol+" class", snapshots[i].AssetClass, w.class)
	}
}

// A HIP-3 dex whose annotations have NOT loaded must still refuse to default to crypto: that is the
// difference between "validator-listed crypto" and "tradfi we could not label yet", and collapsing
// it would file BlackBerry (xyz:BB) in BounceBit's pool.
func TestHip3WithoutAnnotationsNeverDefaultsToCrypto(t *testing.T) {
	coins := []string{"xyz:BB", "xyz:GOLD", "flx:BTC"}
	snapshots := ParseSnapshots("hl-xyz", payloadFor(coins), NOW, nil, true, nil)
	if len(snapshots) != 3 {
		t.Fatalf("snapshots: got %d, want 3", len(snapshots))
	}
	// The base tables settle each one, exactly as a missing annotation is handled.
	eq(t, "xyz:BB", snapshots[0].AssetClass, core.ClassEquity)
	eq(t, "xyz:GOLD", snapshots[1].AssetClass, core.ClassCommodity)
	// flx:BTC lands on EQUITY here, and that is the rule working rather than failing. An
	// unannotated HIP-3 market is read as not-crypto and handed to the base tables, which know
	// nothing about BTC — so it falls to equity. It becomes crypto only when its deployer says so,
	// which flx does declare; see the annotated case above. Defaulting the unannotated to crypto is
	// precisely what would put xyz:BB (BlackBerry) into BounceBit's pool.
	eq(t, "flx:BTC", snapshots[2].AssetClass, core.ClassEquity)
}

func TestCoreDexIsCryptoWithNoAnnotationsToConsult(t *testing.T) {
	usdc := "USDC"
	snapshots := ParseSnapshots("hyperliquid", payloadFor([]string{"STX", "PURR", "SPX"}), NOW, &usdc, false, nil)
	if len(snapshots) != 3 {
		t.Fatalf("snapshots: got %d, want 3", len(snapshots))
	}
	for _, s := range snapshots {
		eq(t, s.VenueSymbol+" class", s.AssetClass, core.ClassCrypto)
	}
}

func TestHip3DeclaredClassIgnoresCase(t *testing.T) {
	eq(t, "Stocks", Hip3DeclaredClass("Stocks", "AAPL"), core.ClassEquity)
	eq(t, "CRYPTO", Hip3DeclaredClass("CRYPTO", "USDE"), core.ClassCrypto)
	// A category outside the table still says "not crypto", so the base tables settle it.
	eq(t, "constructor", Hip3DeclaredClass("constructor", "NVDA"), core.ClassEquity)
	eq(t, "missing", Hip3DeclaredClass("", "EURUSD"), core.ClassFX)
}

func TestParsePerpAnnotationsSkipsMalformedAndRejectsANonList(t *testing.T) {
	raw := PerpConciseAnnotations{
		json.RawMessage(`["xyz:BB",{"category":"stocks"}]`),
		json.RawMessage(`["xyz:NOCATEGORY",{}]`),
		json.RawMessage(`"garbage"`),
	}
	got, err := ParsePerpAnnotations(raw)
	if err != nil {
		t.Fatalf("ParsePerpAnnotations: %v", err)
	}
	if len(got) != 1 || got["xyz:BB"] != "stocks" {
		t.Errorf("got %v, want only xyz:BB -> stocks", got)
	}

	// A payload that is not a list keeps the caller's last good copy rather than emptying it.
	if _, err := ParsePerpAnnotations(nil); err == nil {
		t.Error("a non-list payload must error")
	}
}

// ---- quote ----

func TestParseSpotTokenNamesKeysByTheDeclaredIndex(t *testing.T) {
	var spot SpotMeta
	load(t, "spot-meta", &spot)
	names, err := ParseSpotTokenNames(spot)
	if err != nil {
		t.Fatalf("ParseSpotTokenNames: %v", err)
	}

	// FUNT is third in the list but declares index 478, as spotMeta served it on 2026-09-14.
	eq(t, "478", names[478], "FUNT")
	if _, present := names[2]; present {
		t.Error("index 2 must be absent: keying by array position would have filled it")
	}

	if _, err := ParseSpotTokenNames(SpotMeta{}); err == nil {
		t.Error("a payload with no token list must error")
	}
}

func TestHip3QuoteNamesTheCollateralToken(t *testing.T) {
	var spot SpotMeta
	load(t, "spot-meta", &spot)
	names, err := ParseSpotTokenNames(spot)
	if err != nil {
		t.Fatalf("ParseSpotTokenNames: %v", err)
	}

	// Each dex's collateralToken on 2026-09-14. No stablecoin is folded into another: USDT0 is not
	// USDT and USDH is not USDC, and a pair across them carries that conversion.
	for _, c := range []struct {
		dex   string
		token int
		want  string
	}{
		{"xyz", 0, "USDC"},
		{"hyna", 235, "USDE"},
		{"cash", 268, "USDT0"},
		{"flx", 360, "USDH"},
	} {
		token := c.token
		got := Hip3Quote(Meta{CollateralToken: &token}, names)
		eq(t, c.dex, str(t, c.dex, got), c.want)
	}

	// A token spotMeta does not name, or a meta declaring none, is unknown rather than guessed.
	unknown := 999
	if got := Hip3Quote(Meta{CollateralToken: &unknown}, names); got != nil {
		t.Errorf("unknown token: got %v, want nil", *got)
	}
	if got := Hip3Quote(Meta{}, names); got != nil {
		t.Errorf("no collateral token: got %v, want nil", *got)
	}
}

// ---- margin tables ----

func TestParseMarginTablesExpandsEachAssetsSharedTable(t *testing.T) {
	var payload MetaAndAssetCtxs
	load(t, "meta-and-asset-ctxs", &payload)
	tiers := ParseMarginTables("hyperliquid", payload.Meta)

	labels := make([]string, len(tiers))
	for i, tier := range tiers {
		labels[i] = fmt.Sprintf("%s:%d", tier.VenueSymbol, tier.Tier)
	}
	want := []string{"BTC:1", "BTC:2", "ETH:1", "ETH:2"}
	if len(labels) != len(want) {
		t.Fatalf("tiers: got %v, want %v", labels, want)
	}
	for i := range want {
		eq(t, "tier", labels[i], want[i])
	}

	// No margin rate is published, so imr is the reciprocal of the leverage cap.
	eq(t, "btc1.lower", tiers[0].LowerNotionalUSD, 0.0)
	eq(t, "btc1.upper", f64(t, "btc1.upper", tiers[0].UpperNotionalUSD), 150_000_000.0)
	eq(t, "btc1.imr", tiers[0].IMR, 1.0/40)
	eq(t, "btc1.maxLeverage", tiers[0].MaxLeverage, 40.0)
	if tiers[0].MMR != nil {
		t.Errorf("btc1.mmr: got %v, want nil — Hyperliquid publishes none", *tiers[0].MMR)
	}

	// The top step is genuinely unbounded: a nil upper bound means "no cap", not "cap unknown".
	eq(t, "btc2.lower", tiers[1].LowerNotionalUSD, 150_000_000.0)
	if tiers[1].UpperNotionalUSD != nil {
		t.Errorf("btc2.upper: got %v, want nil", *tiers[1].UpperNotionalUSD)
	}
	eq(t, "btc2.imr", tiers[1].IMR, 1.0/20)
	eq(t, "btc2.maxLeverage", tiers[1].MaxLeverage, 20.0)

	// Tables are shared, so ETH reads a different one: 25x stepping at $100m.
	eq(t, "eth1.symbol", tiers[2].VenueSymbol, "ETH")
	eq(t, "eth1.upper", f64(t, "eth1.upper", tiers[2].UpperNotionalUSD), 100_000_000.0)
	eq(t, "eth1.maxLeverage", tiers[2].MaxLeverage, 25.0)
}

func TestParseMarginTablesSkipsAnAssetWhoseTableIsAbsent(t *testing.T) {
	var payload MetaAndAssetCtxs
	load(t, "meta-and-asset-ctxs", &payload)

	// MATIC names table 20, which this payload does not carry (and is delisted besides).
	named := false
	for _, asset := range payload.Meta.Universe {
		if asset.MarginTableID != nil && *asset.MarginTableID == 20 {
			named = true
		}
	}
	if !named {
		t.Fatal("the fixture no longer has an asset naming table 20")
	}
	for _, tier := range ParseMarginTables("hyperliquid", payload.Meta) {
		if tier.VenueSymbol == "MATIC" {
			t.Error("MATIC must get no ladder rather than a guess")
		}
	}
}

// ---- dexes and history ----

func TestParsePerpDexsListsHip3NamesWithoutTheCore(t *testing.T) {
	var payload []*PerpDex
	load(t, "perp-dexs", &payload)
	got := ParsePerpDexs(payload)
	if len(got) != 2 || got[0] != "xyz" || got[1] != "flx" {
		t.Errorf("got %v, want [xyz flx] — the core dex is reported as null", got)
	}
}

func TestParseFundingHistorySnapsDedupesAndSorts(t *testing.T) {
	var rows []FundingHistoryRow
	load(t, "funding-history-btc", &rows)

	// Reversed and concatenated: settlements are stamped a few ms after the hour, so snapping is
	// what lets repeated fetches share a key instead of accumulating duplicates.
	shuffled := make([]FundingHistoryRow, 0, len(rows)*2)
	for i := len(rows) - 1; i >= 0; i-- {
		shuffled = append(shuffled, rows[i])
	}
	shuffled = append(shuffled, rows...)

	usdc := "USDC"
	events := ParseFundingHistory("hyperliquid", shuffled, &usdc)

	want := []int64{1_789_138_800_000, 1_789_142_400_000, 1_789_146_000_000}
	if len(events) != len(want) {
		t.Fatalf("events: got %d, want %d", len(events), len(want))
	}
	for i, at := range want {
		eq(t, "settledAt", events[i].SettledAt, at)
	}
	eq(t, "venueId", events[0].VenueID, "hyperliquid")
	eq(t, "venueSymbol", events[0].VenueSymbol, "BTC")
	eq(t, "quote", str(t, "quote", events[0].Quote), "USDC")
	eq(t, "rate", events[0].Rate, 0.0000125)
	eq(t, "basisHours", events[0].BasisHours, 1.0)
	if events[0].MarkPrice != nil {
		t.Errorf("markPrice: got %v, want nil", *events[0].MarkPrice)
	}
}

func TestParseFundingHistoryHip3CoinsKeepTheirDex(t *testing.T) {
	var rows []FundingHistoryRow
	load(t, "funding-history-xyz", &rows)

	events := ParseFundingHistory("hl-xyz", rows, nil)
	if len(events) != 2 {
		t.Fatalf("events: got %d, want 2", len(events))
	}
	eq(t, "venueId", events[1].VenueID, "hl-xyz")
	eq(t, "base", events[1].Base, "XYZ100")
	eq(t, "dex", str(t, "dex", events[1].Dex), "xyz")
	eq(t, "rate", events[1].Rate, 0.00000625)
}
