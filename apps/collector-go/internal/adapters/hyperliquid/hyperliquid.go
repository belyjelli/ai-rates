// Package hyperliquid covers Hyperliquid's core dex and every HIP-3 builder-deployed dex.
//
// Ported from packages/adapters/src/venues/hyperliquid.ts. One base serves ELEVEN venues: the core
// perps plus ten HIP-3 dexes (hl-xyz, hl-flx, hl-hyna, hl-vntl, hl-km, hl-abcd, hl-cash, hl-para,
// hl-io, hl-mkts), which differ only in the dex passed to the info endpoint and in where their
// asset class and collateral come from.
//
// THE GO-SPECIFIC PROBLEM. Hyperliquid's wire format is TUPLES — `[meta, assetCtxs]`,
// `[coin, {category}]`, `[tableId, {marginTiers}]` — and Go has no tuple type. Each gets a custom
// UnmarshalJSON that decodes a positional array into a named struct, so the rest of the package
// reads fields rather than indices.
package hyperliquid

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/belyjelli/ai-rates/collector/internal/adapters"
	"github.com/belyjelli/ai-rates/collector/internal/core"
)

const (
	InfoURL = "https://api.hyperliquid.xyz/info"
	hourMs  = int64(3_600_000)
)

// UniverseAsset is one row of meta.universe.
type UniverseAsset struct {
	Name       string `json:"name"`
	IsDelisted bool   `json:"isDelisted"`
	// MaxLeverage is the headline figure; meta.marginTables carries the full ladder in this same
	// response.
	MaxLeverage adapters.Num `json:"maxLeverage"`
	// MarginTableID says which entry of marginTables this asset uses; tables are shared across many
	// assets. A pointer because 0 is a real table id and "absent" must not read as it.
	MarginTableID *int `json:"marginTableId"`
}

type MarginTier struct {
	// LowerBound is the position notional in USD at which this step begins.
	LowerBound  adapters.Num `json:"lowerBound"`
	MaxLeverage adapters.Num `json:"maxLeverage"`
}

// MarginTable is serialised as the tuple [id, {description, marginTiers}].
type MarginTable struct {
	ID    int
	Tiers []MarginTier
}

func (t *MarginTable) UnmarshalJSON(data []byte) error {
	var raw []json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("hyperliquid: margin table is not a tuple: %w", err)
	}
	if len(raw) != 2 {
		return fmt.Errorf("hyperliquid: margin table has %d elements, want 2", len(raw))
	}
	if err := json.Unmarshal(raw[0], &t.ID); err != nil {
		return err
	}
	var body struct {
		MarginTiers []MarginTier `json:"marginTiers"`
	}
	if err := json.Unmarshal(raw[1], &body); err != nil {
		return err
	}
	t.Tiers = body.MarginTiers
	return nil
}

type Meta struct {
	Universe     []UniverseAsset `json:"universe"`
	MarginTables []MarginTable   `json:"marginTables"`
	// CollateralToken is the spot token the dex margins and settles in, by spotMeta.tokens[].index.
	// A pointer because token 0 is USDC, a real value that must not be confused with absence.
	CollateralToken *int `json:"collateralToken"`
}

type AssetCtx struct {
	Funding      adapters.Num `json:"funding"`
	OpenInterest adapters.Num `json:"openInterest"`
	MarkPx       adapters.Num `json:"markPx"`
	OraclePx     adapters.Num `json:"oraclePx"`
	DayNtlVlm    adapters.Num `json:"dayNtlVlm"`
}

// MetaAndAssetCtxs is serialised as the tuple [meta, assetCtxs].
type MetaAndAssetCtxs struct {
	Meta Meta
	Ctxs []AssetCtx
}

func (m *MetaAndAssetCtxs) UnmarshalJSON(data []byte) error {
	var raw []json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("hyperliquid: metaAndAssetCtxs is not a tuple: %w", err)
	}
	if len(raw) != 2 {
		return fmt.Errorf("hyperliquid: metaAndAssetCtxs has %d elements, want 2", len(raw))
	}
	if err := json.Unmarshal(raw[0], &m.Meta); err != nil {
		return err
	}
	return json.Unmarshal(raw[1], &m.Ctxs)
}

