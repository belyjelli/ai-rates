import { describe, expect, test } from "bun:test";
import { parseVenueSymbol } from "./symbols";

describe("parseVenueSymbol", () => {
  const cases: [string, string, string | null, number, string | null][] = [
    ["BTCUSDT", "BTC", "USDT", 1, null],
    ["btcusdt", "BTC", "USDT", 1, null],
    ["BTC-USDT-SWAP", "BTC", "USDT", 1, null],
    ["BTC_USDT", "BTC", "USDT", 1, null],
    ["BTC-SWAP-USDT", "BTC", "USDT", 1, null],
    ["PERP_ETH_USDC", "ETH", "USDC", 1, null],
    ["BTC_USDC_PERP", "BTC", "USDC", 1, null],
    ["BTC-USD", "BTC", "USD", 1, null],
    ["ETH-PERP", "ETH", null, 1, null],
    ["ETH", "ETH", null, 1, null],
    ["XBTUSDTM", "BTC", "USDT", 1, null],
    ["BTC/USDT:USDT", "BTC", "USDT", 1, null],
    ["1000PEPEUSDT", "PEPE", "USDT", 1000, null],
    ["1000000MOGUSDT", "MOG", "USDT", 1_000_000, null],
    ["kBONK", "BONK", null, 1000, null],
    ["KAVAUSDT", "KAVA", "USDT", 1, null],
    ["1INCHUSDT", "1INCH", "USDT", 1, null],
    ["ETHBUSD", "ETH", "BUSD", 1, null],
    ["xyz:XYZ100", "XYZ100", null, 1, "xyz"],
  ];

  for (const [raw, base, quote, multiplier, dex] of cases) {
    test(raw, () => {
      expect(parseVenueSymbol(raw)).toEqual({ base, quote, multiplier, dex });
    });
  }
});
