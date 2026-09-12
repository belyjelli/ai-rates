import { describe, expect, test } from "bun:test";
import {
  type FetchLike,
  TURNSTILE_ACTION,
  type TurnstileReason,
  verifyTurnstile,
} from "./turnstile";

/** A siteverify stub that records what it was sent. No network, no global mock. */
function stub(payload: unknown, status = 200) {
  const calls: { url: string; body: URLSearchParams; init?: RequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({
      url,
      body: new URLSearchParams(String(init?.body ?? "")),
      ...(init ? { init } : {}),
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch, calls };
}

const solved = { success: true, action: TURNSTILE_ACTION, hostname: "localhost" };

describe("verifyTurnstile", () => {
  test("accepts a token solved for this action on a known host", async () => {
    const { fetch, calls } = stub(solved);
    const verdict = await verifyTurnstile("token-abc", { secret: "sekret", fetch });

    expect(verdict.ok).toBe(true);
    expect(verdict.reason).toBeUndefined();
    // Form-encoded, with the secret and the token under the documented parameter names.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(calls[0]?.body.get("secret")).toBe("sekret");
    expect(calls[0]?.body.get("response")).toBe("token-abc");
  });

  test("refuses an absent token without spending a round trip", async () => {
    const { fetch, calls } = stub(solved);
    for (const empty of [null, undefined, "", "   "]) {
      const verdict = await verifyTurnstile(empty, { secret: "sekret", fetch });
      expect(verdict).toEqual({ ok: false, reason: "missing_token" });
    }
    // Nothing was sent: siteverify would only have answered missing-input-response.
    expect(calls).toHaveLength(0);
  });

  test("passes remoteip and idempotency_key only when given", async () => {
    const withIp = stub(solved);
    await verifyTurnstile("t", {
      secret: "s",
      fetch: withIp.fetch,
      remoteip: "203.0.113.7",
      idempotencyKey: "11111111-2222-3333-4444-555555555555",
    });
    expect(withIp.calls[0]?.body.get("remoteip")).toBe("203.0.113.7");
    expect(withIp.calls[0]?.body.get("idempotency_key")).toBe(
      "11111111-2222-3333-4444-555555555555",
    );

    const without = stub(solved);
    await verifyTurnstile("t", { secret: "s", fetch: without.fetch, remoteip: null });
    expect(without.calls[0]?.body.has("remoteip")).toBe(false);
    expect(without.calls[0]?.body.has("idempotency_key")).toBe(false);
  });

  test("success is not enough: the action must match the widget's", async () => {
    // A token minted for another form on the site verifies fine, and must still be refused.
    const { fetch } = stub({ ...solved, action: "signup" });
    const verdict = await verifyTurnstile("t", { secret: "s", fetch });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("wrong_action");
  });

  test("success is not enough: the hostname must be one of ours", async () => {
    // A token solved on someone else's page also verifies, which is what makes this check the
    // thing that stops it being transferable.
    const { fetch } = stub({ ...solved, hostname: "evil.example" });
    const verdict = await verifyTurnstile("t", { secret: "s", fetch });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("wrong_hostname");

    // A missing hostname is refused too rather than treated as absent-so-fine.
    const blank = stub({ success: true, action: TURNSTILE_ACTION });
    expect((await verifyTurnstile("t", { secret: "s", fetch: blank.fetch })).reason).toBe(
      "wrong_hostname",
    );
  });

  test("an explicit allowlist and action override the defaults", async () => {
    const { fetch } = stub({ success: true, action: "other", hostname: "staging.example" });
    const verdict = await verifyTurnstile("t", {
      secret: "s",
      fetch,
      action: "other",
      hostnames: ["staging.example"],
    });
    expect(verdict.ok).toBe(true);
  });

  test("maps Cloudflare's error codes to something a log can be read from", async () => {
    const cases: [string, TurnstileReason][] = [
      ["timeout-or-duplicate", "already_used"],
      ["missing-input-response", "missing_token"],
      ["invalid-input-secret", "bad_secret"],
      ["missing-input-secret", "bad_secret"],
      ["internal-error", "unavailable"],
      ["invalid-input-response", "invalid_token"],
      ["some-code-cloudflare-adds-later", "invalid_token"],
    ];
    for (const [code, reason] of cases) {
      const { fetch } = stub({ success: false, "error-codes": [code] });
      const verdict = await verifyTurnstile("t", { secret: "s", fetch });
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBe(reason);
      // The raw codes survive for the log line.
      expect(verdict.errorCodes).toEqual([code]);
    }
  });

  test("a replayed token is refused, since tokens verify exactly once", async () => {
    const { fetch } = stub({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect((await verifyTurnstile("used", { secret: "s", fetch })).reason).toBe("already_used");
  });

  test("fails closed on a network fault, a bad status or a malformed body", async () => {
    const thrown: FetchLike = async () => {
      throw new Error("connection reset");
    };
    expect(await verifyTurnstile("t", { secret: "s", fetch: thrown })).toEqual({
      ok: false,
      reason: "unavailable",
    });

    const serverError = stub({ success: true }, 500);
    expect((await verifyTurnstile("t", { secret: "s", fetch: serverError.fetch })).reason).toBe(
      "unavailable",
    );

    const notJson: FetchLike = async () => new Response("<html>nope</html>", { status: 200 });
    expect((await verifyTurnstile("t", { secret: "s", fetch: notJson })).reason).toBe(
      "unavailable",
    );
  });

  test("refuses an over-long token without a round trip", async () => {
    const { fetch, calls } = stub(solved);
    const verdict = await verifyTurnstile("x".repeat(2049), { secret: "s", fetch });
    expect(verdict).toEqual({ ok: false, reason: "invalid_token" });
    expect(calls).toHaveLength(0);
  });
});
