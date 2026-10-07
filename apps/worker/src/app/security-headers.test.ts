import { describe, expect, test } from "bun:test";
import {
  contentSecurityPolicy,
  inlineScripts,
  SECURITY_HEADERS,
  scriptHash,
  withSecurityHeaders,
} from "./security-headers";

const PAGE = `<!doctype html><html><head>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>
<script>window.dataLayer=[];</script>
<script type="application/ld+json">{"@type":"WebSite"}</script>
</head><body><main>
<script type="application/json" class="slot-data">{"a":1}</script>
<script type="module">import("./x.js")</script>
<script>
  console.log("é");
</script>
</main></body></html>`;

describe("inlineScripts", () => {
  test("keeps the executable inline scripts, in order, and skips loaded ones and data blocks", () => {
    expect(inlineScripts(PAGE)).toEqual([
      "window.dataLayer=[];",
      'import("./x.js")',
      '\n  console.log("é");\n',
    ]);
  });
});

describe("scriptHash", () => {
  test("is the CSP sha256 token of the UTF-8 text", async () => {
    // SHA-256 of the empty string, base64: the standard test vector.
    expect(await scriptHash("")).toBe("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
    // Non-ASCII hashes its UTF-8 bytes, as a browser does, not its UTF-16 code units.
    expect(await scriptHash("é")).toBe("'sha256-SplVfkAzw1Od4utlRyAXytX5VX96BiWgnxw/biumnEw='");
  });
});

describe("contentSecurityPolicy", () => {
  test("allows only this page's scripts and Google Analytics, and refuses framing", () => {
    const policy = contentSecurityPolicy(["'sha256-abc'"]);
    expect(policy).toContain("script-src 'self' 'sha256-abc' https://*.googletagmanager.com");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("'unsafe-inline' https"); // never on scripts
    expect(policy).not.toContain("'unsafe-eval'");
  });
});

describe("withSecurityHeaders", () => {
  test("a page gets every header and a policy listing each of its inline scripts", async () => {
    const out = await withSecurityHeaders(
      new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } }),
    );
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(out.headers.get(name)).toBe(value);
    }
    const policy = out.headers.get("content-security-policy") ?? "";
    for (const script of inlineScripts(PAGE)) expect(policy).toContain(await scriptHash(script));
    // The body goes out unchanged.
    expect(await out.text()).toBe(PAGE);
  });

  test("JSON gets the plain headers but no page policy", async () => {
    const out = await withSecurityHeaders(
      new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    expect(out.headers.get("x-content-type-options")).toBe("nosniff");
    expect(out.headers.has("content-security-policy")).toBe(false);
  });

  test("headers a handler set itself are kept", async () => {
    const out = await withSecurityHeaders(
      new Response("<p>admin</p>", {
        headers: {
          "content-type": "text/html",
          "referrer-policy": "same-origin",
          "content-security-policy": "default-src 'none'",
        },
      }),
    );
    expect(out.headers.get("referrer-policy")).toBe("same-origin");
    expect(out.headers.get("content-security-policy")).toBe("default-src 'none'");
    expect(out.headers.get("x-frame-options")).toBe("DENY");
  });

  test("a response that already has everything is passed through untouched", async () => {
    const first = await withSecurityHeaders(
      new Response(PAGE, { headers: { "content-type": "text/html" } }),
    );
    expect(await withSecurityHeaders(first)).toBe(first);
  });
});
