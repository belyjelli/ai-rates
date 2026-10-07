import type { Overview } from "../app/data";
import { ENDPOINTS } from "../app/openapi";
import { esc } from "./format";
import { layout, SITE_ORIGIN } from "./layout";
import { englishOnly } from "./legal";

/** The API reference, rendered from the same list as the OpenAPI spec so the two cannot drift. */
export function docs(data: { overview: Overview; now: number }): string {
  const endpoints = ENDPOINTS.map((endpoint) => {
    const params = endpoint.params
      .map(
        (p) =>
          `<li><code>${esc(p.name)}</code> (${p.in ?? "query"}${p.required ? ", required" : ""}) ${esc(p.description)}</li>`,
      )
      .join("");
    return `<article>
<h2><code>GET ${esc(endpoint.path)}</code></h2>
<p>${esc(endpoint.summary)}</p>${params ? `<ul>${params}</ul>` : ""}
</article>`;
  }).join("");
  return layout({
    title: "API",
    description: "Read-only JSON API for funding rates, spreads, liquidations and markets.",
    path: "/docs",
    overview: data.overview,
    now: data.now,
    body: englishOnly(`<h1>API</h1>
<p class="lede">Read-only JSON over HTTPS, no key needed. The machine-readable description is <a href="/v1/openapi.json">OpenAPI</a>; the discovery file is <a href="/.well-known/api-catalog">/.well-known/api-catalog</a>; health is <a href="/v1/health">/v1/health</a>. Base URL: <code>${SITE_ORIGIN}</code>. Please credit and link airrates.net when you reuse the data, and see the <a href="/tos">terms</a>.</p>
<div class="about-log">${endpoints}</div>`),
  });
}
