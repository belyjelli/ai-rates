import { describe, expect, test } from "bun:test";
import { contentSecurityPolicy } from "../app/security-headers";
import { ACTIONS, HOTKEYS_API, hotkeyScript, navKeyCap } from "./hotkeys";
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

  test("each nav link wears the default key of the action that leads to it", () => {
    expect(navKeyCap("/rates")).toEqual({
      cap: '<b class="nav-key" data-act="rates" aria-hidden="true">r</b>',
      attr: ' aria-keyshortcuts="r"',
    });
    // The Chart action kept its old id, which saved profiles name it by.
    expect(navKeyCap("/chart").cap).toContain('data-act="cvd"');
    expect(navKeyCap("/").cap).toContain(">h</b>");
    // A page with no go action, or one that ships unbound, gets no cap.
    expect(navKeyCap("/nowhere")).toEqual({ cap: "", attr: "" });
    expect(navKeyCap("/glossary")).toEqual({ cap: "", attr: "" });
  });

  test("the page script cannot be closed early by anything in its data", () => {
    expect(hotkeyScript()).not.toContain("</script");
  });

  test("pages may call the member area, which holds the profiles", () => {
    expect(contentSecurityPolicy([])).toContain(new URL(HOTKEYS_API).origin);
  });
});
