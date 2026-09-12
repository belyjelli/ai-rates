import { describe, expect, test } from "bun:test";
import { CLEARANCE_COOKIE, CLEARANCE_TTL_MS, createClearance } from "./clearance";

const NOW = Date.parse("2026-09-13T12:00:00Z");
const cookieFor = (setCookie: string) => setCookie.slice(0, setCookie.indexOf(";"));

describe("clearance", () => {
  test("a freshly issued cookie passes, and carries the attributes it should", async () => {
    const clearance = createClearance("secret-one");
    const setCookie = await clearance.issue(NOW);

    expect(setCookie.startsWith(`${CLEARANCE_COOKIE}=`)).toBe(true);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    // Lax, not Strict: the cookie has to survive the 303 redirect back from the POST.
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain(`Max-Age=${CLEARANCE_TTL_MS / 1000}`);
    expect(await clearance.check(cookieFor(setCookie), NOW)).toBe(true);
  });

  test("it expires, and expiry is checked against the caller's clock", async () => {
    const clearance = createClearance("secret-one");
    const cookie = cookieFor(await clearance.issue(NOW));

    expect(await clearance.check(cookie, NOW + CLEARANCE_TTL_MS - 1000)).toBe(true);
    expect(await clearance.check(cookie, NOW + CLEARANCE_TTL_MS + 1)).toBe(false);
  });

  test("editing the expiry does not buy more time", async () => {
    // The whole reason for the HMAC: the expiry is attacker-visible, so it must be authenticated.
    const clearance = createClearance("secret-one");
    const cookie = cookieFor(await clearance.issue(NOW));
    const [expiry, signature] = cookie.slice(CLEARANCE_COOKIE.length + 1).split(".");

    const extended = `${CLEARANCE_COOKIE}=${Number(expiry) + 10 * 60_000}.${signature}`;
    expect(await clearance.check(extended, NOW)).toBe(false);
  });

  test("a tampered or truncated signature fails", async () => {
    const clearance = createClearance("secret-one");
    const cookie = cookieFor(await clearance.issue(NOW));
    const [expiry, signature] = cookie.slice(CLEARANCE_COOKIE.length + 1).split(".");

    for (const bad of [
      `${expiry}.${signature?.slice(0, -1)}`,
      `${expiry}.${signature}x`,
      `${expiry}.`,
      `${expiry}`,
      "not-a-cookie-value",
      "",
    ]) {
      expect(await clearance.check(`${CLEARANCE_COOKIE}=${bad}`, NOW)).toBe(false);
    }
  });

  test("a cookie signed with another secret fails", async () => {
    const mine = createClearance("secret-one");
    const theirs = createClearance("secret-two");
    const forged = cookieFor(await theirs.issue(NOW));

    expect(await mine.check(forged, NOW)).toBe(false);
    // And the converse, so the test cannot pass by both simply rejecting everything.
    expect(await theirs.check(forged, NOW)).toBe(true);
  });

  test("it is found among other cookies, and absence is not clearance", async () => {
    const clearance = createClearance("secret-one");
    const mine = cookieFor(await clearance.issue(NOW));

    expect(await clearance.check(`other=1; ${mine}; third=x`, NOW)).toBe(true);
    expect(await clearance.check("other=1; third=x", NOW)).toBe(false);
    expect(await clearance.check(null, NOW)).toBe(false);
    expect(await clearance.check("", NOW)).toBe(false);
    // A cookie whose name merely ends with ours must not match.
    expect(await clearance.check(`not_${mine}`, NOW)).toBe(false);
  });
});