// SpotMeta, trimmed to what the quote lookup reads.
type SpotMeta struct {
	Tokens []struct {
		Name  string `json:"name"`
		Index *int   `json:"index"`
	} `json:"tokens"`
}

// PerpConciseAnnotations is `[coin, {category}]` for every annotated HIP-3 market on every dex, with
// the coin spelt exactly as meta.universe spells it (`xyz:BB`). Held as raw entries so a malformed
// one can be skipped rather than failing the whole payload, which is what the TypeScript does.
type PerpConciseAnnotations []json.RawMessage

// PerpDex is one entry of perpDexs; the first is the core dex, reported as null.
type PerpDex struct {
	Name     string `json:"name"`
	FullName string `json:"fullName"`
}

// hl3CategoryClasses is what a HIP-3 deployer's `category` annotation declares.
//
// On 2026-09-14 one response covered 200 markets across seven dexes: stocks 131, indices 26,
// commodities 23, crypto 7, preipo 5 and fx 5, plus one each of `FX` (km:EUR), `stock` (para:AAOI)
// and `rates` (para:10Y). Deployers spell freely, so matching ignores case.
var hip3CategoryClasses = map[string]core.AssetClass{
	"commodities": core.ClassCommodity,
	"crypto":      core.ClassCrypto,
	"fx":          core.ClassFX,
	"indices":     core.ClassIndex,
	"preipo":      core.ClassEquity,
	"stock":       core.ClassEquity,
	"stocks":      core.ClassEquity,
}

// Hip3DeclaredClass is the declared class of a HIP-3 market, from its annotation category.
//
// A category outside the table (`rates`) still says "not crypto" — a deployer that meant crypto
// writes `crypto`, as flx does for flx:BTC — so the base tables settle it: para:10Y lands on index.
// A MISSING annotation is read the same way. HIP-3 dexes exist to list tradfi, and on 2026-09-14
// every live HIP-3 market was annotated; only delisted ones lacked an entry. Defaulting those to
// crypto would put xyz:BB (BlackBerry) in BounceBit's pool.
//
// The core dex never comes here: its perps are validator-listed crypto and carry no annotations.
func Hip3DeclaredClass(category string, base string) core.AssetClass {
	if category != "" {
		if class, ok := hip3CategoryClasses[strings.ToLower(strings.TrimSpace(category))]; ok {
			return class
		}
	}
	return core.ClassifyNonCrypto(base)
}

// ParsePerpAnnotations maps coin to category. Errors on a payload that is not a list, so the caller
// keeps its last good copy; individual malformed entries are skipped.
func ParsePerpAnnotations(payload PerpConciseAnnotations) (map[string]string, error) {
	if payload == nil {
		return nil, fmt.Errorf("hyperliquid: perpConciseAnnotations is not a list")
	}
	categories := make(map[string]string, len(payload))
	for _, entry := range payload {
		var pair []json.RawMessage
		if err := json.Unmarshal(entry, &pair); err != nil || len(pair) != 2 {
			continue
		}
		var coin string
		if err := json.Unmarshal(pair[0], &coin); err != nil || coin == "" {
			continue
		}
		var annotation struct {
			Category *string `json:"category"`
		}
		if err := json.Unmarshal(pair[1], &annotation); err != nil || annotation.Category == nil {
			continue
		}
		categories[coin] = *annotation.Category
	}
	return categories, nil
}

// ParseSpotTokenNames maps token index to name. Errors on a payload without a token list, so the
// caller keeps its last good copy.
//
// Keyed by the DECLARED index, never the array position: on 2026-09-14, 43 of 501 tokens sat
// somewhere other than their index (FUNT, index 478, at position 458).
func ParseSpotTokenNames(payload SpotMeta) (map[int]string, error) {
	if payload.Tokens == nil {
		return nil, fmt.Errorf("hyperliquid: spotMeta has no token list")
	}
	names := make(map[int]string, len(payload.Tokens))
	for _, token := range payload.Tokens {
		if token.Index != nil && token.Name != "" {
			names[*token.Index] = token.Name
		}
	}
	return names, nil
}

