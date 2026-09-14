package collector_test

// Compile-time proof that every adapter with a history, tier or liquidation endpoint satisfies the
// interfaces the sweeps take. Without it, a signature drift in one adapter would only surface when
// main.go's type assertion quietly returned false and that venue's sweep never ran — no error, just
// history that stopped growing.
//
// Enumerated from `grep -rn "func (a \*Adapter) Fetch" internal/adapters` on 2026-09-15: 35 history,
// 7 tier and 2 liquidation implementations. binancefapi covers aster, binance, weex and bullet;
// hyperliquid covers the core dex and every HIP-3 dex; lighter covers mainnet and RH.

import (
	"github.com/belyjelli/ai-rates/collector/internal/adapters/aevo"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/apex"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/arcus"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/backpack"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/binancefapi"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/bingx"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/bitget"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/bitmart"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/bluefin"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/bybit"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/dydx"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/edgexv2"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/extended"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/gate"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/grvt"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/hibachi"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/hotcoin"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/htx"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/hyperliquid"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/kucoin"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/lighter"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/mexc"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/nado"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/okx"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/ondo"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/orderly"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/pacifica"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/phoenix"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/pionex"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/polymarket"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/risex"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/standx"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/toobit"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/velocity"
	"github.com/belyjelli/ai-rates/collector/internal/adapters/zero1"
	"github.com/belyjelli/ai-rates/collector/internal/collector"
)

var (
	_ collector.HistoryFetcher = (*aevo.Adapter)(nil)
	_ collector.HistoryFetcher = (*apex.Adapter)(nil)
	_ collector.HistoryFetcher = (*arcus.Adapter)(nil)
	_ collector.HistoryFetcher = (*backpack.Adapter)(nil)
	_ collector.HistoryFetcher = (*binancefapi.Adapter)(nil)
	_ collector.HistoryFetcher = (*bingx.Adapter)(nil)
	_ collector.HistoryFetcher = (*bitget.Adapter)(nil)
	_ collector.HistoryFetcher = (*bitmart.Adapter)(nil)
	_ collector.HistoryFetcher = (*bluefin.Adapter)(nil)
	_ collector.HistoryFetcher = (*bybit.Adapter)(nil)
	_ collector.HistoryFetcher = (*dydx.Adapter)(nil)
	_ collector.HistoryFetcher = (*edgexv2.Adapter)(nil)
	_ collector.HistoryFetcher = (*extended.Adapter)(nil)
	_ collector.HistoryFetcher = (*gate.Adapter)(nil)
	_ collector.HistoryFetcher = (*grvt.Adapter)(nil)
	_ collector.HistoryFetcher = (*hibachi.Adapter)(nil)
	_ collector.HistoryFetcher = (*hotcoin.Adapter)(nil)
	_ collector.HistoryFetcher = (*htx.Adapter)(nil)
	_ collector.HistoryFetcher = (*hyperliquid.Adapter)(nil)
	_ collector.HistoryFetcher = (*kucoin.Adapter)(nil)
	_ collector.HistoryFetcher = (*lighter.Adapter)(nil)
	_ collector.HistoryFetcher = (*mexc.Adapter)(nil)
	_ collector.HistoryFetcher = (*nado.Adapter)(nil)
	_ collector.HistoryFetcher = (*okx.Adapter)(nil)
	_ collector.HistoryFetcher = (*ondo.Adapter)(nil)
	_ collector.HistoryFetcher = (*orderly.Adapter)(nil)
	_ collector.HistoryFetcher = (*pacifica.Adapter)(nil)
	_ collector.HistoryFetcher = (*phoenix.Adapter)(nil)
	_ collector.HistoryFetcher = (*pionex.Adapter)(nil)
	_ collector.HistoryFetcher = (*polymarket.Adapter)(nil)
	_ collector.HistoryFetcher = (*risex.Adapter)(nil)
	_ collector.HistoryFetcher = (*standx.Adapter)(nil)
	_ collector.HistoryFetcher = (*toobit.Adapter)(nil)
	_ collector.HistoryFetcher = (*velocity.Adapter)(nil)
	_ collector.HistoryFetcher = (*zero1.Adapter)(nil)

	_ collector.TierFetcher = (*bybit.Adapter)(nil)
	_ collector.TierFetcher = (*dydx.Adapter)(nil)
	_ collector.TierFetcher = (*gate.Adapter)(nil)
	_ collector.TierFetcher = (*hyperliquid.Adapter)(nil)
	_ collector.TierFetcher = (*kucoin.Adapter)(nil)
	_ collector.TierFetcher = (*mexc.Adapter)(nil)
	_ collector.TierFetcher = (*okx.Adapter)(nil)

	_ collector.LiquidationFetcher = (*gate.Adapter)(nil)
	_ collector.LiquidationFetcher = (*okx.Adapter)(nil)
)
