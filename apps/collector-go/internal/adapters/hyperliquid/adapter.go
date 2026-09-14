package hyperliquid

import (
	"context"
	"sync"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/core"
	"github.com/belyjelli/ai-rates/collector/internal/httpclient"
)

const (
	// Annotations change only when a deployer lists or relabels a market; a quarter-hour lag is
	// harmless.
	annotationsMaxAge = 15 * time.Minute
	annotationsRetry  = time.Minute
	// Spot tokens change only when one is deployed, and a dex's collateral token never changes once
	// set. The response is ~136 KB, which is the other reason it is hourly.
	spotTokensMaxAge = time.Hour
	spotTokensRetry  = time.Minute

	historyPageSize = 500

	// MinInterval: core and every HIP-3 dex share one client. The limit is 1200 weight/min per IP
	// and info requests weigh ~20, so the whole group gets about 55 requests a minute.
	MinInterval = 1100 * time.Millisecond
	// RateLimitGroup is the shared client key; see MinInterval.
	RateLimitGroup = "hyperliquid"
)

// infoCache keeps the last good copy of one info response, shared by a group of adapters.
//
// THE CONTRACT, which is what the tests pin:
//   - One request serves every caller until the copy is due. Ten HIP-3 dexes sweeping together must
//     not send ten identical requests against a shared per-IP weight limit.
//   - A failed OR EMPTY refresh keeps the last good copy and retries after retryAfter. An empty list
//     is a broken response, not a venue with nothing listed.
//   - It never fails the sweep that asked. Before any copy has loaded, callers get the zero value
//     and the caller's own fallback applies.
//
// sync.Once is the wrong primitive here: the single-flight has to be RE-ARMED every refresh window,
// not done once for the process.
type infoCache[K comparable, V any] struct {
	parse  func(context.Context, *httpclient.Client) (map[K]V, error)
	maxAge time.Duration
	retry  time.Duration

	mu        sync.Mutex
	current   map[K]V
	refreshAt time.Time
	pending   chan struct{}
}

func (c *infoCache[K, V]) get(ctx context.Context, client *httpclient.Client, now time.Time) map[K]V {
	c.mu.Lock()
	if now.Before(c.refreshAt) {
		current := c.current
		c.mu.Unlock()
		return current
	}
	if c.pending != nil {
		// A refresh is already in flight; wait on it rather than sending a second request.
		pending := c.pending
		c.mu.Unlock()
		<-pending
		c.mu.Lock()
		current := c.current
		c.mu.Unlock()
		return current
	}
	pending := make(chan struct{})
	c.pending = pending
	c.mu.Unlock()

	parsed, err := c.parse(ctx, client)

	c.mu.Lock()
	// An empty list is a broken response, not a venue with nothing listed — so it is treated as a
	// failure and the last good copy survives.
	if err == nil && len(parsed) > 0 {
		c.current = parsed
		c.refreshAt = now.Add(c.maxAge)
	} else {
		c.refreshAt = now.Add(c.retry)
	}
	current := c.current
	c.pending = nil
	c.mu.Unlock()

	close(pending)
	return current
}

// AnnotationCache holds coin-to-category for every HIP-3 dex. One perpConciseAnnotations response
// covers all of them, so every HIP-3 adapter shares one of these.
type AnnotationCache struct {
	cache *infoCache[string, string]
}

func NewAnnotationCache() *AnnotationCache {
	return &AnnotationCache{cache: &infoCache[string, string]{
		maxAge: annotationsMaxAge,
		retry:  annotationsRetry,
		parse: func(ctx context.Context, client *httpclient.Client) (map[string]string, error) {
			var payload PerpConciseAnnotations
			if err := client.PostJSON(ctx, InfoURL, map[string]string{"type": "perpConciseAnnotations"}, &payload); err != nil {
				return nil, err
			}
			return ParsePerpAnnotations(payload)
		},
	}}
}

func (a *AnnotationCache) Categories(ctx context.Context, client *httpclient.Client, now time.Time) map[string]string {
	return a.cache.get(ctx, client, now)
}

// SpotTokenCache holds token-index-to-name. spotMeta names the token behind every dex's
// collateralToken, so one response serves all HIP-3 adapters.
type SpotTokenCache struct {
	cache *infoCache[int, string]
}

func NewSpotTokenCache() *SpotTokenCache {
	return &SpotTokenCache{cache: &infoCache[int, string]{
		maxAge: spotTokensMaxAge,
		retry:  spotTokensRetry,
		parse: func(ctx context.Context, client *httpclient.Client) (map[int]string, error) {
			var payload SpotMeta
			if err := client.PostJSON(ctx, InfoURL, map[string]string{"type": "spotMeta"}, &payload); err != nil {
				return nil, err
			}
			return ParseSpotTokenNames(payload)
		},
	}}
}

