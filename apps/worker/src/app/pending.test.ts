import { describe, expect, test } from "bun:test";
import { parsePending } from "./data";

describe("parsePending", () => {
  test("reads the comma-joined rows the query sends", () => {
    expect(parsePending("1.5,2,3e6", "4,5,6")).toEqual({ longs: [1.5, 2, 3e6], shorts: [4, 5, 6] });
  });

  test("refuses a model it cannot read whole", () => {
    expect(parsePending("", "")).toBeNull();
    expect(parsePending("1,2", "1,2,3")).toBeNull();
    expect(parsePending("1,x", "1,2")).toBeNull();
    expect(parsePending("1,-2", "1,2")).toBeNull();
    // The raw array literal postgres.js hands back with fetch_types off: the bug this guards.
    expect(parsePending("{1,2}", "{1,2}")).toBeNull();
  });
});
