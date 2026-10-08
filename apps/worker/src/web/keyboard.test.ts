import { describe, expect, test } from "bun:test";
import { contentSecurityPolicy } from "../app/security-headers";
import { ACTIONS, HOTKEYS_API, hotkeyLegend, hotkeyScript } from "./hotkeys";
import { bindable, DRAWN_KEYS } from "./keyboard";

describe("hotkeys", () => {
  test("every default key is drawn on the keyboard and may be bound", () => {
    for (const action of ACTIONS.filter((a) => a.key)) {
      expect(DRAWN_KEYS).toContain(action.key);
      expect(bindable(action.key)).toBe(true);
    }
  });

  test("no two actions share a default key, and ids are unique", () => {
    const keys = ACTIONS.map((a) => a.key).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(ACTIONS.map((a) => a.id)).size).toBe(ACTIONS.length);
  });

  test("the browser's keys and the ones forms need never take an action", () => {
    for (const key of [
      "F5",
      "F11",
      "F12",
      "Tab",
      "Enter",
      " ",
      "Backspace",
      "Shift",
      "ArrowLeft",
    ]) {
      expect(bindable(key)).toBe(false);
    }
    for (const key of ["r", "?", "[", "Escape", "F1", "F10"]) expect(bindable(key)).toBe(true);
  });

  test("the status-bar legend shows the advertised actions in their default keys", () => {
    const legend = hotkeyLegend();
    expect(legend).toContain('<span data-act="rates"><b>r</b>rates</span>');
    expect(legend).toContain('<span data-act="filter"><b>/</b>filter</span>');
    expect(legend).toContain('<span data-act="keys"><b>?</b>keyboard map</span>');
    expect(legend).not.toContain('data-act="top"');
  });

  test("the page script cannot be closed early by anything in its data", () => {
    expect(hotkeyScript()).not.toContain("</script");
  });

  test("pages may call the member area, which holds the profiles", () => {
    expect(contentSecurityPolicy([])).toContain(new URL(HOTKEYS_API).origin);
  });
});
