import { describe, expect, test } from "bun:test";
import { formatPrice, formatUsd } from "./format";
import {
  cvdText,
  SLOT_FORMAT,
  SLOT_SCRIPT,
  sidesText,
  slotData,
  slotPct,
  slotPrice,
  slotUsd,
  slotWhen,
} from "./slot-chart";

describe("slot formatters", () => {
  test("dollars and prices read exactly as the server's own formatters print them", () => {
    // The readout is rebuilt in the browser, so a copy that drifted from format.ts would show a bar
    // in different words from the table beside it.
    for (const value of [
      0, 0.4, 640, 999, 1_000, 25_000, 99_949, 99_950, 999_949, 1_000_000, 912e6, 4.1e9, 123.4e9,
    ]) {
      expect(slotUsd(value)).toBe(formatUsd(value));
      expect(slotUsd(-value)).toBe(formatUsd(-value));
    }
    for (const value of [0.0001234, 0.5, 1, 2.573, 140, 999.99, 1_000, 77_766.74]) {
      expect(slotPrice(value)).toBe(formatPrice(value));
    }
  });

  test("percent carries the site's minus and never signs a zero", () => {
    expect(slotPct(0.1234, 2)).toBe("+0.12%");
    expect(slotPct(-42.86, 1)).toBe("−42.9%");
    expect(slotPct(-0.001, 2)).toBe("0.00%");
  });

  test("time is the slot's start in UTC", () => {
    expect(slotWhen(Date.parse("2026-09-17T14:15:00Z"))).toBe("Sep 17 14:15 UTC");
    expect(slotWhen(Date.parse("2026-01-02T03:05:00Z"))).toBe("Jan 2 03:05 UTC");
  });
});

describe("cvdText", () => {
  test("a bar reads its price, both sides, the signed net and the running CVD", () => {
    expect(cvdText("Sep 12 11:15 UTC", [5e6, 2e6, 76_100], 3e6, 76_000, SLOT_FORMAT)).toBe(
      'Sep 12 11:15 UTC · price 76,100 (+0.13% since start) · bought $5.0M · sold $2.0M · net <b class="cvd-up">+$3.0M</b> (+42.9% of volume) · CVD <b class="cvd-up">+$3.0M</b>',
    );
    expect(cvdText("t", [1e6, 4e6, null], -2e6, 76_000, SLOT_FORMAT)).toBe(
      't · bought $1.0M · sold $4.0M · net <b class="cvd-down">−$3.0M</b> (−60.0% of volume) · CVD <b class="cvd-down">−$2.0M</b>',
    );
  });

  test("an empty slot still says where the running total stands", () => {
    expect(cvdText("t", null, 3e6, null, SLOT_FORMAT)).toBe(
      't · no flow recorded · CVD <b class="cvd-up">+$3.0M</b>',
    );
  });
});

describe("sidesText", () => {
  test("reads both sides, the signed difference, the heavier side and the count", () => {
    expect(sidesText("t", [12_000, 7_974_000, 835], SLOT_FORMAT)).toBe(
      't · longs closed $12.0k · shorts closed $8.0M · longs − shorts <b class="lq-ink-s">−$8.0M</b> · shorts heavier, 100% · 835 liquidations',
    );
    expect(sidesText("t", [5_000, 5_000, 1], SLOT_FORMAT)).toBe(
      't · longs closed $5.0k · shorts closed $5.0k · longs − shorts <b class="">$0</b> · even · 1 liquidation',
    );
    expect(sidesText("t", null, SLOT_FORMAT)).toBe("t · nothing force-closed");
  });
});

describe("SLOT_SCRIPT", () => {
  test("is valid JavaScript once the helpers are embedded, and needs no bundler helper", () => {
    expect(() => new Function(SLOT_SCRIPT)).not.toThrow();
    expect(SLOT_SCRIPT).not.toContain("__name");
  });

  test("a value reaching the embedded data cannot close its script tag", () => {
    // No payload value is a string today; the escape is what keeps it safe if one ever is.
    const tampered = slotData(JSON.parse('{"kind":"</script><b>","from":0,"unit":1,"slots":[]}'));
    const inner = tampered.slice(tampered.indexOf(">") + 1, tampered.lastIndexOf("</script>"));
    expect(inner).not.toContain("<");
    expect(JSON.parse(inner).kind).toBe("</script><b>");
  });
});
