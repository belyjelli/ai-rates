import { describe, expect, test } from "bun:test";
import { type AlertPayload, StaleVenueAlerter, webhookSink } from "./alerts";
import type { VenueHealth } from "./health";

const venue = (venueId: string, stale: boolean, error: string | null = null): VenueHealth => ({
  venueId,
  lastRunAt: 1,
  lastSuccessAt: stale ? null : 1,
  markets: stale ? 0 : 10,
  error,
  stale,
});

function alerter() {
  const sent: AlertPayload[] = [];
  return {
    sent,
    subject: new StaleVenueAlerter(async (payload) => {
      sent.push(payload);
    }),
  };
}

describe("StaleVenueAlerter", () => {
  test("stays quiet while every venue is collecting", async () => {
    const { sent, subject } = alerter();
    await subject.check({ venues: [venue("bybit", false), venue("okx", false)] });
    await subject.check({ venues: [venue("bybit", false), venue("okx", false)] });
    expect(sent).toEqual([]);
  });

  test("reports newly stale venues once, not on every check", async () => {
    const { sent, subject } = alerter();
    const snapshot = {
      venues: [venue("bybit", true, "HTTP 429"), venue("okx", false)],
    };
    await subject.check(snapshot);
    await subject.check(snapshot);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.ok).toBe(false);
    expect(sent[0]?.stale).toEqual(["bybit"]);
    expect(sent[0]?.text).toContain("1 venue stale (bybit)");
    expect(sent[0]?.text).toContain("bybit: HTTP 429");
  });

  test("reports again when a further venue goes stale", async () => {
    const { sent, subject } = alerter();
    await subject.check({ venues: [venue("bybit", true), venue("okx", false)] });
    await subject.check({ venues: [venue("bybit", true), venue("okx", true)] });

    expect(sent).toHaveLength(2);
    expect(sent[1]?.stale).toEqual(["bybit", "okx"]);
    expect(sent[1]?.text).toContain("2 venues stale");
  });

  test("a partial recovery stays quiet; a full recovery reports once", async () => {
    const { sent, subject } = alerter();
    await subject.check({ venues: [venue("bybit", true), venue("okx", true)] });
    await subject.check({ venues: [venue("bybit", true), venue("okx", false)] });
    expect(sent).toHaveLength(1);

    await subject.check({ venues: [venue("bybit", false), venue("okx", false)] });
    expect(sent).toHaveLength(2);
    expect(sent[1]?.ok).toBe(true);
    expect(sent[1]?.text).toContain("all venues collecting again");

    await subject.check({ venues: [venue("bybit", false), venue("okx", false)] });
    expect(sent).toHaveLength(2);
  });

  test("a venue going stale again after recovering is reported", async () => {
    const { sent, subject } = alerter();
    await subject.check({ venues: [venue("bybit", true)] });
    await subject.check({ venues: [venue("bybit", false)] });
    await subject.check({ venues: [venue("bybit", true)] });
    expect(sent.map((p) => p.ok)).toEqual([false, true, false]);
  });
});

describe("webhookSink", () => {
  test("posts the message under both Slack and Discord field names", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const sink = webhookSink("https://hooks.example/abc", async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response("ok", { status: 200 });
    });

    await sink({ text: "airates: 1 venue stale (bybit)", ok: false, stale: ["bybit"] });

    expect(calls[0]?.url).toBe("https://hooks.example/abc");
    expect(calls[0]?.body).toMatchObject({
      text: "airates: 1 venue stale (bybit)",
      content: "airates: 1 venue stale (bybit)",
      ok: false,
      stale: ["bybit"],
    });
  });

  test("throws when the webhook rejects, so the periodic task logs it", async () => {
    const sink = webhookSink(
      "https://hooks.example/abc",
      async () => new Response("nope", { status: 500 }),
    );
    await expect(sink({ text: "x", ok: false, stale: [] })).rejects.toThrow("HTTP 500");
  });
});