func (s *SpotTokenCache) Names(ctx context.Context, client *httpclient.Client, now time.Time) map[int]string {
	return s.cache.get(ctx, client, now)
}

// Adapter collects one Hyperliquid dex: the core perps, or one HIP-3 builder-deployed dex.
type Adapter struct {
	client  *httpclient.Client
	venueID string
	// dex is empty for the core dex, which sends no `dex` field at all.
	dex string
	// quote is fixed for the core dex (collateralToken 0, which spotMeta names USDC) so it sends no
	// spotMeta request; nil for HIP-3, which looks its collateral up.
	quote       *string
	annotations *AnnotationCache
	spotTokens  *SpotTokenCache
}

// NewCoreAdapter collects Hyperliquid's core perps. They are validator-listed crypto, so no
// annotations are fetched, and the quote is fixed rather than looked up.
func NewCoreAdapter(client *httpclient.Client) *Adapter {
	usdc := "USDC"
	return &Adapter{client: client, venueID: "hyperliquid", quote: &usdc}
}

// NewHip3Adapter collects a HIP-3 builder-deployed dex: venue id hl-<dex>, coins named
// <dex>:<SYMBOL>. Snapshots quote the dex's declared collateral.
func NewHip3Adapter(client *httpclient.Client, dex string, annotations *AnnotationCache, spotTokens *SpotTokenCache) *Adapter {
	return &Adapter{
		client:      client,
		venueID:     "hl-" + dex,
		dex:         dex,
		annotations: annotations,
		spotTokens:  spotTokens,
	}
}

func (a *Adapter) VenueID() string   { return a.venueID }
func (a *Adapter) RequestCount() int { return a.client.RequestCount() }

func (a *Adapter) body(kind string) map[string]string {
	request := map[string]string{"type": kind}
	if a.dex != "" {
		request["dex"] = a.dex
	}
	return request
}

func (a *Adapter) FetchSnapshots(ctx context.Context, now time.Time) (core.SnapshotBatch, error) {
	var payload MetaAndAssetCtxs
	if err := a.client.PostJSON(ctx, InfoURL, a.body("metaAndAssetCtxs"), &payload); err != nil {
		return core.SnapshotBatch{}, err
	}

	// After the main request, so a sweep that is failing anyway spends nothing on either cache.
	var categories map[string]string
	if a.annotations != nil {
		categories = a.annotations.Categories(ctx, a.client, now)
	}
	quote := a.quote
	if quote == nil && a.spotTokens != nil {
		quote = Hip3Quote(payload.Meta, a.spotTokens.Names(ctx, a.client, now))
	}

	// a.dex != "" is the authority on whether this is HIP-3, not whether the annotations loaded.
	return core.SnapshotBatch{
		Snapshots: ParseSnapshots(a.venueID, payload, now.UnixMilli(), quote, a.dex != "", categories),
	}, nil
}

// FetchLeverageTiers reads `meta`, the same payload as the first half of metaAndAssetCtxs, so one
// request covers the whole dex and nothing here is per-symbol.
func (a *Adapter) FetchLeverageTiers(ctx context.Context) ([]core.LeverageTier, bool, error) {
	var meta Meta
	if err := a.client.PostJSON(ctx, InfoURL, a.body("meta"), &meta); err != nil {
		return nil, false, err
	}
	return ParseMarginTables(a.venueID, meta), true, nil
}

// FetchFundingHistory pages forward by the last row's time until a short page.
//
// The quote travels onto core-dex events but not HIP-3 ones: the history request carries no meta to
// read a dex's collateral from, and inventing one would be worse than leaving it unknown.
func (a *Adapter) FetchFundingHistory(ctx context.Context, venueSymbol string, fromMs, toMs int64) ([]core.FundingEvent, error) {
	rows := make([]FundingHistoryRow, 0, historyPageSize)
	startTime := fromMs

	for startTime <= toMs {
		request := map[string]any{
			"type":      "fundingHistory",
			"coin":      venueSymbol,
			"startTime": startTime,
			"endTime":   toMs,
		}
		var page []FundingHistoryRow
		if err := a.client.PostJSON(ctx, InfoURL, request, &page); err != nil {
			return nil, err
		}
		rows = append(rows, page...)
		if len(page) < historyPageSize {
			break
		}
		last := page[len(page)-1]
		if !last.Time.OK {
			break
		}
		startTime = int64(last.Time.Val) + 1
	}

	return ParseFundingHistory(a.venueID, rows, a.quote), nil
}