// Hip3Quote is the currency a dex settles in: its collateralToken, named as spotMeta names it.
//
// The venue's spelling is kept. On 2026-09-14 xyz, para, io, mkts and abcd settled in USDC (0), flx,
// km and vntl in USDH (360), cash in USDT0 (268) and hyna in USDE (235) — USDT0 is not USDT and USDH
// is not USDC, and a pair across them carries that conversion. Nil when either side is unknown.
func Hip3Quote(meta Meta, tokenNames map[int]string) *string {
	if meta.CollateralToken == nil {
		return nil
	}
	name, known := tokenNames[*meta.CollateralToken]
	if !known {
		return nil
	}
	return &name
}

// ParseMarginTables builds risk ladders from meta.marginTables, which arrives in a call the
// collector already makes.
//
// Hyperliquid shares a handful of tables across every asset (seven cover 234 coins), so an asset
// points at one by marginTableId. A tier gives only a lowerBound in USD notional and a max leverage,
// so each band ends where the next begins and the top one is genuinely UNBOUNDED — Hyperliquid
// publishes no maximum position size, unlike Bybit and OKX, so a nil upper bound here means "no cap"
// rather than "cap unknown".
//
// There is no published margin rate, so imr is the reciprocal of the leverage cap.
func ParseMarginTables(venueID string, meta Meta) []core.LeverageTier {
	tables := make(map[int][]MarginTier, len(meta.MarginTables))
	for _, table := range meta.MarginTables {
		tables[table.ID] = table.Tiers
	}

	ladders := make([]core.LeverageTier, 0, len(meta.Universe))
	for _, asset := range meta.Universe {
		if asset.IsDelisted || asset.MarginTableID == nil {
			continue
		}
		// An asset can name a table the response did not carry; it gets no ladder rather than a
		// guess.
		tiers, known := tables[*asset.MarginTableID]
		if !known || len(tiers) == 0 {
			continue
		}

		sorted := make([]MarginTier, len(tiers))
		copy(sorted, tiers)
		sort.SliceStable(sorted, func(i, j int) bool {
			return sorted[i].LowerBound.Val < sorted[j].LowerBound.Val
		})

		ladder := make([]core.LeverageTier, 0, len(sorted))
		usable := true
		for i, step := range sorted {
			lower, maxLeverage := step.LowerBound, step.MaxLeverage
			var upper *float64
			if i+1 < len(sorted) {
				upper = sorted[i+1].LowerBound.Ptr()
			}
			if !lower.OK || !maxLeverage.OK || maxLeverage.Val <= 0 ||
				(upper != nil && *upper <= lower.Val) {
				usable = false
				break
			}
			ladder = append(ladder, core.LeverageTier{
				VenueID:          venueID,
				VenueSymbol:      asset.Name,
				Tier:             i + 1,
				LowerNotionalUSD: lower.Val,
				UpperNotionalUSD: upper,
				IMR:              1 / maxLeverage.Val,
				MMR:              nil,
				MaxLeverage:      maxLeverage.Val,
			})
		}
		if usable {
			ladders = append(ladders, ladder...)
		}
	}
	return ladders
}

