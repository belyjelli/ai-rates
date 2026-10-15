import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withLocale } from "./i18n";
import { KCHART_SCRIPT, kBars, kchartData, kRef, LWC_PATH, lwcAsset } from "./kchart";
import { LWC_SOURCE, LWC_VERSION } from "./lwc.generated";

const ROOT = join(import.meta.dir, "../../../..");

describe("the library", () => {
  test("is the pinned version's own file: run apps/worker/scripts/lwc.ts after a bump", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.devDependencies["lightweight-charts"]).toBe(LWC_VERSION);
    const file = readFileSync(
      join(
        ROOT,
        "node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js",
      ),
      "utf8",
    );
    expect(LWC_SOURCE).toBe(file);
    // The licence banner the NOTICE asks for travels with it.
    expect(LWC_SOURCE).toContain("Licensed under Apache License 2.0");
  });

  test("is served at a versioned address, cached for a year, and nowhere else", async () => {
    expect(LWC_PATH).toBe(`/assets/lightweight-charts-${LWC_VERSION}.js`);
    const response = lwcAsset(LWC_PATH);
    expect(response?.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(response?.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(await response?.text()).toBe(LWC_SOURCE);
    expect(lwcAsset("/assets/lightweight-charts.js")).toBeNull();
  });
});

describe("the bars", () => {
  const bar = (over: object) => ({
    bucket_start: new Date(Date.parse("2026-10-12T15:00:00Z")),
    buy_usd: 1_000_000.4,
    sell_usd: 2_000_000.6,
    price: 82_680.3,
    price_venue: "binance",
    price_symbol: "BTCUSDT",
    ...over,
  });

  test("ship as candles, a close standing in where the rest was never stored", () => {
    const at = Date.parse("2026-10-12T15:00:00Z");
    expect(kBars([bar({ open: 82_542, high: 82_770.9, low: 82_539.3 })])).toEqual([
      [at, 82_542, 82_770.9, 82_539.3, 82_680.3, 1_000_000, 2_000_001],
    ]);
    expect(kBars([bar({})])).toEqual([
      [at, 82_680.3, 82_680.3, 82_680.3, 82_680.3, 1_000_000, 2_000_001],
    ]);
    expect(kBars([bar({ price: null, open: 1, high: 1, low: 1 })])).toEqual([
      [at, null, null, null, null, 1_000_000, 2_000_001],
    ]);
  });

  test("name their reference market for the next page", () => {
    expect(kRef([bar({ price_venue: null, price_symbol: null }), bar({})])).toBe("binance:BTCUSDT");
    expect(kRef([bar({ price_venue: null, price_symbol: null })])).toBeNull();
  });

  test("ship with the words in the page's language, unable to close their tag", () => {
    const payload = {
      bar: 900_000,
      count: 96,
      page: 450_000_000,
      floor: 0,
      src: "/data/cvd?asset=BTC&class=crypto&bar=15",
      ref: "x:</script>",
      bars: [],
    };
    const tag = withLocale("zh", () => kchartData(payload));
    expect(tag).not.toContain("x:</script>");
    const body = JSON.parse(tag.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
    expect(body.ref).toBe("x:</script>");
    expect(body.words.older).toBe("正在加载更早的 K 线…");
    expect(body.words.ohlc).toContain("{open}");
  });
});

test("the browser half parses", () => {
  expect(() => new Function(KCHART_SCRIPT)).not.toThrow();
});
