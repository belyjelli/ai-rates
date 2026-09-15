/**
 * Markets whose contract is quoted at a power of ten of the asset's price, with no venue field that says
 * so. Each value is a factor on the market's multiplier, so its per-unit price is the quoted price
 * divided by it: mkts:US500 quotes 759.9 and is stored as 7,599, the S&P 500 itself.
 *
 * An entry needs the identity check's evidence, never a price ratio alone ("merge only on return
 * correlation", plans/symbol-identity-refactor.md): a clean power-of-ten ratio AND minute-return
 * correlation of at least TRACKING_CORR (0.5) against the pool. The measurements behind each entry, and
 * the two candidates rejected for weak correlation, are recorded in
 * apps/collector-go/internal/adapters/scale.go, whose table must stay identical to this one
 * (TestScaleOverridesMatchTypeScript reads this file).
 */
export const SCALE_OVERRIDES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "hl-mkts": { "mkts:US500": 0.1 },
  okx: { "OPENAI-USDT-SWAP": 0.1 },
};

/** The factor on a market's multiplier when its contract is quoted at a power of ten of the asset. */
export function scaleOverride(venueId: string, venueSymbol: string): number | undefined {
  return SCALE_OVERRIDES[venueId]?.[venueSymbol];
}
