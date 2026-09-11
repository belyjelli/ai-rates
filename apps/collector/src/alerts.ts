import type { VenueHealth } from "./health";

export interface AlertPayload {
  text: string;
  ok: boolean;
  stale: string[];
}

export type AlertSink = (payload: AlertPayload) => Promise<void>;

/** The only part of fetch the sink uses, so a test can pass a plain function. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Reports venues that stop collecting, and their recovery, over a webhook.
 *
 * Only transitions are sent: a message when venues newly go stale, and one when everything is
 * healthy again. A venue recovering while others are still stale stays quiet, so a partial outage
 * produces a couple of messages rather than one a minute until someone looks.
 */
export class StaleVenueAlerter {
  private stale: string[] = [];

  constructor(
    private readonly send: AlertSink,
    private readonly log?: (message: string) => void,
  ) {}

  async check(snapshot: { venues: readonly VenueHealth[] }): Promise<void> {
    const stale = snapshot.venues
      .filter((venue) => venue.stale)
      .map((venue) => venue.venueId)
      .sort();
    const newlyStale = stale.filter((venueId) => !this.stale.includes(venueId));
    const recovered = this.stale.length > 0 && stale.length === 0;
    const previous = this.stale;
    this.stale = stale;

    if (newlyStale.length > 0) {
      const errors = snapshot.venues
        .filter((venue) => venue.stale && venue.error)
        .map((venue) => `${venue.venueId}: ${venue.error}`);
      await this.report({
        ok: false,
        stale,
        text: [
          `airates: ${stale.length} venue${stale.length === 1 ? "" : "s"} stale (${stale.join(", ")})`,
          errors.length > 0 ? `last errors -- ${errors.join("; ")}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      });
      return;
    }

    if (recovered) {
      await this.report({
        ok: true,
        stale: [],
        text: `airates: all venues collecting again (was ${previous.join(", ")})`,
      });
    }
  }

  private async report(payload: AlertPayload): Promise<void> {
    this.log?.(payload.text);
    await this.send(payload);
  }
}

/** Posts to a Slack- or Discord-style incoming webhook; both field names are sent. */
export function webhookSink(url: string, fetchImpl: FetchLike = fetch): AlertSink {
  return async (payload) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, content: payload.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`webhook returned HTTP ${response.status}`);
  };
}
