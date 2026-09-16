/**
 * HTTP Basic authentication for /admin, from two environment variables.
 *
 * Deliberately the simplest thing that is still safe over HTTPS: the browser's own login box, a
 * username and password set on the Worker, and no identity provider to configure. The Worker is
 * HTTPS-only, so the credentials are never sent in clear.
 *
 * What the simplicity must not cost:
 *   - unset or weak credentials mean the page refuses everyone, rather than opening;
 *   - the comparison runs over SHA-256 digests, so a wrong guess takes the same time whether it got
 *     the first character right or the whole username;
 *   - the caller rate-limits attempts (index.ts uses the Worker's limiter, keyed by IP).
 */

export interface AdminCredentials {
  user: string;
  password: string;
}

/** Short passwords are the failure mode of a password box on a public URL; twelve is the floor. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * The credentials from configuration, or null when they are missing or too weak. Null means /admin
 * refuses every request; it never means "skip the check".
 */
export function adminCredentials(
  user: string | undefined,
  password: string | undefined,
): AdminCredentials | null {
  const name = user?.trim();
  if (!name || !password || password.length < MIN_PASSWORD_LENGTH) return null;
  return { user: name, password };
}

/** Same-length digests, compared byte by byte: neither length nor content leaks through timing. */
async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function equalsSecret(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] as number) ^ (b[i] as number);
  return difference === 0;
}

/** Whether the request carries exactly these credentials in an Authorization: Basic header. */
export async function authorized(
  request: Request,
  credentials: AdminCredentials,
): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded) return false;

  let decoded: string;
  try {
    decoded = new TextDecoder().decode(
      Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)),
    );
  } catch {
    return false;
  }
  // Only the FIRST colon separates them: a password may contain colons, a username may not.
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;

  // Both are always compared, so a wrong username costs the same as a wrong password.
  const [userOk, passwordOk] = await Promise.all([
    equalsSecret(decoded.slice(0, separator), credentials.user),
    equalsSecret(decoded.slice(separator + 1), credentials.password),
  ]);
  return userOk && passwordOk;
}

/** The 401 that makes a browser show its login box. */
export function askForCredentials(): Response {
  return new Response("Authentication required.\n", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="airrates admin", charset="UTF-8"',
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
