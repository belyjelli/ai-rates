import { beforeEach, describe, expect, test } from "bun:test";
import { accessConfig, resetAccessKeyCache, verifyAccessToken } from "./access";

const TEAM = "https://airrates.cloudflareaccess.com";
const AUD = "aud-tag-0123456789";
const NOW_MS = Date.parse("2026-09-15T12:00:00Z");
const NOW_S = NOW_MS / 1000;

const encoder = new TextEncoder();
const base64Url = (bytes: Uint8Array | ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const encodeJson = (value: unknown) => base64Url(encoder.encode(JSON.stringify(value)));

const pair = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
const publicJwk = {
  ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
  kid: "key-1",
  use: "sig",
};

async function sign(
  claims: Record<string, unknown>,
  header: Record<string, unknown> = { alg: "RS256", kid: "key-1" },
) {
  const unsigned = `${encodeJson(header)}.${encodeJson(claims)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    pair.privateKey,
    encoder.encode(unsigned),
  );
  return `${unsigned}.${base64Url(signature)}`;
}

const good = {
  aud: [AUD],
  iss: TEAM,
  exp: NOW_S + 3600,
  iat: NOW_S - 60,
  email: "owner@example.com",
  sub: "user-1",
};

let certCalls = 0;
const certs = async (url: string) => {
  certCalls++;
  expect(url).toBe(`${TEAM}/cdn-cgi/access/certs`);
  return Response.json({ keys: [publicJwk] });
};
const config = { teamDomain: TEAM, aud: AUD };
const verify = (token: string | null, fetch = certs) =>
  verifyAccessToken(token, config, { fetch, now: () => NOW_MS });

beforeEach(() => {
  resetAccessKeyCache();
  certCalls = 0;
});

describe("verifyAccessToken", () => {
  test("a valid token yields its identity, and the keys are cached", async () => {
    expect(await verify(await sign(good))).toEqual({
      email: "owner@example.com",
      subject: "user-1",
    });
    expect(await verify(await sign(good))).not.toBeNull();
    expect(certCalls).toBe(1);
  });

  test("a single-string audience is accepted too", async () => {
    expect(await verify(await sign({ ...good, aud: AUD }))).not.toBeNull();
  });

  test("anything not ours, not current or not intact is refused", async () => {
    expect(await verify(null)).toBeNull();
    expect(await verify("not.a.jwt.at-all")).toBeNull();
    expect(await verify(await sign({ ...good, aud: ["another-app"] }))).toBeNull();
    expect(
      await verify(await sign({ ...good, iss: "https://evil.cloudflareaccess.com" })),
    ).toBeNull();
    expect(await verify(await sign({ ...good, exp: NOW_S - 3600 }))).toBeNull();
    expect(await verify(await sign({ ...good, exp: undefined }))).toBeNull();
    expect(await verify(await sign({ ...good, nbf: NOW_S + 3600 }))).toBeNull();

    // A valid signature over different claims: swap the payload after signing.
    const [header, , signature] = (await sign(good)).split(".");
    const forged = `${header}.${encodeJson({ ...good, email: "attacker@example.com" })}.${signature}`;
    expect(await verify(forged)).toBeNull();
  });

  test("an unsigned token is refused whatever it claims", async () => {
    const unsigned = `${encodeJson({ alg: "none", kid: "key-1" })}.${encodeJson(good)}.`;
    expect(await verify(unsigned)).toBeNull();
  });

  test("an unknown key id re-fetches once for rotation, then refuses", async () => {
    expect(await verify(await sign(good, { alg: "RS256", kid: "rotated" }))).toBeNull();
    expect(certCalls).toBe(2);
  });

  test("an unreachable key endpoint refuses rather than throws", async () => {
    const failing = async () => new Response("down", { status: 502 });
    expect(await verify(await sign(good), failing)).toBeNull();
  });
});

describe("accessConfig", () => {
  test("normalises the team domain and needs both settings", () => {
    expect(accessConfig("AirRates.cloudflareaccess.com/", ` ${AUD} `)).toEqual(config);
    expect(accessConfig("https://airrates.cloudflareaccess.com", AUD)).toEqual(config);
    expect(accessConfig(undefined, AUD)).toBeNull();
    expect(accessConfig(TEAM, "")).toBeNull();
    // Only a real Access team domain can be an issuer we trust.
    expect(accessConfig("https://evil.example.com", AUD)).toBeNull();
  });
});
