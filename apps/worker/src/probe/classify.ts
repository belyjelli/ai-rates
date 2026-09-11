export type Verdict =
  | "ok"
  | "geo_blocked"
  | "waf_challenge"
  | "rate_limited"
  | "not_found"
  | "http_error"
  | "bad_body"
  | "timeout"
  | "network_error"
  | "unconfigured";

export interface Classification {
  verdict: Verdict;
  /** Compact body snippet for non-ok responses and small bodies; null otherwise. */
  detail: string | null;
}

const GEO_BLOCK =
  /restricted location|block access from your country|not available (?:in|from|for) your (?:country|region|jurisdiction)|unavailable in your (?:country|region)|geo-?blocked|jurisdiction that violates|from a restricted (?:country|region|jurisdiction)/i;
const CHALLENGE =
  /just a moment\.\.\.|cf-chl-|challenge-platform|attention required! \| cloudflare/i;

/** Bodies larger than this are only pattern-matched when the status is already an error. */
const SMALL_BODY = 4096;

export function classify(input: {
  status: number;
  headers: Headers;
  body: string;
}): Classification {
  const { status, headers, body } = input;
  const isError = status < 200 || status >= 300;
  const inspect = isError || body.length <= SMALL_BODY;
  const detail = inspect ? snippet(body) : null;

  if (headers.get("cf-mitigated") === "challenge" || (inspect && CHALLENGE.test(body))) {
    return { verdict: "waf_challenge", detail };
  }
  if (status === 451 || (inspect && GEO_BLOCK.test(body))) {
    return { verdict: "geo_blocked", detail };
  }
  if (status === 429 || status === 418) return { verdict: "rate_limited", detail };
  if (status === 404) return { verdict: "not_found", detail };
  if (isError) return { verdict: "http_error", detail };

  try {
    JSON.parse(body);
  } catch {
    return { verdict: "bad_body", detail };
  }
  return { verdict: "ok", detail };
}

function snippet(body: string): string | null {
  const text = body
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 240) : null;
}
