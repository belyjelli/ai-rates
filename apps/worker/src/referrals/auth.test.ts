import { describe, expect, test } from "bun:test";
import { adminCredentials, askForCredentials, authorized, MIN_PASSWORD_LENGTH } from "./auth";

const credentials = { user: "owner", password: "correct horse battery" };
const basic = (value: string) => ({ authorization: `Basic ${btoa(value)}` });
const request = (headers: Record<string, string> = {}) =>
  new Request("https://www.airrates.net/admin/referrals", { headers });

describe("adminCredentials", () => {
  test("both must be set, and the password must be long enough", () => {
    expect(adminCredentials("owner", "correct horse battery")).toEqual(credentials);
    expect(adminCredentials(" owner ", "correct horse battery")?.user).toBe("owner");
    expect(adminCredentials(undefined, "correct horse battery")).toBeNull();
    expect(adminCredentials("owner", undefined)).toBeNull();
    expect(adminCredentials("", "correct horse battery")).toBeNull();
    expect(adminCredentials("owner", "x".repeat(MIN_PASSWORD_LENGTH - 1))).toBeNull();
    expect(adminCredentials("owner", "x".repeat(MIN_PASSWORD_LENGTH))).not.toBeNull();
  });
});

describe("authorized", () => {
  test("accepts exactly the configured pair", async () => {
    expect(await authorized(request(basic("owner:correct horse battery")), credentials)).toBe(true);
  });

  test("refuses anything else", async () => {
    expect(await authorized(request(), credentials)).toBe(false);
    expect(await authorized(request({ authorization: "Bearer token" }), credentials)).toBe(false);
    expect(await authorized(request({ authorization: "Basic" }), credentials)).toBe(false);
    expect(
      await authorized(request({ authorization: "Basic !!!not-base64!!!" }), credentials),
    ).toBe(false);
    expect(await authorized(request(basic("owner")), credentials)).toBe(false);
    expect(await authorized(request(basic("owner:wrong")), credentials)).toBe(false);
    expect(await authorized(request(basic("someone:correct horse battery")), credentials)).toBe(
      false,
    );
    // A prefix of the password is not the password.
    expect(await authorized(request(basic("owner:correct horse batter")), credentials)).toBe(false);
  });

  test("the scheme is case-insensitive, and a password may contain colons", async () => {
    const colons = { user: "owner", password: "a:b:c:d:e:f:g:h" };
    expect(
      await authorized(
        request({ authorization: `basic ${btoa("owner:a:b:c:d:e:f:g:h")}` }),
        colons,
      ),
    ).toBe(true);
  });
});

describe("askForCredentials", () => {
  test("asks the browser for a login and is never cached or indexed", () => {
    const response = askForCredentials();
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="airrates admin", charset="UTF-8"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