// ParseSnapshots normalises metaAndAssetCtxs.
//
// Hyperliquid funding is an hourly rate paid every hour, so both the basis and the interval are 1h.
// For HIP-3 dexes `funding` ALREADY includes the dex's per-asset funding multiplier: with a 0.5
// multiplier xyz:XYZ100 reports 0.00000625, half the 0.0000125 hourly baseline, and assets with a
// 0.0 multiplier report 0.0.
//
// hip3 says whether this is a builder-deployed dex, and categories is its annotation map.
//
// THE FLAG IS SEPARATE FROM THE MAP ON PURPOSE. An earlier version inferred "is this HIP-3" from
// `categories != nil`, which conflated two different states: a CORE dex, whose perps are
// validator-listed crypto, and a HIP-3 dex whose annotations have not loaded yet. The second took
// the core path and declared everything crypto — which would put xyz:BB (BlackBerry) into
// BounceBit's pool the first time the annotations endpoint was briefly unreachable, the exact
// collision the identity work exists to prevent. A HIP-3 market with no annotation must fall to
// Hip3DeclaredClass's not-crypto rule, never to crypto.
func ParseSnapshots(
	venueID string,
	payload MetaAndAssetCtxs,
	now int64,
	quote *string,
	hip3 bool,
	categories map[string]string,
) []core.FundingSnapshot {
	nextFundingAt := now/hourMs*hourMs + hourMs
	snapshots := make([]core.FundingSnapshot, 0, len(payload.Meta.Universe))

	for i, asset := range payload.Meta.Universe {
		if asset.IsDelisted || i >= len(payload.Ctxs) {
			continue
		}
		ctx := payload.Ctxs[i]
		if !ctx.Funding.OK {
			continue
		}

		class := core.ClassCrypto
		if hip3 {
			class = Hip3DeclaredClass(categories[asset.Name], core.ParseVenueSymbol(asset.Name).Base)
		}

		overrides := adapters.Overrides{AssetClass: &class}
		if quote != nil {
			overrides.Quote = quote
			overrides.HasQuote = true
		}

		markPrice := ctx.MarkPx.Ptr()
		hour := 1.0
		settlement := nextFundingAt

		snapshots = append(snapshots, core.FundingSnapshot{
			MarketRef:       adapters.MarketRefFor(venueID, asset.Name, overrides),
			ObservedAt:      now,
			Rate:            ctx.Funding.Val,
			BasisHours:      1,
			IntervalHours:   &hour,
			NextFundingAt:   &settlement,
			Kind:            core.KindPredicted,
			MarkPrice:       markPrice,
			IndexPrice:      ctx.OraclePx.Ptr(),
			OpenInterestUSD: adapters.Mul(ctx.OpenInterest.Ptr(), markPrice),
			Volume24hUSD:    ctx.DayNtlVlm.Ptr(),
			MaxLeverage:     asset.MaxLeverage.Ptr(),
		})
	}
	return snapshots
}

// ParsePerpDexs lists the HIP-3 dex names, without the core entry (which is reported as null).
func ParsePerpDexs(payload []*PerpDex) []string {
	names := make([]string, 0, len(payload))
	for _, dex := range payload {
		if dex != nil && dex.Name != "" {
			names = append(names, dex.Name)
		}
	}
	return names
}

type FundingHistoryRow struct {
	Coin        string       `json:"coin"`
	FundingRate adapters.Num `json:"fundingRate"`
	Premium     adapters.Num `json:"premium"`
	Time        adapters.Num `json:"time"`
}

// ParseFundingHistory normalises fundingHistory rows into settled hourly payments, oldest first.
func ParseFundingHistory(venueID string, rows []FundingHistoryRow, quote *string) []core.FundingEvent {
	overrides := adapters.Overrides{}
	if quote != nil {
		overrides.Quote = quote
		overrides.HasQuote = true
	}

	byHour := make(map[int64]core.FundingEvent, len(rows))
	for _, row := range rows {
		if !row.FundingRate.OK || !row.Time.OK {
			continue
		}
		// Settlements are stamped a few ms after the hour; snap so repeated fetches share a key.
		settledAt := int64(row.Time.Val) / hourMs * hourMs
		byHour[settledAt] = core.FundingEvent{
			MarketRef:  adapters.MarketRefFor(venueID, row.Coin, overrides),
			SettledAt:  settledAt,
			Rate:       row.FundingRate.Val,
			BasisHours: 1,
			MarkPrice:  nil,
		}
	}

	settlements := make([]int64, 0, len(byHour))
	for at := range byHour {
		settlements = append(settlements, at)
	}
	sort.Slice(settlements, func(i, j int) bool { return settlements[i] < settlements[j] })

	events := make([]core.FundingEvent, 0, len(settlements))
	for _, at := range settlements {
		events = append(events, byHour[at])
	}
	return events
}
