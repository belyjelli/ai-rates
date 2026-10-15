import { describe, expect, test } from "bun:test";
import { withLocale } from "./i18n";
import { formatTime, localTimeScript, timeTag, timeTitle, timeWords } from "./localtime";
import { candleText, SLOT_FORMAT, slotWhen, slotWords } from "./slot-chart";

// The reported case (2026-10-16): Binance's 15:00 UTC candle, read by someone in Beijing.
const CANDLE = Date.parse("2026-10-12T15:00:00Z");
const BEIJING = 8 * 60;

describe("formatTime", () => {
  const w = timeWords();

  test("a moment in the reader's zone, named", () => {
    expect(formatTime(CANDLE, "when", 0, w, 0)).toBe("Oct 12 15:00 UTC");
    expect(formatTime(CANDLE, "when", BEIJING, w, 0)).toBe("Oct 12 23:00 UTC+8");
    expect(formatTime(CANDLE, "mdhm", -240, w, 0)).toBe("Oct 12 11:00");
    expect(formatTime(0, "zone", 330, w, 0)).toBe("UTC+5:30");
    expect(formatTime(0, "zone", -180, w, 0)).toBe("UTC-3");
    expect(formatTime(0, "zone", 0, w, 0)).toBe("UTC");
  });

  test("an axis tick names the date on the day's first tick, in the reader's day", () => {
    const midnightUtc = Date.parse("2026-10-13T00:00:00Z");
    expect(formatTime(midnightUtc, "tick", 0, w, 4)).toBe("Oct 13");
    // 00:00 UTC is 08:00 in Beijing: a plain hour there, and 16:00 UTC is the next local midnight.
    expect(formatTime(midnightUtc, "tick", BEIJING, w, 4)).toBe("08:00");
    expect(formatTime(Date.parse("2026-10-12T16:00:00Z"), "tick", BEIJING, w, 4)).toBe("Oct 13");
    // Daily ticks on UTC midnights all name their date, whatever the zone.
    expect(formatTime(midnightUtc, "tick", BEIJING, w, 24)).toBe("Oct 13");
  });

  test("a liquidation column and its tooltip", () => {
    const start = Date.parse("2026-10-12T16:00:00Z");
    expect(formatTime(start, "col", 0, w, 2)).toBe("16");
    expect(formatTime(start, "col", BEIJING, w, 2)).toBe("13/00");
    expect(formatTime(start, "colt", BEIJING, w, 2)).toBe("Oct 13 00:00–02:00 UTC+8");
    expect(formatTime(start, "colt", 0, w, 2)).toBe("16:00–18:00 UTC");
  });

  test("the words follow the page's language", () => {
    const zh = withLocale("zh", () => timeWords());
    expect(formatTime(CANDLE, "when", BEIJING, zh, 0)).toBe("10月12日 23:00 UTC+8");
  });
});

describe("tags", () => {
  test("a time is served in UTC and stamped with its moment", () => {
    expect(timeTag(CANDLE, "hm")).toBe(
      `<time datetime="2026-10-12T15:00:00.000Z" data-t="${CANDLE}" data-tf="hm">15:00</time>`,
    );
    expect(timeTitle(CANDLE, "when", "buy $1M · {t}")).toBe(
      ` title="buy $1M · Oct 12 15:00 UTC" data-tt="${CANDLE}" data-tf="when" data-tpl="buy $1M · {t}"`,
    );
  });

  test("the browser half parses", () => {
    expect(() => new Function(localTimeScript())).not.toThrow();
    expect(() => new Function(withLocale("zh", () => localTimeScript()))).not.toThrow();
  });
});

describe("readouts", () => {
  test("a bar reads as its whole range, in the reader's zone", () => {
    const words = slotWords();
    expect(slotWhen(CANDLE, words, BEIJING, 3_600_000)).toBe("Oct 12 23:00–00:00 UTC+8");
    expect(slotWhen(CANDLE, words, 0, 15 * 60_000)).toBe("Oct 12 15:00–15:15 UTC");
    expect(slotWhen(CANDLE)).toBe("Oct 12 15:00 UTC");
  });

  test("a whale candle reads its open, high, low, close, volume and the bursts in it", () => {
    const text = candleText(
      {
        kind: "wcandle",
        from: CANDLE,
        unit: 3_600_000,
        slots: [[82542, 82770.9, 82539.3, 82680.3, 41_000_000, 2_400_000, 0, 2, 0], null],
      },
      0,
      SLOT_FORMAT,
    );
    expect(text).toBe(
      'Oct 12 15:00–16:00 UTC · open 82,542 · high 82,770.9 · low 82,539.3 · close <b class="cvd-up">82,680.3</b> (+0.17%) · volume $41.0M · large taker buys <b class="cvd-up">$2.4M</b> (2)',
    );
    expect(
      candleText({ kind: "wcandle", from: CANDLE, unit: 3_600_000, slots: [null] }, 0, SLOT_FORMAT),
    ).toBe("Oct 12 15:00–16:00 UTC · no candle");
  });
});
